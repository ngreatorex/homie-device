import HomieTopologyWithConfiguration from "./HomieTopologyWithConfiguration";
import { MqttClient, IClientPublishOptions } from "mqtt";
import { IHomieDeviceConfiguration } from '../HomieDevice';

export default abstract class HomieTopologyRoot extends HomieTopologyWithConfiguration<IHomieDeviceConfiguration> {
    private _client: MqttClient | null = null;

    constructor(config: IHomieDeviceConfiguration) {
        super(config);
    }

    protected set client(client : MqttClient | null) { 
        this._client = client;
    }
    protected get client() { return this._client; }

    protected rawPublish(path: string, value: string, options: IClientPublishOptions | null | undefined) {
        if (this._client === null)
            throw new Error('client has not been initialized');
        this._client.publish(`${this.config.mqtt.base_topic}/${path}`, value, options || {} as IClientPublishOptions);
    }

    protected rawSubscribe(path: string): void {
        if (this._client === null)
            throw new Error('client has not been initialized');
        this._client.subscribe(path);
    };
}