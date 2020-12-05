import { EventEmitter } from "events";
import _ from "lodash";
import { IClientPublishOptions } from "mqtt";
import * as winston from "winston";

export type PermittedAttributeValues = number | boolean | string | undefined | null;

export default abstract class HomieTopologyBase extends EventEmitter {

  public get name(): string { return this.name$; }

  public get friendlyName(): string { return this.friendlyName$; }
  public set friendlyName(value: string) { this.friendlyName$ = value; }

  public get isConnected(): boolean { return this.isConnected$; }

  protected readonly logger: winston.Logger;
  private name$: string;
  private friendlyName$: string;
  private isConnected$: boolean;

  constructor(name: string, friendlyName: string) {
    super();
    this.name$ = name;
    this.friendlyName$ = friendlyName;
    this.isConnected$ = false;
    this.logger = winston.child({
      name: this.name,
      type: this.constructor.name,
    });
  }

  // _region publications
  /**
   * Publishes a value to the given path, rooted in this topology element
   * @internal
   */
  public publish = (
    path: string,
    value: string,
    options: IClientPublishOptions | boolean | null | undefined,
  ): void => {
    // trim leading '/'
    if (path.startsWith("/")) {
      path = path.substring(1);
    }

    let safeOptions: IClientPublishOptions | null | undefined;
    if (_.isBoolean(options)) {
      safeOptions = { retain: options } as IClientPublishOptions;
    } else if (!options) {
      safeOptions = undefined;
    } else {
      safeOptions = options as IClientPublishOptions;
    }

    this.rawPublish(`${this.name}/${path}`, value, safeOptions);
  }
  //#endregion

  //#region subscriptions
  /**
   * @internal
   */
  public subscribe = (path: string): void => {
    // trim leading '/'
    if (path.startsWith("/")) {
      path = path.substring(1);
    }

    this.rawSubscribe(`${this.name}/${path}`);
  }
  //#endregion

  //#region event handlers
  /**
   * Called when the MQTT connection is established
   * @internal
   */
  public onConnect(): void {
    this.isConnected$ = true;
    this.logger.debug("connected");
    this.emit("connect");
  }

  /**
   * Called when a disconnect packet is received from the MQTT server (MQTT 5.0 feature)
   * @internal
   */
  public onDisconnect(): void {
    this.isConnected$ = false;
    this.logger.verbose("Disconnected");
    this.emit("disconnect");
  }

  /**
   * Fired the client goes offline
   * @internal
   */
  public onOffline(): void {
    this.isConnected$ = false;
    this.logger.debug("offline");
    this.emit("offline");
  }

  /**
   * Fired when the client cannot connect (i.e. connack rc != 0) or when a parsing error occurs
   * @internal
   * @param error The error relayed by the MQTT library
   */
  public onError(err: Error): void {
    this.logger.debug("error", err);
    this.emit("error", err);
  }

  /**
   * Fired when stats should be published
   * @internal
   */
  public onStatsInterval(): void {
    this.logger.debug("reporting stats");
    this.emit("stats-interval");
  }

  protected abstract rawPublish(path: string, value: string, options: IClientPublishOptions | null | undefined): void;

  /**
   * Publishes a device attribute
   *
   * @param name Attribute name
   * @param value Attribute value
   */
  protected publishAttribute = (name: string, value: string): void => {
    this.publish(`$${name}`, value, true);
  }

  /**
   * Publishes device attributes
   *
   * @param attributes An object containing the attributes to be published.
   * Attributes will null or undefined values are ignored.
   */
  protected publishAttributes = (attributes: { [key: string]: PermittedAttributeValues }): void => {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value != null && value !== undefined) {
        this.publishAttribute(key, value.toString());
      }
    });
  }

  protected publishProperty = (name: string, value: string): void => {
    this.publish(name, value, false);
  }

  protected publishStats = (stats: { [key: string]: PermittedAttributeValues }): void => {
    Object.entries(stats).forEach(([key, value]) => {
      if (value != null && value !== undefined) {
        this.publish(`$stats/${key}`, value.toString(), false);
      }
    });
  }

  protected abstract rawSubscribe(path: string): void;
  //#endregion
}
