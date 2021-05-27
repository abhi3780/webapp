const NGUAAUtils = require("nguaa-utils");
const VehicleServices = require("nguaa-vehicle-dao");
const logger = require("nguaa-logger");
const pluralize = require('pluralize');
const { UserTokenValidator } = require('./user-token-service');
const { userDeviceAccountRegistration } = require('./user-device-account-registration');
const { NGUAARestAPI } = require('./nguaa-rest-api');
let tokenObj = new UserTokenValidator();
let VehicleService = new VehicleServices.VehicleServices();
const logPrefixClass = "IotServices | ";
class IotServices {
	constructor(iotConstants) {
		this.iotConstants = iotConstants;
	}
    /**
     * @description identifies input vehicle
     * @param {*} vehiclesObj Json object of all vehicles associated with user
     * @param {*} vehicleName Vehicle name spoken by user e.g. 2019 sprint 300
     * @returns vehicle details of the indentified vehicle
     */
	async manageUserVehiclesMapping(vehiclesObj, vehicleName) {
		logger.info("OPSMON: Vehicle name is: " + vehicleName)
		let userVehicleResponse = {
			'message': '',
			'vehicleObj': {}
		};
		let logPrefixFn = logPrefixClass + 'manageUserVehiclesMapping | ';
		logger.debug(logPrefixFn + "vehicleName :" + vehicleName);
		if (vehiclesObj.length !== 0) {
			let vehiclesArray = Object.keys(vehiclesObj[0].vehicles);
			let vehicleCount = vehiclesArray.length;
			logger.debug(logPrefixFn + " vehicleCount" + vehicleCount);
			if (vehicleCount === 0) {
				userVehicleResponse.message = "USER_DB_NO_VEHICLE_FOUND";
				logger.info("OPSMON: No vehicle found");
			} else if (vehicleCount > 1) {
				if (vehicleName === "") {
					userVehicleResponse.message = "USER_DB_MULTIPLE_VEHICLES";
				}
				else {
					var i, matchCount = 0, pos = -1;
					for (i = 0; i < vehicleCount; i++) {
						if (vehiclesObj[0].vehicles[vehiclesArray[i]].nickname) {
							if (vehicleName.includes((vehiclesObj[0].vehicles[vehiclesArray[i]].nickname.name).toUpperCase())) {
								matchCount++;
								pos = i;
							}
						}
					}
					if (matchCount > 1 || (vehicleName.includes("VEHICLE") || vehicleName.includes("CAR") || vehicleName.includes("TRUCK"))) {
						userVehicleResponse.message = "USER_DB_MULTIPLE_VEHICLES";
						logger.debug(logPrefixFn + "Nickname not unique");
					}
					else if(matchCount !== 1) {
						matchCount = 0;
						pos = -1;
						for (i = 0; i < vehicleCount; i++) {
							if (vehicleName.includes((vehiclesObj[0].vehicles[vehiclesArray[i]].make).toUpperCase())) {
								matchCount++;
								pos = i;
							}
						}
						if(matchCount !== 1) {
							let makeFoundFlag = matchCount;
							matchCount = 0;
							pos = -1;
							for (i = 0; i < vehicleCount; i++) {
								if (vehicleName.includes((vehiclesObj[0].vehicles[vehiclesArray[i]].modelDescription).toUpperCase())) {
									matchCount++;
									pos = i;
								}
							}
							if (matchCount === 0 && makeFoundFlag === 0) {
								userVehicleResponse.message = "USER_DB_INCORRECT_VEHICLE_DETAILS";
								logger.debug(logPrefixFn + "Incorrect vehicle details");
							}
							else if (matchCount !== 1) {
								matchCount = 0, pos = -1;
								for (i = 0; i < vehicleCount; i++) {
									if (vehicleName.includes(vehiclesObj[0].vehicles[vehiclesArray[i]].year)) {
										matchCount++;
										pos = i;
									}
								}
								if (matchCount !== 1){
									userVehicleResponse.message = "USER_DB_MULTIPLE_VEHICLES";
									logger.debug(logPrefixFn + "Disambiguation required");
								}
							}
						}
					}
					if (matchCount === 1) {
						if (!this.iotConstants.ALLOWED_MAKE.includes(vehiclesObj[0].vehicles[vehiclesArray[pos]].make.toUpperCase())) {
							userVehicleResponse.message = "USER_DB_DISALLOWED_MAKE";
						}
						else if(process.env.allowTBM.toUpperCase() === "FALSE" && vehiclesObj[0].vehicles[vehiclesArray[pos]].isTBM){
							userVehicleResponse.message = "USER_DB_DISALLOWED_TBM";
						}
						else {
							userVehicleResponse.message = "VEHICLE_FOUND";
							userVehicleResponse.vehicleObj = vehiclesObj[0].vehicles[vehiclesArray[pos]];
							logger.info(logPrefixFn + "New Object Details: " + vehiclesObj[0].vehicles[vehiclesArray[pos]]);
							logger.debug(logPrefixFn + "Vehicle found");
						}
					}
				}
				if(userVehicleResponse.message === "USER_DB_MULTIPLE_VEHICLES" && vehicleCount <= 4) {
					let disambResponse = await this.disambiguateRequest(vehiclesObj, vehiclesArray);
					userVehicleResponse.message = disambResponse.message;
					userVehicleResponse.vehicles = disambResponse.details;
				}
			} else if (vehicleCount === 1) {
				userVehicleResponse.message = "VEHICLE_FOUND";
				let vehicleObj = vehiclesObj[0].vehicles[vehiclesArray[0]];
				if (!(this.iotConstants.ALLOWED_MAKE.includes(vehicleObj.make.toUpperCase()))) {
					logger.debug(logPrefixFn + "This make is not allowed: " + vehicleObj.make)
					userVehicleResponse.message = "USER_DB_DISALLOWED_MAKE";
				} 
				else if(process.env.allowTBM.toUpperCase() === "FALSE" && vehicleObj.isTBM){
					userVehicleResponse.message = "USER_DB_DISALLOWED_TBM";

				} else if (vehicleName.includes("VEHICLE") || vehicleName.includes("CAR") || vehicleName.includes("TRUCK") || vehicleName === "") {
					userVehicleResponse.vehicleObj = vehicleObj;
					logger.debug(logPrefixFn + "Vehicle name is a common noun");
				} else {
					if (vehicleObj.nickname && vehicleName.includes(vehicleObj.nickname.name.toUpperCase())) {
						if (vehicleName.includes(vehicleObj.nickname.name.toUpperCase())) {
							userVehicleResponse.message = "VEHICLE_FOUND";
							userVehicleResponse.vehicleObj = vehicleObj;
							logger.debug(logPrefixFn + "Nickname matched");
						}
					}
					else if (vehicleName.includes(vehicleObj.make.toUpperCase())) {
						userVehicleResponse.vehicleObj = vehicleObj;
						logger.debug(logPrefixFn + "Make matched");
					} else if (vehicleName.includes(vehicleObj.modelDescription.toUpperCase())) {
						userVehicleResponse.vehicleObj = vehicleObj;
						logger.debug(logPrefixFn + "Model Description matched");
					} else {
						userVehicleResponse.message = "USER_DB_INCORRECT_VEHICLE_DETAILS";
					}
					
				}
			}
		}
		else {
			userVehicleResponse.message = "USER_DB_NO_VEHICLE_FOUND";
			logger.info("OPSMON: No vehicle found");
		}
		return userVehicleResponse;
	}

	/**
     * @description prepares disambiguation message
     * @param {*} vehiclesObj Json object of all vehicles associated with user
     * @param {*} vehiclesArray array of SANs of vehicles
     * @returns disambiguation message
     */
	async disambiguateRequest(vehicleObj, vehiclesArray){
		let logPrefixFn = logPrefixClass+"disambiguateRequest | ";
		let details = "";
		let response = {
			"message" : "USER_VEHICLE_DISAMBIGUATION"
		};
		for (let i = 0; i < vehiclesArray.length; i++) {
			if((process.env.allowTBM.toUpperCase() === "FALSE" && vehicleObj[0].vehicles[vehiclesArray[i]].isTBM)
				|| !this.iotConstants.ALLOWED_MAKE.includes(vehicleObj[0].vehicles[vehiclesArray[i]].make.toUpperCase())){
				continue;
			}
			if (details.length !== 0)
					details = details + " or ";
			if (vehicleObj[0].vehicles[vehiclesArray[i]].nickname) {
				details = details + "\"my " + (vehicleObj[0].vehicles[vehiclesArray[i]].nickname.name) + "\"";
			}
			else {
				let make = vehicleObj[0].vehicles[vehiclesArray[i]].make;
				let model =  vehicleObj[0].vehicles[vehiclesArray[i]].modelDescription
				let modelRes = await this.checkDuplicate(vehicleObj[0].vehicles, vehiclesArray, "modelDescription", i);
				if(modelRes === "true"){
					let yearRes = await this.checkDuplicate(vehicleObj[0].vehicles, vehiclesArray, "year", i);
					if(yearRes  === "true"){
						response.message = "USER_DB_SET_NICKNAME";
					}
					else{
						details =  details + "\"my " + vehicleObj[0].vehicles[vehiclesArray[i]].year + " " + make +  " " + model + "\"" ;
					}
				}
				else {
					details = details + "\"my " + make +  " " + model + "\"" ;
				}
			}
		}
		response.details = details.toLowerCase().split(' ').map((s) => s.charAt(0).toUpperCase() + s.substring(1))
							.join(' ').replace('My', 'my').replace('Or', 'or');
		logger.info(logPrefixFn + "Vehicle Disambiguation object" + details);
		return response;
	}

	/**
     * @description checks if a duplicate is present
     * @param {*} arr array of vehicles
     * @param {*} keys array of SANs of vehicles
	 * @param {*} attr attribute like make, model, etc
	 * @param {*} pos position of the element
     * @returns duplicate found or not
     */
	async checkDuplicate(arr, keys, attr, pos){
		let logPrefixFn = logPrefixClass + "checkDuplicate | ";
		let count=0;
		let value = arr[keys[pos]][attr].toString().toUpperCase();
		logger.info(logPrefixFn + "POS: " + pos);
		logger.info(logPrefixFn + "Array Length: " + keys.length);
		logger.info(logPrefixFn + "All cars: " + arr)
		for(let i=0;i<keys.length;i++){
			if(arr[keys[i]][attr].toString().toUpperCase() === value) {
				count+=1;
			}
		}
		logger.info(logPrefixFn + "COUNT: " + count);
		if(count>1)
			return "true";
		else return "false";
	}
    /**
     * @description checks subscription for service
     * @param {*} vehiclesObj  Json object of all vehicles associated with user
     * @param {*} iotOperation shorthand of remote operation fired by user eg. REON
     * @returns subscription status
     */
	async isSubscriptionActive(vehiclesObj, iotOperation) {
		let logPrefixFn = logPrefixClass + 'isSubscriptionActive |';
		logger.info(logPrefixFn + "vehiclesObj" + JSON.stringify(vehiclesObj));
		let serviceResponse = {
			'message': '',
			'serviceNameForAPI': ''
		};
		let allowedServices = Object.keys(this.iotConstants.RO_SERVICE_MAPPING_OBJECT);
		if (allowedServices.indexOf(iotOperation.toUpperCase()) < 0) {
			logger.info(logPrefixFn + "SERVICE_NOT_ALLOWED");
			logger.info("OPSMON: Service not allowed");
			serviceResponse.message = "SERVICE_NOT_ALLOWED";
			return serviceResponse;
		}
		else {
			let roService = this.iotConstants.RO_SERVICE_MAPPING_OBJECT[iotOperation.toUpperCase()];
			let roServiceName = roService[0];
			let serviceNameForAPI = roService[1];
			logger.info(logPrefixFn + "roServiceName " + roServiceName);
			let servicesCount = Object.keys(vehiclesObj.services).length; //servicesCount
			logger.debug(logPrefixFn + "services count " + servicesCount);
			let subscriptionflag = "notFound";
			for (let j = 0; j < servicesCount; j++) {
				if (vehiclesObj.services[j].serviceType === roServiceName) {
					if (vehiclesObj.services[j].serviceEnabled == true && vehiclesObj.services[j].vehicleCapable == true) {
						logger.info("OPSMON: subscription active");
						serviceResponse.message = "SERVICE_SUBSCRIPTION_ACTIVE"
						serviceResponse.serviceNameForAPI = serviceNameForAPI;
						subscriptionflag = "active"
					} else {
						subscriptionflag = "inactive";
					}
				}
			}
			if (subscriptionflag === "inactive") {
				logger.info(logPrefixFn + "subscription inactive");
				logger.info("OPSMON: subscription inactive");
				serviceResponse.message = "SERVICE_SUBSCRIPTION_INACTIVE";
				serviceResponse.serviceNameForAPI = serviceNameForAPI;
			} else if (subscriptionflag === "notFound") {
				logger.info(logPrefixFn + "SERVICE_NOT_FOUND");
				serviceResponse.message = "SERVICE_NOT_FOUND";
				logger.info("OPSMON: Service not found");
			}
			return serviceResponse;
		}
	}
    /**
     * @description lists user vehicles
     * @param {*} request request body
     * @param {*} token user token fetched from  request body
     * @returns list of user vehicles
     */
	async profileContent(request, token) {
		let logPrefixFn = logPrefixClass + "profileContent | ";
		let iotClient;
		let event = request.event;
		if ((event.resource).includes("alexa")) {
			iotClient = 'ALEXA';
		} else if ((event.resource).includes("google")) {
			iotClient = 'GOOGLEHOME';
		}

		//token validation
		let userTokenValidationResponse = await tokenObj.tokenValidate(token, this.iotConstants, iotClient);
		logger.info(logPrefixFn + "response status code from user token validation" + userTokenValidationResponse.statusCode);
		let serviceResponseMessage;
		if (userTokenValidationResponse.statusCode === 400) {
			logger.info("OPSMON: Token validation failed");
			if (userTokenValidationResponse.response.error_description === "token expired") {
				logger.error(logPrefixFn + "Token has expired , need to relogin ");
				serviceResponseMessage = "USER_TOKEN_EXPIRED";
			} else if (userTokenValidationResponse.response.error_description === "token not found, expired or invalid") {
				logger.error(logPrefixFn + "Token validation error , need to relogin ");
				serviceResponseMessage = "USER_TOKEN_INVALID";
			} else {
				logger.error(logPrefixFn + "unknown error in token validation ,need to relogin ");
				serviceResponseMessage = "USER_TOKEN_UNKNOWN_ERROR";
			}
			return (serviceResponseMessage + "_" + iotClient);
		} else if (userTokenValidationResponse.statusCode === 200) {
			userTokenValidationResponse = JSON.parse(JSON.stringify(userTokenValidationResponse.response.access_token));
			let uid = userTokenValidationResponse.UID.toLowerCase();
			logger.updateLogger({ uid: uid })
			logger.info("OPSMON: Token validation successful");
			let vehicleDetail = await VehicleService.getUserVehicle(uid);
			logger.info(`${logPrefixFn} Response: ${JSON.stringify(vehicleDetail.Responses.USER)}`);
			let vehiclesObj = (vehicleDetail.Responses.USER);
			logger.debug(logPrefixFn + " data fetched from DB using uid " + JSON.stringify(vehiclesObj));
			if (vehiclesObj.length > 0) {
				let vehiclesArray = Object.keys(vehiclesObj[0].vehicles);
				let vehicleCount = Object.keys(vehiclesArray).length;
				let details = "", nickname, make, modelDescription;
				let count = 0;
				for (let i = 0; i < vehicleCount; i++) {
					let key1 = vehiclesArray[i];
					if((process.env.allowTBM.toUpperCase() === "FALSE" && vehiclesObj[0].vehicles[vehiclesArray[i]].isTBM)
						|| !this.iotConstants.ALLOWED_MAKE.includes(vehiclesObj[0].vehicles[vehiclesArray[i]].make.toUpperCase())){
						continue;
					}
					count+=1;
					if (details.length !== 0)
						details = details + " & ";
					if (vehiclesObj[0].vehicles[key1].nickname) {
						nickname = (vehiclesObj[0].vehicles[key1].nickname.name).toLowerCase();
						details = details + nickname;	
					}
					else {
						make = (vehiclesObj[0].vehicles[key1].make).toLowerCase();
						modelDescription = (vehiclesObj[0].vehicles[key1].modelDescription).toLowerCase();
						details = details + make + " " + modelDescription;
					}
				}
				serviceResponseMessage = "";
				if (count === 0) {
					serviceResponseMessage = "USER_DB_NO_VEHICLE_FOUND_" + iotClient;
				}
				else if (count === 1) {
					logger.silly(logPrefixFn + "user has 1 vehicle");
					serviceResponseMessage = serviceResponseMessage + "You have 1 vehicle: ";	
				} else {
					logger.silly(logPrefixFn + "user has multiple vehicles");
					serviceResponseMessage = serviceResponseMessage + "You have " + vehicleCount + " vehicles: ";
				}
				serviceResponseMessage = serviceResponseMessage + details + ". What would you like to do?";
			}
			else {
				serviceResponseMessage = "USER_DB_NO_VEHICLE_FOUND_" + iotClient;
			}

			logger.info(logPrefixFn + "final response of profile intent" + serviceResponseMessage);
			return serviceResponseMessage;

		} else {
			serviceResponseMessage = "USER_TOKEN_UNKNOWN_ERROR" + "_" + iotClient;
			logger.debug("unknown error in token validation , need to relogin ");
			return serviceResponseMessage;
		}
	}
    /**
     * @description performs RO
     * @param {*} request request body
     * @param {*} token  user token fetched from  request body
     * @param {*} vehicleName vehicle name spoken by user
     * @param {*} remoteOperation Remote operation fired by user
     * @param {*} pin Pin entered by user
     * @returns RO status
     */
	async sendRemoteOperation(request, token, vehicleName, remoteOperation, pin) {
		let logPrefixFn = logPrefixClass + "sendRemoteOperation | ";
		logger.info(logPrefixFn + "Remote operation: " + remoteOperation);
		let event = request.event;
		logger.debug(logPrefixFn + "Resource: " + event.resource)
		let iotClient;
		if ((event.resource).includes("alexa")) {
			iotClient = 'ALEXA';
		} else if ((event.resource).includes("google")) {
			iotClient = 'GOOGLEHOME';
		}
		let vehicleDetails = await this.initializeService(token, vehicleName, iotClient, event);
		vehicleDetails.sessionEndFlag = "true";
		vehicleDetails.pinResetFlag = "true";
		if(vehicleDetails.message.includes("TOKEN")){
			vehicleDetails.message = vehicleDetails.message + "_" +  iotClient;
			console.log("Message constant: " + vehicleDetails.message)
			return vehicleDetails;
		}
		if (vehicleDetails.message === "VEHICLE_FOUND") {
			let checkSubscriptionStatus = await this.isSubscriptionActive(vehicleDetails.vehicleObj, remoteOperation)
			logger.debug(logPrefixFn + "checkSubscriptionStatus " + JSON.stringify(checkSubscriptionStatus));
			logger.info("OPSMON: Remote operation: " + checkSubscriptionStatus.serviceNameForAPI);
			let requestObj = vehicleDetails.requestObj;
			logger.info("OPSMON: deviceId: " + requestObj.deviceid);
			if (checkSubscriptionStatus.message === "SERVICE_SUBSCRIPTION_ACTIVE") {
				if(pin === "") {
					vehicleDetails.sessionEndFlag = "false";
					vehicleDetails.message = "USER_PIN_NOT_PRESENT_" + iotClient;
					return vehicleDetails;
				}
				return new Promise((resolve, reject) => {
					let appId = requestObj.appId;
					let deviceId = requestObj.deviceid;
					let uid = requestObj.uid;
					let roRequestBody = {
						"pin": pin,
						"serviceType": checkSubscriptionStatus.serviceNameForAPI
					}
					let encKeyParam = {
						"uid": uid,
						"deviceid": deviceId
					}
					logger.info(logPrefixFn + "encKeyParam" + JSON.stringify(encKeyParam));
					let roRequestBodyStr = JSON.stringify(roRequestBody);
					let encryption = new NGUAAUtils.EncryptionServices();
					encryption.appPayloadEncryption(encKeyParam, roRequestBodyStr, appId).then((encRequestBody) => {
						logger.debug(logPrefixFn + "Payload encryption successful" + JSON.stringify(encRequestBody));
						let nguaaRestApiObj = new NGUAARestAPI();
						let san = vehicleDetails.vehicleObj.san;
						let encryptedBodyJson = {
							"body": encRequestBody
						}
						let path = this.iotConstants.NGUAA_REST_API_PATH_RO;
						nguaaRestApiObj.callNGUAAAPI(uid, san, deviceId, encryptedBodyJson, this.iotConstants, path).then((httpResponse) => {
							logger.debug(logPrefixFn + "RESPONSE FROM API CALL" + JSON.stringify(httpResponse));
							logger.info("OPSMON: Nguaa Rest Api call successful");
							if (httpResponse.httpCode) {
								let encryptedBody = httpResponse.httpData;
								let respCode = httpResponse.httpCode;
								logger.debug(logPrefixFn + "STATUS CODE" + respCode);
								encryption.appPayloadDecryption(encKeyParam, encryptedBody, appId).then((decryptionResponse) => {
									logger.info(logPrefixFn + "RESPONSE FROM PAYLOAD DECRYPTION" + decryptionResponse);
									let decryptedData = JSON.parse(decryptionResponse);
									if (respCode === 200) {
										let ucId = JSON.parse(decryptedData.event).id;
										logger.info("OPSMON: RO event id: " + ucId);
										vehicleDetails.message = "NGUAA_REST_API_RO_SUCCESS_" + iotClient;
										logger.info("OPSMON: RO Response: Initiated");
										resolve(vehicleDetails);
									}
									else if (respCode === 400 && decryptedData.msgDetails.msgCode === "NGUAA_ERR_54") {
										vehicleDetails.pinResetFlag = "false";
										vehicleDetails.sessionEndFlag = "false";
										vehicleDetails.message = "NGUAA_REST_API_INVALID_PIN_" + iotClient;
										logger.info("OPSMON: RO Response: Pin Invalid");
										resolve(vehicleDetails);
									}
									else if (respCode === 400 && decryptedData.msgDetails.msgCode === "NGUAA_ERR_82") {
										vehicleDetails.pinResetFlag = "false";
										vehicleDetails.message = "NGUAA_REST_API_PIN_LOCKOUT_" + iotClient;
										logger.info("OPSMON: RO Response: Pin Locked");
										resolve(vehicleDetails);
									}
									else {
										vehicleDetails.pinResetFlag = "true";
										vehicleDetails.message = "NGUAA_REST_API_UNKNOWN_ERROR_" + iotClient;
										logger.info("OPSMON: Remote operation failed");
										resolve(vehicleDetails);
									}
									//check various response messages + vehicle details
								}).catch((err) => {
									logger.error(logPrefixFn + "PAYLOAD DECRYPTION FAILED" + err.stack);
									vehicleDetails.message = "NGUAA_REST_API_DATA_DEC_FAILED_" + iotClient;
									resolve(vehicleDetails);
								});
							}
						}).catch((err) => {
							logger.error(logPrefixFn + "NGUAA REST API CALL FAILED" + err.stack);
							logger.info("OPSMON: Nguaa Rest Api call failed");
							vehicleDetails.message = "NGUAA_REST_API_RO_CALL_FAILED_" + iotClient;
							resolve(vehicleDetails);
						});
					}).catch((err) => {
						logger.error(logPrefixFn + "PAYLOAD ENCRYPTION FAILED" + err.stack);
						vehicleDetails.message = "NGUAA_REST_API_DATA_ENC_FAILED_" + iotClient;
						resolve(vehicleDetails);
					});
				})
			} else {
				checkSubscriptionStatus.sessionEndFlag = "true";
				checkSubscriptionStatus.message = checkSubscriptionStatus.message + "_" + iotClient
				return (checkSubscriptionStatus);
			}
		} else {
			if (vehicleDetails.message.includes('MULTIPLE') || vehicleDetails.message.includes('DISAMBIGUATION') || vehicleDetails.message.includes('INCORRECT'))
				vehicleDetails.sessionEndFlag = "false";
			else vehicleDetails.sessionEndFlag = "true";
			vehicleDetails.vehicleNotFoundFlag = "true";
			vehicleDetails.message = vehicleDetails.message + "_" + iotClient
			return (vehicleDetails);
		}
	}
	/**
     * @description checks vehicle status like fuel level, tire pressure, etc
     * @param {*} token user login token
     * @param {*} request request body
	 * @param {*} vehicleName vehicle name spoken by user
	 * @param {*} property vehicle info entity name
     * @returns vehicle status
     */
	async getVehicleStatus(token, request, vehicleName, property) {
		let logPrefixFn = logPrefixClass + "getVehicleStatus | ";
		logger.info("OPSMON: Vehicle status property " + property);
		let propertyType;
		let bevAllowedServices = ['electricRange', 'odometer', 'chargeStatus', 'chargeTime'];
		let gasAllowedServices = ['odometer', 'fuelAmountLevel', 'oilLevel', 'tireWarning'];
		let phevAllowedServices = ['electricRange', 'combinedRange', 'chargeStatus', 'odometer', 'fuelAmountLevel', 'oilLevel', 'tireWarning', 'chargeTime']
		let event = request.event;
		let iotClient, data;
		if ((event.resource).includes("alexa")) {
			iotClient = 'ALEXA';
		} else if ((event.resource).includes("google")) {
			iotClient = 'GOOGLEHOME';
		}
		let vehicleDetails = await this.initializeService(token, vehicleName, iotClient, event);
		let statusResponse = {
			"sessionEndFlag" : "false"
		};
		if (vehicleDetails.message.includes("TOKEN"))
			vehicleDetails.sessionEndFlag = "true";
		if (vehicleDetails.message === "VEHICLE_FOUND") {
			statusResponse.sessionEndFlag = "true";
			let fuelType = vehicleDetails.vehicleObj.fuelType.toUpperCase();
			if ((fuelType === "GAS" && gasAllowedServices.includes(property)) || (fuelType === "BEV" && bevAllowedServices.includes(property)) || (fuelType === "PHEV" && phevAllowedServices.includes(property))) {
				let operation;
				if (vehicleDetails.vehicleObj.sdp.toUpperCase() === "SXM" && fuelType === "GAS")
					operation = 'VHSG';
				else operation = 'VHS';
				let checkSubscriptionStatus = await this.isSubscriptionActive(vehicleDetails.vehicleObj, operation)
				logger.debug(logPrefixFn + "checkSubscriptionStatus " + JSON.stringify(checkSubscriptionStatus));
				if (checkSubscriptionStatus.message === "SERVICE_SUBSCRIPTION_ACTIVE") {
					let vin = vehicleDetails.vehicleObj.plainTextVIN;
					try {
						let vehicleInfo = await VehicleService.getVehicleInfoAttributes(vin, "vehInfo");
						if (property === 'chargeStatus' || property === 'chargeTime') {
							propertyType = property;
							property = "battery";
						}
						if (vehicleInfo.Item.data[property]) {
							data = vehicleInfo.Item.data[property];
							logger.info("OPSMON: Vehicle status data fetched from DB");
							if (property === 'fuelAmountLevel') {
								let common = NGUAAUtils.Common;
								statusResponse.message = "VEHICLE_STATUS_FUEL_LEVEL";
								statusResponse.value = common.fuelAmountAdjustment(data);
							}
							if (property === 'oilLevel') {
								statusResponse.message = "VEHICLE_STATUS_OIL_LIFE";
								statusResponse.value = data;
							}
							if (property === 'odometer') {
								statusResponse.message = "VEHICLE_STATUS_MILEAGE";
								statusResponse.value = Math.floor(data);
							}
							if (property === 'electricRange') {
								statusResponse.message = "VEHICLE_STATUS_ELECTRIC_RANGE";
								statusResponse.value = Math.round(data);
							}
							if (property === 'combinedRange') {
								statusResponse.message = "VEHICLE_STATUS_COMBINED_RANGE";
								statusResponse.value = Math.round(data);
							}
							if (property === 'tireWarning') {
								let tireValues = { "RL": "Rear Left", "RR": "Rear Right", "FL": "Front Left", "FR": "Front Right" };
								let i, lowPressureTires = "";
								let keys = Object.keys(data);
								logger.info(logPrefixFn + "Tire Status Keys: " + keys);
								for (i = 0; i < keys.length; i++) {
									if ((data[keys[i]]).toUpperCase() === "TRUE") {
										if (lowPressureTires === "")
											lowPressureTires = lowPressureTires + tireValues[keys[i]];
										else
											lowPressureTires = lowPressureTires + " & " + tireValues[keys[i]];
									}
								}
								if (lowPressureTires !== "") {
									statusResponse.message = "VEHICLE_STATUS_TIRE_PRESSURE_LOW";
									statusResponse.value = lowPressureTires;
								}
								else {
									statusResponse.message = "VEHICLE_STATUS_TIRE_PRESSURE_NORMAL";
									statusResponse.value = "";
								}
							}
							if (property === 'battery') {
								if (propertyType === 'chargeStatus') {
									if (data.stateOfCharge) {
										statusResponse.value = "";
										if (data.stateOfCharge === "100")
											statusResponse.message = "VEHICLE_STATUS_CHARGE_STATUS_COMPLETE";
										else if (data.plugInStatus === "OFF")
											statusResponse.message = "VEHICLE_STATUS_CHARGE_STATUS_UNPLUGGED";
										else if (data.plugInStatus === "ON")
											statusResponse.message = "VEHICLE_STATUS_CHARGE_STATUS_PLUGGED";
										else
											statusResponse.message = "VEHICLE_STATUS_CHARGE_STATUS_INTERRUPTED";
									}
									else {
										statusResponse.message = "VEHICLE_DATA_NOT_AVAILABLE";
										statusResponse.value = propertyType;
									}
								}
								else {
									statusResponse.message = "VEHICLE_STATUS_CHARGE_TIME";
									if (data.chargingLevel) {
										logger.info(logPrefixFn + "Charging Level: "+ data.chargingLevel);
										let time;
										if (data.chargingLevel === "240V" || data.chargingLevel === "CHARGE-240V" || data.chargingLevel === "L2") {
											time = data.timeToFullyChargeL2;
										}
										else {
											time = data.timeToFullyChargeL1;
										}
										if (time < 60) {
											statusResponse.value = time + " minutes";
										}
										else {
											let hour = Math.floor(time / 60);
											if (time % 60 === 0) {
												if ((time / 60) < 2)
													statusResponse.value = hour + " hour";
												else
													statusResponse.value = hour + " hours";
											}
											else {
												if ((time / 60) < 2)
													statusResponse.value = hour + " hour " + (time % 60) + " minutes";
												else
													statusResponse.value = hour + " hours " + (time % 60) + " minutes";
											}
										}
									}
									else {
										statusResponse.message = "VEHICLE_DATA_NOT_AVAILABLE";
										statusResponse.value = propertyType;
										logger.info("OPSMON: Vehicle status data unavailable");
									}
								}
							}
						}
						else {
							statusResponse.message = "VEHICLE_DATA_NOT_AVAILABLE";
							logger.info("OPSMON: Vehicle status data unavailable");
							statusResponse.value = property;
						}
					}
					catch (err) {
						statusResponse.message = "VEHICLE_DATA_NOT_AVAILABLE";
						statusResponse.value = property;
					}
				}
				else {
					statusResponse.message = checkSubscriptionStatus.message + "_" + iotClient;
				}
			}
			else {
				statusResponse.message = "SERVICE_NOT_FOUND" + "_" + iotClient;
			}
		}
		else {
			if (vehicleDetails.message.includes('MULTIPLE') || vehicleDetails.message.includes('DISAMBIGUATION')  || vehicleDetails.message.includes('INCORRECT'))
				statusResponse.sessionEndFlag = "false";
			else statusResponse.sessionEndFlag="true";
			statusResponse.vehicles = vehicleDetails.vehicles;
			statusResponse.message = vehicleDetails.message + "_" + iotClient;
		}
		return (statusResponse);
	}

	/**
     * @description finds Point of Interest
     * @param {*} location user's device location
     * @param {*} poi name of place of search
	 * @param {*} type poi or address
	 * @param {*} vehicleDetails user vehicle details to which address is to be sent
     * @returns place(s) details
     */
	async findPOI(location, poi, type, vehicleDetails) {
		let logPrefixFn = logPrefixClass + "findPOI | ";
		let statusResponse = {
			"status" : "FAIL"
		};
		logger.info(logPrefixFn + "Location: " + JSON.stringify(location));
		logger.info(logPrefixFn + "Vehicle Details: " + JSON.stringify(vehicleDetails))
			let lat, long;
			if (location.iotClient === "GOOGLEHOME") {
				lat = location.deviceLocation.latitude;
				long = location.deviceLocation.longitude;
			}
			else if (location.iotClient === "ALEXA") {
				let address = location.deviceLocation.addressLine1 + " " + location.deviceLocation.postalCode;
				let geoCodeApiPath = "/maps/api/geocode/json?address=" + encodeURIComponent(address) + "&key=";
				let geoCodeRes = await this.callGoogleAPI(geoCodeApiPath);
				lat = geoCodeRes.results[0].geometry.location.lat;
				long = geoCodeRes.results[0].geometry.location.lng;
			}
			let placeSearchApiPath;
			if (type === "POI") {
				placeSearchApiPath = "/maps/api/place/nearbysearch/json?location=" + lat + "," + long + "&keyword=" + encodeURIComponent(poi) + "&rankby=distance&key=";
			}
			else {
				placeSearchApiPath = "/maps/api/place/textsearch/json?location=" + lat + "," + long + "&radius=50000&query=" + encodeURIComponent(poi) + "&key=";
			}
			logger.info(logPrefixFn+"POI Search path: " + placeSearchApiPath);
			let searchRes = await this.callGoogleAPI(placeSearchApiPath);
			let poiLat = [], poiLong = [], poiName = [], rating = [], distanceApiPath;
			if (searchRes.status === "OK") {
				if (type === "POI") {
					for (let i = 0; i < 3; i++) {
						poiLat[i] = searchRes.results[i].geometry.location.lat;
						poiLong[i] = searchRes.results[i].geometry.location.lng;
						rating[i] = searchRes.results[i].rating;
						poiName[i] = searchRes.results[i].name;
					}
					distanceApiPath = "/maps/api/distancematrix/json?units=imperial&origins=" + lat + "," + long + "&destinations=" + poiLat[0] + "," + poiLong[0] + "|" + poiLat[1] + "," + poiLong[1] + "|" + poiLat[2] + "," + poiLong[2] + "&mode=driving&key="
				}
				else {
					poiLat[0] = searchRes.results[0].geometry.location.lat;
					poiLong[0] = searchRes.results[0].geometry.location.lng;
					poiName[0] = searchRes.results[0].name;
					distanceApiPath = "/maps/api/distancematrix/json?units=imperial&departure_time=now&origins=" + lat + "," + long + "&destinations=" + poiLat[0] + "," + poiLong[0] + "&mode=driving&key="
				}
			}
			else {
				logger.info("OPSMON: SDV: Place not found");
				statusResponse.message = "POI_PLACE_NOT_FOUND" + "_" + location.iotClient;
				logger.info(logPrefixFn + "Error: " + statusResponse.message)
				return statusResponse;
			}
			logger.info("OPSMON: SDV: Place found");
			let distanceResponse = await this.callGoogleAPI(distanceApiPath);
			if (distanceResponse.status === "OK" && distanceResponse.rows[0].elements[0].status === "OK") {
				logger.info("OPSMON: SDV: Place is reachable");
				logger.info("Distance Matrix Api Response: " + JSON.stringify(distanceResponse));
				let result = distanceResponse.rows[0].elements;
				let address = distanceResponse.destination_addresses;
				statusResponse.sdvObj = {};
				if (type === "POI") {
					statusResponse.message = "POI_SEARCH_RESPONSE_" + location.iotClient;
					statusResponse.rating = rating;
					statusResponse.destName = poiName;
					statusResponse.sdvObj.category = pluralize(poi);
					statusResponse.distance = [result[0].distance.text, result[1].distance.text, result[2].distance.text];
					statusResponse.sdvObj.address = [address[0], address[1], address[2]];
				} else {
					statusResponse.message = "ADDRESS_SEARCH_RESPONSE_" + location.iotClient;
					statusResponse.distance = result[0].distance.text;
					statusResponse.time = result[0].duration_in_traffic.text;
					statusResponse.sdvObj.address = [address[0]];
					statusResponse.sdvObj.category = "Address"
				}
				statusResponse.sdvObj.vehicleName = vehicleDetails.vehicleName;
				statusResponse.sdvObj.name = poiName;
				statusResponse.sdvObj.poiLat = poiLat;
				statusResponse.sdvObj.poiLong = poiLong;
				statusResponse.sdvObj.uid = vehicleDetails.requestObj.uid;
				statusResponse.sdvObj.san = vehicleDetails.vehicleObj.san;
				statusResponse.sdvObj.deviceId = vehicleDetails.requestObj.deviceid;
				statusResponse.sdvObj.iotClient = location.iotClient;
				statusResponse.status = "SUCCESS";
				logger.info(logPrefixFn + "POI Object: " + JSON.stringify(statusResponse));
			}
			else {
				logger.info("OPSMON: SDV: Place is not reachable")
				statusResponse.message = "POI_PLACE_NOT_FOUND" + "_" + location.iotClient;
				logger.info(logPrefixFn + "Error: " + statusResponse.message)
				return statusResponse;
			}
		return (statusResponse);
	}

	/**
     * @description sends destination to car
     * @param {*} sdvObj contains vehicle and location details
     * @returns sdv status
     */
	async sendDestinationToVehicle(sdvObj) {
		let logPrefixFn = logPrefixClass + "sendDestinationToVehicle | ";
		let requestBody = {};
		let addressObject = {
			"addressLine2":"",
			"street":""
		};
		let address = sdvObj.address.split(', ');
		let len = address.length;
		let countryCode = {
			"USA":"US",
			"Canada":"CA",
			"India":"IN"
		}
		addressObject.country = countryCode[address[len-1]];
		addressObject.state = address[len-2].split(" ")[0];
		addressObject.postalCode = address[len-2].split(" ")[1];
		if(addressObject.country === "CA"){
			logger.info(logPrefixFn + address[len-2].split(" ")[2])
			addressObject.postalCode += " " + address[len-2].split(" ")[2];
		}
		addressObject.city = address[len-3];
		addressObject.street = address[0]
		logger.info("OPSMON: SDV: Place details fetched");
		let body = {
			"poi": [
				{
					"name": sdvObj.name,
					"category": sdvObj.category,
					"ts": new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
					"address": addressObject,
					"location": {}
				}
			]
		}
		body.poi[0].location.longitude = sdvObj.poiLong.toString();
		body.poi[0].location.lat = sdvObj.poiLat.toString();
		requestBody.body = JSON.stringify(body);
		logger.info(logPrefixFn + "SDV Request Body: " + requestBody.body);
		return new Promise((resolve, reject) => {
			let nguaaRestApiObj = new NGUAARestAPI();
			let path = this.iotConstants.NGUAA_REST_API_PATH_SDV;
			nguaaRestApiObj.callNGUAAAPI(sdvObj.uid, sdvObj.san, sdvObj.deviceId, requestBody, this.iotConstants, path).then((httpResponse) => {
				if (httpResponse.httpCode === 200) {
					logger.info("OPSMON: SDV: Success");
					logger.info(logPrefixFn + "httpResponse: " + JSON.stringify(httpResponse));
					let ucId = JSON.parse(httpResponse.httpData.event).id;
					logger.info("OPSMON: RO event id: " + ucId);
					resolve("NGUAA_REST_API_SDV_SUCCESS_" + sdvObj.iotClient);
				}
				else {
					logger.info("OPSMON: SDV: failed");
					resolve("NGUAA_REST_API_UNKNOWN_ERROR_" + sdvObj.iotClient);
				}
			}).catch((err) => {
				logger.error(logPrefixFn + "NGUAA REST API CALL FAILED " + err.stack);
				resolve("NGUAA_REST_API_RO_CALL_FAILED_" + sdvObj.iotClient);
			});
		})
	}
	
	/**
     * @description performs token validation, vehicle mapping and device registration
     * @param {*} token user login token
	 * @param {*} vehicleName user input vehicle name
	 * @param {*} iotClient Alexa or Google
	 * @param {*} event request body
     * @returns sdv status
     */
	async initializeService(token, vehicleName, iotClient, event) {
		let logPrefixFn = logPrefixClass + "initializeService | ";
		let statusResponse = {};
		let userTokenValidationResponse = await tokenObj.tokenValidate(token, this.iotConstants, iotClient);
		if (userTokenValidationResponse.statusCode === 400) {
			logger.info("OPSMON: Token validation failed");
			if (userTokenValidationResponse.response.error_description === "token expired") {
				statusResponse.message = "USER_TOKEN_EXPIRED";
			} else if (userTokenValidationResponse.response.error_description === "token not found, expired or invalid") {
				statusResponse.message = "USER_TOKEN_INVALID";
			} else {
				statusResponse.message = "USER_TOKEN_UNKNOWN_ERROR";
			}
			statusResponse.message = statusResponse.message;
			return (statusResponse);
		}
		else if (userTokenValidationResponse.statusCode === 200) {
			let userData = userTokenValidationResponse.response.access_token;
			logger.silly(logPrefixFn + "userData=> " + JSON.stringify(userData));
			let uid = userData.UID.toLowerCase();
			logger.updateLogger({ uid: uid })
			logger.info("OPSMON: Token validation successful");
			let vehicleDetail = await VehicleService.getUserVehicle(uid);
			let vehiclesObj = vehicleDetail.Responses.USER;
			logger.debug(logPrefixFn + " data fetched from DB using uid " + JSON.stringify(vehiclesObj));
			let vehicleDetails = await this.manageUserVehiclesMapping(vehiclesObj, vehicleName);
			if (vehicleDetails.message === "VEHICLE_FOUND"){
				vehicleDetails.vehicleName = vehicleDetails.vehicleObj.year + " " + vehicleDetails.vehicleObj.make  + " " + vehicleDetails.vehicleObj.modelDescription;
				vehicleDetails.vehicleName = vehicleDetails.vehicleName.toLowerCase().split(' ')
											.map((s) => s.charAt(0).toUpperCase() + s.substring(1))
											.join(' ');
				logger.info("OPSMON: Vehicle found");
			}
			let eventBody = event.body, deviceId, hashedDeviceId;
			if (iotClient === "ALEXA") {
				deviceId = eventBody.session.user.userId.trim().toUpperCase();
				hashedDeviceId = "amz-" + NGUAAUtils.Common.getHashKey(deviceId, "sha256");
			} else if (iotClient === "GOOGLEHOME") {
				deviceId = uid; // to use as iot account id
				hashedDeviceId = "gh-" + NGUAAUtils.Common.getHashKey(uid, "sha256");  //doing hash of uid
			}
			logger.silly(logPrefixFn + "deviceId " + hashedDeviceId);
			let requestObj = {
				"uid": uid,
				"deviceid": hashedDeviceId,
				"appId": "IOT_H2V_" + iotClient,
				"iot_account_id": deviceId
			};
			let userIotDeviceObj = new userDeviceAccountRegistration();
			let userDeviceAccountRegistrationDetails = await userIotDeviceObj.iotDeviceRegistration(requestObj);
			logger.info(logPrefixFn + "User Device Registration success");
			logger.debug(logPrefixFn + " userDeviceAccountRegistrationDetails " + JSON.stringify(userDeviceAccountRegistrationDetails));
			vehicleDetails.requestObj = requestObj;
			logger.info(logPrefixFn + "Vehicle request", JSON.stringify(vehicleDetails.requestObj) + "END");
			return (vehicleDetails);
		}
		else {
			statusResponse.message = "USER_TOKEN_UNKNOWN_ERROR";
			return (statusResponse);
		}
	}
	
	/**
     * @description calls Google API
     * @param {*} path Google API path
     * @returns http call result
     */
	async callGoogleAPI(path) {
		let logPrefix = logPrefixClass + "callGoogleAPI | ";
		let options = {
			host: "maps.googleapis.com",
			path: path + this.iotConstants.GOOGLE_MAP_API_KEY,
			method: 'GET',
			timeout: 10000,
			headers: {}
		}
		let HttpServiceClient = new NGUAAUtils.HttpServiceClient();
		return new Promise((resolve, reject) => {
			logger.streamLog(`${logPrefix} HTTP_Start`);
			HttpServiceClient.callRestAPI(options, {})
                .then((httpResponse) => {
                    logger.silly(logPrefix + "  the response data is " + JSON.stringify(httpResponse));
                    resolve(httpResponse.httpData);
                }).catch(function (err) {
                    logger.error(logPrefix + "getCallStatus - Catch" + err.stack);
                    resolve("NGUAA_REST_API_RO_CALL_FAILED");
                });
		})
	}
}
exports.IotServices = IotServices;
