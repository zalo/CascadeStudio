import { BladeApi, BladeController, Controller, LabeledValueBladeController, PlainView, SliderController, ViewProps } from '@tweakpane/core';
export declare function createTestWindow(): Window;
declare class LabelableController implements Controller {
    readonly viewProps: ViewProps;
    readonly view: PlainView;
    constructor(doc: Document);
}
export declare function createEmptyLabelableController(doc: Document): LabelableController;
export declare function createLabeledValueBladeController(doc: Document): LabeledValueBladeController<unknown, SliderController, import("@tweakpane/core").Value<number>>;
export declare function createEmptyBladeController(doc: Document): BladeController<PlainView>;
export declare function assertInitialState(api: BladeApi): void;
export declare function assertDisposes(api: BladeApi): void;
export declare function assertUpdates(api: BladeApi): void;
export {};
