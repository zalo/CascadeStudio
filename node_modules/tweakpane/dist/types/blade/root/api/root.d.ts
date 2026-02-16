import { FolderApi, PluginPool } from '@tweakpane/core';
import { RootController } from '../controller/root.js';
export declare class RootApi extends FolderApi {
    /**
     * @hidden
     */
    constructor(controller: RootController, pool: PluginPool);
    get element(): HTMLElement;
}
