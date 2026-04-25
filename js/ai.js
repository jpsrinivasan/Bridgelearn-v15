/* BridgeLearn V15 — AI Tutor Engine
   3-tier: backend → Claude API → OpenAI → offline fallback
   Kid-safe content guardrails built in */
'use strict';

const BLAI = (() => {
  let context = {};      // { name, age, ageGroup, country, subjectId, topicId, level }
  let langCtx = {};      // { langCode, mode, level }
  let isLangMode = false;
  let history = [];
  const MAX_HISTORY = 12;

  /* ── Config (set from BL_CONFIG or localStorage) ────────────── */
  function getConfig() {
    const cfg = window.BL_CONFIG || {};
    return {
      backendUrl:   cfg.BRIDGE_BACKEND_URL || localStorage.getItem('bl15_backend_url') || '',
      claudeKey:    cfg.ANTHROPIC_API_KEY  || localStorage.getItem('bl15_claude_key')  || '',
      openaiKey:    cfg.OPENAI_API_KEY     || localStorage.getItem('bl15_openai_key')  || '',
    };
  }

  /* ── Kid-safe content check ─────────────────────────────────── */
  const UNSAFE_PATTERNS = [
    /\b(kill|murder|suicide|rape|porn|sex|drug|violence|hate|racist|weapon|bomb|hack|illegal)\b/i,
  ];
  function isSafeInput(text) {
    return !UNSAFE_PATTERNS.some(p => p.test(text));
  }
  function sanitizeResponse(text) {
    // Remove any accidental unsafe content
    return UNSAFE_PATTERNS.reduce((t, p) => t.replace(p, '***'), text);
  }

  /* ── System prompts ─────────────────────────────────────────── */
  function buildSystemPrompt() {
    const { name='Student', age=10, country='the world', subjectId='', topicId='', level='Beginner' } = context;
    const ageGroup = BL.ageGroup(age);
    const reading  = age <= 6 ? 'very simple words, short sentences, lots of emojis' :
                     age <= 10 ? 'clear simple language, friendly tone, 2-3 sentence answers' :
                     age <= 14 ? 'clear language, explain concepts, encourage questions' :
                                 'clear intelligent language, full explanations, academic tone';

    return `You are BridgeMind, a warm and encouraging AI learning tutor for kids and teens.

Student: ${name}, Age: ${age} (${ageGroup}), Country: ${country}
Current subject: ${subjectId || 'General'}${topicId ? ', Topic: ' + topicId : ''}
Level: ${level}

CRITICAL RULES:
1. NEVER discuss violence, adult content, drugs, or anything unsafe for children.
2. Always respond in age-appropriate language: ${reading}
3. Keep responses SHORT — maximum 3-4 sentences unless more is clearly needed.
4. Be WARM and ENCOURAGING. Never make the student feel bad.
5. End almost every reply with ONE follow-up question to check understanding.
6. Use real-world examples relevant to ${country}.
7. If asked off-topic, gently redirect: "That's interesting! Let's focus on ${subjectId || 'learning'} for now. 😊"
8. Celebrate effort: "Great thinking!", "You're getting it!", "Nice try!"
9. Emojis: use 1-2 per reply maximum.
10. If the topic is "${topicId}", ground your explanation in that specific concept.`;
  }

  function buildLangSystemPrompt() {
    const { langCode='en', mode='daily-conversation', level='Beginner' } = langCtx;
    const { name='Student', age=10 } = context;
    const langNames = { en:'English', es:'Spanish', fr:'French', ja:'Japanese', hi:'Hindi', ta:'Tamil' };
    const langName  = langNames[langCode] || langCode;

    const modeDesc = {
      'daily-conversation': `Have a natural everyday conversation in ${langName}. Keep it casual and fun.`,
      'role-play':          `Play a scenario character (shopkeeper, teacher, traveler). Stay in role.`,
      'topic-talk':         `Lead a focused discussion on one topic in ${langName} with follow-up questions.`,
      'free-talk':          `Respond naturally to anything the student says in ${langName}.`,
      'listening-drill':    `Present a short passage in ${langName} and ask comprehension questions.`,
      'pronunciation':      `Help the student practice specific words. Give phonetic hints.`,
      'vocabulary':         `Introduce vocabulary in context. Give example sentences.`,
    };

    const levelDesc = {
      Beginner:     `Use simple words. Add English translation in (parentheses) after key ${langName} words.`,
      Intermediate: `Use natural sentences. Introduce new words with brief context.`,
      Advanced:     `Use idiomatic language, complex structures, varied vocabulary.`,
    };

    return `You are a ${langName} language coach for ${name} (age ${age}).
Mode: ${mode}. Level: ${level}.
${modeDesc[mode] || modeDesc['free-talk']}
${levelDesc[level] || levelDesc['Beginner']}

Rules:
1. Respond primarily in ${langName}.
2. Gently correct errors inline: "Almost! We say: [correct form]"
3. End every reply with ONE open question to keep conversation flowing.
4. Keep replies to 2-4 sentences.
5. Be warm, playful, and patient.
6. NEVER discuss unsafe topics regardless of what's said.`;
  }

  /* ── API calls ──────────────────────────────────────────────── */
  async function callBackend(messages, system) {
    const { backendUrl } = getConfig();
    if (!backendUrl) throw new Error('No backend');
    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, system, safe_mode: true }),
      signal: AbortSignal.timeout(14000),
    });
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    const d = await res.json();
    return d.reply || d.content || d.message || d.response || '';
  }

  async function callClaude(messages, system) {
    const { claudeKey } = getConfig();
    if (!claudeKey) throw new Error('No Claude key');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model:'claude-3-haiku-20240307', max_tokens:350, system, messages }),
      signal: AbortSignal.timeout(16000),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Claude ${res.status}`); }
    const d = await res.json();
    return d.content?.[0]?.text || '';
  }

  async function callOpenAI(messages, system) {
    const { openaiKey } = getConfig();
    if (!openaiKey) throw new Error('No OpenAI key');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', max_tokens: 350,
        messages: [{ role:'system', content: system }, ...messages],
      }),
      signal: AbortSignal.timeout(16000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const d = await res.json();
    return d.choices?.[0]?.message?.content || '';
  }

  /* ── Smart offline responses — topic-keyword-aware ──────────── */
  const SMART_RESPONSES = [
    // Math
    { keys:['add','plus','sum','total'], r:"Adding numbers combines groups together! 🔢 Line up the digits by place value, add each column right to left, and carry when a column exceeds 9. Try writing it out step by step — which numbers are you adding?" },
    { keys:['subtract','minus','difference','take away'], r:"Subtraction means finding what's left or the gap between two numbers. ➖ Write the larger number on top, work right to left, and borrow from the next column if needed. What are the two numbers you're working with?" },
    { keys:['multiply','times','product','×'], r:"Multiplication is repeated addition! ✖️ 4×5 means 4 groups of 5 = 5+5+5+5 = 20. The times tables are key — once you know them, multiplication becomes fast. Which times table are you practicing?" },
    { keys:['divide','division','share','÷'], r:"Division splits a number into equal groups! ➗ Think: how many times does the smaller number fit into the larger one? 20÷4 = 5 because 4 fits into 20 exactly 5 times. What numbers are you dividing?" },
    { keys:['fraction','numerator','denominator'], r:"A fraction shows part of a whole! 🍕 The bottom number (denominator) = total equal parts. The top number (numerator) = parts you have. So 3/4 means 3 out of 4 equal pieces. What fraction are you working with?" },
    { keys:['percent','percentage','%'], r:"Percent means 'out of 100'! 💯 To find 25% of 80: multiply 80 × 0.25 = 20. Or: 80 × 25 ÷ 100 = 20. Percentages are used everywhere — sales, test scores, statistics. What percentage problem are you solving?" },
    { keys:['algebra','equation','solve','variable','x ='], r:"Algebra uses letters to represent unknown numbers! 🔡 To solve 3x + 7 = 22: subtract 7 from both sides → 3x = 15 → divide by 3 → x = 5. Always do the same operation to both sides to keep the equation balanced. What's your equation?" },
    { keys:['triangle','pythagoras','hypotenuse'], r:"Pythagoras' theorem: in any right triangle, a² + b² = c² where c is the hypotenuse (longest side). 📐 The classic example: 3² + 4² = 9 + 16 = 25 = 5². So the hypotenuse is 5! What are your triangle's measurements?" },
    { keys:['area','perimeter'], r:"Area = space INSIDE a shape (measured in square units). Perimeter = distance AROUND a shape. 📐 Rectangle: Area = length × width. Perimeter = 2×(length + width). Circle: Area = πr². What shape are you working with?" },
    { keys:['probability','chance','likely'], r:"Probability = how likely something is to happen, from 0 (impossible) to 1 (certain). 🎲 P(event) = favourable outcomes ÷ total outcomes. Flipping a coin: P(heads) = 1/2 = 50%. What probability problem are you solving?" },
    // Science
    { keys:['atom','element','proton','electron','neutron'], r:"Atoms are the tiny building blocks of everything! ⚛️ Each atom has a nucleus (protons + neutrons) surrounded by electrons. Protons are positive (+), electrons negative (−), neutrons neutral. The number of protons = atomic number and identifies the element. What element are you studying?" },
    { keys:['photosynthesis','chlorophyll','plant food'], r:"Photosynthesis is how plants make food using sunlight! 🌿 The equation: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂. Chlorophyll in leaves absorbs sunlight. Plants take in CO₂ through tiny pores (stomata) and release oxygen — that's why plants are so vital for life! Does that make sense?" },
    { keys:['gravity','force','newton','mass','weight'], r:"Gravity is a force that attracts objects with mass towards each other! 🍎 Newton's 2nd Law: Force = mass × acceleration (F=ma). Weight = mass × gravitational acceleration (9.8 m/s² on Earth). Heavier objects and lighter objects fall at the same rate in a vacuum! What's your question about forces?" },
    { keys:['dna','gene','genetics','chromosome','inherit'], r:"DNA is the molecule of life! 🧬 It's a double helix made of 4 bases: A, T, G, C. Genes are sections of DNA that code for proteins and traits. You inherit one copy of each gene from each parent. Dominant traits show even with one copy; recessive traits need two copies. What about genetics confuses you?" },
    { keys:['evolution','natural selection','darwin','species'], r:"Evolution explains how species change over time through natural selection! 🦎 Darwin's key idea: individuals with traits better suited to their environment survive and reproduce more. Over many generations, advantageous traits become more common. Evidence: fossil record, DNA similarities, observed changes. What aspect of evolution are you exploring?" },
    { keys:['cell','mitochondria','nucleus','membrane'], r:"The cell is the basic unit of all life! 🔬 Key parts: Nucleus (DNA headquarters), Mitochondria ('powerhouse' — makes ATP energy), Cell membrane (controls what enters/exits), Ribosomes (make proteins). Plant cells also have cell walls and chloroplasts. Which cell part are you asking about?" },
    { keys:['climate','greenhouse','carbon','warming','pollution'], r:"Climate change is caused by excess greenhouse gases trapping heat! 🌡️ CO₂ from burning fossil fuels is the main driver. Since 1850, Earth has warmed ~1.1°C. Effects: more extreme weather, rising seas, habitat loss. Solutions: renewable energy, energy efficiency, reducing meat consumption. What would you like to understand better?" },
    // English
    { keys:['noun','verb','adjective','adverb','grammar'], r:"Parts of speech give every word a job! 📝 NOUN = person/place/thing (dog, London, freedom). VERB = action/state (run, is, feel). ADJECTIVE = describes nouns (big, blue, happy). ADVERB = describes verbs/adjectives (quickly, very, softly). Can you give me an example sentence to analyse?" },
    { keys:['metaphor','simile','figurative','personification'], r:"Figurative language makes writing come alive! ✨ SIMILE: comparison using 'like/as' — 'brave as a lion'. METAPHOR: states something IS something — 'she is a rock'. PERSONIFICATION: gives human traits to non-humans — 'the wind howled angrily'. Can you spot any in a text you're reading?" },
    { keys:['essay','paragraph','introduction','conclusion'], r:"A strong essay has 3 parts! 📄 INTRODUCTION: hook + background + thesis (your main argument). BODY PARAGRAPHS: each makes ONE point — use PEE: Point, Evidence (quote), Explain (why it matters). CONCLUSION: restate thesis, summarise, give a final thought. What type of essay are you writing?" },
    { keys:['shakespeare','hamlet','macbeth','romeo'], r:"Shakespeare's genius lies in his language and themes! 🎭 Key features: iambic pentameter (da-DUM rhythm, 10 syllables), soliloquies (characters reveal thoughts alone), dramatic irony (audience knows more than characters). His themes — ambition, love, jealousy, power — are universal. Which play are you studying?" },
    { keys:['poem','poetry','rhyme','rhythm','stanza'], r:"Poetry uses carefully chosen words for maximum impact! 🎵 Key features: RHYTHM (musical beat), RHYME SCHEME (e.g., ABAB), IMAGERY (vivid descriptions), STRUCTURE (stanzas, line breaks). When analysing poetry, ask: what's the speaker's mood? What techniques create what effect? Which poem are you working on?" },
    // History
    { keys:['world war','ww1','ww2','war','battle'], r:"Wars are turning points in history! ⚔️ WW1 (1914-18): triggered by Franz Ferdinand's assassination, trench warfare, 20M deaths. WW2 (1939-45): Nazi Germany's aggression, Holocaust (6M Jews murdered), atomic bombs on Japan, 70-85M deaths total. Both wars reshaped borders, politics, and society. What specific event are you studying?" },
    { keys:['ancient','egypt','rome','greece','civiliz'], r:"Ancient civilizations laid the foundations of modern society! 🏛️ Egypt: pharaohs, pyramids, hieroglyphics. Greece: democracy, philosophy, Olympics. Rome: law, roads, Latin language. These civilizations gave us art, architecture, government systems, and knowledge still used today. Which civilization fascinates you?" },
    { keys:['revolution','independence','freedom'], r:"Revolutions change the course of history! 🎗️ The French Revolution (1789) overthrew the monarchy with 'Liberty, Equality, Fraternity'. The American Revolution (1776) created a new democratic nation. India's independence (1947) showed peaceful protest could defeat empire. What revolution are you studying?" },
    // Geography
    { keys:['continent','country','capital','map'], r:"Our world has 7 continents and 195 countries! 🌍 Largest continent: Asia. Smallest: Australia/Oceania. Most populous country: India. Largest by area: Russia. Smallest country: Vatican City (0.44 km²). Capital cities are usually (but not always!) the largest city. Which country or continent are you learning about?" },
    { keys:['earthquake','volcano','tectonic','plate'], r:"Earth's crust is broken into tectonic plates that constantly move! 🌋 Where plates collide: mountains form or one plate dives under (causing volcanoes). Where plates separate: new ocean floor is created. Where plates slide past each other: earthquakes occur. The 'Ring of Fire' around the Pacific has 90% of earthquakes. Does that help?" },
    { keys:['climate','biome','rainforest','desert','tundra'], r:"Earth has distinct climate zones based on latitude, altitude, and distance from the sea! 🗺️ TROPICAL (near equator): hot, wet, rainforests. ARID: dry, hot or cold deserts. TEMPERATE: mild seasons. POLAR: freezing year-round. Each biome has plants and animals perfectly adapted to it. Which biome are you studying?" },
    // Coding
    { keys:['python','code','program','function','loop'], r:"Python is a brilliant language for beginners! 🐍 Core concepts: variables (name = 'Alice'), loops (for i in range(10): print(i)), functions (def greet(name): return 'Hello '+name), conditionals (if age >= 18: print('adult')). The best way to learn is to build small projects. What are you trying to code?" },
    { keys:['html','css','website','webpage','javascript'], r:"Every website uses HTML (structure), CSS (style), and JavaScript (interactivity)! 🌐 HTML: <h1>Title</h1>, <p>paragraph</p>, <a href=''>link</a>. CSS: color, font-size, margin. JS: makes things click, animate, and respond. Press F12 in your browser to see any website's code! What are you building?" },
    { keys:['algorithm','sort','search','binary'], r:"An algorithm is a step-by-step problem-solving procedure! 🔧 Binary search is super efficient: look at the middle item, if too big search left half, if too small search right half — finds any item in a sorted list of 1 million in just 20 steps! What algorithm concept are you learning?" },
    // Default smart responses
    { keys:['help','explain','understand','confused','how'], r:"Great question — let's break it down together! 💡 The best way to understand something new is to: 1) Connect it to what you already know, 2) Look for the core idea, 3) Try a simple example first. Tell me more about exactly what you're confused about and I'll help step by step." },
    { keys:['what is','what are','define','meaning'], r:"Excellent question! 🌟 Definitions help us understand the world clearly. The key is to learn both WHAT something is AND why it matters. Once you understand the definition, try using it in a sentence or finding a real-world example. What term are you looking to understand?" },
    { keys:['why','reason','cause','because'], r:"Great curiosity — asking 'why' is the heart of all learning! 🔍 In science we look for cause and effect. In history we look at motivations and consequences. In maths we look at proofs and logic. Understanding WHY makes knowledge stick much better than just memorizing facts. What's the 'why' you're trying to figure out?" },
  ];

  const FALLBACKS = {
    math: ["Math is all about patterns! 🔢 Try breaking the problem into smaller steps. Which part is confusing you — the calculation or the concept?",
           "Great math question! The key is to work step by step and check each part. Can you show me what you've tried so far?"],
    science: ["Science helps us understand our world! 🔬 Every phenomenon has a cause. What have you observed or read about this topic so far?",
              "Wonderful scientific thinking! 🌍 Let's explore the evidence together. What part of this topic would you like me to explain?"],
    english: ["Reading and writing are superpowers! 📚 The more you practise, the stronger you get. What specifically are you working on — comprehension, writing, or grammar?",
              "English is full of fascinating patterns! ✏️ Can you share the text or question you're working with? I'll help you analyse it."],
    history: ["History is full of amazing stories! 🏛️ Every event connects to what came before. What time period or event are you exploring — and what do you already know?",
              "Great historical thinking! 📜 Context is everything in history. Tell me which event you're studying and I'll give you the key facts."],
    geography: ["The world is endlessly fascinating! 🌍 Geography explains why people live where they do and how places connect. Which country, region, or topic are you exploring?",
                "Geography is everywhere! 🗺️ From mountains to megacities, every place has a story shaped by physical and human factors. What are you curious about?"],
    coding: ["Coding is a superpower! 💻 Programming is just giving precise instructions to a computer. What language are you using and what are you trying to make it do?",
             "Great coding question! 🤖 The key is breaking the problem into tiny steps. Can you show me your code or describe what's not working?"],
    default: ["That's a great question! 🌟 Let's think it through together. Can you tell me a bit more about what you're studying — subject, topic, or the specific thing that's confusing you?",
              "Excellent curiosity! 💡 Asking questions is exactly how we learn best. Give me a bit more detail about your question and I'll give you a really helpful answer.",
              "I'm here to help you learn! 🎉 Tell me your subject and question and I'll explain it clearly, step by step."],
  };

  function getFallback(userText) {
    if (isLangMode) {
      const arr = LANG_FALLBACKS[langCtx.langCode] || LANG_FALLBACKS.en;
      return BL.pick(arr);
    }
    const lower = userText.toLowerCase();
    // Check smart responses first (keyword-aware educational content)
    for (const sr of SMART_RESPONSES) {
      if (sr.keys.some(k => lower.includes(k))) return sr.r;
    }
    // Then subject-based fallbacks
    for (const key of Object.keys(FALLBACKS)) {
      if (key !== 'default' && lower.includes(key)) return BL.pick(FALLBACKS[key]);
    }
    // Check current context subject
    if (context.subjectId) {
      const subj = context.subjectId.toLowerCase();
      for (const key of Object.keys(FALLBACKS)) {
        if (key !== 'default' && subj.includes(key)) return BL.pick(FALLBACKS[key]);
      }
    }
    return BL.pick(FALLBACKS.default);
  }

  const LANG_FALLBACKS = {
    en: ["Great practice! Keep going — you're doing really well. 😊 What else would you like to talk about?"],
    es: ["¡Muy bien! (Very good!) Sigues mejorando. ¿Qué más quieres hablar? 😊"],
    fr: ["Très bien! (Very good!) Continuez comme ça. Qu'est-ce que vous voulez dire? 😊"],
    ja: ["よくできました！(Well done!) 続けましょう。次は何について話しますか？😊"],
    hi: ["बहुत अच्छा! (Very good!) आगे बताइए। 😊"],
    ta: ["மிகவும் நல்லது! (Very good!) இன்னும் பேசுங்க. 😊"],
  };

  /* ── Main send function ─────────────────────────────────────── */
  async function send(userText) {
    if (!userText?.trim()) return null;
    if (!isSafeInput(userText)) {
      return "I'm here to help you learn! Let's keep our conversation about educational topics. 😊 What would you like to learn today?";
    }

    const messages = [...history, { role:'user', content: userText }];
    const system   = isLangMode ? buildLangSystemPrompt() : buildSystemPrompt();
    let reply = '';

    try       { reply = await callBackend(messages, system); }
    catch(e1) { try       { reply = await callClaude(messages, system); }
    catch(e2) { try       { reply = await callOpenAI(messages, system); }
    catch(e3) { reply = getFallback(userText); } } }

    reply = sanitizeResponse(reply || getFallback(userText));

    // Update history
    history.push({ role:'user', content: userText }, { role:'assistant', content: reply });
    if (history.length > MAX_HISTORY * 2) history = history.slice(-MAX_HISTORY * 2);

    return reply;
  }

  async function sendLang(userText, langCode, mode, level) {
    langCtx    = { ...(langCtx || {}), langCode, mode, level };
    isLangMode = true;
    return send(userText);
  }

  /* ── Wikipedia quick fact ───────────────────────────────────── */
  async function getWikiFact(term) {
    try {
      const d = await BL.fetchJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`, {}, 5000);
      return d.extract ? d.extract.split('. ')[0] + '.' : null;
    } catch { return null; }
  }

  /* ── Test connection ────────────────────────────────────────── */
  async function testConnection() {
    const cfg = getConfig();
    if (cfg.backendUrl) try { await callBackend([{role:'user',content:'ping'}], 'Respond with OK'); return 'backend'; } catch {}
    if (cfg.claudeKey)  try { await callClaude([{role:'user',content:'ping'}], 'Respond with OK'); return 'claude'; } catch {}
    if (cfg.openaiKey)  try { await callOpenAI([{role:'user',content:'ping'}], 'Respond with OK'); return 'openai'; } catch {}
    return 'offline';
  }

  /* ── Context setters ────────────────────────────────────────── */
  function init(ctx) {
    context    = ctx || {};
    isLangMode = false;
    langCtx    = {};
    history    = [];
  }

  function initLang(ctx) {
    langCtx    = ctx || {};
    isLangMode = true;
    context    = { name: ctx.name, age: ctx.age };
    history    = [];
  }

  function setContext(updates) { context = { ...context, ...updates }; }

  function clearHistory() { history = []; }

  function updateConfig(cfg) {
    if (cfg.backendUrl) localStorage.setItem('bl15_backend_url', cfg.backendUrl);
    if (cfg.claudeKey)  localStorage.setItem('bl15_claude_key', cfg.claudeKey);
    if (cfg.openaiKey)  localStorage.setItem('bl15_openai_key', cfg.openaiKey);
  }

  return {
    init, initLang, setContext, send, sendLang,
    getFallback, getWikiFact, testConnection,
    clearHistory, updateConfig,
  };
})();

window.BLAI = BLAI;
