import { ApiChangeEvents, BladeApi, EventListenable, Formatter, LabeledValueBladeController, TextController } from '@tweakpane/core';
export declare class TextBladeApi<T> extends BladeApi<LabeledValueBladeController<T, TextController<T>>> implements EventListenable<ApiChangeEvents<T>> {
    private readonly emitter_;
    /**
     * @hidden
     */
    constructor(controller: LabeledValueBladeController<T, TextController<T>>);
    get label(): string | null | undefined;
    set label(label: string | null | undefined);
    get formatter(): Formatter<T>;
    set formatter(formatter: Formatter<T>);
    get value(): T;
    set value(value: T);
    on<EventName extends keyof ApiChangeEvents<T>>(eventName: EventName, handler: (ev: ApiChangeEvents<T>[EventName]) => void): this;
    off<EventName extends keyof ApiChangeEvents<T>>(eventName: EventName, handler: (ev: ApiChangeEvents<T>[EventName]) => void): this;
}
