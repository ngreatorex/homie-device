import { EventEmitter } from "events";
import _ from "lodash";
import { IClientOptions, IClientPublishOptions } from "mqtt";

export type PublishedMessage = {
  topic: string,
  msg: string,
  opts: IClientPublishOptions
};

export default class MQTTClientStub extends EventEmitter {

  public readonly clientOptions: IClientOptions;

  public static connect = (opts: IClientOptions): MQTTClientStub => {
    const client = new MQTTClientStub(opts);
    setTimeout(() => {
      client.emit("connect");
    }, 1);
    return client;
  }
  private readonly publishedMsgs: Array<PublishedMessage> = [];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_opts: IClientOptions) {
    super();
    this.clientOptions = _opts;
    this.publishedMsgs = [];
  }

  public publish = (topic: string, msg: string, opts: IClientPublishOptions): void => {
    this.publishedMsgs.push({ topic, msg, opts });
    setTimeout(() => {
      // Auto subscribe to all published messages
      this.emit("message", topic, msg);
    }, 1);
  }

  public end = (): void => {
    this.emit("close");
  }

  public getPublishedMsg = (topic: string): Array<PublishedMessage> => _.filter(this.publishedMsgs, { topic });

  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  public subscribe = (_topic: string): void => { };

  public simulateMessage = (topic: string, message: string): void => {
    this.emit("message", topic, message);
  }
}
