# homebridge-sun-protect

This plugin offer simple Homekit accessory to configure shades automations depending on sun position.

# Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-sun-protect`
3. Update your configuration file. See bellow for a sample.

# Configuration

1. Configure your lat/long coordinate
2. Create plugin config with name, azimuthMin, azimuthMax, altitudeMin, altitudeMax for each trigger (generally one by shade orientation)
3. Configure your shade closure in Homekit

Plugin will add 2 accessories : one switch to enable triggers and stateless buttons used to configure automation.

Activate the switch when wether is sunny (with luminosity sensor for eg.) and when you are wake-up (with motion sensor for eg.).
The switch automatically move to 'off' when sun sets.

Configure the stateless button as following:
There is one button by rule configured in plugin config.
- 1 press button is triggered when condition starts (sun present)
- 2 press button is triggered when condition stops (sun absent)

When main switch is switched on, if a rule match it will be triggered.

`resetOnActivation` could be set to false to avoid reseting all trigger at activation

Full configuration example:
```
{
	"bridge": {
		...
	},

	"description": "...",

	"accessories": [
        {
            "accessory": "SunProtect",
            "name": "Sun",
            "location": {
                "lat": 46.123456,
                "long": -1.123456
            },
            "resetOnActivation": false,
            "triggers": [
                {
                    "name": "1st floor - South East",
                    "azimuthMin": 80,
                    "azimuthMax": 240,
                    "altitudeMin": 0
                },
                {
                    "name": "1st floor - South",
                    "azimuthMin": 95,
                    "azimuthMax": 240,
                    "altitudeMin": 20
                },
                {
                    "name": "Living room",
                    "azimuthMin": 150,
                    "azimuthMax": 260,
                    "altitudeMin": 10
                },
                {
                    "name": "Kitchen",
                    "azimuthMin": 150,
                    "azimuthMax": 285,
                    "altitudeMin": 15
                }
            ]
        }
    ]
}
```
