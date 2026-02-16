import { ApiChangeEvents, BladeApi, EventListenable, LabeledValueBladeController, ListController, ListItem } from '@tweakpane/core';
export declare class ListBladeApi<T> extends BladeApi<LabeledValueBladeController<T, ListController<T>>> implements EventListenable<ApiChangeEvents<T>> {
    private readonly emitter_;
    /**
     * @hidden
     */
    constructor(controller: LabeledValueBladeController<T, ListController<T>>);
    get label(): string | null | undefined;
    set label(label: string | null | undefined);
    get options(): ListItem<T>[];
    set options(options: ListItem<T>[]);
    get value(): T;
    set value(value: T);
    on<EventName extends keyof ApiChangeEvents<T>>(eventName: EventName, handler: (ev: ApiChangeEvents<T>[EventName]) => void): this;
    off<EventName extends keyof ApiChangeEvents<T>>(eventName: EventName, handler: (ev: ApiChangeEvents<T>[EventName]) => void): this;
}
