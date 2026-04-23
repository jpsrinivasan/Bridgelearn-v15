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

  /* ── Offline fallback responses ─────────────────────────────── */
  const FALLBACKS = {
    math: ["Math is all about patterns! 🔢 Try breaking the problem into smaller steps. What's the first step you'd take?",
           "Great math question! Let me think... The key idea here is to work step by step. What do you know so far?"],
    science: ["Science helps us understand our world! 🔬 Every phenomenon has a cause and effect. What have you observed about this?",
              "Wonderful scientific thinking! 🌍 Scientists ask questions, test ideas, and discover answers. What's your hypothesis?"],
    english: ["Reading and writing are superpowers! 📚 The more you practice, the stronger you get. What are you working on today?",
              "English is full of fascinating patterns! ✏️ Let's explore this together. Can you tell me what you understand so far?"],
    history: ["History is full of amazing stories! 🏛️ Every event connects to what came before. What time period are you exploring?",
              "Great historical thinking! 📜 The past shapes our present. What would you like to discover about this event?"],
    geography: ["The world is endlessly fascinating! 🌍 Every place has unique features and cultures. What region are you studying?",
                "Geography is everywhere around us! 🗺️ From mountains to oceans, every place has a story. What are you curious about?"],
    coding: ["Coding is a superpower! 💻 It's all about breaking problems into logical steps. What are you trying to build?",
             "Great coding question! 🤖 Programming is problem-solving with precise instructions. Let's think it through together."],
    default: ["That's a great question! 🌟 Let's think it through together. What do you already know about this topic?",
              "Excellent curiosity! 💡 Asking questions is how we learn best. What part would you like to understand better?",
              "I love your enthusiasm for learning! 🎉 Let's figure this out. Can you tell me a bit more about what's confusing you?"],
  };

  const LANG_FALLBACKS = {
    en: ["Great practice! Keep going — you're doing really well. 😊 What else would you like to talk about?"],
    es: ["¡Muy bien! (Very good!) Sigues mejorando. ¿Qué más quieres hablar? 😊"],
    fr: ["Très bien! (Very good!) Continuez comme ça. Qu'est-ce que vous voulez dire? 😊"],
    ja: ["よくできました！(Well done!) 続けましょう。次は何について話しますか？😊"],
    hi: ["बहुत अच्छा! (Very good!) आगे बताइए। 😊"],
    ta: ["மிகவும் நல்லது! (Very good!) இன்னும் பேசுங்க. 😊"],
  };

  function getFallback(userText) {
    if (isLangMode) {
      const arr = LANG_FALLBACKS[langCtx.langCode] || LANG_FALLBACKS.en;
      return BL.pick(arr);
    }
    const lower = userText.toLowerCase();
    for (const key of Object.keys(FALLBACKS)) {
      if (key !== 'default' && lower.includes(key)) return BL.pick(FALLBACKS[key]);
    }
    return BL.pick(FALLBACKS.default);
  }

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
