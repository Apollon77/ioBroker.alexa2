// Texts for the status line in the instance settings (admin/jsonConfig.json -> textSendTo "getStatusInfoText").
// Taken over unchanged from the former admin/words.js (keys ProxyInfo / StatusInfo). %s is replaced by the backend.

/** Shown while the login proxy is active, %s = proxy URL */
const PROXY_INFO: Record<string, string> = {
    en: 'Please click <a href="%s" target="_blank">here to log in to your Amazon Account once</a> to activate the connection to your Alexa devices for this instance.',
    de: 'Bitte den <a href="%s" target="_blank">folgenden Link zur einmaligen Anmeldung im Amazon-Konto</a> nutzen, um die Adapterverbindung zu Ihren Alexa-Geräten zu aktivieren.',
    es: 'Haga clic <a href="%s" target="_blank">aquí para iniciar sesión en su cuenta de Amazon una vez</a> para activar la conexión a sus dispositivos Alexa para esta instancia.',
    fr: 'Veuillez cliquer <a href="%s" target="_blank">ici pour vous connecter une fois à votre compte Amazon</a> afin d\'activer la connexion à vos appareils Alexa pour cette instance.',
    hu: 'Kattintson a <a href="%s" target="_blank"> címre az Amazon Account belépéshez </a> és az Amazon eszközének aktíválásához.',
    it: 'Fai clic <a href="%s" target="_blank">qui per accedere al tuo account Amazon una volta</a> per attivare la connessione ai tuoi dispositivi Alexa per questa istanza.',
    nl: 'Klik <a href="%s" target="_blank">hier om u eenmaal aan te melden bij uw Amazon-account</a> om de verbinding met uw Alexa-apparaten voor deze instantie te activeren.',
    pl: 'Kliknij <a href="%s" target="_blank">tutaj, aby zalogować się raz na swoje konto Amazon</a>, aby aktywować połączenie z urządzeniami Alexa dla tej instancji.',
    pt: 'Clique <a href="%s" target="_blank">aqui para fazer login em sua conta Amazon</a> para ativar a conexão com seus dispositivos Alexa para esta instância.',
    ru: 'Нажмите <a href="%s" target="_blank">здесь, чтобы войти в свою учетную запись Amazon один раз</a>, чтобы активировать подключение к вашим устройствам Alexa для этого экземпляра.',
    uk: 'Клацніть <a href="%s" target="_blank">тут, щоб один раз увійти у свій обліковий запис Amazon</a>, щоб активувати підключення до ваших пристроїв Alexa для цього випадку.',
    'zh-cn': '请单击<a href="%s" target="_blank">此处登录您的亚马逊账户一次</a>，为该实例激活与您的 Alexa 设备的连接。',
};

/** Shown when the cookie is valid, %s = date of the last cookie update */
const STATUS_INFO: Record<string, string> = {
    en: 'Alexa-Cookies are up to date and last updated on %s',
    de: 'Alexa-Cookies sind aktuell und zuletzt aktualisiert am %s',
    es: 'Las cookies de Alexa están actualizadas y actualizadas por última vez en %s',
    fr: 'Les cookies Alexa sont à jour et mis à jour pour la dernière fois le %s',
    hu: 'Az Alexa-sütik naprakészek, utolsó frissítés időpontja: %s',
    it: "Alexa-Cookies sono aggiornati e aggiornati per l'ultima volta su %s",
    nl: 'Alexa-cookies zijn up-to-date en voor het laatst bijgewerkt op %s',
    pl: 'Alexa-Cookies są aktualne i ostatnio aktualizowane w %s',
    pt: 'Os cookies da Alexa são atuais e foram atualizados pela última vez em %s',
    ru: 'Alexa-Cookies обновлены и обновлены до %s',
    uk: 'Файли cookie Alexa оновлені та останнє оновлення %s',
    'zh-cn': 'Alexa-Cookies是最新的，最后更新于％s',
};

function translate(texts: Record<string, string>, lang: string | undefined, value: string): string {
    return (texts[lang || 'en'] || texts.en).replace('%s', value);
}

/**
 * Builds the answer for the "getStatusInfoText" message (JsonConfig textSendTo)
 *
 * @param proxyUrl URL of the login proxy or null if the proxy is not active
 * @param cookieTimestamp formatted date of the last cookie update
 * @param lang language of the admin user
 */
export function getStatusInfoText(
    proxyUrl: string | null,
    cookieTimestamp: string | number,
    lang: string | undefined,
): { text: string; icon: string; iconStyle: { width: number; height: number } } {
    if (proxyUrl !== null) {
        return {
            text: translate(PROXY_INFO, lang, proxyUrl),
            icon: 'warning.png',
            iconStyle: { width: 60, height: 60 },
        };
    }
    return {
        text: translate(STATUS_INFO, lang, String(cookieTimestamp)),
        icon: 'info.png',
        iconStyle: { width: 60, height: 60 },
    };
}
