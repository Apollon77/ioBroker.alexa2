// Augments the globally declared ioBroker types with everything this adapter adds.
// Keep in sync with `native` in io-package.json and with admin/jsonConfig.json.
import type { AlexaCookieData, MacDms } from './types';

declare global {
    namespace ioBroker {
        interface AdapterConfig {
            /** Amazon cookie string, written by the adapter after a successful login */
            cookie: string;
            /** CSRF token, written by the adapter after a successful login */
            csrf: string;
            /** Full registration data from alexa-cookie2, written by the adapter. Reset to '' by "resetCookies" */
            cookieData: AlexaCookieData | string | null;
            alexaServiceHost: string;
            /** Not editable anymore, always '' (login only via proxy) */
            email: string;
            /** Not editable anymore, always '' (login only via proxy) */
            password: string;
            userAgent: string;
            acceptLanguage: string;
            cookieLoginUrl: string;
            proxyOwnIp: string;
            /** 0 = random port */
            proxyPort: number;
            proxyListenBind: string;
            /** Seconds, 0 = disabled */
            updateConfigurationInterval: number;
            /** Seconds, 0 = disabled */
            updateStateInterval: number;
            /** Seconds, 0 = disabled */
            updateHistoryInterval: number;
            usePushConnection: boolean;
            proxyOverrideIp: string;
            resetCookies: boolean;
            historyIgnoreEmptySummary: boolean;
            /** Written by the adapter after a successful login */
            macDms: MacDms | null;
            includeAppDevices: boolean;
            synchronizeLists: boolean;
            synchronizeSmartHomeDevices: boolean;
            autoQueryActivityOnTrigger: boolean;
        }
    }
}

export {}; // needed so that the file is treated as a module
