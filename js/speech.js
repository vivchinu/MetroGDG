// Voice in / voice out using the platform speech engines. Recognition only
// works offline where the OS has an offline language pack; reading aloud
// uses on-device voices (Android ships English and Gujarati voices).

const BCP47 = { en: 'en-IN', gu: 'gu-IN' };

export function canRecognise() {
  return Boolean(self.SpeechRecognition || self.webkitSpeechRecognition);
}

export function recognise(lang, { onInterim } = {}) {
  const Rec = self.SpeechRecognition || self.webkitSpeechRecognition;
  if (!Rec) return Promise.reject(Object.assign(new Error('unsupported'), { code: 'unsupported' }));
  return new Promise((resolve, reject) => {
    const rec = new Rec();
    rec.lang = BCP47[lang] || lang;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    // Ask Chrome to stay on-device when it can (ignored where unsupported).
    try { rec.processLocally = true; } catch {}
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      onInterim?.(finalText + interim);
    };
    rec.onerror = (e) => reject(Object.assign(new Error(e.error), { code: e.error }));
    rec.onend = () => resolve(finalText.trim());
    rec.start();
    recognise.stop = () => rec.stop();
  });
}

let voicesReady;
function voices() {
  voicesReady ??= new Promise((resolve) => {
    const v = speechSynthesis.getVoices();
    if (v.length) return resolve(v);
    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1500);
  });
  return voicesReady;
}

export function canSpeak() {
  return 'speechSynthesis' in self;
}

// Browsers only let speech play after a user gesture. Presses inside an XR
// session are not DOM clicks, so call this from the click that enters it.
export function unlockSpeech() {
  if (!canSpeak()) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}

export async function speak(text, lang) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const all = await voices();
  const tag = BCP47[lang];
  const match = all.find((v) => v.lang === tag && v.localService)
    || all.find((v) => v.lang === tag)
    || all.find((v) => v.lang.startsWith(lang) && v.localService)
    || all.find((v) => v.lang.startsWith(lang));
  // Headsets often ship no voice for the requested language. An utterance with
  // no playable voice is silent, so fall back to the default voice instead.
  const voice = match || all.find((v) => v.default) || all[0];
  const u = new SpeechSynthesisUtterance(text);
  u.lang = match ? tag : voice?.lang || tag;
  if (voice) u.voice = voice;
  u.rate = 0.95;
  return new Promise((resolve) => {
    u.onend = resolve;
    u.onerror = (e) => {
      console.warn('Read aloud failed:', e.error);
      resolve();
    };
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel();
}
