import HomieTopologyBase from "./HomieTopologyBase";
import IHomieTopologyConfiguration from "./IHomieTopologyConfiguration";

export default abstract class HomieTopologyWithConfiguration<TConfiguration extends IHomieTopologyConfiguration> extends HomieTopologyBase {

  private config$: TConfiguration;
  private configurable$ = true;

  constructor(config: TConfiguration) {
    super(config.name, config.friendlyName);
    this.config$ = config;
  }

  public get config(): TConfiguration { return this.config$; }

  public onConnect = (): void => {
    this.configurable$ = false;
    super.onConnect();
    if (!Object.isFrozen(this.config$)) {
      this.logger.debug("freezing configuration");
      this.config$ = Object.freeze(this.config$);
    }
  }

  /**
   * Asserts that the configurabion is mutable. This assertion will fail after a connection has been
   * established to the MQTT server
   */
  protected assertConfigurable(): void {
    if (!this.configurable$) {
      throw new Error(
        // tslint:disable-next-line:max-line-length
        `This ${this.constructor.name} is no longer configurable. All configuration must occur prior to connecting.`);
    }
  }
}
