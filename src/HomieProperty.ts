import _ from "lodash";
import { HomieTopologyElement, IHomieTopologyConfiguration } from "./framework";
import HomieNode from "./HomieNode";

export enum PropertyDataType {
  integer,
  float,
  boolean,
  string,
  enum,
  color,
}

export interface IHomiePropertyConfiguration extends IHomieTopologyConfiguration {
  settable: boolean;
  format?: string;
  dataType: PropertyDataType;
  unit?: string;
  retained: boolean;
}

export const DefaultConfiguration: IHomiePropertyConfiguration = {
  dataType: PropertyDataType.string,
  retained: false,
  settable: true,
} as unknown as IHomiePropertyConfiguration;

export default class HomieProperty extends HomieTopologyElement<HomieNode, IHomiePropertyConfiguration> {
  constructor(parent: HomieNode, config: IHomiePropertyConfiguration) {
    super(_.merge({}, DefaultConfiguration, config), parent);
  }

  public set unit(value: string | undefined) { this.config.unit = value; }
  public get unit(): string | undefined { return this.config.unit; }

  public set datatype(value: PropertyDataType) { this.config.dataType = value; }
  public get datatype(): PropertyDataType { return this.config.dataType; }

  public set format(value: string | undefined) { this.config.format = value; }
  public get format(): string | undefined { return this.config.format; }

  public set retained(value: boolean) {
    if (!_.isBoolean(value)) {
      throw new Error("retained must be a boolean");
    }
    this.config.retained = value;
  }
  public get retained(): boolean { return this.config.retained; }

  public get settable(): boolean { return this.config.settable; }
  public set settable(value: boolean) {
    if (!_.isBoolean(value)) {
      throw new Error("retained must be a boolean");
    }
    this.config.settable = value;
  }

  public onConnect = (): void => {
    super.onConnect();
    this.publishAttributes({
      datatype: _.isNumber(this.config.dataType) ? PropertyDataType[this.config.dataType] : this.config.dataType,
      format: this.config.format,
      name: this.friendlyName,
      retained: !!this.config.retained,
      settable: this.config.settable,
      unit: this.config.unit,
    });
  }

  /**
   * Emits the 'set' event
   * @internal
   */
  public invokeSetter = (range: { isRange: boolean, index?: number }, value: string | null): void => {
    if (!this.config.settable) {
      throw new Error("This property is not settable");
    }
    this.emit("set", { range, value });
  }

  /**
   * Publishes the current value of this HomieProperty
   */
  public publishValue = (value: string | number | boolean, rangeIndex?: number): void => {
    this.parent.publishPropertyValue(this, value, rangeIndex);
  } 
}
