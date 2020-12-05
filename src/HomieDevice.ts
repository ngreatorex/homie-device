import _ from "lodash";
import mqtt, { IClientOptions, MqttClient } from "mqtt";
import { HomieTopologyRoot, IHomieTopologyConfiguration } from "./framework";
import HomieNode, { IHomieNodeConfiguration } from "./HomieNode";

// tslint:disable-next-line:no-var-requires
const pkgJson = require("../package.json") as any;
const homieVersion = "3.0.1";
const homieImplName = `nodejs:${pkgJson.name}`;
const homieImplVersion = pkgJson.version;

export interface IMqttConfiguration {
  base_topic?: string;
  client?: IClientOptions;
  connectionFactory?: (options: IClientOptions) => MqttClient;
}

export interface IHomieDeviceConfiguration extends IHomieTopologyConfiguration {
  mqtt?: IMqttConfiguration;
  settings?: any;
  ip?: string | null;
  mac?: string | null;
  statsInterval?: number;
  firmwareName?: string;
  firmwareVersion?: string;
}

const DefaultStatsInterval = 60;

export const DefaultConfiguration = {
  friendlyName: "unknown",
  ip: null,
  mac: null,
  mqtt: {
    base_topic: "homie",
    client: {
      host: "localhost",
      password: undefined,
      port: 1883,
      username: undefined,
    } as IClientOptions,
    connectionFactory: mqtt.connect,
  } as IMqttConfiguration,
  name: "",
  settings: {},
  statsInterval: DefaultStatsInterval,
} as IHomieDeviceConfiguration;

export default class HomieDevice extends HomieTopologyRoot {

  private static interval$(config: IHomieDeviceConfiguration | string): IHomieDeviceConfiguration {
    if (_.isString(config)) {
      config = { name: config, friendlyName: config } as IHomieDeviceConfiguration;
    }
    return _.merge({}, DefaultConfiguration, config);
  }
  private startTime$: number;
  private nodes$: { [key: string]: HomieNode };
  private statsInterval$: number;
  private mqttClient$: MqttClient | null;
  private interval$: NodeJS.Timeout | null = null;

  constructor(config: IHomieDeviceConfiguration | string) {
    super(HomieDevice.interval$(config));

    this.startTime$ = Date.now();
    this.nodes$ = {};
    this.statsInterval$ = this.config.statsInterval || DefaultStatsInterval;
    this.mqttClient$ = null;
  }

  public node = (config: IHomieNodeConfiguration): HomieNode => {
    super.assertConfigurable();
    this.logger.debug(`Registering new node "${config.friendlyName}" (${config.name})`);
    return this.nodes$[config.name] = new HomieNode(this, config);
  }

  public setup = () => {
    // tslint:disable-next-line:whitespace
    const opts = _.merge({}, this.config.mqtt?.client, {
      will: {
        payload: "lost",
        qos: 0,
        retain: true,
        topic: `${this.name}/$state`,
      },
    }) as mqtt.IClientOptions;
    // tslint:disable-next-line:whitespace
    if (typeof this.config.mqtt?.connectionFactory !== "function") {
      throw new Error("No mqtt.connectionFactory is configured. This really shouldn't happen.");
    }
    this.mqttClient$ = this.client = this.config.mqtt.connectionFactory!(opts);
    this.mqttClient$.on("connect", this.onConnect);
    this.mqttClient$.on("close", this.onDisconnect);
    this.mqttClient$.on("offline", this.onOffline);
    this.mqttClient$.on("error", this.onError);
    this.mqttClient$.on("message", (topic: string, payload: Buffer) => {
      this.onMessage(topic, !!payload ? payload.toString() : null);
    });

    this.subscribe(`${this.name}/#`);
    this.mqttClient$.subscribe(`${this.config.mqtt.base_topic}$broadcast/#`);

    this.logger.info(`Homie device ${this.config.friendlyName} (${this.config.name}) connected`);
  }

  /** Stops this device */
  public end = () => {
    if (this.mqttClient$ === null) {
      throw new Error("client has not been initialized");
    }
    this.publishAttribute("state", "disconnected");
    this.mqttClient$.end();
  }

  public onConnect = () => {
    const nodes: string[] = [];
    _.each(this.nodes$, (node: HomieNode) => {
      const text = node.isRange ? `${node.name}[]` : node.name;
      nodes.push(text);
      node.onConnect();
    });

    // Advertise device properties
    this.publishAttributes({
      "fw/name": this.config.firmwareName,
      "fw/version": this.config.firmwareVersion,
      "homie": homieVersion,
      "implementation": homieImplName,
      "implementation/version": homieImplVersion,
      "localip": this.config.ip,
      "mac": this.config.mac,
      "name": this.friendlyName,
      "nodes": nodes.join(","),
      "state": "init",
      "stats": "interval,uptime",
    });

    // Call the stats interval now, and at regular intervals
    this.onStatsInterval();
    this.interval$ = setInterval(() => {
      this.onStatsInterval();
    }, this.statsInterval$ * 1000);

    super.onConnect();
    this.publishAttribute("state", "ready");
  }

  public onDisconnect = () => {
    super.onDisconnect();
    if (this.interval$ != null) {
      clearInterval(this.interval$);
    }
    this.interval$ = null;
    _.each(this.nodes$, (node: HomieNode) => {
      node.onDisconnect();
    });
  }

  public onOffline = () => {
    super.onOffline();
    _.each(this.nodes$, (node: HomieNode) => {
      node.onOffline();
    });
  }

  /** MQTT client error handler */
  public onError = (err: Error) => {
    super.onError(err);
    _.each(this.nodes$, (node: HomieNode) => {
      node.onError(err);
    });
  }

  public onStatsInterval() {
    super.onStatsInterval();
    const uptime = (Date.now() - this.startTime$) / 1000;
    this.publishStats({
      interval: this.statsInterval$,
      uptime: _.round(uptime, 0),
    });
    _.each(this.nodes$, (node: HomieNode) => {
      node.onStatsInterval();
    });
  }

  private onMessage = (topic: string, msg: string | null) => {
    const parts = topic.split("/");
    const deviceTopic = parts.slice(2).join("/");
    // console.log(`received message: parts=${topic}, deviceTopic=${deviceTopic}`);

    // Emit broadcast messages to broadcast listeners
    if (parts[1] === "$broadcast") {
      this.emit("broadcast", deviceTopic, msg);
      return;
    }

    // Emit to listeners of all device topics
    this.emit("message", deviceTopic, msg);

    // Emit to listeners of the specific device topic
    this.emit(`message:${deviceTopic}`, msg);

    // Invoke property setters if this is a property set message
    if (parts[1] === this.name && parts[4] === "set") {
      let nodeName = parts[2];
      const propName = parts[3];
      const value = msg;
      const range = { isRange: false, index: 0 };

      if (nodeName.includes("_")) {
        range.isRange = true;
        const nodeParts = nodeName.split("_");
        nodeName = nodeParts[0];
        range.index = parseInt(nodeParts[1], 10);
      }
      const node = this.nodes$[nodeName];

      if (node && node.isRange === range.isRange) {
        const prop = node.getProperty(propName);
        if (!!prop) {
          prop.invokeSetter(range, value);
        }
      }
    }
  }
}
