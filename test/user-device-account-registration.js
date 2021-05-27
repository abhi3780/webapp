const crypto = require('crypto');
const logger = require("nguaa-logger");
const NGUAAUtils = require("nguaa-utils");
const EncryptionDaoService = require("./dao/user-device-dao");
const DeviceDetailsDaoService = require('../node_modules/nguaa-utils/encryption/dao/encryption-dao-service');
const EncyrptionKeyOperationService = require('../node_modules/nguaa-utils/encryption/encryption-services');
const logPrefixClass = "userDeviceAccountRegistration | ";
class userDeviceAccountRegistration {
	/**
	 * @description registers device details used to make request
	 * @param {*} requestObj json object containing uid,deviceId,appId
	 * @returns encryption key details
	 */
	async iotDeviceRegistration(requestObj) {
		let logPrefixFn = logPrefixClass + " iotDeviceRegistration | ";
		let deviceId = requestObj.deviceid.toLowerCase();
		let appId = requestObj.appId.toUpperCase();
		let encyrptionKeyOperationObj = new EncyrptionKeyOperationService();
		return new Promise((resolve, reject) => {
			let deviceDetailsDaoObj = new DeviceDetailsDaoService();
			resolve(deviceDetailsDaoObj.getUidDetailsForDeviceId(deviceId, appId));
		}).then((response) => {
			let uid = requestObj.uid.toLowerCase();
			let appId = requestObj.appId;
			let iot_account_id = requestObj.iot_account_id;
			let currentTime = new Date().getTime();
			logger.info(logPrefixFn + "Request uid :" + uid + "deviceId:" + deviceId + " appId: " + appId + " iot_account_id :" + iot_account_id + "currentTime:" + currentTime);
			let dbDeviceDetails = response;
			let userDeviceKeyDetails = dbDeviceDetails[uid] || {};
			logger.silly(`${logPrefixFn} userDeviceKeyDetails : ${JSON.stringify(userDeviceKeyDetails)}`);
			let encKeyDetails = {}, keysToBeGenerated = [];
			//Keys present in db, so validate it
			if (userDeviceKeyDetails && Object.keys(userDeviceKeyDetails).length > 0 && userDeviceKeyDetails.api_keys &&
				Object.keys(userDeviceKeyDetails.api_keys).length > 0 && userDeviceKeyDetails.uid && userDeviceKeyDetails.deviceId) {
				let key = "api_keys"
				let encData = userDeviceKeyDetails[key];
				logger.silly("encData", JSON.stringify(encData));
				encKeyDetails[key] = encKeyDetails[key] || {};
				encKeyDetails[key]["current"] = encyrptionKeyOperationObj.getRequiredEncKeyDetails(encData);
			} else {
				logger.info(`/**************** GENERATING USER DEVICE ENCRYPTION KEY DETAILS *******************/`);
				let keyType = "api_keys", kmsKey = "";
				let Properties = NGUAAUtils.Properties;
				let newEncryptionKey = new Buffer(crypto.randomBytes(32)).toString('base64').substring(0, 32);
				let KMS_ARN_ID = Properties.NGUAA_AUTH_API_ENCRYPTION_KEY_KMS_ARN;
				let expiresOn = new Date().getTime() + 3153600000000;
				let keyDetails = {
					"encryption_algo": Properties.NGUAA_DATA_IN_MOTION_AND_REST_ENC_ALGO,
					"expiry_time": expiresOn,
					"encryption_iv": "000" + new Date().getTime().toString(),
					"key_type": keyType,
					"valid": true
				};
				logger.silly(`${logPrefixFn} keyDetails : ${JSON.stringify(keyDetails)}`);
				return new Promise((resolve, reject) => {
					logger.info(` /**************** GENERATING KMS ENCRYPTION KEY START *******************/`);
					resolve(encyrptionKeyOperationObj.putKMSKey(Properties.KMS_REGION, KMS_ARN_ID, newEncryptionKey));
				})
					.then((kmsResp) => {
						logger.silly(`${logPrefixFn} kmsResp : ${JSON.stringify(kmsResp)}`);
						logger.info(` /**************** GENERATING KMS ENCRYPTION KEY END *******************/`);
						kmsKey = kmsResp;
						keyDetails.encryption_key = kmsKey;
						let keyDetailsToUpdate = {
							"encryption_algo": keyDetails.encryption_algo,
							"expiry_time": keyDetails.expiry_time,
							"encryption_iv": keyDetails.encryption_iv,
							"valid": keyDetails.valid,
							"encryption_key": keyDetails.encryption_key
						};
						logger.silly(`${logPrefixFn} keyDetailsToUpdate : ${JSON.stringify(keyDetailsToUpdate)}`);
						let encryptionUserDaoService = new EncryptionDaoService();
						return new Promise((resolve, reject) => {
							logger.info(` /**************** GENERATING KMS ENCRYPTION KEY START *******************/`);
							resolve(encryptionUserDaoService.updateUserDeviceKeyDetails(uid, deviceId, iot_account_id, keyType, keyDetailsToUpdate, appId));
						})
						.then((dbStatus) => {
							logger.debug(`${logPrefixFn} dbStatus : ${JSON.stringify(dbStatus)}`);
							logger.info(` /**************** UPDATE USER DEVICE ENCRYPTION KEY DETAILS END *******************/`);
							keyDetails.encryption_key = newEncryptionKey;
							logger.silly(logPrefixFn + " new keyDetails is : " + JSON.stringify(keyDetails));
							keysToBeGenerated = keyDetails;
						})
					})
					.catch((err) => {
						logger.error(`${logPrefixFn} Error : ${JSON.stringify(err.stack)}`);
						throw err;
					});
			}
			return Promise.all(keysToBeGenerated)
				.then((response) => {
					logger.silly("promise all response", JSON.stringify(response));
					response.forEach((generatedEncData) => {
						let key_type = generatedEncData.key_type;
						encKeyDetails[key_type] = encKeyDetails[key_type] || {};
						encKeyDetails[key_type] = encyrptionKeyOperationObj.getRequiredEncKeyDetails(generatedEncData);
						logger.silly("encKeyDetails response", JSON.stringify(encKeyDetails));
					});
					return encKeyDetails;
				})
				.then((encKeyDetailsResponse) => {
					let finalData = {
						"api_keys": {}
					};
					finalData.api_keys = encKeyDetailsResponse.api_keys;
					return finalData;
				})
				.catch((err) => {
					logger.error(`${logPrefixFn} Error : ${JSON.stringify(err.stack)}`);
					throw err;
				});
		})
			.catch((err) => {
				logger.error(`${logPrefixFn} Error : ${JSON.stringify(err.stack)}`);
				throw err;
			});
	}
}
// generate keys and call device dao
exports.userDeviceAccountRegistration = userDeviceAccountRegistration;
