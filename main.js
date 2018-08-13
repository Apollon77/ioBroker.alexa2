/* jshint -W097 */
/* jshint -W083 */
/* jshint -W030 */
/* jshint strict: false */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

const Alexa = require('alexa-remote2');
const path = require('path');
const os = require('os');
const utils = require(path.join(__dirname, 'lib', 'utils')); // Get common adapter utils

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
    tellstory: { val: false, common: { type: 'boolean', read: false, write: true, role: 'button'}},
    speak: { val: '', common: { role: 'media.tts'}}
};

const knownDeviceType = {
    'A10A33FOX2NUBK':   {name: 'Echo Spot', commandSupport: true, icon: 'icons/spot.png'},
    'A12GXV8XMS007S':   {name: 'FireTV', commandSupport: false, icon: 'icons/firetv.png'}, //? CHANGE_NAME,MICROPHONE,SUPPORTS_SOFTWARE_VERSION,ARTHUR_TARGET,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,ACTIVE_AFTER_FRO,FLASH_BRIEFING,VOLUME_SETTING
    'A15ERDAKK5HQQG':   {name: 'Sonos', commandSupport: false, icon: 'icons/sonos.png'}, //? AUDIO_PLAYER,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,AMAZON_MUSIC,TUNE_IN,PANDORA,REMINDERS,I_HEART_RADIO,CHANGE_NAME,VOLUME_SETTING,PEONY
    'A1DL2DVDQVK3Q':	{name: 'Apps', commandSupport: false}, // (PEONY,VOLUME_SETTING)
    'A1NL4BVLQ4L3N3':	{name: 'Echo Show', commandSupport: true, icon: 'icons/echo_show.png'},
    'A2825NDLA7WDZV':   {name: 'Apps', commandSupport: false}, // PEONY,VOLUME_SETTING
    'A2E0SNTXJVT7WK':   {name: 'Fire TV V1', commandSupport: false, icon: 'icons/firetv.png'},
    'A2GFL5ZMWNE0PX':   {name: 'Fire TV', commandSupport: true, icon: 'icons/firetv.png'}, // SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,VOLUME_SETTING,SUPPORTS_SOFTWARE_VERSION,CHANGE_NAME,ACTIVE_AFTER_FRO,ARTHUR_TARGET,FLASH_BRIEFING
    'A2IVLV5VM2W81':    {name: 'Apps', commandSupport: false},
    'A2LWARUGJLBYEW':   {name: 'Fire TV Stick V2', commandSupport: false, icon: 'icons/firetv.png'}, // ACTIVE_AFTER_FRO,FLASH_BRIEFING,ARTHUR_TARGET,CHANGE_NAME,VOLUME_SETTING,SUPPORTS_SOFTWARE_VERSION,MICROPHONE,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY
    'A2M35JJZWCQOMZ':   {name: 'Echo Plus', commandSupport: true},
    'A2OSP3UA4VC85F':   {name: 'Sonos', commandSupport: true, icon: 'icons/sonos.png'}, // DEREGISTER_DEVICE,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,CHANGE_NAME,KINDLE_BOOKS,AUDIO_PLAYER,TIMERS_AND_ALARMS,VOLUME_SETTING,PEONY,AMAZON_MUSIC,REMINDERS,SLEEP,I_HEART_RADIO,AUDIBLE,GOLDFISH,TUNE_IN,DREAM_TRAINING,PERSISTENT_CONNECTION
    'A2T0P32DY3F7VB':   {name: 'echosim.io', commandSupport: false},
    'A2TF17PFR55MTB':   {name: 'Apps', commandSupport: false}, // VOLUME_SETTING
    'A38BPK7OW001EX':   {name: 'Raspberry Alexa', commandSupport: false, icon: 'icons/raspi.png'}, // TIMERS_AND_ALARMS,AMAZON_MUSIC,VOLUME_SETTING,AUDIBLE,I_HEART_RADIO,TUNE_IN,KINDLE_BOOKS,DEREGISTER_DEVICE,AUDIO_PLAYER,SLEEP,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,PERSISTENT_CONNECTION,DREAM_TRAINING,MICROPHONE,GOLDFISH,CHANGE_NAME,PEONY
    'A3C9PE6TNYLTCH':   {name: 'Multiroom', commandSupport: true}, // AUDIO_PLAYER,AMAZON_MUSIC,KINDLE_BOOKS,TUNE_IN,AUDIBLE,PANDORA,I_HEART_RADIO,SALMON,VOLUME_SETTING
    'A3H674413M2EKB':   {name: 'echosim.io', commandSupport: false},
    'A3HF4YRA2L7XGC':   {name: 'Fire TV Cube', commandSupport: true}, // FLASH_BRIEFING,TUNE_IN,PANDORA,FAR_FIELD_WAKE_WORD,DREAM_TRAINING,AMAZON_MUSIC,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,AUDIBLE,SUPPORTS_SOFTWARE_VERSION,PAIR_BT_SINK,CHANGE_NAME,AUDIO_PLAYER,VOICE_TRAINING,SET_LOCALE,EARCONS,SOUND_SETTINGS,SALMON,ACTIVE_AFTER_FRO,SLEEP,I_HEART_RADIO,TIMERS_AND_ALARMS,CUSTOM_ALARM_TONE,PERSISTENT_CONNECTION,ARTHUR_TARGET,KINDLE_BOOKS,REMINDERS
    'A3NPD82ABCPIDP':   {name: 'Sonos Beam', commandSupport: true}, // AMAZON_MUSIC,CHANGE_NAME,AUDIO_PLAYER,KINDLE_BOOKS,SLEEP,DREAM_TRAINING,AUDIBLE,DEREGISTER_DEVICE,I_HEART_RADIO,GOLDFISH,PERSISTENT_CONNECTION,MICROPHONE,TIMERS_AND_ALARMS,PEONY,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,REMINDERS,VOLUME_SETTING,TUNE_IN
    'A3R9S4ZZECZ6YL':   {name: 'Fire Tab HD 10', commandSupport: true, icon: 'icons/firetab.png'}, // ASX_TIME_ZONE,PEONY,VOLUME_SETTING,SUPPORTS_SOFTWARE_VERSION
    'A3S5BH2HU6VAYF':   {name: 'Echo Dot 2.Gen', commandSupport: true, icon: '/icons/echo_dot.png'},
    'A7WXQPH584YP':     {name: 'Echo 2.Gen', commandSupport: true, icon: '/icons/echo2.png'},
    'AB72C64C86AW2':    {name: 'Echo', commandSupport: true, icon: '/icons/echo.png'},
    'ADVBD696BHNV5':    {name: 'Fire TV Stick V1', commandSupport: false, icon: 'icons/firetv.png'},
    'AILBSA2LNTOYL':    {name: 'reverb App', commandSupport: false, icon: 'icons/reverb.png'}
};

let updateStateTimer;
let updateHistoryTimer;
let updatePlayerTimer = {};

let musicProviders;
let automationRoutines;
let playerDevices = {};

const stateChangeTrigger = {};
const objectQueue = [];
const lastPlayerState = {};
let wsMqttConnected = false;

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
        obj.common.read = !(obj.common.type === 'boolean' && !!stateChangeCallback);
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

    if (adapterObjects[id] && isEquivalent(obj, adapterObjects[id])) {
        //adapter.log.debug('Object unchanged for ' + id + ' - update only: ' + JSON.stringify(value));
        if (value !== undefined) adapter.setState(id, value, true);
        if (stateChangeCallback) stateChangeTrigger[id] = stateChangeCallback;
        return;
    }

    objectQueue.push({
        id: id,
        value: value,
        obj: obj,
        stateChangeCallback: stateChangeCallback
    });
    adapterObjects[id] = JSON.parse(JSON.stringify(obj));
    if (existingStates[id]) delete(existingStates[id]);
    //adapter.log.debug('Create object for ' + id + ': ' + JSON.stringify(obj) + ' with value: ' + JSON.stringify(value));

    if (createNow) {
        processObjectQueue(callback);
    }
}

function isEquivalent(a, b) {
    //adapter.log.debug('Compare ' + JSON.stringify(a) + ' with ' +  JSON.stringify(b));
    // Create arrays of property names
    var aProps = Object.getOwnPropertyNames(a);
    var bProps = Object.getOwnPropertyNames(b);

    // If number of properties is different,
    // objects are not equivalent
    if (aProps.length != bProps.length) {
        return false;
    }

    for (var i = 0; i < aProps.length; i++) {
        var propName = aProps[i];

        if (typeof a[propName] !== typeof b[propName]) {
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

    scheduleStatesUpdate(3000);
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
    if (delay === undefined) delay = adapter.config.updateStateInterval * 1000;
    if (updateStateTimer) {
        clearTimeout(updateStateTimer);
    }
    if (wsMqttConnected) return;
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
			scheduleStatesUpdate(2000);
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
}


function createSmarthomeStates(callback) {
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

        let all = [];
        if (
            res &&
            res.locationDetails &&
            res.locationDetails.Default_Location &&
            res.locationDetails.Default_Location.amazonBridgeDetails &&
            res.locationDetails.Default_Location.amazonBridgeDetails.amazonBridgeDetails
        ) {
            all = res.locationDetails.Default_Location.amazonBridgeDetails.amazonBridgeDetails;
        }
        let k = Object.keys(all);
        for (let i of k) {
            for (let n of Object.keys(all[i].applianceDetails.applianceDetails)) {
                let skill = all[i].applianceDetails.applianceDetails[n];
                setOrUpdateObject('Smart-Home-Devices.' + skill.entityId, {
                    type: 'channel',
                    common: {
                        name: skill.modelName,
                        role: 'channel'
                    },
                    native: {
                        friendlyDescription: skill.friendlyDescription,
                        friendlyName: skill.friendlyName,
                        ids:  skill.additionalApplianceDetails.additionalApplianceDetails.ids,
                        object: n,
                        manufacturerName: skill.manufacturerName,
                    }
                });
                setOrUpdateObject('Smart-Home-Devices.' + skill.entityId + '.isEnabled', {common: {role: 'indicator', write: false}}, skill.isEnabled);
                setOrUpdateObject('Smart-Home-Devices.' + skill.entityId + '.delete', {common: { type: 'boolean', read: false, write: true, role: 'button'}}, false, function (entityId, val) {
                    alexa.deleteSmarthomeDevice(n);
                    adapter.deleteChannel('Smart-Home-Devices', entityId);
                }.bind(alexa, skill.entityId));
            }
        }
        processObjectQueue(callback);
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
    if (!counter) counter = 0;
    if (counter >= device.clusterMembers.length) {
        return doneCallback && doneCallback();
    }
    const currDevice = alexa.find(device.clusterMembers[counter]);
    counter++;
    if (!currDevice) {
        return iterateMultiroom(device, commandCallback, doneCallback, counter);
    }
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
			setOrUpdateObject(devId + '.Player.muted',	{common: {type: 'boolean', role: 'media.mute', write: false, def: false}});
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

                    setOrUpdateObject(devId + '.Music-Provider.' + displayName, {common: {name:'Phrase to play with ' + musicProviders[p].displayName, type:'string', role:'text', def: ''}}, '', function (device, providerId, value) {
                        if (value === '') return;
                        if (device.isMultiroomDevice && device.clusterMembers.length) {
                            value += ' auf ' + device._name + ' music';
                            device = alexa.find(device.clusterMembers[0]);
                        }
                        alexa.playMusicProvider(device, providerId, value, (err, res) => {
                            scheduleStatesUpdate(5000);
                        });
                    }.bind(alexa, device, musicProviders[p].id));
                }
            }

            if (device.capabilities.includes ('TUNE_IN')) {
                setOrUpdateObject(devId + '.Player.TuneIn-Station', {common: {role: 'text'}}, '', function (device, query) {
                    if (query.match(/^s[0-9]{4,6}$/)) {
                        device.setTunein(query, 'station', (err, ret) => {
                            if (!err) {
                                adapter.setState(devId + '.Player.TuneIn-Station', query, true);
                                scheduleStatesUpdate(5000);
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
                                    scheduleStatesUpdate(5000);
                                }
                            });
                        });
                    }
                }.bind(alexa, device));
            }
        }
        createBluetoothStates(device);

        if (device.notifications) {
            setOrUpdateObject(devId + '.Notifications', {type: 'channel'});
            for (let noti of device.notifications) {
                if (noti.originalTime) {
                    let ar = noti.originalTime.split (':');
                    ar.length = 2;
                    let s = ar.join (':');
                    setOrUpdateObject(devId + '.Notifications.' + s, {common: {type: 'mixed', role: 'state', name: `Type=${noti.type}`}}, (noti.status === 'ON'), noti.set);
                }
            }
        }

        if (device.deviceTypeDetails.commandSupport) {
            setOrUpdateObject(devId + '.Commands', {type: 'channel'});
            for (let c in commands) {
                const obj = JSON.parse (JSON.stringify (commands[c]));
                setOrUpdateObject(devId + '.Commands.' + c, {common: obj.common}, obj.val, function (device, command, value) {
                    iterateMultiroom(device, (iteratorDevice, nextCallback) => alexa.sendSequenceCommand(iteratorDevice, command, value, nextCallback));
                }.bind(alexa, device, c));
            }
            setOrUpdateObject(devId + '.Commands.doNotDisturb', {common: {role: 'switch'}}, false, device.setDoNotDisturb);
        }

        if (!device.isMultiroomDevice && device.deviceTypeDetails.commandSupport) {
            if (automationRoutines) {
                setOrUpdateObject(devId + '.Routines', {type: 'channel'});
                for (let i in automationRoutines) {
                    if (automationRoutines.hasOwnProperty(i)) {
                        setOrUpdateObject(devId + '.Routines.' + automationRoutines[i].friendlyAutomationId, {common: { type: 'boolean', read: false, role: 'button', name: automationRoutines[i].friendlyName}}, false, alexa.executeAutomationRoutine.bind(alexa, device, automationRoutines[i]));
                    }
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

    processObjectQueue(() => {
        scheduleStatesUpdate();
        updatePlayerStatus(() => {
            updateHistory(callback);
        });
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
            setOrUpdateObject(devId + '.Bluetooth.' + bt.address + '.unpaire', {common: { type: 'boolean', read: false, write: true, role: 'button'}}, false, bt.unpaire);
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

                if (resMedia.volume) {
                    adapter.setState(devId + '.Player.volume', ~~resMedia.volume, true);
                }
                else if (resPlayer.playerInfo && resPlayer.playerInfo.volume && resPlayer.playerInfo.volume) {
                    adapter.setState(devId + '.Player.volume', ~~resPlayer.playerInfo.volume.volume, true);
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
                if (!name && routine.triggers && routine.triggers[0].payload && routine.triggers[0].payload.utterance) {
                    name = routine.triggers[0].payload.utterance;
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
        notifications: false, // fetch notifications (false because not works so far)
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
        if (updateStateTimer) {
            clearTimeout(updateStateTimer);
            updateStateTimer = null;
        }
        if (updateHistoryTimer) {
            clearTimeout(updateHistoryTimer);
            updateHistoryTimer = null;
        }
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
        adapter.log.info('Alexa-Push-Connection Device Connection change for ' + data.deviceSerialNumber + ' -> ' + data.connectionState);
        let device = alexa.find(data.deviceSerialNumber);
        if (!device) {
            adapter.log.warn('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
            return;
        }

        let devId = 'Echo-Devices.' + device.serialNumber;
        adapter.setState(devId + '.online', data.connectionState === 'ONLINE', true);
    });

    alexa.on('ws-bluetooth-state-change', (data) => {
        adapter.log.info('Alexa-Push-Connection Bluetooth State change for ' + data.deviceSerialNumber + ' -> ' + data.bluetoothEvent);
        let device = alexa.find(data.deviceSerialNumber);
        if (!device) {
            adapter.log.warn('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
            return;
        }

        updateBluetoothStatus(device);
    });

    alexa.on('ws-audio-player-state-change', (data) => {
        adapter.log.info('Alexa-Push-Connection Audio Player State change for ' + data.deviceSerialNumber + ' -> ' + data.audioPlayerState);
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
        adapter.log.info('Alexa-Push-Connection Media Queue change for ' + data.deviceSerialNumber + ' -> ' + data.changeType);
        let device = alexa.find(data.deviceSerialNumber);
        if (!device) {
            adapter.log.warn('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
            return;
        }

        schedulePlayerUpdate(device.serialNumber, 1000);
    });

    alexa.on('ws-volume-change', (data) => {
        adapter.log.info('Alexa-Push-Connection Device Volume change for ' + data.deviceSerialNumber + ' -> ' + data.volume + '/' + data.isMuted);
        let device = alexa.find(data.deviceSerialNumber);
        if (!device) {
            adapter.log.warn('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
            return;
        }

        let devId = 'Echo-Devices.' + device.serialNumber;
        adapter.setState(devId + '.Player.volume', data.volume, true);
        adapter.setState(devId + '.Player.muted', !!data.isMuted, true);
    });

    alexa.on('ws-content-focus-change', (data) => {
        adapter.log.info('Alexa-Push-Connection Content Focus change for ' + data.deviceSerialNumber);
        let device = alexa.find(data.deviceSerialNumber);
        if (!device) {
            adapter.log.warn('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
            return;
        }

        schedulePlayerUpdate(device.serialNumber, 1000);
    });

    alexa.on('ws-device-activity', (activity) => {
        adapter.log.debug('device-activity: ' + JSON.stringify(activity));
        updateHistoryStates(activity);
    });

    alexa.on('ws-unknown-command', (payload) => {
        adapter.log.info('Alexa-Push-Connection Unknown Command - send to Developer: ' + JSON.stringify(payload));
    });

    alexa.on('ws-notification-change', (data) => {
        //adapter.log.debug('notification-change');
        // TODO
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
                        if (!initDone) {
                            adapter.subscribeStates('*');
                            adapter.subscribeObjects('*');
                            initDone = true;
                            adapter.log.info('Check - I would delete the following states: ' + JSON.stringify(Object.keys(existingStates)));
                        }
                    });
                });
            });
        });
    });
}
