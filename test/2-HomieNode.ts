import { expect } from "chai";
import HomieNode, { IHomieNodeConfiguration, DefaultConfiguration as DefaultNodeConfiguration } from '../src/HomieNode';
import { IHomieDeviceConfiguration } from "../src/HomieDevice";
import * as faker from "faker";
import * as _ from "lodash";
import { makeDevice, IHomieDeviceTest } from "./1-HomieDevice";

export const makeNodeConfig = (config?: IHomieNodeConfiguration) => {
  return _.merge({}, DefaultNodeConfiguration, {
    name: faker.internet.domainWord(),
    friendlyName: faker.internet.domainWord(),
    type: faker.internet.domainWord(),
  }, config);
}

export interface IHomieNodeTest extends IHomieDeviceTest {
  node: HomieNode,
  nodeConfig: IHomieNodeConfiguration
}

export const makeNode = (args: {
  deviceConfig?: IHomieDeviceConfiguration,
  nodeConfig?: IHomieNodeConfiguration,
} = {}): IHomieNodeTest => {
  const testDevice = makeDevice(args.deviceConfig) as IHomieNodeTest;
  const nodeConfig = makeNodeConfig(args.nodeConfig);
  testDevice.node = testDevice.device.node(nodeConfig);
  testDevice.nodeConfig = nodeConfig;
  return testDevice;
};

describe("Homie Node", () => {

  describe("Instantiation", () => {
    const test = makeNode();
    it("creates a class of type HomieNode", () => {
      expect(test.node).to.be.an.instanceOf(HomieNode);
    });
    it("constructor arguments are correct", () => {
      expect(test.node.friendlyName).to.equal(test.nodeConfig.friendlyName);
      expect(test.node.name).to.equal(test.nodeConfig.name);
      expect(test.node.type).to.equal(test.nodeConfig.type);
      expect(test.node.config).to.deep.equal(test.nodeConfig);
    });

  });

  describe("Publications", () => {

    let test: IHomieNodeTest;
    afterEach(() => {
      if (test.device.isConnected)
        test.device.end();
    });

    it("publishes the node name on connect", done => {
      test = makeNode();
      test.device.on(`message:${test.nodeConfig.name}/$name`, msg => {
        expect(msg).to.equal(test.nodeConfig.friendlyName);
        test.device.end();
        done();
      });
      test.device.setup();
    });

    it("publishes the node list on connect", done => {
      test = makeNode();
      test.device.on('message:$nodes', msg => {
        expect(msg).to.equal(test.nodeConfig.name);
        test.device.end();
        done();
      });
      test.device.setup();
    });

    it("publishes the node array on connect", done => {
      test = makeNode({
        nodeConfig: { startRange: 0, endRange: 100, isRange: true } as unknown as IHomieNodeConfiguration
      });
      test.device.on(`message:${test.nodeConfig.name}/$array`, msg => {
        expect(msg).to.equal('0-100');
        test.device.end();
        done();
      });
      test.device.setup();
    });

    it("publishes the node list with array syntax on connect", done => {
      test = makeNode({
        nodeConfig: { startRange: 0, endRange: 1, isRange: true } as unknown as IHomieNodeConfiguration
      });
      test.device.on('message:$nodes', msg => {
        expect(msg).to.equal(`${test.nodeConfig.name}[]`);
        test.device.end();
        done();
      });
      test.device.setup();
    });

    it("publishes node stats at a determined interval", done => {
      test = makeNode({ deviceConfig: {
        statsInterval: 0.1
      } as unknown as IHomieDeviceConfiguration});
      let numMsgs = 0;
      test.node.on('stats-interval', () => {
        if (++numMsgs == 3) {
          test.device.end();
          done();
        }
      });
      test.device.setup();
    });

  });
});
