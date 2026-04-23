/* BridgeLearn V15 — Premium 3D Character System
   CSS/SVG-based Pixar-inspired characters with full animation control */
'use strict';

const BLChars = (() => {

  /* ── Skin palettes ─────────────────────────────────────────── */
  const SKINS = {
    light:   { face:'#FDDBB4', shadow:'#F4C28A', cheek:'#F4A7A0', hair:'#3D2B1F', lip:'#E07070' },
    medium:  { face:'#C68642', shadow:'#A0622A', cheek:'#B85C5C', hair:'#2C1503', lip:'#C05050' },
    dark:    { face:'#6B3A1F', shadow:'#4A2510', cheek:'#8B3A3A', hair:'#1A0A00', lip:'#9B4040' },
    fair:    { face:'#FFE0C0', shadow:'#F5C8A0', cheek:'#FFB0A0', hair:'#8B5C2A', lip:'#E08070' },
  };

  /* ── Character definitions ─────────────────────────────────── */
  const CHARS = {
    alex: {
      name: 'Alex', role: 'Science & Math Tutor',
      skin: 'medium', hairColor: '#3D2B1F', shirtColor: '#6c63ff',
      hairStyle: 'curly', gender: 'boy',
      emoji: '🧑‍🏫', greeting: "Hey! I'm Alex — let's explore!",
    },
    maya: {
      name: 'Maya', role: 'Language & English Tutor',
      skin: 'fair', hairColor: '#8B4513', shirtColor: '#f5576c',
      hairStyle: 'ponytail', gender: 'girl',
      emoji: '👩‍🏫', greeting: "Hi! I'm Maya — ready to learn?",
    },
    priya: {
      name: 'Priya', role: 'History & Culture Tutor',
      skin: 'dark', hairColor: '#1a0a00', shirtColor: '#f9a825',
      hairStyle: 'braid', gender: 'girl',
      emoji: '👩‍🎓', greeting: "Namaste! I'm Priya — let's discover!",
    },
    leo: {
      name: 'Leo', role: 'Young Learner Companion',
      skin: 'light', hairColor: '#F5A623', shirtColor: '#43e97b',
      hairStyle: 'animal', gender: 'animal',
      emoji: '🦁', greeting: "ROAR! I'm Leo — let's play and learn!",
    },
    kai: {
      name: 'Kai', role: 'Coding & Tech Tutor',
      skin: 'light', hairColor: '#2C2C2C', shirtColor: '#4facfe',
      hairStyle: 'short', gender: 'boy',
      emoji: '🧑‍💻', greeting: "Hey, I'm Kai! Let's code something awesome.",
    },
  };

  /* ── Build SVG character ───────────────────────────────────── */
  function buildSVG(charId, size = 160, emotion = 'idle') {
    const char = CHARS[charId] || CHARS.maya;
    const s    = SKINS[char.skin] || SKINS.medium;
    const shirt = char.shirtColor;
    const hair  = char.hairColor;
    const w = size, h = size;
    const cx = w * 0.5, cy = h * 0.45;
    const headR  = w * 0.28;
    const eyeY   = cy - headR * 0.1;
    const eyeOff = headR * 0.38;

    // Emotion variants
    const mouthPath = emotion === 'correct'  ? `M${cx-headR*0.28} ${eyeY+headR*0.5} Q${cx} ${eyeY+headR*0.75} ${cx+headR*0.28} ${eyeY+headR*0.5}` :
                      emotion === 'wrong'    ? `M${cx-headR*0.2} ${eyeY+headR*0.6} Q${cx} ${eyeY+headR*0.45} ${cx+headR*0.2} ${eyeY+headR*0.6}` :
                      emotion === 'think'    ? `M${cx-headR*0.15} ${eyeY+headR*0.52} L${cx+headR*0.2} ${eyeY+headR*0.48}` :
                      /* idle/speak */         `M${cx-headR*0.25} ${eyeY+headR*0.48} Q${cx} ${eyeY+headR*0.68} ${cx+headR*0.25} ${eyeY+headR*0.48}`;

    const eyebrowL = emotion === 'think' ? `M${cx-eyeOff-headR*0.18} ${eyeY-headR*0.32} Q${cx-eyeOff} ${eyeY-headR*0.42} ${cx-eyeOff+headR*0.18} ${eyeY-headR*0.35}` :
                                            `M${cx-eyeOff-headR*0.18} ${eyeY-headR*0.36} Q${cx-eyeOff} ${eyeY-headR*0.44} ${cx-eyeOff+headR*0.18} ${eyeY-headR*0.38}`;
    const eyebrowR = `M${cx+eyeOff-headR*0.18} ${eyeY-headR*0.38} Q${cx+eyeOff} ${eyeY-headR*0.44} ${cx+eyeOff+headR*0.18} ${eyeY-headR*0.36}`;

    // Hair shapes per style
    const hairSVG = buildHair(char.hairStyle, cx, cy, headR, hair, char.gender);

    const id = `char-${charId}-${Math.random().toString(36).slice(2,6)}`;

    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="char-svg" role="img" aria-label="${char.name} tutor character">
  <defs>
    <radialGradient id="${id}-skin" cx="38%" cy="32%" r="62%">
      <stop offset="0%"   stop-color="${s.face}"/>
      <stop offset="100%" stop-color="${s.shadow}"/>
    </radialGradient>
    <radialGradient id="${id}-body" cx="50%" cy="20%" r="70%">
      <stop offset="0%"   stop-color="${lighten(shirt, 0.2)}"/>
      <stop offset="100%" stop-color="${shirt}"/>
    </radialGradient>
    <filter id="${id}-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
      <feOffset dx="0" dy="4" result="offsetBlur"/>
      <feComposite in="SourceGraphic" in2="offsetBlur" operator="over"/>
    </filter>
  </defs>
  <g class="char-body-group" filter="url(#${id}-glow)">
    <!-- Body / shirt -->
    <ellipse cx="${cx}" cy="${h*0.82}" rx="${headR*0.82}" ry="${h*0.22}" fill="url(#${id}-body)"/>
    <!-- Neck -->
    <rect x="${cx-headR*0.18}" y="${cy+headR*0.88}" width="${headR*0.36}" height="${headR*0.22}" fill="${s.face}" rx="${headR*0.06}"/>
    <!-- Arms -->
    <ellipse cx="${cx-headR*0.95}" cy="${h*0.72}" rx="${headR*0.18}" ry="${headR*0.45}" fill="url(#${id}-body)" class="char-arm-left" transform="rotate(-8,${cx-headR*0.95},${h*0.72})"/>
    <ellipse cx="${cx+headR*0.95}" cy="${h*0.72}" rx="${headR*0.18}" ry="${headR*0.45}" fill="url(#${id}-body)" class="char-arm-right" transform="rotate(8,${cx+headR*0.95},${h*0.72})"/>
    <!-- Hands -->
    <circle cx="${cx-headR*1.02}" cy="${h*0.88}" r="${headR*0.14}" fill="${s.face}"/>
    <circle cx="${cx+headR*1.02}" cy="${h*0.88}" r="${headR*0.14}" fill="${s.face}"/>
  </g>
  <g class="char-head-group">
    ${hairSVG.back}
    <!-- Face -->
    <ellipse cx="${cx}" cy="${cy}" rx="${headR}" ry="${headR*1.05}" fill="url(#${id}-skin)"/>
    <!-- Cheeks -->
    <ellipse cx="${cx-eyeOff*1.05}" cy="${eyeY+headR*0.22}" rx="${headR*0.18}" ry="${headR*0.1}" fill="${s.cheek}" opacity="0.45"/>
    <ellipse cx="${cx+eyeOff*1.05}" cy="${eyeY+headR*0.22}" rx="${headR*0.18}" ry="${headR*0.1}" fill="${s.cheek}" opacity="0.45"/>
    <!-- Eyes white -->
    <ellipse cx="${cx-eyeOff}" cy="${eyeY}" rx="${headR*0.16}" ry="${headR*0.18}" fill="white"/>
    <ellipse cx="${cx+eyeOff}" cy="${eyeY}" rx="${headR*0.16}" ry="${headR*0.18}" fill="white"/>
    <!-- Pupils -->
    <circle cx="${cx-eyeOff+headR*0.04}" cy="${eyeY+headR*0.02}" r="${headR*0.1}" fill="#1a1a2e"/>
    <circle cx="${cx+eyeOff+headR*0.04}" cy="${eyeY+headR*0.02}" r="${headR*0.1}" fill="#1a1a2e"/>
    <!-- Eye shines -->
    <circle cx="${cx-eyeOff+headR*0.1}" cy="${eyeY-headR*0.06}" r="${headR*0.035}" fill="white"/>
    <circle cx="${cx+eyeOff+headR*0.1}" cy="${eyeY-headR*0.06}" r="${headR*0.035}" fill="white"/>
    <!-- Eyelids (for blink anim) -->
    <ellipse cx="${cx-eyeOff}" cy="${eyeY}" rx="${headR*0.18}" ry="${headR*0.19}" fill="url(#${id}-skin)" class="char-eyelid-l" transform-origin="${cx-eyeOff} ${eyeY-headR*0.1}"/>
    <ellipse cx="${cx+eyeOff}" cy="${eyeY}" rx="${headR*0.18}" ry="${headR*0.19}" fill="url(#${id}-skin)" class="char-eyelid-r" transform-origin="${cx+eyeOff} ${eyeY-headR*0.1}"/>
    <!-- Eyebrows -->
    <path d="${eyebrowL}" stroke="${hair}" stroke-width="${headR*0.06}" fill="none" stroke-linecap="round"/>
    <path d="${eyebrowR}" stroke="${hair}" stroke-width="${headR*0.06}" fill="none" stroke-linecap="round"/>
    <!-- Nose -->
    <ellipse cx="${cx}" cy="${eyeY+headR*0.28}" rx="${headR*0.07}" ry="${headR*0.04}" fill="${s.shadow}" opacity="0.5"/>
    <!-- Mouth -->
    <path d="${mouthPath}" stroke="${s.lip}" stroke-width="${headR*0.07}" fill="none" stroke-linecap="round" class="char-mouth"/>
    ${hairSVG.front}
  </g>
</svg>`;
  }

  function buildHair(style, cx, cy, hr, color, gender) {
    switch(style) {
      case 'curly':
        return {
          back: `<ellipse cx="${cx}" cy="${cy-hr*0.8}" rx="${hr*1.05}" ry="${hr*0.7}" fill="${color}"/>`,
          front: `<path d="M${cx-hr} ${cy-hr*0.3} Q${cx-hr*1.1} ${cy-hr*0.8} ${cx-hr*0.6} ${cy-hr*1.1} Q${cx} ${cy-hr*1.25} ${cx+hr*0.6} ${cy-hr*1.1} Q${cx+hr*1.1} ${cy-hr*0.8} ${cx+hr} ${cy-hr*0.3}" fill="${color}"/>`
        };
      case 'ponytail':
        return {
          back: `<ellipse cx="${cx}" cy="${cy-hr*0.8}" rx="${hr*0.95}" ry="${hr*0.65}" fill="${color}"/>
                 <ellipse cx="${cx+hr*0.9}" cy="${cy+hr*0.4}" rx="${hr*0.16}" ry="${hr*0.55}" fill="${color}" transform="rotate(20,${cx+hr*0.9},${cy+hr*0.4})"/>`,
          front: `<path d="M${cx-hr*0.85} ${cy-hr*0.25} Q${cx-hr*1.0} ${cy-hr*0.9} ${cx} ${cy-hr*1.15} Q${cx+hr*0.85} ${cy-hr*0.9} ${cx+hr*0.7} ${cy-hr*0.22}" fill="${color}"/>`
        };
      case 'braid':
        return {
          back: `<ellipse cx="${cx}" cy="${cy-hr*0.8}" rx="${hr*0.95}" ry="${hr*0.65}" fill="${color}"/>
                 <path d="M${cx+hr*0.5} ${cy+hr*0.2} Q${cx+hr*0.6} ${cy+hr*0.8} ${cx+hr*0.4} ${cy+hr*1.4}" stroke="${color}" stroke-width="${hr*0.25}" fill="none" stroke-linecap="round"/>`,
          front: `<path d="M${cx-hr*0.85} ${cy-hr*0.28} Q${cx-hr*0.98} ${cy-hr*0.88} ${cx} ${cy-hr*1.12} Q${cx+hr*0.85} ${cy-hr*0.88} ${cx+hr*0.75} ${cy-hr*0.25}" fill="${color}"/>`
        };
      case 'short':
        return {
          back: `<ellipse cx="${cx}" cy="${cy-hr*0.72}" rx="${hr*0.98}" ry="${hr*0.62}" fill="${color}"/>`,
          front: `<path d="M${cx-hr*0.8} ${cy-hr*0.2} Q${cx-hr*0.95} ${cy-hr*0.85} ${cx} ${cy-hr*1.1} Q${cx+hr*0.88} ${cy-hr*0.85} ${cx+hr*0.72} ${cy-hr*0.18}" fill="${color}"/>`
        };
      case 'animal': // Lion mane
        return {
          back: `<circle cx="${cx}" cy="${cy}" r="${hr*1.15}" fill="#F5A623" opacity="0.85"/>`,
          front: `<circle cx="${cx}" cy="${cy}" r="${hr*0.95}" fill="#FDDBB4"/>`
        };
      default:
        return {
          back: `<ellipse cx="${cx}" cy="${cy-hr*0.75}" rx="${hr*0.95}" ry="${hr*0.65}" fill="${color}"/>`,
          front: `<path d="M${cx-hr*0.85} ${cy-hr*0.25} Q${cx-hr*0.98} ${cy-hr*0.88} ${cx} ${cy-hr*1.12} Q${cx+hr*0.88} ${cy-hr*0.88} ${cx+hr*0.78} ${cy-hr*0.22}" fill="${color}"/>`
        };
    }
  }

  function lighten(hex, amt) {
    const num = parseInt(hex.replace('#',''), 16);
    const r = Math.min(255, (num >> 16) + Math.round(255*amt));
    const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255*amt));
    const b = Math.min(255, (num & 0xff) + Math.round(255*amt));
    return '#' + ((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
  }

  /* ── Render helpers ────────────────────────────────────────── */
  function render(charId, containerId, size = 160, emotion = 'idle', animClass = '') {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="char-wrap ${animClass}" id="cw-${containerId}">
      ${buildSVG(charId, size, emotion)}
      <div class="char-shadow"></div>
    </div>`;
  }

  function renderMini(charId, emotion = 'idle') {
    return buildSVG(charId, 80, emotion);
  }

  function animate(containerId, animClass, durationMs = 2000) {
    const wrap = document.getElementById('cw-' + containerId) || document.querySelector(`#${containerId} .char-wrap`);
    if (!wrap) return;
    wrap.classList.add('anim-' + animClass);
    setTimeout(() => wrap.classList.remove('anim-' + animClass), durationMs);
  }

  function setEmotion(containerId, emotion) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const wrap = el.querySelector('.char-wrap');
    const svg  = el.querySelector('.char-svg');
    if (!svg || !wrap) return;
    // Get current char from data attribute
    const charId = el.dataset.charId || 'maya';
    el.querySelector('.char-wrap').innerHTML = buildSVG(charId, parseInt(wrap.style.width)||160, emotion) + '<div class="char-shadow"></div>';
  }

  /* ── Subject-specific tutor assignment ──────────────────────── */
  const SUBJECT_TUTOR = {
    math: 'alex', science: 'alex', coding: 'kai', technology: 'kai',
    'ai-basics': 'kai', robotics: 'kai', english: 'maya', reading: 'maya',
    writing: 'maya', spelling: 'maya', grammar: 'maya', languages: 'maya',
    history: 'priya', geography: 'priya', civics: 'priya', cultures: 'priya',
    default: 'maya',
  };

  function tutorForSubject(subjectId) {
    return CHARS[SUBJECT_TUTOR[subjectId] || SUBJECT_TUTOR.default];
  }

  function charForAge(age) {
    const n = parseInt(age) || 10;
    return n <= 7 ? CHARS.leo : (n <= 12 ? CHARS.alex : CHARS.maya);
  }

  /* ── Welcome screen large character ─────────────────────────── */
  function renderWelcomeChar(containerId) {
    render('maya', containerId, 200, 'idle', 'anim-wave');
  }

  /* ── Feedback characters ────────────────────────────────────── */
  function showCorrect(charId = 'maya') {
    const el = document.getElementById('celebrate-char');
    if (el) {
      el.innerHTML = buildSVG(charId, 180, 'correct');
      el.className = 'celebrate-char';
    }
  }

  function showWrong(charId = 'alex') {
    const el = document.getElementById('celebrate-char');
    if (el) {
      el.innerHTML = buildSVG(charId, 180, 'wrong');
      el.className = 'char-wrap anim-support';
    }
  }

  return {
    CHARS, render, renderMini, animate, setEmotion,
    tutorForSubject, charForAge, showCorrect, showWrong,
    renderWelcomeChar, buildSVG,
  };
})();

window.BLChars = BLChars;
