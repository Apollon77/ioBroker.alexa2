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

Big thanks go to soef for version 1 of the adapter and to Hauke and ruhr70 for ideas in their scripts from ioBroker-Forum (especially the media progress updates)!
Also, big thanks to meicker for support in documenting all of this and numerous users from ioBroker Forum for their testing support!

## Disclaimer
**All product and company names or logos are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them or any associated subsidiaries! This personal project is maintained in spare time and has no business goal.**
**ALEXA is a trademark of AMAZON TECHNOLOGIES, INC.**

## States and their meanings:

In the adapter namespace (e.g., alexa2.0) some channels are created

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

| State name    | meaning                                                                                                                                | value                                                                                                        |
|---------------|----------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| doNotDisturb  | Switch on/off "Do not Disturb" for this device or group. Value is updated with Device Configuration updates from Cloud too             | true/false, or number in seconds to enable (max 12h) or string in form "HH:MM" until this time it is enabled |
| flashbriefing | Briefing in 100 seconds - news etc.pp                                                                                                  | Button                                                                                                       |
| goodmorning   | Good morning from Alexa ...                                                                                                            | Button                                                                                                       |
| funfact       | Fun fact from Alexa ... (Only USA at the moment)                                                                                       | Button                                                                                                       |
| joke          | Joke from Alexa ...                                                                                                                    | Button                                                                                                       |
| cleanup       | Plays a "gong" tone like for start/end of listening mode ...                                                                           | Button                                                                                                       |
| curatedtts    | Random sentence from the chosen area from Alexa ...                                                                                   | Text (allowed: "goodbye", "confirmations", "goodmorning", "compliments", "birthday", "goodnight", "iamhome") |
| singasong     | Alexa sings a song ...                                                                                                                 | Button                                                                                                       |
| speak         | Alexa says what you type in here ...                                                                                                   | Text Input                                                                                                   |
| speakvolume   | Adjust the speak volume of Alexa, this volume is set before the speak and reset afterwards                                             | 0-100                                                                                                        |
| skill         | Launch a defined Skill                                                                                                                 | Skill-ID as String                                                                                           |
| skillYours    | launch a defined Skill - is prefilled with "Your Skills" as displayed in Alexa App too                                                 | Skill-ID as String                                                                                           |
| tellstory     | Alexa tells a story                                                                                                                    | Button                                                                                                       |
| traffic       | Traffic news                                                                                                                           | Button                                                                                                       |
| weather       | Weather news                                                                                                                           | Button                                                                                                       |
| deviceStop    | Stop all actions on device                                                                                                             | Button                                                                                                       |
| notification  | Send text notification to customer of the device                                                                                       | Text, optionally specify title "title;text"                                                                  |
| announcement  | Play announcement (like speak but with Bing before text) <br>*Note: will only work if announcements (for this device) are activated and the device is not in "do not disturb"-mode*                                                                              | Text                                                                                                         |
| ssml          | Speak SSML XML string <br>*Note: will only work if announcements (for this device) are activated and the device is not in "do not disturb"-mode*                                                                                                                 | Text                                                                                                         |
| textcommand   | Send a Text command to Alexa,. Make sure to only use text (e.g. also 3 -> three and such, else Alexa might not correctly react to it!) | Text                                                                                                         |
| sound         | Play a sound on the device.                                                                                                            | Text                                                                                                         |

Detailed information Speak and Announcement: Type in here what you want Alexa to say. You can also adjust the volume of Alexa by giving a percentage before your text.
Example: 10;Alexa is saying Alexa with 10% volume, while 100;Alexa is 100% volume.
Normally, you only can send 250 characters per speak command. By using the semicolon, it is possible to write as much as you want, as long as you separate 250 characters with a semicolon.
Alexa will then speak the text after each other with a small break. You also can use the volume together with more 255 blocks by writing #Volume;#Block1;#Block2, a.s.o A volume set here will be used over a defined speak-volume.

Partially also sounds from https://developer.amazon.com/en-US/docs/alexa/custom-skills/ask-soundlibrary.html work. Specify in speak or ssml as `<audio src="soundbank://soundlibrary/animals/amzn_sfx_bear_groan_roar_01"/>`. Details and discussion please at https://forum.iobroker.net/topic/27509/ssml-audio

### alexa2.0.Echo-Devices.Serialnumber.FireTVCommands.*
If a device is an Amazon FireTV then you can use the following commands:

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
| SerialNumber      | Serial number of Alexa device                                                               |

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
| ringNotificationsEnabled         | Shows if the ring notifications are enabled or not and allows to edit it (true/false). The status is updated from cloud with a device configuration interval               |
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
| nextTimeDate    | Contains the timepoint of the next expected triggering as unix epoch in ms                                   | Number     | Number
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
As usual using stable repository, the latest repository or uses the ioBroker "Install" options from GitHub

## Send Alexa Device Command sequences via messages
All commands to the alexa devices can be sent via the adapter to single devices or to groups. The adapter supports sending of these commands and - if needed - also combines them to set a specific volume before a voice output and restore the original volume afterward.

When you want to send custom sequences to alexa devices, you can create a Routine and trigger the routine also via the states.

If this is not flexible enough, the adapter offers since version 3.14.0 a way to send commands via messages.

You provide an array structure which will be converted to commands. There are two types of options for one array element:

**A command**
```json
{
    "command": "speak", // command like the state name in Commands states
    "value": "This is a test speak.", // value like value you set on state
    "device": "..." // optional: serialNumber of the device to send this command to
}
```

**A sequence definition**

```json
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

```json
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
If you still use the SMS/E-Mail based 2FA flow, then this might not work. Please update the 2FA/OTP method in the amazon settings to the current process! Not working could also mean that a Error 404/Page not found is shown. ALso then check and upgrade OTP settings!

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

## Changelog
<!-- ### __WORK IN PROGRESS__ -->

### __WORK IN PROGRESS__
* (Apollon77) Adjust Lists to recent Amazon changes
* (Apollon77) Adjust retrieving the Smart home device list to recent Amazon changes
* (Apollon77) Delete all ioBroker originated Smart Home devices because not controllable anyway
* (Apollon77) Adjust usage of some deprecated js-controller methods

### 3.26.7 (2024-10-24)
* (Apollon77) Fix Sentry integration

### 3.26.6 (2024-10-20)
* (simatec) Responsive Design added

### 3.26.5 (2024-04-16)
* (Apollon77) Adjust History query to recent Amazon changes

### 3.26.4 (2024-01-25)
* (Apollon77) Removed Weblink
* (Apollon77) Adjust History query to recent Amazon changes

### 3.26.3 (2023-11-25)
* (Apollon77) Fixed the proxy login process

### 3.26.2 (2023-11-24)
* (Apollon77) Removed infos how to get cookies manually because no longer available
* (Apollon77) Optimized Admin configuration order of settings for history
* (Apollon77) Fixed some crash cases reported by Sentry
* (Diginix/Apollon77) Added some more device types

### 3.26.1 (2023-11-08)
* (Apollon77) Fix missing text in Admin Config

### 3.26.0 (2023-11-08)
* (Apollon77) Automatically query of activity/history needs to be enabled manually (if you need it!)

### 3.25.5 (2023-10-29)
* (Apollon77) Optimize activity detection to process all relevant entries in all cases

### 3.25.4 (2023-10-27)
* (Apollon77) Optimize activity detection to process all relevant entries and not just the last one

### 3.25.3 (2023-10-27)
* (Apollon77) Adjust History update to work with recent Amazon changes

### 3.25.2 (2023-09-12)
* (Apollon77) Optimize reconnection handling for push connections

### 3.25.1 (2023-09-09)
* IMPORTANT: Minimum required Node-js version is 16 now!
* (Apollon77) Updated the Push connection after Amazon technology changes
* (Apollon77) Added some more device types

### 3.24.1 (2023-08-08)
* (Apollon77) Work around Amazon changes that affected all functions over the Push connection
* (Apollon77) Some smaller fixes and adjustments

### 3.23.2 (2022-11-30)
* (Apollon77) Prioritize real devices higher than app devices when serialnumbers overlap

### 3.23.1 (2022-11-26)
* (Apollon77) Enhance checks when changing smart device values
* (Apollon77) Try to prevent Amazon rate limiting (again)

### 3.21.0 (2022-11-03)
* IMPORTANT: Because of rate limits by Amazon, I decided to remove the update of smart home device values in intervals because it seems to produce too much load in Skills and Amazon systems.
* (Apollon77) Optimizes loading of smart home device states
* (Apollon77) Fixed issue with enabling/disabling of Alarms in combination with non-default music for the alarm
* (Apollon77) Prevented that Timers or Alarms that are long in the future to trigger their trigger state too early
* (Apollon77) Fixed deleting own user Messages state
* (Apollon77) Already request Notification updates when history registered a Notification action and do not wait for Push info to come in

### 3.20.1 (2022-10-29)
* (Apollon77) make sure caching works correctly with multiple instances of the adapter

### 3.20.0 (2022-10-29)
* (Apollon77) Increase minimum interval for requesting smart home device data to 15 minutes (900s) because of Amazon rate limits. Please do not try to work around it!
* (Apollon77) Cache Smart home device list and data to prevent too many requests when restarting adapter in short intervals and to prevent deleted smart home devices also on further rate limit issues

### 3.19.10 (2022-10-27)
* (Apollon77) Fix issue in retry handling when rate limit exceeded is returned by Amazon
* (Apollon77) Do not clean up Smart Home Device objects for now - delete manually if you remove a device

### 3.19.9 (2022-09-12)
* (Apollon77) Receive the correct player status again when musik is stopped

### 3.19.8 (2022-09-07)
* (Apollon77) Add safeguard for too high intervals

### 3.19.7 (2022-08-19)
* (Apollon77) Fix doNotDisturb when using a time string

### 3.19.6 (2022-08-18)
* (Apollon77) Fix doNotDisturb when using a time string

### 3.19.5 (2022-08-09)
* (Apollon77) Fix doNotDisturb for groups

### 3.19.4 (2022-08-07)
* (Apollon77) Prevent unwanted device Name updates

### 3.19.3 (2022-08-07)
* (Apollon77) Fix crash check with multiple adapter instances

### 3.19.2 (2022-08-06)
* (Apollon77) Fix Alarm creation when just providing time and it is for next day

### 3.19.1 (2022-08-04)
* (Apollon77) Fix retry handling

### 3.19.0 (2022-08-04)
* (Apollon77) Preserve Names as soon as it is an App type in general
* (Apollon77) Enhance checks and safeguards for polling intervals
* (Apollon77) Check for restart intervals that do not make sense and stop adapter if detected
* (Apollon77) Add additional crash-loop detection

### 3.18.6 (2022-07-19)
* (Apollon77) Fix deviceStop sequence command

### 3.18.5 (2022-07-19)
* (Apollon77) Fix crash case reported by Sentry
* (arteck) Add image for Fire Cube

### 3.18.3 (2022-07-18)
* (Apollon77) Fix doNotDisturb and doNotDisturb for All devices
* (Apollon77) Update do not disturb status after set for all devices
* (Apollon77) preserve a changed name for a "This device" device object

### 3.18.2 (2022-07-18)
* (Apollon77) Enable commands again for Apps with type A2TF17PFR55MTB - will only work sometimes as it seems

### 3.18.1 (2022-07-18)
* (Apollon77) Optimize Handling when push connection could not be established

### 3.18.0 (2022-07-18)
* IMPORTANT: Smart home device values are from now on only synchronized when enabled via #includeInIntervalQuery state. Enable only what's really needed!
* (Apollon77) Allow to query several more smart home device states (incl. the Echo own Temperature-Sensor if available) and more optimizations
* (Apollon77) Optimize querying smart home device states to only request relevant properties
* (Apollon77) Exclude some value types again from requesting from Amazon because they make no sense and will never contain meaningful data
* (Apollon77) Add FireTV commands for FireTV devices
* (Apollon77) Add CommandsAll.deviceStop and CommandsAll.deviceDoNotDisturb commands to be sent to all devices
* (Apollon77) Add Equalizer preferences (if supported by devices)
* (Apollon77) Add Speaker and AUX preferences (if supported by devices)
* (Apollon77) Add Display (enabled, brightness, adaptive brightness) preferences (if supported by devices)
* (Apollon77) Enhance doNotDisturb state to also allow specifying a enable duration or end timepoint
* (Apollon77) Add a fallback to update music player when a new history record mentions music as target for the spoken words. Could help as fallback when push infos are not coming in sometimes with Sonos
* (Apollon77) Delay initialization of push connection to when basic structures are initialized
* (Apollon77) Add some more devices

### 3.17.5 (2022-07-14)
* (Apollon77) Minimum smart home device query interval is now 5 minutes and not 1 minute anymore to remove some requests for now

### 3.17.4 (2022-07-13)
* (Apollon77) Make sure disabling query intervals really work (disabling smart home device and state and configuration was not possible)

### 3.17.3 (2022-07-12)
* (Apollon77) Prevent datatype warnings in log

### 3.17.2 (2022-07-12)
* (Apollon77) Another adjustment for smart home device data readings
* (Apollon77) Fix crash cases reported by Sentry

### 3.17.1 (2022-07-12)
* (Apollon77) Work around timing issues with speak-volume when using announcement
* (Apollon77) Correctly initialize volume/mute on startup also when player data are not available
* (Apollon77) Do not overwrite speak-volume (and some other fields) with null on adapter start
* (Apollon77) Fix crash cases reported by Sentry

### 3.17.0 (2022-07-11)
* (Apollon77) Add support to play Audible books in Music-Providers
* (Apollon77) Optimize deletion of alarms and reminders
* (Apollon77) Optimize requesting smart home device data

### 3.16.1 (2022-07-11)
* (Apollon77) Fix deletion and cancellation of Alarms and Reminders

### 3.16.0 (2022-07-11)
* (Apollon77) Add (official) support for Music-Alarms - they are now listed under "Alarms" together with the other Alarms! The "sound" list will contain the device specific music targets - so you can basically zse the ones that you created at least once via voice commands.
* (Apollon77) For a Music Alarm the "customVolume" on the alarm is used to set the normal device volume 2s before the alarm but do not (!) reset it afterwards
* (Apollon77) Prevent crashes on one time Alarms that just triggered

### 3.15.2 (2022-07-09)
* (Apollon77) Fix case where initialization of the adapter was never finished and so nothing was controllable when App devices where not synced

### 3.15.1 (2022-07-09)
* (Apollon77) Convert Smarthome device values if wrong datatype is delivered by device
* (Apollon77) Add handling for two more battery health states for smart home devices
* (Apollon77) Fix crash case when initializing notifications

### 3.15.0 (2022-07-09)
* (Apollon77) IMPORTANT: Format to specify multiple Details on "New" for Alarms and Reminders changed, see documentation!
* (Apollon77) Add Alarm/Reminder triggered state per device which will contain the ID of the alarm that got triggered when it is triggered
* (Apollon77) Add several more fields for Alarms and Reminders to show better the details of the alarm
* (Apollon77) Allow to cancel Reminders and Alarms as in the Alexa App
* (Apollon77) Allow to also edit Alarm/Reminder Dates additionally to the times
* (Apollon77) Allow to set a custom Volume for Reminders and Alarms - it will be set 2s before the expected trigger and restored afterwards
* (Apollon77) Calculate the "nextTriggerDate" as Timestamp of next expected triggering
* (Apollon77) Add a JSON-Array with all running timers and the "next id" as state
* (Apollon77) Allow to stop a timer by ID
* (Apollon77) Add the days-list of Alarms when configured for recurrency
* (Apollon77) Add new Commands skill and skillYours to start Skills
* (Apollon77) Add Notification volume, Ascending Alarm setting and default notification sounds as preferences
* (Apollon77) Slow down the initialization of all data a bit, so startup could take longer

### 3.14.0 (2022-07-06)
* (Apollon77) Allow to define if Lists and Smart home devices are synced by the adapter with the Amazon Cloud at all
* (Apollon77) Enhance Smart Home Device support by adding various controllers and states. If in your Alexa App something is configurable which is not in ioBroker please send a debug log!
* (Apollon77) Re-Introduce the ability to poll smart home device states in intervals, but only devices are queried that report their status proactively to Amazon-Cloud to prevent Skill developer costs! ioBroker (and OpenHab) devices are NOT queried! The interval can be configured but must not be lower than 60s! Querying is disabled by default.
* (Apollon77) Add message to send out sequences of commands to alexa devices
* (Apollon77) Add Info states for macAddress and WifiSSID of the Alexa devices
* (Apollon77) Add several new states for Player for allowed actions, medium quality
* (Apollon77) Add mediaId and also allow to set it to jump to a defined entry in the playlist
* (Apollon77) Add Commands.sound to play a sound
* (Apollon77) Do not set the speak-volume when executing textCommand and deviceStop
* (Apollon77) Do not set speak-volume if the volume is already as wanted when executing commands
* (Apollon77) update Do-Not-Disturb status once on start and with device configuration updates
* (Apollon77) Allow to specify the title in notification commands
* (Apollon77) When a device plays music in a group then new states in "Player"will indicate this together with the group ID
* (Apollon77) Allow to enable and disable smart home devices - this will be synced together with the smart home state updates from the cloud if changed in the app!
* (Apollon77) Detect Rate limit exceeded response and do one automatic request retry 10s later (plus a random part)
* (Apollon77) Slow down the update of player status to prevent rate limit exceeded errors. initial update of the player states is delayed on startup of the adapter
* (Apollon77) Restore character replacement for Music providers (space is now again a "-")
* (Apollon77) Add more devices
* (Apollon77) Optimize startup and unload handling

### 3.13.0 (2022-07-02)
* IMPORTANT List Names are now checked for invalid characters and replaced. Might change the name of objects in ioBroker. Old ones need to be deleted manually!
* (Apollon77) Fix command sending in multi owner environments (e.g. Family shared devices)
* (Apollon77) Add some new devices
* (ammawel) Add the date of an alarm as state, not only time
* (Apollon77) Add option to also query the App Devices to allow to send commands to them
* (Apollon77) Rework Multiroom for commands to prevent rate limiting issues!
* (Apollon77) Fix Routine Naming if triggers were used
* (Apollon77) Support devices with "Ziggy" as wake word
* (Apollon77) All commands with voice output respect the defined speak-volume now
* (Apollon77) Allow again to directly enter TuneIn station Ids (s*) and topicIds (t*)
* (Apollon77) Add media states to show remaining time of media playback
* (simatec) Adjust link color im Admin configuration
* (Apollon77) Some requests are automatically retried with a slight delay if Amazon responds with error 503

### 3.12.0 (2021-11-13)
* (Apollon77) SequenceNodes created for a device are now bound to the "deviceOwnCustomer" - should help in mixed owner groups
* (ammawel) Add recurringPattern for Notifications (see Readme)
* (Apollon77) Fix crash case
* (Apollon77) Make sure states are not set too early before objects are created

### 3.11.2 (2021-10-12)
* (Apollon77) Fix crash case (Sentry IOBROKER-ALEXA2-AT)

### 3.11.1 (2021-10-12)
* (Apollon77) Prevent warnings with js-controller 3.3

### 3.11.0 (2021-10-12)
* (Apollon77) Add support for Multi Utterance Routines
* (Apollon77) Fix object deletion for lists
* (Apollon77) Fix Creation of new Lists and add deletion support
* (Apollon77) Allow Commands for Stereo Pairs
* (Apollon77) Optimize Push Connection and History retrieval

### 3.10.4 (2021-10-11)
* IMPORTANT: Node.js 10 support is dropped, supports LTS versions of Node.js starting with 12.x
* (Apollon77) Update Push Connection

### 3.9.3 (2021-07-11)
* (Apollon77) Try to fix setting targetTemperature for ThermostatController

### 3.9.2 (2021-07-05)
* (Apollon77) Only ignore empty history entries if both, summary and alexaResponse is empty

### 3.9.1 (2021-06-04)
* (Apollon77) Fix cookie exchange and cookie validation checks

### 3.9.0 (2021-05-11)
* (Apollon77) Add some new devices
* (Apollon77) Always recognize "alexa" as wakeword to handle commands via the apps correctly

### 3.8.4 (2021-05-11)
* (Apollon77) Optimize Cookie refresh handling
* (Apollon77) Fix warnings from js-controller 3.3 and optimize

### 3.8.2 (2021-04-19)
* (Apollon77) Adjust automatic Cookie Refresh interval from 7 to 4 days

### 3.8.1 (2021-02-09)
* (Apollon77) Initialize volume for all devices on start

### 3.8.0 (2021-02-04)
* (Apollon77) Add configuration option to not write history entries where no command text was recognized

### 3.7.1 (2021-02-03)
* (Apollon77) add some more detected text into summary and answerText states (textCommand commands should be in history back again)

### 3.7.0 (2021-02-03)
* (Apollon77) IMPORTANT: History entries are now requested via a different data source because Amazon seems to tun off the old option. History.status is for this no longer filled, but new states were added. Only voice commands are reported ( textCommand entries not longer)
* (Apollon77) other optimizations in communications and prevent hammering amazon with requests in error cases

### 3.6.1 (2021-02-02)
* (fbeister) Add and adjust some known devices
* (Apollon77) Optimize object deletion

### 3.6.0 (2021-01-28)
* (Apollon77) Update Routines API because of amazon changes

### 3.5.6 (2021-01-22)
* (Apollon77) Catch error when deleting objects

### 3.5.4 (2021-01-22)
* (Apollon77) restart adapter when no initial cookie could be requested

### 3.5.2 (2021-01-17)
* (Apollon77) Prevent to write non-existing state values
* (Apollon77) Add and adjust some known devices

### 3.5.0 (2020-12-24)
* (Apollon77) Remove bespoken because textCommand is more flexible
* (Apollon77) Add and adjust some known devices, add Echo 4 image

### 3.4.0 (2020-12-11)
* (Apollon77) add support for textCommand - tell an Alexa device a text as you would speak it
* (Apollon77) make sure discovery of devices is still possible also after deleting all devices before

### 3.3.5 (2020-12-03)
* (Apollon77) make sure music providers with empty names do not produce errors

### 3.3.2 (2020-11-23)
* (Apollon77) prevent crash cases and optimize reconnection handling

### 3.3.1 (2020-07-24)
* (Apollon77) Further optimize Cookie handling

### 3.3.0 (2020-07-19)
* (Apollon77) Hopefully allow easier upgrades if old deviceId is invalid now
* (Apollon77) Allow to have separate deviceIds per instance

### 3.2.8 (2020-07-16)
* (Apollon77) Work around Amazon Security changes and make proxy working again

### 3.2.7 (2020-07-15)
* (Apollon77) Work around Amazon Security changes and make proxy working again
* (arteck) add echo studio

### 3.2.6 (2020-07-15)
* (Apollon77) Work around Amazon Security changes and make proxy working again

### 3.2.5 (2020-07-13)
* (Apollon77) Work around Amazon Security changes and make proxy working again 
* (Apollon77) fix Sentry crash case when Amazon do not respond correctly (IOBROKER-ALEXA2-1C)

### 3.2.4 (2020-06-18)
* (Apollon77) Update Alexa-Remote Library to optimize communication error/timeout cases

### 3.2.3 (2020-06-17)
* (Apollon77) Fix currentState handling

### 3.2.2 (2020-06-17)
* (Apollon77) remove goodnight because was not working
* (Apollon77) Fix Play/Pause states and some media optimizations

### 3.2.1 (2020-06-17)
* (Apollon77) update amazon-cookie library: another optimization for Node.js 14

### 3.2.0 (2020-06-17)
* (Apollon77/hive) add new commands, jokes/facts/goodnight/cleanup
* (Apollon77/hive) add new command curatedtts with allowed values ["goodbye", "confirmations", "goodmorning", "compliments", "birthday", "goodnight", "iamhome"] to play random curated sentences
* (Apollon77) Prevent some crashes
* (Apollon77) Make sure Timer are not triggering the state when deleted
* (Apollon77) make sure that Lists objects are deleted correctly when deleting
* (Apollon77) Make compatible with nodejs 14
* (Apollon77) Adjust to changes from Amazon so that initial Proxy process works again
* (OberstVonGatow) Make sure that for Spotify Media data requests do not have negative effects and stop the playback

### 3.1.2 (2020-03-18)
* (Gieskanne/Apollon77) Add Next Timer Date as state
* (Apollon77) Fix missing history entries
* (Apollon77) Prevent List deletions from logging errors
* (Apollon77) optimiztions, dependency updates and fixes
* (Apollon77) Switch to ioBroker own sentry instance
* (Apollon77) add Info.softwareVersion

### 3.0.8 (2020-01-19)
* (Apollon77) fix some crash cases
* (Apollon77) Update Sentry DSN and add filtering
* (Apollon77) Update deps

### 3.0.7 (2019-12-28)
* (Apollon77) Prevent some errors

### 3.0.6 (2019-12-26)
* (Apollon77) Prevent some errors

### 3.0.5 (2019-12-25)
* (Apollon77) Prevent some errors

### 3.0.4 (2019-12-24)
* (Apollon77) Prevent some errors

### 3.0.3 (2019-12-24)
* Adapter needs nodejs 8+ and js-controller 2.0 now!
* (Zefau) add functionality for handling of lists
* (Apollon77) Add answerText when available from history
* (Apollon77) handle error for empty valueMaps for ColorTemperatures
* (Apollon77) also support names for new special routines (Alarm Notifications, Sensor Detections, ..)
* (Apollon77) GitHub Actions for Test& Build
* (Apollon77) Add Sentry for error reporting
* (Apollon77) prevent some crashed after changes by Amazon
* (Apollon77) fix Routine names after changes by Amazon
* (Apollon77) add some devices and new images
* (Apollon77) Add more situations to update player status because amazon send no info anymore on title changes

### 2.6.4 (2019-07-25)
* (Apollon77) add some error handling for contacts

### 2.6.1 (2019-07-22)
* (Apollon77) add new device
* (Apollon77) fix volume logic for ssml
* (Apollon77) Allow reminders to bet set >+ 1day

### 2.6.0 (2019-07-21)
* (Apollon77) added possibility to send text messages to users including himself, allows deletion of all messages to himself
* (Apollon77) added option to reset Cookies. After sahev the adapter will restart and needs to get a new Login (see adapter config)
* (Apollon77) change announcement and ssml to send commands more synchronous

### 2.5.0/1 (2019-07-07/18)
* (INgoRah) Support compact mode
* (Apollon77) enhance error handling for broken authentications

### 2.4.6 (2019-07-05)
* (Apollon77) enhance error handling for broken authentications

### 2.4.5 (2019-07-01)
* (Apollon77) enhance error handling for broken authentications

### 2.4.4 (2019-06-26)
* (Apollon77) new devices added

### 2.4.3 (2019-06-25)
* (Apollon77) enhance error handling for Amazon Push Infos

### 2.4.1/2 (2019-06-23)
* (Apollon77) Allow to specify an external docker container IP to override Proxy-IP
* (Apollon77) Add more Devices from GitHub
* (Apollon77) try to work around an Image URL bug from Amazon
* (Apollon77) optimize Admin display of Status/Link
* (Apollon77) add Link to https://alexa.amazon.com to Admin instance overview
* (Apollon77) Remove Admin2 support
* (Apollon77) Optimize Handling from DNS errors (hopefully) to prevent stopped Adapters on Internet/DNS problems

### 2.3.3 (2019-06-21/22)
* (Apollon77) adjust to current Amazon changes
* (Apollon77) fix volume handling
* (Apollon77) Add some more devices
* (Apollon77) Logging reduced
* (Apollon77) unknown devices get commands activated automatically
* (Apollon77) remove Email/Password fields and add info about login to Admin screen (still needs to be polished, only Admin v3)
* (Apollon77) detect App-Devices and remove them from the list because they are not usable in any way

### 2.2.0 (2019-01-xx) [unpublished]
* (Apollon77) add new sequenceCommands "calendarNext", "calendarToday", "calendarTomorrow"
* (Apollon77) fix wake word handling and history sanitizing

### 2.1.0 (2019-01-13) [unpublished]
* (Apollon77) cookie handling completely rewritten, no email/password anymore, only Proxy (still only from log)
* (Apollon77) fixes routine triggering that triggered on wrong device sometimes
* (Apollon77) added new commands "deviceStop", "announcement", "notification", and "ssml" (see documentation above)

### 1.1.3 (2018-11-17)
* (Apollon77) optimize cookie handling again

### 1.1.2 (2018-11-17)
* (Apollon77) new devices
* (Apollon77) make proxy for cookies work again

### 1.1.1 (2018-11-09)
* (Apollon77) new devices
* (Apollon77) make proxy for cookies work again

### 1.1.0 (2018-09-18)
* (Apollon77) Further optimizations to lower number of requests
* (Apollon77) Experimental support for Playlist IDs (p1234567) in TuneIn-Station

### 1.0.1 (2018-09-16)
* (Apollon77) fixes and important changes to make sure not too many requests are sent

### 1.0.0 (2018-09-06)
* (Apollon77) polishng and finalization, make it 1.0.0

### 0.7.5 (2018-09-04)
* (Apollon77) speak can now contain separated text by semicolons. These Texts will then be spoken sequencially. So the old limit if 250 characters is only existing for one such text part. So, now longer texts are possible too. Separate it with a semicolon.
* (Apollon77) more color handling fixes

### 0.7.0 (2018-08-30)
* (Apollon77) Add Bespoken Virtual device support to be able to interact with Alexa infrastructure
* (Apollon77) add new Device Types for Smarthome-integration (Contact and Motion sensors)

### 0.6.4 (2018-08-30)
* (Apollon77) fixes to colorhandling
* (Apollon77) allow to deliver a volume together with aspeak command by using "80;text" and then volume is set before speak and reset afterwards. Experimental!

### 0.6.1 (2018-08-24)
* (Apollon77) sometimes new alarms were not triggered in adapter
* (Apollon77) add support to control smart devices and groups (and also add groups). Because I was only able to test a few types i added logging. please check log, try out and report back!
* (Apollon77) When routines are executed via voice command and push connection is enabled the routine state is also triggered by "true" with ack=true when routine trigger text is matching exactly to spoken text
* (Apollon77) corrected volume and mute handling in states, a volume of 0 is also seen as "muted" if muting flag is not supported by device
* (Apollon77) when speak text is coming from cloud adapter and contains SSML tags they will be filtered out, so you can use a speak endpoint directly to output response from Smart Home skill actions

### 0.5.2 (2018-08-16)
* (Apollon77) fix an error when getting new cookie
* (Apollon77) add new "Playlist" states for the Music providers to directly prepend "playlist" :-)
* (Apollon77) Volumes are not updated for multiroom devices when === 0
* (Apollon77) Add Reminder and Alarms support. Write time and pot. text separated by comma into the "New" stat to create a new one (e.g. "10:00:00, Test-Reminder")
* (Apollon77) Also with Push-Connection some times states are generally updated to make sure data are correct (e.g. player media info will disappear 2h after stopping the music)
* (Apollon77) Added some more deviceTypes

### 0.4.0 (2018-08-13)
* (Apollon77) internal Refactoring
* (Apollon77) states that are not needed anymore will be removed. This will be logged for now, so please check this and give feedback!
* (Apollon77) sanitized music provider state names (spaces are now dashes ... should be removed automatically)
* (Apollon77) Renamed TuneIn-Direct to TuneIn-Station (even if you still can enter text to search, this works with stations too) ... should be removed automatically)
* (Apollon77) Device and Bluetooth status is now also checked at states update
* (Apollon77) After enabling Push-Connection the configured polling is turned off and anything is done based on real time informations from Alexa. Test it
* (Apollon77) Enhanced History states to include the status of the action (SUCCESS, FAIL ...), infos from returned cards (if available) and info on accessed skill for this action.
* (Apollon77) When using Push-Connection History update is also updated automatically. An empty summary with status DISCARDED_NON_DEVICE_DIRECTED_INTENT means the activation of the echo by saying the wake word
* (Bluefox) Add icons for some of the devices for Admin

### 0.3.8 (2018-07-27)
* (Apollon77) Several Multiroom-fixes
* (Apollon77) fixed shuffle/repeat
* (Apollon77) fixed status for play, pause, shuffle and repeat

### 0.3.4 (2018-07-27)
* (Apollon77) Only 20 Routines were queried, now up to 2000
* (Apollon77) Also allow commands including speak for multiroom, BUT it is triggered per device, so NO synchronous audio output!!
* (Apollon77) Thanks to Matten-Matten also Music-provers can be started on multiroom devices

### 0.3.2 (2018-07-25)
* (Apollon77) Fix volume settings for multiroom devices (please report other devices where it is not working)
* (Apollon77) Add serial number and name to Info

### 0.3.0 (2018-07-24)
* (Bluefox) Admin3 fixes and slight changes to roles and code
* (Apollon77) Reworked state names (hopefully last time!)
* (Apollon77) Combine Player-Control and Player-Info into channel Player to support better detection and material support
* (Apollon77) Added further information in Infos states per echo device
* (Apollon77) Try to detect the type of the device different and decide if commands are available or not (till capabilities are known better)
* (Apollon77) New "Music-Provider" states depending on available music providers with possibility to enter a text to play something (same as you would speak it)
* (Apollon77) Volume is send different now, so that it also works when Device player get's inactive

### 0.2.4 (2018-07-22)
* (pix) materialize settings window
* (Apollon77) WOn IP is set automatically with IP from first network interface
* (Apollon77) fix comma replacements in speaks, do not speak empty text
* (Apollon77) if Device is Multiroom, the do not create Routines and Commands and not bluetooth
* (Apollon77) add information about multiroom device and master (later we can use this to sort out commands that are impossible with multiroom)
* (Apollon77) History is also stored as JSON, so it can be used to monitor one datapoint and have all infos on updateState
* (Apollon77) Several other fixes

### 0.2.3 (2018-07-20)
* (Apollon77) in Numbers with . are replaced by commas

### 0.2.2 (2018-07-20)
* (Apollon77) Finally fix device renaming

### 0.2.1 (2018-07-20)
* (Apollon77) Small fix of history channel type and setting states initially

### 0.2.0 (2018-07-20) (as iobroker.alexa2)
* (Apollon77) 0.2.0: added many Player-Info datapoints including "progress updates " when media is playing
* (Apollon77) 0.2.0: removed "Notifications" because the only benefit for now is to show them, no interaction or change possible
* (Apollon77) 0.2.0: adapter now allows to configure intervals for history updates and other data updates like player info
* (Apollon77) 0.2.0: if cookie could not be determined correctly a proxy is started to allow manual login and cookie is catched in the background on success
* (Apollon77) 0.2.0: add info datapoints for connection (connected to Alexa), cookie and csrf
* (Apollon77) 0.2.0: rework complete logic to not use soef library anymore
* (Apollon77) 0.2.0: Speaking free text at any timepoint is available under Commands.speak
* (Apollon77) 0.2.0: Sequence-Commands (weather, traffic, flashbriefing, goodmorning, singasong, tellstory) are available to be triggered under "Commands"
* (Apollon77) 0.2.0: Automation-Routines are now available to be triggered per device under "Routines"
* (Apollon77) 0.2.0: Automatically use different user-agents for Win32, MacOS and Linux based systems
* (Apollon77) 0.2.0: Automatically use different user-agents for Win32, MacOS and Linux based systems
* (Apollon77) 0.2.0: Also support entering TuneIn-Station IDs ("s" plus 4-6 digits) to play that station

### 0.1.0 (2018-07-10)
* (Apollon77) get Adapter working again, especially getting cookie and optimize refresh

### 0.0.x
* soef versions

## License

The MIT License (MIT)

Copyright (c) 2018-2025 Ingo Fischer <iobroker@fischer-ka.de>, 2017-2018 soef <soef@gmx.net>

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
