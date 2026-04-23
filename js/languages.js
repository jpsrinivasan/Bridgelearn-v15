/* BridgeLearn V15 — Language Learning System */
'use strict';

const BLLang = (() => {
  let config      = null;
  let currentLang = null;
  let currentMode = null;
  let currentLevel= 'Beginner';
  let sessionLog  = [];

  /* ── Coach personas ──────────────────────────────────────────── */
  const COACHES = {
    en: { name:'Coach Alex',   emoji:'👩‍🏫', charId:'alex',  style:'friendly, encouraging', voice:'en' },
    es: { name:'Coach Sofia',  emoji:'💃',   charId:'maya',  style:'warm, patient',         voice:'es' },
    fr: { name:'Coach Pierre', emoji:'🎩',   charId:'kai',   style:'formal, precise',       voice:'fr' },
    ja: { name:'Coach Yuki',   emoji:'🌸',   charId:'priya', style:'polite, structured',    voice:'ja' },
    hi: { name:'Coach Priya',  emoji:'🪷',   charId:'priya', style:'warm, encouraging',     voice:'hi' },
    ta: { name:'Coach Kumar',  emoji:'🌴',   charId:'alex',  style:'friendly, story-based', voice:'ta' },
  };

  /* ── Starter prompts ─────────────────────────────────────────── */
  const STARTERS = {
    en: {
      'daily-conversation': "Let's chat! Tell me: how was your day today? 😊",
      'role-play':          "Welcome to the shop! I'm the shopkeeper. What would you like to buy?",
      'topic-talk':         "Today's topic: School life. What's your favourite subject and why?",
      'free-talk':          "Great! Let's talk freely in English. Tell me something interesting about yourself.",
      'listening-drill':    "I'll read a short passage. Listen carefully, then answer my question!",
      'pronunciation':      "Let's practice pronunciation! Repeat after me: 'The quick brown fox'",
      'vocabulary':         "Let's learn new words! Today we'll focus on daily life vocabulary. Ready?",
    },
    es: {
      'daily-conversation': "¡Hola! Vamos a hablar. ¿Cómo estás hoy? (Hello! Let's talk. How are you today?)",
      'role-play':          "¡Buenos días! Soy el mesero. ¿Qué desea ordenar? (Good morning! I'm the waiter. What would you like to order?)",
      'topic-talk':         "Hablemos sobre la familia. ¿Cómo es tu familia? (Let's talk about family. What is your family like?)",
      'free-talk':          "¡Perfecto! Hablemos libremente en español. ¿De dónde eres? (Perfect! Let's talk freely in Spanish. Where are you from?)",
      'listening-drill':    "Voy a leer un texto corto. ¡Escucha con atención! (I'll read a short text. Listen carefully!)",
      'pronunciation':      "Vamos a practicar pronunciación. Repite: 'Buenos días, ¿cómo estás?'",
      'vocabulary':         "¡Aprendamos palabras nuevas! Hoy: las cosas de la casa. (Let's learn new words! Today: household items.)",
    },
    fr: {
      'daily-conversation': "Bonjour! Comment allez-vous aujourd'hui? (Hello! How are you today?)",
      'role-play':          "Bienvenue au café! Je suis le serveur. Qu'est-ce que vous voulez commander? (Welcome to the café! I'm the waiter.)",
      'topic-talk':         "Parlons de l'école. Quelle est votre matière préférée? (Let's talk about school. What is your favourite subject?)",
      'free-talk':          "Parfait! Parlons librement en français. Qu'est-ce que vous aimez faire? (Perfect! Let's talk freely in French.)",
      'listening-drill':    "Je vais lire un court passage. Écoutez attentivement! (I will read a short passage. Listen carefully!)",
      'pronunciation':      "Pratiquons la prononciation. Répétez: 'Bonjour, comment allez-vous?'",
      'vocabulary':         "Apprenons de nouveaux mots! Aujourd'hui: les couleurs. (Let's learn new words! Today: colours.)",
    },
    ja: {
      'daily-conversation': "こんにちは！今日はどんな一日でしたか？(Hello! How was your day today?)",
      'role-play':          "いらっしゃいませ！今日は何がよろしいですか？(Welcome! What can I help you with today?)",
      'topic-talk':         "学校について話しましょう。好きな科目は何ですか？(Let's talk about school. What's your favourite subject?)",
      'free-talk':          "では、自由に日本語で話しましょう！(Let's talk freely in Japanese!)",
      'listening-drill':    "短い文を読みます。よく聞いてください！(I'll read a short passage. Listen carefully!)",
      'pronunciation':      "発音を練習しましょう。繰り返してください：「こんにちは」",
      'vocabulary':         "新しい言葉を学びましょう！今日は数字です。(Let's learn new words! Today: numbers.)",
    },
    hi: {
      'daily-conversation': "नमस्ते! आज आपका दिन कैसा रहा? (Hello! How was your day today?)",
      'role-play':          "नमस्ते! मैं दुकानदार हूँ। आपको क्या चाहिए? (Hello! I'm the shopkeeper. What do you need?)",
      'topic-talk':         "आज हम परिवार के बारे में बात करेंगे। (Today we'll talk about family.)",
      'free-talk':          "बहुत अच्छा! हिंदी में बात करते हैं। (Great! Let's talk in Hindi.)",
      'listening-drill':    "मैं एक छोटा अनुच्छेद पढ़ूँगा। ध्यान से सुनें! (I'll read a short passage. Listen carefully!)",
      'pronunciation':      "उच्चारण का अभ्यास करें। दोहराएं: 'नमस्ते, आप कैसे हैं?'",
      'vocabulary':         "नए शब्द सीखें! आज: रंगों के नाम। (Let's learn new words! Today: colours.)",
    },
    ta: {
      'daily-conversation': "வணக்கம்! இன்று எப்படி இருக்கீங்க? (Hello! How are you today?)",
      'role-play':          "வணக்கம்! நான் கடைக்காரர். என்ன வேணும்? (Hello! I'm the shopkeeper. What do you need?)",
      'topic-talk':         "பள்ளியைப் பத்தி பேசலாம். (Let's talk about school.)",
      'free-talk':          "சரி! தமிழ்ல சுதந்திரமா பேசலாம். (Great! Let's talk freely in Tamil.)",
      'listening-drill':    "நான் ஒரு சிறு பகுதி படிக்கிறேன். கவனமாக கேளுங்க! (I'll read a short section. Listen carefully!)",
      'pronunciation':      "உச்சரிப்பை பயிற்சி செய்யலாம்: 'வணக்கம், நலமா?'",
      'vocabulary':         "புதிய வார்த்தைகள் கத்துக்கலாம்! இன்று: எண்கள். (Let's learn new words! Today: numbers.)",
    },
  };

  /* ── Level tips ─────────────────────────────────────────────── */
  const LEVEL_TIPS = {
    Beginner:     'Focus on simple phrases. Mistakes are how you learn! 🌱',
    Intermediate: 'Try longer sentences and new vocabulary. You\'re growing! 🌿',
    Advanced:     'Challenge yourself with idioms and complex topics. 🌳',
  };

  /* ── Modes config ────────────────────────────────────────────── */
  const MODES = [
    { id:'daily-conversation', emoji:'☀️', name:'Daily Chat',      desc:'Real-life everyday conversations' },
    { id:'topic-talk',         emoji:'📖', name:'Topic Talk',      desc:'Deep discussion on one topic' },
    { id:'role-play',          emoji:'🎭', name:'Role Play',       desc:'Shop, travel, interviews & more' },
    { id:'free-talk',          emoji:'💬', name:'Free Talk',       desc:'Open conversation, your choice' },
    { id:'pronunciation',      emoji:'🎤', name:'Pronunciation',   desc:'Practice speaking clearly' },
    { id:'vocabulary',         emoji:'📝', name:'Vocabulary',      desc:'Learn words in context' },
    { id:'listening-drill',    emoji:'👂', name:'Listening Drill', desc:'Listen and comprehend' },
  ];

  /* ── Init ───────────────────────────────────────────────────── */
  function init(langData) { config = langData; }

  /* ── Getters ────────────────────────────────────────────────── */
  function getLanguages() {
    return config?.languages || [
      {code:'en',flag:'🇬🇧',name:'English'}, {code:'es',flag:'🇪🇸',name:'Spanish'},
      {code:'fr',flag:'🇫🇷',name:'French'}, {code:'ja',flag:'🇯🇵',name:'Japanese'},
      {code:'hi',flag:'🇮🇳',name:'Hindi'}, {code:'ta',flag:'🇮🇳',name:'Tamil'},
    ];
  }
  function getModes()           { return MODES; }
  function getCoach(code)       { return COACHES[code] || COACHES.en; }
  function getLevelTip(level)   { return LEVEL_TIPS[level] || LEVEL_TIPS.Beginner; }

  /* ── Start session ──────────────────────────────────────────── */
  function startSession(langCode, mode, level) {
    currentLang  = langCode;
    currentMode  = mode;
    currentLevel = level || 'Beginner';
    sessionLog   = [];
    const coach  = getCoach(langCode);
    const starter= (STARTERS[langCode] || STARTERS.en)[mode] || "Let's practice! Say something in your target language. 😊";
    const tip    = getLevelTip(currentLevel);

    // Init AI for lang mode
    BLAI.initLang({ langCode, mode, level, name: window.BLApp?.profile?.name, age: window.BLApp?.profile?.age });

    // Set voice language
    BLVoice.setLang(langCode);

    BLGam.recordLangSession(langCode);

    return { coach, starterMessage: starter, tip };
  }

  /* ── Send message ───────────────────────────────────────────── */
  async function sendMessage(userText) {
    if (!userText?.trim()) return null;
    sessionLog.push({ role:'user', text: userText, ts: Date.now() });
    const reply = await BLAI.sendLang(userText, currentLang, currentMode, currentLevel);
    if (reply) sessionLog.push({ role:'coach', text: reply, ts: Date.now() });
    BLGam.recordAIChat();
    return reply;
  }

  /* ── Pronunciation session ──────────────────────────────────── */
  function getPronunciationWord(langCode, index = 0) {
    const words = {
      en: ['hello','world','beautiful','learning','wonderful','practice','excellent','together'],
      es: ['hola','gracias','buenas','aprender','familia','amigo','corazón','siempre'],
      fr: ['bonjour','merci','famille','apprendre','magnifique','toujours','ensemble','français'],
      ja: ['ありがとう','おはよう','こんにちは','さようなら','すみません','はい','いいえ'],
      hi: ['नमस्ते','धन्यवाद','परिवार','स्कूल','पानी','खाना','अच्छा','बहुत'],
      ta: ['வணக்கம்','நன்றி','குடும்பம்','பள்ளி','தண்ணீர்','சாப்பாடு','நல்லது','மிகவும்'],
    };
    const list = words[langCode] || words.en;
    return list[index % list.length];
  }

  /* ── Render helpers ─────────────────────────────────────────── */
  function renderLangGrid(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const prog = JSON.parse(localStorage.getItem('bl15_progress') || '{}');
    el.innerHTML = getLanguages().map(l => {
      const sessions = prog[`lang_${l.code}`]?.sessions || 0;
      const pct = Math.min(100, sessions * 5);
      return `<div class="lang-card" onclick="BLApp.selectLanguage('${l.code}')">
        <div class="lc-flag">${l.flag}</div>
        <div class="lc-name">${l.name}</div>
        <div class="lc-coach">${getCoach(l.code).emoji} ${getCoach(l.code).name}</div>
        <div class="lc-prog"><div class="lc-fill" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }

  function renderModeGrid(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = MODES.map(m => `
      <div class="topic-row" onclick="BLApp.selectLangMode('${m.id}')">
        <div class="tr-icon">${m.emoji}</div>
        <div class="tr-info">
          <div class="tr-title">${m.name}</div>
          <div class="tr-meta">${m.desc}</div>
        </div>
        <div class="tr-status">›</div>
      </div>`).join('');
  }

  function renderLevelGrid(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const levels = [
      { id:'Beginner',     emoji:'🌱', name:'Beginner',     tip:'Simple phrases, common words.' },
      { id:'Intermediate', emoji:'🌿', name:'Intermediate', tip:'Natural sentences, new vocab.' },
      { id:'Advanced',     emoji:'🌳', name:'Advanced',     tip:'Idioms, complex structures.' },
    ];
    el.innerHTML = levels.map(l => `
      <div class="topic-row" onclick="BLApp.selectLangLevel('${l.id}')">
        <div class="tr-icon">${l.emoji}</div>
        <div class="tr-info">
          <div class="tr-title">${l.name}</div>
          <div class="tr-meta">${l.tip}</div>
        </div>
        <div class="tr-status">›</div>
      </div>`).join('');
  }

  function getSessionLog()  { return sessionLog; }
  function getCurrent()     { return { langCode: currentLang, mode: currentMode, level: currentLevel }; }

  return {
    init, getLanguages, getModes, getCoach, getLevelTip,
    startSession, sendMessage, getPronunciationWord,
    renderLangGrid, renderModeGrid, renderLevelGrid,
    getSessionLog, getCurrent, COACHES, MODES,
  };
})();

window.BLLang = BLLang;
