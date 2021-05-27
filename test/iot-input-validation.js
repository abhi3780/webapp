const verifier = require('alexa-verifier')
const NGUAAUtils = require('nguaa-utils')
const logger = require('nguaa-logger');
const schemaGoogle = require('../schema/schema-google.json');
const schemaAlexa = require('../schema/schema-alexa.json');
const logPrefixClass = 'IotInputValidation | ';
class IotInputValidation {

    /**
     * @description performs schema validation
     * @param {*} event request body
     * @returns success or failure status of validation
     */
    async inputValidator(event) {
        let logPrefix = logPrefixClass + 'inputValidator | ';
        var schema;
        if ((event.resource).includes("alexa")) {
            logger.updateLogger({ iotP: "ALEXA" })
            logger.debug(logPrefix + "request from alexa");
            schema = schemaAlexa;
            try {
                let validatorResult = await this.eventValidate(event, schema);
                let alexaVerifierResponse = await this.alexaSignatureVerifier(event);
                logger.debug(logPrefix + "Signature Verification: " + alexaVerifierResponse);//return response
                return validatorResult;
            }
            catch(e){
                logger.error(logPrefix + "Signature error: " + e);
                throw e;
            }
        }
        else if ((event.resource).includes("google")) {
            logger.updateLogger({ iotP: "GOOGLEHOME" })
            logger.debug(logPrefix + "request from google");
            schema = schemaGoogle;
            try {
                let validatorResult = await this.eventValidate(event, schema);
                return validatorResult;
            }
            catch(e) {
                logger.error(logPrefix + "Validation Failed" + e);
                throw e;
            }
        }
        else {
            logger.error(logPrefix + "Request from unknown source");
            throw "Request invalid:Request from unknown source";
        }
    }

    /**
     * @description performs schema validation
     * @param {*} event request body
     * @param {*} schema expected schema of requested body
     * @returns success or failure status of validation
     */
    async eventValidate(event, schema) {
        let logPrefixFn = logPrefixClass + "eventValidate | ";
        var transformedEvent = event;
        transformedEvent.body = JSON.parse(transformedEvent.body);
        let Validator = new NGUAAUtils.Validator();
        let validateResult = Validator.jsonValidator(transformedEvent, schema);
        logger.debug(logPrefixFn + "Validator Result" + JSON.stringify(validateResult));
        if (!validateResult.valid) {
            logger.info("OPSMON: Schema validation failed");
            logger.error(logPrefixFn + "validation error: invalid schema");
            throw (validateResult.message);
        }
        else {
            logger.info(logPrefixFn + "Schema validation successful");
            logger.info("OPSMON: Schema validation successful");
            return validateResult;
        }
    }

    /**
     * @description performs alexa signature verification
     * @param {*} event request body
     * @returns success or failure status
     */
    async alexaSignatureVerifier(event) {
        let logPrefixFn = logPrefixClass + "alexaSignatureVerifierMiddleware | ";
        var certUrl, signature, body;
        certUrl = event.headers.SignatureCertChainUrl;
        logger.debug(logPrefixFn + "signature certificate chain url" + certUrl);
        signature = event.headers.Signature
        logger.debug(logPrefixFn + "signature " + signature);
        body = JSON.stringify(event.body);
        try {
            let alexaVerifierResponse = await verifier(certUrl, signature, body);
            logger.info("Alexa verifier response: " + alexaVerifierResponse)
            return (logPrefixFn + "Successful Alexa request verification");
        }
        catch(e) {
            logger.error(logPrefixFn + "Error in Alexa Signature Verification : " + e);
            throw e;
        }
    }
}
exports.IotInputValidation = IotInputValidation;
