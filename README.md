# homebridge-sun-protect

This plugin offer simple Homekit accessory to configure shades automations depending on sun position.

# Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-sun-protect`
3. Update your configuration file. See bellow for a sample.

# Configuration

1. Configure your lat/long coordinate
2. Create plugin config with zone name (generally one by shade orientation) and trigger(s) restricted by azimuthMin, azimuthMax, altitudeMin and/or altitudeMax condition(s)
3. Configure your shade closure in Homekit

Plugin will add 2 accessories : one switch to enable triggers computation and stateless buttons used to configure automation.

Activate the switch when wether is sunny (with luminosity sensor for eg.) and when you are wake-up (with motion sensor for eg.).
The switch automatically move to 'off' when sun sets.

Configure the stateless button as following:
There is one button by zone configured in plugin config.
- 1 press button is triggered when condition stops: no trigger match
- 2-3 press button is triggered when first trigger conditions matches

When main switch is switched off, 1 press button will be triggered for each zone.

LIMITATION : All zone must have 2nd trigger in config to activate 3rd press button

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
            "zones": [
                {
                    "name": "1st floor - South East",
                    "triggers": [
                        {
                            "azimuthMin": 100,
                            "azimuthMax": 150
                        }
                    ]
                },
                {
                    "name": "1st floor - South",
                    "triggers": [
                        {
                            "azimuthMin": 95,
                            "azimuthMax": 240,
                            "altitudeMin": 20
                        }
                    ]
                },
                {
                    "name": "Living room",
                    "triggers": [
                        {
                            "azimuthMin": 150,
                            "azimuthMax": 260,
                            "altitudeMin": 10
                        }
                    ]
                },
                {
                    "name": "Kitchen",
                    "triggers": [
                        {
                            "azimuthMin": 150,
                            "azimuthMax": 285,
                            "altitudeMin": 15
                        }
                    ]
                }
            ]
        }
    ]
}
```
