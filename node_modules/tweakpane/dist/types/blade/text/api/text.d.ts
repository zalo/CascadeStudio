import { ApiChangeEvents, BladeApi, Formatter, LabelController, TextController } from '@tweakpane/core';
export declare class TextApi<T> extends BladeApi<LabelController<TextController<T>>> {
    private readonly emitter_;
    constructor(controller: LabelController<TextController<T>>);
    get label(): string | undefined;
    set label(label: string | undefined);
    get formatter(): Formatter<T>;
    set formatter(formatter: Formatter<T>);
    get value(): T;
    set value(value: T);
    on<EventName extends keyof ApiChangeEvents<T>>(eventName: EventName, handler: (ev: ApiChangeEvents<T>[EventName]['event']) => void): this;
}
