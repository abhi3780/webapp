import { BaseApp } from './BaseApp';
import { Extensible } from './Extensible';
export declare class BaseCmsPlugin extends Extensible {
    /**
     * Implemented install method
     * @param {BaseApp} app
     */
    install(app: BaseApp): void;
    /**
     * Copies cms data from the app object to the jovo object.
     * @param {HandleRequest} handleRequest
     * @returns {Promise<void>}
     */
    private copyCmsDataToContext;
}
