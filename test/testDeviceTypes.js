/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

const expect = require('chai').expect;

describe('Test alexa2 device types', function() {
    it('should recognize DENON HOME 150 device type', function() {
        // Load the main.js file to access the knownDeviceType object
        const fs = require('fs');
        const path = require('path');
        const mainJsPath = path.join(__dirname, '..', 'main.js');
        const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
        
        // Check if the DENON HOME 150 device type is present in the code
        expect(mainJsContent).to.include("'A1MKGHX5VQBDWX'");
        expect(mainJsContent).to.include("'Denon Home 150'");
        expect(mainJsContent).to.include("commandSupport: true");
    });

    it('should have proper knownDeviceType structure for DENON HOME 150', function() {
        // Simulate extraction of the knownDeviceType object
        const fs = require('fs');
        const path = require('path');
        const mainJsPath = path.join(__dirname, '..', 'main.js');
        const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
        
        // Extract the knownDeviceType definition
        const knownDeviceTypeMatch = mainJsContent.match(/const knownDeviceType = {([\s\S]*?)};/);
        expect(knownDeviceTypeMatch).to.not.be.null;
        
        const knownDeviceTypeString = knownDeviceTypeMatch[0];
        expect(knownDeviceTypeString).to.include("'A1MKGHX5VQBDWX'");
        
        // Check that it has the expected capabilities comment
        expect(knownDeviceTypeString).to.include("TIMERS_AND_ALARMS");
        expect(knownDeviceTypeString).to.include("AUDIO_CONTROLS");
        expect(knownDeviceTypeString).to.include("VOLUME_SETTING");
    });
});