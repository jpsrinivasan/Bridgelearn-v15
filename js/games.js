/* BridgeLearn V15 — Games Module
   10 self-contained educational mini-games
   Exposes: window.BLGames = { launch, stop }
   ─────────────────────────────────────────────────────────────── */
'use strict';

const BLGames = (() => {

  /* ── Shared helpers ──────────────────────────────────────────── */
  let _stopFn = null; // current game teardown hook

  function gameArea() { return document.getElementById('game-area'); }

  function setTitle(name) {
    const el = document.getElementById('game-play-title');
    if (el) el.textContent = name;
  }

  function clear() {
    if (typeof _stopFn === 'function') { try { _stopFn(); } catch (_) {} }
    _stopFn = null;
    const a = gameArea();
    if (a) a.innerHTML = '';
  }

  function stop() { clear(); }

  // Build full-screen results overlay inside game-area
  function showResults(opts) {
    // opts: { title, icon, score, maxScore, lines[], gameId }
    const won = opts.score >= Math.ceil(opts.maxScore * 0.6);
    const pct  = opts.maxScore > 0 ? Math.round((opts.score / opts.maxScore) * 100) : 0;
    const stars = pct >= 90 ? '⭐⭐⭐' : pct >= 60 ? '⭐⭐' : '⭐';

    const lines = (opts.lines || []).map(l => `<div class="res-line">${l}</div>`).join('');

    const a = gameArea();
    if (!a) return;
    a.innerHTML = `
      <div class="game-results">
        <div class="res-icon">${opts.icon || '🎮'}</div>
        <div class="res-title">${opts.title || 'Game Over'}</div>
        <div class="res-stars">${stars}</div>
        <div class="res-score">${opts.score} / ${opts.maxScore}</div>
        ${lines}
        <div class="res-actions">
          <button class="btn btn-primary btn-lg" id="btn-play-again">Play Again</button>
          <button class="btn btn-secondary btn-lg" id="btn-back-games">Back to Games</button>
        </div>
      </div>`;

    a.querySelector('#btn-back-games').addEventListener('click', () => {
      if (window.BLApp?.openGames) window.BLApp.openGames();
      else if (window.BL?.showScreen) window.BL.showScreen('games');
    });

    // Play-again re-launches same game — caller sets data-game-id on area
    const gameId = opts.gameId || a.dataset.gameId || '';
    a.querySelector('#btn-play-again').addEventListener('click', () => {
      if (gameId && window.BLGames) window.BLGames.launch(gameId, opts._ctx || {});
    });

    // Award XP
    if (opts.gameId) {
      window.BLGam?.recordGame(opts.gameId, won);
    }
    // Toast
    if (won) {
      window.BL?.toast('🏆', 'Nice work!', `${opts.score}/${opts.maxScore} — +XP earned`, 'success');
      window.BL?.confetti?.(30);
    } else {
      window.BL?.toast('🎮', 'Keep practising!', `Score: ${opts.score}/${opts.maxScore}`);
    }
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pick(arr, n) { return shuffle(arr).slice(0, n); }

  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  /* ══════════════════════════════════════════════════════════════
     1. MATH SPRINT
     60-second timer, arithmetic MCQ, difficulty by ageGroup
     ══════════════════════════════════════════════════════════════ */
  function playMathSprint(ctx) {
    setTitle('Math Sprint ⚡');
    const ag = ctx.profile?.ageGroup || '9-12';
    const a  = gameArea();
    let score = 0, total = 0, timeLeft = 60, timer = null;
    let answered = false;

    _stopFn = () => clearInterval(timer);

    function genProblem() {
      let q, ans;
      if (ag === '3-5') {
        const a1 = randInt(1, 10), a2 = randInt(1, 10);
        const op = Math.random() < 0.6 ? '+' : '-';
        if (op === '-' && a1 < a2) { q = `${a2} ${op} ${a1}`; ans = a2 - a1; }
        else { q = `${a1} ${op} ${a2}`; ans = op === '+' ? a1 + a2 : a1 - a2; }
      } else if (ag === '6-8') {
        const a1 = randInt(1, 20), a2 = randInt(1, 20);
        const op = Math.random() < 0.5 ? '+' : '-';
        const big = Math.max(a1, a2), small = Math.min(a1, a2);
        q   = `${big} ${op} ${small}`;
        ans = op === '+' ? big + small : big - small;
      } else if (ag === '9-12') {
        const ops = ['+', '-', '×', '÷'];
        const op  = ops[randInt(0, 3)];
        if (op === '×') {
          const a1 = randInt(2, 12), a2 = randInt(2, 12);
          q = `${a1} × ${a2}`; ans = a1 * a2;
        } else if (op === '÷') {
          const a2 = randInt(2, 12), a1 = a2 * randInt(2, 12);
          q = `${a1} ÷ ${a2}`; ans = a1 / a2;
        } else {
          const a1 = randInt(10, 99), a2 = randInt(10, 99);
          q = `${a1} ${op} ${a2}`; ans = op === '+' ? a1 + a2 : a1 - a2;
        }
      } else {
        // 13-18: fractions / percentages
        const type = randInt(0, 2);
        if (type === 0) {
          const pct = pick([10,20,25,50,75], 1)[0];
          const base = randInt(2, 20) * 4;
          q = `${pct}% of ${base}`; ans = Math.round(base * pct / 100);
        } else if (type === 1) {
          const d = pick([2,4,5,8,10], 1)[0];
          const n = randInt(1, d - 1);
          const base = d * randInt(2, 8);
          q = `${n}/${d} of ${base}`; ans = (n / d) * base;
        } else {
          const a1 = randInt(10, 200), a2 = randInt(10, 200);
          const op = Math.random() < 0.5 ? '+' : '-';
          const big = Math.max(a1, a2), small = Math.min(a1, a2);
          q = `${big} ${op} ${small}`; ans = op === '+' ? big + small : big - small;
        }
      }
      // Generate 3 wrong answers close to correct
      const wrongs = new Set();
      while (wrongs.size < 3) {
        const delta = randInt(1, 5) * (Math.random() < 0.5 ? 1 : -1);
        const w = ans + delta;
        if (w !== ans && w >= 0) wrongs.add(w);
      }
      const opts = shuffle([ans, ...wrongs]);
      return { q, ans, opts };
    }

    function render() {
      const prob = genProblem();
      answered   = false;
      a.dataset.gameId = 'math-sprint';

      a.innerHTML = `
        <div class="game-wrap">
          <div class="game-hud">
            <div class="hud-item"><span class="hud-icon">⏱</span><span id="ms-time">${timeLeft}s</span></div>
            <div class="hud-item"><span class="hud-icon">✅</span><span id="ms-score">${score}</span></div>
          </div>
          <div class="game-problem">
            <div class="prob-eq" id="ms-eq">${prob.q} = ?</div>
          </div>
          <div class="game-choices" id="ms-choices">
            ${prob.opts.map(o => `<button class="choice-btn" data-val="${o}">${o}</button>`).join('')}
          </div>
          <div class="game-feedback" id="ms-fb"></div>
        </div>`;

      a.querySelectorAll('.choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (answered) return;
          answered = true;
          total++;
          const chosen = Number(btn.dataset.val);
          const fb = a.querySelector('#ms-fb');
          if (chosen === prob.ans) {
            score++;
            btn.classList.add('choice-correct');
            fb.textContent = '✅ Correct!';
            a.querySelector('#ms-score').textContent = score;
          } else {
            btn.classList.add('choice-wrong');
            a.querySelectorAll('.choice-btn').forEach(b => {
              if (Number(b.dataset.val) === prob.ans) b.classList.add('choice-correct');
            });
            fb.textContent = `❌ Answer: ${prob.ans}`;
          }
          setTimeout(() => { if (timeLeft > 0) render(); }, 700);
        });
      });
    }

    render();

    timer = setInterval(() => {
      timeLeft--;
      const el = a.querySelector('#ms-time');
      if (el) el.textContent = `${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(timer);
        showResults({ title:'Math Sprint', icon:'⚡', score, maxScore: Math.max(total, 1),
          lines:[`<b>${score}</b> correct in 60 seconds`, `Answered: ${total}`],
          gameId:'math-sprint', _ctx: ctx });
      }
    }, 1000);
  }

  /* ══════════════════════════════════════════════════════════════
     2. SPELLING BEE
     Hear word → type it → 10 rounds
     ══════════════════════════════════════════════════════════════ */
  function playSpellingBee(ctx) {
    setTitle('Spelling Bee 🐝');
    const ag = ctx.profile?.ageGroup || '9-12';
    const a  = gameArea();

    const WORDS = {
      '3-5':  [['cat','The cat sat on the mat'],['dog','The dog runs fast'],['sun','The sun is bright'],
               ['hat','She wore a red hat'],['big','That is a big tree'],['run','I like to run'],
               ['fun','School is fun'],['cup','Fill the cup up'],['red','The apple is red'],['hop','Hop like a frog']],
      '6-8':  [['apple','I eat an apple every day'],['happy','She looks very happy'],['garden','We planted seeds in the garden'],
               ['school','I walk to school'],['friend','He is my best friend'],['colour','What colour is the sky?'],
               ['people','Many people came to the show'],['number','Pick a number from one to ten'],
               ['water','Drink plenty of water'],['family','I love my family']],
      '9-12': [['mountain','The climber reached the mountain top'],['journey','It was a long journey'],
               ['discovery','The discovery changed science forever'],['environment','We must protect the environment'],
               ['adventure','The book was full of adventure'],['important','Exercise is important for health'],
               ['question','Always ask a question when you are unsure'],['difficult','Some problems are difficult to solve'],
               ['necessary','Sleep is necessary for growth'],['history','We learn a lot from history']],
      '13-18':[['democracy','Democracy requires an informed citizenry'],['phenomenon','It was a rare natural phenomenon'],
               ['conscience','Let your conscience guide you'],['prejudice','We should overcome prejudice'],
               ['sufficient','The evidence was sufficient to prove the case'],['contemporary','She is a contemporary artist'],
               ['philosophy','Philosophy asks the big questions'],['guarantee','There is no guarantee of success'],
               ['rhythm','The drummer has a strong rhythm'],['necessary','It is necessary to prepare well']],
    };

    const pool   = shuffle(WORDS[ag] || WORDS['9-12']);
    const rounds = Math.min(10, pool.length);
    let idx = 0, score = 0;

    _stopFn = () => {};

    function renderRound() {
      if (idx >= rounds) {
        showResults({ title:'Spelling Bee', icon:'🐝', score, maxScore: rounds,
          lines:[`Spelled ${score} of ${rounds} correctly`], gameId:'spelling-bee', _ctx: ctx });
        return;
      }
      const [word, sentence] = pool[idx];
      a.dataset.gameId = 'spelling-bee';

      a.innerHTML = `
        <div class="game-wrap">
          <div class="game-hud">
            <div class="hud-item">Round ${idx + 1} / ${rounds}</div>
            <div class="hud-item">Score: ${score}</div>
          </div>
          <div class="spelling-card card">
            <p class="t-muted t-sm">Listen to the word, then type it below.</p>
            <button class="btn btn-primary mt-3" id="sp-listen">🔊 Hear Word</button>
            <p class="spelling-sentence t-sm t-muted mt-3" id="sp-sentence"></p>
            <input class="sp-input mt-3" id="sp-input" type="text" placeholder="Type the word…" autocomplete="off" autocorrect="off" spellcheck="false" />
            <div class="sp-feedback" id="sp-fb"></div>
            <button class="btn btn-primary btn-full mt-3" id="sp-submit">Check ✓</button>
          </div>
        </div>`;

      const speak  = () => window.BLVoice?.speak(word, 'en', 0.7);
      a.querySelector('#sp-listen').addEventListener('click', () => {
        speak();
        a.querySelector('#sp-sentence').textContent = `Context: "${sentence}"`;
      });

      const submit = () => {
        const typed = a.querySelector('#sp-input').value.trim().toLowerCase();
        const fb    = a.querySelector('#sp-fb');
        if (!typed) return;
        if (typed === word.toLowerCase()) {
          score++;
          fb.innerHTML = `<span class="fb-correct">✅ Correct!</span>`;
          window.BLVoice?.speakCorrect?.();
        } else {
          fb.innerHTML = `<span class="fb-wrong">❌ It was: <b>${word}</b></span>`;
          window.BLVoice?.speakWrong?.();
        }
        a.querySelector('#sp-submit').disabled = true;
        idx++;
        setTimeout(renderRound, 1200);
      };

      a.querySelector('#sp-submit').addEventListener('click', submit);
      a.querySelector('#sp-input').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

      // Auto-speak on load
      setTimeout(speak, 300);
    }

    renderRound();
  }

  /* ══════════════════════════════════════════════════════════════
     3. PLANET SORT
     Tap planets in order from the Sun — click-to-sequence UI
     ══════════════════════════════════════════════════════════════ */
  function playPlanetSort(ctx) {
    setTitle('Planet Sort 🪐');
    const a = gameArea();
    _stopFn = () => {};

    const PLANETS = [
      { name:'Mercury', emoji:'⚫', fact:'Closest to the Sun' },
      { name:'Venus',   emoji:'🟡', fact:'Hottest planet' },
      { name:'Earth',   emoji:'🌍', fact:'Our home planet' },
      { name:'Mars',    emoji:'🔴', fact:'The Red Planet' },
      { name:'Jupiter', emoji:'🟠', fact:'Largest planet' },
      { name:'Saturn',  emoji:'💛', fact:'Famous for its rings' },
      { name:'Uranus',  emoji:'🔵', fact:'Rotates on its side' },
      { name:'Neptune', emoji:'🟣', fact:'Farthest from the Sun' },
    ];

    let sequence  = [];
    let scrambled = shuffle(PLANETS);
    let attempts  = 0;

    function render() {
      sequence = [];
      scrambled = shuffle(PLANETS);
      a.dataset.gameId = 'planet-sort';

      a.innerHTML = `
        <div class="game-wrap">
          <p class="t-muted t-sm t-center mb-2">Tap the planets in order from the Sun ☀️</p>
          <div class="planet-grid" id="planet-source">
            ${scrambled.map(p => `
              <button class="planet-btn" data-name="${p.name}">
                <span class="planet-emoji">${p.emoji}</span>
                <span class="planet-name">${p.name}</span>
              </button>`).join('')}
          </div>
          <div class="planet-sequence card mt-3">
            <p class="t-label t-muted">Your order:</p>
            <div id="planet-seq-row" class="planet-seq-row"></div>
          </div>
          <div class="flex gap-3 mt-3">
            <button class="btn btn-secondary flex-1" id="ps-reset">Reset</button>
            <button class="btn btn-primary flex-1" id="ps-check">Check ✓</button>
          </div>
          <div id="ps-fb" class="game-feedback"></div>
        </div>`;

      a.querySelectorAll('.planet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          const name = btn.dataset.name;
          sequence.push(name);
          btn.disabled = true;
          btn.classList.add('planet-selected');
          const seqRow = a.querySelector('#planet-seq-row');
          const chip   = document.createElement('span');
          chip.className  = 'planet-chip';
          chip.textContent = PLANETS.find(p => p.name === name)?.emoji + ' ' + name;
          seqRow.appendChild(chip);
        });
      });

      a.querySelector('#ps-reset').addEventListener('click', render);

      a.querySelector('#ps-check').addEventListener('click', () => {
        attempts++;
        const correct = PLANETS.map(p => p.name);
        const isRight = sequence.length === correct.length &&
          sequence.every((n, i) => n === correct[i]);
        const fb = a.querySelector('#ps-fb');
        if (isRight) {
          fb.innerHTML = `<span class="fb-correct">✅ Perfect! Mercury → Neptune!</span>`;
          setTimeout(() => showResults({
            title:'Planet Sort', icon:'🪐', score:1, maxScore:1,
            lines:['You know the solar system!'], gameId:'planet-sort', _ctx: ctx }), 1000);
        } else {
          fb.innerHTML = `<span class="fb-wrong">❌ Not quite. Try again!</span>`;
          setTimeout(render, 1200);
        }
      });
    }

    render();
  }

  /* ══════════════════════════════════════════════════════════════
     4. QUIZ BATTLE
     10 rapid-fire quiz questions from quiz data, 15s per question
     ══════════════════════════════════════════════════════════════ */
  function playQuizBattle(ctx) {
    setTitle('Quiz Battle ⚔️');
    const ag  = ctx.profile?.ageGroup || '9-12';
    const a   = gameArea();
    let score = 0, qIdx = 0, timer = null;
    _stopFn   = () => clearInterval(timer);

    // Filter quiz pool to ageGroup, fall back to full pool
    let pool = (ctx.quiz || []).filter(q => !q.ageGroup || q.ageGroup === ag);
    if (pool.length < 5) pool = ctx.quiz || [];
    pool = shuffle(pool).slice(0, 10);

    const TOTAL = pool.length || 10;

    // Fallback built-in questions if no data
    const FALLBACK = [
      { q:'What planet is closest to the Sun?', options:['Mercury','Venus','Earth','Mars'], answer:'Mercury' },
      { q:'How many sides does a triangle have?', options:['2','3','4','5'], answer:'3' },
      { q:'What is the largest ocean?', options:['Atlantic','Indian','Arctic','Pacific'], answer:'Pacific' },
      { q:'What gas do plants absorb?', options:['Oxygen','Nitrogen','CO₂','Hydrogen'], answer:'CO₂' },
      { q:'Who wrote Romeo and Juliet?', options:['Dickens','Shakespeare','Austen','Tolkien'], answer:'Shakespeare' },
      { q:'What is 7 × 8?', options:['54','56','64','48'], answer:'56' },
      { q:'Capital of France?', options:['Rome','Berlin','Madrid','Paris'], answer:'Paris' },
      { q:'How many continents are there?', options:['5','6','7','8'], answer:'7' },
      { q:'What colour is the sky on a clear day?', options:['Green','Red','Blue','Yellow'], answer:'Blue' },
      { q:'What is H₂O?', options:['Salt','Water','Sugar','Milk'], answer:'Water' },
    ];

    if (!pool.length) pool = FALLBACK;

    function normalize(q) {
      // Support both {question, options, answer:"B"} and fallback {q, options, answer:"text"}
      const opts = q.options || [];
      let answer = q.answer || q.correct || '';
      // Convert letter answer (A/B/C/D) to actual option text
      if (typeof answer === 'string' && /^[A-D]$/.test(answer.trim())) {
        const idx = answer.trim().charCodeAt(0) - 65;
        answer = opts[idx] || answer;
      }
      return { text: q.question || q.q || 'Question', options: opts, answer };
    }

    function renderQ() {
      if (qIdx >= TOTAL) {
        clearInterval(timer);
        showResults({ title:'Quiz Battle', icon:'⚔️', score, maxScore: TOTAL,
          lines:[`${score} correct out of ${TOTAL}`], gameId:'quiz-battle', _ctx: ctx });
        return;
      }
      const raw = pool[qIdx];
      const q   = normalize(raw);
      let   t   = 15;
      clearInterval(timer);
      a.dataset.gameId = 'quiz-battle';

      a.innerHTML = `
        <div class="game-wrap">
          <div class="game-hud">
            <div class="hud-item">Q ${qIdx + 1}/${TOTAL}</div>
            <div class="hud-item">Score: <b>${score}</b></div>
            <div class="hud-item timer-hud" id="qb-time">⏱ ${t}s</div>
          </div>
          <div class="quiz-q card">${q.text}</div>
          <div class="game-choices" id="qb-opts">
            ${shuffle(q.options).map(o => `<button class="choice-btn" data-val="${o}">${o}</button>`).join('')}
          </div>
          <div id="qb-fb" class="game-feedback"></div>
        </div>`;

      let done = false;
      const choose = (chosen) => {
        if (done) return;
        done = true;
        clearInterval(timer);
        qIdx++;
        const correct = chosen === q.answer;
        if (correct) score++;
        a.querySelectorAll('.choice-btn').forEach(b => {
          if (b.dataset.val === q.answer) b.classList.add('choice-correct');
          else if (b.dataset.val === chosen && !correct) b.classList.add('choice-wrong');
          b.disabled = true;
        });
        a.querySelector('#qb-fb').innerHTML = correct
          ? `<span class="fb-correct">✅ Correct!</span>`
          : `<span class="fb-wrong">❌ Answer: ${q.answer}</span>`;
        setTimeout(renderQ, 900);
      };

      a.querySelectorAll('.choice-btn').forEach(b =>
        b.addEventListener('click', () => choose(b.dataset.val)));

      timer = setInterval(() => {
        t--;
        const el = a.querySelector('#qb-time');
        if (el) { el.textContent = `⏱ ${t}s`; if (t <= 5) el.classList.add('timer-low'); }
        if (t <= 0) choose('__timeout__');
      }, 1000);
    }

    renderQ();
  }

  /* ══════════════════════════════════════════════════════════════
     5. SENTENCE BUILDER
     Tap jumbled words to build correct sentence — 5 rounds
     ══════════════════════════════════════════════════════════════ */
  function playSentenceBuilder(ctx) {
    setTitle('Sentence Builder 🔤');
    const ag = ctx.profile?.ageGroup || '9-12';
    const a  = gameArea();
    _stopFn  = () => {};

    const SENTENCES = {
      young: ['The cat sat on the mat','I like to play outside','The dog is very happy',
              'We can see the stars at night','She has a big red ball'],
      mid:   ['The scientist discovered a new planet','Reading books improves your vocabulary',
              'The river flows into the ocean','Plants need sunlight to grow','The team worked together to win'],
      teen:  ['Democracy requires an informed citizenry','Technology shapes our modern world',
              'The environment needs our protection','Critical thinking leads to better decisions',
              'History helps us understand the present'],
    };

    const group  = ag === '3-5' || ag === '6-8' ? 'young' : ag === '9-12' ? 'mid' : 'teen';
    const pool   = shuffle(SENTENCES[group]);
    const rounds = Math.min(5, pool.length);
    let idx = 0, score = 0;

    function renderRound() {
      if (idx >= rounds) {
        showResults({ title:'Sentence Builder', icon:'🔤', score, maxScore: rounds,
          lines:[`Built ${score} of ${rounds} sentences correctly`],
          gameId:'sentence-builder', _ctx: ctx });
        return;
      }

      const sentence = pool[idx];
      const words    = sentence.split(' ');
      const jumbled  = shuffle(words);
      let   built    = [];
      let   remaining= [...jumbled];
      a.dataset.gameId = 'sentence-builder';

      function renderWords() {
        a.innerHTML = `
          <div class="game-wrap">
            <div class="game-hud">
              <div class="hud-item">Round ${idx + 1}/${rounds}</div>
              <div class="hud-item">Score: ${score}</div>
            </div>
            <div class="sb-built card" id="sb-built">
              ${built.length
                ? built.map((w, i) => `<span class="word-chip word-placed" data-idx="${i}">${w}</span>`).join(' ')
                : '<span class="t-muted t-sm">Tap words to build the sentence…</span>'}
            </div>
            <div class="sb-words" id="sb-words">
              ${remaining.map((w, i) => w ? `<button class="word-btn" data-idx="${i}">${w}</button>` : '').join('')}
            </div>
            <div class="flex gap-3 mt-3">
              <button class="btn btn-secondary" id="sb-undo">↩ Undo</button>
              <button class="btn btn-primary flex-1" id="sb-check">Check ✓</button>
            </div>
            <div id="sb-fb" class="game-feedback"></div>
          </div>`;

        a.querySelectorAll('.word-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const i = Number(btn.dataset.idx);
            built.push(remaining[i]);
            remaining[i] = null;
            renderWords();
          });
        });

        a.querySelectorAll('.word-placed').forEach(chip => {
          chip.addEventListener('click', () => {
            const i = Number(chip.dataset.idx);
            const w = built.splice(i, 1)[0];
            // Put back into remaining at first empty slot
            const slot = remaining.indexOf(null);
            if (slot !== -1) remaining[slot] = w; else remaining.push(w);
            renderWords();
          });
        });

        a.querySelector('#sb-undo').addEventListener('click', () => {
          if (!built.length) return;
          const w = built.pop();
          const slot = remaining.indexOf(null);
          if (slot !== -1) remaining[slot] = w; else remaining.push(w);
          renderWords();
        });

        a.querySelector('#sb-check').addEventListener('click', () => {
          const attempt = built.join(' ');
          const fb      = a.querySelector('#sb-fb');
          if (attempt === sentence) {
            score++;
            fb.innerHTML = `<span class="fb-correct">✅ Correct!</span>`;
          } else {
            fb.innerHTML = `<span class="fb-wrong">❌ Answer: <i>${sentence}</i></span>`;
          }
          a.querySelector('#sb-check').disabled = true;
          idx++;
          setTimeout(renderRound, 1400);
        });
      }

      renderWords();
    }

    renderRound();
  }

  /* ══════════════════════════════════════════════════════════════
     6. MATCH MASTER
     Memory card flip — 4×3 grid, 6 emoji pairs
     ══════════════════════════════════════════════════════════════ */
  function playMatchMaster(ctx) {
    setTitle('Match Master 🔗');
    const a = gameArea();
    _stopFn = () => {};

    const SETS = [
      ['🦁','🐘','🦒','🐬','🦅','🐢'],
      ['🍎','🍌','🍓','🍇','🍊','🍋'],
      ['⚽','🏀','🎾','🏓','🏈','🎯'],
      ['🌍','🌙','☀️','⭐','🌈','❄️'],
    ];

    const emojis   = shuffle(SETS[randInt(0, SETS.length - 1)]);
    const pairs    = shuffle([...emojis, ...emojis]);
    const cards    = pairs.map((e, i) => ({ id: i, emoji: e, flipped: false, matched: false }));

    let flipped    = [];
    let moves      = 0;
    let matched    = 0;
    let startTime  = Date.now();
    let locked     = false;
    a.dataset.gameId = 'match-master';

    function renderBoard() {
      a.innerHTML = `
        <div class="game-wrap">
          <div class="game-hud">
            <div class="hud-item">Moves: <b id="mm-moves">0</b></div>
            <div class="hud-item">Matched: <b id="mm-matched">0</b>/6</div>
          </div>
          <div class="mm-grid" id="mm-grid">
            ${cards.map(c => `
              <div class="mm-card" data-id="${c.id}">
                <div class="mm-card-inner">
                  <div class="mm-card-front">?</div>
                  <div class="mm-card-back">${c.emoji}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>`;

      a.querySelectorAll('.mm-card').forEach(el => {
        el.addEventListener('click', () => {
          const id  = Number(el.dataset.id);
          const card= cards[id];
          if (locked || card.flipped || card.matched) return;

          card.flipped = true;
          el.classList.add('flipped');
          flipped.push({ id, el });

          if (flipped.length === 2) {
            locked = true;
            moves++;
            a.querySelector('#mm-moves').textContent = moves;
            const [c1, c2] = flipped;
            if (cards[c1.id].emoji === cards[c2.id].emoji) {
              cards[c1.id].matched = cards[c2.id].matched = true;
              c1.el.classList.add('matched');
              c2.el.classList.add('matched');
              matched++;
              a.querySelector('#mm-matched').textContent = matched;
              flipped = [];
              locked  = false;
              if (matched === 6) {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                setTimeout(() => showResults({
                  title:'Match Master', icon:'🔗', score: Math.max(1, 20 - moves),
                  maxScore: 20, lines:[`Completed in ${moves} moves`, `Time: ${elapsed}s`],
                  gameId:'match-master', _ctx: ctx }), 500);
              }
            } else {
              setTimeout(() => {
                cards[c1.id].flipped = cards[c2.id].flipped = false;
                c1.el.classList.remove('flipped');
                c2.el.classList.remove('flipped');
                flipped = [];
                locked  = false;
              }, 900);
            }
          }
        });
      });
    }

    renderBoard();
  }

  /* ══════════════════════════════════════════════════════════════
     7. FLASHCARD RACE
     Flip cards, self-report Got it / Try Again — 10 cards
     ══════════════════════════════════════════════════════════════ */
  function playFlashcardRace(ctx) {
    setTitle('Flashcard Race 🃏');
    const a  = gameArea();
    _stopFn  = () => {};

    // Build card pool from quiz data or use built-in facts
    const BUILTIN = [
      { q:'What is the powerhouse of the cell?', a:'Mitochondria' },
      { q:'What is the speed of light?',          a:'~300,000 km/s' },
      { q:'Who discovered gravity?',              a:'Isaac Newton' },
      { q:'What is the chemical symbol for gold?',a:'Au' },
      { q:'How many bones in the adult body?',    a:'206' },
      { q:'What is the largest planet?',          a:'Jupiter' },
      { q:'In what year did WW2 end?',            a:'1945' },
      { q:'What is the square root of 144?',      a:'12' },
      { q:'Who painted the Mona Lisa?',           a:'Leonardo da Vinci' },
      { q:'What is the capital of Japan?',        a:'Tokyo' },
    ];

    let pool = ctx.quiz?.length >= 5
      ? shuffle(ctx.quiz).slice(0, 10).map(q => {
          const opts = q.options || [];
          let a = q.answer || q.correct || '';
          if (typeof a === 'string' && /^[A-D]$/.test(a.trim())) {
            a = opts[a.trim().charCodeAt(0) - 65] || a;
          }
          return { q: q.question || q.q, a };
        })
      : BUILTIN;
    pool = pool.slice(0, 10);

    let idx = 0, gotIt = 0;
    a.dataset.gameId = 'flashcard-race';

    function renderCard() {
      if (idx >= pool.length) {
        showResults({ title:'Flashcard Race', icon:'🃏', score: gotIt, maxScore: pool.length,
          lines:[`${gotIt} cards nailed!`, `${pool.length - gotIt} to review`],
          gameId:'flashcard-race', _ctx: ctx });
        return;
      }
      const card = pool[idx];

      a.innerHTML = `
        <div class="game-wrap">
          <div class="game-hud">
            <div class="hud-item">Card ${idx + 1}/${pool.length}</div>
            <div class="hud-item">Got it: ✅ ${gotIt}</div>
          </div>
          <div class="fc-card card" id="fc-card">
            <div class="fc-front">
              <p class="t-label t-muted mb-2">QUESTION</p>
              <p class="fc-text">${card.q}</p>
              <button class="btn btn-primary mt-3" id="fc-flip">Flip to see answer 👇</button>
            </div>
            <div class="fc-back hidden">
              <p class="t-label t-muted mb-2">ANSWER</p>
              <p class="fc-text t-accent t-bold">${card.a}</p>
              <div class="flex gap-3 mt-4">
                <button class="btn btn-success flex-1" id="fc-got">✓ Got it!</button>
                <button class="btn btn-danger flex-1"  id="fc-try">✗ Try again</button>
              </div>
            </div>
          </div>
        </div>`;

      a.querySelector('#fc-flip').addEventListener('click', () => {
        a.querySelector('.fc-front').classList.add('hidden');
        a.querySelector('.fc-back').classList.remove('hidden');
      });

      a.querySelector('#fc-got').addEventListener('click', () => { gotIt++; idx++; renderCard(); });
      a.querySelector('#fc-try').addEventListener('click', () => { idx++; renderCard(); });
    }

    renderCard();
  }

  /* ══════════════════════════════════════════════════════════════
     8. SPEAKING COACH
     Show phrase → user speaks → score with BL.similarity()
     5 rounds
     ══════════════════════════════════════════════════════════════ */
  function playSpeakingCoach(ctx) {
    setTitle('Speaking Coach 🎤');
    const ag = ctx.profile?.ageGroup || '9-12';
    const a  = gameArea();
    _stopFn  = () => window.BLVoice?.stopListening?.();

    const PHRASES = {
      '3-5':  ['Hello, my name is …','I am happy today','The sun is shining bright','I love to read books'],
      '6-8':  ['The quick brown fox','Science is amazing','I enjoy learning new things','Every day is a new adventure'],
      '9-12': ['Knowledge is power','The environment needs our care','Curiosity drives discovery','Learning never stops'],
      '13-18':['Democracy requires an informed citizenry','Innovation shapes the future',
               'Critical thinking leads to better solutions','Every voice matters in a democracy'],
    };

    const pool   = shuffle(PHRASES[ag] || PHRASES['9-12']);
    const rounds = Math.min(5, pool.length);
    let idx = 0, totalScore = 0;

    function renderRound() {
      if (idx >= rounds) {
        const avg = Math.round(totalScore / rounds);
        showResults({ title:'Speaking Coach', icon:'🎤', score: avg, maxScore: 100,
          lines:[`Average accuracy: ${avg}%`, idx === rounds ? 'Great effort!' : ''],
          gameId:'speaking-coach', _ctx: ctx });
        return;
      }
      const phrase = pool[idx];
      a.dataset.gameId = 'speaking-coach';

      a.innerHTML = `
        <div class="game-wrap">
          <div class="game-hud">
            <div class="hud-item">Round ${idx + 1}/${rounds}</div>
            <div class="hud-item">Avg: ${idx > 0 ? Math.round(totalScore/idx) : '--'}%</div>
          </div>
          <div class="sc-card card">
            <p class="t-label t-muted">Say this phrase:</p>
            <p class="sc-phrase" id="sc-phrase">"${phrase}"</p>
            <button class="btn btn-secondary btn-sm mt-2" id="sc-hear">🔊 Hear it</button>
          </div>
          <button class="btn btn-primary btn-lg btn-full mt-4" id="sc-speak">🎤 Start Speaking</button>
          <div class="sc-status t-muted t-sm t-center mt-2" id="sc-status">Press the button and speak clearly</div>
          <div id="sc-result" class="sc-result hidden"></div>
        </div>`;

      a.querySelector('#sc-hear').addEventListener('click', () =>
        window.BLVoice?.speak(phrase, 'en', 0.8));

      const speakBtn = a.querySelector('#sc-speak');
      speakBtn.addEventListener('click', () => {
        if (!window.BLVoice?.startListening) {
          a.querySelector('#sc-status').textContent = 'Speech recognition not supported in this browser.';
          return;
        }
        speakBtn.textContent = '🔴 Listening…';
        speakBtn.disabled    = true;
        a.querySelector('#sc-status').textContent  = 'Speak now…';

        window.BLVoice.startListening(
          (transcript) => {
            const sim = window.BL?.similarity?.(transcript, phrase) ?? 0;
            totalScore += sim;
            const res = a.querySelector('#sc-result');
            res.classList.remove('hidden');
            const grade = sim >= 85 ? '🌟 Excellent!' : sim >= 65 ? '👍 Good job!' : '🔄 Keep practising!';
            res.innerHTML = `
              <div class="sc-heard">You said: <i>"${transcript}"</i></div>
              <div class="sc-score-bar">
                <div class="sc-bar-fill" style="width:${sim}%"></div>
              </div>
              <div class="sc-pct">${sim}% — ${grade}</div>`;
            speakBtn.textContent = '🎤 Start Speaking';
            speakBtn.disabled    = false;
            idx++;
            setTimeout(renderRound, 2000);
          },
          (_, reason) => {
            if (reason === 'unsupported') {
              a.querySelector('#sc-status').textContent = 'Speech not supported. Skipping round.';
              idx++;
              setTimeout(renderRound, 1500);
            } else {
              speakBtn.textContent = '🎤 Start Speaking';
              speakBtn.disabled    = false;
              a.querySelector('#sc-status').textContent = 'Could not hear you — try again!';
            }
          },
          'en'
        );
      });
    }

    renderRound();
  }

  /* ══════════════════════════════════════════════════════════════
     9. FLAG MATCH
     Flag emoji → tap correct country name, 10 questions, 8s each
     ══════════════════════════════════════════════════════════════ */
  const FLAGS = [
    {flag:'🇺🇸',name:'United States'},{flag:'🇬🇧',name:'United Kingdom'},
    {flag:'🇮🇳',name:'India'},{flag:'🇦🇺',name:'Australia'},
    {flag:'🇨🇦',name:'Canada'},{flag:'🇫🇷',name:'France'},
    {flag:'🇩🇪',name:'Germany'},{flag:'🇯🇵',name:'Japan'},
    {flag:'🇧🇷',name:'Brazil'},{flag:'🇮🇹',name:'Italy'},
    {flag:'🇨🇳',name:'China'},{flag:'🇲🇽',name:'Mexico'},
    {flag:'🇪🇸',name:'Spain'},{flag:'🇷🇺',name:'Russia'},
    {flag:'🇿🇦',name:'South Africa'},{flag:'🇰🇷',name:'South Korea'},
    {flag:'🇸🇦',name:'Saudi Arabia'},{flag:'🇳🇬',name:'Nigeria'},
    {flag:'🇦🇷',name:'Argentina'},{flag:'🇵🇹',name:'Portugal'},
  ];

  function playFlagMatch(ctx) {
    setTitle('Flag Match 🌍');
    const a = gameArea();
    let score = 0, qIdx = 0, timer = null;
    _stopFn   = () => clearInterval(timer);

    const pool  = shuffle(FLAGS).slice(0, 10);
    const TOTAL = pool.length;

    function renderQ() {
      if (qIdx >= TOTAL) {
        clearInterval(timer);
        showResults({ title:'Flag Match', icon:'🌍', score, maxScore: TOTAL,
          lines:[`${score} correct out of ${TOTAL}`], gameId:'flag-match', _ctx: ctx });
        return;
      }
      const correct = pool[qIdx];
      // Pick 3 wrong countries from remaining FLAGS
      const wrongs  = shuffle(FLAGS.filter(f => f.name !== correct.name)).slice(0, 3);
      const options = shuffle([correct, ...wrongs]);
      let   t       = 8;
      clearInterval(timer);
      a.dataset.gameId = 'flag-match';

      a.innerHTML = `
        <div class="game-wrap">
          <div class="game-hud">
            <div class="hud-item">Q ${qIdx + 1}/${TOTAL}</div>
            <div class="hud-item">Score: <b>${score}</b></div>
            <div class="hud-item timer-hud" id="fm-time">⏱ ${t}s</div>
          </div>
          <div class="flag-display card">${correct.flag}</div>
          <div class="game-choices" id="fm-opts">
            ${options.map(o => `<button class="choice-btn" data-name="${o.name}">${o.name}</button>`).join('')}
          </div>
          <div id="fm-fb" class="game-feedback"></div>
        </div>`;

      let done = false;
      const choose = (chosen) => {
        if (done) return;
        done = true;
        clearInterval(timer);
        qIdx++;
        const isRight = chosen === correct.name;
        if (isRight) score++;
        a.querySelectorAll('.choice-btn').forEach(b => {
          if (b.dataset.name === correct.name) b.classList.add('choice-correct');
          else if (b.dataset.name === chosen && !isRight) b.classList.add('choice-wrong');
          b.disabled = true;
        });
        a.querySelector('#fm-fb').innerHTML = isRight
          ? `<span class="fb-correct">✅ ${correct.name}!</span>`
          : `<span class="fb-wrong">❌ ${correct.flag} = ${correct.name}</span>`;
        setTimeout(renderQ, 900);
      };

      a.querySelectorAll('.choice-btn').forEach(b =>
        b.addEventListener('click', () => choose(b.dataset.name)));

      timer = setInterval(() => {
        t--;
        const el = a.querySelector('#fm-time');
        if (el) { el.textContent = `⏱ ${t}s`; if (t <= 3) el.classList.add('timer-low'); }
        if (t <= 0) choose('__timeout__');
      }, 1000);
    }

    renderQ();
  }

  /* ══════════════════════════════════════════════════════════════
     10. MONEY MATHS
     Change / total problems with emoji coins — 5 problems
     ══════════════════════════════════════════════════════════════ */
  function playMoneyMaths(ctx) {
    setTitle('Money Maths 💰');
    const ag = ctx.profile?.ageGroup || '9-12';
    const a  = gameArea();
    _stopFn  = () => {};

    const COIN_EMOJI = { 1:'🪙1p', 2:'🪙2p', 5:'🪙5p', 10:'🔟', 20:'💶', 50:'💷', 100:'🔵' };

    function genProblem() {
      if (ag === '3-5') {
        // Simple total: 2-3 small coin values
        const coins = [pick([1,2,5,10], 2)].flat().map(v => randInt(1,4)).map((cnt,i) => ({
          coin: [1,2,5,10][i % 4], cnt
        }));
        const items = [
          { name:'🍬 Candy', price: randInt(5,20) },
          { name:'🖍 Crayon', price: randInt(10,30) },
        ];
        const item  = pick(items, 1)[0];
        const paid  = item.price + randInt(1, 10) * 5;
        const ans   = paid - item.price;
        return {
          question: `You pay ${paid}p for a ${item.price}p ${item.name}. How much change?`,
          answer:   ans,
          unit:     'p'
        };
      } else if (ag === '6-8') {
        const prices = [randInt(10,99), randInt(10,99)];
        const total  = prices.reduce((s,p) => s+p, 0);
        const paid   = Math.ceil(total / 50) * 50;
        const change = paid - total;
        return {
          question: `You buy two items for ${prices[0]}p and ${prices[1]}p. You pay ${paid}p. Change?`,
          answer:   change,
          unit:     'p'
        };
      } else if (ag === '9-12') {
        const items = [
          { name:'Book', price: randInt(5,15) },
          { name:'Pen',  price: randInt(1,5) },
          { name:'Bag',  price: randInt(8,20) },
        ];
        const chosen = pick(items, 2);
        const total  = chosen.reduce((s,i) => s + i.price, 0);
        const paid   = Math.ceil(total / 5) * 5;
        const change = paid - total;
        return {
          question: `${chosen.map(i=>`${i.name} £${i.price}`).join(' + ')} = total? Pay £${paid}, change?`,
          answer:   change,
          unit:     '£'
        };
      } else {
        // Teen: percentages / tax
        const price  = randInt(10, 100);
        const disc   = pick([10,15,20,25], 1)[0];
        const final  = price - Math.round(price * disc / 100);
        return {
          question: `Item costs £${price}. You get ${disc}% off. What do you pay?`,
          answer:   final,
          unit:     '£'
        };
      }
    }

    const rounds = 5;
    let idx = 0, score = 0;

    function renderRound() {
      if (idx >= rounds) {
        showResults({ title:'Money Maths', icon:'💰', score, maxScore: rounds,
          lines:[`${score} of ${rounds} correct`], gameId:'money-maths', _ctx: ctx });
        return;
      }
      const prob = genProblem();
      // Generate 3 wrong answers
      const wrongs = new Set();
      while (wrongs.size < 3) {
        const delta = randInt(1,4) * 5 * (Math.random() < 0.5 ? 1 : -1);
        const w = prob.answer + delta;
        if (w !== prob.answer && w >= 0) wrongs.add(w);
      }
      const options = shuffle([prob.answer, ...wrongs]);
      a.dataset.gameId = 'money-maths';

      a.innerHTML = `
        <div class="game-wrap">
          <div class="game-hud">
            <div class="hud-item">Problem ${idx + 1}/${rounds}</div>
            <div class="hud-item">Score: ${score}</div>
          </div>
          <div class="mm-problem card">
            <p class="t-label t-muted mb-2">💰 MONEY PROBLEM</p>
            <p class="prob-text">${prob.question}</p>
          </div>
          <div class="game-choices mt-3" id="mo-opts">
            ${options.map(o => `<button class="choice-btn" data-val="${o}">${prob.unit}${o}</button>`).join('')}
          </div>
          <div id="mo-fb" class="game-feedback"></div>
        </div>`;

      a.querySelectorAll('.choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const chosen = Number(btn.dataset.val);
          const isRight= chosen === prob.answer;
          if (isRight) score++;
          a.querySelectorAll('.choice-btn').forEach(b => {
            if (Number(b.dataset.val) === prob.answer) b.classList.add('choice-correct');
            else if (Number(b.dataset.val) === chosen && !isRight) b.classList.add('choice-wrong');
            b.disabled = true;
          });
          a.querySelector('#mo-fb').innerHTML = isRight
            ? `<span class="fb-correct">✅ Correct! ${prob.unit}${prob.answer}</span>`
            : `<span class="fb-wrong">❌ Answer: ${prob.unit}${prob.answer}</span>`;
          idx++;
          setTimeout(renderRound, 1100);
        });
      });
    }

    renderRound();
  }

  /* ══════════════════════════════════════════════════════════════
     ROUTER — launch(gameId, ctx)
     ══════════════════════════════════════════════════════════════ */
  const GAME_MAP = {
    'math-sprint':     playMathSprint,
    'spelling':        playSpellingBee,
    'spelling-bee':    playSpellingBee,
    'planet-sort':     playPlanetSort,
    'quiz-battle':     playQuizBattle,
    'sentence-build':  playSentenceBuilder,
    'sentence-builder':playSentenceBuilder,
    'match-master':    playMatchMaster,
    'flash-race':      playFlashcardRace,
    'flashcard-race':  playFlashcardRace,
    'speaking-coach':  playSpeakingCoach,
    'flag-match':      playFlagMatch,
    'money-game':      playMoneyMaths,
    'money-maths':     playMoneyMaths,
  };

  function launch(gameId, ctx = {}) {
    clear();
    const fn = GAME_MAP[gameId];
    const a  = gameArea();
    if (!fn) {
      if (a) a.innerHTML = `<div class="empty-state"><div class="empty-icon">🎮</div><p>Game "${gameId}" not found.</p></div>`;
      return;
    }
    if (a) a.dataset.gameId = gameId;
    try {
      fn(ctx);
    } catch (err) {
      console.error('[BLGames] Error launching', gameId, err);
      if (a) a.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Game failed to load. Please try again.</p></div>`;
    }
  }

  return { launch, stop };

})();

/* ── Inline game styles ─────────────────────────────────────────
   Scoped CSS injected once so games.js is fully self-contained
   ─────────────────────────────────────────────────────────────── */
(function injectGameStyles() {
  if (document.getElementById('bl-game-styles')) return;
  const s = document.createElement('style');
  s.id = 'bl-game-styles';
  s.textContent = `
    /* ── Layout wrapper ────────────────────────────────── */
    .game-wrap {
      display: flex; flex-direction: column;
      padding: 1rem; gap: 0.75rem;
      min-height: 100%;
    }

    /* ── HUD ───────────────────────────────────────────── */
    .game-hud {
      display: flex; justify-content: space-between; align-items: center;
      background: var(--card-bg, #fff); border-radius: 12px;
      padding: 0.6rem 1rem; font-size: 0.85rem; font-weight: 600;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .hud-item { display:flex; align-items:center; gap:4px; }
    .hud-icon { font-size:1rem; }
    .timer-hud { color: var(--accent, #6c63ff); }
    .timer-low { color: #f5576c !important; animation: pulse 0.6s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

    /* ── Choices ───────────────────────────────────────── */
    .game-choices {
      display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;
    }
    .choice-btn {
      background: var(--card-bg, #fff);
      border: 2px solid var(--border, #e2e8f0);
      border-radius: 12px; padding: 0.85rem 0.5rem;
      font-size: 0.95rem; font-weight: 600;
      cursor: pointer; transition: all 0.18s;
      color: var(--text-primary, #1a1a2e);
    }
    .choice-btn:hover:not(:disabled) { border-color: var(--accent,#6c63ff); transform:translateY(-2px); }
    .choice-correct { background:#d4edda !important; border-color:#28a745 !important; color:#155724 !important; }
    .choice-wrong   { background:#f8d7da !important; border-color:#dc3545 !important; color:#721c24 !important; }
    .choice-btn:disabled { cursor: default; }

    /* ── Feedback line ─────────────────────────────────── */
    .game-feedback { min-height: 1.5rem; text-align:center; font-weight:600; font-size:0.95rem; }
    .fb-correct { color: #28a745; }
    .fb-wrong   { color: #dc3545; }

    /* ── Problem display ───────────────────────────────── */
    .game-problem { display:flex; justify-content:center; align-items:center; }
    .prob-eq {
      font-size: clamp(1.6rem, 7vw, 2.4rem); font-weight:900;
      text-align:center; padding:1rem;
      background: var(--card-bg,#fff); border-radius:16px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      width:100%;
    }
    .prob-text { font-size:1rem; font-weight:600; line-height:1.5; }

    /* ── Results screen ────────────────────────────────── */
    .game-results {
      display:flex; flex-direction:column; align-items:center;
      gap:0.75rem; padding:2rem 1.5rem; text-align:center;
    }
    .res-icon  { font-size:4rem; }
    .res-title { font-size:1.4rem; font-weight:900; }
    .res-stars { font-size:1.6rem; letter-spacing:4px; }
    .res-score { font-size:2.4rem; font-weight:900; color:var(--accent,#6c63ff); }
    .res-line  { font-size:0.9rem; color:var(--text-muted,#888); }
    .res-actions { display:flex; flex-direction:column; gap:0.75rem; width:100%; margin-top:0.5rem; }

    /* ── Spelling Bee ──────────────────────────────────── */
    .spelling-card { padding:1.25rem; display:flex; flex-direction:column; align-items:center; text-align:center; }
    .sp-input {
      width:100%; padding:0.75rem 1rem; border-radius:12px;
      border:2px solid var(--border,#e2e8f0); font-size:1.1rem;
      text-align:center; background:var(--input-bg,#f8fafc);
      color:var(--text-primary,#1a1a2e); outline:none;
    }
    .sp-input:focus { border-color:var(--accent,#6c63ff); }
    .sp-feedback { min-height:1.5rem; font-weight:600; font-size:0.95rem; margin-top:0.25rem; }

    /* ── Planet Sort ───────────────────────────────────── */
    .planet-grid {
      display:grid; grid-template-columns: repeat(4,1fr); gap:0.5rem;
    }
    .planet-btn {
      display:flex; flex-direction:column; align-items:center;
      background:var(--card-bg,#fff); border:2px solid var(--border,#e2e8f0);
      border-radius:12px; padding:0.6rem 0.25rem;
      cursor:pointer; transition:all 0.15s;
    }
    .planet-btn:hover:not(:disabled) { border-color:var(--accent,#6c63ff); transform:scale(1.05); }
    .planet-btn.planet-selected { opacity:0.4; border-style:dashed; }
    .planet-emoji { font-size:1.5rem; }
    .planet-name  { font-size:0.62rem; font-weight:700; text-align:center; margin-top:2px; }
    .planet-sequence { padding:0.75rem; }
    .planet-seq-row { display:flex; flex-wrap:wrap; gap:0.4rem; min-height:1.8rem; margin-top:0.4rem; }
    .planet-chip {
      background:var(--accent,#6c63ff); color:#fff;
      border-radius:8px; padding:0.2rem 0.5rem; font-size:0.78rem; font-weight:600;
    }

    /* ── Sentence Builder ──────────────────────────────── */
    .sb-built {
      min-height:3.5rem; display:flex; flex-wrap:wrap;
      gap:0.4rem; align-items:center; padding:0.75rem;
    }
    .sb-words { display:flex; flex-wrap:wrap; gap:0.5rem; }
    .word-btn {
      background:var(--card-bg,#fff); border:2px solid var(--accent,#6c63ff);
      border-radius:8px; padding:0.4rem 0.75rem;
      font-size:0.92rem; font-weight:600; cursor:pointer;
      color:var(--accent,#6c63ff); transition:all 0.15s;
    }
    .word-btn:hover { background:var(--accent,#6c63ff); color:#fff; }
    .word-chip {
      background:var(--accent,#6c63ff); color:#fff;
      border-radius:8px; padding:0.35rem 0.65rem; font-size:0.9rem; font-weight:600;
      cursor:pointer; transition:opacity 0.1s;
    }
    .word-chip:hover { opacity:0.8; }

    /* ── Match Master ──────────────────────────────────── */
    .mm-grid {
      display:grid; grid-template-columns:repeat(4,1fr); gap:0.5rem;
    }
    .mm-card {
      aspect-ratio:1; perspective:600px; cursor:pointer;
    }
    .mm-card-inner {
      position:relative; width:100%; height:100%;
      transform-style:preserve-3d; transition:transform 0.4s;
    }
    .mm-card.flipped .mm-card-inner { transform:rotateY(180deg); }
    .mm-card-front, .mm-card-back {
      position:absolute; width:100%; height:100%;
      backface-visibility:hidden; border-radius:10px;
      display:flex; align-items:center; justify-content:center;
      font-size:clamp(1rem,5vw,1.6rem); font-weight:800;
    }
    .mm-card-front {
      background:var(--accent,#6c63ff); color:#fff;
    }
    .mm-card-back {
      background:var(--card-bg,#fff); border:2px solid var(--border,#e2e8f0);
      transform:rotateY(180deg);
    }
    .mm-card.matched .mm-card-back {
      background:#d4edda; border-color:#28a745;
    }

    /* ── Flashcard ─────────────────────────────────────── */
    .fc-card { padding:1.5rem; min-height:14rem; display:flex; flex-direction:column; justify-content:center; }
    .fc-text { font-size:1.15rem; font-weight:700; line-height:1.5; text-align:center; }

    /* ── Speaking Coach ────────────────────────────────── */
    .sc-card { padding:1.25rem; text-align:center; }
    .sc-phrase { font-size:1.2rem; font-weight:800; margin-top:0.5rem; color:var(--accent,#6c63ff); }
    .sc-result { margin-top:0.75rem; padding:1rem; background:var(--card-bg,#fff); border-radius:12px; }
    .sc-heard  { font-size:0.88rem; font-style:italic; color:var(--text-muted,#888); margin-bottom:0.5rem; }
    .sc-score-bar { background:var(--border,#e2e8f0); border-radius:99px; height:10px; overflow:hidden; }
    .sc-bar-fill  { background:var(--accent,#6c63ff); height:100%; border-radius:99px; transition:width 0.6s; }
    .sc-pct { font-size:1rem; font-weight:700; margin-top:0.4rem; }
    .sc-status { margin-top:0.5rem; }

    /* ── Flag Match ────────────────────────────────────── */
    .flag-display {
      text-align:center; font-size:clamp(4rem,20vw,6rem);
      padding:1.5rem; border-radius:16px;
    }

    /* ── Money Maths ───────────────────────────────────── */
    .mm-problem { padding:1.25rem; }

    /* ── Quiz Q card ───────────────────────────────────── */
    .quiz-q {
      padding:1.25rem; font-size:1.05rem; font-weight:700;
      line-height:1.5; border-radius:14px;
    }
  `;
  document.head.appendChild(s);
}());

window.BLGames = BLGames;
