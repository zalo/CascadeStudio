import { FolderApi, PluginPool } from '@tweakpane/core';
import { RootController } from '../controller/root';
import { PresetObject } from './preset';
export declare class RootApi extends FolderApi {
    /**
     * @hidden
     */
    constructor(controller: RootController, pool: PluginPool);
    get element(): HTMLElement;
    /**
     * Imports a preset of all inputs.
     * @param preset The preset object to import.
     */
    importPreset(preset: PresetObject): void;
    /**
     * Exports a preset of all inputs.
     * @return An exported preset object.
     */
    exportPreset(): PresetObject;
    /**
     * Refreshes all bindings of the pane.
     */
    refresh(): void;
}
