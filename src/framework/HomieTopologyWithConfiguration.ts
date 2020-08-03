import IHomieTopologyConfiguration from './IHomieTopologyConfiguration';
import HomieTopologyBase from './HomieTopologyBase';

export default abstract class HomieTopologyWithConfiguration<TConfiguration extends IHomieTopologyConfiguration> extends HomieTopologyBase {
    private _config: TConfiguration;
    private _configurable: boolean = true;
    
    constructor(config: TConfiguration) {
        super(config.name, config.friendlyName);
        this._config = config;
    }

    public get config() { return this._config; }

    onConnect = () => {
        this._configurable = false;
        super.onConnect();
        if (!Object.isFrozen(this._config))
            this._config = Object.freeze(this._config);
    }

    /**
     * Asserts that the configurabion is mutable. This assertion will fail after a connection has been established to the MQTT server
     */
    protected assertConfigurable() {
        if (!this._configurable)
            throw new Error(`This ${this.constructor.name} is no longer configurable. All configuration must occur prior to connecting.`);
    }
}



