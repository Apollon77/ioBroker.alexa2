'use strict';

const path = require('node:path');
const { tests } = require('@iobroker/testing');

// Run tests
tests.packageFiles(path.join(__dirname, '..'));
