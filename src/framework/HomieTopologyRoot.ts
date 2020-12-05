import { IClientPublishOptions, MqttClient } from "mqtt";
import { IHomieDeviceConfiguration } from "../HomieDevice";
import HomieTopologyWithConfiguration from "./HomieTopologyWithConfiguration";

export default abstract class HomieTopologyRoot extends HomieTopologyWithConfiguration<IHomieDeviceConfiguration> {
    private client$: MqttClient | null = null;

    constructor(config: IHomieDeviceConfiguration) {
        super(config);
    }

    protected set client(client: MqttClient | null) {
        this.client$ = client;
    }
    protected get client() { return this.client$; }

    protected rawPublish(path: string, value: string, options: IClientPublishOptions | null | undefined) {
        if (this.client$ === null) {
            throw new Error("client has not been initialized");
        }
        // tslint:disable-next-line:whitespace
        const resolvedTopic = `${this.config.mqtt?.base_topic || "homie"}/${path}`;
        this.logger.debug(`publishing ${resolvedTopic}: ${value}`);
        this.client$.publish(
            resolvedTopic,
            value,
            options || {} as IClientPublishOptions);
    }

    protected rawSubscribe(path: string): void {
        if (this.client$ === null) {
            throw new Error("client has not been initialized");
        }
        // tslint:disable-next-line:whitespace
        const resolvedTopic = `${this.config.mqtt?.base_topic || "homie"}/${path}`;
        this.logger.debug(`subscribing to ${resolvedTopic}`);
        this.client$.subscribe(resolvedTopic);
    }
}
