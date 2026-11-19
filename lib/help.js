'use strict';

/**
 * The answer of the message "help": what the instance answers and which states control the devices, written for
 * an AI agent (e.g. ioBroker.pi-agent, or the MCP server with send_to) and for script authors.
 * Keep it in sync with processMessage in main.js.
 */

/** The commands processMessage answers. write: true if the command has an effect on a device */
const COMMANDS = [
    { command: 'help', write: false },
    { command: 'getStatusInfo', write: false },
    { command: 'sendSequenceCommand', write: true },
];

const HELP = `ioBroker.alexa2: controls the Amazon Echo devices of an Amazon account through the Alexa cloud: speak, announce,
a text command to Alexa (as if spoken), push notifications, stop, "do not disturb", the media player, routines,
alarms, smart home devices. Most control is by writing states; the message sendSequenceCommand sends several
commands at once as one Alexa sequence.
Devices: alexa2.0.Echo-Devices.<serial> (the serial number of the Echo; its name is the name of that object; groups
for multiroom music are devices too). Echo-Devices.<serial>.online: the device is connected to the cloud.

Commands (sendTo alexa2.0):
- sendSequenceCommand {deviceSerialNumber, sequenceNodes, sequenceType?}: sends the commands as one Alexa sequence;
  answer {result, error} (error null = Amazon accepted it; errors: "No sequenceNodes given", "No deviceId given",
  "Alexa connection not initialized"). deviceSerialNumber (required): serial number or name of the Echo the
  commands go to, unless a node names its own device. sequenceType: SerialNode (default, one after the other) or
  ParallelNode (at the same time). sequenceNodes: a list of {command, value?, device?} (device = serial number or
  name, default deviceSerialNumber) or {sequenceType, nodes: [...]}. command and its value:
  speak (text, at most 250 characters), announcement (text, with the chime), ssml ("<speak>...</speak>"),
  textCommand (a text as if spoken to Alexa, e.g. "turn on the kitchen light"; numbers as words), notification
  (text or {title, text}: a push message to the Alexa app), volume (0-100), wait (seconds), deviceStop,
  deviceStopAll (all devices), deviceDoNotDisturb, deviceDoNotDisturbAll (true / false, seconds up to 43200, or
  "HH:MM" = until then), sound (sound ID), skill (skill ID), curatedtts (goodbye, confirmations, goodmorning,
  compliments, birthday, goodnight, iamhome), weather, traffic, flashbriefing, goodmorning, funfact, joke, cleanup,
  singasong, tellstory, calendarToday, calendarTomorrow, calendarNext, fireTVTurnOn, fireTVTurnOff,
  fireTVPauseVideo, fireTVResumeVideo, fireTVNavigateHome (from weather on without value). An unknown command is skipped
  without an error. Unlike the states, the message sets no speak volume and does not split long texts.
- getStatusInfo: the state of the login proxy {result: {proxyActive, proxyUrl, cookieTimestamp}}: for the settings,
  not for agents.

States (alexa2.0.Echo-Devices.<serial>.*), written with ack false and the right type (buttons true, texts as string,
volumes as number):
- Commands.speak: Alexa says the text. "40;text" speaks with volume 40 and restores the volume afterwards; ";"
  separates blocks of at most 250 characters, so longer texts are possible.
- Commands.announcement: the same with the chime, only if announcements are allowed for the device and "do not
  disturb" is off. Commands.ssml: SSML ("<speak>...</speak>").
- Commands.speak-volume: the volume (0-100) of speak, announcement and the other spoken commands without a volume.
- Commands.textCommand: Alexa executes the text as if it was spoken to her (answers and actions as by voice).
- Commands.notification: a push message to the Alexa app of the account, text or "title;text".
- Commands.deviceStop (true): stops what the device does. Commands.doNotDisturb: true / false, seconds (at most
  43200) or "HH:MM".
- Commands.weather, traffic, flashbriefing, goodmorning, joke, tellstory, singasong, calendarToday ... (true), sound
  (sound ID), skill (skill ID), curatedtts: as in sendSequenceCommand.
- Player.volume (0-100), Player.controlPlay, controlPause, controlNext, controlPrevious (true), Player.currentState
  (true = playing), currentTitle, currentArtist, Player.TuneIn-Station (a station name or ID to play).
- Routines.<id> (true): runs that Alexa routine; the name of the state is the name of the routine.
alexa2.0.Echo-Devices.CommandsAll.deviceStop (true) and CommandsAll.deviceDoNotDisturb: the same for all devices.
alexa2.0.Contacts.<id>.textMessage: sends the text as a message to that person (shown on their Echo devices).

How to talk to the user:
- Which Echo: the one the user names (by its name or room). If there are several and the user names none, ask
  which one; do not guess and do not send to all. A multiroom group speaks on all its members.
- Name devices by their name, not by serial number.
- Speak, announce and play sounds only on the user's request; at night (about 22:00 to 07:00) and loud (volume
  above about 50) only when the user asks for it explicitly.
- textCommand acts like a voice command (it can switch devices, order, call): only with the text the user wants.
- Messages to contacts (Contacts.*.textMessage) reach other people: only on the user's explicit request; name the
  recipient before sending.`;

module.exports = { COMMANDS, HELP };
