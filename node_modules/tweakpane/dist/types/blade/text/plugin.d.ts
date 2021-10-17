import { BaseBladeParams, BladePlugin, Formatter, Parser } from '@tweakpane/core';
export interface TextBladeParams<T> extends BaseBladeParams {
    parse: Parser<T>;
    value: T;
    view: 'text';
    format?: Formatter<T>;
    label?: string;
}
export declare const TextBladePlugin: BladePlugin<TextBladeParams<unknown>>;
