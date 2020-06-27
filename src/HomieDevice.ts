import _ from 'lodash';
import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import HomieNode, { IHomieNodeConfiguration } from './HomieNode';
import { HomieTopologyRoot, IHomieTopologyConfiguration } from './framework';

const pkgJson = require('../package.json') as any;
const homieVersion = '3.0.1';
const homieImplName = `nodejs:${pkgJson.name}`;
const homieImplVersion = pkgJson.version;

export interface IMqttConfiguration {
    base_topic: string,
    client: IClientOptions,
    connectionFactory: (options: IClientOptions) => MqttClient,
}

export interface IHomieDeviceConfiguration extends IHomieTopologyConfiguration {
    mqtt: IMqttConfiguration,
    settings: any,
    ip: any,
    mac: any,
    statsInterval: number,
    firmwareName: string,
    firmwareVersion: string,
}

export const DefaultConfiguration = {
  name: "",
  friendlyName: "unknown",
  mqtt: {
    client: {
      host: "localhost",
      port: 1883,
      username: undefined,
      password: undefined,
    } as IClientOptions,
    base_topic: "homie",
    connectionFactory: mqtt.connect,
  } as IMqttConfiguration,
  settings: {},
  ip: null,
  mac: null,
  statsInterval: 60,
} as IHomieDeviceConfiguration

export default class HomieDevice extends HomieTopologyRoot {
  private _startTime: number;
  private _nodes: { [key: string]: HomieNode };
  private _statsInterval: number;
  private _mqttClient: MqttClient | null;
  private _interval: NodeJS.Timeout | null = null;
  private _configurable: boolean = true;

  private static validateConfig(config: IHomieDeviceConfiguration | string): IHomieDeviceConfiguration {
    if (_.isString(config)) {
      config = { name: config, friendlyName: config } as IHomieDeviceConfiguration;
    }
    return _.merge({}, DefaultConfiguration, config);
  }

  constructor(config: IHomieDeviceConfiguration | string) {
    super(HomieDevice.validateConfig(config));
    
    this._startTime = Date.now();
    this._nodes = {};
    this._statsInterval = this.config.statsInterval;
    this._mqttClient = null;
  }  

  node = (config: IHomieNodeConfiguration): HomieNode => {
    if (!this._configurable)
      throw new Error('This HomieDevice is no longer configurable. All configuration must occur prior to connecting.');
    return this._nodes[config.name] = new HomieNode(this, config);
  }

  setup = () => {
    this._configurable = false;

    const opts = _.merge({}, this.config.mqtt.client, {
      will: {
        topic: `${this.name}/$state`,
        payload: 'lost',
        qos: 0,
        retain: true
      }
    });
    this._mqttClient = this.client = this.config.mqtt.connectionFactory(opts);
    this._mqttClient.on('connect', this.onConnect);
    this._mqttClient.on('close', this.onDisconnect);
    this._mqttClient.on('offline', this.onOffline);
    this._mqttClient.on('error', this.onError);
    this._mqttClient.on('message', (topic: string, payload: Buffer) => {
      this._onMessage(topic, !!payload ? payload.toString() : null);
    })

    this.subscribe(`${this.name}/#`);
    this._mqttClient.subscribe(`${this.config.mqtt.base_topic}$broadcast/#`);

    console.log(`Homie device ${this.config.friendlyName} (${this.config.name}) connected`);
  }

  /** Stops this device */
  end = () => {
    if (this._mqttClient === null)
      throw new Error('client has not been initialized');
    this.publishAttribute('state', 'disconnected');
    this._mqttClient.end();
  }

  onConnect = () => {
    const nodes: string[] = [];
    _.each(this._nodes, (node: HomieNode) => {
      var text = node.isRange ? `${node.name}[]` : node.name;
      nodes.push(text);
      node.onConnect();
    })

    // Advertise device properties
    this.publishAttributes({
      state: 'init',
      homie: homieVersion,
      implementation: homieImplName,
      'implementation/version': homieImplVersion,
      name: this.friendlyName,
      stats: 'interval,uptime',
      'fw/name': this.config.firmwareName,
      'fw/version': this.config.firmwareVersion,
      mac: this.config.mac,
      localip: this.config.ip,
      nodes: nodes.join(','),
    });

    // Call the stats interval now, and at regular intervals
    this.onStatsInterval();
    this._interval = setInterval(() => {
      this.onStatsInterval();
    }, this._statsInterval * 1000);

    super.onConnect();
    this.publishAttribute('state', 'ready');
  }

  onDisconnect = () => {
    super.onDisconnect();
    if (this._interval != null)
      clearInterval(this._interval);
    this._interval = null;
    _.each(this._nodes, (node: HomieNode) => {
      node.onDisconnect();
    });
  }

  onOffline = () => {
    super.onOffline();
    _.each(this._nodes, (node: HomieNode) => {
      node.onOffline();
    });
  }

  /** MQTT client error handler */
  onError = (err: Error) => {
    super.onError(err);
    _.each(this._nodes, (node: HomieNode) => {
      node.onError(err);
    });
  }

  onStatsInterval() {
    super.onStatsInterval();
    const uptime = (Date.now() - this._startTime) / 1000;
    this.publishStats({
      uptime: _.round(uptime, 0),
      interval: this._statsInterval
    });
    _.each(this._nodes, (node: HomieNode) => {
      node.onStatsInterval();
    });
  }

  private _onMessage = (topic: string, msg: string | null) => {
    const parts = topic.split('/');
    const deviceTopic = parts.slice(2).join('/');
    //console.log(`received message: parts=${topic}, deviceTopic=${deviceTopic}`);

    // Emit broadcast messages to broadcast listeners
    if (parts[1] == '$broadcast') {
      this.emit('broadcast', deviceTopic, msg);
      return;
    }

    // Emit to listeners of all device topics
    this.emit('message', deviceTopic, msg);

    // Emit to listeners of the specific device topic
    this.emit(`message:${deviceTopic}`, msg);

    // Invoke property setters if this is a property set message
    if (parts[1] == this.name && parts[4] == 'set') {
      let nodeName = parts[2];
      const propName = parts[3];
      const value = msg;
      const range = { isRange: false, index: 0 };

      if (nodeName.includes("_")) {
        range.isRange = true;
        const nodeParts = nodeName.split('_');
        nodeName = nodeParts[0];
        range.index = parseInt(nodeParts[1])
      }
      const node = this._nodes[nodeName];

      if (node && node.isRange === range.isRange) {
        const prop = node.getProperty(propName);
        if (!!prop)
          prop.invokeSetter(range, value);
      }
    }
  }
}