import * as _mocha from "mocha";
import { expect } from "chai";
import HomieDevice, { IHomieDeviceConfiguration, DefaultConfiguration } from '../src/HomieDevice';
import MqttStub from './mqttStub';
import * as faker from "faker";
import { IClientOptions, MqttClient } from "mqtt";
import _ from "lodash";

export const makeDeviceConfig = (config?: IHomieDeviceConfiguration) => {
  return _.merge({}, DefaultConfiguration, {
    name: faker.internet.domainWord(),
    friendlyName: faker.internet.userName(),
    firmwareVersion: faker.system.semver(),
    firmwareName: faker.system.fileName(),
    mqtt: {
      connectionFactory: MqttStub.connect,
    },
  } as unknown as IHomieDeviceConfiguration,
    config);
}

export interface IHomieDeviceTest {
  device: HomieDevice,
  deviceConfig: IHomieDeviceConfiguration,
  mqtt: MqttStub,
}

export const makeDevice = (config?: IHomieDeviceConfiguration): IHomieDeviceTest => {
  let mqttStub: MqttStub | undefined = undefined;
  config = makeDeviceConfig(_.merge(config, {
    mqtt: {
      connectionFactory: () => {
        mqttStub = MqttStub.connect({} as IClientOptions);
        return mqttStub as unknown as MqttClient
      }
    }
  }));
  return {
    device: new HomieDevice(config),
    deviceConfig: config,
    get mqtt() {
      if (mqttStub == undefined) {
        throw new Error("MQTT client mock has not been created. Did you forget to call device.setup()?");
      }
      return mqttStub;
    }
  };
}

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
      const testDevice = new HomieDevice(config)
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
      if (test.device.isConnected)
        test.device.end();
    });

    it("emits all device messages as 'message' events", done => {
      let numMsgs = 0;
      test.device.on('message', (topic: string, _msg: string) => {
        expect(topic).to.not.be.null;
        if (++numMsgs == 6) {
          test.device.end();
          done();
        }
      });
      test.device.setup();
    });

    it("can subscribe to a sub-topic individually", done => {
      test.device.on('message:$name', (msg: string) => {
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
      if (test.device.isConnected)
        test.device.end();
    });

    const time = `${Date.now()}`;
    it("emits the 'broadcast' event on device/$broadcast/... messages", done => {
      test.device.on('broadcast', (topic: string, msg: string) => {
        if (topic != 'longtime') { return; }
        expect(topic).to.equal('longtime');
        expect(msg).to.equal(time);
        test.device.end();
        done();
      });
      test.device.setup();

      // Simulate an out-of-band publish
      setTimeout(() => {
        test.mqtt.simulateMessage('homie/$broadcast/longtime', time);
      }, 50);
    });

  });

});
