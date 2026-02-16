import { Blade, BladeController, ViewProps } from '@tweakpane/core';
import { SeparatorView } from '../view/separator.js';
/**
 * @hidden
 */
interface Config {
    blade: Blade;
    viewProps: ViewProps;
}
/**
 * @hidden
 */
export declare class SeparatorController extends BladeController<SeparatorView> {
    /**
     * @hidden
     */
    constructor(doc: Document, config: Config);
}
export {};
