const https = require('https');
const logger = require("nguaa-logger");
const logPrefixClass = "UserTokenValidator | ";
class UserTokenValidator {
    /**
     * @description validates user token
     * @param {*} token user token fetched from  request body
     * @param {*} iotConstants response from CONFIG table (key=IOT_PROPERTIES,category=IOT)containing constants
     * @returns Status code and details of user associated with access token
     */
    async tokenValidate(token, iotConstants, iotClient) {
        let logPrefixFn = logPrefixClass + "tokenValidate | ";
        const options = {
            hostname: iotConstants.AUTHORIZATION_SERVER_HOST_NAME,
            path: iotConstants.AUTHORIZATION_SERVER_PATH_VALIDATION + "&client_id=" + iotConstants["AUTHORIZATION_SERVER_CLIENT_ID_"+iotClient] + "&client_secret=" + iotConstants["AUTHORIZATION_SERVER_CLIENT_SECRET_"+iotClient] + "&token=" + token,
            method: 'POST'
        }
        logger.silly(logPrefixFn + "Token validate request: " + JSON.stringify(options));
        // logger.info("OPSMON: Access Token: "+ token);
        return new Promise(function (resolve, reject) {
            const req = https.request(options, (res) => {
                logger.info(logPrefixFn + `statusCode: ${res.statusCode}`);
                res.on('data', (data) => {
                    logger.info(logPrefixFn + "Data: "+ data);
                    let httpResponse = JSON.parse(data);
                    var finalResponse = {
                        "statusCode": res.statusCode,
                        "response": httpResponse
                    }
                    logger.debug(logPrefixFn + "Token Validator Response : " + JSON.stringify(finalResponse));
                    resolve(finalResponse);
                });
            });
            req.on('error', (error) => {
                logger.error(logPrefixFn + "error in token validation request" + error.stack)
            });
            req.end()
        });
    }
}
exports.UserTokenValidator = UserTokenValidator;
