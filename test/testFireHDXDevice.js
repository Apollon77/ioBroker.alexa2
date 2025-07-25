/* jshint -W097 */
/* jshint strict:false */
/* jslint node: true */
/* jshint expr: true */
'use strict';

const expect = require('chai').expect;
const fs = require('fs');

describe('Test Fire HDX Device Support', () => {
    it('Fire HDX device type should be recognized', done => {
        console.log();

        // Read the main.js file to get the knownDeviceType object
        const fileContent = fs.readFileSync(__dirname + '/../main.js', 'utf8');
        
        // Check that the Fire HDX device type A2TX61L00VISA5 is present
        expect(fileContent.includes('A2TX61L00VISA5'), 'Fire HDX device type A2TX61L00VISA5 should be defined in knownDeviceType').to.be.true;
        expect(fileContent.includes('Fire HDX'), 'Fire HDX device should have correct name').to.be.true;
        expect(fileContent.includes('icons/firetab.png'), 'Fire HDX device should use firetab icon').to.be.true;
        
        // Extract the knownDeviceType object
        const knownDeviceTypeMatch = fileContent.match(/const knownDeviceType = \{([\s\S]*?)\};/);
        expect(knownDeviceTypeMatch, 'knownDeviceType object should be found in main.js').to.not.be.null;
        
        // Verify the device configuration is correct
        const deviceLine = fileContent.match(/'A2TX61L00VISA5':\s*\{[^}]+\}/);
        expect(deviceLine, 'A2TX61L00VISA5 device configuration should be found').to.not.be.null;
        
        if (deviceLine) {
            const deviceConfig = deviceLine[0];
            expect(deviceConfig.includes('commandSupport: true'), 'Fire HDX should have command support enabled').to.be.true;
            expect(deviceConfig.includes('name: \'Fire HDX\''), 'Fire HDX should have correct name').to.be.true;
            expect(deviceConfig.includes('icon: \'icons/firetab.png\''), 'Fire HDX should use firetab icon').to.be.true;
        }
        
        console.log('✓ Fire HDX device type A2TX61L00VISA5 is properly configured');
        done();
    });
});