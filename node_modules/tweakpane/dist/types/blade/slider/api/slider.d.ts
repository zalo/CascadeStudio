import { ApiChangeEvents, BladeApi, EventListenable, LabeledValueBladeController, SliderTextController } from '@tweakpane/core';
export declare class SliderBladeApi extends BladeApi<LabeledValueBladeController<number, SliderTextController>> implements EventListenable<ApiChangeEvents<number>> {
    private readonly emitter_;
    /**
     * @hidden
     */
    constructor(controller: LabeledValueBladeController<number, SliderTextController>);
    get label(): string | null | undefined;
    set label(label: string | null | undefined);
    get max(): number;
    set max(max: number);
    get min(): number;
    set min(min: number);
    get value(): number;
    set value(value: number);
    on<EventName extends keyof ApiChangeEvents<number>>(eventName: EventName, handler: (ev: ApiChangeEvents<number>[EventName]) => void): this;
    off<EventName extends keyof ApiChangeEvents<number>>(eventName: EventName, handler: (ev: ApiChangeEvents<number>[EventName]) => void): this;
}
