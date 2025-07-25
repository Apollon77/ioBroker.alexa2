/* jshint -W097 */// jshint strict:false
/*jslint node: true */
const expect = require('chai').expect;
const fs = require('fs');
const path = require('path');

describe('Test device types', function() {
    let knownDeviceType;
    
    before('Load main.js and extract knownDeviceType', function() {
        // Read the main.js file
        const mainJsPath = path.join(__dirname, '..', 'main.js');
        const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
        
        // Extract the knownDeviceType object using a simple regex approach
        const knownDeviceTypeMatch = mainJsContent.match(/const knownDeviceType = \{([\s\S]*?)\};/);
        if (knownDeviceTypeMatch) {
            try {
                // Evaluate the object (this is safe since we control the content)
                const knownDeviceTypeStr = '{' + knownDeviceTypeMatch[1] + '}';
                knownDeviceType = eval('(' + knownDeviceTypeStr + ')');
            } catch (e) {
                console.error('Failed to parse knownDeviceType:', e);
                throw e;
            }
        } else {
            throw new Error('Could not find knownDeviceType in main.js');
        }
    });

    it('should contain the Philips TAB8805/10 3.1 Soundbar device type', function() {
        expect(knownDeviceType).to.be.an('object');
        expect(knownDeviceType).to.have.property('A32933M5JHLHN3');
        
        const deviceInfo = knownDeviceType['A32933M5JHLHN3'];
        expect(deviceInfo).to.be.an('object');
        expect(deviceInfo).to.have.property('name');
        expect(deviceInfo).to.have.property('commandSupport');
        
        expect(deviceInfo.name).to.equal('Philips TAB8805/10 3.1 Soundbar (Connected Play-Fi-5)');
        expect(deviceInfo.commandSupport).to.equal(true);
    });

    it('should have device types in alphabetical order', function() {
        const deviceTypeKeys = Object.keys(knownDeviceType);
        const sortedKeys = [...deviceTypeKeys].sort();
        
        // Check that the keys are in alphabetical order
        expect(deviceTypeKeys).to.deep.equal(sortedKeys);
    });

    it('should have consistent structure for all soundbar devices', function() {
        const soundbarDevices = Object.entries(knownDeviceType).filter(([id, info]) => 
            info.name.toLowerCase().includes('soundbar')
        );
        
        expect(soundbarDevices.length).to.be.greaterThan(0);
        
        // Check that our new Philips soundbar is included
        const philipsSoundbar = soundbarDevices.find(([id, info]) => id === 'A32933M5JHLHN3');
        expect(philipsSoundbar).to.exist;
        
        // Check that all soundbars have commandSupport: true (based on existing pattern)
        soundbarDevices.forEach(([id, info]) => {
            expect(info.commandSupport).to.equal(true, 
                `Soundbar ${info.name} (${id}) should have commandSupport: true`);
        });
    });
});