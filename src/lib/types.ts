import type AlexaRemote from 'alexa-remote2';
import type { MultiSequenceCommand, Serial, SequenceType } from 'alexa-remote2';

/** Private key data of the registered "app device", stored in native.macDms */
export interface MacDms {
    device_private_key: string;
    adp_token: string;
}

/** Registration data from alexa-cookie2, stored in native.cookieData */
export interface AlexaCookieData {
    tokenDate?: number;
    macDms?: MacDms;
    localCookie?: string;
    csrf?: string;
    [key: string]: unknown;
}

/** Callback used by alexa-remote2 for nearly all API calls. The body is undocumented Amazon JSON. */
export type AlexaCallback = (err?: Error | null, res?: unknown) => void;

/**
 * Undocumented, unversioned JSON returned by the Amazon APIs (deeper levels of a response).
 * Amazon changes these structures without notice, so they are only typed where the adapter relies on a field.
 */
export type AmazonJson = Record<string, any>;

/** Last known player state of a device, used to calculate the media progress locally */
export interface LastPlayerState {
    /** Response of alexa.getPlayerInfo() */
    resPlayer: AmazonJson;
    /** Response of alexa.getMedia() */
    resMedia?: AmazonJson;
    ts: number;
    devId: string;
    timeout: ioBroker.Timeout | null | undefined;
}

/** Restores the notification volume of a device after a notification with custom volume was played */
export type NotificationVolumeRestoreCallback = (notiId?: string, noti?: AmazonJson, volumeToRestore?: number) => void;

/**
 * Object definition as handed over to setOrUpdateObject().
 * type/common/native are completed with defaults there, so everything is optional.
 */
export interface AdapterObjectDefinition {
    type?: ioBroker.ObjectType;
    common?: Partial<ioBroker.StateCommon> & { [key: string]: any };
    native?: Record<string, any>;
    /** Only used while creating: forwarded as `preserve` option to extendObject() */
    preserveSettings?: ioBroker.ExtendObjectOptionsPreserve;
    /** Present on objects read from the database */
    from?: string;
    ts?: number;
    acl?: unknown;
    _id?: string;
}

/** Function that is called when a writable state was changed by the user (ack=false) */
export type StateChangeCallback = (value: any) => void;

export interface ObjectQueueEntry {
    id: string;
    value: ioBroker.StateValue | undefined;
    /** null when the object is unchanged and only the value has to be written */
    obj: AdapterObjectDefinition | null;
    stateChangeCallback: StateChangeCallback | undefined;
    preserveSettings: ioBroker.ExtendObjectOptionsPreserve | undefined;
}

/** Entry of KNOWN_DEVICE_TYPES */
export interface KnownDeviceType {
    name: string;
    commandSupport: boolean;
    icon?: string;
}

/** Definition of a command/control state (Player controls, Commands, FireTV commands, ...) */
export interface ControlDefinition {
    /** Command sent to Amazon, defaults to the state name */
    command?: string;
    val: ioBroker.StateValue;
    common: Partial<ioBroker.StateCommon>;
}

/** Definition of a list (or list item) state */
export interface ListStateDefinition {
    type: ioBroker.CommonType;
    role: string;
    write?: boolean;
}

/**
 * Device object as maintained by alexa-remote2 in `alexa.serialNumbers`.
 * alexa-remote2 types it as `Serial` only, but enriches every device with these fields and bound methods.
 */
export interface AlexaDevice extends Serial {
    _name: string;
    clusterMembers: string[];
    parentClusters: string[];
    parentDeviceSerialNumber?: string;
    deviceTypeDetails?: KnownDeviceType;
    preferences?: Record<string, any>;
    notifications?: Record<string, any>[];
    bluetoothState?: Record<string, any>;
    /** Set by this adapter for app devices: serial number of the device that owns the app device */
    ownerDevice?: string;

    sendCommand(command: string, value: unknown, callback?: AlexaCallback): void;
    setTunein(guideId: string, contentType: string, callback?: AlexaCallback): void;
    playAudible(searchPhrase: string, callback?: AlexaCallback): void;
    rename(newName: string, callback?: AlexaCallback): void;
    setDoNotDisturb(enabled: boolean, callback?: AlexaCallback): void;
    delete(callback?: AlexaCallback): void;
    getDevicePreferences(callback: AlexaCallback): void;
    setDevicePreferences(preferences: Record<string, unknown>, callback?: AlexaCallback): void;
    getNotificationSounds(alertType: string, callback: AlexaCallback): void;
    getDeviceNotificationState(callback: AlexaCallback): void;
    setDeviceNotificationVolume(volume: number, callback?: AlexaCallback): void;
    setDeviceAscendingAlarmState(ascendingAlarmEnabled: boolean, callback?: AlexaCallback): void;
    getDeviceNotificationDefaultSound(notificationType: string, callback: AlexaCallback): void;
    setDeviceNotificationDefaultSound(notificationType: string, soundId: string, callback?: AlexaCallback): void;
}

/** Minimal interface of the Sentry object handed out by the sentry plugin */
export interface SentryScope {
    setLevel(level: string): void;
    setExtra(key: string, value: unknown): void;
}
export interface SentryLike {
    withScope(callback: (scope: SentryScope) => void): void;
    captureMessage(message: string, level?: string): void;
}

/** alexa-remote2 instance incl. members it has, but does not declare in its typings */
export type AlexaRemoteInstance = AlexaRemote & {
    ownerCustomerId: string;
    commsId?: string;
    _options: Record<string, any>;
};

// ---- types of part A ----
/** Payload of the "sendSequenceCommand" message (sendTo) */
export interface SequenceCommandMessage {
    sequenceNodes?: MultiSequenceCommand[];
    deviceSerialNumber?: string | string[];
    sequenceType?: SequenceType;
}

/** Response of alexa.getEqualizerEnabled() */
export interface EqualizerEnabledResponse {
    enabled?: boolean;
}

/** Response of alexa.getEqualizerRange() */
export interface EqualizerRangeResponse {
    min?: number;
    max?: number;
}

/** Response of alexa.getEqualizerSettings() / alexa.setEqualizerSettings() */
export interface EqualizerSettingsResponse {
    bass?: number;
    mid?: number;
    treble?: number;
}

/** Port entry of alexa.getAuxControllerState() */
export interface AuxControllerPort {
    id: string;
    direction?: string;
}

/** Response of alexa.getAuxControllerState() */
export interface AuxControllerStateResponse {
    ports?: AuxControllerPort[];
}

/** Response of alexa.getDoNotDisturb() */
export interface DoNotDisturbResponse {
    doNotDisturbDeviceStatusList?: { deviceSerialNumber: string; enabled: boolean }[];
}

/** Entry of alexa.getDevicePreferences() (stored completely in device.preferences) */
export interface DevicePreferencesEntry {
    deviceSerialNumber?: string;
    notificationEarconEnabled?: boolean;
    [key: string]: any;
}

/** Response of alexa.getDevicePreferences() without a device */
export interface DevicePreferencesResponse {
    devicePreferences?: DevicePreferencesEntry[];
}

// ---- types of part B ----
/** Property of a smart home appliance that is queried (namespace = capability interfaceName) */
export interface ShQueryProperty {
    namespace: string;
    name: string;
    instance?: string;
}

/** Entry of the request array for alexa.querySmarthomeDevices() (compatible with SmartHomeDeviceQueryEntry) */
export interface ShQueryRequestEntry {
    entityId: string;
    entityType: 'APPLIANCE' | 'ENTITY';
    /** undefined = query all properties */
    properties?: ShQueryProperty[];
}

/** Values of shApplianceEntityMap (key: main appliance id) */
export interface ShApplianceEntityInfo {
    entityId: string;
    readable: boolean;
    /** Result of `capabilitiesCloudReadable || cap.properties.proactivelyReported`, so null/undefined are possible */
    cloudReadable: boolean | null | undefined;
    /** As delivered by Amazon (may be missing) */
    mergedApplianceIds?: string[] | null;
    supportedProperties: ShQueryProperty[];
}

/**
 * State definition stored for a group parameter. Same structure as ShStateDefinition from ./smarthomedevices
 * (not imported here to keep types.ts free of imports from other modules), but with `common.name` typed as
 * plain string - all smart home definitions use plain string names.
 */
export interface ShGroupParameterDefinition {
    common: Partial<ioBroker.StateCommon> & { name: string; [key: string]: any };
    native: Record<string, any>;
}

/** Values of shGroupDetails (key: group identifier, e.g. "amzn1.HomeAutomation.ApplianceGroup....") */
export interface ShGroupDetails {
    /** applianceId -> true */
    applianceIds: Record<string, boolean>;
    /** entityId -> true */
    entityIds: Record<string, boolean>;
    /** state name -> state definition of a device in this group */
    parameters: Record<string, ShGroupParameterDefinition>;
}

/** Values of shDeviceParamControlValues (key: "<entityId>.<stateName>"): last control of a smart home parameter */
export interface ShDeviceParamControlValue {
    value: ioBroker.StateValue;
    ts: number;
    counter: number;
}

/**
 * Smart home state definition (ShStateDefinition) as used in main.ts: `common.name` typed as plain string and
 * the `experimental` flag of the definitions (deleted from the copy before it is passed to setOrUpdateObject())
 */
export interface ShStateDefinitionEx extends ShGroupParameterDefinition {
    experimental?: boolean;
}

/** Parameters for alexa.executeSmarthomeDeviceAction(), built by buildSmartHomeControlParameters() */
export interface ShControlParameters {
    action?: string;
    instance?: string;
    /** Further parameters or sub structures (see native.sendInSubStructureOf) */
    [key: string]: any;
}

/** Response of alexa.querySmarthomeDevices() and alexa.executeSmarthomeDeviceAction() (fields used here) */
export interface ShDeviceStatesResponse {
    deviceStates?: {
        entity?: { entityId?: string };
        /** JSON strings, each one a capability state (namespace, name, value, instance, timeOfSample) */
        capabilityStates?: string[];
    }[];
    errors?: {
        entity?: { entityId?: string };
        code?: string;
    }[];
    controlResponses?: { code?: string }[];
}

/** Entry of the response of alexa.getSmarthomeEntities() */
export interface ShBehaviourEntity {
    id: string;
    supportedOperations?: string[];
    [key: string]: unknown;
}

/**
 * alexa-remote2 smart home methods as they are implemented and called by this adapter. The typings of
 * alexa-remote2 declare callback and entityType as mandatory and parameters as string[], which is not correct.
 */
export interface ShAlexaRemoteApi {
    executeSmarthomeDeviceAction(
        entityIds: string | string[],
        parameters: ShControlParameters,
        callback: AlexaCallback,
    ): void;
    executeSmarthomeDeviceAction(
        entityIds: string | string[],
        parameters: ShControlParameters,
        entityType: 'APPLIANCE' | 'GROUP',
        callback: AlexaCallback,
    ): void;
    setEnablementForSmarthomeDevice(smarthomeDevice: string, enabled: boolean, callback?: AlexaCallback): void;
    deleteSmarthomeDevice(smarthomeDevice: string, callback?: AlexaCallback): void;
    deleteSmarthomeGroup(smarthomeGroup: string, callback?: AlexaCallback): void;
}

// ---- types of part C ----
// ---------------------------------------------------------------------------------------------------------------------
// Part C: history, multiroom iteration, creation of the device states
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Notification sound as returned by device.getNotificationSounds() (fields used in createStatesForDevice() are
 * required here). Assignable to NotificationSoundDefinition of part D (type of device.alarmNotificationSounds).
 */
export interface NotificationSoundEntry {
    id: string;
    displayName: string;
    providerId: string;
    folder: string;
    /** Set by the adapter for non-ECHO sounds: original Amazon id (`id` is then `<folder>-<origId>`) */
    origId?: string;
    [key: string]: unknown;
}

/** Response of device.getNotificationSounds() */
export interface NotificationSoundsResponse {
    notificationSounds?: NotificationSoundEntry[];
}

/** Response of device.getDeviceNotificationState() (only the used field) */
export interface DeviceNotificationStateResponse {
    volumeLevel?: number;
}

/** Response of device.getDeviceNotificationDefaultSound() (only the used field) */
export interface DeviceNotificationDefaultSoundResponse {
    defaultNotificationSound?: NotificationSoundEntry;
}

/** Response of alexa.getAscendingAlarmState() (only the used fields) */
export interface AscendingAlarmStatesResponse {
    ascendingAlarmModelList?: {
        serialNumber?: string;
        deviceSerialNumber: string;
        ascendingAlarmEnabled: boolean;
    }[];
}

/** Response of alexa.tuneinSearch() (only the used fields) */
export interface TuneinSearchResponse {
    browseList?: {
        id: string;
        contentType: string;
        name: string;
    }[];
}

/** Content of the state History.json */
export interface HistoryJson {
    name: string;
    serialNumber: string;
    summary: string;
    creationTime: number;
    status: string | undefined;
    domainApplicationId: string;
    domainApplicationName: string;
    cardContent: string;
    /** '' or the card object of the (deprecated) domainAttributes */
    card: string | AmazonJson;
    answerText: string;
    utteranceType: string;
    domain: string;
    intent: string;
}

/** Value of a sequence command: notifications are sent as title/text object */
export type SequenceCommandValue = ioBroker.StateValue | { title: string | undefined; text: string };

/** Single command node of a (multi) sequence command as built by the adapter */
export interface SequenceCommandNode {
    command: string;
    value: SequenceCommandValue;
    /** Serial number of the device */
    device?: string;
}

/**
 * Group of sequence command nodes as built by the adapter.
 * Note: the alexa-remote2 typings name this field `sequencetype`, the library (and the adapter) use `sequenceType`.
 */
export interface SequenceCommandGroup {
    sequenceType: 'SerialNode' | 'ParallelNode';
    nodes: SequenceCommandEntry[];
}

export type SequenceCommandEntry = SequenceCommandNode | SequenceCommandGroup;

/** Called by iterateMultiroom() for every member of a multiroom group (or the device itself) */
export type MultiroomCommandCallback = (iteratorDevice: AlexaDevice, nextCallback?: () => void) => void;

/**
 * Fields part C stores on the alexa-remote2 device objects (interface merging with AlexaDevice).
 * `ignore`, `alarmNotificationSounds` and `alarmNotificationSoundsStateList` are declared by part D (D.types.ts.txt)
 * and are therefore not repeated here.
 */
export interface AlexaDevice {
    /** Volume used for speak/announcement/ssml commands, set via Commands.speak-volume */
    speakVolume?: number;
    timerNotificationSounds?: NotificationSoundEntry[];
    timerNotificationSoundsStateList?: Record<string, string>;
}

/**
 * Signatures of alexa-remote2 methods as the adapter calls them.
 * The library typings require callbacks that are optional in the implementation, restrict commands to string unions
 * the adapter does not use (FireTV/skill/sound commands are passed dynamically), and know neither the `filter`
 * option of getCustomerHistoryRecords() nor routine objects for executeAutomationRoutine().
 * Callbacks are intentionally NOT added at the call sites, because e.g. sendCommand('volume') calls the callback
 * without checking it.
 * Needs a `declare module 'alexa-remote2'` block with `export default interface AlexaRemote` (see notes of part C).
 */
declare module 'alexa-remote2' {
    // `export default` is required: a plain `interface AlexaRemote` does NOT merge with the default exported class
    export default interface AlexaRemote {
        getCustomerHistoryRecords(
            options: { maxRecordSize?: number; filter?: boolean; startTime?: number; endTime?: number },
            callback: AlexaCallback,
        ): void;
        sendCommand(serialOrName: SerialOrName, command: string, value: unknown, callback?: AlexaCallback): void;
        sendSequenceCommand(
            serialOrName: SerialOrNameOrArray,
            command: string,
            value: unknown,
            overrideCustomerId?: string | AlexaCallback,
            callback?: AlexaCallback,
        ): void;
        sendMultiSequenceCommand(
            serialOrName: SerialOrNameOrArray,
            commands: SequenceCommandEntry[],
            sequenceType?: 'SerialNode' | 'ParallelNode' | null,
            overrideCustomerId?: string,
            callback?: AlexaCallback,
        ): void;
        executeAutomationRoutine(serialOrName: SerialOrName, routine: AmazonJson, callback?: AlexaCallback): void;
        playMusicProvider(
            serialOrName: SerialOrName | null,
            providerId: string,
            searchPhrase: string,
            callback?: AlexaCallback,
        ): void;
    }
}

// ---- types of part D ----
// ---------- Part D: device/bluetooth/notification/player states ----------

/**
 * Fields the adapter (parts C and D) adds to the device objects of alexa-remote2.
 * Declared via interface merging - if part C declares the same fields, merge both into the AlexaDevice interface
 * above (merged declarations of the same property must have identical types).
 */
export interface AlexaDevice {
    /** Set for app main devices (deviceType A2IVLV5VM2W81) that are ignored by the adapter */
    ignore?: boolean;
    /** Filled in createStatesForDevice() (part C), incl. the music alarm entries with "MUSIC-" prefixed ids */
    alarmNotificationSounds?: NotificationSoundDefinition[];
    /** id -> display name, used as common.states */
    alarmNotificationSoundsStateList?: Record<string, string>;
}

/** Notification sound as returned by getNotificationSounds() (music entries additionally have origId) */
export interface NotificationSoundDefinition {
    id: string;
    displayName?: string;
    providerId?: string;
    /** Only for the "MUSIC-..." entries: original id of the music alarm */
    origId?: string;
    [key: string]: unknown;
}

/** Additional per-device data collected in createStatesForDevice() and handed over to createDeviceStates() */
export interface AdditionalDeviceData {
    notificationVolume?: number;
    ascendingAlarmState?: boolean;
    defaultAlarmNotificationSound?: { id: string; [key: string]: unknown };
    defaultTimerNotificationSound?: { id: string; [key: string]: unknown };
}

/** Response of alexa.getDeviceWifiDetails() (only the used fields) */
export interface DeviceWifiDetails {
    macAddress?: string;
    essid?: string;
}

/** Paired bluetooth device as enriched by alexa-remote2 in initBluetoothState() */
export interface BluetoothPairedDevice {
    address: string;
    friendlyName: string;
    connected: boolean;
    /** Bound by alexa-remote2: connects (true) or disconnects (false) the device */
    connect: (on: boolean, callback?: AlexaCallback) => void;
    /** Bound by alexa-remote2: unpairs the device (value is ignored) */
    unpaire: (value: unknown, callback?: AlexaCallback) => void;
}

/** rRuleData of a notification (only the used fields) */
export interface NotificationRRuleData {
    byWeekDays?: string[];
    recurrenceRules?: string[];
    nextTriggerTimes?: string[];
    notificationTimes?: string[];
    recurStartDate?: string | null;
    recurStartTime?: string | null;
    recurEndDate?: string | null;
    recurEndTime?: string | null;
}

/** Notification (Alarm, Reminder, Timer, MusicAlarm) as stored by alexa-remote2 in device.notifications */
export interface NotificationEntry {
    id: string;
    /** 'Alarm' | 'Reminder' | 'Timer' | 'MusicAlarm' (MusicAlarm is changed to Alarm by the adapter) */
    type: string;
    status?: string;
    notificationIndex: string;
    remainingTime: number;
    triggerTime?: number;
    timerLabel?: string | null;
    originalDurationInMillis?: number;
    reminderLabel?: string | null;
    originalDate?: string;
    originalTime?: string;
    recurringPattern?: string | null;
    rRuleData?: NotificationRRuleData;
    provider?: string | null;
    musicEntity?: string | null;
    musicAlarmId?: string | null;
    sound?: { id?: string; [key: string]: unknown } | null;
    /** Bound by alexa-remote2 (changeNotification) */
    set: (value: unknown, callback?: AlexaCallback) => void;
    /** Bound by alexa-remote2 (deleteNotification) */
    delete: (callback?: (err?: Error | null) => void) => void;
    /** Bound by alexa-remote2 (cancelNotification) */
    cancel: (callback?: AlexaCallback) => void;
}

/** Recurrence as handed over to alexa.createNotificationObject() */
export interface NotificationRecurrence {
    freq: string;
    byDay: string[];
    interval: number;
    [key: string]: unknown;
}

/** Entry of the state Timer.activeTimerList */
export interface NotificationActiveTimer {
    id: string;
    triggerTime: number;
    label: string | null | undefined;
    durationMillis: number | undefined;
}

/** Response of alexa.getNotifications() (only the used fields) */
export interface NotificationsResponse {
    notifications?: AmazonJson[];
}

/** Response of device.getDeviceNotificationState() (only the used fields) */
export interface DeviceNotificationState {
    volumeLevel?: number;
}

/**
 * alexa-remote2 declares createNotificationObject() with a status of type 'ON' | 'OFF', a sound id string and without
 * the 7th parameter "recurring". The implementation accepts a boolean status, a sound object and the recurrence.
 */
export interface AlexaNotificationFactory {
    createNotificationObject(
        serialOrName: string | AlexaDevice,
        type: string,
        label: string | undefined,
        value: string | number,
        status: boolean,
        sound?: string | NotificationSoundDefinition,
        recurring?: string | NotificationRecurrence,
    ): AmazonJson | null;
}

/** Player data collected in updatePlayerStatus() */
export interface PlayerStatusData {
    providerName: string;
    providerId: string;
    radioStationId: string;
    service: string;
    contentType: string;
    controlShuffle: boolean | null;
    controlRepeat: boolean | null;
    imageURL: string;
    muted: boolean | null;
    volume: number | null;
    controlPause: boolean;
    controlPlay: boolean;
    currentState: boolean;
    title: string;
    artist: string;
    album: string;
    mainArtUrl: string;
    miniArtUrl: string;
    mediaLength: number;
    mediaProgress: number;
    mediaProgressPercent: number;
    mediaId: string;
    queueId: string;
    quality: string;
    qualityCodec: string;
    qualityDataRate: number | null;
    qualitySampleRate: number | null;
    allowNext: boolean;
    allowPlayPause: boolean;
    allowPrevious: boolean;
    allowRepeat: boolean;
    allowShuffle: boolean;
    playingInGroup: boolean;
    playingInGroupId: string;
}

// ---- types of part E ----
// ---------------------------------------------------------------------------------------------------------------------
// Part E: lists, routines, communication users, main()
// ---------------------------------------------------------------------------------------------------------------------

/**
 * List as delivered by alexa.getLists()/alexa.getList() (already mapped by alexa-remote2) and modified by the adapter.
 * All non-null fields are written as states below Lists.<id>.
 */
export interface AlexaList {
    /** Set by the adapter: object id part, derived from the list name */
    id: string;
    listId?: string;
    /** Same as listId (alexa-remote2), deleted by the adapter */
    itemId?: string;
    listIds?: unknown;
    name?: string;
    type?: string;
    [key: string]: unknown;
}

/** List item as delivered by alexa.getListItems() (mapped by alexa-remote2) and enriched by the adapter */
export interface AlexaListItem {
    id: string;
    value?: string;
    completed?: boolean;
    version?: number;
    /** Set by the adapter */
    index?: number;
    /** Set by the adapter */
    '#delete'?: boolean;
    /** Set by the adapter */
    listName?: string;
    [key: string]: unknown;
}

/** Data of a new list item (written to Lists.<id>.#New): `{ value }` or the parsed JSON */
export interface AlexaListItemInput {
    value?: unknown;
    [key: string]: unknown;
}

/** Trigger of an automation routine (alexa.getAutomationRoutines()) */
export interface AutomationRoutineTrigger {
    type?: string;
    payload?: {
        utterance?: string;
        utterances?: string[];
        schedule?: {
            triggerTime?: string;
            recurrence?: string;
            [key: string]: unknown;
        };
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

/** Automation routine (alexa.getAutomationRoutines()), enriched by the adapter in initRoutines() */
export interface AutomationRoutine {
    '@type'?: string;
    automationId: string;
    name?: string | null;
    sequence?: AmazonJson;
    triggers?: AutomationRoutineTrigger[];
    /** Set by the adapter */
    friendlyName?: string;
    /** Set by the adapter */
    friendlyAutomationId?: string;
    /** Set by the adapter */
    utteranceWords?: string[];
    [key: string]: any;
}

/** Response of alexa.getHomeGroup() */
export interface CommHomeGroupResponse {
    commsId?: string;
    homeGroupId?: string;
}

/** Entry of the response of alexa.getContacts() */
export interface CommContactEntry {
    commsId?: string[];
    alexaEnabled?: boolean;
    name: {
        firstName?: string;
        lastName?: string;
    };
    company?: string;
}

/** Response of alexa.getConversations() */
export interface CommConversationsResponse {
    conversations?: {
        conversationId: string;
        lastMessageId?: number;
        participants?: string[];
    }[];
}

/** Response of alexa.getAllDeviceVolumes() */
export interface AllDeviceVolumesResponse {
    volumes?: AmazonJson[];
}

/** Entry of the response of alexa.getRoutineSoundList() */
export interface RoutineSoundEntry {
    id: string;
    displayName: string;
    availability?: string;
}

/** Response of alexa.getRoutineSkillCatalog() */
export interface RoutineSkillCatalogResponse {
    catalog?: {
        catalogItems?: {
            itemType?: string;
            disabled?: boolean;
            catalogType?: string;
            catalogId: string;
            title: string;
        }[];
    };
}

/** Content of the crash check file crashCheck-<namespace>.json */
export interface CrashCheckData {
    startCounter: number;
}

/** Payload of the alexa-remote2 events ws-device-connection-change, ws-media-change, ... (common part) */
export interface WsDevicePayload {
    destinationUserId?: string;
    deviceSerialNumber: string;
    deviceType?: string;
}

/** Payload of the alexa-remote2 event ws-device-connection-change */
export interface WsDeviceConnectionChangePayload extends WsDevicePayload {
    /** 'ONLINE' | 'OFFLINE' */
    connectionState: string;
}

/** Payload of the alexa-remote2 event ws-bluetooth-state-change */
export interface WsBluetoothStateChangePayload extends WsDevicePayload {
    bluetoothEvent: string;
    bluetoothEventPayload?: unknown;
    bluetoothEventSuccess?: boolean;
}

/** Payload of the alexa-remote2 event ws-audio-player-state-change */
export interface WsAudioPlayerStateChangePayload extends WsDevicePayload {
    mediaReferenceId?: string;
    /** 'INTERRUPTED' | 'FINISHED' | 'PLAYING' | ... */
    audioPlayerState: string;
    error?: boolean;
    errorMessage?: string | null;
}

/** Payload of the alexa-remote2 event ws-media-queue-change */
export interface WsMediaQueueChangePayload extends WsDevicePayload {
    changeType?: string;
    playBackOrder?: unknown;
    trackOrderChanged?: boolean;
    loopMode?: unknown;
}

/** Payload of the alexa-remote2 events ws-media-change and ws-media-progress-change */
export interface WsMediaChangePayload extends WsDevicePayload {
    mediaReferenceId?: string;
    mediaProgress?: number | null;
    mediaLength?: number | null;
}

/** Payload of the alexa-remote2 event ws-volume-change */
export interface WsVolumeChangePayload extends WsDevicePayload {
    isMuted: boolean | null;
    volume: number;
}

/** Payload of the alexa-remote2 event ws-content-focus-change */
export interface WsContentFocusChangePayload extends WsDevicePayload {
    deviceComponent?: string;
}

/** Payload of the alexa-remote2 event ws-equilizer-state-change */
export interface WsEqualizerStateChangePayload extends WsDevicePayload {
    bass: number;
    midrange: number;
    treble: number;
}

/** Payload of the alexa-remote2 event ws-device-activity (a history record) */
export interface WsDeviceActivityPayload {
    deviceSerialNumber: string;
    description: {
        summary?: string;
        [key: string]: unknown;
    };
    [key: string]: any;
}

/** Payload of the alexa-remote2 event ws-todo-change */
export interface WsTodoChangePayload {
    destinationUserId?: string;
    /** listCreated, listUpdated, listDeleted, itemCreated, itemUpdated, itemDeleted */
    eventType: string;
    listId: string;
    listItemVersion?: number;
    listItemId?: string;
}

/** Payload of the alexa-remote2 event ws-notification-change */
export interface WsNotificationChangePayload extends WsDevicePayload {
    /** 'DELETE' | 'UPDATE' | ... */
    eventType: string;
    notificationId: string;
    notificationVersion?: number;
}

/**
 * alexa-remote2 overloads that are used by part E (lists, routines, contacts), but are missing in the typings:
 * the library detects shifted arguments (a function given as options/limit) and has optional callbacks.
 * Callbacks are intentionally NOT added at the call sites, nothing changes at runtime.
 * As in part C: `export default` is required, a plain `interface AlexaRemote` does NOT merge with the default
 * exported class.
 */
declare module 'alexa-remote2' {
    export default interface AlexaRemote {
        getListItems(listId: string, callback: AlexaCallback): void;
        addListItem(listId: string, options: Record<string, unknown>): void;
        updateListItem(listId: string, listItemId: string, options: Record<string, unknown>): void;
        deleteListItem(listId: string, listItemId: string, options: Record<string, unknown>): void;
        getAutomationRoutines(callback: AlexaCallback): void;
        getConversations(callback: AlexaCallback): void;
        /** The typings miss the 2nd parameter lastMessageId */
        deleteConversation(conversationId: string, lastMessageId: number | undefined, callback: AlexaCallback): void;
    }
}
