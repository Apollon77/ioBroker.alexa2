/* jshint -W097 */
/* jshint -W030 */
/* jshint -W083 */
/* jshint strict: false */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

const Alexa = require('alexa-remote2');
const path = require('path');
const os = require('os');
const utils = require(path.join(__dirname, 'lib', 'utils')); // Get common adapter utils
const shObjects = require(path.join(__dirname, 'lib', 'smarthomedevices.js'));

const bespokenVdSDK = require("virtual-device-sdk");
let bespokenDevice;

const forbiddenCharacters = /[\]\[*,;'"`<>\\\s?]/g;

let alexa;

const playerControls = {
    controlPlay: { command: 'play', val: false, common: { type: 'boolean', read: false, write: true, role: 'button.play'}},
    controlPause:{ command: 'pause', val: false, common: { type: 'boolean', read: false, write: true, role: 'button.pause'}}
};
const musicControls = {
    controlNext: { command: 'next', val: false, common: { type: 'boolean', read: false, write: true, role: 'button.next'}},
    controlPrevious: { command: 'previous', val: false, common: { type: 'boolean', read: false, write: true, role: 'button.prev'}},
    controlForward: { command: 'forward', val: false, common: { type: 'boolean', read: false, write: true, role: 'button.forward'}},
    controlRewind: { command: 'rewind', val: false, common: { type: 'boolean', read: false, write: true, role: 'button.reverse'}},
    controlShuffle: { command: 'shuffle', val: false, common: { type: 'boolean', read: false, write: true, role: 'media.mode.shuffle'}},
    controlRepeat: { command: 'repeat', val: false, common: { type: 'boolean', read: false, write: true, role: 'media.mode.repeat'}},
};

const commands = {
    weather: { val: false, common: { type: 'boolean', read: false, write: true, role: 'button'}},
    traffic: { val: false, common: { type: 'boolean', read: false, write: true, role: 'button'}},
    flashbriefing: { val: false, common: { type: 'boolean', read: false, write: true, role: 'button'}},
    goodmorning: { val: false, common: { type: 'boolean', read: false, write: true, role: 'button'}},
    singasong: { val: false, common: { type: 'boolean', read: false, write: true, role: 'button'}},
    tellstory: { val: false, common: { type: 'boolean', read: false, write: true, role: 'button'}}
};

const knownDeviceType = {
    'A10A33FOX2NUBK':   {name: 'Echo Spot', commandSupport: true, icon: 'icons/spot.png'},
    'A12GXV8XMS007S':   {name: 'FireTV', commandSupport: false, icon: 'icons/firetv.png'}, //? CHANGE_NAME,MICROPHONE,SUPPORTS_SOFTWARE_VERSION,ARTHUR_TARGET,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,ACTIVE_AFTER_FRO,FLASH_BRIEFING,VOLUME_SETTING
    'A15ERDAKK5HQQG':   {name: 'Sonos', commandSupport: false, icon: 'icons/sonos.png'}, //? AUDIO_PLAYER,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,AMAZON_MUSIC,TUNE_IN,PANDORA,REMINDERS,I_HEART_RADIO,CHANGE_NAME,VOLUME_SETTING,PEONY
    'A18O6U1UQFJ0XK':   {name: 'Echo Plus 2.Gen', commandSupport: true, icon: 'icons/echo_plus2.png'}, // PERSISTENT_CONNECTION,ACTIVE_AFTER_FRO,PAIR_BT_SINK,GADGETS,ASCENDING_ALARM_VOLUME,SET_LOCALE,MICROPHONE,VOLUME_SETTING,AUDIBLE,PAIR_BT_SOURCE,AUDIO_PLAYER,DREAM_TRAINING,FAR_FIELD_WAKE_WORD,UPDATE_WIFI,TUPLE,CUSTOM_ALARM_TONE,REQUIRES_OOBE_FOR_SETUP,EARCONS,KINDLE_BOOKS,SUPPORTS_SOFTWARE_VERSION,ALLOW_LOG_UPLOAD,POPTART,GOLDFISH,DEREGISTER_DEVICE,SLEEP,TAHOE_BYOD,VOICE_TRAINING,SOUND_SETTINGS,CHANGE_NAME,FLASH_BRIEFING,AUX_SETTINGS,REMINDERS,LEMUR_ALPHA,PAIR_REMOTE,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,TUPLE_CATEGORY_A,TIMERS_AND_ALARMS
    'A1DL2DVDQVK3Q':	{name: 'Apps', commandSupport: false}, // (PEONY,VOLUME_SETTING)
    'A1H0CMF1XM0ZP4':	{name: 'Echo Dot/Bose', commandSupport: false}, // ??? // CHANGE_NAME,AUDIO_PLAYER,AMAZON_MUSIC,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,VOLUME_SETTING,LAMBDA // Bose: LAMBDA_DOWNCHANNEL,AUDIO_PLAYER,CHANGE_NAME,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,AMAZON_MUSIC,PANDORA,PEONY,I_HEART_RADIO,TUNE_IN,REMINDERS,VOLUME_SETTING
    'A1J16TEDOYCZTN':	{name: 'Fire tab', commandSupport: true, icon: 'icons/firetab.png'}, // (PEONY,MICROPHONE,SUPPORTS_SOFTWARE_VERSION,VOLUME_SETTING,ASX_TIME_ZONE,REMINDERS)
    'A1NL4BVLQ4L3N3':	{name: 'Echo Show', commandSupport: true, icon: 'icons/echo_show.png'}, // PAIR_BT_SINK,CUSTOM_ALARM_TONE,TIMERS_AND_ALARMS,TUNE_IN,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,SOUND_SETTINGS,SET_LOCALE,SLEEP,EARCONS,SHARKNADO,SUPPORTS_SOFTWARE_VERSION,TUPLE_CATEGORY_B,MICROPHONE,SALMON,ALLOW_LOG_UPLOAD,CHANGE_NAME,FAR_FIELD_WAKE_WORD,VOLUME_SETTING,AUDIO_PLAYER,I_HEART_RADIO,REMINDERS,ASCENDING_ALARM_VOLUME,PERSISTENT_CONNECTION,AUDIBLE,GADGETS,AMAZON_MUSIC,VOICE_TRAINING,FLASH_BRIEFING,GOLDFISH,FACTORY_RESET_DEVICE,TUPLE,PANDORA,DREAM_TRAINING,LEMUR_ALPHA,POPTART,KINDLE_BOOKS
    'A1X7HJX9QL16M5':	{name: 'Bespoken.io', commandSupport: false},
    'A21Z3CGI8UIP0F':   {name: 'Apps', commandSupport: false}, // AUDIO_PLAYER,AMAZON_MUSIC,PANDORA,CHANGE_NAME,REMINDERS,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,I_HEART_RADIO,VOLUME_SETTING,TUNE_IN,LAMBDA_DOWNCHANNEL,PEONY
    'A2825NDLA7WDZV':   {name: 'Apps', commandSupport: false}, // PEONY,VOLUME_SETTING
    'A2E0SNTXJVT7WK':   {name: 'Fire TV V1', commandSupport: false, icon: 'icons/firetv.png'},
    'A2GFL5ZMWNE0PX':   {name: 'Fire TV', commandSupport: true, icon: 'icons/firetv.png'}, // SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,VOLUME_SETTING,SUPPORTS_SOFTWARE_VERSION,CHANGE_NAME,ACTIVE_AFTER_FRO,ARTHUR_TARGET,FLASH_BRIEFING
    'A2IVLV5VM2W81':    {name: 'Apps', commandSupport: false}, // VOLUME_SETTING,MICROPHONE
    'A2LWARUGJLBYEW':   {name: 'Fire TV Stick V2', commandSupport: false, icon: 'icons/firetv.png'}, // ACTIVE_AFTER_FRO,FLASH_BRIEFING,ARTHUR_TARGET,CHANGE_NAME,VOLUME_SETTING,SUPPORTS_SOFTWARE_VERSION,MICROPHONE,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY
    'A2M35JJZWCQOMZ':   {name: 'Echo Plus', commandSupport: true, icon: 'icons/echo.png'}, // PAIR_BT_SINK,SOUND_SETTINGS,FAR_FIELD_WAKE_WORD,CUSTOM_ALARM_TONE,MICROPHONE,VOLUME_SETTING,ACTIVE_AFTER_FRO,POPTART,REMINDERS,AMAZON_MUSIC,TUNE_IN,CHANGE_NAME,I_HEART_RADIO,DEREGISTER_FACTORY_RESET,SUPPORTS_SOFTWARE_VERSION,EARCONS,PAIR_REMOTE,PERSISTENT_CONNECTION,LEMUR_ALPHA,SALMON,DREAM_TRAINING,UPDATE_WIFI,VOICE_TRAINING,TIMERS_AND_ALARMS,ASCENDING_ALARM_VOLUME,AUDIBLE,SLEEP,AUDIO_PLAYER,PAIR_BT_SOURCE,FLASH_BRIEFING,SET_LOCALE,REQUIRES_OOBE_FOR_SETUP,DEREGISTER_DEVICE,PANDORA,GOLDFISH,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,KINDLE_BOOKS
    'A2M4YX06LWP8WI':   {name: 'Fire Tab', commandSupport: false, icon: 'icons/firetab.png'}, // SUPPORTS_SOFTWARE_VERSION,VOLUME_SETTING,ASX_TIME_ZONE,MICROPHONE,PEONY
    'A2OSP3UA4VC85F':   {name: 'Sonos', commandSupport: true, icon: 'icons/sonos.png'}, // DEREGISTER_DEVICE,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,CHANGE_NAME,KINDLE_BOOKS,AUDIO_PLAYER,TIMERS_AND_ALARMS,VOLUME_SETTING,PEONY,AMAZON_MUSIC,REMINDERS,SLEEP,I_HEART_RADIO,AUDIBLE,GOLDFISH,TUNE_IN,DREAM_TRAINING,PERSISTENT_CONNECTION
    'A2T0P32DY3F7VB':   {name: 'echosim.io', commandSupport: false},
    'A2TF17PFR55MTB':   {name: 'Apps', commandSupport: false}, // VOLUME_SETTING,MICROPHONE
    'A38BPK7OW001EX':   {name: 'Raspberry Alexa', commandSupport: false, icon: 'icons/raspi.png'}, // TIMERS_AND_ALARMS,AMAZON_MUSIC,VOLUME_SETTING,AUDIBLE,I_HEART_RADIO,TUNE_IN,KINDLE_BOOKS,DEREGISTER_DEVICE,AUDIO_PLAYER,SLEEP,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,PERSISTENT_CONNECTION,DREAM_TRAINING,MICROPHONE,GOLDFISH,CHANGE_NAME,PEONY
    'A38EHHIB10L47V':	{name: 'Echo Dot', commandSupport: true, icon: '/icons/echo_dot.png'}, // ASCENDING_ALARM_VOLUME,MICROPHONE,REMINDERS,ASX_TIME_ZONE,VOLUME_SETTING,PEONY,SUPPORTS_SOFTWARE_VERSION)
    'A3C9PE6TNYLTCH':   {name: 'Multiroom', commandSupport: true}, // AUDIO_PLAYER,AMAZON_MUSIC,KINDLE_BOOKS,TUNE_IN,AUDIBLE,PANDORA,I_HEART_RADIO,SALMON,VOLUME_SETTING
    'A3H674413M2EKB':   {name: 'echosim.io', commandSupport: false},
    'A3HF4YRA2L7XGC':   {name: 'Fire TV Cube', commandSupport: true}, // FLASH_BRIEFING,TUNE_IN,PANDORA,FAR_FIELD_WAKE_WORD,DREAM_TRAINING,AMAZON_MUSIC,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,AUDIBLE,SUPPORTS_SOFTWARE_VERSION,PAIR_BT_SINK,CHANGE_NAME,AUDIO_PLAYER,VOICE_TRAINING,SET_LOCALE,EARCONS,SOUND_SETTINGS,SALMON,ACTIVE_AFTER_FRO,SLEEP,I_HEART_RADIO,TIMERS_AND_ALARMS,CUSTOM_ALARM_TONE,PERSISTENT_CONNECTION,ARTHUR_TARGET,KINDLE_BOOKS,REMINDERS
    'A3NPD82ABCPIDP':   {name: 'Sonos Beam', commandSupport: true, icon: 'icons/sonos.png'}, // AMAZON_MUSIC,CHANGE_NAME,AUDIO_PLAYER,KINDLE_BOOKS,SLEEP,DREAM_TRAINING,AUDIBLE,DEREGISTER_DEVICE,I_HEART_RADIO,GOLDFISH,PERSISTENT_CONNECTION,MICROPHONE,TIMERS_AND_ALARMS,PEONY,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,REMINDERS,VOLUME_SETTING,TUNE_IN
    'A3R9S4ZZECZ6YL':   {name: 'Fire Tab HD 10', commandSupport: true, icon: 'icons/firetab.png'}, // ASX_TIME_ZONE,PEONY,VOLUME_SETTING,SUPPORTS_SOFTWARE_VERSION
    'A3S5BH2HU6VAYF':   {name: 'Echo Dot 2.Gen', commandSupport: true, icon: '/icons/echo_dot.png'}, // PAIR_BT_SINK,CUSTOM_ALARM_TONE,PAIR_REMOTE,TIMERS_AND_ALARMS,SUPPORTS_CONNECTED_HOME,TUNE_IN,SOUND_SETTINGS,DEREGISTER_DEVICE,SET_LOCALE,SLEEP,EARCONS,UPDATE_WIFI,PAIR_BT_SOURCE,SUPPORTS_SOFTWARE_VERSION,REQUIRES_OOBE_FOR_SETUP,MICROPHONE,SALMON,TAHOE_BYOD,CHANGE_NAME,FAR_FIELD_WAKE_WORD,VOLUME_SETTING,AUDIO_PLAYER,I_HEART_RADIO,REMINDERS,PERSISTENT_CONNECTION,AUDIBLE,GADGETS,SUPPORTS_CONNECTED_HOME_ALL,AMAZON_MUSIC,VOICE_TRAINING,FLASH_BRIEFING,DEREGISTER_FACTORY_RESET,GOLDFISH,PANDORA,ACTIVE_AFTER_FRO,DREAM_TRAINING,LEMUR_ALPHA,POPTART,KINDLE_BOOKS
    'A32DOYMUN6DTXA':   {name: 'Echo Dot 3.Gen', commandSupport: true, icon: '/icons/echo_dot3.png'}, // PAIR_BT_SINK,CUSTOM_ALARM_TONE,PAIR_REMOTE,TIMERS_AND_ALARMS,SUPPORTS_CONNECTED_HOME,TUNE_IN,SOUND_SETTINGS,DEREGISTER_DEVICE,SET_LOCALE,SLEEP,EARCONS,UPDATE_WIFI,PAIR_BT_SOURCE,SUPPORTS_SOFTWARE_VERSION,REQUIRES_OOBE_FOR_SETUP,MICROPHONE,SALMON,TAHOE_BYOD,CHANGE_NAME,FAR_FIELD_WAKE_WORD,VOLUME_SETTING,AUDIO_PLAYER,I_HEART_RADIO,REMINDERS,PERSISTENT_CONNECTION,AUDIBLE,GADGETS,SUPPORTS_CONNECTED_HOME_ALL,AMAZON_MUSIC,VOICE_TRAINING,FLASH_BRIEFING,DEREGISTER_FACTORY_RESET,GOLDFISH,PANDORA,ACTIVE_AFTER_FRO,DREAM_TRAINING,LEMUR_ALPHA,POPTART,KINDLE_BOOKS
    'A3SSG6GR8UU7SN':   {name: 'Echo Sub', commandSupport: true, icon: '/icons/echo_sub.png'}, // PERSISTENT_CONNECTION,ACTIVE_AFTER_FRO,SET_LOCALE,MICROPHONE,VOLUME_SETTING,AUDIBLE,AUDIO_PLAYER,UPDATE_WIFI,TUPLE,CUSTOM_ALARM_TONE,REQUIRES_OOBE_FOR_SETUP,EARCONS,KINDLE_BOOKS,TUPLE_CATEGORY_C,SUPPORTS_SOFTWARE_VERSION,ALLOW_LOG_UPLOAD,DEREGISTER_DEVICE,SLEEP,SOUND_SETTINGS,CHANGE_NAME,FLASH_BRIEFING,REMINDERS,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,TIMERS_AND_ALARMS
    'A7WXQPH584YP':     {name: 'Echo 2.Gen', commandSupport: true, icon: '/icons/echo2.png'}, // PAIR_BT_SINK,CUSTOM_ALARM_TONE,PAIR_REMOTE,TIMERS_AND_ALARMS,TUNE_IN,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,SOUND_SETTINGS,DEREGISTER_DEVICE,SET_LOCALE,SLEEP,EARCONS,UPDATE_WIFI,PAIR_BT_SOURCE,SUPPORTS_SOFTWARE_VERSION,REQUIRES_OOBE_FOR_SETUP,MICROPHONE,SALMON,TAHOE_BYOD,CHANGE_NAME,FAR_FIELD_WAKE_WORD,VOLUME_SETTING,AUDIO_PLAYER,I_HEART_RADIO,REMINDERS,ASCENDING_ALARM_VOLUME,PERSISTENT_CONNECTION,AUDIBLE,GADGETS,TUPLE_CATEGORY_A,AMAZON_MUSIC,VOICE_TRAINING,FLASH_BRIEFING,DEREGISTER_FACTORY_RESET,GOLDFISH,TUPLE,PANDORA,ACTIVE_AFTER_FRO,DREAM_TRAINING,LEMUR_ALPHA,POPTART,KINDLE_BOOKS
    'AB72C64C86AW2':    {name: 'Echo', commandSupport: true, icon: '/icons/echo.png'}, // PAIR_BT_SINK,CUSTOM_ALARM_TONE,PAIR_REMOTE,TIMERS_AND_ALARMS,SUPPORTS_CONNECTED_HOME,TUNE_IN,SOUND_SETTINGS,DEREGISTER_DEVICE,SET_LOCALE,SLEEP,EARCONS,UPDATE_WIFI,PAIR_BT_SOURCE,SUPPORTS_SOFTWARE_VERSION,REQUIRES_OOBE_FOR_SETUP,TUPLE_CATEGORY_B,MICROPHONE,SALMON,TAHOE_BYOD,CHANGE_NAME,FAR_FIELD_WAKE_WORD,VOLUME_SETTING,AUDIO_PLAYER,I_HEART_RADIO,REMINDERS,ASCENDING_ALARM_VOLUME,PERSISTENT_CONNECTION,AUDIBLE,GADGETS,SUPPORTS_CONNECTED_HOME_ALL,AMAZON_MUSIC,VOICE_TRAINING,FLASH_BRIEFING,DEREGISTER_FACTORY_RESET,GOLDFISH,TUPLE,PANDORA,ACTIVE_AFTER_FRO,DREAM_TRAINING,LEMUR_ALPHA,POPTART,KINDLE_BOOKS
    'ADVBD696BHNV5':    {name: 'Fire TV Stick V1', commandSupport: false, icon: 'icons/firetv.png'}, // ARTHUR_TARGET,SUPPORTS_SOFTWARE_VERSION,FLASH_BRIEFING,MICROPHONE,PERSISTENT_CONNECTION,CHANGE_NAME,ACTIVE_AFTER_FRO,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,VOLUME_SETTING
    'AILBSA2LNTOYL':    {name: 'reverb App', commandSupport: false, icon: 'icons/reverb.png'}
};

let updateStateTimer;
let updateHistoryTimer;
const updatePlayerTimer = {};
const updateNotificationTimer = {};

let musicProviders;
let automationRoutines;
let routineTriggerUtterances;
const playerDevices = {};

const lastPlayerState = {};
const notificationTimer = {};
let wsMqttConnected = false;
let shApplianceEntityMap = {};
let shGroupDetails = {};
let shDeviceParamValues = {};
let shQueryBlocker = {};

const stateChangeTrigger = {};
const objectQueue = [];

const existingStates = {};
const adapterObjects = {};
function setOrUpdateObject(id, obj, value, stateChangeCallback, createNow) {
    let callback = null;
    if (typeof value === 'function') {
        createNow = stateChangeCallback;
        stateChangeCallback = value;
        value = undefined;
    }
    if (typeof createNow === 'function') {
        callback = createNow;
        createNow = true;
    }

    if (! obj.type) {
        obj.type = 'state';
    }
    if (! obj.common) {
        obj.common = {};
    }
    if (! obj.native) {
        obj.native = {};
    }
    if (obj.common && obj.common.type === undefined) {
        if (value !== null && value !== undefined) {
            obj.common.type = typeof value;
        }
        else if (obj.common.def !== undefined) {
            obj.common.type = typeof obj.common.def;
        }
        else if (obj.type === 'state') {
            obj.common.type = 'mixed';
        }
    }
    if (obj.common && obj.common.read === undefined) {
        obj.common.read = true; //!(obj.common.type === 'boolean' && !!stateChangeCallback);
    }
    if (obj.common && obj.common.write === undefined) {
        obj.common.write = !!stateChangeCallback;
    }
/*    if (obj.common && obj.common.def === undefined && value !== null && value !== undefined) {
        obj.common.def = value;
    }*/
    if (obj.common && obj.common.name === undefined) {
        obj.common.name = id.split('.').pop();
    }

    if (!adapterObjects[id] && existingStates[id]) {
        adapterObjects[id] = existingStates[id];
        if (adapterObjects[id].from) delete adapterObjects[id].from;
        if (adapterObjects[id].ts) delete adapterObjects[id].ts;
        if (adapterObjects[id].acl) delete adapterObjects[id].acl;
        if (adapterObjects[id]._id) delete adapterObjects[id]._id;
        if (obj.common.def === undefined && adapterObjects[id].common.def !== undefined) delete adapterObjects[id].common.def;
        if (obj.common.unit === undefined && adapterObjects[id].common.unit !== undefined) delete adapterObjects[id].common.unit;
        if (obj.common.min === undefined && adapterObjects[id].common.min !== undefined) delete adapterObjects[id].common.min;
        if (obj.common.max === undefined && adapterObjects[id].common.max !== undefined) delete adapterObjects[id].common.max;
        value = undefined; // when exists and it is first time do not overwrite value!
    }
    if (existingStates[id]) delete(existingStates[id]);
    if (adapterObjects[id] && isEquivalent(obj, adapterObjects[id])) {
        //adapter.log.debug('Object unchanged for ' + id + ': ' + JSON.stringify(adapterObjects[id]) + ' - update only: ' + JSON.stringify(value));
        if (value !== undefined) adapter.setState(id, value, true);
        if (stateChangeCallback) stateChangeTrigger[id] = stateChangeCallback;
        return;
    }
    //adapter.log.debug('Add Object for ' + id + ': ' + JSON.stringify(adapterObjects[id]) + '/' + JSON.stringify(obj));

    objectQueue.push({
        id: id,
        value: value,
        obj: obj,
        stateChangeCallback: stateChangeCallback
    });
    adapterObjects[id] = JSON.parse(JSON.stringify(obj));
    //adapter.log.debug('Create object for ' + id + ': ' + JSON.stringify(obj) + ' with value: ' + JSON.stringify(value));

    if (createNow) {
        processObjectQueue(callback);
    }
}

function deleteObject(id) {
    const obj = adapterObjects[id];
    if (obj && obj.type) {
        if (obj.type !== 'state') {
            Object.keys(adapterObjects).forEach((objId) => {
                if (objId.startsWith(id + '.')) {
                    adapter.delObject(objId, (err) => {
                        err = err ? ' (' + err + ')' : '';
                        adapter.log.info(adapterObjects[objId].type + ' ' +  objId + ' deleted' + err);
                        if (!err) {
                            delete adapterObjects[objId];
                        }
                    });
                }
            });

        }
        adapter.delObject(id, (err) => {
            adapter.log.info(adapterObjects[id].type + ' ' +  id + ' deleted (' + err + ')');
            if (!err) {
                delete adapterObjects[id];
            }
        });
    }
}


function isEquivalent(a, b) {
    //adapter.log.debug('Compare ' + JSON.stringify(a) + ' with ' +  JSON.stringify(b));
    // Create arrays of property names
    if (a === null || a === undefined || b === null || b === undefined) {
        return (a === b);
    }
    var aProps = Object.getOwnPropertyNames(a);
    var bProps = Object.getOwnPropertyNames(b);

    // If number of properties is different,
    // objects are not equivalent
    if (aProps.length != bProps.length) {
        //console.log('num props different: ' + JSON.stringify(aProps) + ' / ' + JSON.stringify(bProps));
        return false;
    }

    for (var i = 0; i < aProps.length; i++) {
        var propName = aProps[i];

        if (typeof a[propName] !== typeof b[propName]) {
            //console.log('type props ' + propName + ' different');
            return false;
        }
        if (typeof a[propName] === 'object') {
            if (!isEquivalent(a[propName], b[propName])) {
                return false;
            }
        }
        else {
            // If values of same property are not equal,
            // objects are not equivalent
            if (a[propName] !== b[propName]) {
                //console.log('props ' + propName + ' different');
                return false;
            }
        }
    }

    // If we made it this far, objects
    // are considered equivalent
    return true;
}

function processObjectQueue(callback) {
    if (!objectQueue.length) {
        callback && callback();
        return;
    }

    function handleObject(queueEntry, callback) {
        if (!queueEntry.obj) {
            handleValue(queueEntry, () => {
                return callback && callback();
            });
        }
        adapter.getObject(queueEntry.id, (err, obj) => {
            if (!err && obj) {
                adapter.extendObject(queueEntry.id, queueEntry.obj, () => {
                    handleValue(queueEntry, () => {
                        return callback && callback();
                    });
                });
            }
            else {
                adapter.setObject(queueEntry.id, queueEntry.obj, () => {
                    handleValue(queueEntry, () => {
                        return callback && callback();
                    });
                });
            }
        });
    }

    function handleValue(queueEntry, callback) {
        if (queueEntry.value === null || queueEntry.value === undefined) {
            stateChangeTrigger[queueEntry.id] = queueEntry.stateChangeCallback;
            return callback && callback();
        }
        adapter.setState(queueEntry.id, queueEntry.value, true, () => {
            stateChangeTrigger[queueEntry.id] = queueEntry.stateChangeCallback;
            return callback && callback();
        });
    }

    const queueEntry = objectQueue.shift();
    handleObject(queueEntry, () => {
        return processObjectQueue(callback);
    });
}

const adapter = utils.Adapter('alexa2');

adapter.on('unload', (callback) => {
    callback && callback();
});

adapter.on('stateChange', (id, state) => {
    adapter.log.debug('State changed ' + id + ': ' + JSON.stringify(state));
    if (!state || state.ack) return;
    id = id.substr(adapter.namespace.length + 1);

    if (state && state.from && state.from.startsWith('system.adapter.cloud') && id.endsWith('.Commands.speak')) {
        state.val = state.val.replace(/<[^>]+>/g, '').replace('/  /g', ' ');
    }

    if (typeof stateChangeTrigger[id] === 'function') {
        if (adapterObjects[id] && adapterObjects[id].common && adapterObjects[id].common.type && adapterObjects[id].common.type !== 'mixed') {
            if (adapterObjects[id].common.type === 'boolean' && adapterObjects[id].common.role && adapterObjects[id].common.role.startsWith('button')) state.val = !!state.val;
            if (typeof state.val !== adapterObjects[id].common.type) {
                adapter.log.error('Datatype for ' + id + ' differs from expected, ignore state change! Please write correct datatype (' + adapterObjects[id].common.type + ')');
                return;
            }
        }
        stateChangeTrigger[id](state.val);
    }

    if (!wsMqttConnected) scheduleStatesUpdate(3000);
});

adapter.on('objectChange', (id, object) => {
    adapter.log.debug('Object changed ' + id + ': ' + JSON.stringify(object));
    let ar = id.split('.');
    if (ar[2] === 'Echo-Devices' && ar.length === 4) {
        if (object === null) {
            //deleted, do nothing
            return;
        }
        let device = alexa.serialNumbers[ar[3]];
        if (object && object.common && object.common.name) {
            if (typeof device.rename === 'function') device.rename(object.common.name);
        }
        return;
    }
    if (ar[2] === 'Smart-Home-Devices') {
    }
});

adapter.on('ready', () => {
    adapter.getForeignObject('system.config', (err, obj) => {
        if (obj && obj.native && obj.native.secret) {
            //noinspection JSUnresolvedVariable
            adapter.config.email = decrypt(obj.native.secret, adapter.config.email);
            adapter.config.password = decrypt(obj.native.secret, adapter.config.password);
        } else {
            //noinspection JSUnresolvedVariable
            adapter.config.email = decrypt('Zgfr56gFe87jJOM', adapter.config.email);
            adapter.config.password = decrypt('Zgfr56gFe87jJOM', adapter.config.password);
        }
        loadExistingAccessories(main);
    });
});

process.on('SIGINT', () => {
});

process.on('SIGTERM', () => {
});

process.on('uncaughtException', err => {
    if (adapter && adapter.log) {
        adapter.log.warn('Exception: ' + err);
    }
});


function decrypt(key, value) {
    let result = '';
    for (let i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

function setRequestResult(err, res) {
    if (!err) return;
    adapter.setState('requestResult', err.message ? err.message : err, true);
}

/**
 * Konvertiert eine Sekundenzahl in einen String im Format (HH:)MM:SS
 *
 * @param {number} sec seconds
 * @return string
 */
function sec2HMS(sec) {
	if (sec  === 0) {
        return '0';
    }

    const sec_num = parseInt(sec, 10);
    let hours   = Math.floor(sec_num / 3600);
    let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    let seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (minutes < 10) {minutes = '0' + minutes;}
    if (seconds < 10) {seconds = '0' + seconds;}
    if (hours === 0) {
        return minutes + ':' + seconds;
    }

    if (hours < 10) {hours = '0' + hours;}
    return hours + ':' + minutes + ':' + seconds;
}


function scheduleNotificationUpdate(deviceId, delay) {
    if (updateNotificationTimer[deviceId]) {
        clearTimeout(updateNotificationTimer[deviceId]);
    }
    updateNotificationTimer[deviceId] = setTimeout(() => {
        updateNotificationTimer[deviceId] = null;
        updateNotificationStates(deviceId);
    }, delay);
}

function schedulePlayerUpdate(deviceId, delay) {
    if (updatePlayerTimer[deviceId]) {
        clearTimeout(updatePlayerTimer[deviceId]);
    }
    updatePlayerTimer[deviceId] = setTimeout(() => {
        updatePlayerTimer[deviceId] = null;
        updatePlayerStatus(deviceId);
    }, delay);
}

function scheduleStatesUpdate(delay) {
    if (updateStateTimer) {
        clearTimeout(updateStateTimer);
    }
    if (delay === undefined) {
        delay = adapter.config.updateStateInterval * 1000;
        if (wsMqttConnected) delay = 60 * 60 * 1000; // 1h
    }
    updateStateTimer = setTimeout(() => {
        updateStateTimer = null;
        updateStates();
    }, delay);
}

function updateStates(callback) {
    let i = 0;

    if (updateStateTimer) {
        clearTimeout(updateStateTimer);
        updateStateTimer = null;
    }

    updateDeviceStatus(() => {
        updateBluetoothStatus(() => {
            updatePlayerStatus();
        });
    });
}

/**
 * Inkrementiert 'mediaProgress' alle 2 Sekunden um 2. So wird ein permanentes https-get überflüssig
 * ruft sich nach 2 Sekunden erneut selbst auf, wenn 'currentState' noch auf 'PLAYING' steht.
 * ist 'mediaProgress' größer als 'mediaLength', so ist der Song zu Ende und 'updateDevice' wird aufgerufen.
 *
 * @param {string} serialNumber serial number
 */
function updateMediaProgress(serialNumber) {
    if (!lastPlayerState[serialNumber] || !lastPlayerState[serialNumber].resPlayer) return;

    if (lastPlayerState[serialNumber].timeout) {
        clearTimeout(lastPlayerState[serialNumber].timeout);
        lastPlayerState[serialNumber].timeout = null;
    }

    let resPlayer = lastPlayerState[serialNumber].resPlayer;
    let devId = lastPlayerState[serialNumber].devId;
    let lastTimestamp = lastPlayerState[serialNumber].ts;

	let currentState = resPlayer.playerInfo.state;
	let mediaProgress = parseInt(resPlayer.playerInfo.progress.mediaProgress, 10);
	let mediaLength = parseInt(resPlayer.playerInfo.progress.mediaLength, 10);

	if (currentState === 'PLAYING') {
        let timeframe = ~~((Date.now() - lastTimestamp) / 1000); // calculae time since last data
		let mediaProgressNew = mediaProgress + timeframe; // add this to the progress

		// Am Ende des Titels soll neu geladen werden. Ist es Radio (länge = 0) dann alle 200 sekunden
		if (mediaProgressNew > mediaLength && (mediaLength > 0 || mediaProgressNew % 200 < 2)) {
			schedulePlayerUpdate(serialNumber, 2000);
            return;
		}

		// Nun mediaProgress und mediaProgressPercent neu berechnen
        let mediaProgressPercent = 0;
        if (mediaLength > 0) {
			mediaProgressPercent = Math.round((((mediaProgressNew) * 100) / mediaLength));
		}
		adapter.setState(devId + '.Player.mediaProgressPercent', mediaProgressPercent, true);
		adapter.setState(devId + '.Player.mediaProgress', mediaProgressNew, true);
		adapter.setState(devId + '.Player.mediaProgressStr', sec2HMS(mediaProgressNew), true);

        lastPlayerState[serialNumber].timeout = setTimeout( () => {
            lastPlayerState[serialNumber].timeout = null;
            updateMediaProgress(serialNumber);
        }, 2000);
	}
    else {
        schedulePlayerUpdate(serialNumber, (2 * 60 * 60 + 5) * 1000);
    }
}

function queryAllSmartHomeDevices(initial, callback) {
    let reqArr = [];
    let blocked = [];
    for (let applianceId in shApplianceEntityMap) {
        if (!shApplianceEntityMap.hasOwnProperty(applianceId)) continue;
        if (shApplianceEntityMap[applianceId].readable) {
            if (shQueryBlocker[applianceId]) {
                blocked.push(applianceId);
                continue;
            }
            reqArr.push(applianceId);
            if (!initial) {
                let delay = 600000;
                if (!applianceId.startsWith('SKILL_')) delay = 60000;
                shQueryBlocker[applianceId] = setTimeout(() => {
                    shQueryBlocker[applianceId] = null;
                }, delay);
            }
        }
    }
    if (blocked.length) {
        adapter.log.warn('Smarthome device queries blocked for ' + blocked.join(','));
    }
    if (!reqArr.length) {
        return callback && callback();
    }
    alexa.querySmarthomeDevices(reqArr, (err, res) => {
        if (!err) {
            updateSmarthomeDeviceStates(res);
        }
        callback && callback();
    });

}

function buildSmartHomeControlParameters(entityId, objs, changedParamName, changedParamvalue) {
    function getValueToSend(obj, value) {
        if (value && obj.native.valueTrue) {
            value = obj.native.valueTrue;
        }
        else if (!value && obj.native.valueFalse) {
            value = obj.native.valueFalse;
        }
        else if (obj.native.valueMap) {
            value = obj.native.valueMap[value];
        }
        else {
            if (value === undefined && obj.native.defaultValue !== undefined) {
                value = obj.native.defaultValue;
            }
            if (typeof value === 'number' && obj.native.factor) {
                value *= obj.native.factor;
            }
            value = String(value);
        }
        return value;
    }

    let parameters = {};
    if (!Array.isArray(objs)) objs = [objs];
    for (let obj of objs) {
        let paramName = obj.common.name;
        if (obj.common.name === changedParamName) {
            if (obj.native.action) {
                parameters.action = obj.native.action;
                if (obj.native.paramName) paramName = obj.native.paramName;
                parameters[paramName] = getValueToSend(obj, changedParamvalue);
            }
            else {
                if (changedParamvalue && obj.native.actionTrue) {
                    parameters.action = obj.native.actionTrue;
                }
                else if (!changedParamvalue && obj.native.actionFalse) {
                    parameters.action = obj.native.actionFalse;
                }
            }
        }
        else if (!obj.native.donotsend) {
            if (obj.native.paramName) paramName = obj.native.paramName;
            parameters[paramName] = getValueToSend(obj, shDeviceParamValues['Smart-Home-Devices.' + entityId + '.' + obj.common.name]);
        }
    }
    return parameters;
}

function padding(num) {
    num = num.toString(16);
    if (num.length < 2) num = '0' + num;
    return num;
}

// expected hue range: [0, 360]
// expected saturation range: [0, 1]
// expected lightness range: [0, 1]
// Based on http://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c
function hsvToRgb(h, s, v) {
    let r;
    let g;
    let b;
    h = h / 360;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);

    switch(i % 6){
        case 0:
            r = v;
            g = t;
            b = p;
            break;

        case 1:
            r = q;
            g = v;
            b = p;
            break;

        case 2:
            r = p;
            g = v;
            b = t;
            break;

        case 3:
            r = p;
            g = q;
            b = v;
            break;

        case 4:
            r = t;
            g = p;
            b = v;
            break;

        case 5:
            r = v;
            g = p;
            b = q;
            break;
    }
    return '#' + padding(Math.round(r * 255)) + padding(Math.round(g * 255)) + padding(Math.round(b * 255));
}

function updateSmarthomeDeviceStates(res) {
    function handleObject(deviceEntityId, cap, stateName) {
        if (!adapterObjects['Smart-Home-Devices.' + deviceEntityId + '.' + stateName]) {
            adapter.log.debug('ignoring value "' + cap.namespace + '.' + cap.value + '" for Smart-Home-Devices.' + deviceEntityId + '.' + stateName);
            return null;
        }
        let native = adapterObjects['Smart-Home-Devices.' + deviceEntityId + '.' + stateName].native;
        let value = cap.value;
        if (typeof value === 'object') {
            value = value[native.valueSubKey || 'value'];
        }
        if (value === undefined) {
            adapter.log.debug('Value not provided in answer for Smart-Home-Devices.' + deviceEntityId + '.' + stateName);
            return null;
        }
        if (native.valueTrue && native.valueTrue === value) {
            value = true;
        }
        else if (native.valueFalse && native.valueFalse === value) {
            value = false;
        }
        else if (native.valueMap) {
            adapter.log.debug('Get Index for value "' + cap.namespace + '.' + cap.value + '" for Smart-Home-Devices.' + deviceEntityId + '.' + stateName + ', value=' + value + ' of ' + JSON.stringify(native.valueMap));
            value = native.valueMap.indexOf(value);
            if (value === -1) return null;
        }
        value = {
            val: value,
            ack: true
        };
        if (cap.timeOfSample) value.ts = new Date(cap.timeOfSample).getTime();
        adapter.setState('Smart-Home-Devices.' + deviceEntityId + '.' + stateName, value);
        shDeviceParamValues['Smart-Home-Devices.' + deviceEntityId + '.' + stateName] = value.val;
        return value.val;
    }

    if (res && res.errors && res.errors.length === 1 && res.errors[0] && res.errors[0].code) {
        if (!res.deviceStates || res.deviceStates.length === 0) {
            adapter.setState('requestResult', res.errors[0].code, true);
        }
    }
    if (res.deviceStates) {
        for (let states of res.deviceStates) {
            if (!states.entity || !states.entity.entityId || !shApplianceEntityMap[states.entity.entityId]) continue;
            const deviceEntityId = shApplianceEntityMap[states.entity.entityId].entityId;
            if (deviceEntityId && states.capabilityStates) {
                let colorDataIncluded = false;
                const capValues = {};
                for (let cap of states.capabilityStates) {
                    try {
                        cap = JSON.parse(cap);
                    }
                    catch (e) {
                        adapter.log.warn(e);
                        continue;
                    }
                    if (!shObjects.capabilityObjects[cap.namespace]) {
                        adapter.log.debug('unsupported namespace "' + cap.namespace + '" for Smart-Home-Devices.' + deviceEntityId + '.' + cap.name);
                        continue;
                    }
                    if (!shObjects.capabilityObjects[cap.namespace][cap.name]) {
                        adapter.log.debug('unsupported name "' + cap.namespace + '.' + cap.name + '" for Smart-Home-Devices.' + deviceEntityId + '.' + cap.name);
                        continue;
                    }
                    for (let obj of shObjects.capabilityObjects[cap.namespace][cap.name]) {
                        if (typeof obj === 'string') { // Redirect!!
                            capValues[obj] = handleObject(deviceEntityId, cap, obj);
                            adapter.log.debug(cap.namespace + '.' + cap.value + ': setValueFor=' + obj + ' to ' + capValues[obj]);
                        }
                        else {
                            capValues[obj.common.name] = handleObject(deviceEntityId, cap, obj.common.name);
                        }
                    }
                    if (cap.namespace === 'Alexa.ColorController') {
                        if (capValues['color-hue'] !== null && capValues['color-saturation'] !== null && capValues['color-brightness'] !== null) {
                            const colorRgb = hsvToRgb(capValues['color-hue'], capValues['color-saturation'], capValues['color-brightness']);
                            adapter.setState('Smart-Home-Devices.' + deviceEntityId + '.colorRgb', colorRgb, true);
                            shDeviceParamValues['Smart-Home-Devices.' + deviceEntityId + '.colorRgb'] = colorRgb;
                            capValues.colorRgb = colorRgb;
                            colorDataIncluded = true;
                        }
                    }
                }
                if (colorDataIncluded && capValues.colorRgb && !capValues.colorName) {
                    const colorRgbSearch = hsvToRgb(capValues['color-hue'], capValues['color-saturation'], 1.0);
                    const nearestColor = shObjects.nearestColor(colorRgbSearch);
                    let native = adapterObjects['Smart-Home-Devices.' + deviceEntityId + '.colorName'].native;
                    let value = native.valueMap.indexOf(nearestColor.name);
                    adapter.log.debug('find nearest color for ' + colorRgbSearch + ' (' + capValues.colorRgb + '): index=' + value + ' / ' + JSON.stringify(nearestColor));
                    if (value !== -1) {
                        adapter.setState('Smart-Home-Devices.' + deviceEntityId + '.colorName', value, true);
                        shDeviceParamValues['Smart-Home-Devices.' + deviceEntityId + '.colorName'] = value;
                        capValues.colorName = value;
                    }
                }
            }
        }
    }
    if (res.errors) {
        for (let states of res.errors) {
            if (!states.entity || !states.entity.entityId || !shApplianceEntityMap[states.entity.entityId]) continue;
            const deviceEntityId = shApplianceEntityMap[states.entity.entityId].entityId;
            if (states.code === 'ENDPOINT_UNREACHABLE' && adapterObjects['Smart-Home-Devices.' + deviceEntityId + '.connectivity']) {
                adapter.setState('Smart-Home-Devices.' + deviceEntityId + '.connectivity', false, true);
                adapter.log.debug('Set Connectivity for ' + deviceEntityId + ' to false because ' + states.code);
            }
        }
    }
}

function createSmarthomeStates(callback) {
    shApplianceEntityMap = {};
    shGroupDetails = {};

    alexa.getSmarthomeBehaviourActionDefinitions((err, resProperties) => {
        if (!err && resProperties) shObjects.patchProperties(resProperties);

        alexa.getSmarthomeDevices((err, res) => {
            if (err || !res) return callback(err);
            setOrUpdateObject('Smart-Home-Devices', {type: 'device', common: {name: 'Smart Home Devices'}});

            setOrUpdateObject('Smart-Home-Devices.deleteAll', {common: { type: 'boolean', read: false, write: true, role: 'button'}}, false, (val) => {
                alexa.deleteAllSmarthomeDevices((err, res) => {
                    adapter.deleteDevice('Smart-Home-Devices', () => {
                        setTimeout(createSmarthomeStates, 1000);
                    });
                });
            });
            setOrUpdateObject('Smart-Home-Devices.discoverDevices', {common: {name: 'Let Alexa search for devices', type: 'boolean', read: false, write: true, role: 'button'}}, false, (val) => {
                alexa.discoverSmarthomeDevice((err, res) => {
                    return createSmarthomeStates();
                });
            });

            alexa.getSmarthomeEntities((err, res2) => {
                let behaviours = {};
                if (res2) {
                    res2.forEach((behaviour) => {
                        behaviours[behaviour.id] = behaviour;
                    });
                }

                let readableCounter = 0;
                let all = {};
                if (
                    res &&
                    res.locationDetails &&
                    res.locationDetails.Default_Location &&
                    res.locationDetails.Default_Location.amazonBridgeDetails &&
                    res.locationDetails.Default_Location.amazonBridgeDetails.amazonBridgeDetails
                ) {
                    all = res.locationDetails.Default_Location.amazonBridgeDetails.amazonBridgeDetails;
                }
                for (let i of Object.keys(all)) {
                    for (let n of Object.keys(all[i].applianceDetails.applianceDetails)) {
                        let shDevice = all[i].applianceDetails.applianceDetails[n];
                        let friendlyName = shDevice.friendlyName;
                        shApplianceEntityMap[shDevice.applianceId] = {
                            entityId: shDevice.entityId,
                            readable: false
                        };
                        if (shDevice.aliases && shDevice.aliases[0] && shDevice.aliases[0].friendlyName) friendlyName = shDevice.aliases[0].friendlyName;
                        setOrUpdateObject('Smart-Home-Devices.' + shDevice.entityId, {
                            type: 'channel',
                            common: {
                                name: friendlyName,
                                role: 'channel'
                            },
                            native: {
                                friendlyDescription: shDevice.friendlyDescription,
                                friendlyName: friendlyName,
                                modelName: shDevice.modelName,
                                additionalApplianceIds:  shDevice.additionalApplianceDetails.additionalApplianceDetails.ids || null,
                                object: n,
                                manufacturerName: shDevice.manufacturerName,
                            }
                        });
                        setOrUpdateObject('Smart-Home-Devices.' + shDevice.entityId + '.#enabled', {common: {role: 'indicator', write: false}}, shDevice.isEnabled);
                        setOrUpdateObject('Smart-Home-Devices.' + shDevice.entityId + '.#delete', {common: { type: 'boolean', read: false, write: true, role: 'button'}}, false, function (entityId, val) {
                            alexa.deleteSmarthomeDevice(n);
                            adapter.deleteChannel('Smart-Home-Devices', entityId);
                        }.bind(alexa, shDevice.entityId));

                        const excludeReadable = shDevice.manufacturerName.startsWith('ioBroker');
                        const deviceActions = {};
                        if (behaviours[shDevice.entityId] && behaviours[shDevice.entityId].supportedOperations) {
                            behaviours[shDevice.entityId].supportedOperations.forEach((a) => {
                                deviceActions[a] = true;
                            });
                        }
                        if (shDevice.actions && shDevice.actions.length) {
                            shDevice.actions.forEach((a) => {
                                deviceActions[a] = true;
                            });
                        }
                        let readableProperties = 0;
                        if (shDevice.capabilities.length) {

                            for (let cap of shDevice.capabilities) {
                                if (cap.interfaceName) {
                                    if ((!cap.properties || !cap.properties.supported) && cap.interfaceName === 'Alexa.SceneController') {
                                        cap.properties = {
                                            'supported': [{
                                                'name': 'active'
                                            }]
                                        };
                                    }
                                    if (!cap.properties || !cap.properties.supported) {
                                        adapter.log.debug('Smarthome-Device Capability ' + cap.interfaceName + ' without properties.');
                                        adapter.log.debug(JSON.stringify(shDevice) + ' / ' + JSON.stringify(behaviours[shDevice.entityId]));
                                        continue;
                                    }
                                    if (!shObjects.capabilityObjects[cap.interfaceName]) {
                                        adapter.log.info('Smarthome-Device Capability ' + cap.interfaceName + ' unknown. Report to developer this and next log line from logfile on disk!');
                                        adapter.log.info(JSON.stringify(shDevice) + ' / ' + JSON.stringify(behaviours[shDevice.entityId]));
                                        continue;
                                    }
                                    for (let capProp of cap.properties.supported) {
                                        if (!shObjects.capabilityObjects[cap.interfaceName][capProp.name]) {
                                            adapter.log.info('Smarthome-Device Capability ' + cap.interfaceName + ' for ' + capProp.name + ' unknown. Report to developer this and next log line from logfile on disk!');
                                            adapter.log.info(JSON.stringify(shDevice) + ' / ' + JSON.stringify(behaviours[shDevice.entityId]));
                                            continue;
                                        }

                                        for (let obj of shObjects.capabilityObjects[cap.interfaceName][capProp.name]) {
                                            if (typeof obj === 'string') continue;
                                            obj = JSON.parse(JSON.stringify(obj));
                                            if (obj.experimental) {
                                                adapter.log.info('Smarthome-Device Capability ' + cap.interfaceName + ' for ' + capProp.name + '.' + obj.common.name + ' experimentally supported. Please check and report to developer this and next log line from logfile on disk if it works!!');
                                                adapter.log.info(JSON.stringify(shDevice) + ' / ' + JSON.stringify(behaviours[shDevice.entityId] + ' / ' + JSON.stringify(obj)));
                                            }
                                            if (obj.experimental) delete obj.experimental;
                                            if (obj.common && obj.common.read) {
                                                if (excludeReadable) obj.common.read = false;
                                                    else readableProperties++;
                                            }

                                            if (obj.native.supportedActions && obj.native.supportedActions.length) {
                                                obj.native.supportedActions.forEach((n) => {
                                                    if (deviceActions[n] !== undefined) delete deviceActions[n];
                                                });
                                            }

                                            setOrUpdateObject('Smart-Home-Devices.' + shDevice.entityId + '.' + obj.common.name, obj, false, function (entityId, paramName, applianceId, value) {
                                                if (!obj.common.write) return;
                                                const parameters = buildSmartHomeControlParameters(entityId, shObjects.capabilityObjects[cap.interfaceName][capProp.name], paramName, value);
                                                if (!parameters.action || !behaviours[entityId] || ! behaviours[entityId].supportedOperations || !behaviours[entityId].supportedOperations.includes(parameters.action)) {
                                                    if (!parameters.action.startsWith('turn') && !parameters.action.startsWith('scene')) {
                                                        adapter.log.info('Invalid action ' + parameters.action + ' provided for Capability ' + cap.interfaceName + ' for ' + obj.common.name + '. Report to developer this and next log line from logfile on disk!');
                                                        adapter.log.info(JSON.stringify(shDevice) + ' / ' + JSON.stringify(behaviours[entityId]));
                                                    }
                                                    else {
                                                        adapter.log.info('Action ' + parameters.action + ' provided for Capability ' + cap.interfaceName + ' for ' + obj.common.name + ' is not supported, ignore');
                                                    }
                                                    return;
                                                }
                                                alexa.executeSmarthomeDeviceAction(entityId, parameters, (err, res) => {
                                                    if (!err && res && res.controlResponses && res.controlResponses[0] && res.controlResponses[0].code && res.controlResponses[0].code === 'SUCCESS' && !excludeReadable) {
                                                        if (shQueryBlocker[applianceId]) {
                                                            clearTimeout(shQueryBlocker[applianceId]);
                                                            shQueryBlocker[applianceId] = null;
                                                        }
                                                        setTimeout(() => alexa.querySmarthomeDevices(applianceId, (err, res) => {
                                                            if (!err) {
                                                                updateSmarthomeDeviceStates(res);
                                                            }
                                                        }), 2000);
                                                    }
                                                    else {
                                                        updateSmarthomeDeviceStates(res);
                                                    }
                                                });
                                            }.bind(alexa, shDevice.entityId, obj.common.name, shDevice.applianceId));

                                            if (shDevice.tags && shDevice.tags.tagNameToValueSetMap && shDevice.tags.tagNameToValueSetMap.groupIdentity) {
                                                for (let group of shDevice.tags.tagNameToValueSetMap.groupIdentity) {
                                                    shGroupDetails[group] = shGroupDetails[group] || {
                                                        applianceIds: {},
                                                        entityIds: {},
                                                        parameters: {}
                                                    };
                                                    shGroupDetails[group].applianceIds[shDevice.applianceId] = true;
                                                    shGroupDetails[group].entityIds[shDevice.entityId] = true;
                                                    shGroupDetails[group].parameters[obj.common.name] = obj;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        const deviceActionsArr = Object.keys(deviceActions);
                        if (deviceActionsArr.length) {
                            let readable = false;
                            if (!excludeReadable) {
                                for (let action of deviceActionsArr) {
                                    if (action.startsWith('get') || action.startsWith('retrieve')) {
                                        readable = true;
                                        readableProperties++;
                                    }
                                }
                            }

                            let ignoreSecondTurnOnOff = false;
                            for (let action of deviceActionsArr) {
                                if (ignoreSecondTurnOnOff && (action === 'turnOn' || action === 'turnOff')) continue;
                                if ((action === 'turnOn' && deviceActionsArr.includes('turnOff')) || (action === 'turnOff' && deviceActionsArr.includes('turnOn'))) {
                                    action = 'turnOnOff';
                                    ignoreSecondTurnOnOff = true;
                                }
                                if (!shObjects.actionObjects[action]) {
                                    adapter.log.info('Smarthome-Device Action ' + action + ' unknown. Report to developer this and next log line from logfile on disk!');
                                    adapter.log.info(JSON.stringify(shDevice) + ' / ' + JSON.stringify(behaviours[shDevice.entityId]));
                                    continue;
                                }
                                for (let obj of shObjects.actionObjects[action]) {
                                    if (typeof obj === 'string') continue;
                                    obj = JSON.parse(JSON.stringify(obj));
                                    if (obj.experimental) {
                                        adapter.log.info('Smarthome-Device Action ' + action + '.' + obj.common.name + ' experimentally supported. Please check and report to developer this and next log line from logfile on disk if it works!!');
                                        adapter.log.info(JSON.stringify(shDevice) + ' / ' + JSON.stringify(behaviours[shDevice.entityId]) + ' / ' + JSON.stringify(obj));
                                    }
                                    if (obj.experimental) delete obj.experimental;
                                    if (obj.common && obj.common.read && excludeReadable) {
                                        obj.common.read = false;
                                    }
                                    if (obj.native.supportedActions && obj.native.supportedActions.length) {
                                        obj.native.supportedActions.forEach((n) => {
                                            if (deviceActions[n] !== undefined) delete deviceActions[n];
                                        });
                                    }
                                    if (
                                        (action === 'turnOn') ||
                                        (action === 'sceneActivate' && behaviours[shDevice.entityId] && behaviours[shDevice.entityId].supportedOperations && !behaviours[shDevice.entityId].supportedOperations.includes('sceneDeactivate'))
                                       ) {
                                        obj.common.role = 'button';
                                        obj.common.read = false;
                                    }
                                    obj.native.readable = readable;

                                    setOrUpdateObject('Smart-Home-Devices.' + shDevice.entityId + '.' + obj.common.name, obj, null, function (entityId, paramName, applianceId, value) {
                                        if (!obj.common.write) return;
                                        let origValue = value;
                                        const parameters = buildSmartHomeControlParameters(shDevice.entityId, shObjects.actionObjects[action], paramName, value);

                                        if (!behaviours[entityId] || ! behaviours[entityId].supportedOperations || !behaviours[entityId].supportedOperations.includes(parameters.action)) {
                                            if (!parameters.action.startsWith('turn') && !parameters.action.startsWith('scene')) {
                                                adapter.log.info('Invalid action ' + parameters.action + ' provided for Action ' + action + '. Report to developer this and next log line from logfile on disk!');
                                                adapter.log.info(JSON.stringify(shDevice) + ' / ' + JSON.stringify(behaviours[entityId]));
                                            }
                                            else {
                                                adapter.log.info('Action ' + parameters.action + ' provided for Action ' + action + ' for ' + obj.common.name + ' is not supported, ignore');
                                            }
                                            return;
                                        }
                                        alexa.executeSmarthomeDeviceAction(entityId, parameters, (err, res) => {
                                            if (!err && res && res.controlResponses && res.controlResponses[0] && res.controlResponses[0].code && res.controlResponses[0].code === 'SUCCESS') {
                                                if (obj.native.readable) {
                                                    if (shQueryBlocker[applianceId]) {
                                                        clearTimeout(shQueryBlocker[applianceId]);
                                                        shQueryBlocker[applianceId] = null;
                                                    }
                                                    setTimeout(() => alexa.querySmarthomeDevices(applianceId, (err, res) => {
                                                        if (!err) {
                                                            updateSmarthomeDeviceStates(res);
                                                        }
                                                    }), 2000);
                                                }
                                                else {
                                                    adapter.setState('Smart-Home-Devices.' + shDevice.entityId + '.' + obj.common.name, origValue, true);
                                                }
                                            }
                                            else {
                                                updateSmarthomeDeviceStates(res);
                                            }
                                        });
                                    }.bind(alexa, shDevice.entityId, obj.common.name, shDevice.applianceId));

                                    if (shDevice.tags && shDevice.tags.tagNameToValueSetMap && shDevice.tags.tagNameToValueSetMap.groupIdentity) {
                                        for (let group of shDevice.tags.tagNameToValueSetMap.groupIdentity) {
                                            shGroupDetails[group] = shGroupDetails[group] || {
                                                applianceIds: {},
                                                entityIds: {},
                                                parameters: {}
                                            };
                                            shGroupDetails[group].applianceIds[shDevice.applianceId] = true;
                                            shGroupDetails[group].entityIds[shDevice.entityId] = true;
                                            shGroupDetails[group].parameters[obj.common.name] = obj;
                                        }
                                    }
                                }
                            }
                        }
                        if (readableProperties > 0 && !excludeReadable) {
                            shApplianceEntityMap[shDevice.applianceId].readable = true;
                            readableCounter++;
                            setOrUpdateObject('Smart-Home-Devices.' + shDevice.entityId + '.#query', {common: {type: 'boolean', read: false, write: true, role: 'button'}}, false, function (applianceId, value) {
                                if (shQueryBlocker[applianceId]) {
                                    adapter.log.warn('Smart Home device request blocked for ' + applianceId);
                                    return;
                                }
                                let delay = 300000;
                                if (!applianceId.startsWith('SKILL_')) delay = 60000;
                                shQueryBlocker[applianceId] = setTimeout(() => {
                                    shQueryBlocker[applianceId] = null;
                                }, delay);
                                alexa.querySmarthomeDevices(applianceId, (err, res) => {
                                    if (!err) {
                                        updateSmarthomeDeviceStates(res);
                                    }
                                });
                            }.bind(alexa, shDevice.applianceId));
                        }
                    }
                }
                let allGroups = {};
                if (
                    res &&
                    res.locationDetails &&
                    res.locationDetails.Default_Location &&
                    res.locationDetails.Default_Location.applianceGroups &&
                    res.locationDetails.Default_Location.applianceGroups.applianceGroups
                ) {
                    allGroups = res.locationDetails.Default_Location.applianceGroups.applianceGroups;
                }
                for (let i of Object.keys(allGroups)) {
                    /*
                    "amzn1.HomeAutomation.ApplianceGroup.A3NSX4MMJVG96V.550a4bf5-4852-4a35-81c4-b3568b222033": {
                        "applianceGroupName": "Lichter Küche",
                        "applianceGroupIdentifier": {
                            "value": "amzn1.HomeAutomation.ApplianceGroup.A3NSX4MMJVG96V.550a4bf5-4852-4a35-81c4-b3568b222033"
                        },
                        "spaceTypes": [],
                        "children": [],
                        "alexaEndpoints": [],
                        "defaults": []
                    }
                    */
                    const groupData = allGroups[i];
                    const friendlyName = groupData.applianceGroupName;
                    const groupParamData = shGroupDetails[groupData.applianceGroupIdentifier.value];
                    if (!groupParamData) continue;
                    const groupIdShort = i.substr(i.lastIndexOf('.') + 1);
                    setOrUpdateObject('Smart-Home-Devices.' + groupIdShort, {
                        type: 'channel',
                        common: {
                            name: 'Gruppe ' + friendlyName,
                            role: 'channel'
                        },
                        native: {
                            friendlyName: friendlyName,
                            ids:  groupData.applianceGroupIdentifier.value,
                            object: groupData
                        }
                    });
                    setOrUpdateObject('Smart-Home-Devices.' + groupIdShort + '.#delete', {common: { type: 'boolean', read: false, write: true, role: 'button'}}, false, function (entityId, val) {
                        alexa.deleteSmarthomeGroup(entityId);
                        adapter.deleteChannel('Smart-Home-Devices', groupIdShort);
                    }.bind(alexa, i));

                    for (let param in groupParamData.parameters) {
                        if (!groupParamData.parameters.hasOwnProperty(param)) continue;
                        let obj = groupParamData.parameters[param];
                        if (obj.native && obj.native.hideInGroups) continue;
                        //obj.common.read = false;
                        setOrUpdateObject('Smart-Home-Devices.' + groupIdShort + '.' + obj.common.name, obj, null, function (entityId, paramName, applianceId, value) {
                            if (!obj.common.write) return;
                            const parameters = buildSmartHomeControlParameters(entityId, obj, paramName, value);

                            if (!behaviours[groupIdShort] || ! behaviours[groupIdShort].supportedOperations || !behaviours[groupIdShort].supportedOperations.includes(parameters.action)) {
                                adapter.log.info('Invalid action ' + parameters.action + ' provided for Group-Action ' + parameters.action + '. Report to developer this and next log line from logfile on disk!');
                                adapter.log.info(JSON.stringify(groupData) + ' / ' + JSON.stringify(behaviours[groupIdShort]));
                                return;
                            }

                            alexa.executeSmarthomeDeviceAction(groupIdShort, parameters, 'GROUP', (err, res) => {
                                if (!err && res && res.controlResponses && res.controlResponses[0] && res.controlResponses[0].code && res.controlResponses[0].code === 'SUCCESS') {
                                    if (obj.native.readable) {
                                        if (shQueryBlocker[applianceId]) {
                                            clearTimeout(shQueryBlocker[applianceId]);
                                            shQueryBlocker[applianceId] = null;
                                        }
                                        setTimeout(() => alexa.querySmarthomeDevices(applianceId, (err, res) => {
                                            if (!err) {
                                                updateSmarthomeDeviceStates(res);
                                            }
                                        }), 2000);
                                    }
                                }
                                else {
                                    updateSmarthomeDeviceStates(res);
                                }
                            });
                        }.bind(alexa, Object.keys(groupParamData.entityIds), obj.common.name, Object.keys(groupParamData.applianceIds)));

                    }
                }
                if (readableCounter) {
                    setOrUpdateObject('Smart-Home-Devices.queryAll', {common: { type: 'boolean', read: false, write: true, role: 'button'}}, false, (val) => {
                        queryAllSmartHomeDevices();
                    });
                }
                processObjectQueue(callback);
            });
        });
    });
}

function scheduleHistoryUpdate(delay) {
    if (delay === undefined) delay = adapter.config.updateHistoryInterval * 1000;
    if (updateHistoryTimer) {
        clearTimeout(updateHistoryTimer);
    }
    if (wsMqttConnected) return;
    updateHistoryTimer = setTimeout(() => {
        updateHistoryTimer = null;
        updateHistory();
    }, delay);
}

function updateHistory(callback) {
    if (updateHistoryTimer) {
        clearTimeout(updateHistoryTimer);
        updateHistoryTimer = null;
    }
    alexa.getActivities({size: 3, filter: true}, (err, res) => {
        if (err || !res) {
            if (adapter.config.updateHistoryInterval > 0) {
                scheduleHistoryUpdate();
            }
            return callback && callback();
        }

        adapter.getState('History.creationTime', (err, state) => {
            if (err || !state) {
                if (adapter.config.updateHistoryInterval > 0) {
                    scheduleHistoryUpdate();
                }
                return callback && callback();
            }

            let last = state.val;
            let i = res.length - 1;
            (function doIt() {
                if (i < 0) {
                    if (adapter.config.updateHistoryInterval > 0) {
                        scheduleHistoryUpdate();
                    }
                    return callback && callback();
                }

                let o = res[i--];
                if (last >= o.data.creationTimestamp) return doIt();

                updateHistoryStates(o);
                last = o.creationTimestamp;

                doIt();
            })();
        });
    });
}

/*
activityCardContent - > activity.domainAttributes.card.content
activityCard - > JSON.stringify(activity.domainAttributes.card)
*/

function updateHistoryStates(o) {
    adapter.setState('History.name', o.name, true);
    adapter.setState('History.serialNumber', o.deviceSerialNumber, true);
    adapter.setState('History.summary', o.description.summary, true);
    adapter.setState('History.status', o.activityStatus, true);
    adapter.setState('History.creationTime', o.creationTimestamp, true);

    const jsonHistory = {
        name: o.name,
        serialNumber: o.deviceSerialNumber,
        summary: o.description.summary,
        creationTime: o.creationTimestamp,
        status: o.activityStatus,
        domainApplicationId: '',
        domainApplicationName: '',
        cardContent: '',
        card: ''
    };

    if (o.domainAttributes) {
        if (o.domainAttributes.applicationMetadata) {
            adapter.setState('History.domainApplicationId', o.domainAttributes.applicationMetadata.applicationId || '', true);
            jsonHistory.domainApplicationId = o.domainAttributes.applicationMetadata.applicationId || '';
            adapter.setState('History.domainApplicationName', o.domainAttributes.applicationMetadata.applicationName || '', true);
            jsonHistory.domainApplicationName = o.domainAttributes.applicationMetadata.applicationName;
        }
        else {
            adapter.setState('History.domainApplicationId', '', true);
            adapter.setState('History.domainApplicationname', '', true);
        }
        if (o.domainAttributes.card) {
            adapter.setState('History.cardContent', o.domainAttributes.card.content || '', true);
            jsonHistory.cardContent = o.domainAttributes.card.content || '';
            adapter.setState('History.cardJson', JSON.stringify(o.domainAttributes.card), true);
            jsonHistory.card = o.domainAttributes.card;
        }
        else {
            adapter.setState('History.cardContent', '', true);
            adapter.setState('History.cardJson', '', true);
        }
    }
    else {
        adapter.setState('History.domainApplicationId', '', true);
        adapter.setState('History.domainApplicationname', '', true);
        adapter.setState('History.cardContent', '', true);
        adapter.setState('History.cardJson', '', true);
    }
    adapter.setState('History.json', JSON.stringify(jsonHistory), true);
}

function iterateMultiroom(device, commandCallback, doneCallback, counter) {
    if (!device.isMultiroomDevice) {
        return commandCallback(device, doneCallback);
    }
    if (counter === undefined) {
        adapter.log.debug('iterate START: ' + JSON.stringify(device.clusterMembers));
        counter = 0;
    }
    if (counter >= device.clusterMembers.length) {
        adapter.log.debug('iterate done ' + counter + ' vs. ' + device.clusterMembers.length);
        return doneCallback && doneCallback();
    }
    const currDevice = alexa.find(device.clusterMembers[counter]);
    counter++;
    if (!currDevice) {
        adapter.log.debug('iterate ' + counter + ': NOT FOUND');
        return iterateMultiroom(device, commandCallback, doneCallback, counter);
    }
    adapter.log.debug('iterate ' + counter + ': ' + currDevice.serialNumber);
    return commandCallback(currDevice, () => iterateMultiroom(device, commandCallback, doneCallback, counter));
}

function createStates(callback) {
    setOrUpdateObject('requestResult', {common: {name: 'Request Result', write: false, role: 'text'}}, '');
    setOrUpdateObject('Echo-Devices', {type: 'device', common: {name: 'Echo devices'}});

    Object.keys (alexa.serialNumbers).forEach ((n) => {
        let device = alexa.serialNumbers[n];
        let devId = 'Echo-Devices.' + device.serialNumber;

        createDeviceStates(device);

        if (device.isControllable) {
            playerDevices[device.serialNumber] = true;
            setOrUpdateObject(devId + '.Player', {type: 'channel'});

            setOrUpdateObject(devId + '.Player.contentType', {common: {role: 'text', write: false, def: ''}});	// 'LIVE_STATION' | 'TRACKS' | 'CUSTOM_STATION'
			setOrUpdateObject(devId + '.Player.currentState', {common: {role: 'media.state', write: false, def: false}}); // 'PAUSED' | 'PLAYING'
			setOrUpdateObject(devId + '.Player.imageURL', {common: {name: 'Huge image', role: 'media.cover.big', write: false, def: ''}});
			setOrUpdateObject(devId + '.Player.providerId', {common: {role: 'text', write: false, def: ''}}); // 'TUNE_IN' | 'CLOUD_PLAYER' | 'ROBIN'
			setOrUpdateObject(devId + '.Player.radioStationId', {common: {role: 'text', write: false, def: ''}}); // 's24885' | null
			setOrUpdateObject(devId + '.Player.service', {common: {role: 'text', write: false, def: ''}}); // 'TUNE_IN' | 'CLOUD_PLAYER' | 'PRIME_STATION'
			setOrUpdateObject(devId + '.Player.providerName', {common: {name: 'active provider', role: 'media.input', write: false, def: ''}}); // 'Amazon Music' | 'TuneIn Live-Radio'

			setOrUpdateObject(devId + '.Player.currentTitle', {common: {name:'current title', type:'string', role:'media.title', def: ''}});
			setOrUpdateObject(devId + '.Player.currentArtist', {common: {name:'current artist', type:'string', role:'media.artist', def: ''}});
			setOrUpdateObject(devId + '.Player.currentAlbum',	{common: {name:'current album', type:'string', role:'media.album', def: ''}});
            setOrUpdateObject(devId + '.Player.mainArtUrl', {common: {name:'current main Art', type:'string', role:'media.cover', def: ''}});
            setOrUpdateObject(devId + '.Player.miniArtUrl', {common: {name:'current mini Art', type:'string', role:'media.cover.small', def: ''}});

			setOrUpdateObject(devId + '.Player.mediaLength', {common: {name:'active media length', type:'number', role:'media.duration', def: 0}});
			setOrUpdateObject(devId + '.Player.mediaLengthStr', {common: {name:'active media length as (HH:)MM:SS', type:'string', role:'media.duration.text', def: ''}});
			setOrUpdateObject(devId + '.Player.mediaProgress',	 {common: {name:'active media progress', type:'number', role:'media.elapsed', def: 0}});
			setOrUpdateObject(devId + '.Player.mediaProgressStr', {common: {name:'active media progress as (HH:)MM:SS', type:'string', role:'media.elapsed.text', def: ''}});
			setOrUpdateObject(devId + '.Player.mediaProgressPercent', {common: {name:'active media progress as percent', type:'number', role:'media.elapsed.percent', def: 0}});

            for (let c in playerControls) {
                const obj = JSON.parse (JSON.stringify (playerControls[c]));
                setOrUpdateObject(devId + '.Player.' + c, {common: obj.common}, obj.val, alexa.sendCommand.bind(alexa, device, obj.command));
            }

            if (device.capabilities.includes ('VOLUME_SETTING')) {
                setOrUpdateObject(devId + '.Player.muted',	{common: {type: 'boolean', role: 'media.mute', write: false, def: false}});
                setOrUpdateObject(devId + '.Player.volume', {common: {role: 'level.volume', min: 0, max: 100}}, 0, function (device, value) {
                    if (device.isMultiroomDevice) {
                        alexa.sendCommand(device, 'volume', value, (err, res) => {
                            // on unavailability {"message":"No routes found","userFacingMessage":null}
                            if (res.message && res.message === 'No routes found') {
                                iterateMultiroom(device, (iteratorDevice, nextCallback) => alexa.sendSequenceCommand(iteratorDevice, 'volume', value, nextCallback));
                            }
                        });
                    }
                    else {
                        alexa.sendSequenceCommand(device, 'volume', value);
                    }
                }.bind(alexa, device));
            }

            if (device.hasMusicPlayer) {
                for (let c in musicControls) {
                    const obj = JSON.parse (JSON.stringify (musicControls[c]));
                    setOrUpdateObject(devId + '.Player.' + c, {common: obj.common}, obj.val, alexa.sendCommand.bind(alexa, device, obj.command));
                }
                setOrUpdateObject(devId + '.Music-Provider', {type: 'channel'});
                for (let p in musicProviders) {
                    if (musicProviders[p].availability !== 'AVAILABLE') continue;
                    if (!musicProviders[p].supportedOperations.includes('Alexa.Music.PlaySearchPhrase')) continue;
                    let displayName = musicProviders[p].displayName.replace(forbiddenCharacters, '-');

                    setOrUpdateObject(devId + '.Music-Provider.' + displayName, {common: {name:'Phrase to play with ' + musicProviders[p].displayName, type:'string', role:'text', def: ''}}, '', playMusicProvider.bind(alexa, device, musicProviders[p].id));
                    setOrUpdateObject(devId + '.Music-Provider.' + displayName + '-Playlist', {common: {name:'Playlist to play with ' + musicProviders[p].displayName, type:'string', role:'text', def: ''}}, '', function(device, providerId, value) {
                        if (value === '') return;
                        playMusicProvider(device, providerId, 'playlist ' + value);
                    }.bind(alexa, device, musicProviders[p].id));
                }
            }

            if (device.capabilities.includes ('TUNE_IN')) {
                setOrUpdateObject(devId + '.Player.TuneIn-Station', {common: {role: 'text'}}, '', function (device, query) {
                    if (query.match(/^s[0-9]+$/)) {
                        device.setTunein(query, 'station', (err, ret) => {
                            if (!err) {
                                adapter.setState(devId + '.Player.TuneIn-Station', query, true);
                                schedulePlayerUpdate(device, 5000);
                            }
                        });
                    } else if (query.match(/^p[0-9]+$/)) {
                        device.setTunein(query, 'show', (err, ret) => {
                            if (!err) {
                                adapter.setState(devId + '.Player.TuneIn-Station', query, true);
                                schedulePlayerUpdate(device, 5000);
                            }
                        });
                    } else if (query.match(/^t[0-9]+$/)) {
                        device.setTunein(query, 'topic', (err, ret) => {
                            if (!err) {
                                adapter.setState(devId + '.Player.TuneIn-Station', query, true);
                                schedulePlayerUpdate(device, 5000);
                            }
                        });
                    } else {
                        alexa.tuneinSearch(query, (err, res) => {
                            setRequestResult(err, res);
                            if (err || !res || !Array.isArray (res.browseList)) return;
                            let station = res.browseList[0];
                            device.setTunein(station.id, station.contentType, (err, ret) => {
                                if (!err) {
                                    adapter.setState('Echo-Devices.' + device.serialNumber + '.Player.TuneIn-Station', station.name, true);
                                    schedulePlayerUpdate(device, 5000);
                                }
                            });
                        });
                    }
                }.bind(alexa, device));
            }
        }
        createBluetoothStates(device);

        if (device.notifications) {
            createNotificationStates(device);
        }

        if (device.deviceTypeDetails.commandSupport) {
            setOrUpdateObject(devId + '.Commands', {type: 'channel'});
            for (let c in commands) {
                const obj = JSON.parse (JSON.stringify (commands[c]));
                setOrUpdateObject(devId + '.Commands.' + c, {common: obj.common}, obj.val, function (device, command, value) {
                    iterateMultiroom(device, (iteratorDevice, nextCallback) => alexa.sendSequenceCommand(iteratorDevice, command, value, nextCallback));
                }.bind(alexa, device, c));
            }
            setOrUpdateObject(devId + '.Commands.speak', {common: { role: 'media.tts'}}, '', function (device, value) {
                if (value === '') return;
                iterateMultiroom(device, (iteratorDevice, nextCallback) => {
                    let valueArr = value.match(/^(([^;0-9]+);)?(([0-9]{1,3});)?(.+)$/);
                    if (!valueArr) valueArr= [];
                    let speakVolume = valueArr[4] || iteratorDevice.speakVolume;
                    value = valueArr[5] || value;
                    if (!valueArr[4] && valueArr[1]) value = valueArr[1] + value;
                    adapter.getState('Echo-Devices.' + iteratorDevice.serialNumber + '.Player.volume', (err, state) => {
                        let speakVolumeReset = 0;
                        if (!err && state.val !== false && state.val !== null) {
                            speakVolumeReset = state.val;
                        }
                        let speakCommands = [];
                        if (speakVolume && speakVolume > 0) speakCommands.push({command: 'volume', value: speakVolume});
                        value.split(';').forEach((v) => {
                            if (!v || !v.length) return;
                            speakCommands.push({command: 'speak', value: v.trim()});
                        });
                        if (speakVolume && speakVolume > 0 && speakVolumeReset && speakVolumeReset > 0) speakCommands.push({command: 'volume', value: speakVolumeReset});
                        alexa.sendMultiSequenceCommand(iteratorDevice, speakCommands, nextCallback);
                    });
                });
            }.bind(alexa, device));
            if (!device.isMultiroomDevice) {
                if (existingStates[devId + '.Commands.speak-volume']) {
                    adapter.getState(devId + '.Commands.speak-volume', function (device, err, state) {
                        if (!err && state && state.val && state.val > 0) {
                            device.speakVolume = state.val;
                            adapter.log.debug('Initialize speak-Volume for ' + device.serialNumber + ': ' + state.val);
                        }
                    }.bind(alexa, device));
                }
                setOrUpdateObject(devId + '.Commands.speak-volume', {common: {name: 'Volume to use for speak commands', role: 'level.volume', min: 0, max: 100}}, null, function (device, value) {
                    device.speakVolume = value;
                    adapter.log.debug('Set speak-Volume for ' + device.serialNumber + ': ' + value);
                    adapter.setState(devId + '.Commands.speak-volume', value, true);
                }.bind(alexa, device));
            }
            setOrUpdateObject(devId + '.Commands.doNotDisturb', {common: {role: 'switch'}}, false, device.setDoNotDisturb);
        }

        if (!device.isMultiroomDevice && device.deviceTypeDetails.commandSupport) {
            if (automationRoutines) {
                setOrUpdateObject(devId + '.Routines', {type: 'channel'});
                for (let i in automationRoutines) {
                    if (!automationRoutines.hasOwnProperty(i)) continue;
                    setOrUpdateObject(devId + '.Routines.' + automationRoutines[i].friendlyAutomationId, {common: { type: 'boolean', role: 'button', name: automationRoutines[i].friendlyName}}, false, alexa.executeAutomationRoutine.bind(alexa, device, automationRoutines[i]));
                    if (automationRoutines[i].utteranceWords) routineTriggerUtterances[automationRoutines[i].utteranceWords.toLowerCase()] = devId + '.Routines.' + automationRoutines[i].friendlyAutomationId;
                }
            }
        }
    });

    setOrUpdateObject('History', {type: 'channel', common: {name: 'Last detected commands and devices'}});
    setOrUpdateObject('History.#trigger', {common: { type: 'boolean', read: false, write: true, role: 'button', name: 'Trigger/Rescan', desc: 'Set to true, to start a request'}}, false,
            (val) => updateHistory());
    setOrUpdateObject('History.name', {common: {role: 'text', write: false, name: 'Echo Device name', desc: 'Device name of the last detected command'}}, '');
    let now = new Date();
    now = now.getTime() - now.getTimezoneOffset();
    setOrUpdateObject('History.creationTime', {common: {role: 'value.time'}}, now);
    setOrUpdateObject('History.serialNumber', {common: {role: 'text', write: false}}, '');
    setOrUpdateObject('History.summary', {common: {role: 'text', write: false}}, '');
    setOrUpdateObject('History.status', {common: {role: 'text', write: false}}, '');
    setOrUpdateObject('History.domainApplicationId', {common: {role: 'text', write: false}}, '');
    setOrUpdateObject('History.domainApplicationName', {common: {role: 'text', write: false}}, '');
    setOrUpdateObject('History.cardContent', {common: {role: 'text', write: false}}, '');
    setOrUpdateObject('History.cardJson', {common: {role: 'text', write: false}}, '');
    setOrUpdateObject('History.json', {common: {type: 'string', role: 'json', write: false}}, '');

    if (adapter.config.bespokenToken && adapter.config.bespokenToken.length) {
        adapter.config.bespokenVoiceId = adapter.config.bespokenVoiceId || 'Hans';
        adapter.config.bespokenLocale = adapter.config.bespokenLocale || 'de-DE';
        bespokenDevice = bespokenDevice || new bespokenVdSDK.VirtualDevice(adapter.config.bespokenToken, adapter.config.bespokenLocale, adapter.config.bespokenVoiceId);

        setOrUpdateObject('Bespoken', {type: 'channel', common: {name: 'Bespoken virtual device'}});
        setOrUpdateObject('Bespoken.status', {common: { type: 'number', read: true, write: false, role: 'value', states: {0: 'OK', 1: 'PROCESSING', 2: 'FAILURE'}, name: 'Status der Bespoken Kommunikation'}}, 0);
        setOrUpdateObject('Bespoken.answer', {common: { type: 'string', read: true, write: false, role: 'text', name: 'Antwort'}}, '');
        setOrUpdateObject('Bespoken.answerJson', {common: { type: 'string', read: true, write: false, role: 'json', name: 'Antwort als JSON'}}, '');
        setOrUpdateObject('Bespoken.#sendText', {common: { type: 'string', read: false, write: true, role: 'media.tts', name: 'Sende Text'}}, '', (val) => {
            if (val === '') return;
            if (typeof val !== 'string') val = String(val);
            adapter.setState('Bespoken.status', 1, true);
            adapter.log.debug('Send "' + val + '" to Bespoken');
            bespokenDevice.message(val, false, val.split(' ')).then((result) => {
                adapter.log.debug('Received "' + JSON.stringify(result) + '" from Bespoken');
                adapter.setState('Bespoken.status', 0, true);
                let resultText = '';
                if (result && result.transcript) resultText = result.transcript;
                adapter.setState('Bespoken.answer', resultText, true);
                adapter.setState('Bespoken.answerJson', JSON.stringify(result), true);
            }).catch((e) => {
                adapter.setState('Bespoken.status', 2, true);
                adapter.setState('Bespoken.answerJson', JSON.stringify(e), true);
            });
        });

    }

    processObjectQueue(() => {
        scheduleStatesUpdate();
        updatePlayerStatus(() => {
            updateHistory(callback);
        });
    });
}

function playMusicProvider(device, providerId, value) {
    if (value === '') return;
    if (device.isMultiroomDevice && device.clusterMembers.length) {
        value += ' auf ' + device._name + ' ';
        device = alexa.find(device.clusterMembers[0]);
    }
    alexa.playMusicProvider(device, providerId, value.trim(), (err, res) => {
        schedulePlayerUpdate(device, 5000);
    });
}

function createDeviceStates(serialOrName) {
    let device = alexa.find(serialOrName);
    let devId = 'Echo-Devices.' + device.serialNumber;

    let deviceTypeDetails = knownDeviceType[device.deviceType];
    const commonDevice = {name: device._name};
    if (!deviceTypeDetails) {
        deviceTypeDetails =  {name: 'Unknown', commandSupport: false};
        adapter.log.warn('Disabling some commands for device because of unknown type. Report to developer as GitHub issue with details for device. Please grab full next line pot. from logfile on disk if cutted');
        adapter.log.warn('    Device-type:' + device.deviceType + ' (' + device.capabilities.join (',') + ')');
    } else if (deviceTypeDetails.icon) {
        commonDevice.icon = deviceTypeDetails.icon;
    }
    device.deviceTypeDetails = deviceTypeDetails;

    setOrUpdateObject(devId, {type: 'device', common: commonDevice});
    setOrUpdateObject(devId + '.online', {common: {role: 'indicator.reachable', type: 'boolean'}}, device.online);
    //setOrUpdateObject(devId + '.delete', {common: {name: 'Delete (Log out of this device)', role: 'button'}}, false); TODO

    setOrUpdateObject(devId + '.Info', {type: 'channel'});
    setOrUpdateObject(devId + '.Info.capabilities', {common: {role: 'text', write: false}}, device.capabilities.join (','));
    setOrUpdateObject(devId + '.Info.isMultiroomDevice', {common: {type: 'boolean', role: 'indicator', write: false}}, device.isMultiroomDevice);
    if (device.isMultiroomDevice) {
        setOrUpdateObject(devId + '.Info.multiroomMembers', {common: {role: 'text', write: false}}, device.clusterMembers.join (','));
    }
    setOrUpdateObject(devId + '.Info.isMultiroomMember', {common: {type: 'boolean', role: 'indicator', write: false}}, device.isMultiroomMember);
    if (device.isMultiroomMember) {
        setOrUpdateObject(devId + '.Info.multiroomParents', {common: {role: 'text', write: false}}, device.parentClusters.join (','));
    }
    setOrUpdateObject(devId + '.Info.deviceType', {common: {name:'deviceType', type:'string', role:'text'}}, device.deviceType || '');

    setOrUpdateObject(devId + '.Info.deviceTypeString',	{common: {name:'deviceType string', type:'string', role:'text'}}, deviceTypeDetails.name);
    setOrUpdateObject(devId + '.Info.serialNumber',	{common: {name:'serialNumber', type:'string', role:'text'}}, device.serialNumber);
    setOrUpdateObject(devId + '.Info.name',	{common: {name:'name', type:'string', role:'text'}}, device._name);
}

function updateDeviceStatus(serialOrName, callback) {
    if (typeof serialOrName === 'function') {
        callback = serialOrName;
        serialOrName = null;
    }
    if (serialOrName) serialOrName = alexa.find(serialOrName);

    alexa.initDeviceState(() => {
        Object.keys(alexa.serialNumbers).forEach ((n) => {
            let device = alexa.find(n);
            if (serialOrName && serialOrName !== device) return;

            createDeviceStates(device);
        });
        if (callback) {
            callback();
        }
        else {
            processObjectQueue();
        }
    });
}


function createBluetoothStates(serialOrName) {
    let device = alexa.find(serialOrName);
    let devId = 'Echo-Devices.' + device.serialNumber;

    if (device.bluetoothState && !device.isMultiroomDevice && device.deviceTypeDetails.commandSupport) {
        setOrUpdateObject(devId + '.Bluetooth', {type: 'device'});
        device.bluetoothState.pairedDeviceList.forEach ((bt) => {
            setOrUpdateObject(devId + '.Bluetooth.' + bt.address, {type: 'channel', common: {name: bt.friendlyName}});
            setOrUpdateObject(devId + '.Bluetooth.' + bt.address + '.connected', {common: {role: 'switch'}}, bt.connected, bt.connect);
            setOrUpdateObject(devId + '.Bluetooth.' + bt.address + '.unpair', {common: { type: 'boolean', read: false, write: true, role: 'button'}}, false, bt.unpaire);
        });
    }
}

function updateBluetoothStatus(serialOrName, callback) {
    if (!alexa._options.bluetooth) return callback && callback();
    if (typeof serialOrName === 'function') {
        callback = serialOrName;
        serialOrName = null;
    }
    if (serialOrName) serialOrName = alexa.find(serialOrName);

    alexa.initBluetoothState(() => {
        Object.keys(alexa.serialNumbers).forEach ((n) => {
            let device = alexa.find(n);
            if (serialOrName && serialOrName !== device) return;

            createBluetoothStates(device);
        });
        if (callback) {
            callback();
        }
        else {
            processObjectQueue();
        }
    });
}

function createNotificationStates(serialOrName) {
    let device = alexa.find(serialOrName);
    let devId = 'Echo-Devices.' + device.serialNumber;

    if (device.notifications) {
        if (device.capabilities.includes('REMINDERS')) {
            setOrUpdateObject(devId + '.Reminder', {type: 'device'});
            setOrUpdateObject(devId + '.Reminder.New', {common: {type: 'mixed', role: 'state', name: 'Add new Reminder'}}, '', function(device, value) {
                let valueArr = value.split(',');
                let time = valueArr.shift().trim();
                if (parseInt(time, 10) == time) time = parseInt(time, 10);
                const notification = alexa.createNotificationObject(device, 'Reminder', valueArr.join(',').trim(), time);
                if (notification) {
                    alexa.createNotification(notification, (err, res) => {
                        scheduleNotificationUpdate(device, 2000);
                    });
                }
            }.bind(alexa, device));
        }
        if (device.capabilities.includes('TIMERS_AND_ALARMS')) {
            setOrUpdateObject(devId + '.Alarm', {type: 'device'});
            setOrUpdateObject(devId + '.Alarm.New', {common: {type: 'mixed', role: 'state', name: 'Add new Alarm'}}, '', function(device, value) {
                let valueArr = value.split(',');
                let time = valueArr.shift().trim();
                if (parseInt(time, 10) == time) time = parseInt(time, 10);
                const notification = alexa.createNotificationObject(device, 'Alarm', valueArr.join(',').trim(), time);
                if (notification) {
                    alexa.createNotification(notification, (err, res) => {
                        scheduleNotificationUpdate(device, 2000);
                    });
                }
            }.bind(alexa, device));
            setOrUpdateObject(devId + '.Timer', {type: 'device'});
            setOrUpdateObject(devId + '.Timer.triggered', {common: {type: 'boolean', read: true, write: false, role: 'indicator', name: 'A timer got Triggered'}}, false);
        }
        for (let noti of device.notifications) {
            if (notificationTimer[noti.id]) {
                clearTimeout(notificationTimer[noti.id]);
                notificationTimer[noti.id] = null;
            }
            if (noti.type === 'Reminder' && !device.capabilities.includes('REMINDERS')) continue;
            if (noti.type === 'Alarm' && !device.capabilities.includes('TIMERS_AND_ALARMS')) continue;
            if (noti.type === 'Timer' && noti.status === 'ON' && noti.remainingTime > 0) {
                adapter.log.debug(noti.type + ' ' + noti.id + ' triggered in ' + Math.floor(noti.remainingTime / 1000) + 's');
                notificationTimer[noti.id] = setTimeout(function (noti) {
                    notificationTimer[noti.id] = null;
                    adapter.log.debug(noti.type + ' ' + noti.id + ' triggered');
                    adapter.setState(devId + '.Timer.triggered', true, true);
                }.bind(alexa, noti), noti.remainingTime);
            }
            if (noti.originalTime) {
                const id = noti.notificationIndex;
                let notiId = devId + '.' + noti.type + '.' + id;
                let time = noti.originalTime;
                if (time.endsWith('.000')) time = time.substr(0, time.length - 4);
                const displayTime = noti.originalTime.substr(0, noti.originalTime.length - 4);
                setOrUpdateObject(notiId, {type: 'channel', common: {name: noti.reminderLabel || displayTime}});
                setOrUpdateObject(notiId + '.time', {common: {type: 'mixed', role: 'state', name: noti.reminderLabel ? noti.reminderLabel : displayTime + ' Time'}}, time, noti.set);
                setOrUpdateObject(notiId + '.enabled', {common: {type: 'boolean', role: 'switch.enable', name: noti.reminderLabel ? noti.reminderLabel : displayTime + ' Enabled'}}, (noti.status === 'ON'), noti.set);
                setOrUpdateObject(notiId + '.triggered', {common: {type: 'boolean', read: true, write: false, role: 'indicator', name: noti.reminderLabel ? noti.reminderLabel : displayTime + ' Triggered'}}, false);
                if (noti.status === 'ON' && (noti.alarmTime || (noti.originalDate && noti.originalTime))) {
                    const alarmTime = new Date((noti.originalDate + ' ' + noti.originalTime).replace(/-/g,"/"));
                    const alarmDelay = alarmTime - new Date().getTime();
                    adapter.log.debug(noti.type + ' ' + noti.id + ' triggered in ' + Math.floor(alarmDelay / 1000) + 's');
                    if (alarmDelay > 0) {
                        notificationTimer[noti.id] = setTimeout(function (notiId, noti) {
                            notificationTimer[noti.id] = null;
                            adapter.log.debug(noti.type + ' ' + noti.id + ' triggered');
                            adapter.setState(notiId + '.triggered', true, true);
                        }.bind(alexa, notiId, noti), alarmDelay);
                    }
                }
            }
        }
    }
}

function updateNotificationStates(serialOrName, callback) {
    if (!alexa._options.notifications) return callback && callback();
    if (typeof serialOrName === 'function') {
        callback = serialOrName;
        serialOrName = null;
    }
    if (serialOrName) serialOrName = alexa.find(serialOrName);

    alexa.initNotifications(() => {
        Object.keys(alexa.serialNumbers).forEach ((n) => {
            let device = alexa.find(n);
            if (serialOrName && serialOrName !== device) return;

            createNotificationStates(device);
        });
        if (callback) {
            callback();
        }
        else {
            processObjectQueue();
        }
    });
}

function updatePlayerStatus(serialOrName, callback) {
    if (typeof serialOrName === 'function') {
        callback = serialOrName;
        serialOrName = null;
    }
    let serials;
    if (serialOrName) {
        serialOrName = alexa.find(serialOrName);
        if (!serialOrName) return callback && callback();
        serials = [serialOrName.serialNumber];
    }
    else {
        serials = Object.keys(playerDevices);
    }

    let i = 0;
    (function doIt() {
        if (i >= serials.length) {
            if (adapter.config.updateStateInterval > 0) {
                scheduleStatesUpdate();
            }
            return processObjectQueue(callback);
        }
        let device = alexa.find(serials[i++]);
        if (! device || !device.isControllable) return doIt();

        alexa.getPlayerInfo(device , (err, resPlayer) => {
            if (err || !resPlayer || !resPlayer.playerInfo) return doIt();
            alexa.getMedia(device, (err, resMedia) => {
                if (err || !resMedia) return doIt();
                let devId = 'Echo-Devices.' + device.serialNumber;
                if (lastPlayerState[device.serialNumber] && lastPlayerState[device.serialNumber].timeout) {
                    clearTimeout(lastPlayerState[device.serialNumber].timeout);
                }
                lastPlayerState[device.serialNumber] = {resPlayer: resPlayer, resMedia: resMedia, ts: Date.now(), devId: devId, timeout: null};

                if (device.capabilities.includes ('VOLUME_SETTING')) {
                    let volume = null;
                    if (resMedia.volume !== null) {
                        volume = ~~resMedia.volume;
                    }
                    else if (resPlayer.playerInfo && resPlayer.playerInfo.volume && resPlayer.playerInfo.volume && resPlayer.playerInfo.volume.volume !== null) {
                        volume = ~~resPlayer.playerInfo.volume.volume;
                    }
                    if (volume === 0 && device.isMultiroomDevice) volume = null;
                    if (volume !== null) adapter.setState(devId + '.Player.volume', volume, true);
                }
                if (resMedia.shuffling !== undefined) adapter.setState(devId + '.Player.controlShuffle', resMedia.shuffling, true);
                if (resMedia.looping !== undefined) adapter.setState(devId + '.Player.controlRepeat', resMedia.looping, true);
                //let muted = res.playerInfo.volume.muted;
                adapter.setState(devId + '.Player.controlPause', (resPlayer.playerInfo.state === 'PAUSED'), true);
                adapter.setState(devId + '.Player.controlPlay', (resPlayer.playerInfo.state === 'PLAYING'), true);

                //if (resPlayer.playerInfo.state !== null) adapter.setState(devId + '.Player.status', resPlayer.playerInfo.state, true);
                adapter.setState(devId + '.Player.contentType', resMedia.contentType || '', true);	// 'LIVE_STATION' | 'TRACKS' | 'CUSTOM_STATION'

                adapter.setState(devId + '.Player.currentState', resPlayer.playerInfo.state === 'PLAYING', true);	// 'PAUSED' | 'PLAYING'

                adapter.setState(devId + '.Player.imageURL', resMedia.imageURL || '', true);
                adapter.setState(devId + '.Player.muted', !!resMedia.muted, true);
                adapter.setState(devId + '.Player.providerId', resMedia.providerId || '', true); // 'TUNE_IN' | 'CLOUD_PLAYER' | 'ROBIN'
                adapter.setState(devId + '.Player.radioStationId', resMedia.radioStationId || '', true); // 's24885' | null
                adapter.setState(devId + '.Player.service', resMedia.service || '', true); // 'TUNE_IN' | 'CLOUD_PLAYER' | 'PRIME_STATION'

                let providerName = '';
                if (resPlayer.playerInfo !== undefined && 'provider' in resPlayer.playerInfo && resPlayer.playerInfo.provider !== null) {
                    providerName = resPlayer.playerInfo.provider.providerName;
                }
                adapter.setState(devId + '.Player.providerName', providerName || '',	true); // 'Amazon Music' | 'TuneIn Live-Radio'

                let title = '';
                let artist = '';
                let album = '';
                if (resPlayer.playerInfo !== undefined && 'infoText' in resPlayer.playerInfo && resPlayer.playerInfo.infoText !== null) {
                    title = resPlayer.playerInfo.infoText.title;
                    artist = resPlayer.playerInfo.infoText.subText1;
                    album = resPlayer.playerInfo.infoText.subText2;
                }
                adapter.setState(devId + '.Player.currentTitle', title || '', true);
                adapter.setState(devId + '.Player.currentArtist', artist || '', true);
                adapter.setState(devId + '.Player.currentAlbum', album || '', true);

                let mainArtUrl = '';
                if (resPlayer.playerInfo !== undefined && 'mainArt' in resPlayer.playerInfo && resPlayer.playerInfo.mainArt !== null) {
                    mainArtUrl = resPlayer.playerInfo.mainArt.url;
                }
                adapter.setState(devId + '.Player.mainArtUrl', mainArtUrl || '', true);

                let miniArtUrl = '';
                if (resPlayer.playerInfo !== undefined && 'miniArt' in resPlayer.playerInfo && resPlayer.playerInfo.miniArt !== null) {
                    miniArtUrl = resPlayer.playerInfo.miniArt.url;
                }
                adapter.setState(devId + '.Player.miniArtUrl', miniArtUrl || mainArtUrl || '', true);

                let mediaLength = 0;
                let mediaProgress = 0;
                let mediaProgressPercent = 0;
                if (resPlayer.playerInfo !== undefined && 'progress' in resPlayer.playerInfo && resPlayer.playerInfo.progress !== null) {
                    mediaLength = parseInt(resPlayer.playerInfo.progress.mediaLength, 10);
                    mediaProgress = parseInt(resPlayer.playerInfo.progress.mediaProgress, 10);
                    if (mediaLength > 0) {
                        mediaProgressPercent = Math.round(((mediaProgress * 100) / mediaLength));
                    }
                }
                adapter.setState(devId + '.Player.mediaLength', mediaLength || '', true);
                adapter.setState(devId + '.Player.mediaLengthStr',	sec2HMS(mediaLength) || '', true);
                adapter.setState(devId + '.Player.mediaProgress', mediaProgress || 0, true);
                adapter.setState(devId + '.Player.mediaProgressStr', sec2HMS(mediaProgress) || 0, true);
                adapter.setState(devId + '.Player.mediaProgressPercent', mediaProgressPercent || 0, true);

                if (resPlayer.playerInfo.state === 'PLAYING') {
                    lastPlayerState[device.serialNumber].timeout = setTimeout( () => {
                        lastPlayerState[device.serialNumber].timeout = null;
                        updateMediaProgress(device.serialNumber);
                    }, 2000);
                }
                doIt();
            });
        });
    })();
}

function initRoutines(callback) {
    alexa.getAutomationRoutines((err, routines) => {
        automationRoutines = [];
        routineTriggerUtterances = {};
        if (!err && routines) {
            for (let i = 0; i < routines.length; i++) {
                let routine = routines[i];
                if (routine['@type'] !== 'com.amazon.alexa.behaviors.model.Automation') {
                    adapter.log.debug('Ignore unknown type of Automation Routine ' + routine['@type']);
                    continue;
                }
                if (!routine.sequence) {
                    adapter.log.debug('Automation Routine has no sequence ' + JSON.stringify(routine));
                    continue;
                }
                let name = routine.name;
                let utteranceWords = null;
                if (!name && routine.triggers && routine.triggers[0].payload && routine.triggers[0].payload.utterance) {
                    name = routine.triggers[0].payload.utterance;
                    utteranceWords = routine.triggers[0].payload.utterance;
                }
                else if (!name && routine.triggers && routine.triggers[0].payload && routine.triggers[0].payload.schedule && routine.triggers[0].payload.schedule.triggerTime) {
                    name = routine.triggers[0].payload.schedule.triggerTime;
                    if (name.length === 6) name = name.replace(/^({0-9}{2})({0-9}{2})({0-9}{2})$/, '$1:$2:$3');
                    if (routine.triggers[0].payload.schedule.recurrence) name += ` ${routine.triggers[0].payload.schedule.recurrence}`;
                }
                else {
                    adapter.log.debug('Ignore unknown type of Automation Routine Trigger' + JSON.stringify(routine.triggers.payload));
                    name = 'Unknown';
                }
                routine.friendlyName = name;
                let idSplit = routine.automationId.split('.');
                routine.friendlyAutomationId = idSplit[idSplit.length - 1];
                routine.utteranceWords = utteranceWords;
                automationRoutines.push(routine);
            }
        }
        callback && callback();
    });
}

function loadExistingAccessories(callback) {
    adapter.getAdapterObjects((res) => {
        const objectKeys = Object.keys(res);
        for (let i = 0; i < objectKeys.length; i++) {
            if (objectKeys[i].indexOf(adapter.namespace + '.info') === 0) continue;
            existingStates[objectKeys[i].substr(adapter.namespace.length + 1)] = res[objectKeys[i]];
        }
        //adapter.log.debug('Existing States: ' + JSON.stringify(Object.keys(existingStates), null, 4));

        // devId + '.Bluetooth' = device , ChannelsOd = MACs
        // devId + '.Notifications' = channel, statesOf ??
        // devId + '.Routines' = channel, statesOf

        if (callback) callback();
    });
}


function main() {
    if (!adapter.config.proxyOwnIp) {
        const ifaces = os.networkInterfaces();
        for (const eth in ifaces) {
            if (!ifaces.hasOwnProperty(eth)) continue;
            for (let num = 0; num < ifaces[eth].length; num++) {
                if (ifaces[eth][num].family !== 'IPv6' && ifaces[eth][num].address !== '127.0.0.1' && ifaces[eth][num].address !== '0.0.0.0') {
                    adapter.config.proxyOwnIp = ifaces[eth][num].address;
                    adapter.log.info('Proxy IP not set, use first network interface (' + adapter.config.proxyOwnIp + ') instead');
                    break;
                }
            }
            if (adapter.config.proxyOwnIp) break;
        }
    }

    let options = {
        cookie: adapter.config.cookie, // cookie if there is already one
        email: adapter.config.email, // Amazon email for login
        password: adapter.config.password, // Amazon password for Login
        bluetooth: true, // fetch uetooth devices
        notifications: true, // fetch notifications (false because not works so far)
        userAgent: adapter.config.userAgent, // overwrite userAgent
        acceptLanguage: adapter.config.acceptLanguage, // overwrite acceptLanguage
        amazonPage: adapter.config.cookieLoginUrl, // overwrite amazonPage
        alexaServiceHost: adapter.config.alexaServiceHost, // overwrite alexa Servcie Host
        logger: adapter.log.debug, // Logger with detailed debug only in debug
        setupProxy: true,          // optional: should the library setup a proxy to get cookie when automatic way did not worked? Default false!
        proxyOwnIp: adapter.config.proxyOwnIp, // required if proxy enabled: provide own IP or hostname to later access the proxy. needed to setup all rewriting and proxy stuff internally
        proxyPort: adapter.config.proxyPort,           // optional: use this port for the proxy, default is 0 means random port is selected
        proxyListenBind: adapter.config.proxyListenBind,// optional: set this to bind the proxy to a special IP, default is '0.0.0.0'
        proxyLogLevel: null,      // optional: Loglevel of Proxy, default 'warn'
        useWsMqtt: adapter.config.usePushConnection
    };
    adapter.config.updateHistoryInterval = parseInt(adapter.config.updateHistoryInterval, 10);
    adapter.config.updateStateInterval = parseInt(adapter.config.updateStateInterval, 10);

    let initDone = false;

    alexa = new Alexa();

    alexa.on('ws-connect', () => {
        scheduleHistoryUpdate(2000);
        scheduleStatesUpdate(2000);
        wsMqttConnected = true;
        adapter.log.info('Alexa-Push-Connection established. Disable Polling');
    });

    alexa.on('ws-disconnect', (retries, msg) => {
        adapter.log.info('Alexa-Push-Connection disconnected' + (retries ? ' - retry' : ' - fallback to poll data') + ': ' + msg);
        scheduleHistoryUpdate(2000);
        scheduleStatesUpdate(2000);
    });

    alexa.on('ws-error', (error) => {
        adapter.log.info('Alexa-Push-Connection Error: ' + error);
    });

    alexa.on('ws-unknown-message', (incomingMsg) => {
        adapter.log.info('Alexa-Push-Connection Unknown Message - send to Developer: ' + incomingMsg);
    });

    alexa.on('ws-device-connection-change', (data) => {
        adapter.log.debug('Alexa-Push-Connection Device Connection change for ' + data.deviceSerialNumber + ' -> ' + data.connectionState);
        let device = alexa.find(data.deviceSerialNumber);
        if (!device) {
            adapter.log.warn('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
            return;
        }

        let devId = 'Echo-Devices.' + device.serialNumber;
        adapter.setState(devId + '.online', data.connectionState === 'ONLINE', true);
    });

    alexa.on('ws-bluetooth-state-change', (data) => {
        adapter.log.debug('Alexa-Push-Connection Bluetooth State change for ' + data.deviceSerialNumber + ' -> ' + data.bluetoothEvent);
        let device = alexa.find(data.deviceSerialNumber);
        if (!device) {
            adapter.log.warn('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
            return;
        }

        updateBluetoothStatus(device);
    });

    alexa.on('ws-audio-player-state-change', (data) => {
        adapter.log.debug('Alexa-Push-Connection Audio Player State change for ' + data.deviceSerialNumber + ' -> ' + data.audioPlayerState);
        let device = alexa.find(data.deviceSerialNumber);
        if (!device) {
            adapter.log.warn('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
            return;
        }

        if (data.audioPlayerState === 'INTERRUPTED' && lastPlayerState[device.serialNumber] && lastPlayerState[device.serialNumber].timeout) {
            clearTimeout(lastPlayerState[device.serialNumber].timeout);
            lastPlayerState[device.serialNumber].timeout = null;
        }
        schedulePlayerUpdate(device.serialNumber, 1000);
    });

    alexa.on('ws-media-queue-change', (data) => {
        adapter.log.debug('Alexa-Push-Connection Media Queue change for ' + data.deviceSerialNumber + ' -> ' + data.changeType);
        let device = alexa.find(data.deviceSerialNumber);
        if (!device) {
            adapter.log.warn('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
            return;
        }

        schedulePlayerUpdate(device.serialNumber, 1000);
    });

    alexa.on('ws-media-change', (data) => {
        adapter.log.debug('Alexa-Push-Connection Media change for ' + data.deviceSerialNumber);
        let device = alexa.find(data.deviceSerialNumber);
        if (!device) {
            adapter.log.warn('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
            return;
        }

        schedulePlayerUpdate(device.serialNumber, 1000);
    });

    alexa.on('ws-volume-change', (data) => {
        adapter.log.debug('Alexa-Push-Connection Device Volume change for ' + data.deviceSerialNumber + ' -> ' + data.volume + '/' + data.isMuted);
        let device = alexa.find(data.deviceSerialNumber);
        if (!device) {
            adapter.log.warn('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
            return;
        }

        let devId = 'Echo-Devices.' + device.serialNumber;
        let muted = !!data.isMuted;
        if (data.isMuted === null && data.volume === 0) muted = true;
        if (!muted) adapter.setState(devId + '.Player.volume', data.volume, true);
        adapter.setState(devId + '.Player.muted', muted, true);
    });

    alexa.on('ws-content-focus-change', (data) => {
        adapter.log.debug('Alexa-Push-Connection Content Focus change for ' + data.deviceSerialNumber);
        let device = alexa.find(data.deviceSerialNumber);
        if (!device) {
            adapter.log.warn('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
            return;
        }

        schedulePlayerUpdate(device.serialNumber, 1000);
    });

    alexa.on('ws-device-activity', (activity) => {
        adapter.log.debug('device-activity: ' + JSON.stringify(activity));
        if (activity.description.summary && routineTriggerUtterances[activity.description.summary.toLowerCase()]) {
            adapter.setState(routineTriggerUtterances[activity.description.summary.toLowerCase()], true, true);
        }
        updateHistoryStates(activity);
    });

    alexa.on('ws-unknown-command', (command, payload) => {
        adapter.log.info('Alexa-Push-Connection Unknown Command ' + command + ' - send to Developer: ' + JSON.stringify(payload));
    });

    alexa.on('ws-notification-change', (data) => {
        adapter.log.debug('notification-change: ' + JSON.stringify(data));
        if (notificationTimer[data.notificationId]) { // Remove Timer, will be reset if neeed in 2s
            clearTimeout(notificationTimer[data.notificationId]);
            notificationTimer[data.notificationId] = null;
        }
        if (data.eventType === 'DELETE') {
            let device = alexa.find(data.deviceSerialNumber);
            if (device && device.notifications) {
                for (let i = 0; i < device.notifications.length; i++) {
                    if (device.notifications[i].notificationIndex === data.notificationId) {
                        deleteObject('Echo-Devices.' + data.deviceSerialNumber + '.' + device.notifications[i].type + '.' + data.notificationId);
                        break;
                    }
                }
            }
        }
        scheduleNotificationUpdate(data.deviceSerialNumber, 2000);
    });

    alexa.init(options, err => {
        if (err) {
            if (err.message === 'no csrf found') {
                adapter.log.error('Error: no csrf found. Check configuration of email/password or cookie');
            } if (err.message.includes('entered on Login Page via Proxy differs from set')) {
                adapter.log.warn(err.message);
                return;
            }
            else {
                let lines = err.message.split('You can try to get the cookie');
                if (lines[1]) {
                    lines[1] = 'You can try to get the cookie' + lines[1];
                } else {
                    lines = err.message.split('\n');
                }
                lines.forEach(line => adapter.log.error('Error: ' + line));
            }
            adapter.setState('info.connection', false, true);
            return;
        }

        adapter.setState('info.connection', true, true);
        adapter.setState('info.cookie', alexa.cookie, true);
        adapter.setState('info.csrf', alexa.csrf, true);

        if (alexa.cookie !== adapter.config.cookie) {
            adapter.log.info('Update cookie in adapter configuration ... restarting ...');
            adapter.extendForeignObject('system.adapter.' + adapter.namespace, {native: {cookie: alexa.cookie, csrf: alexa.csrf}});
            return;
        }

        alexa.getMusicProviders((err, providers) => {
            musicProviders = [];
            if (!err && providers) {
                musicProviders = providers;
            }

            initRoutines(() => {
                createStates(() => {
                    createSmarthomeStates(() => {
                        queryAllSmartHomeDevices(true, () => {
                            if (!initDone) {
                                adapter.subscribeStates('*');
                                adapter.subscribeObjects('*');
                                initDone = true;
                                const delIds = Object.keys(existingStates);
                                if (delIds.length) {
                                    adapter.log.info('Deleting the following states: ' + JSON.stringify(delIds));
                                    for (let i = 0; i < delIds.length; i++) {
                                        adapter.delObject(delIds[i]);
                                        delete existingStates[delIds[i]];
                                    }
                                }
                            }
                        });
                    });
                });
            });
        });
    });
}
