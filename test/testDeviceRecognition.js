/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

const expect = require('chai').expect;

describe('Test device recognition logic', function() {
    it('should recognize DENON HOME 150 and not trigger unknown device warning', function() {
        // Extract the knownDeviceType object from main.js
        const fs = require('fs');
        const path = require('path');
        const mainJsPath = path.join(__dirname, '..', 'main.js');
        const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
        
        // Simulate the device recognition logic
        // Create a mock device object like what would come from Alexa
        const mockDevice = {
            deviceType: 'A1MKGHX5VQBDWX',
            _name: 'Moritz\'s Denon Home 150',
            capabilities: [
                'TIMERS_AND_ALARMS', 'AMAZON_MUSIC', 'FAR_FIELD', 'SUPPORTS_LOCALE_SWITCH',
                'SET_LOCALE', 'DIALOG_INTERFACE_VERSION', 'EQUALIZER_CONTROLLER_TREBLE',
                'SPEECH_RECOGNIZER_USS', 'MICROPHONE', 'REMINDERS', 'VOLUME_SETTING',
                'EQUALIZER_CONTROLLER_MIDRANGE', 'AUDIBLE', 'TUNE_IN', 'SIRIUSXM',
                'KINDLE_BOOKS', 'EQUALIZER_CONTROLLER_BASS', 'GOLDFISH', 'ASCENDING_ALARM_VOLUME',
                'APPLE_MUSIC', 'SUPPORTS_LOCALE', 'DEEZER', 'SET_TIME_ZONE', 'CHANGE_NAME',
                'SOUND_SETTINGS', 'AUDIO_CONTROLS', 'SUPPORTS_CONNECTED_HOME_CLOUD_ONLY',
                'CUSTOM_ALARM_TONE', 'EARCONS', 'TIDAL', 'MULTI_WAKEWORDS_SUPPORTED',
                'PERSISTENT_CONNECTION', 'MUSIC_SKILL', 'DEREGISTER_DEVICE', 'I_HEART_RADIO',
                'SLEEP', 'DREAM_TRAINING', 'ADAPTIVE_LISTENING', 'AUDIO_PLAYER'
            ]
        };

        // Extract and evaluate the knownDeviceType object using a more robust method
        const match = mainJsContent.match(/const knownDeviceType = ({[\s\S]*?});/);
        expect(match).to.not.be.null;
        
        // Create a function to evaluate the knownDeviceType safely
        const evalKnownDeviceType = new Function('return ' + match[1]);
        const knownDeviceType = evalKnownDeviceType();
        
        // Test the device recognition logic
        const deviceTypeDetails = knownDeviceType[mockDevice.deviceType];
        
        // This should NOT be null/undefined since we added the device
        expect(deviceTypeDetails).to.not.be.undefined;
        expect(deviceTypeDetails).to.not.be.null;
        
        // Check the properties
        expect(deviceTypeDetails.name).to.equal('Denon Home 150');
        expect(deviceTypeDetails.commandSupport).to.equal(true);
        
        // Simulate the warning logic - this should NOT trigger
        const shouldTriggerWarning = !deviceTypeDetails;
        expect(shouldTriggerWarning).to.be.false;
    });

    it('should still trigger warning for truly unknown devices', function() {
        // Extract the knownDeviceType object from main.js
        const fs = require('fs');
        const path = require('path');
        const mainJsPath = path.join(__dirname, '..', 'main.js');
        const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
        
        // Create a mock device with a truly unknown device type
        const mockUnknownDevice = {
            deviceType: 'UNKNOWN_DEVICE_TYPE_123',
            _name: 'Unknown Test Device',
            capabilities: ['SOME_CAPABILITY']
        };

        // Extract and evaluate the knownDeviceType object
        const match = mainJsContent.match(/const knownDeviceType = ({[\s\S]*?});/);
        const evalKnownDeviceType = new Function('return ' + match[1]);
        const knownDeviceType = evalKnownDeviceType();
        
        // Test that unknown device is not recognized
        const deviceTypeDetails = knownDeviceType[mockUnknownDevice.deviceType];
        expect(deviceTypeDetails).to.be.undefined;
        
        // This should trigger the warning
        const shouldTriggerWarning = !deviceTypeDetails;
        expect(shouldTriggerWarning).to.be.true;
    });
});