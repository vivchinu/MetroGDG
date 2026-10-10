// Brake Control Unit (BCU) fault guide: content in English and Gujarati,
// each step linked to the 3D parts it concerns, plus the shared session state
// used by the 2D page and the mixed reality view.

export const BCU = {
  id: 'bcu-e51',
  code: 'BCU-E51',
  severity: 'critical',
  carriage: 'B2',
  name: ['Brake Control Unit', 'બ્રેક કંટ્રોલ યુનિટ'],
  location: ['Coach 3 · Bogie 2', 'કોચ 3 · બોગી 2'],
  faultTitle: ['Fault detected', 'ખામી મળી'],
  faultDetail: [
    'E51: brake not released on bogie 2. Brake cylinder pressure stays high after the release command.',
    'E51: બોગી 2 પર બ્રેક છૂટી નથી. રિલીઝ આદેશ પછી પણ બ્રેક સિલિન્ડર પ્રેશર ઊંચું રહે છે.',
  ],
  safety: [
    ['Apply the parking brake and inform OCC before working under the car.', 'કારની નીચે કામ કરતાં પહેલાં પાર્કિંગ બ્રેક લગાવો અને OCCને જાણ કરો.'],
    ['The BCU is live (24 V DC) and the pipes hold up to 10 bar: wear gloves and eye protection.', 'BCU માં 24 V DC પાવર છે અને પાઇપમાં 10 બાર સુધી દબાણ છે: મોજાં અને આંખનું રક્ષણ પહેરો.'],
  ],
  steps: [
    {
      parts: ['display'],
      title: ['Read the fault code', 'ફોલ્ટ કોડ વાંચો'],
      detail: [
        'On the BCU front display, confirm code E51 and note the bogie number. A blinking red FAULT LED means the fault is active.',
        'BCU ના આગળના ડિસ્પ્લે પર કોડ E51 ની ખાતરી કરો અને બોગી નંબર નોંધો. લાલ FAULT LED ઝબકે તો ખામી ચાલુ છે.',
      ],
      expect: ['Display shows E51 · Bogie 2', 'ડિસ્પ્લે પર E51 · બોગી 2'],
    },
    {
      parts: ['tb1'],
      title: ['Check power supply (24 V DC)', 'પાવર સપ્લાય તપાસો (24 V DC)'],
      detail: [
        'Measure the 24 V DC control supply at terminal block TB1, pin 1 (+) and pin 2 (–), with a multimeter.',
        'મલ્ટિમીટરથી ટર્મિનલ બ્લોક TB1 ના પિન 1 (+) અને પિન 2 (–) પર 24 V DC કંટ્રોલ સપ્લાય માપો.',
      ],
      expect: [
        '22–28 V DC. No voltage: check the BCU circuit breaker in the electrical cabinet.',
        '22–28 V DC. વોલ્ટેજ ન હોય તો: ઇલેક્ટ્રિકલ કેબિનેટમાં BCU સર્કિટ બ્રેકર તપાસો.',
      ],
    },
    {
      parts: ['connectors'],
      title: ['Inspect wiring and connectors', 'વાયરિંગ અને કનેક્ટર તપાસો'],
      detail: [
        'Check that connectors X1 (power) and X2 (train bus) are fully locked. Look for bent or corroded pins and damaged cable insulation.',
        'કનેક્ટર X1 (પાવર) અને X2 (ટ્રેન બસ) પૂરા લૉક છે તે તપાસો. વળેલી કે કાટવાળી પિન અને કેબલના નુકસાન પામેલા ઇન્સ્યુલેશન માટે જુઓ.',
      ],
      expect: ['Locking rings tight, no corrosion, cables not chafed.', 'લૉકિંગ રિંગ કસેલી, કાટ નહીં, કેબલ ઘસાયેલા નહીં.'],
    },
    {
      parts: ['sensors'],
      title: ['Verify sensor readouts', 'સેન્સર રીડિંગ ચકાસો'],
      detail: [
        'Compare the brake cylinder pressure on the cab display with the gauge at sensor PT1. Main reservoir sensor PT2 must read above 7 bar.',
        'કેબ ડિસ્પ્લે પરના બ્રેક સિલિન્ડર પ્રેશરને સેન્સર PT1 પાસેના ગેજ સાથે સરખાવો. મેઇન રિઝર્વોયર સેન્સર PT2 7 બારથી વધુ બતાવવું જોઈએ.',
      ],
      expect: ['Brake released: PT1 ≈ 0 bar, difference to gauge under 0.3 bar.', 'બ્રેક છૂટી હોય ત્યારે: PT1 ≈ 0 બાર, ગેજ સાથેનો તફાવત 0.3 બારથી ઓછો.'],
    },
    {
      parts: ['valves', 'reset'],
      title: ['Test the EP valves and reset', 'EP વાલ્વ ચકાસો અને રીસેટ કરો'],
      detail: [
        'Apply and release the brake from the cab: you should hear the release valve exhaust. Then press RESET on the BCU once.',
        'કેબમાંથી બ્રેક લગાવો અને છોડો: રિલીઝ વાલ્વમાંથી હવા નીકળવાનો અવાજ આવવો જોઈએ. પછી BCU પર RESET એક વખત દબાવો.',
      ],
      expect: ['Exhaust heard, FAULT LED off after reset.', 'હવાનો અવાજ આવ્યો, રીસેટ પછી FAULT LED બંધ.'],
    },
    {
      parts: ['module', 'cock'],
      openCover: true,
      title: ['Replace module if the fault persists', 'ખામી રહે તો મોડ્યુલ બદલો'],
      detail: [
        'If E51 returns: isolate the bogie brake with the isolation cock (red lever), report to OCC and replace the BCU electronics module at the depot.',
        'જો E51 ફરી આવે: આઇસોલેશન કૉક (લાલ લિવર)થી બોગીની બ્રેક આઇસોલેટ કરો, OCCને જાણ કરો અને ડેપોમાં BCU ઇલેક્ટ્રોનિક્સ મોડ્યુલ બદલો.',
      ],
      expect: ['Isolation shown on the cab display. Keep to the isolated-brake speed limit.', 'કેબ ડિસ્પ્લે પર આઇસોલેશન દેખાય. આઇસોલેટ બ્રેકની ગતિ મર્યાદાનું પાલન કરો.'],
    },
  ],
  observations: [
    ['24 V OK', '24 V બરાબર'],
    ['No 24 V', '24 V નથી'],
    ['Loose connector', 'ઢીલું કનેક્ટર'],
    ['Corroded pins', 'કાટવાળી પિન'],
    ['Sensor mismatch', 'સેન્સર મેળ નથી'],
    ['Valve not exhausting', 'વાલ્વમાંથી હવા નથી'],
    ['Fault cleared', 'ખામી દૂર થઈ'],
    ['Brake isolated', 'બ્રેક આઇસોલેટ'],
  ],
  partNames: {
    unit: ['Brake Control Unit', 'બ્રેક કંટ્રોલ યુનિટ'],
    display: ['Fault display', 'ફોલ્ટ ડિસ્પ્લે'],
    reset: ['RESET button', 'RESET બટન'],
    tb1: ['Terminal block TB1', 'ટર્મિનલ બ્લોક TB1'],
    connectors: ['Connectors X1 / X2', 'કનેક્ટર X1 / X2'],
    sensors: ['Pressure sensors PT1 / PT2', 'પ્રેશર સેન્સર PT1 / PT2'],
    gauge: ['Brake cylinder gauge', 'બ્રેક સિલિન્ડર ગેજ'],
    valves: ['EP brake valves', 'EP બ્રેક વાલ્વ'],
    module: ['Electronics module', 'ઇલેક્ટ્રોનિક્સ મોડ્યુલ'],
    cock: ['Isolation cock', 'આઇસોલેશન કૉક'],
  },
};

export const LANG_INDEX = { en: 0, gu: 1 };
export const L = (pair, lang) => (Array.isArray(pair) ? pair[LANG_INDEX[lang] ?? 0] : pair);

const REPORTS_KEY = 'mfa.bcu.reports';

// Shared state: -1 = overview/safety, 0..n-1 = steps, n = finished.
export class BrakeSession extends EventTarget {
  constructor(lang = 'en') {
    super();
    this.lang = lang;
    this.index = -1;
    this.done = new Set();
    this.observations = new Set();
    this.notes = '';
    this.coverOpen = false;
    this.tab = 'overview';
    this.startedAt = Date.now();
  }

  get total() { return BCU.steps.length; }
  get step() { return BCU.steps[this.index] || null; }
  t(pair) { return L(pair, this.lang); }

  // Parts the 3D model should highlight right now.
  get focusParts() {
    if (this.step) return this.step.parts;
    return [];
  }

  emit(reason) { this.dispatchEvent(new CustomEvent('change', { detail: reason })); }

  setLang(lang) { if (lang !== this.lang) { this.lang = lang; this.emit('lang'); } }
  setTab(tab) { if (tab !== this.tab) { this.tab = tab; this.emit('tab'); } }

  go(i) {
    this.index = Math.max(-1, Math.min(this.total, i));
    if (this.index >= 0) this.tab = 'steps';
    if (this.step?.openCover) this.coverOpen = true;
    this.emit('step');
  }
  start() { this.go(0); }
  next() {
    if (this.index >= 0 && this.index < this.total) this.done.add(this.index);
    this.go(this.index + 1);
  }
  prev() { this.go(this.index - 1); }
  toggleCover() { this.coverOpen = !this.coverOpen; this.emit('cover'); }
  toggleObservation(i) {
    if (this.observations.has(i)) this.observations.delete(i); else this.observations.add(i);
    this.emit('report');
  }

  speechText() {
    if (this.index < 0) return `${this.t(BCU.name)}. ${this.t(BCU.faultTitle)}. ${this.t(BCU.faultDetail)} ${BCU.safety.map((s) => this.t(s)).join(' ')}`;
    if (!this.step) return '';
    return `${this.index + 1}. ${this.t(this.step.title)}. ${this.t(this.step.detail)}`;
  }

  saveReport() {
    const report = {
      id: Date.now(),
      asset: BCU.name[0],
      code: BCU.code,
      carriage: BCU.carriage,
      location: BCU.location[0],
      stepsDone: [...this.done].sort().map((i) => BCU.steps[i].title[0]),
      observations: [...this.observations].map((i) => BCU.observations[i][0]),
      notes: this.notes,
      startedAt: this.startedAt,
      savedAt: Date.now(),
    };
    const all = loadReports();
    all.unshift(report);
    try { localStorage.setItem(REPORTS_KEY, JSON.stringify(all.slice(0, 50))); } catch {}
    this.emit('saved');
    return report;
  }
}

export function loadReports() {
  try { return JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]'); } catch { return []; }
}
