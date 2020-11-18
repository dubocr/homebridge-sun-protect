import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";
import suncalc from 'suncalc';

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module (or the "hap-nodejs" module).
 * The above import block may seem like, that we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require("homebridge");` statement anywhere in the code.
 *
 * The contents of the above import statement MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require("homebridge");` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * like this for example and used to access all exported variables and classes from HAP-NodeJS.
 */
let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("SunProtect", SunProtect);
};

class SunProtect implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private active: boolean = false;
  private location: any;
  private readonly refreshDelay: number = 60 * 5;

  private readonly activeSwitchService: Service;
  private readonly triggers: any[] = [];
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;
    this.location = config.location;

    this.activeSwitchService = new hap.Service.Switch(this.name, 'Active');

    this.activeSwitchService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.active = value as boolean;
        callback();
        this.triggers.forEach((trigger) => trigger.triggered = undefined);
        this.compute();
      });

    let i = 1;
    for(const trigger of config.triggers) {
      trigger.service = new hap.Service.StatelessProgrammableSwitch(trigger.name, ""+i);
      trigger.service.getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent).setProps({minValue: 0, maxValue: 1});
      trigger.service.addOptionalCharacteristic(hap.Characteristic.ServiceLabelIndex);
      trigger.service.addOptionalCharacteristic(hap.Characteristic.Name);
      trigger.service.getCharacteristic(hap.Characteristic.ServiceLabelIndex).setValue(i++);
      trigger.service.getCharacteristic(hap.Characteristic.Name).setValue(trigger.name);
      this.triggers.push(trigger);
    }

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "github.com/dubocr")
      .setCharacteristic(hap.Characteristic.Model, "SunProtect");

    log.info("SunProtect initialized!");
  }

  /*
   * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
   * Typical this only ever happens at the pairing process.
   */
  identify(): void {
    this.log("Identify!");
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.activeSwitchService
    ].concat(this.triggers.map((t) => t.service));
  }

  compute(): void {
    if(!this.active) {
      return;
    }
    const now = new Date();
    suncalc.getPosition(now, this.location.lat, this.location.long);
    var position = suncalc.getPosition(now, this.location.lat, this.location.long);
    var altitude = position.altitude * 180 / Math.PI;
    var azimuth = (position.azimuth * 180 / Math.PI + 180) % 360;
    this.log.info('Altitude: ' + Math.round(altitude*100)/100 + ' - Azimuth: ' + Math.round(azimuth*100)/100);
    if(altitude < 0 && azimuth > 180) {
      // End of day, disable
      this.active = false;
      this.activeSwitchService.getCharacteristic(hap.Characteristic.On).updateValue(false);
    }
    this.triggers.forEach((trigger) => {
      let match = true;
      if(trigger.azimuthMin !== undefined) {
        match = match && azimuth > trigger.azimuthMin;
      }
      if(trigger.azimuthMax !== undefined) {
        match = match && azimuth > trigger.azimuthMax;
      }
      if(trigger.altitudeMin !== undefined) {
        match = match && altitude > trigger.altitudeMin;
      }
      if(trigger.altitudeMax !== undefined) {
        match = match && altitude > trigger.altitudeMax;
      }
      if(match) {
        this.log.info(trigger.name + ' match criterias');
        if(trigger.triggered !== true) {
          this.log.info('Start trigger ' + trigger.name);
          trigger.service.getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent).setValue(0);
          trigger.triggered = true;
        }
      } else {
        if(trigger.triggered !== false) {
          this.log.info('End trigger ' + trigger.name);
          trigger.service.getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent).setValue(1);
          trigger.triggered = false;
        }
      }
    });
    setTimeout(this.compute.bind(this), (this.refreshDelay * 1000));
  }
}
