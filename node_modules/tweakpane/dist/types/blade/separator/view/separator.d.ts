import { View, ViewProps } from '@tweakpane/core';
/**
 * @hidden
 */
interface Config {
    viewProps: ViewProps;
}
/**
 * @hidden
 */
export declare class SeparatorView implements View {
    readonly element: HTMLElement;
    constructor(doc: Document, config: Config);
}
export {};
