'use strict';

const path = require('node:path');
const { tests } = require('@iobroker/testing');

// Run tests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test sendTo()', getHarness => {
            it('Should work', () => {
                return new Promise(resolve => {
                    // Create a fresh harness instance each test!
                    const harness = getHarness();
                    // Start the adapter and wait until it has started
                    harness.startAdapterAndWait().then(() => {
                        harness.sendTo('alexa2.0', 'test', 'message', resp => {
                            console.dir(resp);
                            resolve();
                        });
                    });
                });
            });
        });
    }
});
