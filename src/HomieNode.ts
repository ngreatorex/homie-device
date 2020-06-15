import _ from 'lodash';
import HomieProperty, { IHomiePropertyConfiguration } from './homieProperty';
import HomieDevice from './HomieDevice';
import { HomieTopologyElement } from './framework/HomieTopologyElement';
import { IClientPublishOptions } from 'mqtt';
import IHomieTopologyConfiguration from './framework/IHomieTopologyConfiguration';

export interface IHomieNodeConfiguration extends IHomieTopologyConfiguration {
  name: string,
  friendlyName: string,
  type: string,
  isRange: boolean,
  startRange?: number,
  endRange?: number,
};

export const DefaultConfiguration: IHomieNodeConfiguration = {
  type: "switch",
  isRange: false,
} as unknown as IHomieNodeConfiguration;

export default class HomieNode extends HomieTopologyElement<HomieDevice, IHomieNodeConfiguration> {
  private _properties: { [key: string]: HomieProperty };;

  constructor(parent: HomieDevice, config: IHomieNodeConfiguration) {
    super(_.merge({}, DefaultConfiguration, config), parent);

    if (config.name.indexOf("_") >= 0) {
      throw new Error(`A HomieNode name cannot include an underscore. The name provided was "${config.name}"`);
    }

    this._properties = {};
    if (config.isRange) {
      if (config.startRange == undefined) {
        throw new Error('IsRange=true but StartRange=undefined');
      }
      if (config.endRange == undefined) {
        throw new Error('IsRange=true but EndRange=undefined');
      }
    }
  }

  get type(): string { return this.config.type; }
  get isRange(): boolean { return this.config.isRange; }
  get startRange(): number | undefined { return this.config.startRange; }
  get endRange(): number | undefined { return this.config.endRange; }
  get properties(): HomieProperty[] { return Object.values(this._properties); }

  addProperty = (config: IHomiePropertyConfiguration): HomieProperty => this._properties[config.name] = new HomieProperty(this, config);

  getProperty = (propName: string): HomieProperty => this._properties[propName];

  /** 
   * @internal 
   * MQTT OnConnect event handler 
   */
  onConnect = () => {
    super.onConnect();

    const properties: string[] = [];
    _.each(this._properties, (property: HomieProperty) => {
      properties.push(property.name);
    });

    this.publishAttributes({
      'type': this.config.type,
      'name': this.friendlyName,
      'properties': properties.join(',')
    });

    if (this.config.isRange) {
      this.publishAttribute('array', `${this.config.startRange}-${this.config.endRange}`);
    }

    _.each(this._properties, (prop: HomieProperty) => {
      prop.onConnect();
    });
  }

//#region event handlers
  onOffline = () => {
    super.onOffline();
    _.each(this._properties, (prop: HomieProperty) => {
      prop.onOffline();
    });
  }

  // Called on mqtt client disconnect
  onDisconnect = () => {
    super.onDisconnect();
    _.each(this._properties, (prop: HomieProperty) => {
      prop.onDisconnect();
    });
  }

  onError = (err: Error): void => {
    super.onError(err);
    _.each(this._properties, (prop: HomieProperty) => {
      prop.onError(err);
    });
  }

  // Called on every stats interval
  onStatsInterval = () => {
    super.onStatsInterval();
    _.each(this._properties, (prop: HomieProperty) => {
      prop.onStatsInterval();
    });
  }
//#endregion

  /**
   * Publishes the value of the given HomieProperty 
   * @internal
   */
  publishPropertyValue = (property: HomieProperty, value: number | string | boolean) => {
    let topic = this.isRange
      ? `${this.name}_${property.rangeIndex}/${property.name}`
      : `${this.name}/${property.name}`;
    this.rawPublish(topic, value.toString(), { retain: property.retained } as IClientPublishOptions);
  }
}