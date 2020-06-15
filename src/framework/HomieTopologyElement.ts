import HomieTopologyBase from "./HomieTopologyBase";
import { IClientPublishOptions } from "mqtt";
import IHomieTopologyConfiguration from "./IHomieTopologyConfiguration";
import HomieTopologyWithConfiguration from "./HomieTopologyWithConfiguration";

export abstract class HomieTopologyElement<TParent extends HomieTopologyBase, TConfig extends IHomieTopologyConfiguration> extends HomieTopologyWithConfiguration<TConfig> {
    private _parent: TParent;
    
    constructor(config: TConfig, parent: TParent) {
        super(config);
        this._parent = parent;
    }

    public get parent(): TParent { return this._parent; }

    protected rawPublish(path: string, value: string, options: IClientPublishOptions | null | undefined) {
        this._parent.publish(path, value, options);
    }

    protected rawSubscribe(path: string): void {
        this._parent.subscribe(path);
    };
}