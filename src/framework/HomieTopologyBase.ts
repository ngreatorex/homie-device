import { IClientPublishOptions } from 'mqtt';
import { EventEmitter } from 'events';
import _ from 'lodash';
import * as winston from "winston";

export default abstract class HomieTopologyBase extends EventEmitter {
    private _name: string;
    private _friendlyName: string;
    private _isConnected: boolean;
    
    protected readonly logger: winston.Logger;

    constructor(name: string, friendlyName: string) {
        super();
        this._name = name;
        this._friendlyName = friendlyName;
        this._isConnected = false;
        this.logger = winston.child({
            type: this.constructor.name,
            name: this.name,
        });
    }

    public get name() { return this._name; }

    public get friendlyName() { return this._friendlyName; }
    public set friendlyName(value: string) { this._friendlyName = value; }

    public get isConnected() { return this._isConnected; }

//_region publications
    /** 
     * Publishes a value to the given path, rooted in this topology element 
     * @internal
    */
    publish = (path: string, value: string, options: IClientPublishOptions | boolean | null | undefined): void => {
        // trim leading '/'
        if (path.startsWith('/'))
            path = path.substring(1);

        let safeOptions: IClientPublishOptions | null | undefined;
        if (_.isBoolean(options))
            safeOptions = { retain: options } as IClientPublishOptions;
        else if (!options)
            safeOptions = undefined;
        else 
            safeOptions = options as IClientPublishOptions;

        this.logger.debug(`publish: ${path} = ${value}`)
        this.rawPublish(`${this.name}/${path}`, value, safeOptions);
    }

    protected abstract rawPublish(path: string, value: string, options: IClientPublishOptions | null | undefined): void;

    /** 
     * Publishes a device attribute 
     * 
     * @param name Attribute name
     * @param value Attribute value
     */
    protected publishAttribute = (name: string, value: string) => {
        this.publish(`$${name}`, value, true);
    }

    /**
     * Publishes device attributes
     * 
     * @param attributes An object containing the attributes to be published. Attributes will null or undefined values are ignored.
     */
    protected publishAttributes = (attributes: { [key: string]: any }) => {
        Object.entries(attributes).forEach(([key, value]) => {
            if (value != null && value != undefined) 
                this.publishAttribute(key, value.toString());
        });
    }

    protected publishProperty = (name: string, value: string) => {
        this.publish(name, value, false);
    }

    protected publishStats = (stats: { [key: string]: any }) => {
        Object.entries(stats).forEach(([key, value]) => {
            if (value != null && value != undefined) 
                this.publish(`$stats/${key}`, value.toString(), false);
        });
    }
//#endregion

//#region subscriptions
    /**
     * @internal
     */
    subscribe = (path: string): void => {
        // trim leading '/'
        if (path.startsWith('/'))
            path = path.substring(1);

        this.logger.debug(`subscribing to path "${path}"`);
        this.rawSubscribe(`${this.name}/${path}`);
    }

    protected abstract rawSubscribe(path: string): void;
//#endregion

//#region event handlers
    /**
     * Called when the MQTT connection is established
     * @internal
     */
    onConnect(): void { 
        this._isConnected = true;
        this.logger.debug('connected');
        this.emit('connect');
    }

    /**
     * Called when a disconnect packet is received from the MQTT server (MQTT 5.0 feature)
     * @internal
     */
    onDisconnect(): void { 
        this._isConnected = false;
        this.logger.debug('disconnected');
        this.emit('disconnect');
    }

    /**
     * Fired the client goes offline
     * @internal
     */
    onOffline(): void { 
        this._isConnected = false;
        this.logger.debug('offline');
        this.emit('offline');
    }

    /** 
     * Fired when the client cannot connect (i.e. connack rc != 0) or when a parsing error occurs
     * @internal
     * @param error The error relayed by the MQTT library
     */
    onError(err: Error): void { 
        this.logger.debug('error', err);
        this.emit('error', err);
    }

    /** 
     * Fired when stats should be published 
     * @internal
     */
    onStatsInterval(): void { 
        this.logger.debug('reporting stats');
        this.emit('stats-interval');
    }
//#endregion
}
