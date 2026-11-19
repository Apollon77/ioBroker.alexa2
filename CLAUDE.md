# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`iobroker.alexa2` is an ioBroker adapter that remote-controls Amazon Echo / Alexa devices through the (undocumented)
Alexa web APIs. The whole Amazon communication — login/cookie handling incl. the login proxy, REST calls and the push
connection — is done by the npm library **`alexa-remote2`** (and its dependency `alexa-cookie2`). This adapter maps
devices, player, notifications (alarms/reminders/timers), lists, routines, history and Smart-Home devices to ioBroker
objects/states and turns state writes back into `alexa-remote2` calls.

TypeScript (CommonJS output). Sources live in `src/`, the runnable code is the compiled `build/` (`package.json`
`main` is `build/main.js`). `build/` is gitignored — run the build before starting the adapter or the integration
tests.

## Commands

```bash
npm run build                             # tsc -p tsconfig.build.json  -> build/
npm run watch                             # same in watch mode
npm run check                             # type check only (tsconfig.json, noEmit)
npm run lint                              # eslint (@iobroker/eslint-config, flat config)
npx eslint -c eslint.config.mjs --fix src # autofix + prettier formatting

npm run test:package                      # validates package.json / io-package.json / admin JSON (fast)
npm run test:integration                  # starts a real js-controller + adapter instance
npm run translate                         # translate admin/i18n/en.json into the other languages
npm run release-patch                     # @alcalzone/release-script, moves README changelog into io-package news
```

There is deliberately **no `prepare` script** — `npm ci` does not build. Because `build/` is neither committed nor
built on install, `common.nogit` is `true` in `io-package.json`: the adapter can only be installed from npm.
The integration test aborts if a js-controller is already running on the machine.

## Layout

| Path | Content |
| --- | --- |
| `src/main.ts` | the whole adapter: one `Alexa2Adapter extends utils.Adapter` class (~8000 lines) |
| `src/lib/constants.ts` | `KNOWN_DEVICE_TYPES` (device type id -> name/icon/commandSupport) and the command/control state definitions |
| `src/lib/smarthomedevices.ts` | Smart-Home capability -> state definitions, color tables, `configureCapabilityObject()` |
| `src/lib/statusTexts.ts` | translated status line for the config dialog (`getStatusInfoText` message) |
| `src/lib/types.ts` | `AlexaDevice`, `AlexaRemoteInstance` and the shapes of the Amazon responses the code relies on |
| `src/lib/adapter-config.d.ts` | augments `ioBroker.AdapterConfig` — keep in sync with `native` in io-package.json and admin/jsonConfig.json |
| `src/types/nearest-color.d.ts` | typings for `nearest-color` |
| `admin/jsonConfig.json` | the configuration dialog, translations in flat `admin/i18n/<lang>.json` |
| `admin/icons/*.png` | device icons referenced from `KNOWN_DEVICE_TYPES` |

## Architecture

### Startup

`onReady()` → `initSentry()` → `checkInstanceObject(main)` and, in parallel, `loadExistingAccessories()` (reads all
own objects into `existingStates`; whatever is still left there after the initial sync is deleted). `main()` builds the
`alexa-remote2` options, registers all `ws-*` push event handlers and calls `alexa.init()`. After a successful init a
long callback chain fetches music providers, routines, lists, volumes, sounds, skills and then creates all states:
`createStates()` → `createSmarthomeStates()` → `queryAllSmartHomeDevices()` → `initCommUsers()` → subscribe →
`updateHistory()` → `updateDeviceConfigurationStates()` → push connection → `updatePlayerStatus()`.

The callback style is intentional and was kept 1:1 during the TypeScript migration — ordering matters (objects are
queued and written by `processObjectQueue()`).

### Objects and state changes

- All objects are created via `setOrUpdateObject(id, obj, value?, stateChangeCallback?, createNow?)`. Arguments shift
  (`value` may be the callback). Objects are cached in `adapterObjects`; unchanged objects are not rewritten.
- The `stateChangeCallback` is stored in `stateChangeTrigger[id]`. `onStateChange()` checks the datatype against
  `common.type` and calls the trigger — that is the whole "write a state → do something at Amazon" mechanism.
- `deleteObject(id)` removes an object and, for non-states, all children.

### Login / cookie

`alexa-remote2` logs in via a local proxy (`proxyOwnIp`, `proxyPort`, `proxyListenBind`, `proxyOverrideIp`). While the
proxy is needed, `proxyUrl` is set and shown in the admin (`getStatusInfo` / `getStatusInfoText` messages). On a new
cookie the adapter writes `cookie`, `csrf`, `macDms`, `cookieData` into its own `native` (→ restart).
Registration data is persisted by alexa-remote2 in `formerDataStore<namespace>.json` in the **adapter root**.

### Files in the adapter root

`__dirname` is `build/`, but all runtime files stay in the adapter root (`ADAPTER_DIR = join(__dirname, '..')`):
`formerDataStore<ns>.json`, `crashCheck-<ns>.json` (adapter disables itself after 3 crashes in a row),
`cachedDevices.<ns>.json`, `cachedDeviceStates.<ns>.json`, and `package.json` (version for the user agent). Do not move
them — existing installations would lose their login.

### Smart-Home devices

Request counters (`shdCounters`) wrap `alexa.querySmarthomeDevices` / `executeSmarthomeDeviceAction`; more than 1000
calls (or 500 via skills) per hour disable the adapter. Only devices with `#includeInIntervalQuery` are polled.

### Timers

Always `this.setTimeout` / `this.setInterval` (adapter-core, auto-cleared on unload), never the globals.

## Conventions

- **Behaviour is load-bearing.** State IDs, roles, `native` keys and `sendTo` commands (`getStatusInfo`,
  `sendSequenceCommand`, `getStatusInfoText`) are used by user scripts.
- Kept bugs / oddities from the JS version are marked with `// NOTE:` in the code (`grep -n "// NOTE:" src`). Fix them in
  separate commits.
- Amazon responses are undocumented: types in `src/lib/types.ts` only cover the fields the code reads,
  deeper/dynamic parts are `AmazonJson`.
- alexa-remote2's own typings are incomplete — missing members are added in `AlexaRemoteInstance` and via
  `declare module 'alexa-remote2' { export default interface AlexaRemote {...} }` in `src/lib/types.ts`.

## Release flow

Changelog lives in `README.md` under the `### **WORK IN PROGRESS**` placeholder; `release-script` (config in
`.releaseconfig.json`) moves it into `io-package.json` `common.news`. CI (`.github/workflows/test-and-release.yml`)
uses the ioBroker testing actions: type check + lint + package tests, adapter tests on Node 22/24/26 ×
Linux/Windows/macOS with `build: true`, and npm deploy on version tags.
