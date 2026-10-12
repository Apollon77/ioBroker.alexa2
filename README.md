![Logo](admin/alexa.png)
# ioBroker.alexa2

![Number of Installations](http://iobroker.live/badges/alexa2-installed.svg)
![Number of Installations](http://iobroker.live/badges/alexa2-stable.svg)
[![NPM version](http://img.shields.io/npm/v/iobroker.alexa2.svg)](https://www.npmjs.com/package/iobroker.alexa2)

![Test and Release](https://github.com/Apollon77/iobroker.alexa2/workflows/Test%20and%20Release/badge.svg)
[![Translation status](https://weblate.iobroker.net/widgets/adapters/-/alexa2/svg-badge.svg)](https://weblate.iobroker.net/engage/adapters/?utm_source=widget)
[![Downloads](https://img.shields.io/npm/dm/iobroker.alexa2.svg)](https://www.npmjs.com/package/iobroker.alexa2)

**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.** For more details and for information how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.

This adapter allows you to remotely control your Alexa (Amazon Echo) devices.

Big thanks go to `@soef` for version 1 of the adapter and to Hauke and ruhr70 for ideas in their scripts from ioBroker-Forum (especially the media progress updates)!
Also, big thanks to `@meicker` for support in documenting all of this and numerous users from ioBroker Forum for their testing support!

## Disclaimer
**All product and company names or logos are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them or any associated subsidiaries! This personal project is maintained in spare time and has no business goal.**
**ALEXA is a trademark of AMAZON TECHNOLOGIES, INC.**

## States and their meanings:

In the adapter namespace (e.g., `alexa2.0`) some channels are created

### alexa2.0

| State name           | meaning                                                |
|----------------------|--------------------------------------------------------|
| Echo-Devices.*       | States per Echo device, see below                      |
| History.*            | Infos for command history, see below                   |
| Smart-Home-Devices.* | States per smart home device and in general, see below |
| info.*               | General information about the adapter status           |
| requestResult        | Error info for TuneIn and smart-home device requests   |

### alexa2.0.Contacts.ContactId.*
All Alexa-Contacts that can be used to send Text Messages to, including himself. The own contact gets a special "(Self)" after his name.

| State name        | meaning                                                                                                                                        |
|-------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| #clearOwnMessages | Only exists in own contact and a trigger deletes all messages that are send to himself (also includes messages to himself via App or devices!) |
| textMessage       | Sends this text as message to the user. It is shown on all devices of this user with a "yellow ring"                                           |

### alexa2.0.Echo-Devices.CommandsAll.*
Commands to be sent to all devices in the account.

| State name         | meaning                                         | Comments                                                                                                     |
|--------------------|-------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| deviceStop         | Stop all actions on device                      | Button                                                                                                       |
| deviceDoNotDisturb | Switch on/off "Do not Disturb" for all devices. | true/false, or number in seconds to enable (max 12h) or string in form "HH:MM" until this time it is enabled |

### alexa2.0.Echo-Devices.Serialnumber.*
Under "echo-devices" every amazon echo device is listed with its serial number. Not every device shows all the states. Every device has its own states as described below:

### alexa2.0.Echo-Devices.Serialnumber.Alarm.*
Alarm (Wecker) settings for each device, if available.

| State name            | meaning                                                                                                                                                                                                                                                                                                                                                                               | value                                                                                                                                                                                                                                                                                                                              |
|-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| <id>.customVolume     | Set a custom Volume for this Reminder. The volume is set 2s before the reminder triggers and re-set to the value before as soon as the timer is (or adapter thinks!) stopped - latest after 120s! When custom volumes and trigger times overlap it will be restored at the end once!                                                                                                  | Number 0..100                                                                                                                                                                                                                                                                                                                      |
| <id>.date             | Overwrite the date for existing alarm to set a new date for this alarm. In case you have an existing alarm you can change the date here by simply overwrite the time in format YYYY-MM-DD. Might have no effect when multiple-times-per-day recurring settings were used!                                                                                                             | Date Output                                                                                                                                                                                                                                                                                                                        |
| <id>.delete           | Button to delete the Alarm                                                                                                                                                                                                                                                                                                                                                            | delete with true                                                                                                                                                                                                                                                                                                                   |
| <id>.enabled          | Shows status of alarm and allows to change it: Activate alarm with true - Deactivate alarm with false                                                                                                                                                                                                                                                                                 | true / false                                                                                                                                                                                                                                                                                                                       |
| <id>.musicEntity      | Shows the track info if this alarm is a music alarm                                                                                                                                                                                                                                                                                                                                   | String or null                                                                                                                                                                                                                                                                                                                     |
| <id>.musicProvider    | Shows the provider of the music  if this alarm is a music alarm                                                                                                                                                                                                                                                                                                                       | String or null                                                                                                                                                                                                                                                                                                                     |
| <id>.nextTriggerDate  | Contains the timepoint of the next expected triggering as unix epoch in ms                                                                                                                                                                                                                                                                                                            | Number                                                                                                                                                                                                                                                                                                                             |
| <id>.recurringDays    | Shows the list of days configured if the Alarm has recurring settings                                                                                                                                                                                                                                                                                                                 | US notation of weekdays (e.g. MO,TU,WE,TH,FR,SA,SU)                                                                                                                                                                                                                                                                                |
| <id>.recurringPattern | Shows the recurring pattern of alarm                                                                                                                                                                                                                                                                                                                                                  | 0 = one time, no recurring <br> P1D = daily <br> XXXX-WD = on weekdays <br> XXXX-WE = on weekends <br> XXXX-WXX-1 = every monday <br> XXXX-WXX-2 = every tuesday <br> XXXX-WXX-3 = every wednesday <br> XXXX-WXX-4 = every thursday <br> XXXX-WXX-5 = every friday <br> XXXX-WXX-6 = every saturday <br> XXXX-WXX-7 = every sunday |
| <id>.snoozed          | true if the Alarm is snoozed at the moment                                                                                                                                                                                                                                                                                                                                            | true/false                                                                                                                                                                                                                                                                                                                         |
| <id>.sound            | Contains the set sound for this alarm. Can be changed. Also changing between music sound entry and "build in sounds" is possible.                                                                                                                                                                                                                                                     | ID from list                                                                                                                                                                                                                                                                                                                       |
| <id>.time             | Time for alarm. Overwrite the time for existing alarm to set a new time for this alarm. In case you have an existing alarm you can change the time here by simply overwrite the time in format hh:mm:ss, seconds are not needed to set. Might have no effect when multiple-times-per-day recurring settings were used!                                                                | Time Input                                                                                                                                                                                                                                                                                                                         |
| <id>.triggered        | true if alarm is reached and triggered. Clock must be in sync with Amazon and iobroker, Use this to trigger other action as soon as the alarm time is reached                                                                                                                                                                                                                         | true / false                                                                                                                                                                                                                                                                                                                       |
| New                   | Data to create a new Reminder as String in following format separated by ; as "timestamp;[label];[sound];[recurring]. timestamp as unix timestamp in ms, label as Text, sound as sound ID, recurring either empty for once, "DAILY" for daily or "WEEKLY=MO,TU,WE,TH,FR,SA,SU" with comma separated weekly day list. Fields in example above in brackets mean that they are optional! | String                                                                                                                                                                                                                                                                                                                             |
| triggered             | ID of the Alarm that triggered last on this device                                                                                                                                                                                                                                                                                                                                    | ID                                                                                                                                                                                                                                                                                                                                 |

When changing an Alarm does not work, please make sure that the Alarm timepoint is in the future - so changing e.g. "sound" on an Alarm in the past will _not_ work!

### alexa2.0.Echo-Devices.Serialnumber.Bluetooth.*
Here you find all connected or known bluetooth device(s) with MAC address(es). The states of each device:


| State name | meaning                                                                                            |
|------------|----------------------------------------------------------------------------------------------------|
| connected  | Shows current connection status and allow connection (set to true) or disconnection (set to false) |
| unpair     | Button to unpair this device from the echo device                                                  |

### alexa2.0.Echo-Devices.Serialnumber.Commands.*
With Commands, you can trigger some actions on your Alexa-Device. If you use these on a multiroom device, then they are executed independently and *will not* run in sync on the single devices!

| State name    | meaning                                                                                                                                                                             | value                                                                                                        |
|---------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| doNotDisturb  | Switch on/off "Do not Disturb" for this device or group. Value is updated with Device Configuration updates from Cloud too                                                          | true/false, or number in seconds to enable (max 12h) or string in form "HH:MM" until this time it is enabled |
| flashbriefing | Briefing in 100 seconds - news etc.pp                                                                                                                                               | Button                                                                                                       |
| goodmorning   | Good morning from Alexa ...                                                                                                                                                         | Button                                                                                                       |
| funfact       | Fun fact from Alexa ... (Only USA at the moment)                                                                                                                                    | Button                                                                                                       |
| joke          | Joke from Alexa ...                                                                                                                                                                 | Button                                                                                                       |
| cleanup       | Plays a "gong" tone like for start/end of listening mode ...                                                                                                                        | Button                                                                                                       |
| curatedtts    | Random sentence from the chosen area from Alexa ...                                                                                                                                 | Text (allowed: "goodbye", "confirmations", "goodmorning", "compliments", "birthday", "goodnight", "iamhome") |
| singasong     | Alexa sings a song ...                                                                                                                                                              | Button                                                                                                       |
| speak         | Alexa says what you type in here ...                                                                                                                                                | Text Input                                                                                                   |
| speakvolume   | Adjust the speak volume of Alexa, this volume is set before the speak and reset afterwards                                                                                          | 0-100                                                                                                        |
| skill         | Launch a defined Skill                                                                                                                                                              | Skill-ID as String                                                                                           |
| skillYours    | launch a defined Skill - is prefilled with "Your Skills" as displayed in Alexa App too                                                                                              | Skill-ID as String                                                                                           |
| tellstory     | Alexa tells a story                                                                                                                                                                 | Button                                                                                                       |
| traffic       | Traffic news                                                                                                                                                                        | Button                                                                                                       |
| weather       | Weather news                                                                                                                                                                        | Button                                                                                                       |
| deviceStop    | Stop all actions on device                                                                                                                                                          | Button                                                                                                       |
| notification  | Send text notification to customer of the device                                                                                                                                    | Text, optionally specify title "title;text"                                                                  |
| announcement  | Play announcement (like speak but with Bing before text) <br>*Note: will only work if announcements (for this device) are activated and the device is not in "do not disturb"-mode* | Text                                                                                                         |
| ssml          | Speak SSML XML string <br>*Note: will only work if announcements (for this device) are activated and the device is not in "do not disturb"-mode*                                    | Text                                                                                                         |
| textcommand   | Send a Text command to Alexa,. Make sure to only use text (e.g. also 3 -> three and such, else Alexa might not correctly react to it!)                                              | Text                                                                                                         |
| sound         | Play a sound on the device.                                                                                                                                                         | Text                                                                                                         |

Detailed information Speak and Announcement: Type in here what you want Alexa to say. You can also adjust the volume of Alexa by giving a percentage before your text.
Example: 10;Alexa is saying Alexa with 10% volume, while 100;Alexa is 100% volume.
Normally, you only can send 250 characters per speak command. By using the semicolon, it is possible to write as much as you want, as long as you separate 250 characters with a semicolon.
Alexa will then speak the text after each other with a small break. You also can use the volume together with more 255 blocks by writing #Volume;#Block1;#Block2, a.s.o A volume set here will be used over a defined speak-volume.

Partially also sounds from https://developer.amazon.com/en-US/docs/alexa/custom-skills/ask-soundlibrary.html work. Specify in speak or ssml as `<audio src="soundbank://soundlibrary/animals/amzn_sfx_bear_groan_roar_01"/>`. Details and discussion please at https://forum.iobroker.net/topic/27509/ssml-audio

### alexa2.0.Echo-Devices.Serialnumber.FireTVCommands.*
If a device is an Amazon Fire TV then you can use the following commands:

| State name   | meaning                  | value  |
|--------------|--------------------------|--------|
| turnOn       | Turn FireTV and TV on    | Button |
| turnOff      | Turn FireTV and TV off   | Button |
| videoPause   | Pause the running video  | Button |
| videoResume  | Resume the current video | Button |
| navigateHome | Navigate to Home         | Button |

### alexa2.0.Echo-Devices.Serialnumber.Info.*
Information about the Alexa device

| State name        | meaning                                                                                     | value                     |
|-------------------|---------------------------------------------------------------------------------------------|---------------------------|
| capabilities      | capabilities if the alexa device                                                            | Information               |
| deviceType        | device type from Amazon                                                                     | Information               |
| deviceTypeString  | Device Type as string                                                                       | Information               |
| isMultiroomDevice | Is multiroom device - Multiroom is a virtual device group                                   | Information, true / false |
| isMultiroomMember | Is Multiroom member - If true the device is part of a multiroom device group                | Information, true / false |
| MultiroomParents  | If this device is part of a multiroom device group this state shows the parent group device | Information               |
| name              | Name of Alexa Device                                                                        | Information               |
| SerialNumber      | Serial number of Alexa device                                                               | Information               |

### alexa2.0.Echo-Devices.Serialnumber.Music-Provider.*
Directly tell Alexa to play Music or a playlist from supported music providers. Actually supported are: My Library, Amazon Music, Tune In. You can also include a multiroom device group name in the phrase to play it on this group (e.g. "SWR3 auf Erdgeschoss")

| State name            | meaning                            | value      |
|-----------------------|------------------------------------|------------|
| Amazon-Music          | Phrase to play with Amazon Music   | Text input |
| Amazon-Music-Playlist | Playlist to play with Amazon Music | Text input |
| My-Library            | Phrase to play with My Library     | Text input |
| My-Library-Playlist   | Playlist to play with My Library   | Text input |
| Tune-In               | Phrase to play with Tune In        | Text input |
| Tune-In-Playlist      | Playlist to play with Tune In      | Text input |

### alexa2.0.Echo-Devices.Serialnumber.Player.*
States to control the Playback of the device and to see the current status and media information

| State name          | meaning                                                                                                                                                                                                | value                                                        |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------|
| allowNext           | Is the Next/Forward action allowed?                                                                                                                                                                    | Information                                                  |
| allowPlayPause      | Is the Play/Pause action allowed?                                                                                                                                                                      | Information                                                  |
| allowPrevious       | Is the Previous action allowed?                                                                                                                                                                        | Information                                                  |
| allowRepeat         | Can Repeat function be used?                                                                                                                                                                           | Information                                                  |
| allowShuffle        | Can Shuffle function be used?                                                                                                                                                                          | Information                                                  |
| ContentType         | text field to put in desired content to play on this device                                                                                                                                            | Information                                                  |
| controlForward      | Button to trigger player "forward" command (30s)                                                                                                                                                       | Button                                                       |
| controlNext         | Button to trigger player "next" command                                                                                                                                                                | Button                                                       |
| controlPause        | Button to trigger player "pause" command                                                                                                                                                               | Button                                                       |
| controlPlay         | Button to trigger player "play" command                                                                                                                                                                | Button                                                       |
| controlPrevious     | Button to trigger player "previous" command                                                                                                                                                            | Button                                                       |
| controlRepeat       | Button to trigger player "repeat" command                                                                                                                                                              | true / false                                                 |
| controlRewind       | Button to trigger player "rewind" command (30s)                                                                                                                                                        | Button                                                       |
| controlShuffle      | Switch to enable or disable Shuffle mode for player                                                                                                                                                    | true / false                                                 |
| currentAlbum        | Current album actually playing                                                                                                                                                                         | Information                                                  |
| currentArtist       | Current artist actually playing                                                                                                                                                                        | Information                                                  |
| currentState        | If playing -> true , else false                                                                                                                                                                        | true / false                                                 |
| currentTitle        | Current title actually playing                                                                                                                                                                         | Information                                                  |
| imageURL            | URL to the image of the album                                                                                                                                                                          | Information                                                  |
| mainArtURL          | URL to current main art                                                                                                                                                                                | Information                                                  |
| mediaId             | media ID of the current played media (usually queueID:<number>                                                                                                                                         | String, can be set to jump to the provided media ID          |
| mediaLength         | Length of the current title                                                                                                                                                                            | Information                                                  |
| mediaLengthStr      | active media length as (HH:)MM:SS                                                                                                                                                                      | Information                                                  |
| mainProgress        | active media elapsed time                                                                                                                                                                              | Information                                                  |
| mainProgressPercent | active media elapsed time in percent                                                                                                                                                                   | Information                                                  |
| mediaProgressStr    | active media progress as (HH:)MM:SS                                                                                                                                                                    | Information                                                  |
| miniArtUrl          | URL to the art (mini)                                                                                                                                                                                  | Information                                                  |
| muted               | state of 'MUTE'                                                                                                                                                                                        | Information, true / false, volume = 0 is considered as muted |
| playingInGroup      | Is the medium played in a group?                                                                                                                                                                       | Information                                                  |
| playingInGroupId    | ID of the playing group                                                                                                                                                                                | Information                                                  |
| providerID          | ID of the current music provider                                                                                                                                                                       | Information                                                  |
| providerName        | Name of the current music provider                                                                                                                                                                     | Information                                                  |
| quality             | quality name of the current medium (might be empty)                                                                                                                                                    | Information                                                  |
| qualityCodec        | Codec of the current medium (might be empty)                                                                                                                                                           | Information                                                  |
| qualityDataRate     | data rate (kbps) of the current medium (might be empty)                                                                                                                                                | Information                                                  |
| qualitySampleRate   | sample rate (Hz) of the current medium (might be empty)                                                                                                                                                | Information                                                  |
| queueId             | queue ID of the current playlist                                                                                                                                                                       | Information                                                  |
| radioStationId      | ID of the TuneIn radio station                                                                                                                                                                         | Information                                                  |
| service             | name of the current music service                                                                                                                                                                      | Information                                                  |
| TuneIn-Station      | text field to put in a Station name to play this station on this device. Also it is possible to type in the station number (s123456...), a show/podcast id (p1234567...) or a topic id (t123456789...) | Text input                                                   |
| volume              | Volume of playback. You can enter a value between 0-100%                                                                                                                                               | INPUT Volume                                                 |

### alexa2.0.Echo-Devices.Serialnumber.Preferences.*
Here you find some device preferences.

| State name                       | meaning                                                                                                                                                                    | value                                                                           |
|----------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| ringNotificationsEnabled         | Shows if the ring notifications are enabled or not and allows to edit it (true/false). The status is updated from cloud with a device configuration interval               | Boolean                                                                         |
| notificationVolume               | The notification volume set for the device. The value is loaded once on adapter start and then not synced with Cloud services, but changeable                              | number 0..100                                                                   |
| ascendingAlarmState              | The ascending alarm state set for the device. The value is loaded once on adapter start and then not synced with Cloud services, but changeable                            | Boolean                                                                         |
| auxPort-*-Direction              | The direction of the AuxPort (when supported). The value is loaded once on adapter start and then not synced with Cloud services, but changeable                           | "INPUT" or "OUTPUT"                                                             |
| connectedSpeaker                 | The speaker with is used for the Device output. The value is loaded once on adapter start and then not synced with Cloud services, but changeable                          | "InternalSpeaker", "Bluetooth" or "Aux" (if supported by Device! check the App) |
| defaultAlarmNotificationSound    | The default alarm sound set for the device. The value is loaded once on adapter start and then not synced with Cloud services, but changeable                              | ID from a list                                                                  |
| defaultTimerNotificationSound    | The default timer sound set for the device. The value is loaded once on adapter start and then not synced with Cloud services, but changeable                              | ID from a list                                                                  |
| displayAdaptiveBrightnessEnabled | Is the adaptive brightness for the display of the device enabled or not. The value is loaded once on adapter start and then not synced with Cloud services, but changeable | true/false                                                                      |
| displayEnabled                   | Is the display of the device enabled or not. The value is loaded once on adapter start and then not synced with Cloud services, but changeable                             | true/false                                                                      |
| displayBrightness                | Brightness of the display. The value is loaded once on adapter start and then not synced with Cloud services, but changeable                                               | 0..100%                                                                         |
| equalizerBass                    | Equalizer Bass setting. Value is updated when changed if push connection is enabled                                                                                        | Number                                                                          |
| equalizerMidRange                | Equalizer Midrange  setting. Value is updated when changed if push connection is enabled                                                                                   | Number                                                                          |
| equalizerTreble                  | Equalizer Treble  setting. Value is updated when changed if push connection is enabled                                                                                     | Number                                                                          |


### alexa2.0.Echo-Devices.Serialnumber.Reminder.*
Reminder (Erinnerungen) settings for each device, if available.

| State name            | meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | value                                                                                                                                                                                                                                                                                                                              |
|-----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| <id>.customVolume     | Set a custom Volume for this Reminder. The volume is set 2s before the reminder triggers and re-set to the value before as soon as the timer is (or adapter thinks!) stopped - latest after 120s! When custom volumes and trigger times overlap it will be restored at the end once!                                                                                                                                                                                                                                     | Number 0..100                                                                                                                                                                                                                                                                                                                      |
| <id>.date             | Overwrite the date for existing alarm to set a new date for this alarm. In case you have an existing alarm you can change the date here by simply overwrite the time in format YYYY-MM-DD. Might have no effect when multiple-times-per-day recurring settings were used!                                                                                                                                                                                                                                                | Date Output                                                                                                                                                                                                                                                                                                                        |
| <id>.delete           | Button to delete the Alarm                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | delete with true                                                                                                                                                                                                                                                                                                                   |
| <id>.enabled          | Shows status of alarm and allows to change it: Activate alarm with true - Deactivate alarm with false                                                                                                                                                                                                                                                                                                                                                                                                                    | true / false                                                                                                                                                                                                                                                                                                                       |
| <id>.nextTriggerDate  | Contains the timepoint of the next expected triggering as unix epoch in ms                                                                                                                                                                                                                                                                                                                                                                                                                                               | Number                                                                                                                                                                                                                                                                                                                             |
| <id>.recurringDays    | Shows the list of days configured if the Alarm has recurring settings                                                                                                                                                                                                                                                                                                                                                                                                                                                    | US notation of weekdays (e.g. MO,TU,WE,TH,FR,SA,SU)                                                                                                                                                                                                                                                                                |
| <id>.recurringPattern | Shows the recurring pattern of alarm                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 0 = one time, no recurring <br> P1D = daily <br> XXXX-WD = on weekdays <br> XXXX-WE = on weekends <br> XXXX-WXX-1 = every monday <br> XXXX-WXX-2 = every tuesday <br> XXXX-WXX-3 = every wednesday <br> XXXX-WXX-4 = every thursday <br> XXXX-WXX-5 = every friday <br> XXXX-WXX-6 = every saturday <br> XXXX-WXX-7 = every sunday |
| <id>.snoozed          | true if the Alarm is snoozed at the moment                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | true/false                                                                                                                                                                                                                                                                                                                         |
| <id>.sound            | Contains the set sound for this alarm. Can be adjusted                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | ID from list                                                                                                                                                                                                                                                                                                                       |
| <id>.time             | Time for alarm. Overwrite the time for existing alarm to set a new time for this alarm. In case you have an existing alarm you can change the time here by simply overwrite the time in format hh:mm:ss, seconds are not needed to set. Might have no effect when multiple-times-per-day recurring settings were used!                                                                                                                                                                                                   | Time Input                                                                                                                                                                                                                                                                                                                         |
| <id>.triggered        | true if alarm is reached and triggered. Clock must be in sync with Amazon and iobroker, Use this to trigger other action as soon as the alarm time is reached                                                                                                                                                                                                                                                                                                                                                            | true / false                                                                                                                                                                                                                                                                                                                       |
| New                   | Data to create a new Reminder as String in following format separated by ; as "timestamp;label;[sound];[recurring]. timestamp as unix timestamp in ms or text like "HH:MM", label as Text (required), sound as sound ID, recurring either empty for once, "DAILY" for daily or "WEEKLY=MO,TU,WE,TH,FR,SA,SU" with comma separated weekly day list. For full flexibility recurring can also be a JSONified object with all data which is passed through. Fields in example above in brackets mean that they are optional! | String                                                                                                                                                                                                                                                                                                                             |
| triggered             | ID of the Alarm that triggered last on this device                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | ID                                                                                                                                                                                                                                                                                                                                 |

When changing a Reminder does not work, please make sure that the Reminder timepoint is in the future - so changing e.g. "sound" on a Reminder in the past will _not_ work!

### alexa2.0.Echo-Devices.Serialnumber.Routines.*
Overview of routines set up in Alexa App. Self created routines have a serial number, Amazon shows as 'preconfigured:...' Each routine can be triggered with a button to run once.

| State name                         | meaning         | value  |
|------------------------------------|-----------------|--------|
| Serial or internal name of routine | name of routine | Button |

### alexa2.0.Echo-Devices.Serialnumber.Timer.*
You can have one or more timers running on each Alexa device. Because of the very dynamic nature of timers, there will be no further objects created like with Alarm or Reminders, but a way to get triggered info exists.

| State name      | meaning                                                                                                      | value      |
|-----------------|--------------------------------------------------------------------------------------------------------------|------------|
| activeTimerList | JSON array with the list of active timers containing ID, label and trigger timepoint as unix timestamp in ms | JSON array |
| nextTimeDate    | Contains the timepoint of the next expected triggering as unix epoch in ms                                   | Number     |
| nextTimerId     | ID of the next timer to trigger                                                                              | String     |
| stopTimerId     | Control with a timer ID to stop the timer (also stops if the timer is currently ringing!)                    | String     |
| triggered       | A timer got triggered - in fact it is the "nextTimerId" one                                                  | true/false |

**Please note that it is important that the timezone of the iobroker host is set to match your local timezone, else the triggered time detection might be wrong!**

### alexa2.0.Echo-Devices.Serialnumber.online
Is this Alexa device online and connected to the Amazon cloud?

| State name | meaning                | value        |
|------------|------------------------|--------------|
| online     | Is the device online ? | True / False |

### alexa2.0.History

| State name            | meaning                                                                                                                                                            | value                                                                                                                                                                                |
|-----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| #trigger              | Button to get new History (more current then timestamp in creationTime), only needed when not using the push connection or when the automatic querying is disabled | Button                                                                                                                                                                               |
| cardContent           | Additional information as shown in Alexa-App/Echo Show                                                                                                             | Information                                                                                                                                                                          |
| cardJson              | Additional information as shown in Alexa-App/Echo Show in JSON format                                                                                              | Information                                                                                                                                                                          |
| creationTime          | date of this history entry, new history entries are only considered when later as this timestamp                                                                   | Information                                                                                                                                                                          |
| domainApplicationId   | Additional information like Skill-ID or such, optional                                                                                                             | Information                                                                                                                                                                          |
| domainApplicationName | Additional information like Skill name or such, optional                                                                                                           | Information                                                                                                                                                                          |
| json                  | Json of last command data to be able to process all infos e.g. in own JavaScripts                                                                                  | JSON                                                                                                                                                                                 |
| name                  | Name of the device that got the last request                                                                                                                       | Information                                                                                                                                                                          |
| serialNumber          | Serial number of the device that got the last request                                                                                                              | Information                                                                                                                                                                          |
| status                | Status of last command to Alexa                                                                                                                                    | SUCCESS / FAULT / DISCARDED_NON_DEVICE_DIRECTED_INTENT; last one is generated when activating the device by saying the wake word, or when the device discarded input as "not for me" |
| summary               | text/summary/action received by the device                                                                                                                         | Information                                                                                                                                                                          |

### alexa.0.Smart-Home-Devices
Includes all smart home devices Alexa knows from your skills. States as follows, for all known devices:

| State name      | meaning                                                                                    | value  |
|-----------------|--------------------------------------------------------------------------------------------|--------|
| deleteAll       | deletes all smart home devices from Alexa, same as the button in the Alexa App             | Button |
| discoverDevices | finds new smart home devices, same as the button in the Alexa App                          | Button |
| queryAll        | queries all devices, only visible when at least one device is able to retrieve information | Button | 

### alexa.0.Smart-Home-Devices.SerialNumber.*
| State name         | meaning                                                                                                                                                       | value                         |
|--------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------|
| #delete            | delete smart home device from Alexa                                                                                                                           | Button                        |
| #enabled           | Is the smart home device active? Status and control to enable/disable. State will be synced with the cloud in the same interval as the smart home deice data. | true / false                  |
| #includeInAllQuery | Should this device be included when querying all device states ?                                                                                              | true / false                  |
| #query             | query data for this device, only visible when the smart home device/skill supports to retrieve information                                                    | Button                        |
| active             | shown for scenes when they can be activated/deactivated                                                                                                       | true / false                  |
| powerState         | Switch power on / off                                                                                                                                         | changeable, true / false      |
| ...                | Many more possible states depending on the type of the smart home device                                                                                      | Information or changeable :-) |

**-> Special states for color/light devices**

| State name               | meaning                                                                 | value                          |
|--------------------------|-------------------------------------------------------------------------|--------------------------------|
| brightness               | brightness of the HUE light                                             | changeable 0-100%              |
| color-Brightness         | brightness for color definition (together with hue and saturation, HSV) | Information, 0-1%              |
| color-hue                | hue value of the color (together with brightness and saturation, HSV)   | Information, 0-360°            |
| color-saturation         | saturation of the color (together with brightness and hue, HSV)         | Information, 0-1               |
| colorRGB                 | RGB code of actual color build out of color-* values                    | Information, #rrggbb           |
| colorName                | Name of the color as defined by Alexa - fixed values                    | changeable to set color, 0-144 |
| colorTemperatureInKelvin | Color temperature in Kelvin                                             | Information, 1000-10000K       |
| colorTemperatureName     | Color temperature name as defined by Alexa - fixed values               | changeable to set, 0-18        |

With #brightness you can adjust the brightness of your light, #colorName is to pick one predefined color (0-144). For HUE Ambient light, you can choose between 19 Values from 0-18 in #colorTemperatureName. All light can switched on and off with #powerState.

### alexa2.0.Info.*
| State name | meaning                                                                             | value                       |
|------------|-------------------------------------------------------------------------------------|-----------------------------|
| connection | If connection to Alexa is OK                                                        | Information -> true / false |
| cookie     | Alexa cookie, use with several external scripts that also want to access Alexa APIs | Information                 |
| csrf       | Alexa CSRF, use with several external scripts that also want to access Alexa APIs   | Information                 |


## Installation
As usual using the stable or the latest repository. Installing directly from GitHub is not possible, because the adapter is written in TypeScript and the compiled code is only part of the npm package.

## Send Alexa Device Command sequences via messages
All commands to the alexa devices can be sent via the adapter to single devices or to groups. The adapter supports sending of these commands and - if needed - also combines them to set a specific volume before a voice output and restore the original volume afterward.

When you want to send custom sequences to alexa devices, you can create a Routine and trigger the routine also via the states.

If this is not flexible enough, the adapter offers since version 3.14.0 a way to send commands via messages.

You provide an array structure which will be converted to commands. There are two types of options for one array element:

**A command**
```json5
{
    "command": "speak", // command like the state name in Commands states
    "value": "This is a test speak.", // value like value you set on state
    "device": "..." // optional: serialNumber of the device to send this command to
}
```

**A sequence definition**

```json5
{
    "sequenceType": "...", // "SerialNode" or "ParallelNode"
    "nodes": [...] // array of commands or sequences
}
```

Sending the message e.g. using JavaScript adapter looks like this:

```javascript
adapter.sendTo(
    "alexa.0", // target
    "sendSequenceCommand", // command
    { // value
        "deviceSerialNumber": "...", // Serial number of one device to get Meta data which will be used if no device is pecified on the commands
        "sequenceNodes": [...], // list of sequences or commands
        "sequenceType": "SerialNode" // "SerialNode" or "ParallelNode" for the provided sequenceNodes on main level. Default is "SerialNode"
    }, (err, res) => {
        console.log(err);
        console.log(JSON.stringify(res));
    }
);
```

When commands are executed as "ParallelNode" in parallel, which mainly makes sense to send commands to different devices. Commands as "SerialNode" are executed one after the other - **Amazon takes care about this and handles this, not the adapter!** 

A structure like the following is possible:

```json5
... // use ParallelNode on main level
"sequenceNodes": [
    {
        "sequenceType": "SerialNode",
        "nodes": [
            {
                "command": "speak",
                "value": "This is a test speak.",
                "device": "DeviceA"
            },
            {
                "command": "speak",
                "value": "This is a second test speak.",
                "device": "DeviceA"
            }
        ]
    },
    {
        "sequenceType": "SerialNode",
        "nodes": [
            {
                "command": "speak",
                "value": "This is a test speak.",
                "device": "DeviceB"
            },
            {
                "command": "speak",
                "value": "This is a second test speak.",
                "device": "DeviceB"
            },
            {
                "sequenceType": "ParallelNode",
                "nodes": [
                    {
                        "command": "flashbriefing",
                        "device": "DeviceC"
                    },
                    {
                        "command": "flashbriefing",
                        "device": "Device B"
                    }
                ]
            }
        ]
    }
]

```

## Troubleshooting

### Problem with Cookie determination with SMS based 2FA flow
If you still use the SMS/E-Mail based 2FA flow, then this might not work. Please update the 2FA/OTP method in the amazon settings to the current process! Not working could also mean that an Error 404/Page not found is shown. Also, then check and upgrade OTP settings!

### The Alexa App opens when I try to log in
If you open the Proxy URL from a mobile device where also the Alexa App is installed on, it might be that it does not work because Amazon might open the Alexa App. So please use a device or PC where the Alexa App is not installed!

### I get a page shown with a QR code telling me to scan it
If you see a page that tells you that "alexa.amazon.xx is deprecated" and you should use the alexa app and with a QR code on it when you enter the Proxy URL" then this means that you call the proxy URL ith a different IP/Domainname then you entered in the "proxy own IP" settings, or you adjusted the IP shown in the Adapter configuration.

The "own IP" setting **needs to** match the IP/Domainname you use to call the proxy URL!

### Problems with Cookie determination via E-Mail/Password
Sometimes Amazon has weired checks in place when they detect unexpected traffic on Login.
This can result in the problem that a captcha needs to be answered in order to log in.
Mostly, this captcha needs to be answered once and after this, the login works without Captcha.

When you need to answer such a captcha, then try to do the following:
* Use a common Browser (e.g., Chrome)
* disable Javascript!
* clear all cookies that may exist for Amazon or use Private/Incognito mode of the browser
* call https://alexa.amazon.de
* you should get a login form (normally displayed for older mobile browsers)
* login there with your Amazon credentials where the Echo/Alexa is registered in
* you may need to log in twice or solve a Captcha
* In the end, you should see "https://alexa.amazon.de/spa/index.html" as URL but without any real content (because JS is still disabled), BUT THIS IS COMPLETELY OK!!!!
* now try to get cookie again
* if it still not works, do it again and check the User-Agent and accept-Language from your browser and use those in adapter on next try

Additionally, the Accept-Language-Header (default to "de-DE") needs to match with your language/the browser language/the language of the amazon page you log in.

You can also try to play around with the User-Agent and use one which more matches to the system type you use.
As example using "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36" as User-Agent was reported as working better when ioBroker runs on a linux system.

You can override all those parameters in the adapter configuration.

### Push Connections do not connect
Sometimes it could happen that because of too many connection tries aAmazon blocks the push connection endpoint for a specific IP and "device".

If the Push connection is never established, then you can try to use the following:
* delete the instance of the adapter
* check if there are files like /opt/iobroker/node_modules/iobroker.alexa2/formerDataStore*.json - if existing please delete them
* add new instance and get new cookie

Then it should work again

### I have too many App/"This device" devices in my list of Echo-Devices
The adapter reads whatever Amazon reports. Sometimes unused and old Apps or other connections stay in that list.
If you want to clean this up, you need to do that by visiting the Amazon website and remove the devices there.

Link: https://www.amazon.de/hz/mycd/digital-console/devicedetails?deviceFamily=ALEXA_APP

After deleting an unused device, please restart the adapter to remove them there too.

### 🌍 Region‑specific Amazon configuration

Some users may encounter crashes when first configuring the adapter.  
This is often caused by the adapter being **preconfigured for the German Amazon region (amazon.de)**.  
If your Alexa account is registered in another Amazon marketplace, you must update few settings so the adapter communicates with the correct regional endpoints.

When these values are not adjusted, authentication and cookie might work but failure will occur when fetching your devices, leading to adapter startup errors and got a terminate signal TERMINATE_YOURSELF.

To correct the regional endpoints, go to `Instances > alexa2.x > Settings > Cookie` and configure the values as below.

| Region / Country  | Alexa Base URL    | Accept‑Language | Cookie Amazon URL |
|-------------------|-------------------|-----------------|-------------------|
| **France** 🇫🇷   | `alexa.amazon.fr` | `fr-FR`         | `amazon.fr`       |
| *(Add more...)*   |                   |                 |                   |

If your region is not present, and you find out the value, do not hesitate to enrich this documentation with your findings.

## Changelog

### **WORK IN PROGRESS**
* (@GermanBluefox) Breaking change: Node.js >= 22.19.0, js-controller >= 6.0.11 and admin >= 7.0.0 are required now
* (@GermanBluefox) The adapter was refactored to TypeScript
* (@GermanBluefox) The configuration dialog was migrated to JsonConfig

### 3.28.3 (2026-07-06)
* (@Apollon77) Fix the proxy login process when no static port is specified

### 3.28.2 (2026-07-05)
* (@fkhr79, @blabond, @Apollon77) Fix Amazon login proxy auth flow and refreshs

### 3.28.1 (2026-05-22)
* (MiRo1310) Adds durationMillis to the activeTimerList
* (Apollon77) Added some more device types

### 3.27.4 (2025-11-06)
* (@Apollon77) Adjusts authentication check to recent Amazon changes

### 3.27.3 (2025-07-15)
* (Apollon77) Adjust Lists to recent Amazon changes
* (Apollon77) Adjust retrieving the Smart home device list to recent Amazon changes
* (Apollon77) Delete all ioBroker originated Smart Home devices because not controllable anyway
* (Apollon77) Adjust usage of some deprecated js-controller methods

## License

The MIT License (MIT)

Copyright (c) 2018-2026 Ingo Fischer <iobroker@fischer-ka.de>, 2017-2018 soef <soef@gmx.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
