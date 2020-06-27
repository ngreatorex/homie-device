import _ from 'lodash';
import { HomieTopologyElement, IHomieTopologyConfiguration } from './framework';
import HomieNode from './HomieNode';

export enum PropertyDataType {
  integer, 
  float, 
  boolean,
  string, 
  enum, 
  color
}

export interface IHomiePropertyConfiguration extends IHomieTopologyConfiguration {
  settable: boolean,
  format?: string,
  dataType: PropertyDataType,
  unit?: string,
  retained: boolean,
};

export const DefaultConfiguration: IHomiePropertyConfiguration = {
  settable: true,
  dataType: PropertyDataType.string,
  retained: false,
} as unknown as IHomiePropertyConfiguration;


export default class HomieProperty extends HomieTopologyElement<HomieNode, IHomiePropertyConfiguration> {
  private _rangeIndex: number | null | undefined;

  constructor(parent: HomieNode, config: IHomiePropertyConfiguration) {
    super(_.merge({}, DefaultConfiguration, config), parent);
  }

  public set unit(value: string | undefined) { this.config.unit = value; }
  public get unit() { return this.config.unit; }

  public set datatype(value: PropertyDataType) { this.config.dataType = value; }
  public get datatype() { return this.config.dataType; }

  public set format(value: string | undefined) { this.config.format = value; }
  public get format() { return this.config.format; }

  public set retained(value: boolean) {
    if (!_.isBoolean(value))
      throw new Error('retained must be a boolean');
    this.config.retained = value;
  }
  public get retained() { return this.config.retained; }

  public set rangeIndex(value: number | null | undefined) {
    if (!_.isInteger(value))
      throw new Error('rangeIndex must be an integer');

    this._rangeIndex = value;
  }
  public get rangeIndex() { return this._rangeIndex; }

  public get settable() { return this.config.settable; }
  public set settable(value: boolean) {
    if (!_.isBoolean(value))
      throw new Error('retained must be a boolean');
    this.config.settable = value;
  }

  onConnect = () => {
    super.onConnect();
    this.publishAttributes({
      name: this.friendlyName,
      retained: !!this.config.retained,
      settable: this.config.settable,
      unit: this.config.unit,
      datatype: _.isNumber(this.config.dataType) ? PropertyDataType[this.config.dataType] : this.config.dataType,
      format: this.config.format,
    });
  }

  /**
   * Emits the 'set' event
   * @internal
   */
  invokeSetter = (range: { isRange: boolean, index?: number }, value: string | null) => {
    if (!this.config.settable)
      throw new Error("This property is not settable");
    this.emit('set', { range, value });
  }

  /**
   * Publishes the current value of this HomieProperty
   */
  publishValue = (value: string | number | boolean): void => this.parent.publishPropertyValue(this, value);
};