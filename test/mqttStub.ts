import _ from 'lodash';
import { EventEmitter } from 'events';
import { IClientOptions, IClientPublishOptions } from 'mqtt';

export default class MQTTClientStub extends EventEmitter {
  private readonly publishedMsgs: {topic: string, msg: string, opts: IClientPublishOptions}[] = [];

  constructor(_opts: IClientOptions) {
    super();
    this.publishedMsgs = [];
  }

  static connect = (opts: IClientOptions) => {
    const client = new MQTTClientStub(opts);
    setTimeout(() => {
      client.emit('connect');
    }, 1);
    return client;
  }

  publish = (topic: string, msg: string, opts: IClientPublishOptions) => {
    this.publishedMsgs.push({ topic, msg, opts });
    setTimeout(() => {
      // Auto subscribe to all published messages
      this.emit('message', topic, msg);
    }, 1);
  }

  end = () => this.emit('close');

  getPublishedMsg = (topic: string) => _.filter(this.publishedMsgs, { topic });

  subscribe = (_topic: string) => { }

  simulateMessage = (topic: string, message: string) => {
    this.emit('message', topic, message);
  }
};

