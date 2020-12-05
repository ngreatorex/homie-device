import { IClientPublishOptions } from "mqtt";
import HomieTopologyBase from "./HomieTopologyBase";
import HomieTopologyWithConfiguration from "./HomieTopologyWithConfiguration";
import IHomieTopologyConfiguration from "./IHomieTopologyConfiguration";

export default abstract class HomieTopologyElement<
        TParent extends HomieTopologyBase,
        TConfig extends IHomieTopologyConfiguration
    > extends HomieTopologyWithConfiguration<TConfig> {

    private parent$: TParent;

    constructor(config: TConfig, parent: TParent) {
        super(config);
        this.parent$ = parent;
    }

    public get parent(): TParent { return this.parent$; }

    protected rawPublish(path: string, value: string, options: IClientPublishOptions | null | undefined) {
        this.parent$.publish(path, value, options);
    }

    protected rawSubscribe(path: string): void {
        this.parent$.subscribe(path);
    }
}
