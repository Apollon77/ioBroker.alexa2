'use strict';

const path = require('node:path');
const assert = require('node:assert');
const { tests } = require('@iobroker/testing');

// Run tests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test sendTo()', getHarness => {
            it('getStatusInfo should answer without Amazon login', function () {
                this.timeout(30000);
                return new Promise((resolve, reject) => {
                    // Create a fresh harness instance each test!
                    const harness = getHarness();
                    // Start the adapter and wait until it has started
                    harness
                        .startAdapterAndWait()
                        .then(() => {
                            harness.sendTo('alexa2.0', 'getStatusInfo', {}, resp => {
                                try {
                                    assert.ok(resp && typeof resp === 'object', 'no response');
                                    assert.strictEqual(resp.error, null);
                                    assert.strictEqual(typeof resp.result.proxyActive, 'boolean');
                                    resolve();
                                } catch (e) {
                                    reject(e);
                                }
                            });
                        })
                        .catch(reject);
                });
            });
        });
    },
});
