// UI strings in English and Gujarati. Content language follows the UI
// language unless the technician types in the other script.

const STRINGS = {
  en: {
    appName: 'Metro Fix Assist',
    tagline: 'Offline troubleshooting from your manuals',
    offlineReady: 'Works offline',
    offlinePreparing: 'Saving for offline…',
    offlineNoSw: 'Online only',
    tabAssist: 'Assist',
    tabManuals: 'Manuals',
    tabHelp: 'Help',
    describeLabel: 'Describe the fault',
    describePlaceholder: 'e.g. door keeps reopening, code E12',
    speak: 'Speak',
    listening: 'Listening…',
    photo: 'Photo',
    liveCamera: 'Live camera',
    find: 'Find steps',
    quickPicks: 'Common equipment',
    results: 'Matching procedures',
    noResults: 'No matching procedure found. Try other words, the fault code, or the equipment name.',
    matched: 'Matched',
    manualPage: 'Manual page',
    source: 'Source',
    safety: 'Safety first',
    tools: 'Tools',
    steps: 'Steps',
    stepOf: (a, b) => `Step ${a} of ${b}`,
    prev: 'Back',
    next: 'Next',
    done: 'Done',
    finish: 'Finish',
    readAloud: 'Read aloud',
    stop: 'Stop',
    openAR: 'Open in AR',
    openVR: 'Open in VR',
    cameraOverlay: 'Camera view',
    showPage: 'Show manual page',
    back: 'Back',
    close: 'Close',
    xrHintQuest: 'Point the controller (or pinch) at a surface and press the trigger to pin the steps next to the equipment.',
    xrHintPhone: 'Move the phone slowly to find a surface, then tap to pin the steps next to the equipment.',
    xrPlace: 'Tap to pin here',
    xrExit: 'Exit',
    xrRecenter: 'Bring panel here',
    photoAnalysing: 'Reading photo on device…',
    photoLoadingOcr: 'Loading text reader (first time only)…',
    photoFound: 'From photo',
    photoAsset: 'Equipment tag',
    photoCodes: 'Fault codes',
    photoText: 'Text read',
    photoNothing: 'No text or tag recognised. Describe the fault instead, or retake the photo closer and in good light.',
    capture: 'Capture',
    manualsTitle: 'Manuals on this device',
    importPdf: 'Import PDF manual',
    importing: 'Importing',
    importOcr: 'Scanned page, reading text',
    importDone: (n) => `Imported ${n} sections`,
    importFailed: 'Could not read this PDF',
    sections: 'sections',
    pages: 'pages',
    builtin: 'Built-in demo',
    remove: 'Remove',
    removeConfirm: 'Remove this manual from the device?',
    storage: 'Storage used',
    langName: 'English',
    voiceUnsupported: 'Voice input is not available in this browser. Please type the fault.',
    voiceOffline: 'Voice input needs the offline speech pack for this language (Android: Settings › Google › Voice › Offline speech).',
    cameraUnavailable: 'Camera is not available here. Use Photo to pick an image instead.',
    xrUnavailable: 'AR/VR is not available on this device. Showing camera view instead.',
    demoNote: 'Demo content',
    mrBrakeTitle: 'Brake Control Unit: mixed reality guide',
    mrBrakeSub: 'Anchor the 3D unit, see the fault, follow the steps with your hands (Quest 3 / phone)',
    open3d: '3D / MR brake unit',
    procedure: 'Procedure',
    confidence: 'match',
    helpHtml: `
      <h3>Use it</h3>
      <ol>
        <li>Type or speak what is wrong, or take a <b>photo</b> of the fault code display or the equipment QR tag.</li>
        <li>Pick the matching procedure. Safety notes come first, then numbered steps you can tick off.</li>
        <li>Tap <b>Open in AR</b> to pin the steps in space next to the equipment and keep your hands free.</li>
      </ol>
      <h3>Meta Quest 3</h3>
      <p>Open this page in the Meta Quest Browser and tap <b>Open in AR</b>. Passthrough turns on. Point a controller or pinch to place the panel, and use the panel buttons to move between steps.</p>
      <h3>Phones</h3>
      <p><b>Android (Chrome):</b> full AR with surface detection. <b>iPhone:</b> Safari has no WebXR, so the app uses the camera view with the steps on top.</p>
      <h3>Offline</h3>
      <p>Open the app once with a connection, or install it with <b>Add to Home screen</b>. After that, the app, its manuals, the text reader and the photo reader all run on the device, with no network needed. Imported PDFs are stored on this device only.</p>
      <h3>Your own manuals</h3>
      <p>Under <b>Manuals</b>, import any PDF. Text PDFs are split into sections and steps by their headings and numbered lists. Scanned pages go through on-device text recognition (English and Gujarati).</p>
      <p class="muted">The built-in manual is demo content for trying the app, not an official procedure.</p>`,
  },
  gu: {
    appName: 'મેટ્રો ફિક્સ આસિસ્ટ',
    tagline: 'તમારી મેન્યુઅલમાંથી ઓફલાઇન ખામી નિવારણ',
    offlineReady: 'ઓફલાઇન ચાલે છે',
    offlinePreparing: 'ઓફલાઇન માટે સાચવી રહ્યું છે…',
    offlineNoSw: 'ફક્ત ઓનલાઇન',
    tabAssist: 'સહાય',
    tabManuals: 'મેન્યુઅલ',
    tabHelp: 'મદદ',
    describeLabel: 'ખામીનું વર્ણન કરો',
    describePlaceholder: 'દા.ત. દરવાજો વારંવાર ખૂલે છે, કોડ E12',
    speak: 'બોલો',
    listening: 'સાંભળી રહ્યું છે…',
    photo: 'ફોટો',
    liveCamera: 'લાઇવ કેમેરા',
    find: 'પગલાં શોધો',
    quickPicks: 'સામાન્ય સાધનો',
    results: 'મળતી પ્રક્રિયાઓ',
    noResults: 'કોઈ મળતી પ્રક્રિયા મળી નથી. બીજા શબ્દો, ફોલ્ટ કોડ અથવા સાધનનું નામ અજમાવો.',
    matched: 'મળેલા શબ્દો',
    manualPage: 'મેન્યુઅલ પાનું',
    source: 'સ્રોત',
    safety: 'પહેલાં સલામતી',
    tools: 'સાધનો',
    steps: 'પગલાં',
    stepOf: (a, b) => `પગલું ${toGuDigits(a)} / ${toGuDigits(b)}`,
    prev: 'પાછળ',
    next: 'આગળ',
    done: 'થઈ ગયું',
    finish: 'પૂર્ણ',
    readAloud: 'મોટેથી વાંચો',
    stop: 'બંધ કરો',
    openAR: 'AR માં ખોલો',
    openVR: 'VR માં ખોલો',
    cameraOverlay: 'કેમેરા વ્યૂ',
    showPage: 'મેન્યુઅલ પાનું બતાવો',
    back: 'પાછળ',
    close: 'બંધ કરો',
    xrHintQuest: 'કંટ્રોલર (અથવા ચપટી) સપાટી તરફ રાખો અને ટ્રિગર દબાવી પગલાં સાધનની બાજુમાં મૂકો.',
    xrHintPhone: 'સપાટી શોધવા ફોન ધીમે ફેરવો, પછી ટૅપ કરી પગલાં સાધનની બાજુમાં મૂકો.',
    xrPlace: 'અહીં મૂકવા ટૅપ કરો',
    xrExit: 'બહાર નીકળો',
    xrRecenter: 'પેનલ અહીં લાવો',
    photoAnalysing: 'ઉપકરણ પર ફોટો વાંચી રહ્યું છે…',
    photoLoadingOcr: 'ટેક્સ્ટ રીડર લોડ થાય છે (ફક્ત પહેલી વાર)…',
    photoFound: 'ફોટોમાંથી',
    photoAsset: 'સાધન ટેગ',
    photoCodes: 'ફોલ્ટ કોડ',
    photoText: 'વાંચેલું લખાણ',
    photoNothing: 'કોઈ લખાણ કે ટેગ ઓળખાયું નહીં. ખામીનું વર્ણન કરો, અથવા સારા પ્રકાશમાં નજીકથી ફરી ફોટો લો.',
    capture: 'ફોટો લો',
    manualsTitle: 'આ ઉપકરણ પરની મેન્યુઅલ',
    importPdf: 'PDF મેન્યુઅલ ઇમ્પોર્ટ કરો',
    importing: 'ઇમ્પોર્ટ થાય છે',
    importOcr: 'સ્કેન કરેલું પાનું, લખાણ વાંચી રહ્યું છે',
    importDone: (n) => `${toGuDigits(n)} વિભાગો ઇમ્પોર્ટ થયા`,
    importFailed: 'આ PDF વાંચી શકાઈ નહીં',
    sections: 'વિભાગો',
    pages: 'પાનાં',
    builtin: 'બિલ્ટ-ઇન ડેમો',
    remove: 'દૂર કરો',
    removeConfirm: 'આ મેન્યુઅલ ઉપકરણમાંથી દૂર કરવી છે?',
    storage: 'વપરાયેલ સ્ટોરેજ',
    langName: 'ગુજરાતી',
    voiceUnsupported: 'આ બ્રાઉઝરમાં વોઇસ ઇનપુટ ઉપલબ્ધ નથી. કૃપા કરીને ખામી લખો.',
    voiceOffline: 'વોઇસ ઇનપુટ માટે આ ભાષાનું ઓફલાઇન સ્પીચ પેક જરૂરી છે (Android: Settings › Google › Voice › Offline speech).',
    cameraUnavailable: 'અહીં કેમેરા ઉપલબ્ધ નથી. તેના બદલે ફોટો પસંદ કરો.',
    xrUnavailable: 'આ ઉપકરણ પર AR/VR ઉપલબ્ધ નથી. તેના બદલે કેમેરા વ્યૂ બતાવે છે.',
    demoNote: 'ડેમો સામગ્રી',
    mrBrakeTitle: 'બ્રેક કંટ્રોલ યુનિટ: મિક્સ્ડ રિયાલિટી માર્ગદર્શિકા',
    mrBrakeSub: '3D યુનિટ એન્કર કરો, ખામી જુઓ, હાથથી પગલાં અનુસરો (Quest 3 / ફોન)',
    open3d: '3D / MR બ્રેક યુનિટ',
    procedure: 'પ્રક્રિયા',
    confidence: 'મેળ',
    helpHtml: `
      <h3>ઉપયોગ</h3>
      <ol>
        <li>શું ખરાબ છે તે લખો કે બોલો, અથવા ફોલ્ટ કોડ ડિસ્પ્લે કે સાધનના QR ટેગનો <b>ફોટો</b> લો.</li>
        <li>મળતી પ્રક્રિયા પસંદ કરો. પહેલાં સલામતી સૂચનાઓ, પછી ક્રમાંકિત પગલાં જે તમે ટિક કરી શકો.</li>
        <li><b>AR માં ખોલો</b> ટૅપ કરી પગલાં સાધનની બાજુમાં હવામાં મૂકો, જેથી હાથ મુક્ત રહે.</li>
      </ol>
      <h3>Meta Quest 3</h3>
      <p>Meta Quest Browser માં આ પાનું ખોલો અને <b>AR માં ખોલો</b> ટૅપ કરો. પાસથ્રુ ચાલુ થશે. પેનલ મૂકવા કંટ્રોલર તાકો અથવા ચપટી કરો, અને પગલાં બદલવા પેનલનાં બટન વાપરો.</p>
      <h3>ફોન</h3>
      <p><b>Android (Chrome):</b> સપાટી ઓળખ સાથે સંપૂર્ણ AR. <b>iPhone:</b> Safari માં WebXR નથી, તેથી એપ કેમેરા વ્યૂ પર પગલાં બતાવે છે.</p>
      <h3>ઓફલાઇન</h3>
      <p>કનેક્શન સાથે એપ એક વાર ખોલો, અથવા <b>Add to Home screen</b> થી ઇન્સ્ટોલ કરો. પછી એપ, મેન્યુઅલ, ટેક્સ્ટ રીડર અને ફોટો રીડર બધું ઉપકરણ પર જ ચાલે છે, નેટવર્કની જરૂર નથી. ઇમ્પોર્ટ કરેલી PDF ફક્ત આ ઉપકરણ પર સંગ્રહાય છે.</p>
      <h3>તમારી પોતાની મેન્યુઅલ</h3>
      <p><b>મેન્યુઅલ</b> હેઠળ કોઈપણ PDF ઇમ્પોર્ટ કરો. ટેક્સ્ટ PDF તેનાં શીર્ષકો અને ક્રમાંકિત યાદીઓ પ્રમાણે વિભાગો અને પગલાંમાં વહેંચાય છે. સ્કેન કરેલાં પાનાં ઉપકરણ પર ટેક્સ્ટ ઓળખ (અંગ્રેજી અને ગુજરાતી)થી વંચાય છે.</p>
      <p class="muted">બિલ્ટ-ઇન મેન્યુઅલ એપ અજમાવવા માટેની ડેમો સામગ્રી છે, સત્તાવાર પ્રક્રિયા નથી.</p>`,
  },
};

export const EQUIPMENT_CHIPS = [
  { type: 'door', en: 'Train door', gu: 'ટ્રેન દરવાજો', icon: '🚪' },
  { type: 'psd', en: 'Platform door', gu: 'પ્લેટફોર્મ દરવાજો', icon: '🚧' },
  { type: 'escalator', en: 'Escalator', gu: 'એસ્કેલેટર', icon: '↗️' },
  { type: 'lift', en: 'Lift', gu: 'લિફ્ટ', icon: '🛗' },
  { type: 'hvac', en: 'Air-con', gu: 'એર-કન્ડિશન', icon: '❄️' },
  { type: 'traction', en: 'Traction', gu: 'ટ્રેક્શન', icon: '⚡' },
  { type: 'brake', en: 'Brakes', gu: 'બ્રેક', icon: '🛑' },
  { type: 'pump', en: 'Sump pump', gu: 'સમ્પ પંપ', icon: '💧' },
  { type: 'fire', en: 'Fire panel', gu: 'ફાયર પેનલ', icon: '🔥' },
  { type: 'afc', en: 'Ticket gate', gu: 'ટિકિટ ગેટ', icon: '🎫' },
  { type: 'pis', en: 'Display / PA', gu: 'ડિસ્પ્લે / PA', icon: '📢' },
  { type: 'tvf', en: 'Tunnel fan', gu: 'ટનલ પંખો', icon: '🌀' },
  { type: 'aps', en: 'Battery', gu: 'બેટરી', icon: '🔋' },
];

const GU_DIGITS = '૦૧૨૩૪૫૬૭૮૯';
export function toGuDigits(n) {
  return String(n).replace(/[0-9]/g, (d) => GU_DIGITS[d]);
}
export function fromGuDigits(s) {
  return s.replace(/[૦-૯]/g, (d) => String(GU_DIGITS.indexOf(d)));
}

export const GUJARATI_RE = /[઀-૿]/;
export function detectLang(text) {
  const gu = (text.match(/[઀-૿]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return gu > latin * 0.3 ? 'gu' : 'en';
}

let current = 'en';
try {
  current = localStorage.getItem('mfa.lang') || ((navigator.language || '').startsWith('gu') ? 'gu' : 'en');
} catch {}
const listeners = new Set();

export function getLang() { return current; }
export function setLang(lang) {
  if (lang === current) return;
  current = lang;
  try { localStorage.setItem('mfa.lang', lang); } catch {}
  document.documentElement.lang = lang;
  listeners.forEach((fn) => fn(lang));
}
export function onLangChange(fn) { listeners.add(fn); }

export function t(key, ...args) {
  const v = STRINGS[current][key] ?? STRINGS.en[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}
export function tl(lang, key, ...args) {
  const v = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}

// Fill [data-i18n] / [data-i18n-placeholder] elements.
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
