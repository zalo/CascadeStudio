import { BindingTarget } from '@tweakpane/core';
export interface PresetObject {
    [key: string]: unknown;
}
/**
 * @hidden
 */
export declare function exportPresetJson(targets: BindingTarget[]): PresetObject;
/**
 * @hidden
 */
export declare function importPresetJson(targets: BindingTarget[], preset: PresetObject): void;
