import { BladeApi, BladeController, Controller, LabelController, PlainView, View, ViewProps } from '@tweakpane/core';
export declare function createTestWindow(): Window;
declare class LabelableController implements Controller<View> {
    readonly viewProps: ViewProps;
    readonly view: PlainView;
    constructor(doc: Document);
}
export declare function createEmptyLabelableController(doc: Document): LabelableController;
export declare function createLabelController(doc: Document, vc: LabelableController): LabelController<LabelableController>;
export declare function createEmptyBladeController(doc: Document): BladeController<PlainView>;
export declare function assertInitialState(api: BladeApi<BladeController<View>>): void;
export declare function assertDisposes(api: BladeApi<BladeController<View>>): void;
export declare function assertUpdates(api: BladeApi<BladeController<View>>): void;
export {};
