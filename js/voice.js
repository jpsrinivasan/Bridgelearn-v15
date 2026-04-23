/* BridgeLearn V15 — Voice System (STT + TTS + Pronunciation) */
'use strict';

const BLVoice = (() => {
  let recognition = null;
  let listening    = false;
  let ttsEnabled   = true;
  let muted        = false;

  const LANG_MAP = {
    en: 'en-US', es: 'es-ES', fr: 'fr-FR',
    ja: 'ja-JP', hi: 'hi-IN', ta: 'ta-IN',
    'en-UK': 'en-GB', 'en-AU': 'en-AU',
  };

  /* ── Feature detection ─────────────────────────────────────── */
  const STT_SUPPORTED = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const TTS_SUPPORTED = !!window.speechSynthesis;

  function isSupported()    { return STT_SUPPORTED; }
  function isTTSSupported() { return TTS_SUPPORTED; }

  /* ── Speech-to-text ────────────────────────────────────────── */
  function startListening(onResult, onEnd, langCode = 'en') {
    if (!STT_SUPPORTED) { if (onEnd) onEnd('', 'unsupported'); return; }
    if (listening) stopListening();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = LANG_MAP[langCode] || 'en-US';
    recognition.continuous     = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = e => {
      const text = e.results[0]?.[0]?.transcript || '';
      if (onResult) onResult(text.trim());
    };
    recognition.onend  = () => { listening = false; if (onEnd) onEnd(); };
    recognition.onerror = e => { listening = false; if (onEnd) onEnd('', e.error); };

    recognition.start();
    listening = true;
  }

  function stopListening() {
    if (recognition) { recognition.stop(); recognition = null; }
    listening = false;
  }

  function isListening() { return listening; }

  /* ── Text-to-speech ────────────────────────────────────────── */
  function speak(text, langCode = 'en', rate = 0.88, pitch = 1.05, volume = 1) {
    if (!TTS_SUPPORTED || muted || !ttsEnabled) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang   = LANG_MAP[langCode] || 'en-US';
    utt.rate   = rate;
    utt.pitch  = pitch;
    utt.volume = volume;
    // Pick best voice
    const voices = window.speechSynthesis.getVoices();
    const target = LANG_MAP[langCode] || 'en-US';
    const voice  = voices.find(v => v.lang === target) || voices.find(v => v.lang.startsWith(target.split('-')[0]));
    if (voice) utt.voice = voice;
    window.speechSynthesis.speak(utt);
    return utt;
  }

  function stopSpeaking() { if (TTS_SUPPORTED) window.speechSynthesis.cancel(); }

  /* ── Pronunciation scoring ─────────────────────────────────── */
  function scorePronunciation(spoken, expected) {
    const score = BL.similarity(spoken, expected);
    return {
      score,
      grade: score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 55 ? 'ok' : 'needs-practice',
      feedback: score >= 90 ? '🌟 Excellent pronunciation!' :
                score >= 75 ? '👍 Good! Keep practicing.' :
                score >= 55 ? '💪 Getting there! Try again.' :
                              '🔁 Let\'s try again — listen carefully.',
    };
  }

  /* ── Read word aloud with syllable break ────────────────────── */
  function readWord(word, langCode = 'en') {
    speak(word, langCode, 0.7, 1.0);
  }

  /* ── Speak feedback ─────────────────────────────────────────── */
  function speakCorrect() { speak('Well done! That\'s correct!', 'en', 1.0, 1.15); }
  function speakWrong()   { speak('Not quite — but keep trying! You\'ve got this.', 'en', 0.9, 1.0); }

  /* ── Mute toggle ────────────────────────────────────────────── */
  function setMuted(val) { muted = !!val; if (muted) stopSpeaking(); }
  function setTTSEnabled(val) { ttsEnabled = !!val; }
  function isMuted() { return muted; }

  /* ── Set voice language ────────────────────────────────────── */
  function setLang(code) {
    if (recognition) recognition.lang = LANG_MAP[code] || 'en-US';
  }

  return {
    isSupported, isTTSSupported,
    startListening, stopListening, isListening,
    speak, stopSpeaking, readWord,
    speakCorrect, speakWrong,
    scorePronunciation,
    setMuted, setTTSEnabled, isMuted, setLang,
    LANG_MAP,
  };
})();

window.BLVoice = BLVoice;
