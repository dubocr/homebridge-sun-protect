import {
    AccessoryConfig,
    AccessoryPlugin,
    API,
    Characteristic,
    CharacteristicValue,
    Formats,
    HAP,
    Logging,
    Perms,
    Service,
    Units,
    WithUUID,
} from 'homebridge';
import suncalc from 'suncalc';

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly 
 * from the "homebridge" module (or the "hap-nodejs" module).
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
let AltitudeCharacteristic: WithUUID<{ new(): Characteristic }>;
let AzimuthCharacteristic: WithUUID<{ new(): Characteristic }>;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
    hap = api.hap;

    AltitudeCharacteristic = class extends hap.Characteristic {

        public static readonly UUID: string = 'a8af30e7-5c8e-43bf-bb21-3c1343229260';

        constructor() {
            super('Altitude', AltitudeCharacteristic.UUID, {
                format: Formats.FLOAT,
                unit: Units.ARC_DEGREE,
                minValue: -90,
                maxValue: 90,
                minStep: 0.1,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
            });
            this.value = this.getDefaultValue();
        }
    };

    AzimuthCharacteristic = class extends hap.Characteristic {

        public static readonly UUID: string = 'ace1dd10-2e46-4100-a74a-cc77f13f1bab';

        constructor() {
            super('Azimuth', AzimuthCharacteristic.UUID, {
                format: Formats.FLOAT,
                unit: Units.ARC_DEGREE,
                minValue: 0,
                maxValue: 360,
                minStep: 0.1,
                perms: [Perms.PAIRED_READ, Perms.NOTIFY],
            });
            this.value = this.getDefaultValue();
        }
    };

    api.registerAccessory('SunProtect', SunProtect);
};

interface Location {
    lat: number,
    long: number,
}

interface Trigger {
    name: string,
    azimuthMin: number,
    azimuthMax: number,
    altitudeMin: number,
    altitudeMax: number,
    triggered: boolean | undefined,
    switch: Characteristic,
}

const TRIGGER_ON = 0;
const TRIGGER_OFF = 1;

class SunProtect implements AccessoryPlugin {
    private readonly log: Logging;
    private readonly name: string;
    private location: Location;

    private readonly refreshDelay: number = 60 * 1;

    private readonly active: Characteristic;
    private readonly altitude: Characteristic;
    private readonly azimuth: Characteristic;

    private readonly triggers: Array<Trigger> = [];
    private readonly services: Array<Service> = [];

    constructor(log: Logging, config: AccessoryConfig) {
        this.log = log;
        this.name = config.name;
        this.location = config.location;

        const activeService = new hap.Service.Switch(this.name);
        this.altitude = activeService.addCharacteristic(AltitudeCharacteristic);
        this.azimuth = activeService.addCharacteristic(AzimuthCharacteristic);
        this.active = activeService.getCharacteristic(hap.Characteristic.On);

        this.active.onSet(this.onActivate.bind(this));
        this.services.push(activeService);

        let i = 1;
        for (const trigger of config.triggers) {
            const triggerService = new hap.Service.StatelessProgrammableSwitch(trigger.name, '' + i);
            triggerService.addOptionalCharacteristic(hap.Characteristic.ServiceLabelIndex);
            triggerService.addOptionalCharacteristic(hap.Characteristic.Name);
            triggerService.getCharacteristic(hap.Characteristic.ServiceLabelIndex).setValue(i++);
            triggerService.getCharacteristic(hap.Characteristic.Name).setValue(trigger.name);

            trigger.switch = triggerService.getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent);
            trigger.switch.setProps({ minValue: 0, maxValue: 1 });
            trigger.switch.value = TRIGGER_OFF;

            this.triggers.push(trigger);
            this.services.push(triggerService);
        }

        const informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, 'github.com/dubocr')
            .setCharacteristic(hap.Characteristic.Model, 'SunProtect');
        this.services.push(informationService);

        setInterval(() => this.compute(this.active.value as boolean), (this.refreshDelay * 1000));
        this.compute(false);

        log.info('SunProtect initialized!');
    }

    private onActivate(value: CharacteristicValue) {
        if (value) {
            this.compute(value as boolean);
        } else {
            this.triggers.forEach((trigger) => trigger.switch.updateValue(TRIGGER_OFF));
        }
    }

    /*
     * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
     * Typical this only ever happens at the pairing process.
     */
    identify(): void {
        this.log('Identify!');
    }

    /*
     * This method is called directly after creation of this instance.
     * It should return all services which should be added to the accessory.
     */
    getServices(): Service[] {
        return this.services;
    }

    compute(active: boolean): void {
        const now = new Date();
        suncalc.getPosition(now, this.location.lat, this.location.long);
        const position = suncalc.getPosition(now, this.location.lat, this.location.long);
        const altitude = position.altitude * 180 / Math.PI;
        const azimuth = (position.azimuth * 180 / Math.PI + 180) % 360;
        this.altitude.updateValue(altitude);
        this.azimuth.updateValue(azimuth);

        if (!active) {
            return;
        }

        this.log.debug('Altitude: ' + Math.round(altitude * 100) / 100 + ' - Azimuth: ' + Math.round(azimuth * 100) / 100);
        if (altitude < 0 && azimuth > 180) {
            // End of day, disable
            this.active.updateValue(false);
            this.triggers.forEach((trigger) => trigger.switch.value = TRIGGER_OFF);
        }
        this.triggers.forEach((trigger) => {
            let match = true;
            if (trigger.azimuthMin !== undefined) {
                match = match && azimuth > trigger.azimuthMin;
            }
            if (trigger.azimuthMax !== undefined) {
                match = match && azimuth < trigger.azimuthMax;
            }
            if (trigger.altitudeMin !== undefined) {
                match = match && altitude > trigger.altitudeMin;
            }
            if (trigger.altitudeMax !== undefined) {
                match = match && altitude < trigger.altitudeMax;
            }
            if (match) {
                this.log.debug(trigger.name + ' match criterias');
                if (trigger.switch.value !== TRIGGER_ON) {
                    this.log.info('Start trigger ' + trigger.name);
                    trigger.switch.setValue(TRIGGER_ON);
                }
            } else {
                if (trigger.switch.value !== TRIGGER_OFF) {
                    this.log.info('End trigger ' + trigger.name);
                    trigger.switch.setValue(TRIGGER_OFF);
                }
            }
        });
    }
}