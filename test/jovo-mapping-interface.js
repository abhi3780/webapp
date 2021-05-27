'use strict';
const { App } = require('jovo-framework');
const { Alexa } = require('jovo-platform-alexa');
const { GoogleAssistant} = require('jovo-platform-googleassistant');
const NGUAAUtils = require("nguaa-utils");
const logger = require("nguaa-logger");
const { IotServices } = require("./index");
const jovo_mapper = new App();
const logPrefixClass = 'JovoMappingInterface | ';
const unknownSourceError = "UNKNOWN_SOURCE";
jovo_mapper.use(
	new Alexa(),
	new GoogleAssistant()
);
jovo_mapper.setHandler({
	/**
		* @description Launched on new requests
		* @returns  redirects to welcome intent
		*/
	async LAUNCH() {
		logger.debug(logPrefixClass + " on launch from smart-iot device");
		return this.toIntent('WelcomeIntent');
	},
	/**
		* @description Triggered when there is an error
		*/
	async ON_ERROR() {
		logger.info("OPSMON: Intent: ON_ERROR")
		let responseMessages = await this.IotInitialization();
		let locale = this.$request.getLocale();
		let iotClient;
		if ((this.$host.event.resource).includes("google")) {
			iotClient = "GOOGLEHOME";
		} else {
			iotClient = "ALEXA";
		}
		let response = responseMessages[0][locale]["USER_SESSION_ERROR_" + iotClient];
		await this.submitResponse(response, "true", "");
	},
	/**
* @description Triggered when a session ends abrupty or with AMAZON.StopIntent & AMAZON.CancelIntent
*/
	async END() {
		logger.info("OPSMON: Intent: SessionEnd")
		let responseMessages = await this.IotInitialization();
		let locale = this.$request.getLocale();
		let response = responseMessages[0][locale]["USER_SESSION_END"];
		await this.submitResponse(response, "true", "");
	},

	/**
	* @description Provides a fallback for user utterances that do not match any of your skill's intents
	*/
	async FallbackIntent() {
		logger.info("OPSMON: Intent: FallBack")
		let responseMessages = await this.IotInitialization();
		let locale = this.$request.getLocale();
		let response = responseMessages[0][locale]["USER_SESSION_FALLBACK"];
		await this.submitResponse(response, "false", "");
	},

	/**
	* @description Launched when Google, Alexa cannot identify user utterance
	*/
	async Unhandled() {
		logger.info("OPSMON: Intent: Unhandled")
		let responseMessages = await this.IotInitialization();
		let locale = this.$request.getLocale();
		let response = responseMessages[0][locale]["USER_UTTERANCE_ERROR"];
		await this.submitResponse(response, "false", "");
	},
	/**
		* @description First response the user receives from the IoT devices
		*/
	async WelcomeIntent() {
		let logPrefixFn = logPrefixClass + "WelcomeIntent | ";
		logger.info("OPSMON: Intent: WelcomeIntent");
		let responseMessages = await this.IotInitialization();
		let iotClient;
		if ((this.$host.event.resource).includes("google")) {
			iotClient = "GOOGLEHOME";
		} else if ((this.$host.event.resource).includes("alexa")) {
			iotClient = "ALEXA";
		} else {
			logger.debug(logPrefixFn + "request from unknown source");
			throw unknownSourceError;
		}
		let languages = process.env.supportedLocales;
		let ParsedLanguages = languages.split(",");
		let locale = this.$request.getLocale();
		let count;
		let acceptedLanguage = false;
		for(count = 0; count<ParsedLanguages.length; count++){
			if(locale===ParsedLanguages[count]){
				acceptedLanguage = true;
			}
		}
		if(acceptedLanguage) {
			let messageCode = "WELCOME_" + iotClient;
			let locale = this.$request.getLocale();
			logger.info(logPrefixFn + "User locale: " + locale);
			let response = responseMessages[0][locale][messageCode];
			await this.submitResponse(response, "false", "");
		} else {
			let response = responseMessages[0]["non_supported"]["error_response"];
			await this.submitResponse(response, "false", "");
		}

		
	},

	/**
		* @description initializes IOT properties , messages
		*/
	async IotInitialization() {
		let logPrefixFn = "IotInitialization | ";
		let configDaoServices = NGUAAUtils.Config;
		let configDaoMethod = new configDaoServices.getDataFromConfig();
		let dbResponseMessages = await configDaoMethod.getConfigData("IOT_MESSAGES", "IOT");
		let responseMessages = dbResponseMessages.value;
		logger.debug(logPrefixFn + "dbResponse " + JSON.stringify(dbResponseMessages));
		logger.debug(logPrefixFn + "responseMessages " + JSON.stringify(responseMessages));
		let dbResponseConstants = await configDaoMethod.getConfigData("IOT_PROPERTIES", "IOT");
		let iotConstants = dbResponseConstants.value;
		logger.debug(logPrefixFn + "iotConstants " + JSON.stringify(iotConstants));
		logger.info("OPSMON: Constant and Message initialization completed");
		return ([responseMessages, iotConstants]);
	},
	/**
     * @description prompts for login
     */
	async loginPrompt() {
		let logPrefixFn = "loginPrompt | ";
		logger.info(logPrefixFn + "user account not linked.");
		logger.info("OPSMON: Token not present")
		if ((this.$host.event.resource).includes("google")) {
			logger.debug(logPrefixFn + "request from google");
			this.showAccountLinkingCard();
		} else if ((this.$host.event.resource).includes("alexa")) {
			logger.debug(logPrefixFn + "request from alexa");
			this.$alexaSkill.showAccountLinkingCard().tell("Please check for login card in your Alexa app and login");
		} else {
			logger.debug(logPrefixFn + "request from unknown source");
			throw unknownSourceError;
		}
	},
	/**
		* @description Provides details of vehicles associated with the user
		*/
	async Profile() {
		let logPrefixFn = logPrefixClass + 'Profile';
		logger.info("OPSMON: Intent: Profile");
		let responseMessages = await this.IotInitialization();
		const iotServicesObj = new IotServices(responseMessages[1]);
		let locale = this.$request.getLocale();
		let response;
		if (!this.$request.getAccessToken()) {
			await this.loginPrompt();
		}
		else {
			logger.info(logPrefixFn + "user account linked")
			let userToken = this.$request.getAccessToken();
			logger.info(logPrefixFn + "Jovo request " + JSON.stringify(this.$request));
			logger.debug(logPrefixFn + "responseMessages " + JSON.stringify(responseMessages));
			response = await iotServicesObj.profileContent(this.$host, userToken);
			if (response.includes("TOKEN") || response.includes("NO_VEHICLE") ) {
				response = responseMessages[0][locale][response];
				await this.submitResponse(response, "true", "");
			}
			else {
				await this.submitResponse(response, "false", "");
			}
		}
	},
	/**
		* @description launched when user asks for help
		*/
	async HelpIntent() {
		var logPrefixFn = logPrefixClass + 'Help Intent | ';
		logger.info("OPSMON: Intent: HelpIntent");
		let iotClient;
		if ((this.$host.event.resource).includes("google")) {
			iotClient = "GOOGLEHOME";
			logger.debug(logPrefixFn + "iotClient" + iotClient);
		} else if ((this.$host.event.resource).includes("alexa")) {
			iotClient = "ALEXA";
			logger.debug(logPrefixFn + "iotClient" + iotClient);
		} else {
			logger.debug(logPrefixFn + "request from unknown source");
			throw unknownSourceError;
		}
		let helpObj;
		if (this.$inputs.HelpEntity) {
			logger.debug("this.$inputs.HelpEntity" + JSON.stringify(this.$inputs.HelpEntity.key));
			logger.info("OPSMON: Help for " + this.$inputs.HelpEntity.key);
			if (this.$inputs.HelpEntity.key === "remote operation") {
				helpObj = "HELP_FOR_REMOTE_OPERATIONS";
			} else if (this.$inputs.HelpEntity.key === "vehicle status") {
				helpObj = "HELP_FOR_VEHICLE_STATUS";
			}
			else if (this.$inputs.HelpEntity.key === "point of interest") {
				helpObj = "HELP_FOR_POI";
			}
			else {
				helpObj = "HELP";
			}
		}
		helpObj = helpObj + "_" + iotClient;
		logger.debug(logPrefixFn + "HelpEntity " + helpObj);
		let locale = this.$request.getLocale();
		let responseMessages = await this.IotInitialization();
		let iotResponseMessage = responseMessages[0][locale][helpObj];
		logger.debug(logPrefixFn + "Final response message " + iotResponseMessage);
		await this.submitResponse(iotResponseMessage, "false", "");
	},
	/**
		* @description launced when user tries to fire a remote command like Remote lock
		*/
	async RemoteOperations() {
		var logPrefixFn = logPrefixClass + "RemoteOperations | ";
		logger.silly(logPrefixFn + "isTBM " + process.env.allowTBM)
		logger.info("OPSMON: Intent: RemoteOperations");
		logger.debug(logPrefixFn + " Input stored in jovo " + JSON.stringify(this.$inputs));
		let responseMessages = await this.IotInitialization();
		let iotResMessageKey = {};
		let locale = this.$request.getLocale();
		const iotServicesObj = new IotServices(responseMessages[1]);
		if (!this.$request.getAccessToken()) {
			await this.loginPrompt();
		}
		else {
			this.setSessionAttribute('intent', 'RemoteOperations');
			logger.info(logPrefixFn + "access token available")
			let userToken = this.$request.getAccessToken();
			if (this.$inputs.operation && this.$inputs.operation.key !== "" && this.$inputs.operation.key) {
				this.setSessionAttribute('operationName', this.$inputs.operation.key.toUpperCase());
			}
			if (this.$inputs.vehicle && this.$inputs.vehicle.key !== "" && this.$inputs.vehicle.key) {
				this.setSessionAttribute('vehicleName', this.$inputs.vehicle.key.toUpperCase());
			}
			if (this.$inputs.pin && this.$inputs.pin.key !== "" && this.$inputs.pin.key) {
				this.setSessionAttribute('pin', this.$inputs.pin.key.toString());
			}
			logger.info(logPrefixFn + "Current Session Data: " + JSON.stringify(this.$session.$data));
			iotResMessageKey = await iotServicesObj.sendRemoteOperation(this.$host, userToken, this.getSessionAttribute('vehicleName') || "", this.getSessionAttribute('operationName') || "", this.getSessionAttribute('pin') || "");
			logger.info("OPSMON: Response received from service");
		}
		if (!this.getSessionAttribute('invalidPinCount'))
			this.setSessionAttribute('invalidPinCount', 0);
		let iotResponseMessage = "";
		if (iotResMessageKey.message){
			iotResponseMessage = responseMessages[0][locale][iotResMessageKey.message];
		}
		//Ro initiated or subscription inactive
		if (iotResMessageKey.sessionEndFlag === "true") {
			if(!(iotResponseMessage.includes("login")))
				iotResponseMessage = iotResponseMessage.replace("{vehicleName}", iotResMessageKey.vehicleName).replace("{operation}", this.getSessionAttribute('operationName').toLowerCase());
			await this.submitResponse(iotResponseMessage, "true", "");
		}
		else if (iotResMessageKey.sessionEndFlag === "false" && iotResMessageKey.pinResetFlag === "true") {
			this.setSessionAttribute('invalidPinCount', 0);
			if (iotResMessageKey.vehicleNotFoundFlag) {
				iotResponseMessage = iotResponseMessage.replace("{vehicles}", iotResMessageKey.vehicles);
				await this.submitResponse(iotResponseMessage, "false", "GetVehicleName");
			}
			else {
				await this.submitResponse(iotResponseMessage, "false", "");
			}
		}
		//Invalid Pin
		else if (iotResMessageKey.pinResetFlag === "false") {
			this.setSessionAttribute('invalidPinCount', this.getSessionAttribute('invalidPinCount') + 1);
			logger.info(logPrefixFn + "Invalid Pin Count: " + this.getSessionAttribute('invalidPinCount'));
			//Attempts exceeded
			if (this.getSessionAttribute('invalidPinCount') >= responseMessages[1]["NGUAA_INVALID_PIN_ATTEMPT_COUNT"]) {
				//3 attempts
				iotResponseMessage = responseMessages[0][locale]["NGUAA_REST_API_INVALID_ATTEMPTS_EXCEEDED_" + iotResMessageKey.message.substring(27)];
				await this.submitResponse(iotResponseMessage, "true", "");
			}
			//Greater than 1 Invalid Pin attempt
			else {
				await this.submitResponse(iotResponseMessage, "false", "");
			}
		}
	},
	'GetVehicleName': {
		async VehicleIntent() {
			logger.info('GetVehicleName: VehicleIntent: ' + this.$inputs.vehicle.key.toUpperCase())
			return this.toIntent(this.getSessionAttribute('intent'));
		}
	},
	/**
	* @description Provides details of vehicle's fuel level
	*/
	async FuelLevelStatus() {
		var logPrefixFn = logPrefixClass + "FuelLevelStatus | ";
		logger.info("OPSMON: Intent: FuelLevelStatus");
		let responseMessages = await this.IotInitialization();
		logger.debug(logPrefixFn + " Input stored in jovo " + JSON.stringify(this.$inputs));
		let iotResMessageKey = {}, property = "fuelAmountLevel";
		if (!this.$request.getAccessToken()) {
			await this.loginPrompt();
		}
		else {
			this.setSessionAttribute('intent', 'FuelLevelStatus');
			logger.info(logPrefixFn + "access token available")
			let userToken = this.$request.getAccessToken();
			if (this.$inputs.vehicle.key)
				this.setSessionAttribute('vehicleName', this.$inputs.vehicle.key.toUpperCase());
			else
				this.setSessionAttribute('vehicleName', "");
			const iotServicesObj = new IotServices(responseMessages[1]);
			iotResMessageKey = await iotServicesObj.getVehicleStatus(userToken, this.$host, this.getSessionAttribute('vehicleName'), property);
		}
		logger.info("OPSMON: Response received from service");
		let locale = this.$request.getLocale();
		let iotResponseMessage = "";
		if (iotResMessageKey.message)
			iotResponseMessage = responseMessages[0][locale][iotResMessageKey.message];
		if (iotResMessageKey.value === property) {
			iotResponseMessage = iotResponseMessage.replace("?", "Fuel level status");
		} else {
			iotResponseMessage = iotResponseMessage.replace("?", iotResMessageKey.value);
		}
		logger.debug(logPrefixFn + "iotResMessageKey.message: " + iotResMessageKey.message);
		if (iotResMessageKey.sessionEndFlag === "false") {
			iotResponseMessage = iotResponseMessage.replace("{vehicles}", iotResMessageKey.vehicles)
			await this.submitResponse(iotResponseMessage, "false", "GetVehicleName");
		} else {
			await this.submitResponse(iotResponseMessage, "true", "");
		}

	},
		/**
		* @description Provides charge status
		*/
	async ChargeStatus() {
		var logPrefixFn = logPrefixClass + "ChargeStatus | ";
		logger.info("OPSMON: Intent: ChargeStatus");
		let responseMessages = await this.IotInitialization();
		logger.debug(logPrefixFn + " Input stored in jovo " + JSON.stringify(this.$inputs));
		let iotResMessageKey = {}, property = "chargeStatus";
		if (!this.$request.getAccessToken()) {
			await this.loginPrompt();
		}
		else {
			this.setSessionAttribute('intent', 'ChargeStatus');
			logger.info(logPrefixFn + "access token available");
			let userToken = this.$request.getAccessToken();
			if (this.$inputs.vehicle.key)
				this.setSessionAttribute('vehicleName', this.$inputs.vehicle.key.toUpperCase());
			else
				this.setSessionAttribute('vehicleName', "");
			const iotServicesObj = new IotServices(responseMessages[1]);
			iotResMessageKey = await iotServicesObj.getVehicleStatus(userToken, this.$host, this.getSessionAttribute('vehicleName'), property);
		}
		let locale = this.$request.getLocale();
		let iotResponseMessage = "";
		if (iotResMessageKey.message)
			iotResponseMessage = responseMessages[0][locale][iotResMessageKey.message];
		iotResponseMessage = iotResponseMessage.replace("?", "Charge status");
		logger.info("OPSMON: Response received from service");
		if (iotResMessageKey.sessionEndFlag === "false") {
			iotResponseMessage = iotResponseMessage.replace("{vehicles}", iotResMessageKey.vehicles)
			await this.submitResponse(iotResponseMessage, "false", "GetVehicleName");
		} else {
			await this.submitResponse(iotResponseMessage, "true", "");
		}
	},

	/**
	* @description Provides details of vehicle's combined range
	*/
	async CombinedRange() {
		var logPrefixFn = logPrefixClass + "CombinedRange | ";
		logger.info("OPSMON: Intent: CombinedRange");
		let responseMessages = await this.IotInitialization();
		let iotResMessageKey = {}, property = "combinedRange";
		logger.debug(logPrefixFn + " Input stored in jovo " + JSON.stringify(this.$inputs));
		if (!this.$request.getAccessToken()) {
			await this.loginPrompt();
		}
		else {
			this.setSessionAttribute('intent', 'CombinedRange');
			logger.info(logPrefixFn + "access token available");
			let userToken = this.$request.getAccessToken();
			if (this.$inputs.vehicle.key) {
				this.setSessionAttribute('vehicleName', this.$inputs.vehicle.key.toUpperCase());
			}
			else
				this.setSessionAttribute('vehicleName', "");
			const iotServicesObj = new IotServices(responseMessages[1]);
			iotResMessageKey = await iotServicesObj.getVehicleStatus(userToken, this.$host, this.getSessionAttribute('vehicleName'), property);
		}
		let locale = this.$request.getLocale();
		let iotResponseMessage = "";
		if (iotResMessageKey.message)
			iotResponseMessage = responseMessages[0][locale][iotResMessageKey.message];
		if (iotResMessageKey.value === property)
			iotResponseMessage = iotResponseMessage.replace("?", "Combined range");
		else iotResponseMessage = iotResponseMessage.replace("?", iotResMessageKey.value);
		if (iotResMessageKey.sessionEndFlag === "false") {
			iotResponseMessage = iotResponseMessage.replace("{vehicles}", iotResMessageKey.vehicles)
			await this.submitResponse(iotResponseMessage, "false", "GetVehicleName");
		}
		else await this.submitResponse(iotResponseMessage, "true", "");
	},
	/**
		* @description Provides remaining charge time
		*/
	async ChargeTime() {
		var logPrefixFn = logPrefixClass + "ChargeTime | ";
		logger.info("OPSMON: Intent: ChargeTime");
		let responseMessages = await this.IotInitialization();
		let iotResMessageKey = {}, property = "chargeTime";
		logger.debug(logPrefixFn + " Input stored in jovo " + JSON.stringify(this.$inputs));
		if (!this.$request.getAccessToken()) {
			await this.loginPrompt();
		}
		else {
			this.setSessionAttribute('intent', 'ChargeTime');
			logger.info(logPrefixFn + "access token available");
			let userToken = this.$request.getAccessToken();
			if (this.$inputs.vehicle.key)
				this.setSessionAttribute('vehicleName', this.$inputs.vehicle.key.toUpperCase());
			else
				this.setSessionAttribute('vehicleName', "");
			const iotServicesObj = new IotServices(responseMessages[1]);
			iotResMessageKey = await iotServicesObj.getVehicleStatus(userToken, this.$host, this.getSessionAttribute('vehicleName'), property);
		}
		let locale = this.$request.getLocale();
		let iotResponseMessage = "";
		if (iotResMessageKey.message)
			iotResponseMessage = responseMessages[0][locale][iotResMessageKey.message];
		if (iotResMessageKey.value === property)
			iotResponseMessage = iotResponseMessage.replace("?", "Charge time");
		else iotResponseMessage = iotResponseMessage.replace("?", iotResMessageKey.value);
		if (iotResMessageKey.sessionEndFlag === "false") {
			iotResponseMessage = iotResponseMessage.replace("{vehicles}", iotResMessageKey.vehicles)
			await this.submitResponse(iotResponseMessage, "false", "GetVehicleName");
		}
		else await this.submitResponse(iotResponseMessage, "true", "");
	},
	/**
* @description Provides details of vehicle's electric range
*/
	async ElectricRange() {
		var logPrefixFn = logPrefixClass + "ElectricRange | ";
		logger.info("OPSMON: Intent: ElectricRange");
		let responseMessages = await this.IotInitialization();
		logger.debug(logPrefixFn + " Input stored in jovo " + JSON.stringify(this.$inputs));
		let iotResMessageKey = {}, property = "electricRange";
		if (!this.$request.getAccessToken()) {
			await this.loginPrompt();
		}
		else {
			this.setSessionAttribute('intent', 'ElectricRange');
			logger.info(logPrefixFn + "access token available");
			let userToken = this.$request.getAccessToken();
			if (this.$inputs.vehicle.key)
				this.setSessionAttribute('vehicleName', this.$inputs.vehicle.key.toUpperCase());
			else
				this.setSessionAttribute('vehicleName', "");
			const iotServicesObj = new IotServices(responseMessages[1]);
			iotResMessageKey = await iotServicesObj.getVehicleStatus(userToken, this.$host, this.getSessionAttribute('vehicleName'), property);
		}
		let locale = this.$request.getLocale();
		let iotResponseMessage = "";
		if (iotResMessageKey.message)
			iotResponseMessage = responseMessages[0][locale][iotResMessageKey.message];
		if (iotResMessageKey.value === property)
			iotResponseMessage = iotResponseMessage.replace("?", "Electric range");
		else iotResponseMessage = iotResponseMessage.replace("?", iotResMessageKey.value);
		if (iotResMessageKey.sessionEndFlag === "false") {
			iotResponseMessage = iotResponseMessage.replace("{vehicles}", iotResMessageKey.vehicles)
			await this.submitResponse(iotResponseMessage, "false", "GetVehicleName");
		}
		else await this.submitResponse(iotResponseMessage, "true", "");
	},

	/**
	* @description Provides details of vehicle's mileage
	*/
	async MileageStatus() {
		var logPrefixFn = logPrefixClass + "MileageStatus | ";
		logger.info("OPSMON: Intent: MileageStatus");
		let responseMessages = await this.IotInitialization();
		logger.debug(logPrefixFn + " Input stored in jovo " + JSON.stringify(this.$inputs));
		let iotResMessageKey = {}, property = "odometer";
		if (!this.$request.getAccessToken()) {
			await this.loginPrompt();
		}
		else {
			this.setSessionAttribute('intent', 'MileageStatus');
			logger.info(logPrefixFn + "access token available");
			let userToken = this.$request.getAccessToken();
			if (this.$inputs.vehicle.key)
				this.setSessionAttribute('vehicleName', this.$inputs.vehicle.key.toUpperCase());
			else
				this.setSessionAttribute('vehicleName', "");
			const iotServicesObj = new IotServices(responseMessages[1]);
			iotResMessageKey = await iotServicesObj.getVehicleStatus(userToken, this.$host, this.getSessionAttribute('vehicleName'), property);
		}
		let locale = this.$request.getLocale();
		let iotResponseMessage = "";
		if (iotResMessageKey.message)
			iotResponseMessage = responseMessages[0][locale][iotResMessageKey.message];
		if (iotResMessageKey.value === property)
			iotResponseMessage = iotResponseMessage.replace("?", "Mileage");
		else iotResponseMessage = iotResponseMessage.replace("?", iotResMessageKey.value);
		if (iotResMessageKey.sessionEndFlag === "false") {
			iotResponseMessage = iotResponseMessage.replace("{vehicles}", iotResMessageKey.vehicles)
			await this.submitResponse(iotResponseMessage, "false", "GetVehicleName");
		}
		else await this.submitResponse(iotResponseMessage, "true", "");
	},

	/**
	* @description Gives details of vehicle's tire pressure
	*/
	async TirePressureStatus() {
		var logPrefixFn = logPrefixClass + "TirePressureStatus | ";
		logger.info("OPSMON: Intent: TirePressureStatus");
		let responseMessages = await this.IotInitialization();
		logger.debug(logPrefixFn + " Input stored in jovo " + JSON.stringify(this.$inputs));
		let iotResMessageKey = {}, property = "tireWarning";
		if (!this.$request.getAccessToken()) {
			await this.loginPrompt();
		}
		else {
			this.setSessionAttribute('intent', 'TirePressureStatus');
			logger.info(logPrefixFn + "access token available");
			let userToken = this.$request.getAccessToken();
			if (this.$inputs.vehicle.key)
				this.setSessionAttribute('vehicleName', this.$inputs.vehicle.key.toUpperCase());
			else
				this.setSessionAttribute('vehicleName', "");
			const iotServicesObj = new IotServices(responseMessages[1]);
			iotResMessageKey = await iotServicesObj.getVehicleStatus(userToken, this.$host, this.getSessionAttribute('vehicleName'), property);
		}
		let locale = this.$request.getLocale();
		let iotResponseMessage = "";
		if (iotResMessageKey.message)
			iotResponseMessage = responseMessages[0][locale][iotResMessageKey.message];
		if (iotResMessageKey.value === property)
			iotResponseMessage = iotResponseMessage.replace("?", "Tire pressure status");
		else iotResponseMessage = iotResponseMessage.replace("?", iotResMessageKey.value);
		if (iotResMessageKey.sessionEndFlag === "false") {
			iotResponseMessage = iotResponseMessage.replace("{vehicles}", iotResMessageKey.vehicles)
			await this.submitResponse(iotResponseMessage, "false", "GetVehicleName");
		}
		else await this.submitResponse(iotResponseMessage, "true", "");
	},
	/**
	* @description Provides details of vehicle's oil level
	*/
	async VehicleOilLifeStatus() {
		var logPrefixFn = logPrefixClass + "VehicleOilLifeStatus | ";
		logger.info("OPSMON: Intent: VehicleOilLifeStatus");
		let responseMessages = await this.IotInitialization();
		logger.debug(logPrefixFn + " Input stored in jovo " + JSON.stringify(this.$inputs));
		let iotResMessageKey = {}, property = "oilLevel";
		if (!this.$request.getAccessToken()) {
			await this.loginPrompt();
		}
		else {
			this.setSessionAttribute('intent', 'VehicleOilLifeStatus');
			logger.info(logPrefixFn + "access token available");
			let userToken = this.$request.getAccessToken();
			if (this.$inputs.vehicle.key)
				this.setSessionAttribute('vehicleName', this.$inputs.vehicle.key.toUpperCase());
			else
				this.setSessionAttribute('vehicleName', "");
			const iotServicesObj = new IotServices(responseMessages[1]);
			iotResMessageKey = await iotServicesObj.getVehicleStatus(userToken, this.$host, this.getSessionAttribute('vehicleName'), property);
		}
		let locale = this.$request.getLocale();
		let iotResponseMessage = "";
		if (iotResMessageKey.message)
			iotResponseMessage = responseMessages[0][locale][iotResMessageKey.message];
		if (iotResMessageKey.value === property)
			iotResponseMessage = iotResponseMessage.replace("?", "Vehicle oil life");
		else iotResponseMessage = iotResponseMessage.replace("?", iotResMessageKey.value);
		if (iotResMessageKey.sessionEndFlag === "false") {
			iotResponseMessage = iotResponseMessage.replace("{vehicles}", iotResMessageKey.vehicles)
			await this.submitResponse(iotResponseMessage, "false", "GetVehicleName");
		}
		else await this.submitResponse(iotResponseMessage, "true", "");
	},

	/**
		* @description Provides top 3 points of interest
		*/
	async RemoteSendPOI() {
		var logPrefixFn = logPrefixClass + "RemoteSendPOI | ";
		logger.info("OPSMON: Intent: RemoteSendPOI");
		logger.debug(logPrefixFn + " Input stored in jovo " + JSON.stringify(this.$inputs));
		if (!this.$request.getAccessToken()) {
			await this.loginPrompt();
		}
		else {
			this.setSessionAttribute('intent', 'RemoteSendPOI');
			if (this.$inputs.poi && this.$inputs.poi.key)
				this.setSessionAttribute('address', this.$inputs.poi.key);
			let response = await this.initializeSDV();
			if (!response.device) {
				await this.submitResponse(response.response, response.flag, response.state);
			}
			else {
				this.$alexaSkill.showAskForAddressCard().tell(response.response);
			}
		}
	},

	/**
		* @description checks user subscription and requests user device location
		*/
	async initializeSDV() {
		let responseMessages = await this.IotInitialization();
		var logPrefixFn = logPrefixClass + "initializeSDV | ";
		let iotClient;
		if ((this.$host.event.resource).includes("alexa")) {
			iotClient = "ALEXA";
		}
		else iotClient = "GOOGLEHOME";
		let userToken = this.$request.getAccessToken();
		if (this.$inputs.vehicle.key)
			this.setSessionAttribute('vehicleName', this.$inputs.vehicle.key.toUpperCase());
		this.setSessionAttribute('vehicleName', this.getSessionAttribute('vehicleName') || "");
		logger.debug(logPrefixFn + " Vehicle name is: " + this.getSessionAttribute('vehicleName'));
		logger.info(logPrefixFn + " Vehicle name is: " + this.getSessionAttribute('address'))
		const iotServicesObj = new IotServices(responseMessages[1]);
		let response;
		let iotResponseMessage = await iotServicesObj.initializeService(userToken, this.getSessionAttribute('vehicleName'), iotClient, this.$host.event);
		if (iotResponseMessage.message !== "VEHICLE_FOUND") {
			let flag ='true';
			if(iotResponseMessage.message.includes('DISAMBIGUATION') || iotResponseMessage.message.includes('MULTIPLE') || iotResponseMessage.message.includes('INCORRECT'))
				flag ='false'
			logger.info(logPrefixFn + "Vehicle not found ");
			iotResponseMessage.message = iotResponseMessage.message.replace("VEHICLES", "VEHICLES_POI").replace("DISAMBIGUATION", "DISAMBIGUATION_POI");
			response = responseMessages[0][this.$request.getLocale()][iotResponseMessage.message + "_" + iotClient];
			response = response.replace("{vehicles}", iotResponseMessage.vehicles);
			return { 'response': response, 'flag': flag, 'state': "GetVehicleName" };
		}
		else {
			this.setSessionAttribute("vehicleName", iotResponseMessage.vehicleName)
			let subscriptionStatus = await iotServicesObj.isSubscriptionActive(iotResponseMessage.vehicleObj, "SDV");
			if (subscriptionStatus.message !== "SERVICE_SUBSCRIPTION_ACTIVE") {
				response = responseMessages[0][this.$request.getLocale()][subscriptionStatus.message + "_" + iotClient];
				return { 'response': response, 'flag': "true", 'state': "" };
			}
			else {
				this.setSessionAttribute('vehicle', iotResponseMessage);
				let type;
				if (this.getSessionAttribute('intent') === "RemoteSendPOI") {
					type = "POI"
				}
				else type = "ADDRESS";
				let locationData = {
					"locationFlag": "false",
					"deviceLocation": {}
				};
				if (iotClient === "ALEXA") {
					locationData.iotClient = iotClient;
					try {
						locationData.deviceLocation = await this.$alexaSkill.$user.getDeviceAddress();
						locationData.locationFlag = "true";
						if (!locationData.deviceLocation.addressLine1 && !locationData.deviceLocation.postalCode) {
							response = "Please set the device address in your Alexa app"
							return { 'response': response, 'flag': "true", 'state':""};
						}
					}
					catch (err) {
						logger.info(logPrefixFn + "Device location unavailable " + err.code);
						response = "Please enable and set address in your app"
						return { 'response': response, 'flag': "false", 'device': "true" };
					}
				}
				else {
					this.setSessionAttribute('type', type);
					return this.toIntent('LocationIntent');
				}
				if (locationData.locationFlag === "true") {
					iotResponseMessage = await iotServicesObj.findPOI(locationData, this.getSessionAttribute('address'), type, iotResponseMessage);
					response = responseMessages[0][this.$request.getLocale()][iotResponseMessage.message];
					if (iotResponseMessage.status !== "SUCCESS") {
						return { 'response': response, 'flag': "true", 'state': "" }
					}
					else {
						this.setSessionAttribute('sdvObj', iotResponseMessage.sdvObj);
						if (type === "POI") {
							response = response.replace("{interest}", iotResponseMessage.sdvObj.category)
								.replace("{poi1}", iotResponseMessage.destName[0]).replace("{distance1}", iotResponseMessage.distance[0])
								.replace("{rating}", iotResponseMessage.rating[0])
								.replace("{poi1}", iotResponseMessage.destName[1]).replace("{distance1}", iotResponseMessage.distance[1])
								.replace("{rating}", iotResponseMessage.rating[1])
								.replace("{poi1}", iotResponseMessage.destName[2]).replace("{distance1}", iotResponseMessage.distance[2])
								.replace("{rating}", iotResponseMessage.rating[2]);
						}
						else {
							response = response.replace("{address}", this.getSessionAttribute('address'))
								.replace("{distance}", iotResponseMessage.distance)
								.replace("{time}", iotResponseMessage.time);
						}
						return { 'response': response, 'flag': "false", 'state': "SendPoiToCar" }
					}
				}
			}
		}
	},

	/**
		* @description provides user requested address with distance
		*/
	async RemoteSendAddress() {
		var logPrefixFn = logPrefixClass + "RemoteSendAddress | ";
		logger.info("OPSMON: Intent: RemoteSendAddress");
		logger.debug(logPrefixFn + " Input stored in jovo " + JSON.stringify(this.$inputs));
		if (!this.$request.getAccessToken()) {
			await this.loginPrompt();
		}
		else {
			this.setSessionAttribute('intent', 'RemoteSendAddress');
			if (this.$inputs.address && this.$inputs.address.key)
				this.setSessionAttribute('address', this.$inputs.address.key);
			let response = await this.initializeSDV();
			if (!response.device) {
				await this.submitResponse(response.response, response.flag, response.state);
			}
			else {
				this.$alexaSkill.showAskForAddressCard().tell(response.response);
			}

		}
	},

	'SendPoiToCar': {
		async YesIntent() {
			let sdvObj = this.getSessionAttribute('sdvObj');
			logger.updateLogger({ uid: sdvObj.uid, iotP: sdvObj.iotClient })
			logger.info("OPSMON: Intent: Yes POI");
			logger.debug("YesIntent: Current Session Data" + JSON.stringify(this.$session.$data));
			let responseMessages = await this.IotInitialization();
			const iotServicesObj = new IotServices(responseMessages[1]);
			sdvObj.name = sdvObj.name[0];
			sdvObj.address = sdvObj.address[0];
			let sendDestination = await iotServicesObj.sendDestinationToVehicle(sdvObj);
			let locale = this.$request.getLocale();
			let response = responseMessages[0][locale][sendDestination].replace("vehicle", sdvObj.vehicleName);
			await this.submitResponse(response, "true", "");
		},
		async ChoiceIntent() {
			let sdvObj = this.getSessionAttribute('sdvObj');
			logger.updateLogger({ uid: sdvObj.uid, iotP: sdvObj.iotClient })
			logger.info("OPSMON: Intent: Choice Intent POI");
			logger.debug("POIChoiceIntent: Current Session Data" + JSON.stringify(this.$session.$data));
			let choice = this.$inputs.choice.key - 1;
			let responseMessages = await this.IotInitialization();
			const iotServicesObj = new IotServices(responseMessages[1]);
			sdvObj.name = sdvObj.name[choice];
			sdvObj.poiLong = sdvObj.poiLong[choice];
			sdvObj.poiLat = sdvObj.poiLat[choice];
			sdvObj.address = sdvObj.address[choice];
			let sendDestination = await iotServicesObj.sendDestinationToVehicle(sdvObj);
			let locale = this.$request.getLocale();
			let response = responseMessages[0][locale][sendDestination].replace("vehicle", sdvObj.vehicleName);
			await this.submitResponse(response, "true", "");
		},
		async NoIntent() {
			logger.updateLogger({ uid: this.$session.$data.sdvObj.uid, iotP: this.$session.$data.sdvObj.iotClient })
			logger.info("OPSMON: Intent: No POI");
			let responseMessages = await this.IotInitialization();
			let locale = this.$request.getLocale();
			let response = responseMessages[0][locale]["POI_NO_INTENT"];
			await this.submitResponse(response, "true", "");
		},
		async Unhandled() {
			logger.updateLogger({ uid: this.$session.$data.sdvObj.uid, iotP: this.$session.$data.sdvObj.iotClient })
			logger.info("OPSMON: Intent: UnhandledIntent-POI");
			await this.submitResponse("You can say yes or no", "false", "SendPoiToCar");
		},
	},

	async LocationIntent() {
		logger.info("Location Intent");
		this.$googleAction.askForPreciseLocation('');
	},

	async ON_PERMISSION() {
		if (this.$googleAction.isPermissionGranted()) {
			if (this.$googleAction.$user.hasPermission('DEVICE_PRECISE_LOCATION')) {
				let device = this.$googleAction.getDevice();
				logger.info("ON PERMISSION | Device location: " + JSON.stringify(device));
				let locationData = {
					"deviceLocation": device.location.coordinates,
					"locationFlag": "true",
					"iotClient": "GOOGLEHOME"
				}
				let responseMessages = await this.IotInitialization();
				const iotServicesObj = new IotServices(responseMessages[1]);
				let iotResponseMessage = await iotServicesObj.findPOI(locationData, this.getSessionAttribute('address'), this.getSessionAttribute('type'), this.getSessionAttribute('vehicle'));
				let response = responseMessages[0][this.$request.getLocale()][iotResponseMessage.message];
				if (iotResponseMessage.status === "SUCCESS") {
					logger.info("Google POI");
					this.setSessionAttribute('sdvObj', iotResponseMessage.sdvObj);
					if (this.getSessionAttribute('type') === "POI") {
						response = response.replace("{interest}", iotResponseMessage.sdvObj.category)
							.replace("{poi1}", iotResponseMessage.destName[0]).replace("{distance1}", iotResponseMessage.distance[0])
							.replace("{rating}", iotResponseMessage.rating[0])
							.replace("{poi1}", iotResponseMessage.destName[1]).replace("{distance1}", iotResponseMessage.distance[1])
							.replace("{rating}", iotResponseMessage.rating[1])
							.replace("{poi1}", iotResponseMessage.destName[2]).replace("{distance1}", iotResponseMessage.distance[2])
							.replace("{rating}", iotResponseMessage.rating[2])
					}
					else {
						response = response.replace("{address}", this.getSessionAttribute('address'))
							.replace("{distance}", iotResponseMessage.distance)
							.replace("{time}", iotResponseMessage.time);
					}
					await this.submitResponse(response, "false", "SendPoiToCar");
				}
				else {
					await this.submitResponse(response, "true", "");
				}
			}
			else {
				this.tell('Incorrect permissions granted');
			}
		}
		else {
			this.tell('Alright, maybe next time');
		}
	},

	/**
		* @description submits response message based on iotClient
		*/
	async submitResponse(response, sessionEndFlag, state) {
		let logPrefixFn = logPrefixClass + "submitResponse | ";
		let responseMessages = await this.IotInitialization();
		let skillName;
		if ((this.$host.event.resource).includes("google")) {
			skillName = (this.$host.event.body.session.split('/'))[1];
			response = response.replace(/{skill_name}/g, responseMessages[1].SKILL_MAPPING[skillName]);
			if (sessionEndFlag === "false") {
				if (state !== "") {
					this.followUpState(state).ask(response);
				}
				else {
					this.ask(response)	
				}
			}
			else {
				this.tell(response);
			}
		} else {
			skillName = this.$host.event.body.session.application.applicationId;
			logger.debug(logPrefixFn + "Skill id: " + skillName);
			response = response.replace(/{skill_name}/g, responseMessages[1].SKILL_MAPPING[skillName]);
			if (sessionEndFlag === "false") {
				if (state !== "") {
					this.followUpState(state).$alexaSkill.showSimpleCard('', response).ask(response);
				}
				else {
					this.$alexaSkill.showSimpleCard('', response).ask(response);
				}
			}
			else {
				this.$alexaSkill.showSimpleCard('', response).tell(response);
			}
		}
	}
});
module.exports.jovo_mapper = jovo_mapper;
