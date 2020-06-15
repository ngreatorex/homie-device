import IHomieTopologyConfiguration from './IHomieTopologyConfiguration';
import HomieTopologyBase from './HomieTopologyBase';

export default abstract class HomieTopologyWithConfiguration<TConfiguration extends IHomieTopologyConfiguration> extends HomieTopologyBase {
    private _config: TConfiguration;
    
    constructor(config: TConfiguration) {
        super(config.name, config.friendlyName);
        this._config = config;
    }

    public get config() { return this._config; }

    onConnect = () => {
        super.onConnect();
        if (!Object.isFrozen(this._config))
            this._config = Object.freeze(this._config);
    }
}



