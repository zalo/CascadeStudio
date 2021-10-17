import { ApiChangeEvents, BladeApi, LabelController, ListController, ListItem } from '@tweakpane/core';
export declare class ListApi<T> extends BladeApi<LabelController<ListController<T>>> {
    private readonly emitter_;
    constructor(controller: LabelController<ListController<T>>);
    get label(): string | undefined;
    set label(label: string | undefined);
    get options(): ListItem<T>[];
    set options(options: ListItem<T>[]);
    get value(): T;
    set value(value: T);
    on<EventName extends keyof ApiChangeEvents<T>>(eventName: EventName, handler: (ev: ApiChangeEvents<T>[EventName]['event']) => void): this;
}
