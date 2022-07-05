import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { EnvySecurityPlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SecuritySystem {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private currentState = -1;
  public targetState = -1;

  constructor(
    private readonly platform: EnvySecurityPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)?.
      setCharacteristic(this.platform.Characteristic.Manufacturer, 'Envy')
      .setCharacteristic(this.platform.Characteristic.Model, 'Security System')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the SecuritySystem service if it exists, otherwise create a new SecuritySystem service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.SecuritySystem) ||
      this.accessory.addService(this.platform.Service.SecuritySystem);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/SecuritySystem

    // create handlers for required characteristics
    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
      .onGet(this.handleSecuritySystemCurrentStateGet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .onGet(this.handleSecuritySystemTargetStateGet.bind(this))
      .onSet(this.handleSecuritySystemTargetStateSet.bind(this));

  }

  /**
   * Handle requests to get the current value of the "Security System Current State" characteristic
   */
  handleSecuritySystemCurrentStateGet() : number {
    //this.accessory.context.device.log.debug('Triggered handleSecuritySystemCurrentStateGet:', this.currentState);

    // set this to a valid value for SecuritySystemCurrentState
    const currentValue = this.currentState;
    if (currentValue === -1) {
      return this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;
    }
    return currentValue;
  }


  /**
   * Handle requests to get the current value of the "Security System Target State" characteristic
   */
  handleSecuritySystemTargetStateGet() : number {
    //this.accessory.context.device.log.debug('Triggered handleSecuritySystemTargetStateGet:', this.targetState);

    // set this to a valid value for SecuritySystemTargetState
    const currentValue = this.targetState;
    if (currentValue === -1) {
      return this.platform.Characteristic.SecuritySystemTargetState.DISARM;
    }
    return currentValue;
  }

  /**
   * Handle requests to set the "Security System Target State" characteristic
   */
  handleSecuritySystemTargetStateSet(value: CharacteristicValue) : void {
    value = Number(value)
    //this.accessory.context.device.log.debug('Triggered handleSecuritySystemTargetStateSet:', value);
    //this.accessory.context.device.log.debug('Partition: ', this.getId());

    if (this.targetState !== value) {
      switch (value) {
        case this.platform.Characteristic.SecuritySystemCurrentState.DISARMED:
          this.platform.client.write('Security_system::SmartPin(PartitionNumber = ' + this.getId()
            + ', MacroName = Disarm, User = , UserCode = ' + this.getCode() + ', ZoneNumber = )\n');
          break;
        case this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM:
          this.platform.client.write('Security_system::SmartPin(PartitionNumber = ' + this.getId()
            + ', MacroName = ArmAway, User = , UserCode = ' + this.getCode() + ', ZoneNumber = )\n');
          break;
        case this.platform.Characteristic.SecuritySystemCurrentState.STAY_ARM:
          this.platform.client.write('Security_system::SmartPin(PartitionNumber = ' + this.getId()
            + ', MacroName = ArmStay, User = , UserCode = ' + this.getCode() + ', ZoneNumber = )\n');
          break;
      }
      this.targetState = value;
    }
  }

  setSecuritySystemCurrentState(state: number) : void {
    //this.platform.log.debug('Triggered setSecuritySystemCurrentState:', state);

    this.currentState = state;
    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState).setValue(state);
    if (this.targetState === -1) {
      this.targetState = state;
    }
  }

  setSecuritySystemTargetState(state : number) : void {
    //this.platform.log.debug('Triggered setSecuritySystemTargetState:', state);

    this.targetState = state;
    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState).setValue(state);
  }

  getId() : number {
    return this.accessory.context.device.id;
  }

  getCode() : string {
    return this.accessory.context.device.code;
  }
}
