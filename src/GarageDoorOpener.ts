import { Service, PlatformAccessory } from 'homebridge';

import { EnvySecurityPlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class GarageDoorOpener {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private currentDoorState = this.platform.Characteristic.CurrentDoorState.CLOSED;
  private targetDoorState = this.platform.Characteristic.TargetDoorState.CLOSED;
  private obstructionDetected = false;

  private zoneState = false;
  private outputState = false;

  private waiting = false;
  private timeout;


  constructor(
    private readonly platform: EnvySecurityPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Envy')
      .setCharacteristic(this.platform.Characteristic.Model, 'Garage Door Opener')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the Garage Door Opener service if it exists, otherwise create a new Garage Door Opener service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.GarageDoorOpener) ||
      this.accessory.addService(this.platform.Service.GarageDoorOpener);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/GarageDoorOpener

    // create handlers for required characteristics
    this.service.getCharacteristic(this.platform.Characteristic.CurrentDoorState)
      .onGet(this.handleCurrentDoorStateGet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetDoorState)
      .onGet(this.handleTargetDoorStateGet.bind(this))
      .onSet(this.handleTargetDoorStateSet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.ObstructionDetected)
      .onGet(this.handleObstructionDetectedGet.bind(this));

  }

  /**
     * Handle requests to get the current value of the "Current Door State" characteristic
     */
  handleCurrentDoorStateGet() {
    //this.accessory.context.device.log.debug('handleCurrentDoorStateGet:', this.currentDoorState);

    // set this to a valid value for CurrentDoorState
    return this.currentDoorState;
  }

  /**
   * Handle requests to get the current value of the "Target Door State" characteristic
   */
  handleTargetDoorStateGet() {
    //this.accessory.context.device.log.debug('handleTargetDoorStateGet:', this.targetDoorState);

    // set this to a valid value for TargetDoorState
    return this.targetDoorState;
  }

  /**
   * Handle requests to set the "Target Door State" characteristic
   */
  handleTargetDoorStateSet(value) {
    //this.accessory.context.device.log.debug('handleTargetDoorStatSet:', value);
    //this.accessory.context.device.log.debug('Zone:', this.accessory.context.device.zone);

    if (this.targetDoorState !== value) {
      this.targetDoorState = value;
      //this.accessory.context.device.log.debug('Target: ', this.accessory.context.device.target);
      let target;
      if (this.accessory.context.device.target !== undefined) {
        if (this.accessory.context.device.target === 0) {
          target = 1;
        }
        if (this.accessory.context.device.target === 100) {
          target = 0;
        }
      }
      //this.accessory.context.device.log.debug('Duration: ', this.accessory.context.device.duration);
      const duration = this.accessory.context.device.duration;
      if (((target === undefined) && (duration === undefined) && (value === 0)) || this.waiting) {
        if (this.waiting === true) {
          clearTimeout(this.timeout);
          this.waiting = false;
        }
        this.platform.client.write('Security_system::OutputOff(OutputNumber = ' + this.getId() + ')\n');
        if (target !== undefined && (1 - target) !== this.targetDoorState) {
          this.targetDoorState = (1 - target);
          this.service.getCharacteristic(this.platform.Characteristic.TargetDoorState).setValue(1 - target);
        }
      } else if (((target === undefined) && (duration === undefined) && (value === 100)) || !this.waiting) {
        for (const output in this.platform.zone_outputs[this.accessory.context.device.zone]) {
          if (Number(output) !== this.getId()) {
            this.platform.outputs[output].abort();
          }
        }
        this.platform.client.write('Security_system::OutputOn(OutputNumber = ' + this.getId() + ')\n');
        if (target !== undefined && target !== this.targetDoorState) {
          this.targetDoorState = target;
          this.service.getCharacteristic(this.platform.Characteristic.TargetDoorState).setValue(target);
        }
        if (duration !== undefined) {
          this.waiting = true;
          this.timeout = setTimeout(() => this.stopWaiting(this), duration * 1000);
        }
      }
      this.doUpdate();
    }
  }

  /**
  * Handle requests to get the current value of the "Obstruction Detected" characteristic
  */
  handleObstructionDetectedGet() {
    //this.accessory.context.device.log.debug('handleObstructionDetectedGet:', this.obstructionDetected);

    // set this to a valid value for ObstructionDetected
    return this.obstructionDetected;
  }

  stopWaiting(_this: this) {
    //_this.platform.log.info(this.getId() +' - stopWaiting');
    _this.waiting = false;
    _this.doUpdate();
  }

  setZoneState(state: boolean) {
    //this.platform.log.info(this.getId() +' - setZoneState:', state);
    if (state !== this.zoneState) {
      this.zoneState = state;
      this.doUpdate();
    }
  }

  setOutputState(state: boolean) {
    //this.platform.log.info(this.getId() +' - setOutputState:', state);
    if (state !== this.outputState) {
      this.outputState = state;
      if ((this.accessory.context.device.zone === undefined) || (this.accessory.context.device.zone === 0)) {
        this.zoneState = state;
      }
      this.doUpdate();
    }
  }

  abort() {
    if (this.waiting === true) {
      clearTimeout(this.timeout);
      this.waiting = false;
    }
    this.platform.client.write('Security_system::OutputOff(OutputNumber = ' + this.getId() + ')\n');
  }

  doUpdate() {
    //this.platform.log.info(this.getId() +' - doUpdate: ' + (this.waiting ? '' : '!') + 'waiting');
    let current;
    let target;

    if (this.waiting) {
      current = this.targetDoorState + 2;
      target = this.targetDoorState;
    } else {
      //this.accessory.context.device.log.info('Duration: ', this.accessory.context.device.duration);
      //this.platform.log.info('zoneState:', this.zoneState);
      //this.platform.log.info('outputState:', this.outputState);
      if (this.accessory.context.device.duration === undefined) {
        current = this.zoneState ? (this.outputState ? 0 : 3) : (this.outputState ? 2 : 1);
        target = this.outputState ? 0 : 1;
      } else {
        current = this.zoneState ? 0 : 1;
        target = current;
      }
    }
    //this.platform.log.info('current:', current);
    //this.platform.log.info('target:', target);

    if (current !== this.currentDoorState) {
      this.currentDoorState = current;
      this.service.getCharacteristic(this.platform.Characteristic.CurrentDoorState).setValue(current);
    }
    if (target !== this.targetDoorState) {
      this.targetDoorState = target;
      this.service.getCharacteristic(this.platform.Characteristic.TargetDoorState).setValue(target);
    }
  }

  getId() {
    return this.accessory.context.device.id;
  }
}
