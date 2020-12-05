import { EventEmitter } from "events";
import _ from "lodash";
import { IClientOptions, IClientPublishOptions } from "mqtt";

export default class MQTTClientStub extends EventEmitter {

  public static connect = (opts: IClientOptions) => {
    const client = new MQTTClientStub(opts);
    setTimeout(() => {
      client.emit("connect");
    }, 1);
    return client;
  }
  private readonly publishedMsgs: Array<{topic: string, msg: string, opts: IClientPublishOptions}> = [];

  // tslint:disable-next-line:variable-name
  constructor(_opts: IClientOptions) {
    super();
    this.publishedMsgs = [];
  }

  public publish = (topic: string, msg: string, opts: IClientPublishOptions) => {
    this.publishedMsgs.push({ topic, msg, opts });
    setTimeout(() => {
      // Auto subscribe to all published messages
      this.emit("message", topic, msg);
    }, 1);
  }

  public end = () => this.emit("close");

  public getPublishedMsg = (topic: string) => _.filter(this.publishedMsgs, { topic });

  public subscribe = (_topic: string) => { };

  public simulateMessage = (topic: string, message: string) => {
    this.emit("message", topic, message);
  }
}
