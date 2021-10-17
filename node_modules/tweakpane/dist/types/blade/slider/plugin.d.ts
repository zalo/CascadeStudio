import { BaseBladeParams, BladePlugin, Formatter } from '@tweakpane/core';
export interface SliderBladeParams extends BaseBladeParams {
    max: number;
    min: number;
    view: 'slider';
    format?: Formatter<number>;
    label?: string;
    value?: number;
}
export declare const SliderBladePlugin: BladePlugin<SliderBladeParams>;
