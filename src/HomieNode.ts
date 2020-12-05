import _ from "lodash";
import { IClientPublishOptions } from "mqtt";
import { HomieTopologyElement, IHomieTopologyConfiguration } from "./framework";
import HomieDevice from "./HomieDevice";
import HomieProperty, { IHomiePropertyConfiguration } from "./HomieProperty";

export interface IHomieNodeConfiguration extends IHomieTopologyConfiguration {
  name: string;
  friendlyName: string;
  type: string;
  isRange: boolean;
  startRange?: number;
  endRange?: number;
}

export const DefaultConfiguration: IHomieNodeConfiguration = {
  isRange: false,
  type: "switch",
} as unknown as IHomieNodeConfiguration;

export default class HomieNode extends HomieTopologyElement<HomieDevice, IHomieNodeConfiguration> {
  private properties$: { [key: string]: HomieProperty };

  constructor(parent: HomieDevice, config: IHomieNodeConfiguration) {
    super(_.merge({}, DefaultConfiguration, config), parent);

    if (config.name.indexOf("_") >= 0) {
      throw new Error(`A HomieNode name cannot include an underscore. The name provided was "${config.name}"`);
    }

    this.properties$ = {};
    if (config.isRange) {
      if (config.startRange === undefined) {
        throw new Error("IsRange=true but StartRange=undefined");
      }
      if (config.endRange === undefined) {
        throw new Error("IsRange=true but EndRange=undefined");
      }
    }
  }

  get type(): string { return this.config.type; }
  get isRange(): boolean { return this.config.isRange; }
  get startRange(): number | undefined { return this.config.startRange; }
  get endRange(): number | undefined { return this.config.endRange; }
  get properties(): HomieProperty[] { return Object.values(this.properties$); }

  public addProperty = (config: IHomiePropertyConfiguration): HomieProperty => {
    super.assertConfigurable();
    return this.properties$[config.name] = new HomieProperty(this, config);
  }

  public getProperty = (propName: string): HomieProperty => this.properties$[propName];

  /**
   * @internal
   * MQTT OnConnect event handler
   */
  public onConnect = () => {
    super.onConnect();

    const properties: string[] = [];
    _.each(this.properties$, (property: HomieProperty) => {
      properties.push(property.name);
    });

    this.publishAttributes({
      name: this.friendlyName,
      properties: properties.join(","),
      type: this.config.type,
    });

    if (this.config.isRange) {
      this.publishAttribute("array", `${this.config.startRange}-${this.config.endRange}`);
    }

    _.each(this.properties$, (prop: HomieProperty) => {
      prop.onConnect();
    });
  }

  //#region event handlers
  public onOffline = () => {
    super.onOffline();
    _.each(this.properties$, (prop: HomieProperty) => {
      prop.onOffline();
    });
  }

  // Called on mqtt client disconnect
  public onDisconnect = () => {
    super.onDisconnect();
    _.each(this.properties$, (prop: HomieProperty) => {
      prop.onDisconnect();
    });
  }

  public onError = (err: Error): void => {
    super.onError(err);
    _.each(this.properties$, (prop: HomieProperty) => {
      prop.onError(err);
    });
  }

  // Called on every stats interval
  public onStatsInterval = () => {
    super.onStatsInterval();
    _.each(this.properties$, (prop: HomieProperty) => {
      prop.onStatsInterval();
    });
  }
  //#endregion

  /**
   * Publishes the value of the given HomieProperty
   * @internal
   */
  public publishPropertyValue = (property: HomieProperty, value: number | string | boolean) => {
    const topic = this.isRange
      ? `${this.name}_${property.rangeIndex}/${property.name}`
      : `${this.name}/${property.name}`;
    this.rawPublish(topic, value.toString(), { retain: property.retained } as IClientPublishOptions);
  }
}
