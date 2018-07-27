/* jshint -W097 */
/* jshint -W030 */
/* jshint strict: false */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

const Alexa = require('alexa-remote2');
const path = require('path');
const os = require('os');
const utils = require(path.join(__dirname, 'lib', 'utils')); // Get common adapter utils

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
    'A15ERDAKK5HQQG':   {name: 'Sonos', commandSupport: false, icon: 'icons/sonos.png'}, //? AUDIO_PLAYER,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,AMAZON_MUSIC,TUNE_IN,PANDORA,REMINDERS,I_HEART_RADIO,CHANGE_NAME,VOLUME_SETTING,PEONY
    'A1DL2DVDQVK3Q':	{name: 'Apps', commandSupport: false}, // (PEONY,VOLUME_SETTING)
    'A1NL4BVLQ4L3N3':	{name: 'Echo Show', commandSupport: true, icon: 'icons/echo_show.png'},
    'A2825NDLA7WDZV':   {name: 'Apps', commandSupport: false}, // PEONY,VOLUME_SETTING
    'A2E0SNTXJVT7WK':   {name: 'Fire TV V1', commandSupport: false, icon: 'icons/firetv.png'},
    'A2GFL5ZMWNE0PX':   {name: 'Fire TV', commandSupport: true, icon: 'icons/firetv.png'}, // SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,VOLUME_SETTING,SUPPORTS_SOFTWARE_VERSION,CHANGE_NAME,ACTIVE_AFTER_FRO,ARTHUR_TARGET,FLASH_BRIEFING
    'A2IVLV5VM2W81':    {name: 'Apps', commandSupport: false},
    'A2LWARUGJLBYEW':   {name: 'Fire TV Stick V2', commandSupport: false, icon: 'icons/firetv.png'},
    'A2M35JJZWCQOMZ':   {name: 'Echo Plus', commandSupport: true},
    'A2OSP3UA4VC85F':   {name: 'Sonos', commandSupport: true, icon: 'icons/sonos.png'}, // DEREGISTER_DEVICE,SUPPORTS_CONNECTED_HOME_CLOUD_ONLY,CHANGE_NAME,KINDLE_BOOKS,AUDIO_PLAYER,TIMERS_AND_ALARMS,VOLUME_SETTING,PEONY,AMAZON_MUSIC,REMINDERS,SLEEP,I_HEART_RADIO,AUDIBLE,GOLDFISH,TUNE_IN,DREAM_TRAINING,PERSISTENT_CONNECTION
    'A2T0P32DY3F7VB':   {name: 'echosim.io', commandSupport: false},
    'A2TF17PFR55MTB':   {name: 'Apps', commandSupport: false}, // VOLUME_SETTING
    'A3C9PE6TNYLTCH':   {name: 'Multiroom', commandSupport: false}, // AUDIO_PLAYER,AMAZON_MUSIC,KINDLE_BOOKS,TUNE_IN,AUDIBLE,PANDORA,I_HEART_RADIO,SALMON,VOLUME_SETTING
    'A3H674413M2EKB':   {name: 'echosim.io', commandSupport: false},
    'A3R9S4ZZECZ6YL':   {name: 'Fire Tab', commandSupport: false, icon: 'icons/firetab.png'}, // ASX_TIME_ZONE,PEONY,VOLUME_SETTING,SUPPORTS_SOFTWARE_VERSION
    'A3S5BH2HU6VAYF':   {name: 'Echo Dot 2.Gen', commandSupport: true, icon: '/icons/echo_dot.png'},
    'A7WXQPH584YP':     {name: 'Echo 2.Gen', commandSupport: true, icon: '/icons/echo2.png'},
    'AB72C64C86AW2':    {name: 'Echo', commandSupport: true, icon: '/icons/echo.png'},
    'ADVBD696BHNV5':    {name: 'Fire TV Stick V1', commandSupport: false, icon: 'icons/firetv.png'},
    'AILBSA2LNTOYL':    {name: 'reverb App', commandSupport: false, icon: 'icons/reverb.png'}
};

let updateStateTimer;
let updateHistoryTimer;

const stateChangeTrigger = {};
const objectQueue = [];
const lastPlayerState = {};

function setOrUpdateObject(id, obj, value, stateChangeCallback, createNow) {
    let callback = null;
    if (typeof value === 'function') {
        createNow = stateChangeCallback;
        stateChangeCallback = value;
        value = null;
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
        else {
            obj.common.type = 'mixed';
        }
    }
    if (obj.common && obj.common.read === undefined) {
        obj.common.read = !(obj.common.type === 'boolean' && !!stateChangeCallback);
    }
    if (obj.common && obj.common.write === undefined) {
        obj.common.write = !!stateChangeCallback;
    }
    if (obj.common && obj.common.def === undefined && value !== null && value !== undefined) {
        obj.common.def = value;
    }
    if (obj.common && obj.common.name === undefined) {
        obj.common.name = id.split('.').pop();
    }

    objectQueue.push({
        id: id,
        value: value,
        obj: obj,
        stateChangeCallback: stateChangeCallback
    });

    if (createNow) {
        processObjectQueue(callback);
    }
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

    if (typeof stateChangeTrigger[id] === 'function') stateChangeTrigger[id](state.val);

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
        main();
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

function scheduleStatesUpdate(delay) {
    if (delay === undefined) delay = adapter.config.updateStateInterval * 1000;
    if (updateStateTimer) {
        clearTimeout(updateStateTimer);
    }
    updateStateTimer = setTimeout(() => {
        updateStateTimer = null;
        alexa.updateStates();
    }, delay);
}

Alexa.prototype.updateStates = function (callback) {
    if (!this.devices || !this.devices.length) return callback && callback();
    let self = this;
    let i = 0;

    if (updateStateTimer) {
        clearTimeout(updateStateTimer);
        updateStateTimer = null;
    }

    (function doIt() {
        if (i >= self.devices.length) {
            if (adapter.config.updateStateInterval > 0) {
                scheduleStatesUpdate();
            }
            return callback && callback();
        }
        let device = self.devices[i++];
        if (!device.isControllable) return doIt();

        self.getPlayerInfo(device , (err, resPlayer) => {
            if (err || !resPlayer || !resPlayer.playerInfo) return doIt();
            self.getMedia(device, (err, resMedia) => {
                if (err || !resMedia) return doIt();
                let devId = 'Echo-Devices.' + device.serialNumber;
                if (lastPlayerState[device.serialNumber] && lastPlayerState[device.serialNumber].timeout) {
                    clearTimeout(lastPlayerState[device.serialNumber].timeout);
                }
                lastPlayerState[device.serialNumber] = {resPlayer: resPlayer, resMedia: resMedia, ts: Date.now(), devId: devId, timeout: null};

                if (resMedia.volume) {
                    adapter.setState(devId + '.Player.volume', ~~resMedia.volume, true);
                }
                else if (resPlayer.playerInfo.volume) {
                    adapter.setState(devId + '.Player.volume', ~~resPlayer.playerInfo.volume.volume, true);
                }
                if (resMedia.shuffling !== undefined) adapter.setState(devId + '.Player.shuffle', resMedia.shuffling, true);
                if (resMedia.looping !== undefined) adapter.setState(devId + '.Player.repeat', resMedia.looping, true);
                //let muted = res.playerInfo.volume.muted;
                adapter.setState(devId + '.Player.pause', (resPlayer.playerInfo.state === 'PAUSED'), true);
                adapter.setState(devId + '.Player.play', (resPlayer.playerInfo.state === 'PLAYING'), true);

                //if (resPlayer.playerInfo.state !== null) adapter.setState(devId + '.Player.status', resPlayer.playerInfo.state, true);
                adapter.setState(devId + '.Player.contentType', resMedia.contentType || '', true);	// 'LIVE_STATION' | 'TRACKS' | 'CUSTOM_STATION'

                adapter.setState(devId + '.Player.currentState', resPlayer.playerInfo.state === 'PLAYING', true);	// 'PAUSED' | 'PLAYING'

                adapter.setState(devId + '.Player.imageURL', resMedia.imageURL || '', true);
    			adapter.setState(devId + '.Player.muted', !!resMedia.muted || '', true);
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
};

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


Alexa.prototype.delayedCreateSmarthomeStates = function (delay, callback) {
    setTimeout(this.createSmarthomeStates.bind(this, callback), delay);
};

Alexa.prototype.createSmarthomeStates = function (callback) {
    this.getSmarthomeDevices((err, res) => {
        if (err || !res) return callback(err);
        setOrUpdateObject('Smart-Home-Devices', {type: 'device', common: {name: 'Smart Home Devices'}});

        setOrUpdateObject('Smart-Home-Devices.deleteAll', {common: { type: 'boolean', read: false, write: true, role: 'button'}}, false, (val) => {
            this.deleteAllSmarthomeDevices((err, res) => {
                adapter.deleteDevice('Smart-Home-Devices', () => {
                    this.delayedCreateSmarthomeStates(1000);
                });
            });
        });
        setOrUpdateObject('Smart-Home-Devices.discoverDevices', {common: {name: 'Let Alexa search for devices', type: 'boolean', read: false, write: true, role: 'button'}}, false, (val) => {
            this.discoverSmarthomeDevice((err, res) => {
                this.delayedCreateSmarthomeStates(0);
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
                    this.deleteSmarthomeDevice(n);
                    adapter.deleteChannel('Smart-Home-Devices', entityId);
                }.bind(this, skill.entityId));
            }
        }
        processObjectQueue(callback);
    });
};

function scheduleHistoryUpdate(delay) {
    if (delay === undefined) delay = adapter.config.updateHistoryInterval * 1000;
    if (updateHistoryTimer) {
        clearTimeout(updateHistoryTimer);
    }
    updateHistoryTimer = setTimeout(() => {
        updateHistoryTimer = null;
        alexa.updateHistory();
    }, delay);
}

Alexa.prototype.updateHistory = function (callback) {
    if (updateHistoryTimer) {
        clearTimeout(updateHistoryTimer);
        updateHistoryTimer = null;
    }
    this.getHistory({size: 3, filter: true}, (err, res) => {
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

                adapter.setState('History.name', o.name, true);
                adapter.setState('History.serialNumber', o.serialNumber, true);
                adapter.setState('History.summary', o.description.summary, true);
                adapter.setState('History.creationTime', o.data.creationTimestamp, true);
                const jsonHistory = {name: o.name, serialNumber: o.serialNumber, summary: o.description.summary, creationTime: o.data.creationTimestamp};
                adapter.setState('History.json', JSON.stringify(jsonHistory), true);
                last = o.data.creationTimestamp;
                doIt();
            })();
        });
    });
};

Alexa.prototype.iterateMultiroom = function (device, commandCallback, doneCallback, counter) {
    if (!device.isMultiroomDevice) {
        return commandCallback(device, doneCallback);
    }
    if (!counter) counter = 0;
    console.log(counter);
    if (counter >= device.clusterMembers) {
        return doneCallback && doneCallback();
    }
    const currDevice = this.find(device.clusterMembers[counter]);
    if (!currDevice) {
        return this.iterateMultiroom(device, commandCallback, doneCallback, ++counter);
    }
    return commandCallback(currDevice, () => this.iterateMultiroom(device, commandCallback, doneCallback, ++counter));
};

Alexa.prototype.createStates = function (callback) {

    let self = this;
    setOrUpdateObject('requestResult', {common: {name: 'Request Result', write: false, role: 'text'}}, '');
    setOrUpdateObject('Echo-Devices', {type: 'device', common: {name: 'Echo devices'}});

    Object.keys (this.serialNumbers).forEach ((n) => {
        let device = this.serialNumbers[n];
        let devId = 'Echo-Devices.' + device.serialNumber;
        let deviceTypeDetails = knownDeviceType[device.deviceType];
        const commonDevice = {name: device._name};
        if (deviceTypeDetails) {
            if (deviceTypeDetails.icon) {
                commonDevice.icon = deviceTypeDetails.icon;
            }
            if (deviceTypeDetails.name) {
                commonDevice.desc = deviceTypeDetails.name;
            }
        }

        setOrUpdateObject(devId, {type: 'device', common: commonDevice});
        //dev.setName(device.accountName); TODO
        setOrUpdateObject(devId + '.online', {common: {role: 'indicator.reachable'}}, device.online);
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
        if (!deviceTypeDetails) {
            deviceTypeDetails =  {name: 'Unknown', commandSupport: false};
            adapter.log.warn('Unknown Device type ' + device.deviceType + ' (' + device.capabilities.join (',') + ') - please report to developer!');
        }
        setOrUpdateObject(devId + '.Info.deviceTypeString',	{common: {name:'deviceType string', type:'string', role:'text'}}, deviceTypeDetails.name);
        setOrUpdateObject(devId + '.Info.serialNumber',	{common: {name:'serialNumber', type:'string', role:'text'}}, device.serialNumber);
        setOrUpdateObject(devId + '.Info.name',	{common: {name:'name', type:'string', role:'text'}}, device._name);


        if (device.isControllable) {
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
                setOrUpdateObject(devId + '.Player.volume', {common: {role: 'level.volume', min: 0, max: 100}}, 0, (value) => {
                    if (device.isMultiroomDevice) {
                        this.sendCommand(device, 'volume', value, (err, res) => {
                            // on unavailability {"message":"No routes found","userFacingMessage":null}
                            if (res.message && res.message === 'No routes found') {
                                this.iterateMultiroom(device, (iteratorDevice, nextCallback) => this.sendSequenceCommand(iteratorDevice, 'volume', value, nextCallback));
                            }
                        });
                    }
                    else {
                        this.sendSequenceCommand(device, 'volume', value);
                    }
                });
            }

            if (device.hasMusicPlayer) {
                for (let c in musicControls) {
                    const obj = JSON.parse (JSON.stringify (musicControls[c]));
                    setOrUpdateObject(devId + '.Player.' + c, {common: obj.common}, obj.val, alexa.sendCommand.bind(alexa, device, obj.command));
                }
                setOrUpdateObject(devId + '.Music-Provider', {type: 'channel'});
                for (let p in this.musicProviders) {
                    if (this.musicProviders[p].availability !== 'AVAILABLE') continue;
                    if (!this.musicProviders[p].supportedOperations.includes('Alexa.Music.PlaySearchPhrase')) continue;
                    setOrUpdateObject(devId + '.Music-Provider.' + this.musicProviders[p].displayName, {common: {name:'Phrase to play with ' + this.musicProviders[p].displayName, type:'string', role:'text', def: ''}}, '', (value) => {
                        if (value === '') return;
                        if (device.isMultiroomDevice && device.clusterMembers.length) {
                            value += ' auf multiroom music';
                            device = this.find(device.clusterMembers[0]);
                        }
                        this.playMusicProvider(device, this.musicProviders[p].id, value, (err, res) => {
                            scheduleStatesUpdate(5000);
                        });
                    });
                }
            }

            if (device.capabilities.includes ('TUNE_IN')) {
                setOrUpdateObject(devId + '.Player.TuneIn-Direct', {common: {role: 'text'}}, '', function (device, query) {
                    if (query.match(/^s[0-9]{4,6}$/)) {
                        device.setTunein(query, 'station', (err, ret) => {
                            if (!err) {
                                adapter.setState(devId + '.Player.TuneIn-Direct', query, true);
                                scheduleStatesUpdate(5000);
                            }
                        });
                    } else {
                        this.tuneinSearch(query, (err, res) => {
                            setRequestResult(err, res);
                            if (err || !res || !Array.isArray (res.browseList)) return;
                            let station = res.browseList[0];
                            device.setTunein(station.id, station.contentType, (err, ret) => {
                                if (!err) {
                                    adapter.setState('Echo-Devices.' + device.serialNumber + '.Player.TuneIn-Direct', station.name, true);
                                    scheduleStatesUpdate(5000);
                                }
                            });
                        });
                    }
                }.bind(alexa, device));
            }
        }
        if (device.bluetoothState && !device.isMultiroomDevice && deviceTypeDetails.commandSupport) {
            setOrUpdateObject(devId + '.Bluetooth', {type: 'device'});
            device.bluetoothState.pairedDeviceList.forEach ((bt) => {
                setOrUpdateObject(devId + '.Bluetooth.' + bt.address, {type: 'channel', common: {name: bt.friendlyName}});
                setOrUpdateObject(devId + '.Bluetooth.' + bt.address + '.connected', {common: {role: 'switch'}}, bt.connected, bt.connect);
                setOrUpdateObject(devId + '.Bluetooth.' + bt.address + '.unpaire', {common: { type: 'boolean', read: false, write: true, role: 'button'}}, false, bt.unpaire);
            });
        }

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

        if (deviceTypeDetails.commandSupport) {
            setOrUpdateObject(devId + '.Commands', {type: 'channel'});
            for (let c in commands) {
                const obj = JSON.parse (JSON.stringify (commands[c]));
                setOrUpdateObject(devId + '.Commands.' + c, {common: obj.common}, obj.val, (value) => this.iterateMultiroom(device, (iteratorDevice, nextCallback) => this.sendSequenceCommand(iteratorDevice, c, value, nextCallback)));
            }
            setOrUpdateObject(devId + '.Commands.doNotDisturb', {common: {role: 'switch'}}, false, device.setDoNotDisturb);
        }

        if (!device.isMultiroomDevice && deviceTypeDetails.commandSupport) {
            if (this.routines) {
                setOrUpdateObject(devId + '.Routines', {type: 'channel'});
                for (let i in this.routines) {
                    if (this.routines.hasOwnProperty(i)) {
                        setOrUpdateObject(devId + '.Routines.' + this.routines[i].friendlyAutomationId, {common: { type: 'boolean', read: false, role: 'button', name: this.routines[i].friendlyName}}, false, alexa.executeAutomationRoutine.bind (alexa, device, this.routines[i].automationId));
                    }
                }
            }
        }
    });

    setOrUpdateObject('History', {type: 'channel', common: {name: 'Last detected commands and devices'}});
    setOrUpdateObject('History.#trigger', {common: { type: 'boolean', read: false, write: true, role: 'button', name: 'Trigger/Rescan', desc: 'Set to true, to start a request'}}, false,
            val => this.updateHistory());
    setOrUpdateObject('History.name', {common: {role: 'text', write: false, name: 'Echo Device name', desc: 'Device name of the last detected command'}}, '');
    let now = new Date();
    now = now.getTime() - now.getTimezoneOffset();
    setOrUpdateObject('History.creationTime', {common: {role: 'value.time'}}, now);
    setOrUpdateObject('History.serialNumber', {common: {role: 'text', write: false}}, '');
    setOrUpdateObject('History.summary', {common: {role: 'text', write: false}}, '');
    setOrUpdateObject('History.json', {common: {type: 'string', role: 'json', write: false}}, '');

    processObjectQueue(() => {
        self.updateStates(() => {
            self.updateHistory(callback);
        });
    });
};

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
        proxyLogLevel: null      // optional: Loglevel of Proxy, default 'warn'
    };
    adapter.config.updateHistoryInterval = parseInt(adapter.config.updateHistoryInterval, 10);
    adapter.config.updateStateInterval = parseInt(adapter.config.updateStateInterval, 10);

    let initDone = false;

    alexa = new Alexa();
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

        alexa.createStates(() => {
            alexa.createSmarthomeStates(() => {
                if (!initDone) {
                    adapter.subscribeStates ('*');
                    adapter.subscribeObjects ('*');
                    initDone = true;
                }
            });
        });
    });
}
