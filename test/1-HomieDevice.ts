import { expect } from "chai";
import * as faker from "faker";
import _ from "lodash";
import * as _mocha from "mocha";
import { IClientOptions, MqttClient } from "mqtt";
import HomieDevice, { DefaultConfiguration, IHomieDeviceConfiguration } from "../src/HomieDevice";
import MqttStub from "./mqttStub";

export const makeDeviceConfig = (config?: IHomieDeviceConfiguration) => {
  return _.merge({}, DefaultConfiguration, {
    firmwareName: faker.system.fileName(),
    firmwareVersion: faker.system.semver(),
    friendlyName: faker.internet.userName(),
    mqtt: {
      connectionFactory: MqttStub.connect,
    },
    name: faker.internet.domainWord(),
  } as unknown as IHomieDeviceConfiguration,
    config);
};

export interface IHomieDeviceTest {
  device: HomieDevice;
  deviceConfig: IHomieDeviceConfiguration;
  mqtt: MqttStub;
}

export const makeDevice = (config?: IHomieDeviceConfiguration): IHomieDeviceTest => {
  let mqttStub: MqttStub | undefined;
  config = makeDeviceConfig(_.merge(config, {
    mqtt: {
      connectionFactory: () => {
        mqttStub = MqttStub.connect({} as IClientOptions);
        return mqttStub as unknown as MqttClient;
      },
    },
  }));
  return {
    device: new HomieDevice(config),
    deviceConfig: config,
    get mqtt() {
      if (mqttStub === undefined) {
        throw new Error("MQTT client mock has not been created. Did you forget to call device.setup()?");
      }
      return mqttStub;
    },
  };
};

describe("Homie Device", () => {

  describe("Instantiation", () => {

    it("creates using new HomieDevice(string)", () => {
      const name = faker.internet.domainWord();
      const testDevice = new HomieDevice(name);
      expect(testDevice).to.be.an.instanceOf(HomieDevice);
      expect(testDevice).to.have.property("config").to.have.property("name").equal(name);
      expect(testDevice).to.have.property("name").equal(`${name}`); // also verifies inheritance from default configuration
    });

    it("creates using new HomieDevice(IHomieDeviceConfiguration)", () => {
      const config = makeDeviceConfig();
      const testDevice = new HomieDevice(config);
      expect(testDevice).to.be.an.instanceOf(HomieDevice);
      expect(testDevice).to.have.property("name").equal(config.name); // also verifies inheritance from default configuration
      expect(testDevice).to.have.property("config").that.deep.equal(config);
    });
  });

  describe("Publish / Subscribe", () => {

    let test: IHomieDeviceTest;
    beforeEach(() => {
      test = makeDevice();
    });
    afterEach(() => {
      if (test.device.isConnected) {
        test.device.end();
      }
    });

    it("emits all device messages as 'message' events", (done) => {
      let numMsgs = 0;
      // tslint:disable-next-line:variable-name
      test.device.on("message", (topic: string, _msg: string) => {
        // tslint:disable-next-line:no-unused-expression
        expect(topic).to.not.be.null;
        if (++numMsgs === 6) {
          test.device.end();
          done();
        }
      });
      test.device.setup();
    });

    it("can subscribe to a sub-topic individually", (done) => {
      test.device.on("message:$name", (msg: string) => {
        expect(msg).to.equal(test.device.friendlyName);
        done();
      });
      test.device.setup();
    });

  });

  describe("Broadcast messages", () => {

    let test: IHomieDeviceTest;
    beforeEach(() => {
      test = makeDevice();
    });
    afterEach(() => {
      if (test.device.isConnected) {
        test.device.end();
      }
    });

    const time = `${Date.now()}`;
    it("emits the 'broadcast' event on device/$broadcast/... messages", (done) => {
      test.device.on("broadcast", (topic: string, msg: string) => {
        if (topic !== "longtime") { return; }
        expect(topic).to.equal("longtime");
        expect(msg).to.equal(time);
        test.device.end();
        done();
      });
      test.device.setup();

      // Simulate an out-of-band publish
      setTimeout(() => {
        test.mqtt.simulateMessage("homie/$broadcast/longtime", time);
      }, 50);
    });

  });

});
