import { fail } from "assert";
import { expect } from "chai";
import _ from "lodash";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as _mocha from "mocha";
import { HomieTopologyWithConfiguration, IHomieTopologyConfiguration } from "../src/framework";
import HomieDevice from "../src/HomieDevice";
import HomieNode from "../src/HomieNode";
import HomieProperty, { PropertyDataType } from "../src/HomieProperty";
import { makeDevice } from "./1-HomieDevice";
import { makeNodeConfig } from "./2-HomieNode";
import { makePropertyConfig } from "./3-HomieProperty";

function EvaluateType<T extends HomieTopologyWithConfiguration<IHomieTopologyConfiguration>>(
  deviceToTMethod: (device: HomieDevice) => T,
  attributesToValidate: Array<{
    /** the name of the unit test */
    testName: string,
    scope: string,
    path: string,
    configPath?: string,
    value?: string | null,
  }>,
) {
  const test = makeDevice();
  const testType = deviceToTMethod(test.device);
  const messagesReceived: Array<{ scope: string, topic: string, msg: string }> = [];
  test.device.on("message", (topic: string, msg: string) => {
    messagesReceived.push({
      msg,
      scope: HomieDevice.name,
      topic,
    });
  });

  describe(`MQTT Connection Handling for ${testType.constructor.name}`, () => {
    it("Correctly reports isConnected=false before connection", (done) => {
      expect(testType.isConnected).to.equal(false);
      done();
    });

    it("emits the connect message on setup()", (done) => {
      testType.on("connect", () => {
        done();
      });
      test.device.setup();
    });

    it("Correctly reports isConnected=true after connection", (done) => {
      expect(testType.isConnected).to.equal(true);
      done();
    });

    it("emits the disconnect message on end()", (done) => {
      testType.on("disconnect", () => {
        done();
      });
      test.device.end();
    });

    it("Correctly reports isConnected=false upon disconnect", (done) => {
      expect(testType.isConnected).to.equal(false);
      done();
    });

    attributesToValidate.forEach((attr) => {
      it(`Correctly reports attribute ${attr.testName} (scope: ${attr.scope})`, () => {
        if (attr.configPath !== undefined) {
          let obj: unknown;
          if (attr.scope === testType.constructor.name) {
            obj = testType.config;
          } else {
            obj = test.deviceConfig;
          }
          attr.value = _.get(obj, attr.configPath);
        }

        const matches = messagesReceived.filter((msg) => msg.scope === attr.scope && msg.topic === attr.path);
        expect(matches.length).to.equal(1,
          "Failed to find a maching mesage. Available messages:\n"
          + (messagesReceived.map((m) => `\t * ${m.scope}->${m.topic}: ${m.msg}`).join("\n")) || "none");
        const match = matches[0];
        if (attr.value !== undefined) {
          expect(match.msg).to.equal(attr.value);
        } else {
          fail(`No value found for attribute ${attr.path} (scope: ${attr.scope})`);
        }
      });
    });
  });
}

EvaluateType<HomieDevice>(
  (d) => d,
  [
    { scope: HomieDevice.name, testName: "$name", path: "$name", configPath: "friendlyName" },
    { scope: HomieDevice.name, testName: "$nodes", path: "$nodes", value: null },
  ]);

const nodeConfig = makeNodeConfig();
EvaluateType<HomieNode>(
  (d) => d.node(nodeConfig),
  [
    { scope: HomieDevice.name, testName: "$nodes", path: "$nodes", value: nodeConfig.name },
    { scope: HomieDevice.name, testName: "node/$name", path: `${nodeConfig.name}/$name`, value: nodeConfig.friendlyName },
    { scope: HomieDevice.name, testName: "node/$type", path: `${nodeConfig.name}/$type`, value: nodeConfig.type },
    { scope: HomieDevice.name, testName: "node/$properties", path: `${nodeConfig.name}/$properties`, value: null },
  ]);

const propertyConfig = makePropertyConfig();
EvaluateType<HomieProperty>(
  (d) => d.node(nodeConfig).addProperty(propertyConfig),
  [
    {
      path: `${nodeConfig.name}/$properties`,
      scope: HomieDevice.name,
      testName: "node/$properties",
      value: propertyConfig.name,
    },
    {
      path: `${nodeConfig.name}/${propertyConfig.name}/$name`,
      scope: HomieDevice.name,
      testName: "node/property/$name",
      value: propertyConfig.friendlyName,
    },
    {
      path: `${nodeConfig.name}/${propertyConfig.name}/$datatype`,
      scope: HomieDevice.name,
      testName: "node/property/$datatype",
      value: (typeof propertyConfig.dataType === "string" ? propertyConfig.dataType : PropertyDataType[propertyConfig.dataType]),
    },
    {
      path: `${nodeConfig.name}/${propertyConfig.name}/$format`,
      scope: HomieDevice.name,
      testName: "node/property/$format",
      value: propertyConfig.format,
    },
    {
      path: `${nodeConfig.name}/${propertyConfig.name}/$unit`,
      scope: HomieDevice.name,
      testName: "node/property/$unit",
      value: propertyConfig.unit,
    },
    {
      path: `${nodeConfig.name}/${propertyConfig.name}/$retained`,
      scope: HomieDevice.name,
      testName: "node/property/$retained",
      value: propertyConfig.retained.toString(),
    },
    {
      path: `${nodeConfig.name}/${propertyConfig.name}/$settable`,
      scope: HomieDevice.name,
      testName: "node/property/$settable",
      value: propertyConfig.settable.toString(),
    },
  ],
);
