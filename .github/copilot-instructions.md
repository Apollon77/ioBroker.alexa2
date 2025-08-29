# ioBroker.alexa2 Adapter
ioBroker.alexa2 is a Node.js adapter for ioBroker that provides remote control for Amazon Alexa devices (Amazon Echo). The adapter integrates with the ioBroker home automation platform and allows control of Alexa devices, smart home devices, routines, and more.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap, Build, and Test the Repository:
- `npm install` -- Install dependencies. Takes ~40 seconds. NEVER CANCEL.
- `npm test` -- Run complete test suite. Takes ~55 seconds. NEVER CANCEL. Set timeout to 90+ seconds.
- `npx eslint main.js lib/ test/ --ext .js` -- Lint main code files. Admin files have known translation issues.

### Timing Expectations:
- **NEVER CANCEL**: npm install takes 40 seconds. Wait for completion.
- **NEVER CANCEL**: npm test takes 55 seconds total. Set timeout to 90+ seconds minimum.
- **NEVER CANCEL**: The test includes full ioBroker js-controller setup which can take 30+ seconds just for initialization.

### Manual Validation After Changes:
- ALWAYS run `npm test` after making any code changes to ensure adapter functionality
- ALWAYS run ESLint on modified files: `npx eslint <modified-files> --ext .js`
- The adapter cannot be run standalone - it requires ioBroker infrastructure
- Tests automatically validate adapter startup, configuration, and shutdown sequences
- DO NOT attempt to run main.js directly - it requires ioBroker adapter-core framework

## Project Structure and Navigation

### Key Directories and Files:
```
/home/runner/work/ioBroker.alexa2/ioBroker.alexa2/
├── main.js                 # Main adapter entry point (352KB, core logic)
├── package.json           # Dependencies and npm scripts
├── io-package.json        # ioBroker adapter configuration
├── README.md              # Comprehensive adapter documentation
├── lib/
│   ├── smarthomedevices.js # Smart home device definitions and controllers
│   └── tools.js           # Utility functions
├── admin/                 # Web UI configuration files
│   ├── index_m.html       # Material Design admin interface
│   ├── words.js           # i18n translations (has known ESLint issues)
│   └── icons/             # Device type icons
├── test/
│   ├── testAdapter.js     # Main adapter functionality tests
│   ├── testPackageFiles.js # Package validation tests
│   └── lib/setup.js       # Test infrastructure and js-controller setup
└── .github/workflows/     # CI/CD pipeline configuration
```

### Important Code Areas:
- **main.js**: Core adapter logic, Alexa API integration, device management
- **lib/smarthomedevices.js**: Smart home device capability definitions for various device types
- **admin/index_m.html**: Admin configuration interface for credentials and settings  
- **test/lib/setup.js**: Complex test infrastructure that sets up js-controller environment

## Validation Scenarios

### Always Run These Validation Steps:
1. **Install and Test**: `npm install && npm test` - Ensures all dependencies work and adapter can start properly
2. **Lint Check**: `npx eslint main.js lib/ test/ --ext .js` - Check code quality (ignore admin/words.js issues)
3. **Package Validation**: Tests automatically validate package.json and io-package.json consistency

### Manual Testing Scenarios:
- The adapter requires Amazon Alexa account credentials which cannot be tested in CI
- Tests validate adapter initialization, configuration loading, and proper shutdown
- Real functionality requires proxy-based authentication flow with Amazon
- Tests use mock/stub behavior for core adapter lifecycle validation

## Common Tasks

### Dependencies and Requirements:
- **Node.js**: 16+ required (package.json engines), tested with 20.x
- **npm**: Standard package manager, uses package-lock.json
- **@iobroker/adapter-core**: ^3.2.3 - Core ioBroker adapter framework
- **alexa-remote2**: ^8.0.2 - Amazon Alexa API integration library

### npm Scripts Available:
```bash
npm test          # Run mocha test suite (takes ~55s)
npm run release   # Release automation (requires tokens)
npm run translate # Translation management
```

### Linting and Code Quality:
- ESLint configured in .eslintrc.json with strict rules
- Use single quotes, 4-space indentation, prefer const over let/var
- Main code files should lint cleanly
- admin/words.js has known translation format issues - ignore ESLint errors in this file

### GitHub Actions Workflow:
- Runs on Node.js 18.x, 20.x, 22.x, 24.x across Ubuntu, Windows, macOS
- check-and-lint job: `npm ci` only (linting commented out in workflow)
- adapter-tests job: `npm ci && npm test` 
- Deployment triggers on tagged releases

## Architecture Notes

### ioBroker Adapter Pattern:
- Extends @iobroker/adapter-core.Adapter class
- Uses state-based communication with ioBroker objects/states databases
- Implements standard adapter lifecycle: ready, unload, stateChange, objectChange
- Creates device/state hierarchies under adapter namespace (alexa2.0.*)

### External Dependencies:
- alexa-remote2: Amazon Alexa API integration
- https, nearest-color, rrule: Utility libraries
- Sentry integration for error reporting (optional)

### Test Infrastructure:
- Uses complex test setup that installs and configures js-controller
- Creates temporary ioBroker instance with Redis backends
- Tests adapter lifecycle, not actual Amazon Alexa functionality
- Mock/stub approach for external API dependencies

## Troubleshooting

### Common Issues:
- **Test timeouts**: Always set 90+ second timeouts for npm test
- **ESLint errors in admin/words.js**: These are translation files with specific format requirements - ignore
- **Cannot run main.js directly**: Requires ioBroker adapter-core framework and configuration
- **Missing dependencies**: Always run `npm install` before any other commands

### Development Environment:
- Use any modern IDE with Node.js support
- ESLint integration recommended for code quality
- Git hooks not configured - manually run linting before commits
- No TypeScript - pure JavaScript codebase

### CI/CD Pipeline:
- Tests run automatically on pushes and PRs
- Linting step commented out in workflow due to admin file issues
- Releases automated via @alcalzone/release-script
- Sentry integration for production error tracking