import * as utils from '@iobroker/adapter-core';
import AlexaRemote from 'alexa-remote2';
import type { InitOptions } from 'alexa-remote2';
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { rrulestr } from 'rrule';

import {
    ALL_DEVICES_COMMANDS,
    COMMANDS,
    FIRE_TV_COMMANDS,
    KNOWN_DEVICE_TYPES,
    LIST_ITEMS_OBJECTS,
    LIST_OBJECTS,
    MUSIC_CONTROLS,
    PLAYER_CONTROLS,
} from './lib/constants';
import * as shObjects from './lib/smarthomedevices';
import { getStatusInfoText } from './lib/statusTexts';
import type {
    AdapterObjectDefinition,
    AdditionalDeviceData,
    AlexaCookieData,
    AlexaDevice,
    AlexaList,
    AlexaListItem,
    AlexaListItemInput,
    AlexaNotificationFactory,
    AlexaRemoteInstance,
    AllDeviceVolumesResponse,
    AmazonJson,
    AscendingAlarmStatesResponse,
    AutomationRoutine,
    AuxControllerStateResponse,
    BluetoothPairedDevice,
    CommContactEntry,
    CommConversationsResponse,
    CommHomeGroupResponse,
    CrashCheckData,
    DeviceNotificationDefaultSoundResponse,
    DeviceNotificationState,
    DeviceNotificationStateResponse,
    DevicePreferencesResponse,
    DeviceWifiDetails,
    DoNotDisturbResponse,
    EqualizerEnabledResponse,
    EqualizerRangeResponse,
    EqualizerSettingsResponse,
    HistoryJson,
    LastPlayerState,
    MacDms,
    MultiroomCommandCallback,
    NotificationActiveTimer,
    NotificationEntry,
    NotificationRecurrence,
    NotificationSoundDefinition,
    NotificationSoundsResponse,
    NotificationVolumeRestoreCallback,
    NotificationsResponse,
    ObjectQueueEntry,
    PlayerStatusData,
    RoutineSkillCatalogResponse,
    RoutineSoundEntry,
    SentryLike,
    SequenceCommandEntry,
    SequenceCommandMessage,
    SequenceCommandValue,
    ShAlexaRemoteApi,
    ShApplianceEntityInfo,
    ShBehaviourEntity,
    ShControlParameters,
    ShDeviceParamControlValue,
    ShDeviceStatesResponse,
    ShGroupDetails,
    ShQueryProperty,
    ShQueryRequestEntry,
    ShStateDefinitionEx,
    StateChangeCallback,
    TuneinSearchResponse,
    WsAudioPlayerStateChangePayload,
    WsBluetoothStateChangePayload,
    WsContentFocusChangePayload,
    WsDeviceActivityPayload,
    WsDeviceConnectionChangePayload,
    WsEqualizerStateChangePayload,
    WsMediaChangePayload,
    WsMediaQueueChangePayload,
    WsNotificationChangePayload,
    WsTodoChangePayload,
    WsVolumeChangePayload,
} from './lib/types';

/** Only disable for development! */
const USE_CRASH_CHECK = true;

/** Adapter root directory. __dirname is build/ now, but all files are still stored next to package.json */
const ADAPTER_DIR = join(__dirname, '..');

class Alexa2Adapter extends utils.Adapter {
    /** Assigned in main() before anything else uses it */
    private alexa!: AlexaRemoteInstance;
    private Sentry: SentryLike | null = null;
    private stopped = false;

    private unknownDeviceWarnings: Record<string, boolean> = {};

    private proxyUrl: string | null = null;

    private resetCrashCheckerTimeout: ioBroker.Timeout | null | undefined = null;
    private updateStateTimer: ioBroker.Timeout | null | undefined = null;
    private updateHistoryTimer: ioBroker.Timeout | null | undefined = null;
    private updateConfigurationTimer: ioBroker.Timeout | null | undefined = null;
    private updateSmartHomeDevicesTimer: ioBroker.Timeout | null | undefined = null;
    private updatePlayerTimer: Record<string, ioBroker.Timeout | null | undefined> = {};
    private updateNotificationTimer: Record<string, ioBroker.Timeout | null | undefined> = {};

    /** undefined until fetched in main() */
    private musicProviders: AmazonJson[] | undefined;
    /** undefined until fetched in main() */
    private routineSounds: Record<string, string> | undefined;
    /** undefined until fetched in main() */
    private routineSkills: Record<string, string> | undefined;
    private rememberedNotificationVolumeRestoreCallbacks: Record<string, NotificationVolumeRestoreCallback> = {};
    private initialDeviceVolumes: Record<string, AmazonJson> = {};
    /** undefined until fetched in initRoutines() */
    private automationRoutines: AmazonJson[] | undefined;
    /** serialNumber -> utterance (lower case) -> state id */
    private routineTriggerUtterances: Record<string, Record<string, string>> | undefined;
    private playerDevices: Record<string, boolean> = {};
    private playingDevices: Record<string, boolean> = {};
    private appDevices: Record<string, AlexaDevice> = {};
    /** listId -> object id part of the list */
    private listMap: Record<string, string> = {};
    private equalizerUpdateTimeouts: Record<string, ioBroker.Timeout | undefined> = {};

    private lastPlayerState: Record<string, LastPlayerState> = {};
    private notificationTimer: Record<string, ioBroker.Timeout | null | undefined> = {};
    private pushConnected = false;
    private shApplianceEntityMap: Record<string, ShApplianceEntityInfo> = {};
    private shEntityApplianceMap: Record<string, string> = {};
    private shMergedApplianceIdMap: Record<string, string> = {};
    private shGroupDetails: Record<string, ShGroupDetails> = {};
    private shDeviceParamValues: Record<string, ioBroker.StateValue> = {};
    private shQueryBlocker: Record<string, ioBroker.Timeout | null | undefined> = {};
    private shQueryEnabled: Record<string, boolean> = {};
    private shDeviceParamControlValues: Record<string, ShDeviceParamControlValue> = {};
    private shDeviceRefreshTimeoutAfterControl: Record<string, ioBroker.Timeout | null | undefined> = {};
    private shDeviceDiscoveryTimeout: ioBroker.Timeout | null | undefined = null;

    private stateChangeTrigger: Record<string, StateChangeCallback | undefined> = {};
    private objectQueue: ObjectQueueEntry[] = [];

    private existingStates: Record<string, AdapterObjectDefinition> = {};
    private adapterObjects: Record<string, AdapterObjectDefinition> = {};

    private crashCheckFileName = '';
    private isCrashStop = false;
    private initDone = false;
    /** Never assigned, only used in a Sentry message (as before) */
    private installationUuid: string | undefined;

    private shdCounters: Record<'getSkill' | 'get' | 'setSkill' | 'set', number> = {
        getSkill: 0,
        get: 0,
        setSkill: 0,
        set: 0,
    };
    private checkerInterval: ioBroker.Interval | null | undefined = null;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'alexa2' });

        process.on('uncaughtException', () => {
            this.isCrashStop = true;
        });
        process.on('unhandledRejection', () => {
            this.isCrashStop = true;
        });

        this.on('unload', callback => this.onUnload(callback));
        this.on('stateChange', (id, state) => this.onStateChange(id, state));
        this.on('objectChange', (id, obj) => this.onObjectChange(id, obj));
        this.on('message', msg => this.processMessage(msg));
        this.on('ready', () => this.onReady());
    }

    private onReady(): void {
        this.initSentry(() => {
            // Intentionally kept as before: checkInstanceObject() is started first and calls main() when done,
            // loadExistingAccessories() runs in parallel to it (the original code passed the *result* of
            // checkInstanceObject(main) - undefined - as callback to loadExistingAccessories()).
            this.checkInstanceObject(() => this.main());
            this.loadExistingAccessories();
        });
    }

    /** Find a device by serial number or name. alexa-remote2 types the result as `Serial | string` only */
    private findDevice(serialOrName: string | AlexaDevice): AlexaDevice | null {
        return this.alexa.find(serialOrName) as AlexaDevice | null;
    }

    // ---- converted from main.js (part A) ----
    private onUnload(callback: () => void): void {
        this.stopped = true;
        if (this.resetCrashCheckerTimeout) {
            this.clearTimeout(this.resetCrashCheckerTimeout);
            if (!this.isCrashStop) {
                try {
                    if (existsSync(this.crashCheckFileName)) {
                        unlinkSync(this.crashCheckFileName);
                    }
                } catch (err) {
                    this.log.error(`Error deleting crashCheck file: ${(err as Error).message}`);
                }
            }
        }
        this.checkerInterval && this.clearInterval(this.checkerInterval);
        this.updateSmartHomeDevicesTimer && this.clearTimeout(this.updateSmartHomeDevicesTimer);
        this.updateStateTimer && this.clearTimeout(this.updateStateTimer);
        this.updateConfigurationTimer && this.clearTimeout(this.updateConfigurationTimer);
        this.updateHistoryTimer && this.clearTimeout(this.updateHistoryTimer);
        Object.keys(this.notificationTimer).forEach(
            timer => this.notificationTimer[timer] && this.clearTimeout(this.notificationTimer[timer]),
        );
        Object.keys(this.updateNotificationTimer).forEach(
            timer => this.updateNotificationTimer[timer] && this.clearTimeout(this.updateNotificationTimer[timer]),
        );
        Object.keys(this.updatePlayerTimer).forEach(
            timer => this.updatePlayerTimer[timer] && this.clearTimeout(this.updatePlayerTimer[timer]),
        );
        Object.keys(this.lastPlayerState).forEach(
            timer =>
                this.lastPlayerState[timer] &&
                this.lastPlayerState[timer].timeout &&
                this.clearTimeout(this.lastPlayerState[timer].timeout),
        );
        Object.keys(this.shDeviceRefreshTimeoutAfterControl).forEach(
            timer =>
                this.shDeviceRefreshTimeoutAfterControl[timer] &&
                this.clearTimeout(this.shDeviceRefreshTimeoutAfterControl[timer]),
        );

        if (this.alexa) {
            this.alexa.stop();
        }
        callback && callback();
    }

    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        this.log.debug(`State changed ${id}: ${JSON.stringify(state)}`);
        if (!state || state.ack) {
            return;
        }
        id = id.substring(this.namespace.length + 1);

        if (
            state &&
            state.val &&
            state.from &&
            state.from.startsWith('system.adapter.cloud') &&
            id.endsWith('.Commands.speak')
        ) {
            // NOTE: '/  /g' is a string, not a RegExp - only the literal text "/  /g" would be replaced (kept as before)
            state.val = (state.val as string).replace(/<[^>]+>/g, '').replace('/  /g', ' ');
        }

        const stateChangeCallback = this.stateChangeTrigger[id];
        if (typeof stateChangeCallback === 'function') {
            const adapterObject = this.adapterObjects[id];
            if (
                adapterObject &&
                adapterObject.common &&
                adapterObject.common.type &&
                adapterObject.common.type !== 'mixed'
            ) {
                if (
                    adapterObject.common.type === 'boolean' &&
                    adapterObject.common.role &&
                    adapterObject.common.role.startsWith('button')
                ) {
                    state.val = !!state.val;
                }
                if (typeof state.val !== adapterObject.common.type) {
                    this.log.error(
                        `Datatype "${typeof state.val}" for ${id} differs from expected "${adapterObject.common.type}", ignore state change! Please write correct datatype`,
                    );
                    return;
                }
            }
            stateChangeCallback(state.val);
        }

        if (!this.pushConnected) {
            this.scheduleStatesUpdate(3000);
        }
    }

    private onObjectChange(id: string, object: ioBroker.Object | null | undefined): void {
        if (!this.initDone) {
            return;
        }
        this.log.debug(`Object changed ${id}: ${JSON.stringify(object)}`);
        if (!id || !id.startsWith(`${this.namespace}.Echo-Devices.`)) {
            return;
        }
        const ar = id.split('.');
        if (ar[2] === 'Echo-Devices' && ar.length === 4) {
            if (object === null) {
                //deleted, do nothing
                return;
            }
            const device = this.alexa.serialNumbers[ar[3]] as AlexaDevice | undefined;
            if (
                device &&
                object &&
                object.common &&
                object.common.name &&
                device._name &&
                object.common.name !== device._name
            ) {
                if (typeof device.rename === 'function') {
                    // common.name is a plain string for these objects (the adapter only writes strings)
                    device.rename(object.common.name as string);
                }
            }
        }
    }

    private setOrUpdateObject(
        id: string,
        obj: AdapterObjectDefinition,
        value?: ioBroker.StateValue | StateChangeCallback,
        stateChangeCallback?: StateChangeCallback | boolean | null,
        createNow?: boolean | (() => void),
    ): void {
        let callback: (() => void) | null = null;
        if (typeof value === 'function') {
            // shifted form: setOrUpdateObject(id, obj, stateChangeCallback, createNow?)
            createNow = stateChangeCallback as boolean | (() => void) | undefined;
            stateChangeCallback = value;
            value = undefined;
        }
        if (typeof createNow === 'function') {
            callback = createNow;
            createNow = true;
        }

        if (!obj.type) {
            obj.type = 'state';
        }
        if (!obj.common) {
            obj.common = {};
        }
        if (!obj.native) {
            obj.native = {};
        }
        if (obj.common && obj.common.type === undefined && obj.type === 'state') {
            if (value !== null && value !== undefined) {
                // value is a primitive here: 'string' | 'number' | 'boolean' (as before, no further check)
                obj.common.type = typeof value as ioBroker.CommonType;
            } else if (obj.common.def !== undefined) {
                obj.common.type = typeof obj.common.def as ioBroker.CommonType;
            } else if (obj.common.min !== undefined || obj.common.max !== undefined) {
                obj.common.type = 'number';
            } else {
                obj.common.type = 'mixed';
            }
        }
        if (obj.common && obj.common.read === undefined) {
            obj.common.read = true; //!(obj.common.type === 'boolean' && !!stateChangeCallback);
        }
        if (obj.common && obj.common.write === undefined) {
            obj.common.write = !!stateChangeCallback;
        }
        /*
        if (obj.common && obj.common.def === undefined && value !== null && value !== undefined) {
            obj.common.def = value;
        }*/
        if (obj.common && obj.common.name === undefined) {
            obj.common.name = id.split('.').pop();
        }

        let preserveSettings: ioBroker.ExtendObjectOptionsPreserve | undefined;
        if (obj.preserveSettings) {
            preserveSettings = obj.preserveSettings;
            delete obj.preserveSettings;
        }

        if (!this.adapterObjects[id] && this.existingStates[id]) {
            this.adapterObjects[id] = this.existingStates[id];
            const adapterObject = this.adapterObjects[id];
            if (adapterObject.from) {
                delete adapterObject.from;
            }
            if (adapterObject.ts) {
                delete adapterObject.ts;
            }
            if (adapterObject.acl) {
                delete adapterObject.acl;
            }
            if (adapterObject._id) {
                delete adapterObject._id;
            }
            if (obj.common && adapterObject.common) {
                if (obj.common.def === undefined && adapterObject.common.def !== undefined) {
                    delete adapterObject.common.def;
                }
                if (obj.common.unit === undefined && adapterObject.common.unit !== undefined) {
                    delete adapterObject.common.unit;
                }
                if (obj.common.min === undefined && adapterObject.common.min !== undefined) {
                    delete adapterObject.common.min;
                }
                if (obj.common.max === undefined && adapterObject.common.max !== undefined) {
                    delete adapterObject.common.max;
                }
            }
            //value = undefined; // when exists and it is first time do not overwrite value!
        }
        if (this.existingStates[id]) {
            delete this.existingStates[id];
        }
        let queueObj: AdapterObjectDefinition | null = obj;
        if (this.adapterObjects[id] && this.isEquivalent(obj, this.adapterObjects[id])) {
            //this.log.debug('Object unchanged for ' + id + ': ' + JSON.stringify(this.adapterObjects[id]) + ' - update only: ' + JSON.stringify(value));
            //if (value !== undefined) this.setState(id, value, true);
            //if (stateChangeCallback) this.stateChangeTrigger[id] = stateChangeCallback;
            this.adapterObjects[id] = JSON.parse(JSON.stringify(obj));
            queueObj = null;
        } else {
            this.adapterObjects[id] = JSON.parse(JSON.stringify(obj));
        }
        //this.log.debug('Add Object for ' + id + ': ' + JSON.stringify(this.adapterObjects[id]) + '/' + JSON.stringify(obj));

        this.objectQueue.push({
            id: id,
            value: value,
            obj: queueObj,
            // can be null at runtime when a caller passes null (kept as before, only checked with typeof/!!)
            stateChangeCallback: stateChangeCallback as StateChangeCallback | undefined,
            preserveSettings,
        });
        //this.log.debug('Create object for ' + id + ': ' + JSON.stringify(obj) + ' with value: ' + JSON.stringify(value));

        if (createNow) {
            this.processObjectQueue(callback ?? undefined);
        }
    }

    private deleteObject(id: string): void {
        if (id.startsWith(this.namespace)) {
            id = id.substring(this.namespace.length + 1);
        }
        const obj = this.adapterObjects[id];
        if (obj && obj.type) {
            if (obj.type !== 'state') {
                this.log.debug(`Delete objects for ${id}`);
                Object.keys(this.adapterObjects).forEach(objId => {
                    if (objId.startsWith(`${id}.`)) {
                        try {
                            this.delObject(objId, err => {
                                const errText = err ? ` (${err})` : '';
                                if (!errText) {
                                    delete this.adapterObjects[objId];
                                    delete this.stateChangeTrigger[objId];
                                } else {
                                    this.log.info(
                                        `${this.adapterObjects[objId] ? this.adapterObjects[objId].type : '?'} ${objId} deleted${errText}`,
                                    );
                                }
                            });
                        } catch (err) {
                            this.log.info(`Cannot delete ${objId}: ${err}`);
                        }
                    }
                });
            }
            try {
                this.delObject(id, err => {
                    if (!err) {
                        delete this.adapterObjects[id];
                        delete this.stateChangeTrigger[id];
                    } else {
                        this.log.info(`${obj.type} ${id} deleted (${err})`);
                    }
                });
            } catch (err) {
                this.log.info(`Cannot delete ${id}: ${err}`);
            }
        } else {
            this.log.info(`Try to delete unknown object ${id}`);
        }
    }

    private ucFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    private isEquivalent(a: unknown, b: unknown): boolean {
        //this.log.debug('Compare ' + JSON.stringify(a) + ' with ' +  JSON.stringify(b));
        // Create arrays of property names
        if (a === null || a === undefined || b === null || b === undefined) {
            return a === b;
        }
        const aObj = a as Record<string, unknown>;
        const bObj = b as Record<string, unknown>;
        const aProps = Object.getOwnPropertyNames(aObj);
        const bProps = Object.getOwnPropertyNames(bObj);

        // If number of properties is different,
        // objects are not equivalent
        if (aProps.length !== bProps.length) {
            //console.log('num props different: ' + JSON.stringify(aProps) + ' / ' + JSON.stringify(bProps));
            return false;
        }

        for (let i = 0; i < aProps.length; i++) {
            const propName = aProps[i];

            if (typeof aObj[propName] !== typeof bObj[propName]) {
                //console.log('type props ' + propName + ' different');
                return false;
            }
            if (typeof aObj[propName] === 'object') {
                if (!this.isEquivalent(aObj[propName], bObj[propName])) {
                    return false;
                }
            } else {
                // If values of same property are not equal,
                // objects are not equivalent
                if (aObj[propName] !== bObj[propName]) {
                    //console.log('props ' + propName + ' different');
                    return false;
                }
            }
        }

        // If we made it this far, objects
        // are considered equivalent
        return true;
    }

    private processObjectQueue(callback?: () => void): void {
        if (!this.objectQueue.length) {
            callback && callback();
            return;
        }

        const handleValue = (queueEntry: ObjectQueueEntry, callback?: () => void): void => {
            if (queueEntry.value === undefined) {
                this.stateChangeTrigger[queueEntry.id] = queueEntry.stateChangeCallback;
                return callback && callback();
            }
            void this.setState(queueEntry.id, queueEntry.value, true, () => {
                this.stateChangeTrigger[queueEntry.id] = queueEntry.stateChangeCallback;
                return callback && callback();
            });
        };

        const handleObject = (queueEntry: ObjectQueueEntry, callback?: () => void): void => {
            const queueObj = queueEntry.obj;
            if (!queueObj) {
                handleValue(queueEntry, () => {
                    return callback && callback();
                });
                return;
            }
            const options: ioBroker.ExtendObjectOptions = {};
            if (queueEntry.preserveSettings) {
                options.preserve = queueEntry.preserveSettings; //{ common: ['name'], native: true } };
            }
            this.getObject(queueEntry.id, (err, obj) => {
                if (!err && obj) {
                    this.extendObject(queueEntry.id, queueObj as ioBroker.PartialObject, options, () => {
                        handleValue(queueEntry, () => {
                            return callback && callback();
                        });
                    });
                } else {
                    // type/common/native were completed with defaults in setOrUpdateObject()
                    this.setObject(queueEntry.id, queueObj as ioBroker.SettableObject, () => {
                        handleValue(queueEntry, () => {
                            return callback && callback();
                        });
                    });
                }
            });
        };

        // length was checked above
        const queueEntry = this.objectQueue.shift()!;
        handleObject(queueEntry, () => {
            return this.processObjectQueue(callback);
        });
    }

    private initSentry(callback: () => void): void {
        const common = this.ioPack.common as
            (ioBroker.InstanceCommon & { plugins?: Record<string, unknown> }) | undefined;
        if (!common || !common.plugins || !common.plugins.sentry) {
            return callback && callback();
        }
        if (this.supportsFeature && this.supportsFeature('PLUGINS')) {
            const sentryInstance = this.getPluginInstance('sentry') as
                (ioBroker.Plugin & { getSentryObject(): SentryLike | null }) | null | undefined;
            if (sentryInstance) {
                this.Sentry = sentryInstance.getSentryObject();
            }
        }
        return callback && callback();
    }

    private checkInstanceObject(callback: () => void): void {
        void this.getForeignObject(`system.adapter.${this.namespace}`, (err, obj) => {
            if (obj && obj.common && obj.common.restartSchedule) {
                const cronParts = obj.common.restartSchedule.split(' ');
                if (
                    (cronParts[0] || '').startsWith('*') ||
                    (cronParts[1] || '').startsWith('*') ||
                    (cronParts.length === 6 && cronParts[2].startsWith('*'))
                ) {
                    this.log.error(
                        `Restart schedule "${obj.common.restartSchedule}" is too often, please set a restart schedule that makes sense. Disabling adapter now.`,
                    );
                    this.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                    return;
                }
            }
            callback();
        });
    }

    private processMessage(msg: ioBroker.Message): void {
        this.log.debug(`Message: ${JSON.stringify(msg)}`);
        switch (msg.command) {
            case 'getStatusInfoText':
                // Status line of the JsonConfig instance settings (textSendTo)
                if (msg.callback) {
                    const cookieData = this.config.cookieData;
                    const cookieTimestamp =
                        cookieData && typeof cookieData === 'object' && cookieData.tokenDate
                            ? this.formatDate(cookieData.tokenDate)
                            : 0;
                    const lang = (msg.message as { lang?: string } | undefined)?.lang;
                    this.sendTo(
                        msg.from,
                        msg.command,
                        getStatusInfoText(this.proxyUrl, cookieTimestamp, lang, this.name),
                        msg.callback,
                    );
                }
                break;
            case 'getStatusInfo':
                this.getStatusInfo(msg);
                break;
            case 'sendSequenceCommand':
                this.sendSequenceCommand(msg);
                break;
        }
    }

    private getStatusInfo(msg: ioBroker.Message): void {
        // cookieData can also be a string ('' after "resetCookies") - then it has no tokenDate (as before)
        const cookieData = this.config.cookieData;
        this.sendTo(
            msg.from,
            msg.command,
            {
                result: {
                    proxyActive: this.proxyUrl !== null,
                    proxyUrl: this.proxyUrl,
                    cookieTimestamp:
                        cookieData && typeof cookieData === 'object' && cookieData.tokenDate
                            ? this.formatDate(cookieData.tokenDate)
                            : 0,
                },
                error: null,
            },
            msg.callback,
        );
    }

    private sendSequenceCommand(msg: ioBroker.Message): void {
        const message = msg.message as SequenceCommandMessage;
        if (!message.sequenceNodes) {
            this.sendTo(
                msg.from,
                msg.command,
                {
                    result: null,
                    error: 'No sequenceNodes given',
                },
                msg.callback,
            );
            return;
        }
        if (!message.deviceSerialNumber) {
            this.sendTo(
                msg.from,
                msg.command,
                {
                    result: null,
                    error: 'No deviceId given',
                },
                msg.callback,
            );
            return;
        }
        if (!this.alexa) {
            this.sendTo(
                msg.from,
                msg.command,
                {
                    result: null,
                    error: 'Alexa connection not initialized',
                },
                msg.callback,
            );
            return;
        }
        this.alexa.sendMultiSequenceCommand(
            message.deviceSerialNumber,
            message.sequenceNodes,
            message.sequenceType,
            this.alexa.ownerCustomerId,
            (err, res) => {
                this.sendTo(
                    msg.from,
                    msg.command,
                    {
                        result: res,
                        error: err,
                    },
                    msg.callback,
                );
            },
        );
    }

    private setRequestResult(err?: Error | string | null, _res?: unknown): void {
        if (!err) {
            return;
        }
        // err may also be a plain string - then it has no message (as before)
        void this.setState('requestResult', (err as Error).message ? (err as Error).message : (err as string), true);
    }

    /**
     * Konvertiert eine Sekundenzahl in einen String im Format (HH:)MM:SS
     *
     * @param sec seconds
     * @returns string
     */
    private sec2HMS(sec: number | string): string {
        if (sec === 0) {
            return '0';
        }

        const sec_num = parseInt(String(sec), 10);
        let hours: number | string = Math.floor(sec_num / 3600);
        let minutes: number | string = Math.floor((sec_num - hours * 3600) / 60);
        let seconds: number | string = sec_num - hours * 3600 - minutes * 60;

        if (minutes < 10) {
            minutes = `0${minutes}`;
        }
        if (seconds < 10) {
            seconds = `0${seconds}`;
        }
        if (hours === 0) {
            return `${minutes}:${seconds}`;
        }

        if (hours < 10) {
            hours = `0${hours}`;
        }
        return `${hours}:${minutes}:${seconds}`;
    }

    private scheduleNotificationUpdate(deviceId: string, delay: number, onlyIfNew?: boolean): void {
        if (this.updateNotificationTimer[deviceId]) {
            if (onlyIfNew) {
                return;
            }
            this.clearTimeout(this.updateNotificationTimer[deviceId]);
        }
        this.updateNotificationTimer[deviceId] = this.setTimeout(() => {
            this.updateNotificationTimer[deviceId] = null;
            this.updateNotificationStates(deviceId);
        }, delay);
    }

    private schedulePlayerUpdate(deviceId: string, delay: number, onlyIfNew?: boolean): void {
        if (this.updatePlayerTimer[deviceId]) {
            if (onlyIfNew) {
                return;
            }
            this.clearTimeout(this.updatePlayerTimer[deviceId]);
        }
        this.log.debug(`Schedule new Player Update in ${delay}ms`);
        this.updatePlayerTimer[deviceId] = this.setTimeout(() => {
            this.updatePlayerTimer[deviceId] = null;
            this.updatePlayerStatus(deviceId);
        }, delay);
    }

    private scheduleStatesUpdate(delay?: number): void {
        if (this.updateStateTimer) {
            this.clearTimeout(this.updateStateTimer);
        }
        if (delay === undefined) {
            if (!this.config.updateStateInterval) {
                return;
            }
            delay = this.config.updateStateInterval * 1000;
            if (this.pushConnected) {
                delay = 60 * 60 * 1000; // 1h
            }
        }
        delay = Math.max(delay, 300000);
        this.updateStateTimer = this.setTimeout(() => {
            if (this.stopped) {
                return;
            }
            this.updateStateTimer = null;
            this.updateStates();
        }, delay);
    }

    private async setEqualizer(device: AlexaDevice): Promise<void> {
        delete this.equalizerUpdateTimeouts[device.serialNumber];

        const bassState = await this.getStateAsync(`Echo-Devices.${device.serialNumber}.Preferences.equalizerBass`);
        const midState = await this.getStateAsync(`Echo-Devices.${device.serialNumber}.Preferences.equalizerMidRange`);
        const trebleState = await this.getStateAsync(`Echo-Devices.${device.serialNumber}.Preferences.equalizerTreble`);

        // The states are of type number; undefined is passed on as before when a state does not exist
        this.alexa.setEqualizerSettings(
            device,
            (bassState ? bassState.val : undefined) as number,
            (midState ? midState.val : undefined) as number,
            (trebleState ? trebleState.val : undefined) as number,
            (err, res) => {
                const data = res as EqualizerSettingsResponse | undefined;
                if (err || !data) {
                    this.log.error(`${device.serialNumber} Error setting equalizer settings: ${err}`);
                    return;
                }
                if (device.capabilities.includes('EQUALIZER_CONTROLLER_BASS') && data.bass !== undefined) {
                    void this.setState(
                        `Echo-Devices.${device.serialNumber}.Preferences.equalizerBass`,
                        data.bass,
                        true,
                    );
                }
                if (device.capabilities.includes('EQUALIZER_CONTROLLER_MIDRANGE') && data.mid !== undefined) {
                    void this.setState(
                        `Echo-Devices.${device.serialNumber}.Preferences.equalizerMidRange`,
                        data.mid,
                        true,
                    );
                }
                if (device.capabilities.includes('EQUALIZER_CONTROLLER_TREBLE') && data.treble !== undefined) {
                    void this.setState(
                        `Echo-Devices.${device.serialNumber}.Preferences.equalizerTreble`,
                        data.treble,
                        true,
                    );
                }
            },
        );
    }

    private initEqualizerData(device: AlexaDevice): Promise<number> {
        return new Promise<number>(resolve => {
            if (
                !device.capabilities.includes('EQUALIZER_CONTROLLER_BASS') &&
                !device.capabilities.includes('EQUALIZER_CONTROLLER_MIDRANGE') &&
                !device.capabilities.includes('EQUALIZER_CONTROLLER_TREBLE')
            ) {
                return resolve(0);
            }
            this.alexa.getEqualizerEnabled(device, (err, res) => {
                const enabledData = res as EqualizerEnabledResponse | undefined;
                if (err || !enabledData) {
                    this.log.error(`${device.serialNumber} Error getting equalizer enabled: ${err}`);
                    return resolve(0);
                }
                if (!enabledData.enabled) {
                    return resolve(0);
                }
                this.alexa.getEqualizerRange(device, (err, res) => {
                    const rangeData = res as EqualizerRangeResponse | undefined;
                    if (err || !rangeData) {
                        this.log.error(`${device.serialNumber} Error getting equalizer range: ${err}`);
                        return resolve(0);
                    }
                    const rangeMin = rangeData.min || -6;
                    const rangeMax = rangeData.max || 6;

                    this.alexa.getEqualizerSettings(device, (err, res) => {
                        const data = res as EqualizerSettingsResponse | undefined;
                        if (err || !data) {
                            this.log.error(`${device.serialNumber} Error getting equalizer setting: ${err}`);
                            return resolve(0);
                        }

                        let numStates = 0;

                        if (device.capabilities.includes('EQUALIZER_CONTROLLER_BASS')) {
                            numStates++;
                            this.setOrUpdateObject(
                                `Echo-Devices.${device.serialNumber}.Preferences.equalizerBass`,
                                {
                                    common: {
                                        name: `Equalizer Bass`,
                                        type: 'number',
                                        role: 'level.bass',
                                        min: rangeMin,
                                        max: rangeMax,
                                    },
                                },
                                data.bass,
                                (value: ioBroker.StateValue) => {
                                    if (typeof value !== 'number') {
                                        value = parseInt(String(value), 10);
                                        if (isNaN(value)) {
                                            this.log.error(`${device.serialNumber} Error bass value must be a number`);
                                            return;
                                        }
                                    }
                                    this.equalizerUpdateTimeouts[device.serialNumber] &&
                                        this.clearTimeout(this.equalizerUpdateTimeouts[device.serialNumber]);
                                    this.equalizerUpdateTimeouts[device.serialNumber] = this.setTimeout(
                                        () => this.setEqualizer(device),
                                        500,
                                    );
                                },
                            );
                        }
                        if (device.capabilities.includes('EQUALIZER_CONTROLLER_MIDRANGE')) {
                            numStates++;
                            this.setOrUpdateObject(
                                `Echo-Devices.${device.serialNumber}.Preferences.equalizerMidRange`,
                                {
                                    common: {
                                        name: `Equalizer Midrange`,
                                        type: 'number',
                                        role: 'level.midrange',
                                        min: rangeMin,
                                        max: rangeMax,
                                    },
                                },
                                data.mid,
                                (value: ioBroker.StateValue) => {
                                    if (typeof value !== 'number') {
                                        value = parseInt(String(value), 10);
                                        if (isNaN(value)) {
                                            this.log.error(
                                                `${device.serialNumber} Error midrange value must be a number`,
                                            );
                                            return;
                                        }
                                    }
                                    this.equalizerUpdateTimeouts[device.serialNumber] &&
                                        this.clearTimeout(this.equalizerUpdateTimeouts[device.serialNumber]);
                                    this.equalizerUpdateTimeouts[device.serialNumber] = this.setTimeout(
                                        () => this.setEqualizer(device),
                                        500,
                                    );
                                },
                            );
                        }
                        if (device.capabilities.includes('EQUALIZER_CONTROLLER_TREBLE')) {
                            numStates++;
                            this.setOrUpdateObject(
                                `Echo-Devices.${device.serialNumber}.Preferences.equalizerTreble`,
                                {
                                    common: {
                                        name: `Equalizer Treble`,
                                        type: 'number',
                                        role: 'level.treble',
                                        min: rangeMin,
                                        max: rangeMax,
                                    },
                                },
                                data.treble,
                                (value: ioBroker.StateValue) => {
                                    if (typeof value !== 'number') {
                                        value = parseInt(String(value), 10);
                                        if (isNaN(value)) {
                                            this.log.error(
                                                `${device.serialNumber} Error treble value must be a number`,
                                            );
                                            return;
                                        }
                                    }
                                    this.equalizerUpdateTimeouts[device.serialNumber] &&
                                        this.clearTimeout(this.equalizerUpdateTimeouts[device.serialNumber]);
                                    this.equalizerUpdateTimeouts[device.serialNumber] = this.setTimeout(
                                        () => this.setEqualizer(device),
                                        500,
                                    );
                                },
                            );
                        }

                        resolve(numStates);
                    });
                });
            });
        });
    }

    private initDeviceAuxController(device: AlexaDevice): Promise<number> {
        return new Promise<number>(resolve => {
            let numStates = 0;
            this.alexa.getAuxControllerState(device, (err, res) => {
                const auxState = res as AuxControllerStateResponse | undefined;
                if (err) {
                    this.log.error(`${device.serialNumber} Error getting aux controller state: ${err}`);
                    return resolve(0);
                }
                if (
                    auxState &&
                    auxState.ports &&
                    Array.isArray(auxState.ports) &&
                    device.capabilities.includes('AUX_SETTINGS')
                ) {
                    auxState.ports.forEach(port => {
                        numStates++;
                        this.setOrUpdateObject(
                            `Echo-Devices.${device.serialNumber}.Preferences.auxPort-${port.id}-Direction`,
                            {
                                common: {
                                    name: `Port ${port.id} direction`,
                                    type: 'string',
                                    role: 'text',
                                    states: { INPUT: 'INPUT', OUTPUT: 'OUTPUT' },
                                },
                            },
                            port.direction,
                            (value: ioBroker.StateValue) => {
                                if (value !== 'INPUT' && value !== 'OUTPUT') {
                                    this.log.error(`${device.serialNumber} Error port direction value invalid`);
                                    return;
                                }
                                this.alexa.setAuxControllerPortDirection(device, value, port.id, (err, _res) => {
                                    if (err) {
                                        this.log.error(
                                            `${device.serialNumber} Error setting aux controller port direction: ${err}`,
                                        );
                                        return;
                                    }
                                    void this.setState(
                                        `Echo-Devices.${device.serialNumber}.Preferences.auxPort-${port.id}-Direction`,
                                        value,
                                        true,
                                    );
                                });
                            },
                        );
                    });
                }

                this.alexa.getConnectedSpeakerOptionSetting(device, (err, res2) => {
                    if (err) {
                        this.log.error(`${device.serialNumber} Error getting connected speaker setting: ${err}`);
                        return resolve(numStates);
                    }
                    if (res2) {
                        numStates++;
                        const states: Record<string, string> = {
                            Bluetooth: 'Bluetooth',
                            InternalSpeaker: 'InternalSpeaker',
                        };
                        if (auxState && auxState.ports && auxState.ports.length) {
                            states.Aux = 'Aux (if supported)';
                        }
                        this.setOrUpdateObject(
                            `Echo-Devices.${device.serialNumber}.Preferences.connectedSpeaker`,
                            {
                                common: {
                                    name: `Connected Speaker Option`,
                                    type: 'string',
                                    role: 'text',
                                    states,
                                },
                            },
                            res2 as ioBroker.StateValue,
                            (value: ioBroker.StateValue) => {
                                if (states[value as string] === undefined) {
                                    this.log.error(`${device.serialNumber} Error connected speaker value invalid`);
                                    return;
                                }
                                this.alexa.setConnectedSpeakerOptionSetting(
                                    device,
                                    value as 'Bluetooth' | 'InternalSpeaker' | 'Aux',
                                    (err, _res) => {
                                        if (err) {
                                            this.log.error(
                                                `${device.serialNumber} Error setting connected speaker setting: ${err}`,
                                            );
                                            return;
                                        }
                                        void this.setState(
                                            `Echo-Devices.${device.serialNumber}.Preferences.connectedSpeaker`,
                                            value,
                                            true,
                                        );
                                    },
                                );
                            },
                        );
                    }
                    resolve(numStates);
                });
            });
        });
    }

    private initDisplaySettings(device: AlexaDevice): Promise<number> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise<number>(async resolve => {
            if (
                !device.capabilities.includes('DISPLAY_POWER_TOGGLE') &&
                !device.capabilities.includes('DISPLAY_BRIGHTNESS_ADJUST') &&
                !device.capabilities.includes('DISPLAY_ADAPTIVE_BRIGHTNESS')
            ) {
                return resolve(0);
            }
            let numStates = 0;
            if (device.capabilities.includes('DISPLAY_POWER_TOGGLE')) {
                numStates++;
                const displayPower = await new Promise<ioBroker.StateValue | undefined>(resolve => {
                    this.alexa.getDisplayPowerSetting(device, (err, res) => {
                        if (err) {
                            this.log.error(`${device.serialNumber} Error getting display enabled setting: ${err}`);
                            return resolve(undefined);
                        }
                        resolve(res as ioBroker.StateValue | undefined);
                    });
                });
                this.setOrUpdateObject(
                    `Echo-Devices.${device.serialNumber}.Preferences.displayEnabled`,
                    {
                        common: {
                            name: `Display enabled`,
                            type: 'boolean',
                            role: 'switch',
                        },
                    },
                    displayPower,
                    (value: ioBroker.StateValue) => {
                        this.alexa.setDisplayPowerSetting(device, !!value, (err, _res) => {
                            if (err) {
                                this.log.error(`${device.serialNumber} Error setting display enabled: ${err}`);
                                return;
                            }
                            void this.setState(
                                `Echo-Devices.${device.serialNumber}.Preferences.displayEnabled`,
                                !!value,
                                true,
                            );
                        });
                    },
                );
            }
            if (device.capabilities.includes('DISPLAY_BRIGHTNESS_ADJUST')) {
                numStates++;
                const displayBrightness = await new Promise<ioBroker.StateValue | undefined>(resolve => {
                    this.alexa.getBrightnessSetting(device, (err, res) => {
                        if (err) {
                            this.log.error(`${device.serialNumber} Error getting display brightness setting: ${err}`);
                            return resolve(undefined);
                        }
                        resolve(res as ioBroker.StateValue | undefined);
                    });
                });
                this.setOrUpdateObject(
                    `Echo-Devices.${device.serialNumber}.Preferences.displayBrightness`,
                    {
                        common: {
                            name: `Display Brightness`,
                            type: 'number',
                            role: 'level.brightness',
                            min: 0,
                            max: 100,
                            unit: '%',
                        },
                    },
                    displayBrightness,
                    (value: ioBroker.StateValue) => {
                        if (typeof value !== 'number') {
                            value = parseInt(String(value), 10);
                            if (isNaN(value)) {
                                this.log.error(`${device.serialNumber} Error brightness value must be a number`);
                                return;
                            }
                        }
                        if (value < 0 || value > 100) {
                            this.log.error(`${device.serialNumber} Error brightness value must be between 0 and 100`);
                            return;
                        }
                        this.alexa.setBrightnessSetting(device, value, (err, _res) => {
                            if (err) {
                                this.log.error(`${device.serialNumber} Error setting display brightness: ${err}`);
                                return;
                            }
                            void this.setState(
                                `Echo-Devices.${device.serialNumber}.Preferences.displayBrightness`,
                                value,
                                true,
                            );
                        });
                    },
                );
            }
            if (device.capabilities.includes('DISPLAY_ADAPTIVE_BRIGHTNESS')) {
                numStates++;
                const adaptiveBrightness = await new Promise<ioBroker.StateValue | undefined>(resolve => {
                    this.alexa.getAdaptiveBrightnessSetting(device, (err, res) => {
                        if (err) {
                            this.log.error(
                                `${device.serialNumber} Error getting display adaptive brightness setting: ${err}`,
                            );
                            return resolve(undefined);
                        }
                        resolve(res as ioBroker.StateValue | undefined);
                    });
                });
                this.setOrUpdateObject(
                    `Echo-Devices.${device.serialNumber}.Preferences.displayAdaptiveBrightnessEnabled`,
                    {
                        common: {
                            name: `Display adaptive brightness`,
                            type: 'boolean',
                            role: 'switch',
                        },
                    },
                    adaptiveBrightness,
                    (value: ioBroker.StateValue) => {
                        this.alexa.setAdaptiveBrightnessSetting(device, !!value, (err, _res) => {
                            if (err) {
                                this.log.error(
                                    `${device.serialNumber} Error setting display adaptive brightness: ${err}`,
                                );
                                return;
                            }
                            void this.setState(
                                `Echo-Devices.${device.serialNumber}.Preferences.displayAdaptiveBrightnessEnabled`,
                                !!value,
                                true,
                            );
                        });
                    },
                );
            }
            resolve(numStates);
        });
    }

    private updateDeviceConfigurationStates(callback?: () => void): void {
        if (this.stopped) {
            return;
        }
        this.alexa.getDoNotDisturb((err, res) => {
            if (this.stopped) {
                return;
            }
            const dndData = res as DoNotDisturbResponse | undefined;

            if (
                !err &&
                dndData &&
                dndData.doNotDisturbDeviceStatusList &&
                Array.isArray(dndData.doNotDisturbDeviceStatusList)
            ) {
                dndData.doNotDisturbDeviceStatusList.forEach(status => {
                    const device = this.findDevice(status.deviceSerialNumber);
                    if (device && device.deviceTypeDetails && device.deviceTypeDetails.commandSupport) {
                        void this.setState(
                            `Echo-Devices.${device.serialNumber}.Commands.doNotDisturb`,
                            status.enabled,
                            true,
                        );
                    }
                });
            }

            this.alexa.getDevicePreferences((err, res) => {
                if (this.stopped) {
                    return;
                }
                const prefData = res as DevicePreferencesResponse | undefined;
                if (!err && prefData && prefData.devicePreferences && Array.isArray(prefData.devicePreferences)) {
                    prefData.devicePreferences.forEach(pref => {
                        if (!pref.deviceSerialNumber) {
                            return;
                        }
                        const device = this.findDevice(pref.deviceSerialNumber);
                        if (!device) {
                            return;
                        }
                        device.preferences = pref;

                        if (
                            device.capabilities.includes('EARCONS') &&
                            pref.notificationEarconEnabled !== undefined &&
                            this.adapterObjects[
                                `Echo-Devices.${device.serialNumber}.Preferences.ringNotificationsEnabled`
                            ]
                        ) {
                            void this.setState(
                                `Echo-Devices.${device.serialNumber}.Preferences.ringNotificationsEnabled`,
                                pref.notificationEarconEnabled,
                                true,
                            );
                        }
                    });
                }

                if (this.config.updateConfigurationInterval > 0) {
                    this.updateConfigurationTimer = this.setTimeout(
                        () => {
                            this.updateDeviceConfigurationStates();
                        },
                        Math.max(this.config.updateConfigurationInterval * 1000, 300000),
                    );
                }
                callback && callback();
            });
        });
    }

    private updateStates(callback?: () => void): void {
        if (this.updateStateTimer) {
            this.clearTimeout(this.updateStateTimer);
            this.updateStateTimer = null;
        }
        if (this.stopped) {
            return;
        }

        this.updateDeviceStatus(() => {
            this.updateBluetoothStatus(() => {
                this.updatePlayerStatus(callback);
            });
        });
    }

    // ---- converted from main.js (part B) ----
    /**
     * alexa-remote2 smart home methods typed as they are really implemented and used here.
     * The typings of alexa-remote2 declare the callbacks/entityType as mandatory and parameters as string[].
     */
    private get shAlexa(): ShAlexaRemoteApi {
        return this.alexa as unknown as ShAlexaRemoteApi;
    }

    /**
     * Inkrementiert 'mediaProgress' alle 2 Sekunden um 2. So wird ein permanentes https-get überflüssig
     * ruft sich nach 2 Sekunden erneut selbst auf, wenn 'currentState' noch auf 'PLAYING' steht.
     * ist 'mediaProgress' größer als 'mediaLength', so ist der Song zu Ende und 'updateDevice' wird aufgerufen.
     *
     * @param serialNumber serial number
     */
    private updateMediaProgress(serialNumber: string): void {
        if (!this.lastPlayerState[serialNumber] || !this.lastPlayerState[serialNumber].resPlayer) {
            return;
        }

        if (this.lastPlayerState[serialNumber].timeout) {
            this.clearTimeout(this.lastPlayerState[serialNumber].timeout);
            this.lastPlayerState[serialNumber].timeout = null;
        }

        const resPlayer = this.lastPlayerState[serialNumber].resPlayer;
        const devId = this.lastPlayerState[serialNumber].devId;
        const lastTimestamp = this.lastPlayerState[serialNumber].ts;

        const currentState = resPlayer.playerInfo.state;

        if (currentState === 'PLAYING' && resPlayer.playerInfo && resPlayer.playerInfo.progress) {
            const mediaProgress = parseInt(resPlayer.playerInfo.progress.mediaProgress, 10);
            const mediaLength = parseInt(resPlayer.playerInfo.progress.mediaLength || '0', 10);
            const timeframe = ~~((Date.now() - lastTimestamp) / 1000); // calculate time since last data
            const mediaProgressNew = mediaProgress + timeframe; // add this to the progress

            // Am Ende des Titels soll neu geladen werden. Ist es Radio (länge = 0) dann alle 200 sekunden
            if (mediaProgressNew > mediaLength && (mediaLength > 0 || mediaProgressNew % 200 < 2)) {
                this.schedulePlayerUpdate(serialNumber, 2000);
                return;
            }

            // Nun mediaProgress und mediaProgressPercent neu berechnen
            let mediaProgressPercent = 0;
            let mediaRemaining = 0;
            if (mediaLength > 0) {
                mediaProgressPercent = Math.round((mediaProgressNew * 100) / mediaLength);
                mediaRemaining = mediaLength - mediaProgressNew;
            }
            void this.setState(`${devId}.Player.mediaProgressPercent`, mediaProgressPercent, true);
            void this.setState(`${devId}.Player.mediaProgress`, mediaProgressNew, true);
            void this.setState(`${devId}.Player.mediaProgressStr`, this.sec2HMS(mediaProgressNew), true);
            void this.setState(`${devId}.Player.mediaRemaining`, mediaRemaining, true);
            void this.setState(`${devId}.Player.mediaLengthStr`, this.sec2HMS(mediaRemaining), true);

            this.lastPlayerState[serialNumber].timeout = this.setTimeout(() => {
                this.lastPlayerState[serialNumber].timeout = null;
                this.updateMediaProgress(serialNumber);
            }, 2000);
        } else {
            this.schedulePlayerUpdate(serialNumber, (2 * 60 * 60 + 5) * 1000);
        }
    }

    private generateApplianceQueryArray(applianceId: string, queryAllProperties: boolean): ShQueryRequestEntry[] {
        let propertiesToQuery: ShQueryProperty[] | undefined;
        if (!queryAllProperties) {
            propertiesToQuery = this.shApplianceEntityMap[applianceId].supportedProperties;
        }
        if (!queryAllProperties && (!propertiesToQuery || !propertiesToQuery.length)) {
            return [];
        }

        const reqArr: ShQueryRequestEntry[] = [];
        const reqApplianceIds: Record<string, boolean> = {};
        reqApplianceIds[applianceId] = true;
        if (
            this.shApplianceEntityMap[applianceId].mergedApplianceIds &&
            Array.isArray(this.shApplianceEntityMap[applianceId].mergedApplianceIds)
        ) {
            this.shApplianceEntityMap[applianceId].mergedApplianceIds.forEach(id => {
                reqApplianceIds[id] = true;
            });
        }
        Object.keys(reqApplianceIds).forEach(id => {
            reqArr.push({
                entityId: id,
                entityType: 'APPLIANCE',
                properties: propertiesToQuery,
            });
        });
        if (reqArr.length > 1 || (reqArr.length === 1 && !reqArr[0].entityId.startsWith('SKILL'))) {
            reqArr.push({
                entityId: this.shApplianceEntityMap[applianceId].entityId,
                entityType: 'ENTITY',
            });
        }
        return reqArr;
    }

    private queryAllSmartHomeDevices(initial: boolean, cloudOnly: boolean, callback?: () => void): void {
        if (this.updateSmartHomeDevicesTimer) {
            this.clearTimeout(this.updateSmartHomeDevicesTimer);
            this.updateSmartHomeDevicesTimer = null;
        }

        if (!this.config.synchronizeSmartHomeDevices) {
            return callback && callback();
        }

        const reqArr: ShQueryRequestEntry[] = [];
        const blocked: string[] = [];
        for (const applianceId of Object.keys(this.shApplianceEntityMap)) {
            const queryIt =
                this.shQueryEnabled[applianceId] &&
                (cloudOnly
                    ? this.shApplianceEntityMap[applianceId].cloudReadable
                    : this.shApplianceEntityMap[applianceId].readable);

            if (queryIt) {
                if (this.shQueryBlocker[applianceId]) {
                    blocked.push(applianceId);
                    continue;
                }
                reqArr.push(...this.generateApplianceQueryArray(applianceId, false));
                if (!initial) {
                    /**
                     * Please DO NOT modify these block values and DO NOT lower them! Doing this might mean that Amazon
                     * blocks the Smart home device queries for all > 20k ioBroker Adapter users!
                     */
                    let delay = 1200000;
                    if (!applianceId.startsWith('SKILL_') && this.shApplianceEntityMap[applianceId].cloudReadable) {
                        delay = 900000;
                    }
                    this.shQueryBlocker[applianceId] = this.setTimeout(() => {
                        this.shQueryBlocker[applianceId] = null;
                    }, delay);
                }
            }
        }
        if (blocked.length) {
            this.log.warn(`Smarthome device queries blocked for ${blocked.length} devices: ${blocked.join(',')}`);
        }

        if (!reqArr.length) {
            this.log.info('No smart home devices to query');
            return callback && callback();
        }

        // Cache file stays in the adapter root directory (was path.join(__dirname, ...) in main.js)
        const cachedDeviceStatesFileName = join(ADAPTER_DIR, `cachedDeviceStates.${this.namespace}.json`);
        try {
            if (existsSync(cachedDeviceStatesFileName)) {
                const stats = statSync(cachedDeviceStatesFileName);
                if (stats.mtime.getTime() + 900 * 1000 > Date.now()) {
                    this.log.info(
                        `Home Device states last requested ${stats.mtime.toString()} ... Do not request again now`,
                    );

                    return callback && callback();
                }
            }
        } catch (err) {
            this.log.info(`Could not cache devices: ${(err as Error).message}`);
        }

        this.alexa.querySmarthomeDevices(reqArr, (err, res) => {
            if (!err) {
                if (res && !blocked.length) {
                    try {
                        writeFileSync(cachedDeviceStatesFileName, JSON.stringify(res));
                    } catch (err) {
                        this.log.info(`Cannot write cached device states to file: ${err}`);
                    }
                }
                this.updateSmarthomeDeviceStates(res as ShDeviceStatesResponse | undefined);
            }

            return callback && callback();
        });
    }

    /**
     * @param entityId entity id of the device - for groups this is an array of entity ids (as in main.js)
     * @param objs capability objects of a namespace (with selectorName), action objects or a single object
     * @param selectorName property name to select from objs or null
     * @param changedParamName name of the changed parameter
     * @param changedParamvalue new value of the changed parameter
     * @param capInstance capability instance
     */
    private buildSmartHomeControlParameters(
        entityId: string | string[],
        objs:
            Record<string, shObjects.ShStateDefinition[]> | shObjects.ShStateDefinition[] | shObjects.ShStateDefinition,
        selectorName: string | null,
        changedParamName: string,
        changedParamvalue: ioBroker.StateValue,
        capInstance?: string,
    ): ShControlParameters {
        function getValueToSend(
            obj: shObjects.ShStateDefinition,
            value: ioBroker.StateValue | undefined,
        ): ioBroker.StateValue | undefined {
            if (value && obj.native.valueTrue) {
                value = obj.native.valueTrue;
            } else if (!value && obj.native.valueFalse) {
                value = obj.native.valueFalse;
            } else if (obj.native.valueMap) {
                value = obj.native.valueMap[value as string | number];
            } else {
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

        // String(entityId): entityId is an array for groups, the template literal joined it with ','
        this.log.debug(
            `buildSmartHomeControlParameters: ${String(entityId)} ${selectorName} ${changedParamName} ${changedParamvalue} for objs = ${JSON.stringify(objs)}`,
        );

        const fullObj = objs;
        if (selectorName !== null) {
            objs = (objs as Record<string, shObjects.ShStateDefinition[]>)[selectorName];
        }

        const parameters: ShControlParameters = {};
        let sendAdditional: string[] = [];
        if (!Array.isArray(objs)) {
            objs = [objs as shObjects.ShStateDefinition];
        }
        if (capInstance) {
            parameters.instance = capInstance;
        }
        // common.name of the smart home state definitions is always a plain string
        for (const obj of objs as ShStateDefinitionEx[]) {
            let paramName = obj.common.name;
            const stateId = capInstance ? `${capInstance.replace(/\./g, '-')}-${obj.common.name}` : obj.common.name;
            if (obj.common.name === changedParamName) {
                if (obj.native.action) {
                    parameters.action = obj.native.action;
                    if (obj.native.paramName) {
                        paramName = obj.native.paramName;
                    }
                    if (obj.native.sendInSubStructureOf) {
                        parameters[obj.native.sendInSubStructureOf] = parameters[obj.native.sendInSubStructureOf] || {};
                        parameters[obj.native.sendInSubStructureOf][paramName] = getValueToSend(obj, changedParamvalue);
                    } else {
                        parameters[paramName] = getValueToSend(obj, changedParamvalue);
                    }
                } else {
                    if (changedParamvalue && obj.native.actionTrue) {
                        parameters.action = obj.native.actionTrue;
                    } else if (!changedParamvalue && obj.native.actionFalse) {
                        parameters.action = obj.native.actionFalse;
                    }
                }
                if (obj.native.sendAdditional) {
                    sendAdditional = sendAdditional.concat(obj.native.sendAdditional);
                }
            } else if (!obj.native.donotsend) {
                if (obj.native.paramName) {
                    paramName = obj.native.paramName;
                }
                if (obj.native.sendInSubStructureOf) {
                    parameters[obj.native.sendInSubStructureOf] = parameters[obj.native.sendInSubStructureOf] || {};
                    parameters[obj.native.sendInSubStructureOf][paramName] = getValueToSend(
                        obj,
                        this.shDeviceParamValues[`Smart-Home-Devices.${String(entityId)}.${stateId}`],
                    );
                } else {
                    parameters[paramName] = getValueToSend(
                        obj,
                        this.shDeviceParamValues[`Smart-Home-Devices.${String(entityId)}.${stateId}`],
                    );
                }
            }
        }
        if (sendAdditional.length) {
            sendAdditional.forEach(actionName => {
                let addObjs = (fullObj as Record<string, shObjects.ShStateDefinition[] | shObjects.ShStateDefinition>)[
                    actionName
                ];
                if (!Array.isArray(addObjs)) {
                    addObjs = [addObjs];
                }
                for (const obj of addObjs as ShStateDefinitionEx[]) {
                    let paramName = obj.common.name;
                    if (!obj.native.donotsend) {
                        if (obj.native.paramName) {
                            paramName = obj.native.paramName;
                        }
                        if (obj.native.sendInSubStructureOf) {
                            parameters[obj.native.sendInSubStructureOf] =
                                parameters[obj.native.sendInSubStructureOf] || {};
                            parameters[obj.native.sendInSubStructureOf][paramName] = getValueToSend(
                                obj,
                                this.shDeviceParamValues[`Smart-Home-Devices.${String(entityId)}.${obj.common.name}`],
                            );
                        } else {
                            parameters[paramName] = getValueToSend(
                                obj,
                                this.shDeviceParamValues[`Smart-Home-Devices.${String(entityId)}.${obj.common.name}`],
                            );
                        }
                    }
                }
            });
        }

        this.log.debug(`buildSmartHomeControlParameters Response: ${JSON.stringify(parameters)}`);
        return parameters;
    }

    private padding(num: number): string {
        let str = num.toString(16);
        if (str.length < 2) {
            str = `0${str}`;
        }
        return str;
    }

    // expected hue range: [0, 360]
    // expected saturation range: [0, 1]
    // expected lightness range: [0, 1]
    // Based on http://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c
    private hsvToRgb(h: number, s: number, v: number): string {
        let r: number | undefined;
        let g: number | undefined;
        let b: number | undefined;
        h = h / 360;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        switch (i % 6) {
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
        // NOTE: r/g/b stay undefined for NaN or negative hue (i % 6 < 0); Math.round(NaN) then gives 'NaN' - as before
        return `#${this.padding(Math.round(r! * 255))}${this.padding(Math.round(g! * 255))}${this.padding(Math.round(b! * 255))}`;
    }

    private updateSmarthomeDeviceStates(res: ShDeviceStatesResponse | null | undefined): void {
        const handleObject = (deviceEntityId: string, cap: AmazonJson, stateName: string): ioBroker.StateValue => {
            if (!this.adapterObjects[`Smart-Home-Devices.${deviceEntityId}.${stateName}`]) {
                this.log.debug(
                    `ignoring value "${cap.namespace}.${cap.value}" for Smart-Home-Devices.${deviceEntityId}.${stateName}`,
                );
                return null;
            }
            const native = this.adapterObjects[`Smart-Home-Devices.${deviceEntityId}.${stateName}`].native!;
            const common = this.adapterObjects[`Smart-Home-Devices.${deviceEntityId}.${stateName}`].common!;
            // cap.value is undocumented Amazon JSON (any), the variable is reused for the state object below
            let value = cap.value;
            if (typeof value === 'object') {
                // NOTE: cap.value === null would throw here (typeof null === 'object') - kept as before
                if (value[native.valueSubKey || 'value'] === undefined) {
                    if (!native.noFallbackStringifiedValue) {
                        value = JSON.stringify(value);
                    } else {
                        value = undefined;
                    }
                } else {
                    value = value[native.valueSubKey || 'value'];
                    if (value !== null && typeof value === 'object' && !native.noFallbackStringifiedValue) {
                        // TODO: maybe always stringified?
                        value = JSON.stringify(value);
                    }
                }
            } else if (native.valueSubKey && native.valueSubKey !== 'value') {
                // We requested a sub value !== 'value' key but it is a plain value, so value requested not present
                value = undefined;
            }
            if (value === undefined) {
                this.log.debug(`Value not provided in answer for Smart-Home-Devices.${deviceEntityId}.${stateName}`);
                return null;
            }
            if (native.valueTrue && native.valueTrue === value) {
                value = true;
            } else if (native.valueFalse && native.valueFalse === value) {
                value = false;
            } else if (native.valueTrue && !native.valueFalse && native.valueTrue !== value) {
                value = false;
            } else if (native.valueFalse && !native.valueTrue && native.valueFalse !== value) {
                value = true;
            } else if (native.valueMap && Array.isArray(native.valueMap) && native.valueMap.length) {
                this.log.debug(
                    `Get Index for value "${cap.namespace}.${cap.value}" for Smart-Home-Devices.${deviceEntityId}.${stateName}, value=${value} of ${JSON.stringify(native.valueMap)}`,
                );
                value = native.valueMap.indexOf(value);
                if (value === -1) {
                    return null;
                }
            }
            if (typeof value !== common.type && common.type !== 'mixed') {
                if (common.type === 'number') {
                    const convertedValue = parseFloat(value);
                    if (!isNaN(convertedValue)) {
                        value = convertedValue;
                    }
                } else if (common.type === 'boolean') {
                    value = !!value;
                }
            }
            value = {
                val: value,
                ack: true,
            };
            if (cap.timeOfSample) {
                value.ts = new Date(cap.timeOfSample).getTime();
            }
            void this.setState(`Smart-Home-Devices.${deviceEntityId}.${stateName}`, value);
            this.shDeviceParamValues[`Smart-Home-Devices.${deviceEntityId}.${stateName}`] = value.val;
            return value.val;
        };

        if (!res) {
            return;
        }
        if (res && res.errors && res.errors.length === 1 && res.errors[0] && res.errors[0].code) {
            if (!res.deviceStates || res.deviceStates.length === 0) {
                void this.setState('requestResult', res.errors[0].code, true);
            }
        }
        if (res.deviceStates) {
            for (const states of res.deviceStates) {
                if (!states.entity || !states.entity.entityId) {
                    continue;
                }
                const inputEntityId = states.entity.entityId;
                let mainApplianceId: string | undefined;
                if (this.shApplianceEntityMap[inputEntityId]) {
                    // ID is a "main appliance id"
                    mainApplianceId = inputEntityId;
                } else if (this.shMergedApplianceIdMap[inputEntityId]) {
                    // ID is a "merged appliance id"
                    mainApplianceId = this.shMergedApplianceIdMap[inputEntityId];
                } else if (this.shEntityApplianceMap[inputEntityId]) {
                    // ID is an "entity id"
                    mainApplianceId = this.shEntityApplianceMap[inputEntityId];
                }
                if (!mainApplianceId) {
                    this.log.debug(`No main appliance id found for ${inputEntityId}`);
                    continue;
                }

                const deviceEntityId = this.shApplianceEntityMap[mainApplianceId].entityId;
                if (deviceEntityId && states.capabilityStates) {
                    let colorDataIncluded = false;
                    const capValues: Record<string, ioBroker.StateValue> = {};
                    for (const capString of states.capabilityStates) {
                        let cap: AmazonJson;
                        try {
                            cap = JSON.parse(capString);
                        } catch (e) {
                            this.log.warn(e);
                            continue;
                        }
                        if (!shObjects.capabilityObjects[cap.namespace]) {
                            if (shObjects.capabilityObjects[cap.namespace] !== null) {
                                this.log.debug(
                                    `unsupported namespace "${cap.namespace}" for Smart-Home-Devices.${deviceEntityId}.${cap.name}`,
                                );
                            }
                            continue;
                        }
                        if (!shObjects.capabilityObjects[cap.namespace][cap.name]) {
                            this.log.debug(
                                `unsupported name "${cap.namespace}.${cap.name}" for Smart-Home-Devices.${deviceEntityId}.${cap.name}`,
                            );
                            continue;
                        }
                        // Entries can be plain strings (redirect to the value with this name), the map type does not declare
                        // that. common.name of the definitions is always a plain string.
                        for (const obj of shObjects.capabilityObjects[cap.namespace][cap.name] as (
                            ShStateDefinitionEx | string
                        )[]) {
                            if (typeof obj === 'string') {
                                // Redirect!!
                                capValues[obj] = handleObject(deviceEntityId, cap, obj);
                                this.log.debug(
                                    `${cap.namespace}.${cap.value}: setValueFor=${obj} to ${capValues[obj]}`,
                                );
                            } else {
                                let name = obj.common.name;
                                if (cap.instance) {
                                    name = `${cap.instance.replace(/\./g, '-')}-${name}`;
                                }
                                let val = handleObject(deviceEntityId, cap, name);
                                if (
                                    val === null &&
                                    cap.instance &&
                                    !this.adapterObjects[`Smart-Home-Devices.${deviceEntityId}.${name}`] &&
                                    this.adapterObjects[`Smart-Home-Devices.${deviceEntityId}.${obj.common.name}`]
                                ) {
                                    // seems Amazon provided invalid details about cap.instance, try fallback
                                    val = handleObject(deviceEntityId, cap, obj.common.name);
                                    name = obj.common.name;
                                }
                                capValues[name] = val;
                            }
                        }
                        if (cap.namespace === 'Alexa.ColorController') {
                            if (
                                capValues['color-hue'] !== null &&
                                capValues['color-saturation'] !== null &&
                                capValues['color-brightness'] !== null
                            ) {
                                const colorRgb = this.hsvToRgb(
                                    capValues['color-hue'] as number,
                                    capValues['color-saturation'] as number,
                                    capValues['color-brightness'] as number,
                                );
                                void this.setState(`Smart-Home-Devices.${deviceEntityId}.colorRgb`, colorRgb, true);
                                this.shDeviceParamValues[`Smart-Home-Devices.${deviceEntityId}.colorRgb`] = colorRgb;
                                capValues.colorRgb = colorRgb;
                                colorDataIncluded = true;
                            }
                        }
                    }
                    if (colorDataIncluded && capValues.colorRgb && capValues.colorName === null) {
                        const colorRgbSearch = this.hsvToRgb(
                            capValues['color-hue'] as number,
                            capValues['color-saturation'] as number,
                            1.0,
                        );
                        // NOTE: nearestColor() can return null, this would throw (as before)
                        const nearestColor = shObjects.nearestColor(colorRgbSearch)!;
                        const native = this.adapterObjects[`Smart-Home-Devices.${deviceEntityId}.colorName`].native!;
                        const value: number = native.valueMap.indexOf(nearestColor.name);
                        this.log.debug(
                            `find nearest color for ${colorRgbSearch} (${capValues.colorRgb}): index=${value} / ${JSON.stringify(nearestColor)}`,
                        );
                        if (value !== -1) {
                            void this.setState(`Smart-Home-Devices.${deviceEntityId}.colorName`, value, true);
                            this.shDeviceParamValues[`Smart-Home-Devices.${deviceEntityId}.colorName`] = value;
                            capValues.colorName = value;
                        }
                    }
                }
            }
        }
        if (res.errors) {
            for (const states of res.errors) {
                if (!states.entity || !states.entity.entityId || !this.shApplianceEntityMap[states.entity.entityId]) {
                    continue;
                }
                const deviceEntityId = this.shApplianceEntityMap[states.entity.entityId].entityId;
                if (
                    states.code === 'ENDPOINT_UNREACHABLE' &&
                    this.adapterObjects[`Smart-Home-Devices.${deviceEntityId}.connectivity`]
                ) {
                    void this.setState(`Smart-Home-Devices.${deviceEntityId}.connectivity`, false, true);
                    this.log.debug(`Set Connectivity for ${deviceEntityId} to false because ${states.code}`);
                }
            }
        }
    }

    private getCachedSmarthomeDevices(
        callback: (err: Error | null | undefined, res: AmazonJson | null | undefined) => void,
    ): void {
        // Cache file stays in the adapter root directory (was path.join(__dirname, ...) in main.js)
        const cachedDevicesFilename = join(ADAPTER_DIR, `cachedDevices.${this.namespace}.json`);

        const getCachedDeviceList = (ignoreTimestamp?: boolean): AmazonJson | null => {
            try {
                if (existsSync(cachedDevicesFilename)) {
                    const stats = statSync(cachedDevicesFilename);
                    if (ignoreTimestamp || stats.mtime.getTime() + 30 * 60 * 1000 > Date.now()) {
                        const cachedDevices: AmazonJson = JSON.parse(readFileSync(cachedDevicesFilename, 'utf8'));
                        this.log.info(`Using cached smart home devices list from ${stats.mtime.toString()}`);
                        this.log.debug(JSON.stringify(cachedDevices));
                        return cachedDevices;
                    }
                }
            } catch (err) {
                this.log.info(`Could not cache devices: ${(err as Error).message}`);
            }
            return null;
        };
        const cachedDeviceList = getCachedDeviceList();
        if (cachedDeviceList) {
            callback(null, cachedDeviceList);
            return;
        }

        this.alexa.getSmarthomeDevices((err, body) => {
            // err/res were reassigned in the original, so use local copies
            let error: Error | null | undefined = err;
            let res = body as AmazonJson | null | undefined;
            if (!error && res && res.locationDetails && res.locationDetails.Default_Location) {
                try {
                    writeFileSync(cachedDevicesFilename, JSON.stringify(res));
                } catch (err) {
                    this.log.info(`Could not cache devices: ${(err as Error).message}`);
                }
            }
            if (error || !res || !res.locationDetails || !res.locationDetails.Default_Location) {
                this.log.info(`Could not get smart home devices from Amazon: ${error ? error.message : 'no data'}`);
                res = getCachedDeviceList(true);
                if (res) {
                    error = null;
                    this.log.info('Could not get smart home devices from Amazon. Using cached list.');
                }
            }
            callback(error, res);
        });
    }

    private checkSmartHomeControlParameters(parameterId: string, value: ioBroker.StateValue): boolean {
        let counter = 1;
        const now = Date.now();
        const lastControl = this.shDeviceParamControlValues[parameterId];
        if (lastControl) {
            if (lastControl.ts > now - 300000) {
                // loose comparison (==) intended, as before
                if (lastControl.value == value && typeof lastControl.value !== 'boolean') {
                    this.log.info(`Ignore update of ${parameterId} because it was set to the same value in last 5min`);
                    return false;
                }
                if (typeof lastControl.value === 'number') {
                    // value is not necessarily a number - JS coercion of the subtraction kept as before
                    const difference = Math.abs(lastControl.value - (value as number));
                    if (difference < 0.5) {
                        this.log.info(
                            `Ignore update of ${parameterId} because value only changed ${difference.toFixed(2)} since last set within 5min`,
                        );
                        return false;
                    }
                }
            }
            if (lastControl.ts > now - 600000) {
                counter = ++lastControl.counter;
                if (counter > 4) {
                    this.log.info(
                        `Ignore update of ${parameterId} because it was set too often in the last time (${counter})`,
                    );
                    return false;
                }
            }
        }
        this.shDeviceParamControlValues[parameterId] = {
            value,
            ts: now,
            counter,
        };
        return true;
    }

    /**
     * Callback receives the error of getCachedSmarthomeDevices() (if any) - as in main.js.
     * A callback without parameters (as listed in the contract) is assignable to this type.
     */
    private createSmarthomeStates(callback?: (err?: Error | null) => void): void {
        if (!this.config.synchronizeSmartHomeDevices) {
            return callback && callback();
        }

        // TODO alexa.getSmarthomeGroups nutzen

        this.getStates('Smart-Home-Devices.*.#includeInAllQuery', (err, states) => {
            const shQueryEnabledEntities: Record<string, boolean> = {};
            if (!err && states) {
                Object.keys(states).forEach(id => {
                    if (!states[id]) {
                        return;
                    }
                    const entityId = id
                        .replace(new RegExp(`^${this.namespace}.Smart-Home-Devices.`), '')
                        .replace(/\.#includeInAllQuery$/, '');
                    shQueryEnabledEntities[entityId] = !!states[id].val;
                    this.log.debug(
                        `${id} for ${entityId} is ${shQueryEnabledEntities[entityId] ? 'enabled' : 'disabled'}`,
                    );
                });
            }
            this.alexa.getSmarthomeBehaviourActionDefinitions((err, resProperties) => {
                if (this.stopped) {
                    return;
                }
                if (!err && resProperties) {
                    shObjects.patchProperties(resProperties as AmazonJson[]);
                }

                this.getCachedSmarthomeDevices((err, res) => {
                    if (this.stopped) {
                        return;
                    }
                    this.setOrUpdateObject('Smart-Home-Devices', {
                        type: 'folder',
                        common: { name: 'Smart Home Devices' },
                    });

                    this.setOrUpdateObject(
                        'Smart-Home-Devices.deleteAll',
                        { common: { type: 'boolean', read: false, write: true, role: 'button' } },
                        false,
                        () => {
                            const cachedDevicesFilename = join(ADAPTER_DIR, `cachedDevices.${this.namespace}.json`);
                            try {
                                if (existsSync(cachedDevicesFilename)) {
                                    unlinkSync(cachedDevicesFilename);
                                }
                            } catch (err) {
                                this.log.info(`Could not delete cached devices: ${(err as Error).message}`);
                            }
                            this.alexa.deleteAllSmarthomeDevices(() => {
                                this.delObject('Smart-Home-Devices', { recursive: true }, () => {
                                    this.setTimeout(() => this.createSmarthomeStates(), 1000);
                                });
                            });
                        },
                    );
                    this.setOrUpdateObject(
                        'Smart-Home-Devices.discoverDevices',
                        {
                            common: {
                                name: 'Let Alexa search for devices',
                                type: 'boolean',
                                read: false,
                                write: true,
                                role: 'button',
                            },
                        },
                        false,
                        () => {
                            if (this.shDeviceDiscoveryTimeout) {
                                this.log.info('Discovery was executed too short ago, can not trigger it');
                                return;
                            }
                            const cachedDevicesFilename = join(ADAPTER_DIR, `cachedDevices.${this.namespace}.json`);
                            try {
                                if (existsSync(cachedDevicesFilename)) {
                                    unlinkSync(cachedDevicesFilename);
                                }
                            } catch (err) {
                                this.log.info(`Could not delete cached devices: ${(err as Error).message}`);
                            }
                            this.shDeviceDiscoveryTimeout = this.setTimeout(() => {
                                this.shDeviceDiscoveryTimeout = null;
                            }, 300000);
                            this.alexa.discoverSmarthomeDevice(() => {
                                return this.createSmarthomeStates();
                            });
                        },
                    );

                    if (err || !res) {
                        return this.processObjectQueue(() => callback && callback(err));
                    }

                    this.alexa.getSmarthomeEntities((err, entities) => {
                        if (this.stopped) {
                            return;
                        }
                        const res2 = entities as ShBehaviourEntity[] | undefined;
                        const behaviours: Record<string, ShBehaviourEntity> = {};
                        if (res2 && Array.isArray(res2)) {
                            res2.forEach(behaviour => {
                                behaviours[behaviour.id] = behaviour;
                            });
                        }

                        let readableCounter = 0;
                        let all: AmazonJson = {};
                        if (
                            res &&
                            res.locationDetails &&
                            res.locationDetails.Default_Location &&
                            res.locationDetails.Default_Location.amazonBridgeDetails &&
                            res.locationDetails.Default_Location.amazonBridgeDetails.amazonBridgeDetails
                        ) {
                            all = res.locationDetails.Default_Location.amazonBridgeDetails.amazonBridgeDetails;
                        }
                        for (const i of Object.keys(all)) {
                            for (const n of Object.keys(all[i].applianceDetails.applianceDetails)) {
                                const shDevice: AmazonJson = all[i].applianceDetails.applianceDetails[n];
                                if (!shDevice.isEnabled) {
                                    continue;
                                }
                                let friendlyName = shDevice.friendlyName;
                                this.shApplianceEntityMap[shDevice.applianceId] = {
                                    entityId: shDevice.entityId,
                                    readable: false,
                                    cloudReadable: false,
                                    mergedApplianceIds: shDevice.mergedApplianceIds,
                                    supportedProperties: [],
                                };
                                this.shEntityApplianceMap[shDevice.entityId] = shDevice.applianceId;
                                if (shDevice.mergedApplianceIds && Array.isArray(shDevice.mergedApplianceIds)) {
                                    shDevice.mergedApplianceIds.forEach((applianceId: string) => {
                                        this.shMergedApplianceIdMap[applianceId] = shDevice.applianceId;
                                    });
                                }
                                if (shDevice.aliases && shDevice.aliases[0] && shDevice.aliases[0].friendlyName) {
                                    friendlyName = shDevice.aliases[0].friendlyName;
                                }
                                this.setOrUpdateObject(`Smart-Home-Devices.${shDevice.entityId}`, {
                                    type: 'channel',
                                    common: {
                                        name: friendlyName,
                                        role: 'channel',
                                    },
                                    native: {
                                        friendlyDescription: shDevice.friendlyDescription,
                                        friendlyName: friendlyName,
                                        modelName: shDevice.modelName,
                                        additionalApplianceIds:
                                            shDevice.additionalApplianceDetails.additionalApplianceDetails.ids || null,
                                        object: n,
                                        manufacturerName: shDevice.manufacturerName,
                                    },
                                });
                                this.setOrUpdateObject(
                                    `Smart-Home-Devices.${shDevice.entityId}.#enabled`,
                                    { common: { role: 'indicator', write: true } },
                                    shDevice.isEnabled,
                                    (val: boolean) => {
                                        this.shAlexa.setEnablementForSmarthomeDevice(n, val);
                                    },
                                );
                                // values were bound via .bind(alexa, ...) in main.js
                                const deleteEntityId: string = shDevice.entityId;
                                this.setOrUpdateObject(
                                    `Smart-Home-Devices.${shDevice.entityId}.#delete`,
                                    { common: { type: 'boolean', read: false, write: true, role: 'button' } },
                                    false,
                                    () => {
                                        this.shAlexa.deleteSmarthomeDevice(n);
                                        this.delObject(`Smart-Home-Devices.${deleteEntityId}`, { recursive: true });
                                    },
                                );

                                const excludeReadable =
                                    shDevice.manufacturerName.startsWith('ioBroker') ||
                                    shDevice.manufacturerName.startsWith('openHAB');
                                const deviceActions: Record<string, boolean> = {};
                                if (
                                    behaviours[shDevice.entityId] &&
                                    behaviours[shDevice.entityId].supportedOperations
                                ) {
                                    behaviours[shDevice.entityId].supportedOperations!.forEach(a => {
                                        deviceActions[a] = true;
                                    });
                                }
                                if (shDevice.actions && shDevice.actions.length) {
                                    shDevice.actions.forEach((a: string) => {
                                        deviceActions[a] = true;
                                    });
                                }
                                const applianceDriverIdentity: string = shDevice.applianceDriverIdentity
                                    ? shDevice.applianceDriverIdentity.identifier || ''
                                    : '';
                                let readableProperties = 0;
                                let capabilitiesReadable: boolean | null = null;
                                let capabilitiesCloudReadable: boolean | null | undefined = null;
                                if (shDevice.capabilities.length) {
                                    for (const cap of shDevice.capabilities as AmazonJson[]) {
                                        if (cap.interfaceName) {
                                            // For Scenes we add the action
                                            if (
                                                (!cap.properties || !cap.properties.supported) &&
                                                cap.interfaceName === 'Alexa.SceneController'
                                            ) {
                                                cap.properties = {
                                                    supported: [
                                                        {
                                                            name: 'active',
                                                        },
                                                    ],
                                                };
                                            } else if (
                                                !cap.properties ||
                                                !cap.properties.supported ||
                                                !cap.properties.supported.length
                                            ) {
                                                continue;
                                            } else if (!cap.properties.retrievable) {
                                                // NOTE: capabilitiesReadable is assigned but never read (as in main.js)
                                                capabilitiesReadable = capabilitiesReadable || false;
                                                if (!(
                                                    cap.properties.proactivelyReported &&
                                                    applianceDriverIdentity === 'SonarCloudService' &&
                                                    !!shDevice.connectedVia &&
                                                    !shDevice.applianceId.startsWith('SKILL_')
                                                )) {
                                                    continue;
                                                }
                                            }
                                            capabilitiesCloudReadable =
                                                capabilitiesCloudReadable || cap.properties.proactivelyReported;
                                            if (!shObjects.capabilityObjects[cap.interfaceName]) {
                                                if (shObjects.capabilityObjects[cap.interfaceName] !== null) {
                                                    this.log.debug(
                                                        `Smarthome-Device Capability ${cap.interfaceName} unknown. Report to developer this and next log line from logfile on disk!`,
                                                    );
                                                    this.log.debug(
                                                        `${JSON.stringify(shDevice)} / ${JSON.stringify(behaviours[shDevice.entityId])}`,
                                                    );
                                                }
                                                continue;
                                            }

                                            for (const capProp of cap.properties.supported as AmazonJson[]) {
                                                if (!shObjects.capabilityObjects[cap.interfaceName][capProp.name]) {
                                                    this.log.debug(
                                                        `Smarthome-Device Capability ${cap.interfaceName} for ${capProp.name} unknown. Report to developer this and next log line from logfile on disk!`,
                                                    );
                                                    this.log.debug(
                                                        `${JSON.stringify(shDevice)} / ${JSON.stringify(behaviours[shDevice.entityId])}`,
                                                    );
                                                    continue;
                                                }

                                                let propertyToQuery = false;
                                                // Entries can be plain strings (redirects), the map type does not declare that
                                                for (const objDef of shObjects.capabilityObjects[cap.interfaceName][
                                                    capProp.name
                                                ] as (ShStateDefinitionEx | string)[]) {
                                                    if (typeof objDef === 'string') {
                                                        continue;
                                                    }
                                                    let obj = JSON.parse(JSON.stringify(objDef)) as ShStateDefinitionEx;
                                                    if (obj.experimental) {
                                                        this.log.debug(
                                                            `Smarthome-Device Capability ${cap.interfaceName} for ${capProp.name}.${obj.common.name} experimentally supported. Please check and report to developer this and next log line from logfile on disk if it works!!`,
                                                        );
                                                        // NOTE: behaviours[...] is stringified via the template literal ("[object Object]") - as before
                                                        this.log.debug(
                                                            // eslint-disable-next-line @typescript-eslint/no-base-to-string
                                                            `${JSON.stringify(shDevice)} / ${JSON.stringify(`${String(behaviours[shDevice.entityId])} / ${JSON.stringify(obj)}`)}`,
                                                        );
                                                    }
                                                    if (obj.experimental) {
                                                        delete obj.experimental;
                                                    }
                                                    if (obj.common && obj.common.read) {
                                                        if (
                                                            !excludeReadable &&
                                                            (cap.properties.retrievable ||
                                                                (!cap.properties.retrievable &&
                                                                    cap.properties.proactivelyReported &&
                                                                    applianceDriverIdentity === 'SonarCloudService' &&
                                                                    !!shDevice.connectedVia &&
                                                                    !shDevice.applianceId.startsWith('SKILL_')))
                                                        ) {
                                                            readableProperties++;
                                                            propertyToQuery = true;
                                                        } else {
                                                            obj.common.read = false;
                                                        }
                                                    }

                                                    const origName = obj.common.name;
                                                    if (cap.instance) {
                                                        if (!obj.native.paramName) {
                                                            obj.native.paramName = obj.common.name;
                                                        }
                                                        obj.common.name = `${cap.instance.replace(/\./g, '-')}-${obj.common.name}`;
                                                    }

                                                    if (cap.configuration) {
                                                        obj = shObjects.configureCapabilityObject(
                                                            cap,
                                                            obj,
                                                        ) as ShStateDefinitionEx;
                                                    }

                                                    if (
                                                        obj.native.supportedActions &&
                                                        obj.native.supportedActions.length
                                                    ) {
                                                        obj.native.supportedActions.forEach((n: string) => {
                                                            if (deviceActions[n] !== undefined) {
                                                                delete deviceActions[n];
                                                            }
                                                            if (
                                                                cap.instance &&
                                                                deviceActions[
                                                                    `${n}@${shDevice.entityId}_${cap.instance}`
                                                                ] !== undefined
                                                            ) {
                                                                delete deviceActions[
                                                                    `${n}@${shDevice.entityId}_${cap.instance}`
                                                                ];
                                                            }
                                                        });
                                                    }

                                                    // values were bound via .bind(alexa, ...) in main.js
                                                    const entityId: string = shDevice.entityId;
                                                    const paramName = origName;
                                                    const applianceId: string = shDevice.applianceId;
                                                    // obj is not reassigned after this point, so the closure sees the same object as before
                                                    const stateObj = obj;
                                                    this.setOrUpdateObject(
                                                        `Smart-Home-Devices.${shDevice.entityId}.${stateObj.common.name}`,
                                                        stateObj,
                                                        undefined,
                                                        (value: ioBroker.StateValue) => {
                                                            if (!stateObj.common.write) {
                                                                return;
                                                            }
                                                            const parameters = this.buildSmartHomeControlParameters(
                                                                entityId,
                                                                shObjects.capabilityObjects[cap.interfaceName],
                                                                capProp.name,
                                                                paramName,
                                                                value,
                                                                cap.instance,
                                                            );
                                                            let actionName = parameters.action;
                                                            if (cap.instance) {
                                                                if (actionName === 'turnOffToggle') {
                                                                    actionName = `turnOff@${shDevice.entityId}_${cap.instance}`;
                                                                } else if (actionName === 'turnOnToggle') {
                                                                    actionName = `turnOn@${shDevice.entityId}_${cap.instance}`;
                                                                } else {
                                                                    actionName = `${actionName}@${shDevice.entityId}_${cap.instance}`;
                                                                }
                                                            }
                                                            if (
                                                                !parameters.action ||
                                                                !behaviours[entityId] ||
                                                                !behaviours[entityId].supportedOperations ||
                                                                !behaviours[entityId].supportedOperations.includes(
                                                                    actionName!,
                                                                )
                                                            ) {
                                                                if (
                                                                    parameters.action &&
                                                                    !parameters.action.startsWith('turn') &&
                                                                    !parameters.action.startsWith('scene')
                                                                ) {
                                                                    this.log.debug(
                                                                        `Invalid action ${parameters.action} provided for Capability ${cap.interfaceName} for ${stateObj.common.name}. Report to developer this and next log line from logfile on disk!`,
                                                                    );
                                                                    this.log.debug(
                                                                        `${JSON.stringify(shDevice)} / ${JSON.stringify(behaviours[entityId])}`,
                                                                    );
                                                                } else {
                                                                    this.log.debug(
                                                                        `Action ${actionName} provided for Capability ${cap.interfaceName} for ${stateObj.common.name} is not supported, ignore`,
                                                                    );
                                                                }
                                                                return;
                                                            }

                                                            if (
                                                                !this.checkSmartHomeControlParameters(
                                                                    `${entityId}.${stateObj.common.name}`,
                                                                    value,
                                                                )
                                                            ) {
                                                                return;
                                                            }

                                                            this.shAlexa.executeSmarthomeDeviceAction(
                                                                entityId,
                                                                parameters,
                                                                (err, body) => {
                                                                    const res = body as
                                                                        ShDeviceStatesResponse | undefined;
                                                                    if (
                                                                        !err &&
                                                                        res &&
                                                                        res.controlResponses &&
                                                                        res.controlResponses[0] &&
                                                                        res.controlResponses[0].code &&
                                                                        res.controlResponses[0].code === 'SUCCESS' &&
                                                                        !excludeReadable
                                                                    ) {
                                                                        if (this.shQueryBlocker[applianceId]) {
                                                                            this.clearTimeout(
                                                                                this.shQueryBlocker[applianceId],
                                                                            );
                                                                            this.shQueryBlocker[applianceId] = null;
                                                                        }
                                                                        if (
                                                                            this.shDeviceRefreshTimeoutAfterControl[
                                                                                applianceId
                                                                            ]
                                                                        ) {
                                                                            this.clearTimeout(
                                                                                this.shDeviceRefreshTimeoutAfterControl[
                                                                                    applianceId
                                                                                ],
                                                                            );
                                                                            this.shDeviceRefreshTimeoutAfterControl[
                                                                                applianceId
                                                                            ] = null;
                                                                        }
                                                                        this.shDeviceRefreshTimeoutAfterControl[
                                                                            applianceId
                                                                        ] = this.setTimeout(() => {
                                                                            this.shDeviceRefreshTimeoutAfterControl[
                                                                                applianceId
                                                                            ] = null;

                                                                            if (this.shQueryBlocker[applianceId]) {
                                                                                this.clearTimeout(
                                                                                    this.shQueryBlocker[applianceId],
                                                                                );
                                                                                this.shQueryBlocker[applianceId] = null;
                                                                            }
                                                                            /**
                                                                             * Please do not change these delay, else Amazon might block the smart home device state query function
                                                                             * for all >20k Adapter users!
                                                                             */
                                                                            let delay = 900000;
                                                                            if (
                                                                                !applianceId.startsWith('SKILL_') ||
                                                                                this.shApplianceEntityMap[applianceId]
                                                                                    .cloudReadable
                                                                            ) {
                                                                                delay = 600000;
                                                                            }
                                                                            this.shQueryBlocker[applianceId] =
                                                                                this.setTimeout(() => {
                                                                                    this.shQueryBlocker[applianceId] =
                                                                                        null;
                                                                                }, delay);

                                                                            this.alexa.querySmarthomeDevices(
                                                                                this.generateApplianceQueryArray(
                                                                                    applianceId,
                                                                                    true,
                                                                                ),
                                                                                (err, res) => {
                                                                                    if (!err) {
                                                                                        this.updateSmarthomeDeviceStates(
                                                                                            res as
                                                                                                | ShDeviceStatesResponse
                                                                                                | undefined,
                                                                                        );
                                                                                    }
                                                                                },
                                                                            );
                                                                        }, 2000);
                                                                    } else {
                                                                        this.updateSmarthomeDeviceStates(res);
                                                                    }
                                                                },
                                                            );
                                                        },
                                                    );

                                                    if (
                                                        shDevice.tags &&
                                                        shDevice.tags.tagNameToValueSetMap &&
                                                        shDevice.tags.tagNameToValueSetMap.groupIdentity
                                                    ) {
                                                        for (const group of shDevice.tags.tagNameToValueSetMap
                                                            .groupIdentity as string[]) {
                                                            this.shGroupDetails[group] = this.shGroupDetails[group] || {
                                                                applianceIds: {},
                                                                entityIds: {},
                                                                parameters: {},
                                                            };
                                                            this.shGroupDetails[group].applianceIds[
                                                                shDevice.applianceId
                                                            ] = true;
                                                            this.shGroupDetails[group].entityIds[shDevice.entityId] =
                                                                true;
                                                            this.shGroupDetails[group].parameters[
                                                                stateObj.common.name
                                                            ] = stateObj;
                                                        }
                                                    }
                                                }
                                                if (propertyToQuery) {
                                                    this.shApplianceEntityMap[
                                                        shDevice.applianceId
                                                    ].supportedProperties.push({
                                                        namespace: cap.interfaceName,
                                                        name: capProp.name,
                                                        instance: cap.instance, // ???
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                                const deviceActionsArr = Object.keys(deviceActions);
                                if (deviceActionsArr.length) {
                                    let readable = false;
                                    if (!excludeReadable) {
                                        for (const action of deviceActionsArr) {
                                            if (action.startsWith('get') || action.startsWith('retrieve')) {
                                                readable = true;
                                                readableProperties++;
                                            }
                                        }
                                    }

                                    let ignoreSecondTurnOnOff = false;
                                    for (let action of deviceActionsArr) {
                                        if (ignoreSecondTurnOnOff && (action === 'turnOn' || action === 'turnOff')) {
                                            continue;
                                        }
                                        if (
                                            (action === 'turnOn' && deviceActionsArr.includes('turnOff')) ||
                                            (action === 'turnOff' && deviceActionsArr.includes('turnOn'))
                                        ) {
                                            action = 'turnOnOff';
                                            ignoreSecondTurnOnOff = true;
                                        }
                                        if (!shObjects.actionObjects[action]) {
                                            if (!action.includes('@')) {
                                                this.log.debug(
                                                    `Smarthome-Device Action ${action} unknown. Report to developer this and next log line from logfile on disk!`,
                                                );
                                                this.log.debug(
                                                    `${JSON.stringify(shDevice)} / ${JSON.stringify(behaviours[shDevice.entityId])}`,
                                                );
                                            }
                                            continue;
                                        }
                                        // action is not reassigned after this point, the closure below captures this value
                                        const actionKey = action;
                                        // Entries can be plain strings, the map type does not declare that
                                        for (const objDef of shObjects.actionObjects[actionKey] as (
                                            ShStateDefinitionEx | string
                                        )[]) {
                                            if (typeof objDef === 'string') {
                                                continue;
                                            }
                                            const obj = JSON.parse(JSON.stringify(objDef)) as ShStateDefinitionEx;
                                            if (obj.experimental) {
                                                this.log.debug(
                                                    `Smarthome-Device Action ${actionKey}.${obj.common.name} experimentally supported. Please check and report to developer this and next log line from logfile on disk if it works!!`,
                                                );
                                                this.log.debug(
                                                    `${JSON.stringify(shDevice)} / ${JSON.stringify(behaviours[shDevice.entityId])} / ${JSON.stringify(obj)}`,
                                                );
                                            }
                                            if (obj.experimental) {
                                                delete obj.experimental;
                                            }
                                            if (obj.common && obj.common.read && excludeReadable) {
                                                obj.common.read = false;
                                            }
                                            if (obj.native.supportedActions && obj.native.supportedActions.length) {
                                                obj.native.supportedActions.forEach((n: string) => {
                                                    if (deviceActions[n] !== undefined) {
                                                        delete deviceActions[n];
                                                    }
                                                });
                                            }
                                            if (
                                                actionKey === 'turnOn' ||
                                                (actionKey === 'sceneActivate' &&
                                                    behaviours[shDevice.entityId] &&
                                                    behaviours[shDevice.entityId].supportedOperations &&
                                                    !behaviours[shDevice.entityId].supportedOperations!.includes(
                                                        'sceneDeactivate',
                                                    ))
                                            ) {
                                                obj.common.role = 'button';
                                                obj.common.read = false;
                                            }
                                            obj.native.readable = readable;

                                            // values were bound via .bind(alexa, ...) in main.js
                                            const entityId: string = shDevice.entityId;
                                            const paramName = obj.common.name;
                                            const applianceId: string = shDevice.applianceId;
                                            this.setOrUpdateObject(
                                                `Smart-Home-Devices.${shDevice.entityId}.${obj.common.name}`,
                                                obj,
                                                undefined,
                                                (value: ioBroker.StateValue) => {
                                                    if (!obj.common.write) {
                                                        return;
                                                    }
                                                    const origValue = value;
                                                    const parameters = this.buildSmartHomeControlParameters(
                                                        shDevice.entityId,
                                                        shObjects.actionObjects[actionKey],
                                                        null,
                                                        paramName,
                                                        value,
                                                    );

                                                    if (
                                                        !behaviours[entityId] ||
                                                        !behaviours[entityId].supportedOperations ||
                                                        !behaviours[entityId].supportedOperations.includes(
                                                            parameters.action!,
                                                        )
                                                    ) {
                                                        // NOTE: throws if parameters.action is undefined (as before)
                                                        if (
                                                            !parameters.action!.startsWith('turn') &&
                                                            !parameters.action!.startsWith('scene')
                                                        ) {
                                                            this.log.debug(
                                                                `Invalid action ${parameters.action} provided for Action ${actionKey}. Report to developer this and next log line from logfile on disk!`,
                                                            );
                                                            this.log.debug(
                                                                `${JSON.stringify(shDevice)} / ${JSON.stringify(behaviours[entityId])}`,
                                                            );
                                                        } else {
                                                            this.log.debug(
                                                                `Action ${parameters.action} provided for Action ${actionKey} for ${obj.common.name} is not supported, ignore`,
                                                            );
                                                        }
                                                        return;
                                                    }

                                                    if (
                                                        !this.checkSmartHomeControlParameters(
                                                            `${entityId}.${obj.common.name}`,
                                                            value,
                                                        )
                                                    ) {
                                                        return;
                                                    }

                                                    this.shAlexa.executeSmarthomeDeviceAction(
                                                        entityId,
                                                        parameters,
                                                        (err, body) => {
                                                            const res = body as ShDeviceStatesResponse | undefined;
                                                            if (
                                                                !err &&
                                                                res &&
                                                                res.controlResponses &&
                                                                res.controlResponses[0] &&
                                                                res.controlResponses[0].code &&
                                                                res.controlResponses[0].code === 'SUCCESS'
                                                            ) {
                                                                if (obj.native.readable) {
                                                                    if (this.shQueryBlocker[applianceId]) {
                                                                        this.clearTimeout(
                                                                            this.shQueryBlocker[applianceId],
                                                                        );
                                                                        this.shQueryBlocker[applianceId] = null;
                                                                    }
                                                                    if (
                                                                        this.shDeviceRefreshTimeoutAfterControl[
                                                                            applianceId
                                                                        ]
                                                                    ) {
                                                                        this.clearTimeout(
                                                                            this.shDeviceRefreshTimeoutAfterControl[
                                                                                applianceId
                                                                            ],
                                                                        );
                                                                        this.shDeviceRefreshTimeoutAfterControl[
                                                                            applianceId
                                                                        ] = null;
                                                                    }
                                                                    this.shDeviceRefreshTimeoutAfterControl[
                                                                        applianceId
                                                                    ] = this.setTimeout(() => {
                                                                        this.shDeviceRefreshTimeoutAfterControl[
                                                                            applianceId
                                                                        ] = null;

                                                                        if (this.shQueryBlocker[applianceId]) {
                                                                            this.clearTimeout(
                                                                                this.shQueryBlocker[applianceId],
                                                                            );
                                                                            this.shQueryBlocker[applianceId] = null;
                                                                        }
                                                                        /**
                                                                         * Please do not change these delay, else Amazon might block the smart home device state query function
                                                                         * for all >20k Adapter users!
                                                                         */
                                                                        let delay = 900000;
                                                                        if (
                                                                            !applianceId.startsWith('SKILL_') ||
                                                                            this.shApplianceEntityMap[applianceId]
                                                                                .cloudReadable
                                                                        ) {
                                                                            delay = 600000;
                                                                        }
                                                                        this.shQueryBlocker[applianceId] =
                                                                            this.setTimeout(() => {
                                                                                this.shQueryBlocker[applianceId] = null;
                                                                            }, delay);

                                                                        this.alexa.querySmarthomeDevices(
                                                                            this.generateApplianceQueryArray(
                                                                                applianceId,
                                                                                true,
                                                                            ),
                                                                            (err, res) => {
                                                                                if (!err) {
                                                                                    this.updateSmarthomeDeviceStates(
                                                                                        res as
                                                                                            | ShDeviceStatesResponse
                                                                                            | undefined,
                                                                                    );
                                                                                }
                                                                            },
                                                                        );
                                                                    }, 2000);
                                                                } else {
                                                                    void this.setState(
                                                                        `Smart-Home-Devices.${shDevice.entityId}.${obj.common.name}`,
                                                                        origValue,
                                                                        true,
                                                                    );
                                                                }
                                                            } else {
                                                                this.updateSmarthomeDeviceStates(res);
                                                            }
                                                        },
                                                    );
                                                },
                                            );

                                            if (
                                                shDevice.tags &&
                                                shDevice.tags.tagNameToValueSetMap &&
                                                shDevice.tags.tagNameToValueSetMap.groupIdentity
                                            ) {
                                                for (const group of shDevice.tags.tagNameToValueSetMap
                                                    .groupIdentity as string[]) {
                                                    this.shGroupDetails[group] = this.shGroupDetails[group] || {
                                                        applianceIds: {},
                                                        entityIds: {},
                                                        parameters: {},
                                                    };
                                                    this.shGroupDetails[group].applianceIds[shDevice.applianceId] =
                                                        true;
                                                    this.shGroupDetails[group].entityIds[shDevice.entityId] = true;
                                                    this.shGroupDetails[group].parameters[obj.common.name] = obj;
                                                }
                                            }
                                        }
                                    }
                                }
                                if (readableProperties > 0 && !excludeReadable) {
                                    this.shApplianceEntityMap[shDevice.applianceId].readable = true;
                                    this.shApplianceEntityMap[shDevice.applianceId].cloudReadable =
                                        capabilitiesCloudReadable;
                                    this.log.debug(
                                        `Smarthome-Device ${shDevice.entityId} is readable / cloud readable (${capabilitiesCloudReadable})`,
                                    );
                                    readableCounter++;
                                    // value was bound via .bind(alexa, ...) in main.js
                                    const applianceId: string = shDevice.applianceId;
                                    this.setOrUpdateObject(
                                        `Smart-Home-Devices.${shDevice.entityId}.#query`,
                                        { common: { type: 'boolean', read: false, write: true, role: 'button' } },
                                        false,
                                        () => {
                                            if (this.shQueryBlocker[applianceId]) {
                                                this.log.warn(`Smart Home device request blocked for ${applianceId}`);
                                                return;
                                            }
                                            /**
                                             * Please do not change these delay, else Amazon might block the smart home device state query function
                                             * for all >20k Adapter users!
                                             */
                                            let delay = 900000;
                                            if (
                                                !applianceId.startsWith('SKILL_') ||
                                                this.shApplianceEntityMap[applianceId].cloudReadable
                                            ) {
                                                delay = 600000;
                                            }
                                            this.shQueryBlocker[applianceId] = this.setTimeout(() => {
                                                this.shQueryBlocker[applianceId] = null;
                                            }, delay);
                                            this.alexa.querySmarthomeDevices(
                                                this.generateApplianceQueryArray(applianceId, true),
                                                (err, res) => {
                                                    if (!err) {
                                                        this.updateSmarthomeDeviceStates(
                                                            res as ShDeviceStatesResponse | undefined,
                                                        );
                                                    }
                                                },
                                            );
                                        },
                                    );
                                    this.shQueryEnabled[shDevice.applianceId] =
                                        !!shQueryEnabledEntities[shDevice.entityId];
                                    this.log.debug(
                                        `Smarthome-Device ${shDevice.applianceId} is query enabled (${this.shQueryEnabled[shDevice.applianceId]})`,
                                    );
                                    this.setOrUpdateObject(
                                        `Smart-Home-Devices.${shDevice.entityId}.#includeInAllQuery`,
                                        {
                                            common: {
                                                type: 'boolean',
                                                read: true,
                                                write: true,
                                                role: 'switch',
                                                def: false,
                                            },
                                        },
                                        undefined,
                                        (value: ioBroker.StateValue) => {
                                            this.shQueryEnabled[applianceId] = !!value;
                                            void this.setState(
                                                `Smart-Home-Devices.${shDevice.entityId}.#includeInAllQuery`,
                                                !!value,
                                                true,
                                            );
                                        },
                                    );
                                }
                            }
                        }
                        let allGroups: AmazonJson = {};
                        if (
                            res &&
                            res.locationDetails &&
                            res.locationDetails.Default_Location &&
                            res.locationDetails.Default_Location.applianceGroups &&
                            res.locationDetails.Default_Location.applianceGroups.applianceGroups
                        ) {
                            allGroups = res.locationDetails.Default_Location.applianceGroups.applianceGroups;
                        }
                        for (const i of Object.keys(allGroups)) {
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
                            const groupData: AmazonJson = allGroups[i];
                            const friendlyName = groupData.applianceGroupName;
                            const groupParamData = this.shGroupDetails[groupData.applianceGroupIdentifier.value];
                            if (!groupParamData) {
                                continue;
                            }
                            const groupIdShort = i.substring(i.lastIndexOf('.') + 1);
                            this.setOrUpdateObject(`Smart-Home-Devices.${groupIdShort}`, {
                                type: 'channel',
                                common: {
                                    name: `Gruppe ${friendlyName}`,
                                    role: 'channel',
                                },
                                native: {
                                    friendlyName: friendlyName,
                                    ids: groupData.applianceGroupIdentifier.value,
                                    object: groupData,
                                },
                            });
                            // value was bound via .bind(alexa, i) in main.js
                            const groupEntityId = i;
                            this.setOrUpdateObject(
                                `Smart-Home-Devices.${groupIdShort}.#delete`,
                                { common: { type: 'boolean', read: false, write: true, role: 'button' } },
                                false,
                                () => {
                                    this.shAlexa.deleteSmarthomeGroup(groupEntityId);
                                    this.delObject(`Smart-Home-Devices.${groupIdShort}`, { recursive: true });
                                },
                            );

                            for (const param of Object.keys(groupParamData.parameters)) {
                                const obj = groupParamData.parameters[param];
                                if (obj.native && obj.native.hideInGroups) {
                                    continue;
                                }
                                //obj.common.read = false;

                                // values were bound via .bind(alexa, ...) in main.js, i.e. evaluated now (not when called)
                                const entityId = Object.keys(groupParamData.entityIds);
                                const paramName = obj.common.name;
                                // NOTE: this is an array of appliance ids (bound like this in main.js), used as if it were
                                // a single id: as object key it becomes 'id1,id2', and applianceId.startsWith() below throws
                                // a TypeError. Kept as before, the cast only exists to keep the original code compiling.
                                const applianceId = Object.keys(groupParamData.applianceIds) as unknown as string;
                                this.setOrUpdateObject(
                                    `Smart-Home-Devices.${groupIdShort}.${obj.common.name}`,
                                    obj,
                                    undefined,
                                    (value: ioBroker.StateValue) => {
                                        if (!obj.common.write) {
                                            return;
                                        }
                                        const parameters = this.buildSmartHomeControlParameters(
                                            entityId,
                                            obj,
                                            null,
                                            paramName,
                                            value,
                                        );

                                        if (
                                            !behaviours[groupIdShort] ||
                                            !behaviours[groupIdShort].supportedOperations ||
                                            !behaviours[groupIdShort].supportedOperations.includes(parameters.action!)
                                        ) {
                                            this.log.debug(
                                                `Invalid action ${parameters.action} provided for Group-Action ${parameters.action}. Report to developer this and next log line from logfile on disk!`,
                                            );
                                            this.log.debug(
                                                `${JSON.stringify(groupData)} / ${JSON.stringify(behaviours[groupIdShort])}`,
                                            );
                                            return;
                                        }

                                        if (
                                            !this.checkSmartHomeControlParameters(
                                                `${groupIdShort}.${obj.common.name}`,
                                                value,
                                            )
                                        ) {
                                            return;
                                        }

                                        this.shAlexa.executeSmarthomeDeviceAction(
                                            groupIdShort,
                                            parameters,
                                            'GROUP',
                                            (err, body) => {
                                                const res = body as ShDeviceStatesResponse | undefined;
                                                if (
                                                    !err &&
                                                    res &&
                                                    res.controlResponses &&
                                                    res.controlResponses[0] &&
                                                    res.controlResponses[0].code &&
                                                    res.controlResponses[0].code === 'SUCCESS'
                                                ) {
                                                    if (obj.native.readable) {
                                                        if (this.shQueryBlocker[applianceId]) {
                                                            this.clearTimeout(this.shQueryBlocker[applianceId]);
                                                            this.shQueryBlocker[applianceId] = null;
                                                        }
                                                        if (this.shDeviceRefreshTimeoutAfterControl[applianceId]) {
                                                            this.clearTimeout(
                                                                this.shDeviceRefreshTimeoutAfterControl[applianceId],
                                                            );
                                                            this.shDeviceRefreshTimeoutAfterControl[applianceId] = null;
                                                        }
                                                        this.shDeviceRefreshTimeoutAfterControl[applianceId] =
                                                            this.setTimeout(() => {
                                                                this.shDeviceRefreshTimeoutAfterControl[applianceId] =
                                                                    null;

                                                                if (this.shQueryBlocker[applianceId]) {
                                                                    this.clearTimeout(this.shQueryBlocker[applianceId]);
                                                                    this.shQueryBlocker[applianceId] = null;
                                                                }
                                                                /**
                                                                 * Please do not change these delay, else Amazon might block the smart home device state query function
                                                                 * for all >20k Adapter users!
                                                                 */
                                                                let delay = 900000;
                                                                if (
                                                                    !applianceId.startsWith('SKILL_') ||
                                                                    this.shApplianceEntityMap[applianceId].cloudReadable
                                                                ) {
                                                                    delay = 600000;
                                                                }
                                                                this.shQueryBlocker[applianceId] = this.setTimeout(
                                                                    () => {
                                                                        this.shQueryBlocker[applianceId] = null;
                                                                    },
                                                                    delay,
                                                                );
                                                                this.alexa.querySmarthomeDevices(
                                                                    this.generateApplianceQueryArray(applianceId, true),
                                                                    (err, res) => {
                                                                        if (!err) {
                                                                            this.updateSmarthomeDeviceStates(
                                                                                res as
                                                                                    ShDeviceStatesResponse | undefined,
                                                                            );
                                                                        }
                                                                    },
                                                                );
                                                            }, 2000);
                                                    }
                                                } else {
                                                    this.updateSmarthomeDeviceStates(res);
                                                }
                                            },
                                        );
                                    },
                                );
                            }
                        }
                        if (readableCounter) {
                            this.setOrUpdateObject(
                                'Smart-Home-Devices.queryAll',
                                { common: { type: 'boolean', read: false, write: true, role: 'button' } },
                                false,
                                () => {
                                    this.queryAllSmartHomeDevices(false, false);
                                },
                            );
                        }
                        this.processObjectQueue(callback);
                    });
                });
            });
        });
    }

    // ---- converted from main.js (part C) ----
    private scheduleHistoryUpdate(delay?: number): void {
        if (delay === undefined) {
            // NOTE: checks updateStateInterval and not updateHistoryInterval - kept as before
            if (this.config.updateStateInterval === 0) {
                return;
            }
            delay = this.config.updateHistoryInterval * 1000;
        }
        if (this.updateHistoryTimer) {
            this.clearTimeout(this.updateHistoryTimer);
        }
        if (this.pushConnected) {
            return;
        }
        if (this.stopped) {
            return;
        }
        delay = Math.max(delay, 60000);
        this.updateHistoryTimer = this.setTimeout(() => {
            this.updateHistoryTimer = null;
            if (this.stopped) {
                return;
            }
            this.updateHistory();
        }, delay);
    }

    private updateHistory(callback?: () => void): void {
        if (this.updateHistoryTimer) {
            this.clearTimeout(this.updateHistoryTimer);
            this.updateHistoryTimer = null;
        }
        if (this.stopped) {
            return;
        }
        this.alexa.getCustomerHistoryRecords(
            { maxRecordSize: 3, filter: true, startTime: Date.now() - 60000 },
            (err, res) => {
                if (this.stopped) {
                    return;
                }
                if (err || !res || !Array.isArray(res)) {
                    if (this.config.updateHistoryInterval > 0) {
                        this.scheduleHistoryUpdate();
                    }
                    return callback && callback();
                }
                const records = res as AmazonJson[];

                this.getState('History.creationTime', (err, state) => {
                    if (err || !state) {
                        if (this.config.updateHistoryInterval > 0) {
                            this.scheduleHistoryUpdate();
                        }
                        return callback && callback();
                    }

                    let last = state.val as number;
                    let i = records.length - 1;
                    const doIt = (): void => {
                        if (i < 0) {
                            if (this.config.updateHistoryInterval > 0) {
                                this.scheduleHistoryUpdate();
                            }
                            return callback && callback();
                        }

                        const o = records[i--];
                        if (last >= o.creationTimestamp) {
                            return doIt();
                        }

                        this.updateHistoryStates(o);
                        last = o.creationTimestamp;

                        doIt();
                    };
                    doIt();
                });
            },
        );
    }

    /*
    activityCardContent - > activity.domainAttributes.card.content
    activityCard - > JSON.stringify(activity.domainAttributes.card)
    */

    private updateHistoryStates(o: AmazonJson): void {
        if (this.config.historyIgnoreEmptySummary && !o.description.summary.length && !o.alexaResponse) {
            this.log.debug(`Ignore History entry because configured: ${JSON.stringify(o)}`);
            return;
        }

        void this.setState('History.name', o.name, true);
        void this.setState('History.serialNumber', o.deviceSerialNumber, true);
        void this.setState('History.summary', o.description.summary || '', true);
        if (o.activityStatus !== undefined) {
            void this.setState('History.status', o.activityStatus, true);
        }
        void this.setState('History.creationTime', o.creationTimestamp, true);

        const jsonHistory: HistoryJson = {
            name: o.name,
            serialNumber: o.deviceSerialNumber,
            summary: o.description.summary,
            creationTime: o.creationTimestamp,
            status: o.activityStatus,
            domainApplicationId: '',
            domainApplicationName: o.data.skillName,
            cardContent: '',
            card: '',
            answerText: o.alexaResponse || '',
            utteranceType: o.data.utteranceType,
            domain: o.data.domain,
            intent: o.data.intent,
        };

        if (o.domainAttributes) {
            // deprecated
            if (o.domainAttributes.applicationMetadata) {
                void this.setState(
                    'History.domainApplicationId',
                    o.domainAttributes.applicationMetadata.applicationId || '',
                    true,
                );
                jsonHistory.domainApplicationId = o.domainAttributes.applicationMetadata.applicationId || '';
                void this.setState(
                    'History.domainApplicationName',
                    o.domainAttributes.applicationMetadata.applicationName || '',
                    true,
                );
                jsonHistory.domainApplicationName = o.domainAttributes.applicationMetadata.applicationName;
            } else {
                void this.setState('History.domainApplicationId', '', true);
                void this.setState('History.domainApplicationName', '', true);
            }
            if (o.domainAttributes.card) {
                void this.setState('History.cardContent', o.domainAttributes.card.content || '', true);
                jsonHistory.cardContent = o.domainAttributes.card.content || '';
                void this.setState('History.cardJson', JSON.stringify(o.domainAttributes.card), true);
                jsonHistory.card = o.domainAttributes.card;
            } else {
                void this.setState('History.cardContent', '', true);
                void this.setState('History.cardJson', '', true);
            }
            if (o.domainAttributes.nBestList && o.domainAttributes.nBestList[0]) {
                void this.setState(
                    'History.answerText',
                    o.domainAttributes.nBestList[0].answerText || o.domainAttributes.nBestList[0].text || '',
                    true,
                );
                jsonHistory.answerText = o.domainAttributes.nBestList[0].answerText;
            } else {
                void this.setState('History.answerText', '', true);
            }
        } else {
            void this.setState('History.domainApplicationId', jsonHistory.domainApplicationId, true);
            void this.setState('History.domainApplicationName', jsonHistory.domainApplicationName, true);
            void this.setState('History.cardContent', jsonHistory.cardContent, true);
            void this.setState('History.cardJson', JSON.stringify(jsonHistory.card), true);
            void this.setState('History.answerText', jsonHistory.answerText, true);
            void this.setState('History.utteranceType', jsonHistory.utteranceType, true);
            void this.setState('History.domain', jsonHistory.domain, true);
            void this.setState('History.intent', jsonHistory.intent, true);

            if (jsonHistory.domain === 'Global' && jsonHistory.intent === 'StopIntent') {
                if (
                    this.lastPlayerState[jsonHistory.serialNumber] &&
                    this.lastPlayerState[jsonHistory.serialNumber].resPlayer &&
                    this.lastPlayerState[jsonHistory.serialNumber].resPlayer.state === 'PLAYING'
                ) {
                    this.schedulePlayerUpdate(jsonHistory.serialNumber, 5000, true);
                }
            } else if (jsonHistory.domain === 'Music') {
                this.schedulePlayerUpdate(jsonHistory.serialNumber, 5000, true);
            } else if (jsonHistory.domain === 'Notifications') {
                // NOTE: jsonHistory has no field deviceSerialNumber (it is called serialNumber), so this schedules
                // the update for "undefined" - kept as before
                this.scheduleNotificationUpdate((jsonHistory as AmazonJson).deviceSerialNumber, 2000);
            }
        }
        void this.setState('History.json', JSON.stringify(jsonHistory), true);
    }

    private iterateMultiroom(
        device: AlexaDevice,
        commandCallback: MultiroomCommandCallback,
        doneCallback?: () => void,
        counter?: number,
    ): void {
        if (!device.isMultiroomDevice) {
            return commandCallback(device, doneCallback);
        }
        if (counter === undefined) {
            this.log.debug(`iterate START: ${JSON.stringify(device.clusterMembers)}`);
            counter = 0;
        }
        if (counter >= device.clusterMembers.length) {
            this.log.debug(`iterate done ${counter} vs. ${device.clusterMembers.length}`);
            return doneCallback && doneCallback();
        }
        const currDevice = this.findDevice(device.clusterMembers[counter]);
        counter++;
        if (!currDevice) {
            this.log.debug(`iterate ${counter}: NOT FOUND`);
            return this.iterateMultiroom(device, commandCallback, doneCallback, counter);
        }
        this.log.debug(`iterate ${counter}: ${currDevice.serialNumber}`);
        return commandCallback(currDevice, () => this.iterateMultiroom(device, commandCallback, doneCallback, counter));
    }

    private createStatesForDevice(device: AlexaDevice, additionalDeviceData: AdditionalDeviceData): Promise<void> {
        return new Promise(resolve => {
            const devId = `Echo-Devices.${device.serialNumber}`;

            device.getNotificationSounds('Alarm', (err, res) => {
                const alarmSounds = res as NotificationSoundsResponse | undefined;
                if (
                    !err &&
                    alarmSounds &&
                    alarmSounds.notificationSounds &&
                    Array.isArray(alarmSounds.notificationSounds)
                ) {
                    const alarmNotificationSounds = alarmSounds.notificationSounds;
                    const alarmNotificationSoundsStateList: Record<string, string> = {};
                    device.alarmNotificationSounds = alarmNotificationSounds;
                    device.alarmNotificationSoundsStateList = alarmNotificationSoundsStateList;
                    // forEach only visits the entries that existed when it was started, so the pushed entries
                    // are not processed again
                    alarmNotificationSounds.forEach(n => {
                        let soundId = n.id;
                        let displayName = n.displayName;
                        if (n.providerId !== 'ECHO') {
                            const folder = n.folder.replace(/^FOLDER_/, '');
                            soundId = `${folder}-${n.id}`;
                            displayName = `${n.providerId}: ${displayName}`;
                            alarmNotificationSounds.push(Object.assign({}, n, { id: soundId, origId: n.id }));
                        }
                        alarmNotificationSoundsStateList[soundId] = displayName;
                    });
                }

                device.getNotificationSounds('Timer', (err, res) => {
                    const timerSounds = res as NotificationSoundsResponse | undefined;
                    if (
                        !err &&
                        timerSounds &&
                        timerSounds.notificationSounds &&
                        Array.isArray(timerSounds.notificationSounds)
                    ) {
                        const timerNotificationSoundsStateList: Record<string, string> = {};
                        device.timerNotificationSounds = timerSounds.notificationSounds;
                        device.timerNotificationSoundsStateList = timerNotificationSoundsStateList;
                        device.timerNotificationSounds.forEach(n => {
                            timerNotificationSoundsStateList[n.id] = n.displayName;
                        });
                    }

                    device.getDeviceNotificationState((err, res) => {
                        const notificationState = res as DeviceNotificationStateResponse | undefined;
                        if (!err && notificationState && notificationState.volumeLevel !== undefined) {
                            additionalDeviceData.notificationVolume = notificationState.volumeLevel;
                        }

                        device.getDeviceNotificationDefaultSound('Alarm', (err, res) => {
                            const alarmDefault = res as DeviceNotificationDefaultSoundResponse | undefined;
                            if (!err && alarmDefault && alarmDefault.defaultNotificationSound !== undefined) {
                                additionalDeviceData.defaultAlarmNotificationSound =
                                    alarmDefault.defaultNotificationSound;
                            }

                            device.getDeviceNotificationDefaultSound('Timer', (err, res) => {
                                const timerDefault = res as DeviceNotificationDefaultSoundResponse | undefined;
                                if (!err && timerDefault && timerDefault.defaultNotificationSound !== undefined) {
                                    additionalDeviceData.defaultTimerNotificationSound =
                                        timerDefault.defaultNotificationSound;
                                }

                                void this.createDeviceStates(device, additionalDeviceData, () => {
                                    if (device.ignore) {
                                        this.setTimeout(() => !this.stopped && resolve(), 300);
                                    }

                                    if (device.isControllable) {
                                        this.playerDevices[device.serialNumber] = true;
                                        this.setOrUpdateObject(`${devId}.Player`, { type: 'channel' });

                                        this.setOrUpdateObject(`${devId}.Player.contentType`, {
                                            common: { role: 'text', write: false, def: '' },
                                        }); // 'LIVE_STATION' | 'TRACKS' | 'CUSTOM_STATION'
                                        this.setOrUpdateObject(`${devId}.Player.currentState`, {
                                            common: { role: 'media.state', write: false, def: false },
                                        }); // 'PAUSED' | 'PLAYING'
                                        this.setOrUpdateObject(`${devId}.Player.imageURL`, {
                                            common: {
                                                name: 'Huge image',
                                                role: 'media.cover.big',
                                                write: false,
                                                def: '',
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.providerId`, {
                                            common: { role: 'text', write: false, def: '' },
                                        }); // 'TUNE_IN' | 'CLOUD_PLAYER' | 'ROBIN'
                                        this.setOrUpdateObject(`${devId}.Player.radioStationId`, {
                                            common: { role: 'text', write: false, def: '' },
                                        }); // 's24885' | null
                                        this.setOrUpdateObject(`${devId}.Player.service`, {
                                            common: { role: 'text', write: false, def: '' },
                                        }); // 'TUNE_IN' | 'CLOUD_PLAYER' | 'PRIME_STATION'
                                        this.setOrUpdateObject(`${devId}.Player.providerName`, {
                                            common: {
                                                name: 'active provider',
                                                role: 'media.input',
                                                write: false,
                                                def: '',
                                            },
                                        }); // 'Amazon Music' | 'TuneIn Live-Radio'

                                        this.setOrUpdateObject(`${devId}.Player.currentTitle`, {
                                            common: {
                                                name: 'current title',
                                                type: 'string',
                                                role: 'media.title',
                                                write: false,
                                                def: '',
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.currentArtist`, {
                                            common: {
                                                name: 'current artist',
                                                type: 'string',
                                                role: 'media.artist',
                                                write: false,
                                                def: '',
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.currentAlbum`, {
                                            common: {
                                                name: 'current album',
                                                type: 'string',
                                                role: 'media.album',
                                                write: false,
                                                def: '',
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.mainArtUrl`, {
                                            common: {
                                                name: 'current main Art',
                                                type: 'string',
                                                role: 'media.cover',
                                                write: false,
                                                def: '',
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.miniArtUrl`, {
                                            common: {
                                                name: 'current mini Art',
                                                type: 'string',
                                                role: 'media.cover.small',
                                                write: false,
                                                def: '',
                                            },
                                        });

                                        this.setOrUpdateObject(
                                            `${devId}.Player.mediaId`,
                                            {
                                                common: {
                                                    name: 'current mediaId',
                                                    type: 'string',
                                                    role: 'media.playid',
                                                    write: true,
                                                    def: '',
                                                },
                                            },
                                            (value: ioBroker.StateValue) => {
                                                this.alexa.sendCommand(device, 'jump', value);
                                            },
                                        );
                                        this.setOrUpdateObject(`${devId}.Player.queueId`, {
                                            common: {
                                                name: 'current queueId',
                                                type: 'string',
                                                role: 'text',
                                                write: false,
                                                def: '',
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.quality`, {
                                            common: {
                                                name: 'current media quality',
                                                type: 'string',
                                                role: 'text',
                                                write: false,
                                                def: '',
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.qualityCodec`, {
                                            common: {
                                                name: 'current media codec',
                                                type: 'string',
                                                write: false,
                                                role: 'text',
                                                def: '',
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.qualityDataRate`, {
                                            common: {
                                                name: 'current media bitrate',
                                                type: 'number',
                                                write: false,
                                                role: 'media.bitrate',
                                                def: null,
                                                unit: 'kbps',
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.qualitySampleRate`, {
                                            common: {
                                                name: 'current media sample rate',
                                                type: 'number',
                                                write: false,
                                                role: 'value',
                                                def: null,
                                                unit: 'Hz',
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.allowNext`, {
                                            common: {
                                                name: 'allow action Next',
                                                type: 'boolean',
                                                role: 'indicator',
                                                write: false,
                                                def: false,
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.allowPlayPause`, {
                                            common: {
                                                name: 'allow action Play/Pause',
                                                type: 'boolean',
                                                role: 'indicator',
                                                write: false,
                                                def: false,
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.allowPrevious`, {
                                            common: {
                                                name: 'allow action Previous',
                                                type: 'boolean',
                                                role: 'indicator',
                                                write: false,
                                                def: false,
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.allowRepeat`, {
                                            common: {
                                                name: 'allow action Repeat',
                                                type: 'boolean',
                                                role: 'indicator',
                                                write: false,
                                                def: false,
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.allowShuffle`, {
                                            common: {
                                                name: 'allow action Shuffle',
                                                type: 'boolean',
                                                role: 'indicator',
                                                write: false,
                                                def: false,
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.playingInGroup`, {
                                            common: {
                                                name: 'is Playing in Group?',
                                                type: 'boolean',
                                                role: 'indicator',
                                                write: false,
                                                def: false,
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.playingInGroupId`, {
                                            common: {
                                                name: 'Current playing group ID',
                                                type: 'string',
                                                role: 'text',
                                                write: false,
                                                def: '',
                                            },
                                        });

                                        this.setOrUpdateObject(`${devId}.Player.mediaLength`, {
                                            common: {
                                                name: 'active media length',
                                                type: 'number',
                                                role: 'media.duration',
                                                def: 0,
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.mediaLengthStr`, {
                                            common: {
                                                name: 'active media length as (HH:)MM:SS',
                                                type: 'string',
                                                role: 'media.duration.text',
                                                def: '',
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.mediaProgress`, {
                                            common: {
                                                name: 'active media progress',
                                                type: 'number',
                                                role: 'media.elapsed',
                                                def: 0,
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.mediaProgressStr`, {
                                            common: {
                                                name: 'active media progress as (HH:)MM:SS',
                                                type: 'string',
                                                role: 'media.elapsed.text',
                                                def: '',
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.mediaProgressPercent`, {
                                            common: {
                                                name: 'active media progress as percent',
                                                type: 'number',
                                                role: 'media.elapsed.percent',
                                                def: 0,
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.mediaRemaining`, {
                                            common: {
                                                name: 'active media remaining time',
                                                type: 'number',
                                                role: 'value',
                                                def: 0,
                                            },
                                        });
                                        this.setOrUpdateObject(`${devId}.Player.mediaRemainingStr`, {
                                            common: {
                                                name: 'active media remaining time as (HH:)MM:SS',
                                                type: 'string',
                                                role: 'value',
                                                def: '',
                                            },
                                        });

                                        for (const c of Object.keys(PLAYER_CONTROLS)) {
                                            const obj: (typeof PLAYER_CONTROLS)[string] = JSON.parse(
                                                JSON.stringify(PLAYER_CONTROLS[c]),
                                            );
                                            this.setOrUpdateObject(
                                                `${devId}.Player.${c}`,
                                                { common: obj.common },
                                                obj.val,
                                                this.alexa.sendCommand.bind(this.alexa, device, obj.command as string),
                                            );
                                        }

                                        if (device.capabilities.includes('VOLUME_SETTING')) {
                                            this.setOrUpdateObject(`${devId}.Player.muted`, {
                                                common: {
                                                    type: 'boolean',
                                                    role: 'media.mute',
                                                    write: false,
                                                    def: false,
                                                },
                                            });
                                            this.setOrUpdateObject(
                                                `${devId}.Player.volume`,
                                                {
                                                    common: {
                                                        type: 'number',
                                                        role: 'level.volume',
                                                        min: 0,
                                                        max: 100,
                                                        def: null,
                                                    },
                                                },
                                                undefined,
                                                (value: ioBroker.StateValue) => {
                                                    if (device.isMultiroomDevice) {
                                                        this.alexa.sendCommand(device, 'volume', value, (err, res) => {
                                                            // on unavailability {"message":"No routes found","userFacingMessage":null}
                                                            const volumeRes = res as AmazonJson | undefined;
                                                            if (volumeRes && volumeRes.message === 'No routes found') {
                                                                const volumeCommands: SequenceCommandEntry[] = [];
                                                                this.iterateMultiroom(
                                                                    device,
                                                                    (iteratorDevice, nextCallback) => {
                                                                        volumeCommands.push({
                                                                            command: 'volume',
                                                                            value,
                                                                            device: iteratorDevice.serialNumber,
                                                                        });
                                                                        nextCallback && nextCallback();
                                                                    },
                                                                    () => {
                                                                        this.alexa.sendMultiSequenceCommand(
                                                                            device.serialNumber,
                                                                            volumeCommands,
                                                                            'ParallelNode',
                                                                            this.alexa.ownerCustomerId,
                                                                        );
                                                                    },
                                                                );
                                                            }
                                                        });
                                                    } else {
                                                        try {
                                                            this.alexa.sendSequenceCommand(
                                                                device,
                                                                'volume',
                                                                value,
                                                                this.alexa.ownerCustomerId,
                                                            );
                                                        } catch (err) {
                                                            this.log.error(
                                                                `${device.serialNumber} Error setting volume: ${err}`,
                                                            );
                                                        }
                                                    }
                                                },
                                            );
                                        }

                                        if (device.hasMusicPlayer) {
                                            for (const c of Object.keys(MUSIC_CONTROLS)) {
                                                const obj: (typeof MUSIC_CONTROLS)[string] = JSON.parse(
                                                    JSON.stringify(MUSIC_CONTROLS[c]),
                                                );
                                                this.setOrUpdateObject(
                                                    `${devId}.Player.${c}`,
                                                    { common: obj.common },
                                                    obj.val,
                                                    this.alexa.sendCommand.bind(
                                                        this.alexa,
                                                        device,
                                                        obj.command as string,
                                                    ),
                                                );
                                            }
                                            this.setOrUpdateObject(`${devId}.Music-Provider`, { type: 'channel' });
                                            // musicProviders is an array, iterated with for...in as before
                                            // (undefined iterates nothing)
                                            const musicProviders = this.musicProviders as
                                                Record<string, AmazonJson> | undefined;
                                            for (const p in musicProviders) {
                                                if (musicProviders[p].availability !== 'AVAILABLE') {
                                                    continue;
                                                }
                                                if (
                                                    !musicProviders[p].supportedOperations.includes(
                                                        'Alexa.Music.PlaySearchPhrase',
                                                    )
                                                ) {
                                                    continue;
                                                }
                                                const displayName = musicProviders[p].displayName
                                                    .replace(this.FORBIDDEN_CHARS, '-')
                                                    .replace(/\./g, '_')
                                                    .replace(/ /g, '-');
                                                if (!displayName.length) {
                                                    if (musicProviders[p].id !== 'DEFAULT') {
                                                        this.log.warn(
                                                            `Music Provider has no name, ignoring! (${JSON.stringify(musicProviders[p])})`,
                                                        );
                                                    }
                                                    continue;
                                                }

                                                // the provider id is captured now (as with .bind() before),
                                                // not read when the state is changed
                                                const providerId: string = musicProviders[p].id;
                                                this.setOrUpdateObject(
                                                    `${devId}.Music-Provider.${displayName}`,
                                                    {
                                                        common: {
                                                            name: `Phrase to play with ${musicProviders[p].displayName}`,
                                                            type: 'string',
                                                            role: 'text',
                                                            def: '',
                                                        },
                                                    },
                                                    '',
                                                    (value: string) =>
                                                        this.playMusicProvider(device, providerId, value),
                                                );
                                                this.setOrUpdateObject(
                                                    `${devId}.Music-Provider.${displayName}-Playlist`,
                                                    {
                                                        common: {
                                                            name: `Playlist to play with ${musicProviders[p].displayName}`,
                                                            type: 'string',
                                                            role: 'text',
                                                            def: '',
                                                        },
                                                    },
                                                    '',
                                                    (value: string) => {
                                                        if (value === '') {
                                                            return;
                                                        }
                                                        this.playMusicProvider(device, providerId, `playlist ${value}`);
                                                    },
                                                );
                                            }
                                        }

                                        if (device.capabilities.includes('TUNE_IN')) {
                                            this.setOrUpdateObject(
                                                `${devId}.Player.TuneIn-Station`,
                                                { common: { role: 'text', def: '' } },
                                                '',
                                                (query: string) => {
                                                    if (query.match(/^s[0-9]+$/)) {
                                                        device.setTunein(query, 'station', err => {
                                                            if (!err) {
                                                                void this.setState(
                                                                    `${devId}.Player.TuneIn-Station`,
                                                                    query,
                                                                    true,
                                                                );
                                                                // NOTE: the device object (not the serial number) is used
                                                                // as timer key - kept as before
                                                                this.schedulePlayerUpdate(
                                                                    device as unknown as string,
                                                                    5000,
                                                                );
                                                            }
                                                        });
                                                        /*} else if (query.match(/^p[0-9]+$/)) {
                                                            device.setTunein(query, 'show', (err, ret) => {
                                                                if (!err) {
                                                                    adapter.setState(`${devId}.Player.TuneIn-Station`, query, true);
                                                                    schedulePlayerUpdate(device, 5000);
                                                                }
                                                            });*/
                                                    } else if (query.match(/^t[0-9]+$/)) {
                                                        device.setTunein(query, 'topic', err => {
                                                            if (!err) {
                                                                void this.setState(
                                                                    `${devId}.Player.TuneIn-Station`,
                                                                    query,
                                                                    true,
                                                                );
                                                                this.schedulePlayerUpdate(
                                                                    device as unknown as string,
                                                                    5000,
                                                                );
                                                            }
                                                        });
                                                    } else {
                                                        this.alexa.tuneinSearch(query, (err, res) => {
                                                            this.setRequestResult(err, res);
                                                            const searchRes = res as TuneinSearchResponse | undefined;
                                                            if (
                                                                err ||
                                                                !searchRes ||
                                                                !Array.isArray(searchRes.browseList)
                                                            ) {
                                                                return;
                                                            }
                                                            const station = searchRes.browseList[0];
                                                            device.setTunein(station.id, station.contentType, err => {
                                                                if (!err) {
                                                                    void this.setState(
                                                                        `Echo-Devices.${device.serialNumber}.Player.TuneIn-Station`,
                                                                        station.name,
                                                                        true,
                                                                    );
                                                                    this.schedulePlayerUpdate(
                                                                        device as unknown as string,
                                                                        5000,
                                                                    );
                                                                }
                                                            });
                                                        });
                                                    }
                                                },
                                            );
                                        }

                                        if (device.capabilities.includes('AUDIBLE')) {
                                            this.setOrUpdateObject(
                                                `${devId}.Music-Provider.Audible`,
                                                { common: { role: 'text', def: '' } },
                                                '',
                                                (query: string) => {
                                                    device.playAudible(query, err => {
                                                        if (!err) {
                                                            void this.setState(
                                                                `${devId}.Music-Provider.Audible`,
                                                                query,
                                                                true,
                                                            );
                                                            // NOTE: the device object (not the serial number) is used
                                                            // as timer key - kept as before
                                                            this.schedulePlayerUpdate(
                                                                device as unknown as string,
                                                                5000,
                                                            );
                                                        }
                                                    });
                                                },
                                            );
                                        }
                                    }
                                    this.createBluetoothStates(device);

                                    if (device.notifications) {
                                        this.createNotificationStates(device);
                                    }

                                    if (!device.isMultiroomDevice && device.deviceFamily === 'FIRE_TV') {
                                        this.setOrUpdateObject(`${devId}.FireTVCommands`, { type: 'channel' });
                                        for (const c of Object.keys(FIRE_TV_COMMANDS)) {
                                            const obj: (typeof FIRE_TV_COMMANDS)[string] = JSON.parse(
                                                JSON.stringify(FIRE_TV_COMMANDS[c]),
                                            );
                                            // c is a const per loop iteration, so it has the same
                                            // value as when it was bound before
                                            this.setOrUpdateObject(
                                                `${devId}.FireTVCommands.${c}`,
                                                { common: obj.common },
                                                obj.val,
                                                (value: ioBroker.StateValue) => {
                                                    const command = FIRE_TV_COMMANDS[c].command || c;
                                                    try {
                                                        this.alexa.sendSequenceCommand(
                                                            device,
                                                            command,
                                                            value,
                                                            this.alexa.ownerCustomerId,
                                                        );
                                                    } catch (err) {
                                                        this.log.error(
                                                            `${device.serialNumber} Error sending command ${command} to FireTV: ${err}`,
                                                        );
                                                    }
                                                },
                                            );
                                        }
                                        /*setOrUpdateObject(`${devId}.FireTVCommands.playPhrase`, {common: {role: 'text', def: '', write: true, read: false}}, '', function (device, query) {
                                            alexa.playFireTV(device, query, (err, ret) => {
                                                if (!err) {
                                                    adapter.setState(`${devId}.FireTVCommands.playPhrase`, query, true);
                                                }
                                            });
                                        }.bind(alexa, device));*/
                                    }

                                    if (device.deviceTypeDetails && device.deviceTypeDetails.commandSupport) {
                                        this.setOrUpdateObject(`${devId}.Commands`, { type: 'channel' });
                                        for (const c of Object.keys(COMMANDS)) {
                                            if (c === 'notification' && device.isMultiroomDevice) {
                                                continue;
                                            }
                                            const obj: (typeof COMMANDS)[string] = JSON.parse(
                                                JSON.stringify(COMMANDS[c]),
                                            );
                                            if (
                                                c === 'sound' &&
                                                this.routineSounds &&
                                                Object.keys(this.routineSounds).length
                                            ) {
                                                obj.common.states = this.routineSounds;
                                            }
                                            if (
                                                c === 'skillYours' &&
                                                this.routineSkills &&
                                                Object.keys(this.routineSkills).length
                                            ) {
                                                obj.common.states = this.routineSkills;
                                            }
                                            // c is a const per loop iteration, so it has the same
                                            // value as when it was bound before
                                            this.setOrUpdateObject(
                                                `${devId}.Commands.${c}`,
                                                { common: obj.common },
                                                obj.val,
                                                (value: SequenceCommandValue) => {
                                                    const command = COMMANDS[c].command || c;
                                                    const commandsToExecute: SequenceCommandEntry[] = [];
                                                    const speakVolumeCommands: SequenceCommandEntry[] = [];
                                                    const speakVolumeResetCommands: SequenceCommandEntry[] = [];

                                                    this.iterateMultiroom(
                                                        device,
                                                        (iteratorDevice, nextCallback) => {
                                                            if (
                                                                command === 'notification' &&
                                                                value &&
                                                                typeof value === 'string' &&
                                                                value.includes(';')
                                                            ) {
                                                                const parts = value.split(';');
                                                                const title = parts.shift();
                                                                value = {
                                                                    title,
                                                                    text: parts.join(';'),
                                                                };
                                                            }

                                                            if (
                                                                command === 'deviceStop' ||
                                                                command === 'textCommand' ||
                                                                command.startsWith('skill')
                                                            ) {
                                                                commandsToExecute.push({
                                                                    command,
                                                                    value,
                                                                    device: iteratorDevice.serialNumber,
                                                                });
                                                                return nextCallback && nextCallback();
                                                            }
                                                            const speakVolume = iteratorDevice.speakVolume;
                                                            this.getState(
                                                                `Echo-Devices.${iteratorDevice.serialNumber}.Player.volume`,
                                                                (err, state) => {
                                                                    let speakVolumeReset = 0;
                                                                    if (
                                                                        !err &&
                                                                        state &&
                                                                        state.val !== false &&
                                                                        state.val !== null
                                                                    ) {
                                                                        speakVolumeReset = state.val as number;
                                                                    }
                                                                    if (
                                                                        speakVolume &&
                                                                        speakVolume > 0 &&
                                                                        speakVolume !== speakVolumeReset
                                                                    ) {
                                                                        speakVolumeCommands.push({
                                                                            command: 'volume',
                                                                            value: speakVolume,
                                                                            device: iteratorDevice.serialNumber,
                                                                        });
                                                                    }
                                                                    commandsToExecute.push({
                                                                        command,
                                                                        value,
                                                                        device: iteratorDevice.serialNumber,
                                                                    });
                                                                    if (
                                                                        speakVolume &&
                                                                        speakVolume > 0 &&
                                                                        speakVolumeReset &&
                                                                        speakVolumeReset > 0 &&
                                                                        speakVolume !== speakVolumeReset
                                                                    ) {
                                                                        speakVolumeResetCommands.push({
                                                                            command: 'volume',
                                                                            value: speakVolumeReset,
                                                                            device: iteratorDevice.serialNumber,
                                                                        });
                                                                    }
                                                                    nextCallback && nextCallback();
                                                                },
                                                            );
                                                        },
                                                        () => {
                                                            if (!commandsToExecute.length) {
                                                                return;
                                                            }
                                                            if (command === 'deviceStop' || command === 'textCommand') {
                                                                this.alexa.sendMultiSequenceCommand(
                                                                    device.serialNumber,
                                                                    commandsToExecute,
                                                                    'ParallelNode',
                                                                    this.alexa.ownerCustomerId,
                                                                );
                                                            } else {
                                                                const allCommands: SequenceCommandEntry[] = [];
                                                                speakVolumeCommands.length &&
                                                                    allCommands.push({
                                                                        sequenceType: 'ParallelNode',
                                                                        nodes: speakVolumeCommands,
                                                                    });
                                                                allCommands.push({
                                                                    sequenceType: 'ParallelNode',
                                                                    nodes: commandsToExecute,
                                                                });
                                                                speakVolumeResetCommands.length &&
                                                                    allCommands.push({
                                                                        sequenceType: 'ParallelNode',
                                                                        nodes: speakVolumeResetCommands,
                                                                    });
                                                                this.alexa.sendMultiSequenceCommand(
                                                                    device.serialNumber,
                                                                    allCommands,
                                                                    null,
                                                                    this.alexa.ownerCustomerId,
                                                                );
                                                            }
                                                        },
                                                    );
                                                },
                                            );
                                        }
                                        this.setOrUpdateObject(
                                            `${devId}.Commands.speak`,
                                            { common: { role: 'media.tts', def: '' } },
                                            '',
                                            (value: ioBroker.StateValue) => {
                                                if (typeof value !== 'string') {
                                                    return;
                                                }
                                                if (!value) {
                                                    return;
                                                }
                                                // the original reassigned `value` in the iterator below,
                                                // a string typed local variable is used for that now
                                                let speakText: string = value;

                                                const speakVolumeCommands: SequenceCommandEntry[] = [];
                                                const speakCommands: SequenceCommandEntry[] = [];
                                                const speakVolumeResetCommands: SequenceCommandEntry[] = [];

                                                this.iterateMultiroom(
                                                    device,
                                                    (iteratorDevice, nextCallback) => {
                                                        let valueArr = speakText.match(
                                                            /^(([^;0-9]+);)?(([0-9]{1,3});)?(.+)$/,
                                                        ) as string[] | null;
                                                        if (!valueArr) {
                                                            valueArr = [];
                                                        }
                                                        // NOTE: the volume from the text is a string, the one of
                                                        // the device a number - kept as before
                                                        const speakVolume: string | number | undefined =
                                                            valueArr[4] || iteratorDevice.speakVolume;
                                                        speakText = valueArr[5] || speakText;
                                                        if (!valueArr[4] && valueArr[1]) {
                                                            speakText = valueArr[1] + speakText;
                                                        }
                                                        this.getState(
                                                            `Echo-Devices.${iteratorDevice.serialNumber}.Player.volume`,
                                                            (err, state) => {
                                                                let speakVolumeReset = 0;
                                                                if (
                                                                    !err &&
                                                                    state &&
                                                                    state.val !== false &&
                                                                    state.val !== null
                                                                ) {
                                                                    speakVolumeReset = state.val as number;
                                                                }
                                                                if (
                                                                    speakVolume &&
                                                                    (speakVolume as number) > 0 &&
                                                                    speakVolume !== speakVolumeReset
                                                                ) {
                                                                    speakVolumeCommands.push({
                                                                        command: 'volume',
                                                                        value: speakVolume,
                                                                        device: iteratorDevice.serialNumber,
                                                                    });
                                                                }
                                                                const speakCommandsFromValue: SequenceCommandEntry[] =
                                                                    [];
                                                                speakText.split(';').forEach(v => {
                                                                    const value = v.trim();
                                                                    if (!value || !value.length) {
                                                                        return;
                                                                    }
                                                                    speakCommandsFromValue.push({
                                                                        command: 'speak',
                                                                        value,
                                                                        device: iteratorDevice.serialNumber,
                                                                    });
                                                                });
                                                                speakCommands.push({
                                                                    sequenceType: 'SerialNode',
                                                                    nodes: speakCommandsFromValue,
                                                                });
                                                                if (
                                                                    speakVolume &&
                                                                    (speakVolume as number) > 0 &&
                                                                    speakVolumeReset &&
                                                                    speakVolumeReset > 0 &&
                                                                    speakVolume !== speakVolumeReset
                                                                ) {
                                                                    speakVolumeResetCommands.push({
                                                                        command: 'volume',
                                                                        value: speakVolumeReset,
                                                                        device: iteratorDevice.serialNumber,
                                                                    });
                                                                }
                                                                nextCallback && nextCallback();
                                                            },
                                                        );
                                                    },
                                                    () => {
                                                        // Done
                                                        if (!speakCommands.length) {
                                                            return;
                                                        }
                                                        const allCommands: SequenceCommandEntry[] = [];
                                                        speakVolumeCommands.length &&
                                                            allCommands.push({
                                                                sequenceType: 'ParallelNode',
                                                                nodes: speakVolumeCommands,
                                                            });
                                                        allCommands.push({
                                                            sequenceType: 'ParallelNode',
                                                            nodes: speakCommands,
                                                        });
                                                        speakVolumeResetCommands.length &&
                                                            allCommands.push({
                                                                sequenceType: 'ParallelNode',
                                                                nodes: speakVolumeResetCommands,
                                                            });
                                                        this.alexa.sendMultiSequenceCommand(
                                                            device.serialNumber,
                                                            allCommands,
                                                            null,
                                                            this.alexa.ownerCustomerId,
                                                        );
                                                    },
                                                );
                                            },
                                        );
                                        this.setOrUpdateObject(
                                            `${devId}.Commands.announcement`,
                                            { common: { role: 'media.tts', def: '' } },
                                            '',
                                            (value: ioBroker.StateValue) => {
                                                if (typeof value !== 'string') {
                                                    return;
                                                }
                                                if (!value) {
                                                    return;
                                                }
                                                // the original reassigned `value` in the iterator below,
                                                // a string typed local variable is used for that now
                                                let announceText: string = value;

                                                const speakVolumeCommands: SequenceCommandEntry[] = [];
                                                const speakVolumeResetCommands: SequenceCommandEntry[] = [];

                                                let speakValue = '';
                                                this.iterateMultiroom(
                                                    device,
                                                    (iteratorDevice, nextCallback) => {
                                                        let valueArr = announceText.match(
                                                            /^(([^;0-9]+);)?(([0-9]{1,3});)?(.+)$/,
                                                        ) as string[] | null;
                                                        if (!valueArr) {
                                                            valueArr = [];
                                                        }
                                                        // NOTE: the volume from the text is a string, the one of
                                                        // the device a number - kept as before
                                                        const speakVolume: string | number | undefined =
                                                            valueArr[4] || iteratorDevice.speakVolume;
                                                        announceText = valueArr[5] || announceText;
                                                        if (!valueArr[4] && valueArr[1]) {
                                                            announceText = valueArr[1] + announceText;
                                                        }
                                                        this.getState(
                                                            `Echo-Devices.${iteratorDevice.serialNumber}.Player.volume`,
                                                            (err, state) => {
                                                                let speakVolumeReset = 0;
                                                                if (
                                                                    !err &&
                                                                    state &&
                                                                    state.val !== false &&
                                                                    state.val !== null
                                                                ) {
                                                                    speakVolumeReset = state.val as number;
                                                                }
                                                                if (
                                                                    speakVolume &&
                                                                    (speakVolume as number) > 0 &&
                                                                    speakVolume !== speakVolumeReset
                                                                ) {
                                                                    speakVolumeCommands.push({
                                                                        command: 'volume',
                                                                        value: speakVolume,
                                                                        device: iteratorDevice.serialNumber,
                                                                    });
                                                                }
                                                                if (!speakValue) {
                                                                    speakValue = announceText;
                                                                }
                                                                if (
                                                                    speakVolume &&
                                                                    (speakVolume as number) > 0 &&
                                                                    speakVolumeReset &&
                                                                    speakVolumeReset > 0 &&
                                                                    speakVolume !== speakVolumeReset
                                                                ) {
                                                                    speakVolumeResetCommands.push({
                                                                        command: 'volume',
                                                                        value: speakVolumeReset,
                                                                        device: iteratorDevice.serialNumber,
                                                                    });
                                                                }
                                                                nextCallback && nextCallback();
                                                            },
                                                        );
                                                    },
                                                    () => {
                                                        const announceCommands: SequenceCommandEntry[] = [];
                                                        let volumeResetDelay = 3000;
                                                        speakValue.split(';').forEach(v => {
                                                            const value = v.trim();
                                                            if (!value || !value.length) {
                                                                return;
                                                            }
                                                            announceCommands.push({ command: 'announcement', value });
                                                            const lengthValue = value
                                                                .replace(/<.+?>/g, ' ')
                                                                .replace(/\s+/g, ' ')
                                                                .trim();
                                                            volumeResetDelay += lengthValue.length * 150;
                                                        });
                                                        if (!announceCommands.length) {
                                                            return;
                                                        }

                                                        const allCommands: SequenceCommandEntry[] = [];
                                                        speakVolumeCommands.length &&
                                                            allCommands.push({
                                                                sequenceType: 'ParallelNode',
                                                                nodes: speakVolumeCommands,
                                                            });
                                                        if (announceCommands.length === 1) {
                                                            allCommands.push(announceCommands[0]);
                                                        } else {
                                                            allCommands.push({
                                                                sequenceType: 'SerialNode',
                                                                nodes: announceCommands,
                                                            });
                                                        }
                                                        this.alexa.sendMultiSequenceCommand(
                                                            device.isMultiroomDevice && device.clusterMembers
                                                                ? device.clusterMembers
                                                                : device,
                                                            allCommands,
                                                            null,
                                                            this.alexa.ownerCustomerId,
                                                            () => {
                                                                // Amazon requires us to send volume down separately for announcement
                                                                if (speakVolumeResetCommands.length) {
                                                                    this.setTimeout(() => {
                                                                        this.alexa.sendMultiSequenceCommand(
                                                                            device.isMultiroomDevice &&
                                                                                device.clusterMembers
                                                                                ? device.clusterMembers
                                                                                : device,
                                                                            speakVolumeResetCommands,
                                                                            'ParallelNode',
                                                                            this.alexa.ownerCustomerId,
                                                                        );
                                                                    }, volumeResetDelay);
                                                                }
                                                            },
                                                        );
                                                    },
                                                );
                                            },
                                        );
                                        this.setOrUpdateObject(
                                            `${devId}.Commands.ssml`,
                                            { common: { role: 'media.tts', def: '' } },
                                            '',
                                            (value: ioBroker.StateValue) => {
                                                if (typeof value !== 'string') {
                                                    return;
                                                }
                                                const ssmlText = value.trim();
                                                if (!ssmlText) {
                                                    return;
                                                }

                                                const speakVolumeCommands: SequenceCommandEntry[] = [];
                                                const speakVolumeResetCommands: SequenceCommandEntry[] = [];

                                                this.iterateMultiroom(
                                                    device,
                                                    (iteratorDevice, nextCallback) => {
                                                        const speakVolume = iteratorDevice.speakVolume;
                                                        this.getState(
                                                            `Echo-Devices.${iteratorDevice.serialNumber}.Player.volume`,
                                                            (err, state) => {
                                                                let speakVolumeReset = 0;
                                                                if (
                                                                    !err &&
                                                                    state &&
                                                                    state.val !== false &&
                                                                    state.val !== null
                                                                ) {
                                                                    speakVolumeReset = state.val as number;
                                                                }
                                                                if (
                                                                    speakVolume &&
                                                                    speakVolume > 0 &&
                                                                    speakVolume !== speakVolumeReset
                                                                ) {
                                                                    speakVolumeCommands.push({
                                                                        command: 'volume',
                                                                        value: speakVolume,
                                                                        device: iteratorDevice.serialNumber,
                                                                    });
                                                                }
                                                                if (
                                                                    speakVolume &&
                                                                    speakVolume > 0 &&
                                                                    speakVolumeReset &&
                                                                    speakVolumeReset > 0 &&
                                                                    speakVolume !== speakVolumeReset
                                                                ) {
                                                                    speakVolumeResetCommands.push({
                                                                        command: 'volume',
                                                                        value: speakVolumeReset,
                                                                        device: iteratorDevice.serialNumber,
                                                                    });
                                                                }
                                                                nextCallback && nextCallback();
                                                            },
                                                        );
                                                    },
                                                    () => {
                                                        const allCommands: SequenceCommandEntry[] = [];
                                                        speakVolumeCommands.length &&
                                                            allCommands.push({
                                                                sequenceType: 'ParallelNode',
                                                                nodes: speakVolumeCommands,
                                                            });
                                                        allCommands.push({ command: 'ssml', value: ssmlText });
                                                        speakVolumeResetCommands.length &&
                                                            allCommands.push({
                                                                sequenceType: 'ParallelNode',
                                                                nodes: speakVolumeResetCommands,
                                                            });
                                                        this.alexa.sendMultiSequenceCommand(
                                                            device.isMultiroomDevice && device.clusterMembers
                                                                ? device.clusterMembers
                                                                : device,
                                                            allCommands,
                                                            null,
                                                            this.alexa.ownerCustomerId,
                                                        );
                                                    },
                                                );
                                            },
                                        );
                                        if (!device.isMultiroomDevice) {
                                            if (this.existingStates[`${devId}.Commands.speak-volume`]) {
                                                this.getState(`${devId}.Commands.speak-volume`, (err, state) => {
                                                    if (!err && state && state.val && (state.val as number) > 0) {
                                                        device.speakVolume = state.val as number;
                                                        this.log.debug(
                                                            `Initialize speak-Volume for ${device.serialNumber}: ${state.val}`,
                                                        );
                                                    }
                                                });
                                            }
                                            this.setOrUpdateObject(
                                                `${devId}.Commands.speak-volume`,
                                                {
                                                    common: {
                                                        name: 'Volume to use for speak commands',
                                                        type: 'number',
                                                        role: 'level.volume',
                                                        min: 0,
                                                        max: 100,
                                                        def: null,
                                                    },
                                                },
                                                undefined,
                                                (value: ioBroker.StateValue) => {
                                                    if (typeof value !== 'number') {
                                                        value = parseInt(value as string, 10);
                                                    }
                                                    if (isNaN(value)) {
                                                        return;
                                                    }
                                                    device.speakVolume = value;
                                                    this.log.debug(
                                                        `Set speak-Volume for ${device.serialNumber}: ${value}`,
                                                    );
                                                    void this.setState(`${devId}.Commands.speak-volume`, value, true);
                                                },
                                            );
                                        }
                                    }
                                    this.setOrUpdateObject(
                                        `${devId}.Commands.doNotDisturb`,
                                        { common: { type: 'mixed', role: 'state' } },
                                        undefined,
                                        (value: ioBroker.StateValue) => {
                                            if (value === 'true') {
                                                value = true;
                                            } else if (value === 'false') {
                                                value = false;
                                            } else if (value === '') {
                                                return;
                                            } else if (
                                                typeof value === 'string' &&
                                                isFinite(value as unknown as number)
                                            ) {
                                                value = parseInt(value, 10);
                                            }
                                            const doNotDisturbValue = value;

                                            const deviceList: string[] = [];
                                            this.iterateMultiroom(
                                                device,
                                                (iteratorDevice, nextCallback) => {
                                                    deviceList.push(iteratorDevice.serialNumber);
                                                    return nextCallback && nextCallback();
                                                },
                                                () => {
                                                    if (!deviceList.length) {
                                                        return;
                                                    }
                                                    this.alexa.sendSequenceCommand(
                                                        deviceList,
                                                        'deviceDoNotDisturb',
                                                        doNotDisturbValue,
                                                        this.alexa.ownerCustomerId,
                                                        err => {
                                                            if (err) {
                                                                this.log.error(
                                                                    `Error setting doNotDisturb for ${JSON.stringify(deviceList)}: ${err}`,
                                                                );
                                                            } else {
                                                                deviceList.forEach(serialNumber => {
                                                                    void this.setState(
                                                                        `Echo-Devices.${serialNumber}.Commands.doNotDisturb`,
                                                                        !!doNotDisturbValue,
                                                                        true,
                                                                    );
                                                                });
                                                            }
                                                        },
                                                    );
                                                },
                                            );
                                        },
                                    );

                                    if (
                                        !device.isMultiroomDevice &&
                                        device.deviceTypeDetails &&
                                        device.deviceTypeDetails.commandSupport
                                    ) {
                                        if (this.automationRoutines) {
                                            this.setOrUpdateObject(`${devId}.Routines`, { type: 'channel' });
                                            // Object.keys() of an array: the keys are strings, as before
                                            const automationRoutines = this.automationRoutines as unknown as Record<
                                                string,
                                                AmazonJson
                                            >;
                                            for (const i of Object.keys(automationRoutines)) {
                                                this.setOrUpdateObject(
                                                    `${devId}.Routines.${automationRoutines[i].friendlyAutomationId}`,
                                                    {
                                                        common: {
                                                            type: 'boolean',
                                                            role: 'indicator',
                                                            read: true,
                                                            write: true,
                                                            name: automationRoutines[i].friendlyName,
                                                        },
                                                    },
                                                    false,
                                                    this.alexa.executeAutomationRoutine.bind(
                                                        this.alexa,
                                                        device,
                                                        automationRoutines[i],
                                                    ),
                                                );
                                                if (automationRoutines[i].utteranceWords) {
                                                    // NOTE: throws (as before) if routineTriggerUtterances
                                                    // was not initialized
                                                    const routineTriggerUtterances = this
                                                        .routineTriggerUtterances as Record<
                                                        string,
                                                        Record<string, string>
                                                    >;
                                                    if (!routineTriggerUtterances[device.serialNumber]) {
                                                        routineTriggerUtterances[device.serialNumber] = {};
                                                    }
                                                    automationRoutines[i].utteranceWords.forEach(
                                                        (utterance: string) => {
                                                            if (!utterance) {
                                                                return;
                                                            }
                                                            routineTriggerUtterances[device.serialNumber][
                                                                utterance.toLowerCase()
                                                            ] =
                                                                `${devId}.Routines.${automationRoutines[i].friendlyAutomationId}`;
                                                        },
                                                    );
                                                }
                                            }
                                        }
                                    }

                                    this.setTimeout(() => !this.stopped && resolve(), 750);
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    private createStates(callback?: () => void): void {
        this.alexa.getAscendingAlarmState(async (err, res) => {
            const alarmStates = res as AscendingAlarmStatesResponse | undefined;
            const ascendingAlarmStates: Record<string, boolean> = {};
            if (!err && alarmStates && Array.isArray(alarmStates.ascendingAlarmModelList)) {
                alarmStates.ascendingAlarmModelList.forEach(alarmState => {
                    // NOTE: checks serialNumber, but uses deviceSerialNumber - kept as before
                    if (alarmState.serialNumber) {
                        ascendingAlarmStates[alarmState.deviceSerialNumber] = alarmState.ascendingAlarmEnabled;
                    }
                });
            }

            this.setOrUpdateObject(
                'requestResult',
                { common: { name: 'Request Result', write: false, role: 'text' } },
                '',
            );
            this.setOrUpdateObject('Echo-Devices', { type: 'folder', common: { name: 'Echo devices' } });

            for (const n of Object.keys(this.alexa.serialNumbers)) {
                const device = this.alexa.serialNumbers[n] as AlexaDevice;
                const additionalDeviceData: AdditionalDeviceData = {};
                if (ascendingAlarmStates[device.serialNumber] !== undefined) {
                    additionalDeviceData.ascendingAlarmState = ascendingAlarmStates[device.serialNumber];
                }

                await this.createStatesForDevice(device, additionalDeviceData);
            }

            this.setOrUpdateObject('Echo-Devices.CommandsAll', {
                type: 'channel',
                common: { name: 'Commands to all devices' },
            });
            for (const c of Object.keys(ALL_DEVICES_COMMANDS)) {
                const obj: (typeof ALL_DEVICES_COMMANDS)[string] = JSON.parse(JSON.stringify(ALL_DEVICES_COMMANDS[c]));
                // c is a const per loop iteration, so it has the same value as when it was bound before
                this.setOrUpdateObject(
                    `Echo-Devices.CommandsAll.${c}`,
                    { common: obj.common },
                    obj.val,
                    (value: ioBroker.StateValue) => {
                        const command = ALL_DEVICES_COMMANDS[c].command || c;

                        if (command === 'deviceDoNotDisturbAll') {
                            if (value === 'true') {
                                value = true;
                            } else if (value === 'false') {
                                value = false;
                            } else if (value === '') {
                                return;
                            } else if (typeof value === 'string' && isFinite(value as unknown as number)) {
                                value = parseInt(value, 10);
                            }
                        }
                        try {
                            this.alexa.sendSequenceCommand(
                                '',
                                command,
                                value,
                                this.alexa.ownerCustomerId,
                                (err, res) => {
                                    if (!err && res && command === 'deviceDoNotDisturbAll') {
                                        if (this.updateConfigurationTimer) {
                                            this.clearTimeout(this.updateConfigurationTimer);
                                        }
                                        this.updateConfigurationTimer = this.setTimeout(() => {
                                            this.updateDeviceConfigurationStates();
                                        }, 3000);
                                    }
                                },
                            );
                        } catch (err) {
                            this.log.error(`Error sending command ${command} to all devices: ${err}`);
                        }
                    },
                );
            }

            this.setOrUpdateObject('History', {
                type: 'channel',
                common: { name: 'Last detected commands and devices' },
            });
            this.setOrUpdateObject(
                'History.#trigger',
                {
                    common: {
                        type: 'boolean',
                        read: false,
                        write: true,
                        role: 'button',
                        name: 'Trigger/Rescan',
                        desc: 'Set to true, to start a request',
                    },
                },
                false,
                () => this.updateHistory(),
            );
            this.setOrUpdateObject(
                'History.name',
                {
                    common: {
                        role: 'text',
                        write: false,
                        name: 'Echo Device name',
                        desc: 'Device name of the last detected command',
                    },
                },
                '',
            );
            const nowDate = new Date();
            // NOTE: getTimezoneOffset() is in minutes but subtracted from milliseconds - kept as before
            const now = nowDate.getTime() - nowDate.getTimezoneOffset();
            this.setOrUpdateObject('History.creationTime', { common: { role: 'value.time' } }, now);
            this.setOrUpdateObject('History.serialNumber', { common: { role: 'text', write: false } }, '');
            this.setOrUpdateObject('History.summary', { common: { role: 'text', write: false } }, '');
            this.setOrUpdateObject('History.status', { common: { role: 'text', write: false } }, '');
            this.setOrUpdateObject('History.domainApplicationId', { common: { role: 'text', write: false } }, '');
            this.setOrUpdateObject('History.domainApplicationName', { common: { role: 'text', write: false } }, '');
            this.setOrUpdateObject('History.cardContent', { common: { role: 'text', write: false } }, '');
            this.setOrUpdateObject('History.cardJson', { common: { role: 'text', write: false } }, '');
            this.setOrUpdateObject('History.utteranceType', { common: { role: 'text', write: false } }, '');
            this.setOrUpdateObject('History.answerText', { common: { role: 'text', write: false } }, '');
            this.setOrUpdateObject('History.json', { common: { type: 'string', role: 'json', write: false } }, '');
            this.setOrUpdateObject('History.domain', { common: { role: 'text', write: false } }, '');
            this.setOrUpdateObject('History.intent', { common: { role: 'text', write: false } }, '');

            this.processObjectQueue(callback);
        });
    }

    private playMusicProvider(device: AlexaDevice, providerId: string, value: string): void {
        if (value === '') {
            return;
        }
        // NOTE: findDevice() may return null, which is passed on as before
        let targetDevice: AlexaDevice | null = device;
        if (device.isMultiroomDevice && device.clusterMembers.length) {
            value += ` auf ${device._name} `;
            targetDevice = this.findDevice(device.clusterMembers[0]);
        }
        this.alexa.playMusicProvider(targetDevice, providerId, value.trim(), () => {
            // NOTE: the device object (not the serial number) is used as timer key - kept as before
            this.schedulePlayerUpdate(targetDevice as unknown as string, 5000);
        });
    }

    // ---- converted from main.js (part D) ----
    private async createDeviceStates(
        serialOrName: string | AlexaDevice,
        additionalDeviceData?: AdditionalDeviceData | null,
        callback?: () => void,
    ): Promise<void> {
        additionalDeviceData = additionalDeviceData || {};
        // NOTE: not checked for null (as before) - an unknown device throws when accessing serialNumber
        const device = this.findDevice(serialOrName)!;
        const devId = `Echo-Devices.${device.serialNumber}`;

        let preserveSettings: ioBroker.ExtendObjectOptionsPreserve | undefined;
        if (device.parentDeviceSerialNumber) {
            // App device, add it but adjust name
            preserveSettings = { common: ['name'] };
            device._name += ` (${device.parentDeviceSerialNumber})`;
        }
        if (device.deviceType === 'A2IVLV5VM2W81') {
            if (!device.parentDeviceSerialNumber || !this.config.includeAppDevices) {
                // App main device, ignore them!
                this.log.debug(`Ignore Device ${device.serialNumber} because is App-Type`);
                device.ignore = true;
                device.deviceTypeDetails = { name: 'App', commandSupport: false };

                if (device.appDeviceList.length) {
                    device.appDeviceList.forEach(app => {
                        // alexa-remote2 types the app devices only as AppDevice; they are stored like devices
                        this.appDevices[app.serialNumber] = app as unknown as AlexaDevice;
                        this.appDevices[app.serialNumber].ownerDevice = device.serialNumber;
                    });
                }
                return callback && callback();
            }
        }

        let deviceTypeDetails = KNOWN_DEVICE_TYPES[device.deviceType];
        const commonDevice: { name: string; icon?: string } = { name: device._name };
        if (!deviceTypeDetails) {
            deviceTypeDetails = { name: 'Unknown', commandSupport: true };
            if (!this.unknownDeviceWarnings[device.deviceType]) {
                this.log.info('Unknown Device, but enabling commands, Try it and report back if commands work.');
                this.log.info(
                    'Report to developer as GitHub issue with details for device. Please grab full next line pot. from logfile on disk if cutted',
                );
                this.log.info(
                    `    Device-type:${device.deviceType} - ${device._name} (${device.capabilities.join(',')})`,
                );
                this.unknownDeviceWarnings[device.deviceType] = true;
            }
        } else if (deviceTypeDetails.icon) {
            commonDevice.icon = deviceTypeDetails.icon;
        }
        device.deviceTypeDetails = deviceTypeDetails;

        this.setOrUpdateObject(devId, { type: 'device', common: commonDevice, preserveSettings });
        this.setOrUpdateObject(
            `${devId}.online`,
            { common: { role: 'indicator.reachable', type: 'boolean' } },
            device.online,
        );
        //setOrUpdateObject(devId + '.delete', {common: {name: 'Delete (Log out of this device)', role: 'button'}}, false); TODO

        this.setOrUpdateObject(`${devId}.Info`, { type: 'channel' });
        this.setOrUpdateObject(
            `${devId}.Info.capabilities`,
            { common: { role: 'text', write: false } },
            device.capabilities.join(','),
        );
        this.setOrUpdateObject(
            `${devId}.Info.softwareVersion`,
            { common: { role: 'text', write: false } },
            device.softwareVersion,
        );
        this.setOrUpdateObject(
            `${devId}.Info.isMultiroomDevice`,
            { common: { type: 'boolean', role: 'indicator', write: false } },
            device.isMultiroomDevice,
        );
        if (device.isMultiroomDevice) {
            this.setOrUpdateObject(
                `${devId}.Info.multiroomMembers`,
                { common: { role: 'text', write: false } },
                device.clusterMembers.join(','),
            );
        }
        this.setOrUpdateObject(
            `${devId}.Info.isMultiroomMember`,
            { common: { type: 'boolean', role: 'indicator', write: false } },
            device.isMultiroomMember,
        );
        if (device.isMultiroomMember) {
            this.setOrUpdateObject(
                `${devId}.Info.multiroomParents`,
                { common: { role: 'text', write: false } },
                device.parentClusters.join(','),
            );
        }
        this.setOrUpdateObject(
            `${devId}.Info.deviceType`,
            { common: { name: 'deviceType', type: 'string', role: 'text' } },
            device.deviceType || '',
        );

        this.setOrUpdateObject(
            `${devId}.Info.deviceTypeString`,
            { common: { name: 'deviceType string', type: 'string', role: 'text' } },
            deviceTypeDetails.name,
        );
        this.setOrUpdateObject(
            `${devId}.Info.serialNumber`,
            { common: { name: 'serialNumber', type: 'string', role: 'text' } },
            device.serialNumber,
        );
        this.setOrUpdateObject(
            `${devId}.Info.name`,
            { common: { name: 'name', type: 'string', role: 'info.name' } },
            device._name,
        );
        this.setOrUpdateObject(
            `${devId}.Info.deviceFamily`,
            { common: { name: 'Device Family', type: 'string', role: 'info' } },
            device.deviceFamily,
        );

        let numPreferences = 0;
        if (
            device.capabilities.includes('EARCONS') &&
            device.preferences &&
            device.preferences.notificationEarconEnabled !== undefined
        ) {
            numPreferences++;
            this.log.debug(`${devId} notificationEarconEnabled: ${device.preferences.notificationEarconEnabled}`);
            this.setOrUpdateObject(
                `${devId}.Preferences.ringNotificationsEnabled`,
                {
                    common: {
                        type: 'boolean',
                        role: 'indicator',
                        write: true,
                    },
                },
                device.preferences.notificationEarconEnabled,
                (value: ioBroker.StateValue) => {
                    device.getDevicePreferences((err, res) => {
                        if (err || !res) {
                            this.log.error(
                                `Error getting preferences for ${device.serialNumber}: ${(err as Error).message}`,
                            );
                            return;
                        }
                        const preferences = res as AmazonJson;
                        preferences.notificationEarconEnabled = !!value;
                        device.setDevicePreferences(preferences, (err, res) => {
                            if (err || !res) {
                                this.log.error(
                                    `Error setting preferences for ${device.serialNumber}: ${(err as Error).message}`,
                                );
                                return;
                            }
                            const newPreferences = res as AmazonJson;
                            device.preferences = newPreferences;
                            void this.setState(
                                `${devId}.Preferences.ringNotificationsEnabled`,
                                !!newPreferences.notificationEarconEnabled,
                                true,
                            );
                        });
                    });
                },
            );
        }

        if (
            device.capabilities.includes('TIMERS_ALARMS_NOTIFICATIONS_VOLUME') &&
            additionalDeviceData.notificationVolume !== undefined
        ) {
            numPreferences++;
            this.log.debug(`${devId} notificationVolume: ${additionalDeviceData.notificationVolume}`);
            this.setOrUpdateObject(
                `${devId}.Preferences.notificationVolume`,
                {
                    common: {
                        type: 'number',
                        role: 'level.volume',
                        min: 0,
                        max: 100,
                        write: true,
                    },
                },
                additionalDeviceData.notificationVolume,
                (val: ioBroker.StateValue) => {
                    const value = parseInt(String(val), 10);
                    if (isNaN(value) || value < 0 || value > 100) {
                        this.log.error(`Invalid alarm volume ${value} for ${device.serialNumber}`);
                        return;
                    }
                    device.setDeviceNotificationVolume(value, (err, res) => {
                        if (err || !res) {
                            this.log.error(
                                `Error setting alarm volume to ${value} for ${device.serialNumber}: ${(err as Error).message}`,
                            );
                            return;
                        }
                        void this.setState(`${devId}.Preferences.notificationVolume`, value, true);
                    });
                },
            );
        }

        if (
            device.capabilities.includes('ASCENDING_ALARM_VOLUME') &&
            additionalDeviceData.ascendingAlarmState !== undefined
        ) {
            numPreferences++;
            this.log.debug(`${devId} ascendingAlarmState: ${additionalDeviceData.ascendingAlarmState}`);
            this.setOrUpdateObject(
                `${devId}.Preferences.ascendingAlarmState`,
                {
                    common: {
                        type: 'boolean',
                        role: 'switch',
                        write: true,
                    },
                },
                additionalDeviceData.ascendingAlarmState,
                (val: ioBroker.StateValue) => {
                    const value = !!val;
                    device.setDeviceAscendingAlarmState(value, (err, res) => {
                        if (err || !res) {
                            this.log.error(
                                `Error setting ascending alarm state to ${value} for ${device.serialNumber}: ${(err as Error).message}`,
                            );
                            return;
                        }
                        void this.setState(`${devId}.Preferences.ascendingAlarmState`, value, true);
                    });
                },
            );
        }

        if (additionalDeviceData.defaultAlarmNotificationSound !== undefined) {
            numPreferences++;
            this.log.debug(
                `${devId} defaultAlarmNotificationSound: ${additionalDeviceData.defaultAlarmNotificationSound.id}`,
            );
            this.setOrUpdateObject(
                `${devId}.Preferences.defaultAlarmNotificationSound`,
                {
                    common: {
                        type: 'string',
                        role: 'text',
                        write: true,
                        states: device.alarmNotificationSoundsStateList,
                    },
                },
                additionalDeviceData.defaultAlarmNotificationSound.id,
                (value: ioBroker.StateValue) => {
                    // NOTE: alarmNotificationSounds is not checked for existence (as before)
                    const soundDef = device.alarmNotificationSounds!.find(s => s.id === value);
                    if (!soundDef) {
                        this.log.error(`Invalid alarm sound ${value} for ${device.serialNumber}`);
                        return;
                    }
                    device.setDeviceNotificationDefaultSound('Alarm', soundDef.id, (err, res) => {
                        if (err || !res) {
                            this.log.error(
                                `Error setting default notification sound to ${soundDef.id} for ${device.serialNumber}: ${(err as Error).message}`,
                            );
                            return;
                        }
                        void this.setState(`${devId}.Preferences.defaultAlarmNotificationSound`, soundDef.id, true);
                    });
                },
            );
        }

        if (additionalDeviceData.defaultTimerNotificationSound !== undefined) {
            numPreferences++;
            this.log.debug(
                `${devId} defaultTimerNotificationSound: ${additionalDeviceData.defaultTimerNotificationSound.id}`,
            );
            this.setOrUpdateObject(
                `${devId}.Preferences.defaultTimerNotificationSound`,
                {
                    common: {
                        type: 'string',
                        role: 'text',
                        write: true,
                        states: device.alarmNotificationSoundsStateList,
                    },
                },
                additionalDeviceData.defaultTimerNotificationSound.id,
                (value: ioBroker.StateValue) => {
                    // NOTE: alarmNotificationSounds is not checked for existence (as before)
                    const soundDef = device.alarmNotificationSounds!.find(s => s.id === value);
                    if (!soundDef) {
                        this.log.error(`Invalid alarm sound ${value} for ${device.serialNumber}`);
                        return;
                    }
                    device.setDeviceNotificationDefaultSound('Timer', soundDef.id, (err, res) => {
                        if (err || !res) {
                            this.log.error(
                                `Error setting default notification sound to ${soundDef.id} for ${device.serialNumber}: ${(err as Error).message}`,
                            );
                            return;
                        }
                        void this.setState(`${devId}.Preferences.defaultTimerNotificationSound`, soundDef.id, true);
                    });
                },
            );
        }

        numPreferences += await this.initEqualizerData(device);
        numPreferences += await this.initDeviceAuxController(device);
        numPreferences += await this.initDisplaySettings(device);

        if (numPreferences > 0) {
            this.setOrUpdateObject(`${devId}.Preferences`, { type: 'channel' });
        }

        if (device.deviceType === 'A2IVLV5VM2W81' || device.serialNumber.length === 32) {
            return this.processObjectQueue(callback);
        }
        this.alexa.getDeviceWifiDetails(device, (err, res) => {
            const wifiDetails = res as DeviceWifiDetails | undefined;
            if (!err && wifiDetails && typeof wifiDetails.macAddress === 'string' && wifiDetails.macAddress.length) {
                this.setOrUpdateObject(
                    `${devId}.Info.macAddress`,
                    {
                        common: {
                            name: 'name',
                            type: 'string',
                            role: 'info.mac',
                        },
                    },
                    wifiDetails.macAddress.toUpperCase().replace(/(.{2})/g, '$1:'),
                );
            }
            if (!err && wifiDetails && wifiDetails.essid) {
                this.setOrUpdateObject(
                    `${devId}.Info.WifiSSID`,
                    {
                        common: {
                            name: 'name',
                            type: 'string',
                            role: 'text',
                        },
                    },
                    wifiDetails.essid,
                );
            }
            this.processObjectQueue(callback);
        });
    }

    private updateDeviceStatus(serialOrName?: string | AlexaDevice | null | (() => void), callback?: () => void): void {
        if (typeof serialOrName === 'function') {
            callback = serialOrName;
            serialOrName = null;
        }
        if (serialOrName) {
            serialOrName = this.findDevice(serialOrName);
        }

        this.alexa.initDeviceState(async () => {
            for (const devId of Object.keys(this.alexa.serialNumbers)) {
                const device = this.findDevice(devId);
                // NOTE: "return" (not "continue") as before: when filtering for one device, the loop (and the
                // final callback/processObjectQueue) is aborted at the first device that does not match
                if (serialOrName && serialOrName !== device) {
                    return;
                }

                await this.createDeviceStates(device!);
            }
            if (callback) {
                callback();
            } else {
                this.processObjectQueue();
            }
        });
    }

    private createBluetoothStates(serialOrName: string | AlexaDevice): void {
        // NOTE: not checked for null (as before)
        const device = this.findDevice(serialOrName)!;
        const devId = `Echo-Devices.${device.serialNumber}`;

        if (
            device.bluetoothState &&
            !device.isMultiroomDevice &&
            device.deviceTypeDetails &&
            device.deviceTypeDetails.commandSupport
        ) {
            this.setOrUpdateObject(`${devId}.Bluetooth`, { type: 'device' });
            (device.bluetoothState.pairedDeviceList as BluetoothPairedDevice[]).forEach(bt => {
                this.setOrUpdateObject(`${devId}.Bluetooth.${bt.address}`, {
                    type: 'channel',
                    common: { name: bt.friendlyName },
                });
                this.setOrUpdateObject(
                    `${devId}.Bluetooth.${bt.address}.connected`,
                    { common: { role: 'switch' } },
                    bt.connected,
                    bt.connect,
                );
                this.setOrUpdateObject(
                    `${devId}.Bluetooth.${bt.address}.unpair`,
                    { common: { type: 'boolean', read: false, write: true, role: 'button' } },
                    false,
                    bt.unpaire,
                );
            });
        }
    }

    private updateBluetoothStatus(
        serialOrName?: string | AlexaDevice | null | (() => void),
        callback?: () => void,
    ): void {
        if (typeof serialOrName === 'function') {
            callback = serialOrName;
            serialOrName = null;
        }
        if (!this.alexa._options.bluetooth) {
            return callback && callback();
        }
        if (serialOrName) {
            serialOrName = this.findDevice(serialOrName);
        }

        this.alexa.initBluetoothState(() => {
            Object.keys(this.alexa.serialNumbers).forEach(n => {
                const device = this.findDevice(n);
                if (serialOrName && serialOrName !== device) {
                    return;
                }

                this.createBluetoothStates(device!);
            });
            if (callback) {
                callback();
            } else {
                this.processObjectQueue();
            }
        });
    }

    private createNotificationStates(serialOrName: string | AlexaDevice): void {
        // NOTE: not checked for null (as before)
        const device = this.findDevice(serialOrName)!;
        const devId = `Echo-Devices.${device.serialNumber}`;

        if (device.notifications) {
            if (device.capabilities.includes('REMINDERS')) {
                this.setOrUpdateObject(`${devId}.Reminder`, { type: 'device' });
                this.setOrUpdateObject(
                    `${devId}.Reminder.New`,
                    { common: { type: 'mixed', role: 'state', name: 'Add new Reminder' } },
                    '',
                    (value: ioBroker.StateValue) => {
                        if (typeof value !== 'string') {
                            this.log.error('Invalid value for new Reminder, please provide a string');
                            return;
                        }
                        const valueArr = value.split(';');
                        const timeStr = valueArr.shift()!.trim();
                        let time: string | number = timeStr;
                        // identical to the original loose comparison "parseInt(time, 10) == time"
                        if (parseInt(timeStr, 10) === Number(timeStr)) {
                            time = parseInt(timeStr, 10);
                        }
                        let label = valueArr.shift();
                        if (label) {
                            label = label.trim();
                        }
                        let sound: string | NotificationSoundDefinition | undefined = valueArr.shift();
                        let recurring: string | NotificationRecurrence | undefined = valueArr.shift();
                        if (sound) {
                            sound = sound.trim();
                            if (sound.startsWith('DAILY') || sound.startsWith('WEEKLY')) {
                                recurring = sound;
                                sound = undefined;
                            }
                            if (sound && device.alarmNotificationSounds) {
                                sound = device.alarmNotificationSounds.find(s => s.id === sound);
                            } else {
                                sound = undefined;
                            }
                        }
                        if (recurring) {
                            recurring = recurring.trim();
                            if (recurring === 'DAILY') {
                                recurring = {
                                    freq: 'DAILY',
                                    byDay: [],
                                    interval: 1,
                                };
                            } else if (recurring.startsWith('WEEKLY=')) {
                                recurring = {
                                    freq: 'WEEKLY',
                                    byDay: recurring
                                        .substring(7)
                                        .split(',')
                                        .map(d => d.trim())
                                        .filter(d => d.length),
                                    interval: 1,
                                };
                            } else if (recurring.startsWith('{') && recurring.endsWith('}')) {
                                try {
                                    recurring = JSON.parse(recurring) as NotificationRecurrence;
                                } catch {
                                    this.log.error(`Invalid recurring JSON value: ${recurring as string}`);
                                    recurring = undefined;
                                }
                            } else {
                                recurring = undefined;
                            }
                        }
                        if (!label) {
                            this.log.error('Can not create new Reminder without label');
                            return;
                        }
                        this.log.debug(
                            `New Reminder: ${time} ${label} ${JSON.stringify(sound)} ${JSON.stringify(recurring)}`,
                        );
                        // alexa-remote2 typings of createNotificationObject() do not match the implementation
                        const notification = (
                            this.alexa as unknown as AlexaNotificationFactory
                        ).createNotificationObject(device, 'Reminder', label, time, true, sound, recurring);
                        if (notification) {
                            this.alexa.createNotification(notification, (_err, _res) => {
                                // NOTE: the device object (not the serial number) is passed as deviceId (as before),
                                // so all devices share the same update timer key
                                this.scheduleNotificationUpdate(device as unknown as string, 2000, true);
                            });
                        }
                    },
                );
            }
            if (device.capabilities.includes('TIMERS_AND_ALARMS')) {
                this.setOrUpdateObject(`${devId}.Alarm`, { type: 'device' });
                this.setOrUpdateObject(
                    `${devId}.Alarm.New`,
                    { common: { type: 'mixed', role: 'state', name: 'Add new Alarm' } },
                    '',
                    (value: ioBroker.StateValue) => {
                        if (typeof value !== 'string') {
                            this.log.error('Invalid value for new Alarm, please provide a string');
                            return;
                        }
                        const valueArr = value.split(';');
                        const timeStr = valueArr.shift()!.trim();
                        let time: string | number = timeStr;
                        // identical to the original loose comparison "parseInt(time, 10) == time"
                        if (parseInt(timeStr, 10) === Number(timeStr)) {
                            time = parseInt(timeStr, 10);
                        }
                        let label = valueArr.shift();
                        if (label) {
                            label = label.trim();
                        }
                        let sound: string | NotificationSoundDefinition | undefined = valueArr.shift();
                        let recurring: string | NotificationRecurrence | undefined = valueArr.shift();
                        if (sound) {
                            sound = sound.trim();
                            if (
                                sound.startsWith('DAILY') ||
                                sound.startsWith('WEEKLY') ||
                                (sound.startsWith('{') && sound.endsWith('}'))
                            ) {
                                recurring = sound;
                                sound = undefined;
                            }
                            if (sound && device.alarmNotificationSounds) {
                                sound = device.alarmNotificationSounds.find(s => s.id === sound);
                            } else {
                                sound = undefined;
                            }
                        }
                        if (recurring) {
                            recurring = recurring.trim();
                            if (recurring === 'DAILY') {
                                recurring = {
                                    freq: 'DAILY',
                                    byDay: [],
                                    interval: 1,
                                };
                            } else if (recurring.startsWith('WEEKLY=')) {
                                recurring = {
                                    freq: 'WEEKLY',
                                    byDay: recurring
                                        .substring(7)
                                        .split(',')
                                        .map(d => d.trim())
                                        .filter(d => d.length),
                                    interval: 1,
                                };
                            } else if (recurring.startsWith('{') && recurring.endsWith('}')) {
                                try {
                                    recurring = JSON.parse(recurring) as NotificationRecurrence;
                                } catch {
                                    this.log.error(`Invalid recurring JSON value: ${recurring as string}`);
                                    recurring = undefined;
                                }
                            } else {
                                recurring = undefined;
                            }
                        }
                        // NOTE: unlike "Reminder.New" an empty label is not rejected here (as before)
                        this.log.debug(
                            `New Alarm: ${time} ${label} ${JSON.stringify(sound)} ${JSON.stringify(recurring)}`,
                        );
                        // alexa-remote2 typings of createNotificationObject() do not match the implementation
                        const notification = (
                            this.alexa as unknown as AlexaNotificationFactory
                        ).createNotificationObject(device, 'Alarm', label, time, true, sound, recurring);
                        if (notification) {
                            this.alexa.createNotification(notification, (_err, _res) => {
                                // NOTE: the device object (not the serial number) is passed as deviceId (as before),
                                // so all devices share the same update timer key
                                this.scheduleNotificationUpdate(device as unknown as string, 2000, true);
                            });
                        }
                    },
                );
                this.setOrUpdateObject(
                    `${devId}.Alarm.triggered`,
                    {
                        common: {
                            type: 'string',
                            read: true,
                            write: false,
                            role: 'value',
                            name: 'Alarm ID that got Triggered',
                        },
                    },
                    null,
                );
                this.setOrUpdateObject(
                    `${devId}.Reminder.triggered`,
                    {
                        common: {
                            type: 'string',
                            read: true,
                            write: false,
                            role: 'value',
                            name: 'Reminder ID that got Triggered',
                        },
                    },
                    null,
                );
                this.setOrUpdateObject(`${devId}.Timer`, { type: 'device' });
                this.setOrUpdateObject(
                    `${devId}.Timer.triggered`,
                    {
                        common: {
                            type: 'boolean',
                            read: true,
                            write: false,
                            role: 'indicator',
                            name: 'A timer got Triggered',
                        },
                    },
                    false,
                );

                if (this.rememberedNotificationVolumeRestoreCallbacks[device.serialNumber] !== undefined) {
                    this.log.debug(
                        `Restoring notification volume for ${device.serialNumber} because triggered flag cleared`,
                    );
                    this.rememberedNotificationVolumeRestoreCallbacks[device.serialNumber]();
                    delete this.rememberedNotificationVolumeRestoreCallbacks[device.serialNumber];
                }
            }
            let nextTimerObject: NotificationEntry | null = null;
            const activeTimerList: NotificationActiveTimer[] = [];
            for (const noti of device.notifications as NotificationEntry[]) {
                if (this.notificationTimer[noti.id]) {
                    this.clearTimeout(this.notificationTimer[noti.id]);
                    this.notificationTimer[noti.id] = null;
                }
                let isMusicAlarm = false;
                if (noti.type === 'MusicAlarm') {
                    noti.type = 'Alarm';
                    isMusicAlarm = true;
                }
                if (noti.type === 'Reminder' && !device.capabilities.includes('REMINDERS')) {
                    continue;
                }
                if (noti.type === 'Alarm' && !device.capabilities.includes('TIMERS_AND_ALARMS')) {
                    continue;
                }
                if (noti.type === 'Timer' && noti.status === 'ON' && noti.remainingTime > 0) {
                    let remainingTime = noti.remainingTime;
                    if (noti.triggerTime) {
                        remainingTime = noti.triggerTime - Date.now();
                        noti.remainingTime = remainingTime;
                    }
                    this.log.debug(`${noti.type} ${noti.id} triggered in ${Math.floor(remainingTime / 1000)}s`);
                    if (remainingTime > 0) {
                        if (nextTimerObject === null || nextTimerObject.remainingTime > remainingTime) {
                            nextTimerObject = noti;
                        }
                        activeTimerList.push({
                            id: noti.notificationIndex,
                            triggerTime: noti.triggerTime || Date.now() + remainingTime,
                            label: noti.timerLabel,
                            durationMillis: noti.originalDurationInMillis,
                        });
                        if (this.notificationTimer[noti.id]) {
                            this.clearTimeout(this.notificationTimer[noti.id]);
                            this.notificationTimer[noti.id] = null;
                        }
                        if (remainingTime < 14 * 24 * 60 * 60 * 1000) {
                            // not longer then 14 days in future
                            this.notificationTimer[noti.id] = this.setTimeout(() => {
                                this.notificationTimer[noti.id] = null;
                                this.log.debug(`${noti.type} ${noti.id} triggered`);
                                void this.setState(`${devId}.Timer.triggered`, true, true);

                                // Check again status after 1min if no stop was arrived
                                this.notificationTimer[noti.id] = this.setTimeout(() => {
                                    this.notificationTimer[noti.id] = null;
                                    this.getState(`${devId}.Timer.triggered`, (err, state) => {
                                        if (!err && state && state.val) {
                                            this.updateNotificationStates(device);
                                        }
                                    });
                                }, 60000);
                            }, remainingTime);
                        } else {
                            this.notificationTimer[noti.id] = this.setTimeout(
                                () => {
                                    this.notificationTimer[noti.id] = null;
                                    this.updateNotificationStates(device);
                                },
                                14 * 24 * 60 * 60 * 1000,
                            );
                        }
                    }
                } else if (noti.type !== 'Timer') {
                    const id = noti.notificationIndex;
                    const notiId = `${devId}.${noti.type}.${id}`;
                    let displayName = noti.reminderLabel;
                    let time = noti.originalTime;
                    if (time) {
                        if (typeof time === 'string' && time.endsWith('.000')) {
                            time = time.substring(0, time.length - 4);
                        }
                        displayName = displayName ? `${displayName} ${time}` : time;
                    }
                    if (!displayName) {
                        displayName = noti.type;
                    }

                    let rRuleDaysList = '';
                    if (noti.rRuleData && noti.rRuleData.byWeekDays) {
                        rRuleDaysList = noti.rRuleData.byWeekDays.join(',');
                    } else if (noti.recurringPattern && noti.recurringPattern.endsWith('-WE')) {
                        rRuleDaysList = 'SA,SU';
                    } else if (noti.recurringPattern && noti.recurringPattern.endsWith('-WD')) {
                        rRuleDaysList = 'MO,TU,WE,TH,FR';
                    } else if (noti.recurringPattern && noti.recurringPattern === 'P1D') {
                        rRuleDaysList = 'MO,TU,WE,TH,FR,SA,SU';
                    } else if (
                        !noti.recurringPattern &&
                        noti.rRuleData &&
                        noti.rRuleData.recurrenceRules &&
                        noti.rRuleData.recurrenceRules.length &&
                        noti.rRuleData.recurrenceRules[0].startsWith('FREQ=DAILY;')
                    ) {
                        rRuleDaysList = 'MO,TU,WE,TH,FR,SA,SU';
                    }

                    this.setOrUpdateObject(notiId, { type: 'channel', common: { name: displayName } });
                    this.setOrUpdateObject(
                        `${notiId}.date`,
                        {
                            common: {
                                type: 'mixed',
                                read: true,
                                write: true,
                                role: 'state',
                                name: `${displayName} Date`,
                            },
                        },
                        noti.originalDate,
                        (value: ioBroker.StateValue) => {
                            noti.set(value, (err, res) => {
                                if (err || !res) {
                                    this.log.warn(
                                        `Error setting ${notiId}.date to ${value}: ${(err as Error).message}`,
                                    );
                                }
                            });
                        },
                    );
                    this.setOrUpdateObject(
                        `${notiId}.time`,
                        { common: { type: 'mixed', role: 'state', name: `${displayName} Time` } },
                        time,
                        (value: ioBroker.StateValue) => {
                            noti.set(value, (err, res) => {
                                if (err || !res) {
                                    this.log.warn(
                                        `Error setting ${notiId}.time to ${value}: ${(err as Error).message}`,
                                    );
                                }
                            });
                        },
                    );
                    this.setOrUpdateObject(
                        `${notiId}.enabled`,
                        { common: { type: 'boolean', role: 'switch.enable', name: `${displayName} Enabled` } },
                        noti.status === 'ON' || noti.status === 'SNOOZED',
                        (value: ioBroker.StateValue) => {
                            noti.set(!!value, (err, res) => {
                                // NOTE: the original condition was "err | !res" (bitwise OR). An Error object (or
                                // null/undefined) converts to 0 there, so only "!res" counts - kept as is
                                if (!res) {
                                    this.log.error(
                                        `Error setting ${notiId}.enabled to ${value}: ${(err as Error).message}`,
                                    );
                                }
                            });
                        },
                    );
                    this.setOrUpdateObject(
                        `${notiId}.snoozed`,
                        {
                            common: {
                                type: 'boolean',
                                role: 'indicator',
                                name: `${displayName} Snoozed`,
                                write: false,
                            },
                        },
                        noti.status === 'SNOOZED',
                    );
                    this.setOrUpdateObject(
                        `${notiId}.delete`,
                        { common: { type: 'boolean', role: 'button', read: false, name: `${displayName} Delete` } },
                        false,
                        (value: ioBroker.StateValue) => {
                            if (value) {
                                noti.delete(err => {
                                    if (err) {
                                        this.log.error(`Error deleting ${noti.type} ${noti.id}: ${err.message}`);
                                    } else {
                                        if (this.notificationTimer[noti.id]) {
                                            this.clearTimeout(this.notificationTimer[noti.id]);
                                            this.notificationTimer[noti.id] = null;
                                        }
                                        if (this.notificationTimer[`${noti.id}-customVolume`]) {
                                            this.clearTimeout(this.notificationTimer[`${noti.id}-customVolume`]);
                                            this.notificationTimer[`${noti.id}-customVolume`] = null;
                                        }
                                        if (this.notificationTimer[`${noti.id}-customVolumeReset`]) {
                                            this.clearTimeout(this.notificationTimer[`${noti.id}-customVolumeReset`]);
                                            this.notificationTimer[`${noti.id}-customVolumeReset`] = null;
                                            if (
                                                this.rememberedNotificationVolumeRestoreCallbacks[device.serialNumber]
                                            ) {
                                                const callback =
                                                    this.rememberedNotificationVolumeRestoreCallbacks[
                                                        device.serialNumber
                                                    ];
                                                delete this.rememberedNotificationVolumeRestoreCallbacks[
                                                    device.serialNumber
                                                ];
                                                callback();
                                            }
                                        }
                                        if (this.adapterObjects[notiId]) {
                                            this.deleteObject(notiId);
                                        }
                                    }
                                });
                            }
                        },
                    );
                    this.setOrUpdateObject(
                        `${notiId}.cancel`,
                        // NOTE: name "... Delete" for the cancel button kept as before
                        { common: { type: 'boolean', role: 'button', read: false, name: `${displayName} Delete` } },
                        false,
                        (value: ioBroker.StateValue) => {
                            if (value) {
                                noti.cancel((err, res) => {
                                    // NOTE: the original condition was "err | !res" (bitwise OR). An Error object (or
                                    // null/undefined) converts to 0 there, so only "!res" counts - kept as is
                                    if (!res) {
                                        this.log.error(`Error setting ${notiId}.cancel: ${(err as Error).message}`);
                                    }
                                });
                            }
                        },
                    );
                    this.setOrUpdateObject(
                        `${notiId}.musicProvider`,
                        { common: { type: 'string', role: 'state', name: `${displayName} Music Provider` } },
                        noti.provider || null,
                    );
                    this.setOrUpdateObject(
                        `${notiId}.musicEntity`,
                        { common: { type: 'string', role: 'state', name: `${displayName} Music Entity` } },
                        noti.musicEntity || null,
                    );
                    if (
                        device.capabilities.includes('TIMERS_ALARMS_NOTIFICATIONS_VOLUME') ||
                        device.capabilities.includes('CUSTOM_ALARM_TONE') ||
                        isMusicAlarm
                    ) {
                        this.setOrUpdateObject(
                            `${notiId}.customVolume`,
                            {
                                common: {
                                    type: 'number',
                                    role: 'level.volume',
                                    min: 0,
                                    max: 100,
                                    read: true,
                                    write: true,
                                    name: `${displayName} Custom Notification Volume`,
                                },
                            },
                            undefined,
                            (value: ioBroker.StateValue) => {
                                let customVolume: number | null = parseInt(String(value), 10);
                                if (isNaN(customVolume) || customVolume < 0 || customVolume > 100) {
                                    this.log.error(`Invalid custom volume value ${value}`);
                                    customVolume = null;
                                }
                                void this.setState(`${notiId}.customVolume`, customVolume, true);
                            },
                        );
                    }
                    this.setOrUpdateObject(
                        `${notiId}.triggered`,
                        {
                            common: {
                                type: 'boolean',
                                read: true,
                                write: false,
                                role: 'indicator',
                                name: `${displayName} Triggered`,
                            },
                        },
                        false,
                    );
                    this.setOrUpdateObject(
                        `${notiId}.recurringPattern`,
                        {
                            common: {
                                type: 'string',
                                read: true,
                                write: false,
                                role: 'state',
                                name: `${displayName} Recurring pattern`,
                            },
                        },
                        noti.recurringPattern || '0',
                    );
                    if (noti.reminderLabel !== undefined && noti.reminderLabel !== null) {
                        this.setOrUpdateObject(
                            `${notiId}.label`,
                            {
                                common: {
                                    type: 'string',
                                    read: true,
                                    write: true,
                                    role: 'text',
                                    name: `${displayName} Label`,
                                },
                            },
                            noti.reminderLabel,
                            (val: ioBroker.StateValue) => {
                                if (!val) {
                                    this.log.error(`Label is empty for ${noti.id}`);
                                    return;
                                }
                                const value = val.toString();
                                // getNotifications(callback) is the same as getNotifications(true, callback)
                                this.alexa.getNotifications(true, (err, res) => {
                                    const notificationsResponse = res as NotificationsResponse | undefined;
                                    if (
                                        !err &&
                                        notificationsResponse &&
                                        notificationsResponse.notifications &&
                                        Array.isArray(notificationsResponse.notifications)
                                    ) {
                                        let notificationData: AmazonJson | null = null;
                                        for (const n of notificationsResponse.notifications) {
                                            if (n.id === noti.id) {
                                                notificationData = n;
                                                break;
                                            }
                                        }
                                        if (!notificationData) {
                                            this.log.error(`Cannot find notification ${noti.id}`);
                                            return;
                                        }

                                        notificationData.reminderLabel = value;

                                        this.alexa.setNotification(notificationData, (err, _res) => {
                                            if (err) {
                                                this.log.error(
                                                    `Cannot set label ${value} for notification ${noti.id}: ${err.message}`,
                                                );
                                            } else {
                                                void this.setState(`${notiId}.label`, value, true);
                                            }
                                        });
                                    } else {
                                        // NOTE: log text says "sound" although the label is set (as before)
                                        this.log.error(
                                            `Cannot get notification to set sound: ${(err as Error).message}`,
                                        );
                                    }
                                });
                            },
                        );
                    }
                    if (noti.sound !== undefined && noti.sound !== null && noti.sound.id !== undefined) {
                        const soundId = isMusicAlarm ? `MUSIC-${noti.musicAlarmId}` : noti.sound.id;
                        this.setOrUpdateObject(
                            `${notiId}.sound`,
                            {
                                common: {
                                    type: 'string',
                                    read: true,
                                    write: true,
                                    role: 'state',
                                    name: `${displayName} Sound`,
                                    states: device.alarmNotificationSoundsStateList,
                                },
                            },
                            soundId,
                            (value: ioBroker.StateValue) => {
                                // getNotifications(callback) is the same as getNotifications(true, callback)
                                this.alexa.getNotifications(true, (err, res) => {
                                    const notificationsResponse = res as NotificationsResponse | undefined;
                                    if (
                                        !err &&
                                        notificationsResponse &&
                                        notificationsResponse.notifications &&
                                        Array.isArray(notificationsResponse.notifications)
                                    ) {
                                        let notificationData: AmazonJson | null = null;
                                        for (const n of notificationsResponse.notifications) {
                                            if (n.id === noti.id) {
                                                notificationData = n;
                                                break;
                                            }
                                        }
                                        if (!notificationData) {
                                            this.log.error(`Cannot find notification ${noti.id}`);
                                            return;
                                        }

                                        let soundData: NotificationSoundDefinition | null = null;
                                        // NOTE: alarmNotificationSounds is not checked for existence (as before)
                                        for (const s of device.alarmNotificationSounds!) {
                                            if (s.id === value) {
                                                soundData = s;
                                                break;
                                            }
                                        }
                                        if (!soundData) {
                                            this.log.error(`Cannot find sound ${value}`);
                                            return;
                                        }
                                        if (soundData.providerId === 'ECHO') {
                                            notificationData.sound = soundData;
                                            notificationData.musicEntity = null;
                                            notificationData.musicAlarmId = null;
                                            notificationData.provider = null;
                                        } else {
                                            notificationData.musicEntity = soundData.displayName;
                                            notificationData.musicAlarmId = soundData.origId;
                                            // NOTE: "providerID" (upper case ID) does not exist on the sound
                                            // objects (they have "providerId"), so provider becomes undefined.
                                            // Kept as before.
                                            notificationData.provider = soundData.providerID;
                                        }

                                        if (notificationData.type === 'Reminder') {
                                            this.alexa.setNotification(notificationData, (err, _res) => {
                                                if (err) {
                                                    this.log.error(
                                                        `Cannot set sound ${value} for notification ${noti.id}: ${err.message}`,
                                                    );
                                                } else {
                                                    void this.setState(`${notiId}.sound`, value, true);
                                                }
                                            });
                                        } else {
                                            const finalNotification =
                                                this.alexa.convertNotificationToV2(notificationData);
                                            this.alexa.setNotificationV2(
                                                notificationData.notificationIndex,
                                                finalNotification,
                                                (err, _res) => {
                                                    if (err) {
                                                        this.log.error(
                                                            `Cannot set sound ${value} for notification ${noti.id}: ${err.message}`,
                                                        );
                                                    } else {
                                                        void this.setState(`${notiId}.sound`, value, true);
                                                    }
                                                },
                                            );
                                        }
                                    } else {
                                        this.log.error(
                                            `Cannot get notification to set sound: ${(err as Error).message}`,
                                        );
                                    }
                                });
                            },
                        );
                    }
                    this.setOrUpdateObject(
                        `${notiId}.recurringDays`,
                        {
                            common: {
                                type: 'string',
                                read: true,
                                write: false,
                                role: 'state',
                                name: `${displayName} RRuleDay List`,
                            },
                        },
                        rRuleDaysList,
                    );

                    let nextTriggerTime: number | null = null;

                    if (noti.status === 'ON') {
                        this.log.debug(
                            `Handle notification ${noti.type} ${noti.id} ${noti.status} ${noti.originalDate} ${noti.originalTime}`,
                        );
                        const now = Date.now();
                        if (noti.originalDate && noti.originalTime) {
                            const alarmTime = new Date(
                                `${noti.originalDate} ${noti.originalTime}`.replace(/-/g, '/'),
                            ).getTime();
                            if (alarmTime - now > 0) {
                                this.log.debug(
                                    `${noti.type} ${noti.id} set from original Data ${noti.originalDate} ${noti.originalTime} -> (${alarmTime}) ${(alarmTime - now) / 1000}s`,
                                );
                                nextTriggerTime = alarmTime;
                            }
                        }
                        this.log.debug(`${noti.type} ${noti.id} ${nextTriggerTime}`);
                        if (
                            !nextTriggerTime &&
                            noti.rRuleData &&
                            noti.rRuleData.nextTriggerTimes &&
                            Array.isArray(noti.rRuleData.nextTriggerTimes) &&
                            noti.rRuleData.nextTriggerTimes.length
                        ) {
                            noti.rRuleData.nextTriggerTimes.forEach(rule => {
                                const alarmDate = new Date(rule);
                                if (alarmDate) {
                                    const alarmTime = new Date(alarmDate).getTime();
                                    this.log.debug(
                                        `${noti.type} ${noti.id} Check next trigger time from data: ${alarmDate.toString()} -> ${alarmTime}`,
                                    );
                                    // the cast is only for TypeScript: "x < null" is evaluated as "x < 0" (as before)
                                    if (
                                        alarmTime &&
                                        alarmTime - now > 0 &&
                                        (alarmTime < (nextTriggerTime as number) || !nextTriggerTime)
                                    ) {
                                        this.log.debug(
                                            `${noti.type} ${noti.id} Set from next trigger time from data: ${alarmDate.toString()} -> (${alarmTime}) ${(alarmTime - now) / 1000}s`,
                                        );
                                        nextTriggerTime = alarmTime;
                                    }
                                }
                            });
                        }

                        if (!nextTriggerTime && (noti.recurringPattern !== '0' || noti.rRuleData)) {
                            this.log.debug(`${noti.type} ${noti.id} Try to calculate ourself ...`);
                            let recurStartDate = noti.originalDate;
                            let recurStartTime = time || '00:00:00';
                            let recurEndDate: string | null = null;
                            let recurEndTime: string | null = null;
                            if (noti.rRuleData) {
                                if (noti.rRuleData.recurStartDate) {
                                    recurStartDate = noti.rRuleData.recurStartDate;
                                }
                                if (noti.rRuleData.recurStartTime) {
                                    recurStartTime = noti.rRuleData.recurStartTime;
                                }
                                if (noti.rRuleData.recurEndDate) {
                                    recurEndDate = noti.rRuleData.recurEndDate;
                                }
                                if (noti.rRuleData.recurEndTime) {
                                    recurEndTime = noti.rRuleData.recurEndTime;
                                }
                            }

                            // NOTE: notificationTimes is only normalized here (in place, also in noti.rRuleData)
                            // but not used afterwards (as before)
                            const notificationTimes: string[] =
                                (noti.rRuleData &&
                                    Array.isArray(noti.rRuleData.notificationTimes) &&
                                    noti.rRuleData.notificationTimes) ||
                                [];
                            if (!notificationTimes.length && noti.originalTime) {
                                notificationTimes.push(noti.originalTime);
                            }
                            notificationTimes.forEach((time, index) => {
                                if (typeof time === 'string' && time.endsWith('.000')) {
                                    notificationTimes[index] = time.substring(0, time.length - 4);
                                }
                            });

                            this.log.debug(`${noti.id} - ${recurStartDate} ${recurStartTime}`);
                            if (recurStartDate && recurStartTime) {
                                const recurringStartDate = new Date(
                                    `${recurStartDate} ${recurStartTime}`.replace(/-/g, '/'),
                                );
                                const recurringEndDate =
                                    recurEndDate && recurEndTime
                                        ? new Date(`${recurEndDate} ${recurEndTime}`.replace(/-/g, '/'))
                                        : null;
                                const ruleStrAdd = recurringEndDate
                                    ? `;UNTIL=${recurringEndDate
                                          .toISOString()
                                          .replace(/[-:]/g, '')
                                          .replace(/\.[0-9]{3}Z$/, 'Z')}`
                                    : '';
                                const ruleStrBase = `DTSTART:${recurringStartDate
                                    .toISOString()
                                    .replace(/[-:]/g, '')
                                    .replace(/\.[0-9]{3}Z$/, 'Z')}\nRRULE:`;

                                // We use the provided rules, else we add one ones
                                const recurRules: string[] = (noti.rRuleData && noti.rRuleData.recurrenceRules) || [];
                                if (!recurRules.length) {
                                    if (noti.recurringPattern === 'P1D') {
                                        recurRules.push(`FREQ=DAILY;INTERVAL=1`);
                                    } else if (rRuleDaysList.length) {
                                        recurRules.push(`FREQ=WEEKLY;INTERVAL=1;BYDAY=${rRuleDaysList}`);
                                    }
                                }

                                const nowDate = new Date(now);
                                //nowDate.setMinutes(nowDate.getMinutes() + nowDate.getTimezoneOffset());
                                recurRules.forEach(rule => {
                                    if (rule.endsWith(';')) {
                                        rule = rule.substring(0, rule.length - 1);
                                    }
                                    const ruleStr = ruleStrBase + rule + ruleStrAdd;

                                    this.log.debug(`${noti.type} ${noti.id} Check recurring pattern: ${ruleStr}`);
                                    let alarmDate: Date | null | undefined;
                                    try {
                                        alarmDate = rrulestr(ruleStr).after(nowDate, false);
                                    } catch {
                                        this.log.warn(
                                            `${noti.type} ${noti.id} Error while calculating recurring pattern: ${ruleStr}. Please report together with a debug log.`,
                                        );
                                    }
                                    if (alarmDate) {
                                        const alarmTimeDate = new Date(alarmDate);
                                        // If there was an hour given in the RRule, we need to fix the Timezone
                                        if (rule.includes(';BYHOUR=') || rule.startsWith('BYHOUR=')) {
                                            alarmTimeDate.setMinutes(
                                                alarmTimeDate.getMinutes() + alarmTimeDate.getTimezoneOffset(),
                                            );
                                        }
                                        const alarmTime = alarmTimeDate.getTime();
                                        this.log.debug(
                                            `${noti.type} ${noti.id} Check recurring pattern: ${ruleStr} -> ${alarmTimeDate.toString()} / ${alarmTime}`,
                                        );
                                        // the cast is only for TypeScript: "x < null" is evaluated as "x < 0" (as before)
                                        if (
                                            alarmTime &&
                                            alarmTime - now > 0 &&
                                            (alarmTime < (nextTriggerTime as number) || !nextTriggerTime)
                                        ) {
                                            nextTriggerTime = alarmTime;
                                        }
                                    }
                                });
                            }
                            // the cast is only for TypeScript: new Date(null) is the epoch (as before)
                            this.log.debug(
                                `${noti.type} ${noti.id} now = ${new Date(now).toString()} / ${now} / next date: ${new Date(nextTriggerTime as unknown as number).toString()} / ${nextTriggerTime}`,
                            );
                        }

                        const alarmDelay = (nextTriggerTime || 0) - now;
                        this.log.debug(
                            `${noti.type} ${noti.id} trigger expected in ${Math.floor(alarmDelay / 1000)}s at ${new Date(nextTriggerTime as unknown as number).toString()}`,
                        );
                        if (alarmDelay > 0) {
                            if (alarmDelay < 14 * 24 * 60 * 60 * 1000) {
                                // not longer then 14 days in future
                                if (this.notificationTimer[`${noti.id}-customVolume`]) {
                                    this.clearTimeout(this.notificationTimer[`${noti.id}-customVolume`]);
                                    this.notificationTimer[`${noti.id}-customVolume`] = null;
                                }
                                if (
                                    device.capabilities.includes('TIMERS_ALARMS_NOTIFICATIONS_VOLUME') ||
                                    device.capabilities.includes('CUSTOM_ALARM_TONE') ||
                                    isMusicAlarm
                                ) {
                                    this.notificationTimer[`${noti.id}-customVolume`] = this.setTimeout(
                                        () => {
                                            this.notificationTimer[`${noti.id}-customVolume`] = null;

                                            this.getState(`${notiId}.customVolume`, (err, state) => {
                                                if (err || !state || state.val === null) {
                                                    return;
                                                }
                                                const customVolume = parseInt(String(state.val), 10);
                                                if (isNaN(customVolume) || customVolume < 0 || customVolume > 100) {
                                                    return;
                                                }

                                                if (isMusicAlarm) {
                                                    try {
                                                        this.alexa.sendSequenceCommand(
                                                            device,
                                                            'volume',
                                                            customVolume,
                                                            this.alexa.ownerCustomerId,
                                                        );
                                                    } catch (err) {
                                                        this.log.error(
                                                            `${noti.type} ${noti.id} Error while setting volume: ${err}`,
                                                        );
                                                    }
                                                    return;
                                                }
                                                device.getDeviceNotificationState((err, res) => {
                                                    const origNotificationState = res as
                                                        DeviceNotificationState | undefined;
                                                    if (
                                                        err ||
                                                        !origNotificationState ||
                                                        origNotificationState.volumeLevel === undefined
                                                    ) {
                                                        return;
                                                    }

                                                    if (
                                                        this.adapterObjects[
                                                            `Echo-Devices.${device.serialNumber}.Preferences.notificationVolume`
                                                        ]
                                                    ) {
                                                        void this.setState(
                                                            `Echo-Devices.${device.serialNumber}.Preferences.notificationVolume`,
                                                            origNotificationState.volumeLevel,
                                                            true,
                                                        );
                                                    }
                                                    device.setDeviceNotificationVolume(customVolume, err => {
                                                        if (err) {
                                                            return;
                                                        }
                                                        if (
                                                            this.adapterObjects[
                                                                `Echo-Devices.${device.serialNumber}.Preferences.notificationVolume`
                                                            ]
                                                        ) {
                                                            void this.setState(
                                                                `Echo-Devices.${device.serialNumber}.Preferences.notificationVolume`,
                                                                customVolume,
                                                                true,
                                                            );
                                                        }
                                                        if (
                                                            this.rememberedNotificationVolumeRestoreCallbacks[
                                                                device.serialNumber
                                                            ] === undefined
                                                        ) {
                                                            // Originally a function bound to (notiId, noti, volumeLevel): the
                                                            // arguments given by callers are ignored, the bound values are used
                                                            const volumeToRestore = origNotificationState.volumeLevel!;
                                                            this.rememberedNotificationVolumeRestoreCallbacks[
                                                                device.serialNumber
                                                            ] = () => {
                                                                if (
                                                                    this.notificationTimer[
                                                                        `${noti.id}-customVolumeReset`
                                                                    ]
                                                                ) {
                                                                    this.clearTimeout(
                                                                        this.notificationTimer[
                                                                            `${noti.id}-customVolumeReset`
                                                                        ],
                                                                    );
                                                                    this.notificationTimer[
                                                                        `${noti.id}-customVolumeReset`
                                                                    ] = null;
                                                                }
                                                                device.setDeviceNotificationVolume(
                                                                    volumeToRestore,
                                                                    err => {
                                                                        if (err) {
                                                                            return;
                                                                        }
                                                                        if (
                                                                            this.adapterObjects[
                                                                                `Echo-Devices.${device.serialNumber}.Preferences.notificationVolume`
                                                                            ]
                                                                        ) {
                                                                            void this.setState(
                                                                                `Echo-Devices.${device.serialNumber}.Preferences.notificationVolume`,
                                                                                volumeToRestore,
                                                                                true,
                                                                            );
                                                                        }
                                                                        this.log.debug(
                                                                            `${noti.type} ${noti.id} - Reset notification volume level: ${volumeToRestore}`,
                                                                        );
                                                                        delete this
                                                                            .rememberedNotificationVolumeRestoreCallbacks[
                                                                            device.serialNumber
                                                                        ];
                                                                    },
                                                                );
                                                            };

                                                            this.log.debug(
                                                                `${noti.type} ${noti.id} - Remember notification volume level: ${origNotificationState.volumeLevel}`,
                                                            );
                                                        } else {
                                                            this.log.debug(
                                                                `${noti.type} ${noti.id} - Do not remember notification value because already set!`,
                                                            );
                                                        }

                                                        if (this.notificationTimer[`${noti.id}-customVolumeReset`]) {
                                                            this.clearTimeout(
                                                                this.notificationTimer[`${noti.id}-customVolumeReset`],
                                                            );
                                                            this.notificationTimer[`${noti.id}-customVolumeReset`] =
                                                                null;
                                                        }
                                                        this.notificationTimer[`${noti.id}-customVolumeReset`] =
                                                            this.setTimeout(() => {
                                                                this.notificationTimer[`${noti.id}-customVolumeReset`] =
                                                                    null;
                                                                if (
                                                                    this.rememberedNotificationVolumeRestoreCallbacks[
                                                                        device.serialNumber
                                                                    ]
                                                                ) {
                                                                    this.rememberedNotificationVolumeRestoreCallbacks[
                                                                        device.serialNumber
                                                                    ](notiId, noti, origNotificationState.volumeLevel);
                                                                }
                                                            }, 120000);
                                                    });
                                                });
                                            });

                                            // Check again status after 1min if no stop was arrived
                                            this.notificationTimer[noti.id] = this.setTimeout(() => {
                                                this.notificationTimer[noti.id] = null;
                                                this.getState(`${notiId}.triggered`, (err, state) => {
                                                    if (!err && state && state.val) {
                                                        this.updateNotificationStates(device);
                                                    }
                                                });
                                            }, 60000);
                                        },
                                        alarmDelay > 2000 ? alarmDelay - 2000 : 0,
                                    );
                                }

                                if (this.notificationTimer[noti.id]) {
                                    this.clearTimeout(this.notificationTimer[noti.id]);
                                    this.notificationTimer[noti.id] = null;
                                }
                                this.notificationTimer[noti.id] = this.setTimeout(() => {
                                    this.notificationTimer[noti.id] = null;
                                    this.log.debug(`${noti.type} ${noti.id} triggered`);
                                    void this.setState(`${notiId}.triggered`, true, true);
                                    if (noti.type === 'Alarm') {
                                        void this.setState(`${devId}.Alarm.triggered`, noti.notificationIndex, true);
                                    } else if (noti.type === 'Reminder') {
                                        void this.setState(`${devId}.Reminder.triggered`, noti.notificationIndex, true);
                                    }
                                    // Check again status after 1min if no stop was arrived
                                    this.notificationTimer[noti.id] = this.setTimeout(() => {
                                        this.notificationTimer[noti.id] = null;
                                        this.getState(`${notiId}.triggered`, (err, state) => {
                                            if (!err && state && state.val) {
                                                this.updateNotificationStates(device);
                                            }
                                        });
                                    }, 60000);
                                }, alarmDelay);
                            } else {
                                this.notificationTimer[noti.id] = this.setTimeout(
                                    () => {
                                        this.notificationTimer[noti.id] = null;
                                        this.updateNotificationStates(device);
                                    },
                                    14 * 24 * 60 * 60 * 1000,
                                );
                            }
                        }
                    }
                    this.setOrUpdateObject(
                        `${notiId}.nextTriggerDate`,
                        {
                            common: {
                                type: 'number',
                                role: 'date',
                                name: noti.reminderLabel ? noti.reminderLabel : `${displayName} Trigger Timestamp`,
                            },
                        },
                        nextTriggerTime,
                    );
                }
            }
            this.setOrUpdateObject(
                `${devId}.Timer.nextTimerDate`,
                { common: { type: 'number', role: 'date', name: 'Unix epoch timestamp for next timer' } },
                nextTimerObject ? nextTimerObject.triggerTime || Date.now() + nextTimerObject.remainingTime : 0,
                // originally null instead of undefined: both mean "no state change callback" in setOrUpdateObject
                nextTimerObject ? nextTimerObject.set : undefined,
            );
            this.setOrUpdateObject(
                `${devId}.Timer.activeTimerList`,
                { common: { type: 'string', role: 'array', name: 'Array of the active timers' } },
                JSON.stringify(activeTimerList),
            );
            this.setOrUpdateObject(
                `${devId}.Timer.nextTimerId`,
                { common: { type: 'string', role: 'text', name: 'ID of the next triggered timer' } },
                nextTimerObject ? nextTimerObject.notificationIndex : null,
            );
            this.setOrUpdateObject(
                `${devId}.Timer.stopTimerId`,
                { common: { type: 'string', role: 'text', name: 'ID of the timer to be stopped' } },
                '',
                (val: ioBroker.StateValue) => {
                    if (!val) {
                        return;
                    }
                    const value = val.toString();
                    // NOTE: device.notifications is not checked for existence (as before)
                    const noti = (device.notifications as NotificationEntry[]).find(n => n.notificationIndex === value);

                    if (!noti) {
                        this.log.error(`${devId} - Cannot stop timer ${value} - not found`);
                        return;
                    }
                    noti.delete(err => {
                        if (err) {
                            this.log.error(`${devId} - Cannot stop timer ${value} - ${err.message}`);
                        } else {
                            void this.setState(`${devId}.Timer.stopTimerId`, '', true);
                        }
                    });
                },
            );
        }
    }

    private updateNotificationStates(
        serialOrName?: string | AlexaDevice | null | (() => void),
        callback?: () => void,
    ): void {
        if (typeof serialOrName === 'function') {
            callback = serialOrName;
            serialOrName = null;
        }
        if (!this.alexa._options.notifications) {
            return callback && callback();
        }
        if (serialOrName) {
            serialOrName = this.findDevice(serialOrName);
        }

        this.alexa.initNotifications(() => {
            Object.keys(this.alexa.serialNumbers).forEach(n => {
                const device = this.findDevice(n);
                if ((serialOrName && serialOrName !== device) || (device && device.ignore)) {
                    return;
                }

                this.createNotificationStates(device!);
            });
            if (callback) {
                callback();
            } else {
                this.processObjectQueue();
            }
        });
    }

    private updatePlayerStatus(serialOrName?: string | AlexaDevice | null | (() => void), callback?: () => void): void {
        if (typeof serialOrName === 'function') {
            callback = serialOrName;
            serialOrName = null;
        }
        let serials: string[];
        if (serialOrName) {
            serialOrName = this.findDevice(serialOrName);
            if (!serialOrName) {
                return callback && callback();
            }
            serials = [serialOrName.serialNumber];
        } else {
            serials = Object.keys(this.playerDevices);
        }

        let i = 0;
        const doIt = (): void => {
            if (i >= serials.length) {
                if (this.config.updateStateInterval > 0) {
                    this.scheduleStatesUpdate();
                }
                return this.processObjectQueue(callback);
            }
            const device = this.findDevice(serials[i++]);
            if (!device || !device.isControllable) {
                return doIt();
            }
            const devId = `Echo-Devices.${device.serialNumber}`;

            this.alexa.getPlayerInfo(device, (err, res) => {
                const resPlayer = res as AmazonJson | undefined;
                if (this.stopped) {
                    return;
                }
                if (err || !resPlayer || !resPlayer.playerInfo) {
                    const lastKnownPlayerState: string =
                        (this.lastPlayerState[device.serialNumber] &&
                        this.lastPlayerState[device.serialNumber].resPlayer &&
                        this.lastPlayerState[device.serialNumber].resPlayer.playerInfo
                            ? this.lastPlayerState[device.serialNumber].resPlayer.playerInfo.state
                            : 'UNKNOWN') || 'UNKNOWN';
                    // no player info means no player active
                    const devId = `Echo-Devices.${device.serialNumber}`;
                    void this.setState(
                        `${devId}.Player.controlPause`,
                        lastKnownPlayerState === 'PAUSED' ||
                            (lastKnownPlayerState !== 'PLAYING' && lastKnownPlayerState !== 'FINISHED'),
                        true,
                    );
                    void this.setState(`${devId}.Player.controlPlay`, lastKnownPlayerState === 'PLAYING', true);
                    this.playingDevices[device.serialNumber] = lastKnownPlayerState === 'PLAYING';
                    void this.setState(`${devId}.Player.currentState`, lastKnownPlayerState === 'PLAYING', true);

                    if (
                        lastKnownPlayerState !== 'PLAYING' &&
                        this.lastPlayerState[device.serialNumber] &&
                        this.lastPlayerState[device.serialNumber].resPlayer &&
                        this.lastPlayerState[device.serialNumber].resPlayer.playerInfo &&
                        this.lastPlayerState[device.serialNumber].resPlayer.playerInfo.isPlayingInLemur &&
                        device.isMultiroomDevice &&
                        device.clusterMembers &&
                        this.playingDevices[device.serialNumber]
                    ) {
                        // Played before but now no longer playing in group
                        // NOTE: playingDevices[serial] was set above to (lastKnownPlayerState === 'PLAYING'), which is
                        // false here, so this block is never executed (as before)
                        device.clusterMembers.forEach(member => {
                            if (this.playingDevices[member]) {
                                return; // Device is updated itself while playing
                            }
                            const memberDevice = this.findDevice(member);
                            if (memberDevice && memberDevice.isControllable) {
                                void this.setState(
                                    `Echo-Devices.${memberDevice.serialNumber}.Player.playingInGroup`,
                                    false,
                                    true,
                                );
                                void this.setState(
                                    `Echo-Devices.${memberDevice.serialNumber}.Player.playingInGroupId`,
                                    null,
                                    true,
                                );
                            }
                        });
                    }

                    if (
                        this.initialDeviceVolumes[device.serialNumber] &&
                        device.capabilities.includes('VOLUME_SETTING')
                    ) {
                        let volume: number | null = this.initialDeviceVolumes[device.serialNumber].speakerVolume;
                        const muted: boolean | null = this.initialDeviceVolumes[device.serialNumber].speakerMuted;
                        if (muted !== null) {
                            void this.setState(`${devId}.Player.muted`, muted, true);
                        }
                        if (volume === 0 && device.isMultiroomDevice) {
                            volume = null;
                        }
                        if (volume !== null) {
                            void this.setState(`${devId}.Player.volume`, volume, true);
                        }
                        this.log.debug(
                            `Initialize Volume for Device ${device.serialNumber}: volume=${volume} (muted=${muted})`,
                        );
                        delete this.initialDeviceVolumes[device.serialNumber];
                    }
                    return this.setTimeout(doIt, Math.floor(Math.random() * 2000) + 500);
                }

                const playerData: PlayerStatusData = {
                    providerName: '',
                    providerId: '',
                    radioStationId: '',
                    service: '',
                    contentType: '',
                    controlShuffle: null,
                    controlRepeat: null,
                    imageURL: '',
                    muted: null,
                    volume: null,
                    controlPause: false,
                    controlPlay: false,
                    currentState: false,
                    title: '',
                    artist: '',
                    album: '',
                    mainArtUrl: '',
                    miniArtUrl: '',
                    mediaLength: 0,
                    mediaProgress: 0,
                    mediaProgressPercent: 0,
                    mediaId: '',
                    queueId: '',
                    quality: '',
                    qualityCodec: '',
                    qualityDataRate: null,
                    qualitySampleRate: null,
                    allowNext: false,
                    allowPlayPause: false,
                    allowPrevious: false,
                    allowRepeat: false,
                    allowShuffle: false,
                    playingInGroup: false,
                    playingInGroupId: '',
                };
                if (this.initialDeviceVolumes[device.serialNumber]) {
                    playerData.volume = this.initialDeviceVolumes[device.serialNumber].speakerVolume;
                    playerData.muted = this.initialDeviceVolumes[device.serialNumber].speakerMuted;
                    this.log.debug(
                        `Initialize Volume for Device ${device.serialNumber}: volume=${playerData.volume} (muted=${playerData.muted})`,
                    );
                    delete this.initialDeviceVolumes[device.serialNumber];
                }

                // Was a local function declaration; it is only called below its definition, so a const is fine
                const finalize = (resMedia?: AmazonJson): void => {
                    if (
                        this.lastPlayerState[device.serialNumber] &&
                        this.lastPlayerState[device.serialNumber].timeout
                    ) {
                        this.clearTimeout(this.lastPlayerState[device.serialNumber].timeout);
                    }
                    this.lastPlayerState[device.serialNumber] = {
                        resPlayer,
                        resMedia,
                        ts: Date.now(),
                        devId: devId,
                        timeout: null,
                    };

                    playerData.currentState = resPlayer.playerInfo.state === 'PLAYING';

                    let mediaRemaining = 0;
                    if (resPlayer.playerInfo) {
                        if (resPlayer.playerInfo.infoText) {
                            playerData.title = resPlayer.playerInfo.infoText.title;
                            playerData.artist = resPlayer.playerInfo.infoText.subText1;
                            playerData.album = resPlayer.playerInfo.infoText.subText2;
                        }

                        if (resPlayer.playerInfo.mainArt) {
                            playerData.mainArtUrl = resPlayer.playerInfo.mainArt.url;
                        }
                        if (resPlayer.playerInfo.miniArt) {
                            playerData.miniArtUrl = resPlayer.playerInfo.miniArt.url;
                        }
                        playerData.mediaId = resPlayer.playerInfo.mediaId;
                        playerData.queueId = resPlayer.playerInfo.queueId;
                        playerData.playingInGroup = resPlayer.playerInfo.isPlayingInLemur;
                        playerData.playingInGroupId = resPlayer.playerInfo.playingInLemurId;

                        if (resPlayer.playerInfo.progress) {
                            playerData.mediaLength = parseInt(resPlayer.playerInfo.progress.mediaLength || '0', 10);
                            playerData.mediaProgress = parseInt(resPlayer.playerInfo.progress.mediaProgress, 10);
                            if (playerData.mediaLength > 0) {
                                playerData.mediaProgressPercent = Math.round(
                                    (playerData.mediaProgress * 100) / playerData.mediaLength,
                                );
                                mediaRemaining = playerData.mediaLength - playerData.mediaProgress;
                            }
                        }

                        playerData.controlPause = resPlayer.playerInfo.state === 'PAUSED';
                        playerData.controlPlay = resPlayer.playerInfo.state === 'PLAYING';

                        if (resPlayer.playerInfo.quality) {
                            playerData.quality = resPlayer.playerInfo.quality.name;
                            if (resPlayer.playerInfo.quality.stats) {
                                playerData.qualityCodec = resPlayer.playerInfo.quality.stats.codec;
                                playerData.qualityDataRate = Math.round(
                                    resPlayer.playerInfo.quality.stats.dataRateInBitsPerSecond / 1000,
                                );
                                playerData.qualitySampleRate = resPlayer.playerInfo.quality.stats.samplingRateInHertz;
                            }
                        }

                        if (resPlayer.playerInfo.transport) {
                            playerData.allowNext = resPlayer.playerInfo.transport.next === 'ENABLED';
                            playerData.allowPlayPause = resPlayer.playerInfo.transport.playPause === 'ENABLED';
                            playerData.allowPrevious = resPlayer.playerInfo.transport.previous === 'ENABLED';
                            playerData.allowRepeat = resPlayer.playerInfo.transport.repeat === 'ENABLED';
                            playerData.allowShuffle = resPlayer.playerInfo.transport.shuffle === 'ENABLED';
                        }
                    }
                    // Set States
                    void this.setState(`${devId}.Player.providerName`, playerData.providerName, true); // 'Amazon Music' | 'TuneIn Live-Radio'
                    void this.setState(`${devId}.Player.providerId`, playerData.providerId, true);
                    void this.setState(`${devId}.Player.radioStationId`, playerData.radioStationId, true); // 's24885' | null
                    void this.setState(`${devId}.Player.service`, playerData.service, true);
                    void this.setState(`${devId}.Player.contentType`, playerData.contentType, true); // 'LIVE_STATION' | 'TRACKS' | 'CUSTOM_STATION
                    if (playerData.controlShuffle !== null) {
                        void this.setState(`${devId}.Player.controlShuffle`, playerData.controlShuffle, true);
                    }
                    if (playerData.controlRepeat !== null) {
                        void this.setState(`${devId}.Player.controlRepeat`, playerData.controlRepeat, true);
                    }

                    //let muted = res.playerInfo.volume.muted;
                    void this.setState(`${devId}.Player.controlPause`, playerData.controlPause, true);
                    void this.setState(`${devId}.Player.controlPlay`, playerData.controlPlay, true);

                    void this.setState(`${devId}.Player.imageURL`, playerData.imageURL, true);

                    void this.setState(`${devId}.Player.mediaId`, playerData.mediaId, true);
                    void this.setState(`${devId}.Player.queueId`, playerData.queueId, true);
                    void this.setState(`${devId}.Player.quality`, playerData.quality, true);
                    void this.setState(`${devId}.Player.qualityCodec`, playerData.qualityCodec, true);
                    void this.setState(`${devId}.Player.qualityDataRate`, playerData.qualityDataRate, true);
                    void this.setState(`${devId}.Player.qualitySampleRate`, playerData.qualitySampleRate, true);
                    void this.setState(`${devId}.Player.allowNext`, playerData.allowNext, true);
                    void this.setState(`${devId}.Player.allowPlayPause`, playerData.allowPlayPause, true);
                    void this.setState(`${devId}.Player.allowPrevious`, playerData.allowPrevious, true);
                    void this.setState(`${devId}.Player.allowRepeat`, playerData.allowRepeat, true);
                    void this.setState(`${devId}.Player.allowShuffle`, playerData.allowShuffle, true);
                    void this.setState(`${devId}.Player.playingInGroup`, playerData.playingInGroup, true);
                    void this.setState(`${devId}.Player.playingInGroupId`, playerData.playingInGroupId, true);

                    if (
                        playerData.playingInGroup &&
                        playerData.currentState &&
                        playerData.playingInGroupId &&
                        device.isMultiroomDevice &&
                        device.clusterMembers
                    ) {
                        device.clusterMembers.forEach(member => {
                            const memberDevice = this.findDevice(member);
                            if (memberDevice && memberDevice.isControllable) {
                                void this.setState(
                                    `Echo-Devices.${memberDevice.serialNumber}.Player.playingInGroup`,
                                    true,
                                    true,
                                );
                                void this.setState(
                                    `Echo-Devices.${memberDevice.serialNumber}.Player.playingInGroupId`,
                                    playerData.playingInGroupId,
                                    true,
                                );
                            }
                        });
                    } else if (
                        (!playerData.playingInGroup || !playerData.currentState) &&
                        device.isMultiroomDevice &&
                        device.clusterMembers &&
                        this.playingDevices[device.serialNumber]
                    ) {
                        // Played before but now no longer playing in group
                        device.clusterMembers.forEach(member => {
                            if (this.playingDevices[member]) {
                                return; // Device is updated itself while playing
                            }
                            const memberDevice = this.findDevice(member);
                            if (memberDevice && memberDevice.isControllable) {
                                void this.setState(
                                    `Echo-Devices.${memberDevice.serialNumber}.Player.playingInGroup`,
                                    false,
                                    true,
                                );
                                void this.setState(
                                    `Echo-Devices.${memberDevice.serialNumber}.Player.playingInGroupId`,
                                    null,
                                    true,
                                );
                            }
                        });
                    }
                    this.playingDevices[device.serialNumber] = playerData.currentState;

                    if (device.capabilities.includes('VOLUME_SETTING')) {
                        if (playerData.muted !== null) {
                            void this.setState(`${devId}.Player.muted`, playerData.muted, true);
                        }
                        if (playerData.volume === 0 && device.isMultiroomDevice) {
                            playerData.volume = null;
                        }
                        if (playerData.volume !== null) {
                            void this.setState(`${devId}.Player.volume`, playerData.volume, true);
                        }
                    }

                    void this.setState(`${devId}.Player.currentState`, playerData.currentState, true);

                    void this.setState(`${devId}.Player.currentTitle`, playerData.title || '', true);
                    void this.setState(`${devId}.Player.currentArtist`, playerData.artist || '', true);
                    void this.setState(`${devId}.Player.currentAlbum`, playerData.album || '', true);

                    void this.setState(`${devId}.Player.mainArtUrl`, playerData.mainArtUrl || '', true);
                    void this.setState(`${devId}.Player.miniArtUrl`, playerData.miniArtUrl || '', true);

                    void this.setState(
                        `${devId}.Player.mediaLength`,
                        parseInt(String(playerData.mediaLength || '0'), 10),
                        true,
                    );
                    void this.setState(`${devId}.Player.mediaLengthStr`, this.sec2HMS(playerData.mediaLength), true);
                    void this.setState(`${devId}.Player.mediaProgress`, playerData.mediaProgress, true);
                    void this.setState(
                        `${devId}.Player.mediaProgressStr`,
                        this.sec2HMS(playerData.mediaProgress),
                        true,
                    );
                    void this.setState(`${devId}.Player.mediaProgressPercent`, playerData.mediaProgressPercent, true);
                    void this.setState(`${devId}.Player.mediaRemaining`, mediaRemaining, true);
                    // NOTE: overwrites mediaLengthStr with the remaining time - probably meant "mediaRemainingStr"
                    // (that state does not exist). Kept as before.
                    void this.setState(`${devId}.Player.mediaLengthStr`, this.sec2HMS(mediaRemaining), true);

                    // Check Progress
                    if (resPlayer.playerInfo.state === 'PLAYING') {
                        this.lastPlayerState[device.serialNumber].timeout = this.setTimeout(() => {
                            this.lastPlayerState[device.serialNumber].timeout = null;
                            this.updateMediaProgress(device.serialNumber);
                        }, 2000);
                    }
                    this.setTimeout(doIt, Math.floor(Math.random() * 2000) + 500);
                };

                if (resPlayer.playerInfo !== undefined && resPlayer.playerInfo.provider) {
                    playerData.providerName = resPlayer.playerInfo.provider.providerName;
                }

                if (resPlayer.mainArt && resPlayer.mainArt.url !== undefined) {
                    playerData.mainArtUrl = resPlayer.mainArt.url;
                }

                if (resPlayer.volume !== undefined) {
                    playerData.muted = !!resPlayer.volume.muted;
                }
                if (
                    resPlayer.playerInfo &&
                    resPlayer.playerInfo.volume &&
                    resPlayer.playerInfo.volume.volume !== null
                ) {
                    playerData.volume = ~~resPlayer.playerInfo.volume.volume;
                }

                if (playerData.providerName !== 'Spotify' && playerData.providerName !== '') {
                    // Spotify Podcast -> empty providerName
                    this.alexa.getMedia(device, (err, res) => {
                        const resMedia = res as AmazonJson | undefined;
                        if (this.stopped) {
                            return;
                        }
                        if (err || !resMedia) {
                            return this.setTimeout(doIt, Math.floor(Math.random() * 2000) + 500);
                        }

                        if (resMedia.shuffling !== undefined) {
                            playerData.controlShuffle = resMedia.shuffling;
                        }
                        if (resMedia.looping !== undefined) {
                            playerData.controlRepeat = resMedia.looping;
                        }
                        playerData.contentType = resMedia.contentType || ''; // 'LIVE_STATION' | 'TRACKS' | 'CUSTOM_STATION'
                        if (resMedia.imageURL && resMedia.imageURL.endsWith('.')) {
                            resMedia.imageURL += 'png'; // Handle Amazon errors
                        }
                        playerData.imageURL = resMedia.imageURL || '';
                        playerData.muted = !!resMedia.muted;
                        playerData.providerId = resMedia.providerId || ''; // 'TUNE_IN' | 'CLOUD_PLAYER' | 'ROBIN'
                        playerData.radioStationId = resMedia.radioStationId || ''; // 's24885' | null
                        playerData.service = resMedia.service || ''; // 'TUNE_IN' | 'CLOUD_PLAYER' | 'PRIME_STATION'
                        if (resMedia && resMedia.volume !== undefined && resMedia.volume !== null) {
                            playerData.volume = ~~resMedia.volume;
                        }
                        finalize(resMedia);
                    });
                } else {
                    finalize();
                }
            });
        };
        doIt();
    }

    // ---- converted from main.js (part E) ----
    private getLists(listId?: string | null | (() => void), callback?: () => void): void {
        if (typeof listId === 'function') {
            callback = listId;
            listId = null;
        }

        if (!this.config.synchronizeLists) {
            return callback && callback();
        }
        const allListItems: Promise<boolean>[] = [];
        const node = 'Lists';
        this.alexa.getLists((_err, res) => {
            if (this.stopped) {
                return;
            }
            const lists = res as AlexaList[] | undefined;
            !listId && this.setOrUpdateObject(node, { type: 'device', common: { name: 'Lists' } });

            if (Array.isArray(lists)) {
                lists.forEach(list => {
                    if (listId && list.listId !== listId) {
                        return;
                    }
                    // modify states
                    list.name = list.name || list.type;
                    // NOTE: throws (as before) if a list has neither name nor type
                    list.id = (list.name as string)
                        .replace(this.FORBIDDEN_CHARS, '-')
                        .replace(/ /g, '_')
                        .replace(/\./g, '_');
                    delete list.listIds;
                    delete list.itemId;

                    this.listMap[list.listId as string] = list.id;
                    // create channel
                    this.setOrUpdateObject(`${node}.${list.id}`, {
                        type: 'channel',
                        common: {
                            name: `${this.ucFirst(
                                (list.name as string).toLowerCase().replace('list', '').replace(/_/g, ' '),
                            )} List`,
                        },
                    });

                    // create state for new item
                    //adapter.subscribeStates(node + '.' + list.id + '.#New');
                    this.setOrUpdateObject(
                        `${node}.${list.id}.#New`,
                        {
                            common: {
                                type: 'mixed',
                                role: 'state',
                                name: 'Add new list item',
                            },
                        },
                        '',
                        (value: ioBroker.StateValue) => {
                            if (value) {
                                void this.setState(`${node}.${list.id}.#New`, '', true);
                                // Strings are always used as value; JSON.parse() is only reached for non-string values
                                this.addListItem(
                                    list,
                                    typeof value === 'string'
                                        ? { value: value }
                                        : (JSON.parse(value as unknown as string) as AlexaListItemInput),
                                );
                            }
                        },
                    );

                    // write list contents as states
                    for (const key in list) {
                        if (list[key] !== null) {
                            this.setOrUpdateObject(
                                `${node}.${list.id}.${key}`,
                                { common: LIST_OBJECTS[key] ? LIST_OBJECTS[key] : { role: 'text' } },
                                list[key] as ioBroker.StateValue,
                            );
                        }
                    }

                    // read list items
                    this.log.debug(`Updating list ${list.name}...`);
                    allListItems.push(this.updateListItems(list));
                });
            }

            void Promise.all(allListItems).then(() => callback && callback());
        });
    }

    private addListItem(list: AlexaList, item: AlexaListItemInput): void {
        this.log.info(`Adding item "${item.value as string}" (${JSON.stringify(item)}) to the list ${list.name}.`);
        this.alexa.addListItem(list.listId as string, item); // , (err, res) => updateListItems(list)
    }

    private updateListItem(list: AlexaList, item: AlexaListItem): void {
        this.log.info(`Updating item "${item.value}" (${JSON.stringify(item)}) of the list ${list.name}.`);
        this.alexa.updateListItem(list.listId as string, item.id, item); // , (err, res) => updateListItems(list)
    }

    private deleteListItem(list: AlexaList, item: AlexaListItem): void {
        this.log.info(`Deleting item "${item.value}" from the list ${list.name}.`);
        this.alexa.deleteListItem(list.listId as string, item.id, item); // , (err, res) => updateListItems(list)
    }

    private updateListItems(list: AlexaList, callback?: () => void): Promise<boolean> {
        let node = `Lists.${list.id}`;
        return new Promise(resolve => {
            this.alexa.getListItems((list.listId || list.itemId) as string, (_err, res) => {
                if (this.stopped) {
                    return;
                }
                const items = res as AlexaListItem[] | undefined;
                this.setOrUpdateObject(
                    `${node}.json`,
                    { common: { name: 'List as json', role: 'json' } },
                    JSON.stringify(items),
                );

                node = `${node}.items`;
                this.setOrUpdateObject(node, { type: 'channel', common: { name: 'All list items' } });

                if (Array.isArray(items)) {
                    items.forEach((item, index) => {
                        item.index = index;
                        item['#delete'] = false;
                        item.listName = list.name;

                        /*
                         * EXAMPLE PAYLOAD
                         *
                        {
                            completed: true,
                            createdDateTime: 1574597641331,
                            customerId: null,
                            id: '8140fa62-XXXX-XXXX-XXXX-7380a2ccd6ab',
                            listId: 'YW16bjEuYWNXXXXXXXXXZCWFhRLVRBU0s=',
                            shoppingListItem: false,
                            updatedDateTime: 1574619085063,
                            value: 'Q',
                            version: 2
                        }
                        */

                        this.setOrUpdateObject(`${node}.${item.id}`, {
                            type: 'channel',
                            common: { name: `List item ${index + 1}` },
                        });
                        for (const key in item) {
                            if (item[key] !== null) {
                                if (key === '#delete') {
                                    //adapter.subscribeStates(node + '.' + item.id + '.' + key);
                                    this.setOrUpdateObject(
                                        `${node}.${item.id}.${key}`,
                                        {
                                            common: LIST_ITEMS_OBJECTS[key]
                                                ? LIST_ITEMS_OBJECTS[key]
                                                : { role: 'text' },
                                        },
                                        item[key] as ioBroker.StateValue,
                                        () => this.deleteListItem(list, item),
                                    );
                                } else {
                                    this.setOrUpdateObject(
                                        `${node}.${item.id}.${key}`,
                                        {
                                            common: LIST_ITEMS_OBJECTS[key]
                                                ? LIST_ITEMS_OBJECTS[key]
                                                : { role: 'text' },
                                        },
                                        item[key] as ioBroker.StateValue,
                                        ['completed', 'value'].indexOf(key) === -1
                                            ? null
                                            : (value: ioBroker.StateValue) =>
                                                  this.updateListItem(list, {
                                                      ...item,
                                                      [key]: value,
                                                  }),
                                    );
                                }
                            }
                        }
                    });
                }

                callback && callback();
                resolve(true);
            });
        });
    }

    private initRoutines(callback: () => void): void {
        this.alexa.getAutomationRoutines((err, res) => {
            if (this.stopped) {
                return;
            }
            const routines = res as AutomationRoutine[] | undefined;
            const automationRoutines: AmazonJson[] = [];
            this.automationRoutines = automationRoutines;
            this.routineTriggerUtterances = {};
            if (!err && routines && Array.isArray(routines)) {
                for (let i = 0; i < routines.length; i++) {
                    const routine = routines[i];
                    if (routine['@type'] !== 'com.amazon.alexa.behaviors.model.Automation') {
                        this.log.debug(`Ignore unknown type of Automation Routine ${routine['@type']}`);
                        continue;
                    }
                    if (!routine.sequence) {
                        this.log.debug(`Automation Routine has no sequence ${JSON.stringify(routine)}`);
                        continue;
                    }
                    let name: string | null | undefined = routine.name;
                    let utteranceWords: string[] = [];
                    if (routine.triggers && routine.triggers[0].payload && routine.triggers[0].payload.utterance) {
                        name = name || routine.triggers[0].payload.utterance;
                        utteranceWords = routine.triggers[0].payload.utterances || [
                            routine.triggers[0].payload.utterance,
                        ];
                    } else if (
                        routine.triggers &&
                        routine.triggers[0].payload &&
                        routine.triggers[0].payload.schedule &&
                        routine.triggers[0].payload.schedule.triggerTime
                    ) {
                        if (!name) {
                            name = name || routine.triggers[0].payload.schedule.triggerTime;
                            if (name.length === 6) {
                                // NOTE: The regex is broken ({0-9}{2} instead of [0-9]{2}) and never matches,
                                // so the trigger time is used unformatted. Kept as before.
                                name = name.replace(/^({0-9}{2})({0-9}{2})({0-9}{2})$/, '$1:$2:$3');
                            }
                            if (routine.triggers[0].payload.schedule.recurrence) {
                                name += ` ${routine.triggers[0].payload.schedule.recurrence}`;
                            }
                        }
                    } else if (!name && routine.triggers && routine.triggers[0] && routine.triggers[0].type) {
                        name = name || routine.triggers[0].type.replace(/^Alexa\.Trigger\./, '');
                    } else {
                        // NOTE: Also reached for named routines with another trigger type: their name is replaced by
                        // 'Unknown'. If the routine has no triggers at all, this line throws. Both kept as before.
                        this.log.debug(
                            `Ignore unknown type of Automation Routine Trigger${JSON.stringify(routine.triggers![0].payload)}`,
                        );
                        name = 'Unknown';
                    }
                    routine.friendlyName = name;
                    const idSplit = routine.automationId.split('.');
                    routine.friendlyAutomationId = idSplit[idSplit.length - 1];
                    routine.utteranceWords = utteranceWords;
                    automationRoutines.push(routine);
                }
            }
            callback && callback();
        });
    }

    private initCommUsers(callback: () => void): void {
        this.alexa.getAccount((_err, _commOwnAccount) => {
            this.alexa.getHomeGroup((_err, homeGroupRes) => {
                if (this.stopped) {
                    return;
                }
                const commHomeGroup = homeGroupRes as CommHomeGroupResponse | undefined;
                if (commHomeGroup && commHomeGroup.commsId) {
                    this.alexa.commsId = commHomeGroup.commsId;
                }
                if (!commHomeGroup || !commHomeGroup.homeGroupId) {
                    this.processObjectQueue(callback);
                    return;
                }
                const homeGroupId = commHomeGroup.homeGroupId;
                this.alexa.getContacts({ homeGroupId: homeGroupId }, (err, contactsRes) => {
                    if (this.stopped) {
                        return;
                    }
                    const commContacts = contactsRes as CommContactEntry[] | undefined;
                    if (err || !commContacts || !Array.isArray(commContacts)) {
                        this.processObjectQueue(callback);
                        return;
                    }
                    this.setOrUpdateObject('Contacts', { type: 'device', common: { name: 'Communication contacts' } });

                    commContacts.forEach(comEntry => {
                        if (
                            !comEntry.commsId ||
                            !comEntry.commsId.length ||
                            !comEntry.alexaEnabled ||
                            comEntry.commsId[0] === homeGroupId
                        ) {
                            return;
                        }
                        const commsId = comEntry.commsId;

                        const contactId = commsId[0].substring(commsId[0].lastIndexOf('.') + 1);
                        let contactName = comEntry.name.firstName;
                        if (!contactName) {
                            contactName = comEntry.company;
                        } else if (comEntry.name.lastName) {
                            contactName += ` ${comEntry.name.lastName}`;
                        }
                        if (commsId[0] === this.alexa.commsId) {
                            // NOTE: results in "undefined (Self)" if there is neither a first name nor a company
                            // (as before)
                            contactName = `${contactName} (Self)`;
                        }
                        contactName = contactName || 'Unknown';

                        this.setOrUpdateObject(`Contacts.${contactId}`, {
                            type: 'channel',
                            common: { name: contactName },
                        });

                        this.setOrUpdateObject(
                            `Contacts.${contactId}.textMessage`,
                            { common: { role: 'text', def: '' } },
                            '',
                            (value: ioBroker.StateValue) => {
                                if (value === '') {
                                    return;
                                }

                                this.alexa.sendTextMessage(commsId[0], value as string, (_err, _res) => {
                                    // Alexa-Remote: Response: {"conversationId":"amzn1.comms.messaging.id.conversationV2~b3e030bd-3ca7-4921-9084-ab16832fd1ca","messageIds":[1],"sequenceIds":[1],"time":"2019-07-21T08:49:13.522Z"}
                                    //if (!err && res && res.messageIds && Array.isArray(res.messageIds) && res.messageIds.length === 1) {
                                    //}
                                });
                            },
                        );

                        if (commsId[0] === this.alexa.commsId) {
                            this.setOrUpdateObject(
                                `Contacts.${contactId}.#clearOwnMessages`,
                                { common: { role: 'button', type: 'boolean', read: false, write: true, def: false } },
                                false,
                                (_value: ioBroker.StateValue) => {
                                    this.alexa.getConversations((err, convRes) => {
                                        if (this.stopped) {
                                            return;
                                        }
                                        const res = convRes as CommConversationsResponse | undefined;
                                        if (!err && res && res.conversations && Array.isArray(res.conversations)) {
                                            res.conversations.forEach(conversation => {
                                                if (
                                                    !conversation.participants ||
                                                    !conversation.participants.length ||
                                                    conversation.participants[0] !== this.alexa.commsId
                                                ) {
                                                    return;
                                                }
                                                this.log.debug(
                                                    `Delete Conversation with ID ${conversation.conversationId}`,
                                                );
                                                this.alexa.deleteConversation(
                                                    conversation.conversationId,
                                                    conversation.lastMessageId,
                                                    (_err, _res) => {
                                                        //TODO
                                                    },
                                                );
                                            });
                                        }
                                    });
                                },
                            );
                        }

                        this.log.debug(`Create contact "${contactName}" (${contactId})`);
                    });

                    this.processObjectQueue(callback);
                });
            });
        });
    }

    private loadExistingAccessories(callback?: () => void): void {
        void this.getAdapterObjects(res => {
            const objectKeys = Object.keys(res);
            for (let i = 0; i < objectKeys.length; i++) {
                if (objectKeys[i].indexOf(`${this.namespace}.info`) === 0) {
                    continue;
                }
                this.existingStates[objectKeys[i].substring(this.namespace.length + 1)] = res[objectKeys[i]];
            }
            //adapter.log.debug('Existing States: ' + JSON.stringify(Object.keys(existingStates), null, 4));

            // devId + '.Bluetooth' = device , ChannelsOd = MACs
            // devId + '.Notifications' = channel, statesOf ??
            // devId + '.Routines' = channel, statesOf

            if (callback) {
                callback();
            }
        });
    }

    private main(): void {
        this.log.info(
            'Starting Alexa2 adapter ... it can take several minutes to initialize all data. Please be patient! A done message is logged.',
        );
        // The crash check file stays in the adapter root directory (not in build/)
        this.crashCheckFileName = join(ADAPTER_DIR, `crashCheck-${this.namespace}.json`);
        if (USE_CRASH_CHECK) {
            let crashCheck: CrashCheckData = {
                startCounter: 0,
            };
            try {
                if (existsSync(this.crashCheckFileName)) {
                    crashCheck = JSON.parse(readFileSync(this.crashCheckFileName, 'utf8')) as CrashCheckData;
                }
            } catch (err) {
                this.log.error(`Error reading crashCheck file: ${(err as Error).message}`);
            }
            crashCheck.startCounter++;
            try {
                writeFileSync(this.crashCheckFileName, JSON.stringify(crashCheck));
            } catch (err) {
                this.log.error(`Error writing crashCheck file: ${(err as Error).message}`);
            }

            if (crashCheck.startCounter > 3) {
                crashCheck.startCounter = 2;
                try {
                    writeFileSync(this.crashCheckFileName, JSON.stringify(crashCheck));
                } catch (err) {
                    this.log.error(`Error writing crashCheck file: ${(err as Error).message}`);
                }
                this.log.error(
                    'Adapter seems to have issues and crashed three times in a row. Disabling!! Please start again and check logs.',
                );
                this.setTimeout(() => {
                    this.isCrashStop = true; // Do not remove crash file
                    this.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                }, 1000);
                return;
            }
        }

        if (!this.config.proxyOwnIp) {
            const ifaces = networkInterfaces();
            for (const eth of Object.keys(ifaces)) {
                const ethIfaces = ifaces[eth]!;
                for (let num = 0; num < ethIfaces.length; num++) {
                    if (
                        ethIfaces[num].family !== 'IPv6' &&
                        ethIfaces[num].address !== '127.0.0.1' &&
                        ethIfaces[num].address !== '0.0.0.0'
                    ) {
                        this.config.proxyOwnIp = ethIfaces[num].address;
                        this.log.info(
                            `Proxy IP not set, use first network interface (${this.config.proxyOwnIp}) instead`,
                        );
                        break;
                    }
                }
                if (this.config.proxyOwnIp) {
                    break;
                }
            }
        }

        let proxyOwnIp = this.config.proxyOwnIp;
        if (this.config.proxyOverrideIp) {
            proxyOwnIp = this.config.proxyOverrideIp;
            this.log.info(`Use Override IP ${this.config.proxyOverrideIp} for Proxy`);
        }

        if (this.config.resetCookies) {
            this.config.cookieData = '';
            this.config.cookie = '';
        }

        const packageJson = JSON.parse(readFileSync(join(ADAPTER_DIR, 'package.json'), 'utf8')) as { version: string };
        // Contains more properties than declared in the alexa-remote2 typings (InitOptions), so it is cast in init()
        const options = {
            cookie: this.config.cookieData || this.config.cookie, // cookie if there is already one
            // cookieData may also be a string: then .macDms is undefined (as before)
            macDms:
                this.config.macDms ||
                (this.config.cookieData && (this.config.cookieData as AlexaCookieData).macDms) ||
                undefined,
            email: '', // Amazon email for login
            password: '', // Amazon password for Login
            bluetooth: true, // fetch Bluetooth devices
            notifications: true, // fetch notifications (false because not works so far)
            userAgent: this.config.userAgent, // overwrite userAgent
            acceptLanguage: this.config.acceptLanguage, // overwrite acceptLanguage
            amazonPage: this.config.cookieLoginUrl, // overwrite amazonPage
            alexaServiceHost: this.config.alexaServiceHost, // overwrite alexa Servcie Host
            logger: this.log.debug.bind(this.log), // Logger with detailed debug only in debug
            setupProxy: true, // optional: should the library setup a proxy to get cookie when automatic way did not worked? Default false!
            proxyOwnIp: proxyOwnIp, // required if proxy enabled: provide own IP or hostname to later access the proxy. needed to setup all rewriting and proxy stuff internally
            proxyPort: this.config.proxyPort, // optional: use this port for the proxy, default is 0 means random port is selected
            proxyListenBind: this.config.proxyListenBind, // optional: set this to bind the proxy to a special IP, default is '0.0.0.0'
            proxyLogLevel: null, // optional: Loglevel of Proxy, default 'warn'
            usePushConnection: false,
            //deviceAppName: 'Amazon Alexa',
            // The data store file stays in the adapter root directory (not in build/)
            formerDataStorePath: join(ADAPTER_DIR, `formerDataStore${this.namespace}.json`),
            apiUserAgentPostfix: `iBrokAlxa2/${packageJson.version}`,
            usePushConnectType: 2,
            autoQueryActivityOnTrigger: this.config.autoQueryActivityOnTrigger,
        };
        this.config.updateHistoryInterval = parseInt(String(this.config.updateHistoryInterval), 10);
        if (
            !this.config.updateHistoryInterval ||
            isNaN(this.config.updateHistoryInterval) ||
            this.config.updateHistoryInterval < 0
        ) {
            this.config.updateHistoryInterval = 0;
        }
        if (this.config.updateHistoryInterval !== 0 && this.config.updateHistoryInterval < 60) {
            this.config.updateHistoryInterval = 60 + Math.floor(Math.random() * 60);
            this.log.info(`Update History Interval is too low, set to ${this.config.updateHistoryInterval}s`);
        } else if (this.config.updateHistoryInterval !== 0 && this.config.updateHistoryInterval >= 60) {
            // NOTE: Intentionally kept as before: a valid history interval adds the random seconds to the
            // *updateStateInterval* (not to updateHistoryInterval). updateStateInterval is not yet parsed here, so if
            // it is still a string in the configuration, this is a string concatenation (e.g. '300' -> '3005'),
            // which is then parsed below.
            this.config.updateStateInterval += Math.floor(Math.random() * 10);
        } else {
            this.config.updateHistoryInterval = 0;
        }
        if (this.config.updateHistoryInterval !== 0) {
            this.config.updateHistoryInterval = Math.max(this.config.updateHistoryInterval, 60);
        }
        if (this.config.updateHistoryInterval > 2147482) {
            // max 2147483647/1000 --> 2147482
            this.config.updateHistoryInterval = 0;
        }
        this.log.debug(
            `Update History Interval: ${this.config.updateHistoryInterval !== 0 ? `${this.config.updateHistoryInterval}s` : 'disabled'}`,
        );

        this.config.updateStateInterval = parseInt(String(this.config.updateStateInterval), 10);
        if (
            !this.config.updateStateInterval ||
            isNaN(this.config.updateStateInterval) ||
            this.config.updateStateInterval < 0
        ) {
            this.config.updateStateInterval = 0;
        }
        if (this.config.updateStateInterval !== 0 && this.config.updateStateInterval < 300) {
            this.config.updateStateInterval = 300 + Math.floor(Math.random() * 60);
            this.log.info(`Update Device State Interval is too low, set to ${this.config.updateStateInterval}s`);
        } else if (this.config.updateStateInterval !== 0 && this.config.updateStateInterval >= 300) {
            this.config.updateStateInterval += Math.floor(Math.random() * 10);
        } else {
            this.config.updateStateInterval = 0;
        }
        if (this.config.updateStateInterval !== 0) {
            this.config.updateStateInterval = Math.max(this.config.updateStateInterval, 300);
        }
        if (this.config.updateStateInterval > 2147482) {
            // max 2147483647/1000 --> 2147482
            this.config.updateStateInterval = 0;
        }
        this.log.debug(
            `Update Device State Interval: ${this.config.updateStateInterval !== 0 ? `${this.config.updateStateInterval}s` : 'disabled'}`,
        );

        this.config.updateConfigurationInterval = parseInt(String(this.config.updateConfigurationInterval), 10);
        if (
            !this.config.updateConfigurationInterval ||
            isNaN(this.config.updateConfigurationInterval) ||
            this.config.updateConfigurationInterval < 0
        ) {
            this.config.updateConfigurationInterval = 0;
        }
        if (this.config.updateConfigurationInterval !== 0 && this.config.updateConfigurationInterval < 300) {
            // Intentionally kept as before: a too low value results in ~1 hour, not in the minimum of 300s
            this.config.updateConfigurationInterval = 3600 + Math.floor(Math.random() * 60);
            this.log.info(
                `Update Devices Configuration Interval is too low, set to ${this.config.updateConfigurationInterval}s`,
            );
        } else if (this.config.updateConfigurationInterval !== 0 && this.config.updateConfigurationInterval >= 300) {
            this.config.updateConfigurationInterval += Math.floor(Math.random() * 10);
        } else {
            this.config.updateConfigurationInterval = 0;
        }
        if (this.config.updateConfigurationInterval !== 0) {
            this.config.updateConfigurationInterval = Math.max(this.config.updateConfigurationInterval, 300);
        }
        if (this.config.updateConfigurationInterval > 2147482) {
            // max 2147483647/1000 --> 2147482
            this.config.updateConfigurationInterval = 0;
        }
        this.log.debug(
            `Update Devices Configuration Interval: ${this.config.updateConfigurationInterval !== 0 ? `${this.config.updateConfigurationInterval}s` : 'disabled'}`,
        );

        if (this.config.synchronizeLists === undefined) {
            this.config.synchronizeLists = true;
        }
        if (this.config.synchronizeSmartHomeDevices === undefined) {
            this.config.synchronizeSmartHomeDevices = true;
        }

        let connectAfterDisconnect = false;

        // alexa-remote2 declares some members the adapter uses not in its typings (see AlexaRemoteInstance)
        this.alexa = new AlexaRemote() as AlexaRemoteInstance;

        // Count the Smart Home device calls (see checkerInterval below)
        const origSHDQueryFunc = this.alexa.querySmarthomeDevices.bind(this.alexa);
        this.alexa.querySmarthomeDevices = (toQuery, entityType, maxTimeout, callback): void => {
            // Entries may be plain ids (strings) too: then entityId is undefined and the call counts as 'get'
            (toQuery as { entityId?: string }[]).forEach(q => {
                if (q.entityId && q.entityId.startsWith('SKILL')) {
                    this.shdCounters.getSkill++;
                } else {
                    this.shdCounters.get++;
                }
            });
            origSHDQueryFunc(toQuery, entityType, maxTimeout, callback);
        };
        const origSHDExecFunc = this.alexa.executeSmarthomeDeviceAction.bind(this.alexa);
        this.alexa.executeSmarthomeDeviceAction = (entityIds, parameters, entityType, callback): void => {
            // alexa-remote2 also accepts a single entity id (not declared in the typings)
            if (!Array.isArray(entityIds)) {
                entityIds = [entityIds];
            }
            entityIds.forEach(id => {
                if (id.startsWith('SKILL')) {
                    this.shdCounters.setSkill++;
                } else {
                    this.shdCounters.set++;
                }
            });
            origSHDExecFunc(entityIds, parameters, entityType, callback);
        };

        this.alexa.on('ws-connect', () => {
            if (this.initDone && connectAfterDisconnect) {
                this.scheduleHistoryUpdate(2000);
                this.scheduleStatesUpdate(2000);
            }
            connectAfterDisconnect = false;
            this.pushConnected = true;
            this.log.info(`Alexa-Push-Connection (macDms = ${!!options.macDms}) established. Disable Polling`);
        });

        this.alexa.on('ws-disconnect', (retries: boolean, msg: string) => {
            this.log.info(
                `Alexa-Push-Connection disconnected${retries ? ' - retry' : ' - fallback to poll data'}: ${msg}`,
            );
            if (this.initDone && this.pushConnected) {
                this.scheduleHistoryUpdate(2000);
                this.scheduleStatesUpdate(2000);
            }
            if (this.pushConnected) {
                connectAfterDisconnect = true;
                this.pushConnected = false;
            }
        });

        this.alexa.on('ws-error', (error: Error | undefined) => {
            this.log.info(
                `Alexa-Push-Connection Error: ${error && error.message ? error.message : (error as unknown as string)}`,
            );
        });

        this.alexa.on('ws-unknown-message', (incomingMsg: unknown) => {
            this.log.info(`Alexa-Push-Connection Unknown Message - send to Developer: ${incomingMsg as string}`);
        });

        this.alexa.on('ws-device-connection-change', (data: WsDeviceConnectionChangePayload) => {
            this.log.debug(
                `Alexa-Push-Connection Device Connection change for ${data.deviceSerialNumber} -> ${data.connectionState}`,
            );
            const device = this.findDevice(data.deviceSerialNumber);
            if (!device && !this.appDevices[data.deviceSerialNumber]) {
                this.log.debug(`Please Restart Adapter. Non-Existing Device was returned: ${data.deviceSerialNumber}`);
                return;
            }
            if (!device) {
                return;
            }

            const devId = `Echo-Devices.${device.serialNumber}`;
            void this.setState(`${devId}.online`, data.connectionState === 'ONLINE', true);
        });

        this.alexa.on('ws-bluetooth-state-change', (data: WsBluetoothStateChangePayload) => {
            this.log.debug(
                `Alexa-Push-Connection Bluetooth State change for ${data.deviceSerialNumber} -> ${data.bluetoothEvent}`,
            );
            const device = this.findDevice(data.deviceSerialNumber);
            if (!device && !this.appDevices[data.deviceSerialNumber]) {
                //adapter.log.info('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
                return;
            }
            if (!device) {
                return;
            }

            this.updateBluetoothStatus(device);
        });

        this.alexa.on('ws-audio-player-state-change', (data: WsAudioPlayerStateChangePayload) => {
            this.log.debug(
                `Alexa-Push-Connection Audio Player State change for ${data.deviceSerialNumber} -> ${data.audioPlayerState}`,
            );
            const device = this.findDevice(data.deviceSerialNumber);
            if (!device && !this.appDevices[data.deviceSerialNumber]) {
                //adapter.log.info('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
                return;
            }
            if (!device) {
                return;
            }

            const lastState = this.lastPlayerState[device.serialNumber];
            if (data.audioPlayerState === 'INTERRUPTED' && lastState && lastState.timeout) {
                this.clearTimeout(lastState.timeout);
                lastState.timeout = null;
            }

            if (lastState && lastState.resPlayer && lastState.resPlayer.playerInfo) {
                lastState.resPlayer.playerInfo.state = data.audioPlayerState;
            }
            const devId = `Echo-Devices.${device.serialNumber}`;
            void this.setState(
                `${devId}.Player.controlPause`,
                data.audioPlayerState !== 'PLAYING' && data.audioPlayerState !== 'FINISHED',
                true,
            );
            void this.setState(`${devId}.Player.controlPlay`, data.audioPlayerState === 'PLAYING', true);
            this.playingDevices[device.serialNumber] = data.audioPlayerState === 'PLAYING';
            void this.setState(`${devId}.Player.currentState`, data.audioPlayerState === 'PLAYING', true);

            this.schedulePlayerUpdate(device.serialNumber, 1000);
        });

        this.alexa.on('ws-media-queue-change', (data: WsMediaQueueChangePayload) => {
            this.log.debug(
                `Alexa-Push-Connection Media Queue change for ${data.deviceSerialNumber} -> ${data.changeType}`,
            );
            const device = this.findDevice(data.deviceSerialNumber);
            if (!device && !this.appDevices[data.deviceSerialNumber]) {
                //adapter.log.info('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
                return;
            }
            if (!device) {
                return;
            }

            this.schedulePlayerUpdate(device.serialNumber, 1000);
        });

        this.alexa.on('ws-media-change', (data: WsMediaChangePayload) => {
            this.log.debug(`Alexa-Push-Connection Media change for ${data.deviceSerialNumber}`);
            const device = this.findDevice(data.deviceSerialNumber);
            if (!device) {
                //adapter.log.debug('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
                return;
            }
            if (!device) {
                return;
            }

            this.schedulePlayerUpdate(device.serialNumber, 1000);
        });

        this.alexa.on('ws-media-progress-change', (data: WsMediaChangePayload) => {
            this.log.debug(`Alexa-Push-Connection Media Progress change for ${data.deviceSerialNumber}`);
            const device = this.findDevice(data.deviceSerialNumber);
            if (!device && !this.appDevices[data.deviceSerialNumber]) {
                //adapter.log.info('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
                return;
            }
            if (!device) {
                return;
            }

            this.schedulePlayerUpdate(device.serialNumber, 1000);
        });

        this.alexa.on('ws-volume-change', (data: WsVolumeChangePayload) => {
            this.log.debug(
                `Alexa-Push-Connection Device Volume change for ${data.deviceSerialNumber} -> ${data.volume}/${data.isMuted}`,
            );
            const device = this.findDevice(data.deviceSerialNumber);
            if (!device && !this.appDevices[data.deviceSerialNumber]) {
                //adapter.log.info('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
                return;
            }
            if (!device) {
                return;
            }
            if (!device.isControllable || !device.capabilities.includes('VOLUME_SETTING')) {
                return;
            }

            const devId = `Echo-Devices.${device.serialNumber}`;
            let muted = !!data.isMuted;
            if (data.isMuted === null && data.volume === 0) {
                muted = true;
            }
            if (!muted) {
                void this.setState(`${devId}.Player.volume`, data.volume, true);
            }
            void this.setState(`${devId}.Player.muted`, muted, true);

            //schedulePlayerUpdate(device.serialNumber, 15000, true);
        });

        this.alexa.on('ws-content-focus-change', (data: WsContentFocusChangePayload) => {
            this.log.debug(`Alexa-Push-Connection Content Focus change for ${data.deviceSerialNumber}`);
            const device = this.findDevice(data.deviceSerialNumber);
            if (!device && !this.appDevices[data.deviceSerialNumber]) {
                //adapter.log.info('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
                return;
            }
            if (!device) {
                return;
            }

            this.schedulePlayerUpdate(device.serialNumber, 1000);
        });

        this.alexa.on('ws-device-activity', (activity: WsDeviceActivityPayload) => {
            this.log.debug(`device-activity: ${JSON.stringify(activity)}`);
            if (
                activity.description.summary &&
                this.routineTriggerUtterances &&
                this.routineTriggerUtterances[activity.deviceSerialNumber] &&
                this.routineTriggerUtterances[activity.deviceSerialNumber][activity.description.summary.toLowerCase()]
            ) {
                void this.setState(
                    this.routineTriggerUtterances[activity.deviceSerialNumber][
                        activity.description.summary.toLowerCase()
                    ],
                    true,
                    true,
                );
            }
            this.updateHistoryStates(activity);
        });

        this.alexa.on('ws-equilizer-state-change', (data: WsEqualizerStateChangePayload) => {
            this.log.debug(
                `Alexa-Push-Connection Equalizer change for ${data.deviceSerialNumber} -> ${data.bass}/${data.midrange}/${data.treble}`,
            );
            const device = this.findDevice(data.deviceSerialNumber);
            if (!device && !this.appDevices[data.deviceSerialNumber]) {
                //adapter.log.info('Please Restart Adapter. Non-Existing Device was returned: ' + data.deviceSerialNumber);
                return;
            }
            if (!device) {
                return;
            }

            const devId = `Echo-Devices.${device.serialNumber}`;
            if (device.capabilities.includes('EQUALIZER_CONTROLLER_BASS')) {
                void this.setState(`${devId}.Preferences.equalizerBass`, data.bass, true);
            }
            if (device.capabilities.includes('EQUALIZER_CONTROLLER_MIDRANGE')) {
                void this.setState(`${devId}.Preferences.equalizerMidRange`, data.midrange, true);
            }
            if (device.capabilities.includes('EQUALIZER_CONTROLLER_TREBLE')) {
                void this.setState(`${devId}.Preferences.equalizerTreble`, data.treble, true);
            }
        });

        this.alexa.on('ws-unknown-command', (command: string, payload: unknown) => {
            this.log.info(
                `Alexa-Push-Connection Unknown Command ${command} - send to Developer: ${JSON.stringify(payload)}`,
            );
        });

        const listsInProgress: Record<string, boolean> = {};
        this.alexa.on('ws-todo-change', (payload: WsTodoChangePayload) => {
            if (!this.config.synchronizeLists) {
                return;
            }
            this.log.debug(`Received updated list (${listsInProgress[payload.listId]}): ${JSON.stringify(payload)}`);

            if (listsInProgress[payload.listId]) {
                return;
            }
            listsInProgress[payload.listId] = true;

            if (payload.eventType === 'listCreated' || payload.eventType === 'listUpdated') {
                this.getLists(payload.listId, () => {
                    this.processObjectQueue(() => {
                        delete listsInProgress[payload.listId];
                    });
                });
                return;
            }

            if (payload.eventType === 'listDeleted') {
                if (this.listMap[payload.listId]) {
                    const node = `Lists.${this.listMap[payload.listId]}`;
                    this.deleteObject(node);
                }
                delete listsInProgress[payload.listId];
                return;
            }

            this.alexa.getList(payload.listId, (_err, res) => {
                if (this.stopped) {
                    return;
                }
                const list = res as AlexaList | undefined;
                if (!list || typeof list !== 'object') {
                    delete listsInProgress[payload.listId];
                    return;
                }
                // modify states
                list.name = list.name || list.type;
                if (!list.name) {
                    delete listsInProgress[payload.listId];
                    return;
                }
                list.id = list.name.replace(this.FORBIDDEN_CHARS, '-').replace(/ /g, '_').replace(/\./g, '_');
                list.listId = list.itemId;
                delete list.listIds;
                delete list.itemId;

                // always update list
                void this.updateListItems(list, () => {
                    this.processObjectQueue(() => {
                        // eventType: deleted
                        if (payload.eventType === 'itemDeleted') {
                            // delete objects
                            const node = `Lists.${list.id}.items.${payload.listItemId}`;
                            /*adapter.getObjectList({startkey: node, endkey: node + '.香'}, (err, objects) => {

                                adapter.log.debug('Object list for delete for ' + node + '* : ' + JSON.stringify(objects));
                                if (objects && objects.rows) {
                                    objects.rows.forEach(object => deleteObject(object.id));
                                }
                                delete listsInProgress[payload.listId];
                            });*/
                            this.deleteObject(node);
                        }
                        delete listsInProgress[payload.listId];
                    });
                });
            });
        });

        this.alexa.on('ws-notification-change', (data: WsNotificationChangePayload) => {
            this.log.debug(`notification-change: ${JSON.stringify(data)}`);
            if (data.eventType === 'DELETE') {
                const device = this.findDevice(data.deviceSerialNumber);
                if (device && device.notifications) {
                    for (let i = 0; i < device.notifications.length; i++) {
                        if (this.notificationTimer[data.notificationId]) {
                            this.clearTimeout(this.notificationTimer[data.notificationId]);
                            this.notificationTimer[data.notificationId] = null;
                        }
                        if (this.notificationTimer[`${data.notificationId}-customVolume`]) {
                            this.clearTimeout(this.notificationTimer[`${data.notificationId}-customVolume`]);
                            this.notificationTimer[`${data.notificationId}-customVolume`] = null;
                        }
                        if (this.notificationTimer[`${data.notificationId}-customVolumeReset`]) {
                            this.clearTimeout(this.notificationTimer[`${data.notificationId}-customVolumeReset`]);
                            this.notificationTimer[`${data.notificationId}-customVolumeReset`] = null;
                        }
                        if (device.notifications[i].notificationIndex === data.notificationId) {
                            if (this.notificationTimer[device.notifications[i].id]) {
                                // Remove Timer, will be reset if neeed in 2s
                                this.clearTimeout(this.notificationTimer[device.notifications[i].id]);
                                this.notificationTimer[device.notifications[i].id] = null;
                            }
                            if (this.notificationTimer[`${device.notifications[i].id}-customVolume`]) {
                                // Remove Timer, will be reset if neeed in 2s
                                this.clearTimeout(this.notificationTimer[`${device.notifications[i].id}-customVolume`]);
                                this.notificationTimer[`${device.notifications[i].id}-customVolume`] = null;
                            }
                            if (this.notificationTimer[`${device.notifications[i].id}-customVolumeReset`]) {
                                // Remove Timer, will be reset if neeed in 2s
                                this.clearTimeout(
                                    this.notificationTimer[`${device.notifications[i].id}-customVolumeReset`],
                                );
                                this.notificationTimer[`${device.notifications[i].id}-customVolumeReset`] = null;
                            }
                            let type = device.notifications[i].type;
                            if (type === 'MusicAlarm') {
                                type = 'Alarm';
                            }
                            if (
                                this.adapterObjects[
                                    `Echo-Devices.${data.deviceSerialNumber}.${type}.${data.notificationId}`
                                ]
                            ) {
                                if (this.rememberedNotificationVolumeRestoreCallbacks[device.serialNumber]) {
                                    const callback =
                                        this.rememberedNotificationVolumeRestoreCallbacks[device.serialNumber];
                                    delete this.rememberedNotificationVolumeRestoreCallbacks[device.serialNumber];
                                    callback();
                                }
                                this.deleteObject(
                                    `Echo-Devices.${data.deviceSerialNumber}.${type}.${data.notificationId}`,
                                );
                            }
                            break;
                        }
                    }
                }
            }
            this.scheduleNotificationUpdate(data.deviceSerialNumber, 2000, true);
        });

        this.alexa.on('cookie', (cookie: string | undefined, _csrf: string | undefined, macDms: MacDms | undefined) => {
            void this.setState('info.cookie', this.alexa.cookie!, true);
            void this.setState('info.csrf', this.alexa.csrf!, true);

            if (cookie !== this.config.cookie) {
                this.log.info('Update cookie in adapter configuration ... restarting ...');
                void this.extendForeignObject(`system.adapter.${this.namespace}`, {
                    native: {
                        cookie: this.alexa.cookie,
                        csrf: this.alexa.csrf,
                        macDms: macDms,
                        cookieData: this.alexa.cookieData,
                        email: '',
                        password: '',
                        resetCookies: false,
                    },
                });
            }
        });

        this.alexa.init(options as unknown as InitOptions, err => {
            if (err) {
                this.log.debug(`Error from Alexa init: ${err.message}`);
                let restartAdapter = true;
                if (err.message === 'no csrf found') {
                    this.log.error('Error: no csrf found. Check configuration of cookie');
                    restartAdapter = false;
                }
                let lines = err.message.split('Please open ');
                if (lines[1]) {
                    lines[1] = `Please open ${lines[1]}`;
                    this.proxyUrl = lines[1].substring(lines[1].indexOf('http://'), lines[1].lastIndexOf('/') + 1);
                    restartAdapter = false;
                } else {
                    lines = err.message.split('\n');
                }
                lines.forEach(line => this.log.error(`Error: ${line}`));

                void this.setState('info.connection', false, true);

                if (!this.initDone && restartAdapter) {
                    this.terminate(utils.EXIT_CODES.START_IMMEDIATELY_AFTER_STOP);
                }
                return;
            }

            if (this.alexa.cookie !== this.config.cookie) {
                return;
            }

            void this.setState('info.connection', true, true);

            this.alexa.getMusicProviders((err, providers) => {
                this.musicProviders = [];
                if (!err && providers) {
                    this.musicProviders = providers as AmazonJson[];
                }

                this.initRoutines(() => {
                    this.getLists(() => {
                        this.alexa.getAllDeviceVolumes((err, volumesRes) => {
                            const deviceVolumes = volumesRes as AllDeviceVolumesResponse | undefined;
                            if (!err && deviceVolumes && deviceVolumes.volumes) {
                                deviceVolumes.volumes.forEach(vol => {
                                    this.initialDeviceVolumes[vol.dsn] = vol;
                                });
                            }
                            this.alexa.getRoutineSoundList((err, soundRes) => {
                                const soundList = soundRes as RoutineSoundEntry[] | undefined;
                                const routineSounds: Record<string, string> = {};
                                this.routineSounds = routineSounds;
                                if (!err && soundList && Array.isArray(soundList)) {
                                    soundList.forEach(sound => {
                                        if (sound.availability !== 'AVAILABLE') {
                                            return;
                                        }
                                        routineSounds[sound.id] = sound.displayName;
                                    });
                                }
                                this.alexa.getRoutineSkillCatalog('YourSkills', (err, catalogRes) => {
                                    const skillCatalog = catalogRes as RoutineSkillCatalogResponse | undefined;
                                    const routineSkills: Record<string, string> = {};
                                    this.routineSkills = routineSkills;
                                    if (
                                        !err &&
                                        skillCatalog &&
                                        skillCatalog.catalog &&
                                        skillCatalog.catalog.catalogItems &&
                                        Array.isArray(skillCatalog.catalog.catalogItems)
                                    ) {
                                        skillCatalog.catalog.catalogItems.forEach(skill => {
                                            if (
                                                skill.itemType !== 'entry' ||
                                                skill.disabled ||
                                                skill.catalogType !== 'action'
                                            ) {
                                                return;
                                            }
                                            routineSkills[skill.catalogId] = skill.title;
                                        });
                                    }

                                    this.log.info('Initialize all Device states ...');
                                    this.createStates(() => {
                                        this.createSmarthomeStates(() => {
                                            this.queryAllSmartHomeDevices(true, false, () => {
                                                this.initCommUsers(() => {
                                                    if (!this.initDone) {
                                                        this.log.info('Subscribing to states...');
                                                        this.subscribeStates('*');
                                                        this.subscribeObjects('*');
                                                        this.initDone = true;

                                                        this.updateHistory(() => {
                                                            this.updateDeviceConfigurationStates(() => {
                                                                if (this.config.usePushConnection) {
                                                                    this.alexa.initPushConnection();
                                                                }
                                                                this.updatePlayerStatus(() => {
                                                                    this.log.info('Initialization Done ...');
                                                                    this.scheduleStatesUpdate();

                                                                    if (USE_CRASH_CHECK) {
                                                                        this.resetCrashCheckerTimeout = this.setTimeout(
                                                                            () => {
                                                                                try {
                                                                                    unlinkSync(this.crashCheckFileName);
                                                                                } catch (err) {
                                                                                    this.log.error(
                                                                                        `Error deleting crashCheck file: ${(err as Error).message}`,
                                                                                    );
                                                                                }
                                                                            },
                                                                            10 * 60 * 1000,
                                                                        );
                                                                    }
                                                                });
                                                            });
                                                        });
                                                        const delIds = Object.keys(this.existingStates);
                                                        if (delIds.length) {
                                                            this.log.info(
                                                                `Deleting the following states: ${JSON.stringify(delIds)}`,
                                                            );
                                                            for (let i = 0; i < delIds.length; i++) {
                                                                /*if (delIds[i].startsWith('Smart-Home-Devices.') && !delIds[i].endsWith('.#includeInIntervalQuery')) continue;*/ // TODO Do not cleanup for now, change later
                                                                try {
                                                                    this.delObject(delIds[i], err => {
                                                                        if (err) {
                                                                            this.log.info(
                                                                                `Can not delete object ${delIds[i]}: ${err.message}`,
                                                                            );
                                                                        }
                                                                    });
                                                                } catch (err) {
                                                                    this.log.info(
                                                                        `Can not delete object ${delIds[i]}: ${(err as Error).message}`,
                                                                    );
                                                                }
                                                                delete this.existingStates[delIds[i]];
                                                            }
                                                        }
                                                        this.checkerInterval = this.setInterval(
                                                            () => {
                                                                const shdCounters = this.shdCounters;
                                                                const counterKeys = Object.keys(
                                                                    shdCounters,
                                                                ) as (keyof typeof shdCounters)[];
                                                                let allCalls = 0;
                                                                let allSkills = 0;
                                                                this.log.debug(
                                                                    `shdCounters: ${JSON.stringify(shdCounters)}`,
                                                                );
                                                                counterKeys.forEach(key => {
                                                                    allCalls += shdCounters[key];
                                                                    if (key.endsWith('Skill')) {
                                                                        allSkills += shdCounters[key];
                                                                    }
                                                                });
                                                                if (allCalls > 1000 || allSkills > 500) {
                                                                    this.log.error(
                                                                        `Too many calls for Smart-Home-Devices in the last hour: ${allCalls} (via Skills: ${allSkills})`,
                                                                    );
                                                                    this.log.error(
                                                                        'The Alexa2 Smart Home devices are NOT designed to make mass calls and generate costs at the Skill developer for each call!',
                                                                    );
                                                                    this.log.error(
                                                                        'The Alexa2 Adapter will be deactivated now to prevent issues for your Amazon account, other ioBroker users of the adapter and also the Skill developers because of these mass calls.',
                                                                    );
                                                                    this.log.error(
                                                                        'Please contact iobroker@fischer-ka.de to find the reason for this behaviour of your installation!',
                                                                    );
                                                                    const sentry = this.Sentry;
                                                                    sentry?.withScope(scope => {
                                                                        scope.setLevel('info');
                                                                        scope.setExtra(
                                                                            'requestCounters',
                                                                            `${JSON.stringify(shdCounters)}`,
                                                                        );
                                                                        sentry.captureMessage(
                                                                            `Too many SHD requests ${this.installationUuid}`,
                                                                            'info',
                                                                        );
                                                                    });

                                                                    this.setTimeout(() => void this.disable(), 2000);
                                                                }
                                                                counterKeys.forEach(key => (shdCounters[key] = 0));
                                                            },
                                                            60 * 60 * 1000,
                                                        );
                                                    }
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Alexa2Adapter(options);
} else {
    // otherwise start the instance directly
    (() => new Alexa2Adapter())();
}
