import { expect } from "chai";
import * as faker from "faker";
import * as _ from "lodash";
import { IHomieDeviceConfiguration } from "../src/HomieDevice";
import HomieNode, { DefaultConfiguration as DefaultNodeConfiguration, IHomieNodeConfiguration } from "../src/HomieNode";
import { PropertyDataType } from "../src/HomieProperty";
import { IHomieDeviceTest, makeDevice } from "./1-HomieDevice";

export const makeNodeConfig = (config?: IHomieNodeConfiguration): IHomieNodeConfiguration => {
  return _.merge({}, DefaultNodeConfiguration, {
    friendlyName: faker.internet.domainWord(),
    name: faker.internet.domainWord(),
    type: faker.internet.domainWord(),
  }, config);
};

export interface IHomieNodeTest extends IHomieDeviceTest {
  node: HomieNode;
  nodeConfig: IHomieNodeConfiguration;
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
      if (test.device.isConnected) {
        test.device.end();
      }
    });

    it("publishes the node name on connect", (done) => {
      test = makeNode();
      test.device.on(`message:${test.nodeConfig.name}/$name`, (msg) => {
        expect(msg).to.equal(test.nodeConfig.friendlyName);
        test.device.end();
        done();
      });
      test.device.setup();
    });

    it("publishes the node list on connect", (done) => {
      test = makeNode();
      test.device.on("message:$nodes", (msg) => {
        expect(msg).to.equal(test.nodeConfig.name);
        test.device.end();
        done();
      });
      test.device.setup();
    });

    it("publishes the node array on connect", (done) => {
      test = makeNode({
        nodeConfig: { startRange: 0, endRange: 100, isRange: true } as unknown as IHomieNodeConfiguration,
      });
      test.device.on(`message:${test.nodeConfig.name}/$array`, (msg) => {
        expect(msg).to.equal("0-100");
        test.device.end();
        done();
      });
      test.device.setup();
    });

    it("publishes the node list with array syntax on connect", (done) => {
      test = makeNode({
        nodeConfig: { startRange: 0, endRange: 1, isRange: true } as unknown as IHomieNodeConfiguration,
      });
      test.device.on("message:$nodes", (msg) => {
        expect(msg).to.equal(`${test.nodeConfig.name}[]`);
        test.device.end();
        done();
      });
      test.device.setup();
    });

    it("publishes node stats at a determined interval", (done) => {
      test = makeNode({
        deviceConfig: {
          statsInterval: 0.1,
        } as unknown as IHomieDeviceConfiguration
      });
      let numMsgs = 0;
      test.node.on("stats-interval", () => {
        if (++numMsgs === 3) {
          test.device.end();
          done();
        }
      });
      test.device.setup();
    });

    it("publish with index for non-indexed property", () => {
      test = makeNode({
        nodeConfig: { isRange: false } as unknown as IHomieNodeConfiguration,
      });
      const property = test.node.addProperty({
        name: "test",
        friendlyName: "test",
        dataType: PropertyDataType.string,
        settable: true,
        retained: true,
      });
      test.device.setup();
      expect(() => test.node.publishPropertyValue(property, "123", 10)).to.throw;
    });

    it("publish with index for indexed property", () => {
      test = makeNode({
        nodeConfig: { isRange: true, startRange: 0, endRange: 10 } as unknown as IHomieNodeConfiguration,
      });
      const property = test.node.addProperty({
        name: "test",
        friendlyName: "test",
        dataType: PropertyDataType.string,
        settable: true,
        retained: true,
      });
      test.device.setup();
      expect(() => test.node.publishPropertyValue(property, "123", 10)).to.not.throw;
      expect(() => test.node.publishPropertyValue(property, "123", 0)).to.not.throw;
      expect(() => test.node.publishPropertyValue(property, "123", -1)).to.throw;
      expect(() => test.node.publishPropertyValue(property, "123", 11)).to.throw;
    });
  });
});
