// ══════════════════════════════════════════════════════════════
    //  COMBOS DEFINITION WITH HITLAG & CANCEL FRAMES
    // ══════════════════════════════════════════════════════════════
    const COMBOS = {
      n2d: {
        id: 'n2d',
        name: 'N2D (Normal 2 → Dash)',
        loopLen: 1050,
        flow: [
          { label: 'SPAM N1', type: 'spam' },
          { label: 'SPAM N2', type: 'spam' },
          { label: 'DASH CANCEL', type: 'cancel' }
        ],
        bars: [
          { lane: 'atk', start: 0, end: 280, label: 'N1 (SPAM)' },
          { lane: 'atk', start: 340, end: 620, label: 'N2 (SPAM)' },
          { lane: 'dash', start: 660, end: 720, label: 'DASH CANCEL' }
        ],
        cancelTime: 660, // Exact target frame for Dash cancel
        cancelAction: 'dash'
      },
      n2cd: {
        id: 'n2cd',
        name: 'N2CD (N2 → Charged → Dash)',
        loopLen: 1550,
        flow: [
          { label: 'SPAM N1+N2', type: 'spam' },
          { label: 'HOLD CHARGE', type: 'spam' },
          { label: 'DASH CANCEL', type: 'cancel' }
        ],
        bars: [
          { lane: 'atk', start: 0, end: 260, label: 'N1 (SPAM)' },
          { lane: 'atk', start: 320, end: 580, label: 'N2 (SPAM)' },
          { lane: 'atk', start: 640, end: 1100, label: 'CHARGED' },
          { lane: 'dash', start: 1140, end: 1200, label: 'DASH CANCEL' }
        ],
        cancelTime: 1140,
        cancelAction: 'dash'
      },
      n5d: {
        id: 'n5d',
        name: 'N5D (5-Hit String → Dash)',
        loopLen: 2150,
        flow: [
          { label: 'SPAM N1-N4', type: 'spam' },
          { label: 'N5 FINISHER', type: 'spam' },
          { label: 'DASH CANCEL', type: 'cancel' }
        ],
        bars: [
          { lane: 'atk', start: 0, end: 220, label: 'N1' },
          { lane: 'atk', start: 280, end: 500, label: 'N2' },
          { lane: 'atk', start: 560, end: 780, label: 'N3' },
          { lane: 'atk', start: 840, end: 1060, label: 'N4' },
          { lane: 'atk', start: 1120, end: 1580, label: 'N5 FINISHER' },
          { lane: 'dash', start: 1620, end: 1680, label: 'DASH CANCEL' }
        ],
        cancelTime: 1620,
        cancelAction: 'dash'
      },
      n3w: {
        id: 'n3w',
        name: 'N3W (Normal 3 → Walk)',
        loopLen: 1350,
        flow: [
          { label: 'SPAM N1-N3', type: 'spam' },
          { label: 'WALK CANCEL', type: 'cancel' }
        ],
        bars: [
          { lane: 'atk', start: 0, end: 260, label: 'N1' },
          { lane: 'atk', start: 320, end: 580, label: 'N2' },
          { lane: 'atk', start: 640, end: 900, label: 'N3' },
          { lane: 'dash', start: 940, end: 1080, label: 'WALK CANCEL' }
        ],
        cancelTime: 940,
        cancelAction: 'walk'
      }
    };

    const TOL_WINDOWS = {
      relaxed: { perfect: 45, good: 85, earlyLate: 135 },
      normal:  { perfect: 30, good: 65, earlyLate: 105 },
      strict:  { perfect: 18, good: 40, earlyLate: 75 }
    };

    // ══════════════════════════════════════════════════════════════
    //  STATE
    // ══════════════════════════════════════════════════════════════
    let state = {
      comboKey: 'n2d',
      running: false,
      awaitingFirst: false,
      startTime: 0,
      tempo: 1.0,
      tolerance: 'normal',
      sound: true,
      darkTheme: true,

      // Speed & Streak
      speed: 0,
      targetSpeed: 0,
      topSpeed: 0,
      streak: 0,
      maxStreak: 0,

      // CPS tracking
      clicks: [],
      peakCPS: 0,

      // Judgments & Stats
      feed: [],
      errors: [],
      stats: {
        'DASH CANCEL': { total: 0, perfect: 0, good: 0, early: 0, late: 0, miss: 0 },
        'WALK CANCEL': { total: 0, perfect: 0, good: 0, early: 0, late: 0, miss: 0 }
      },
      currentLoopIndex: 0
    };

    // ══════════════════════════════════════════════════════════════
    //  AUDIO ENGINE
    // ══════════════════════════════════════════════════════════════
    let audioCtx = null;
    function initAudio() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    function playTone(freq, dur, gainVal, type = 'sine') {
      if (!state.sound) return;
      initAudio();
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const t0 = audioCtx.currentTime;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(gainVal, t0 + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.start(t0);
        osc.stop(t0 + dur + 0.01);
      } catch (e) {}
    }

    function playHit(grade) {
      if (grade === 'perfect') {
        playTone(980, 0.07, 0.2, 'sine');
        setTimeout(() => playTone(1470, 0.08, 0.2, 'sine'), 30);
      } else if (grade === 'good') {
        playTone(740, 0.06, 0.18, 'sine');
      } else if (grade === 'early' || grade === 'late') {
        playTone(420, 0.05, 0.15, 'triangle');
      } else {
        playTone(160, 0.1, 0.2, 'sawtooth');
      }
    }

    function playAttackSwipe() {
      // Crisp sword slash feedback for attack spam
      playTone(520 + Math.random() * 80, 0.03, 0.08, 'triangle');
    }

    // ══════════════════════════════════════════════════════════════
    //  CPS ENGINE
    // ══════════════════════════════════════════════════════════════
    function registerClick() {
      const now = performance.now();
      state.clicks.push(now);
      calcCPS();
    }

    function calcCPS() {
      const now = performance.now();
      state.clicks = state.clicks.filter(t => now - t <= 1000);
      const cps = state.clicks.length;

      if (cps > state.peakCPS) state.peakCPS = cps;

      document.getElementById('cps-num').textContent = cps.toFixed(1);
      document.getElementById('cps-peak').textContent = state.peakCPS.toFixed(1);
      document.getElementById('cps-fill').style.width = Math.min(100, (cps / 12) * 100) + '%';

      const statusEl = document.getElementById('cps-status');
      if (cps >= 8) {
        statusEl.textContent = 'RAPID SPAM';
        statusEl.style.color = 'var(--ocean-blue)';
      } else if (cps >= 4) {
        statusEl.textContent = 'BUFFERING';
        statusEl.style.color = 'var(--color-good)';
      } else if (cps > 0) {
        statusEl.textContent = 'CLICKING';
        statusEl.style.color = 'var(--text-muted)';
      } else {
        statusEl.textContent = 'IDLE';
        statusEl.style.color = 'var(--text-subtle)';
      }
    }

    setInterval(calcCPS, 80);

    // ══════════════════════════════════════════════════════════════
    //  INPUT HANDLING: ATTACK SPAM + CANCEL TIMING
    // ══════════════════════════════════════════════════════════════
    function handleAttackInput() {
      registerClick();
      playAttackSwipe();

      if (!state.running) {
        startTrainer();
        return;
      }

      if (state.awaitingFirst) {
        state.awaitingFirst = false;
        document.getElementById('stage-overlay').style.display = 'none';
        state.startTime = performance.now();
      }

      // Attack spam rewards slight acceleration and boosts speed meter
      state.targetSpeed = Math.min(300, state.targetSpeed + 1.2);
    }

    function handleCancelInput(type = 'dash') {
      registerClick();

      if (!state.running) {
        startTrainer();
        return;
      }

      if (state.awaitingFirst) {
        state.awaitingFirst = false;
        document.getElementById('stage-overlay').style.display = 'none';
        state.startTime = performance.now();
      }

      const combo = COMBOS[state.comboKey];
      const nowMs = (performance.now() - state.startTime) * state.tempo;
      const loopLen = combo.loopLen;
      const curLoop = Math.floor(nowMs / loopLen);

      // Find closest cancel target
      let closestTarget = 0;
      let minDelta = Infinity;

      for (let l = curLoop; l <= curLoop + 1; l++) {
        const targetTime = l * loopLen + combo.cancelTime;
        const delta = nowMs - targetTime;
        if (Math.abs(delta) < Math.abs(minDelta)) {
          minDelta = delta;
          closestTarget = targetTime;
        }
      }

      const tol = TOL_WINDOWS[state.tolerance];
      const absDelta = Math.abs(minDelta);
      let grade = 'miss';

      if (absDelta <= tol.perfect) grade = 'perfect';
      else if (absDelta <= tol.good) grade = 'good';
      else if (absDelta <= tol.earlyLate) grade = minDelta < 0 ? 'early' : 'late';
      else grade = 'miss';

      const actionName = combo.cancelAction === 'walk' ? 'WALK CANCEL' : 'DASH CANCEL';
      recordJudgment(grade, minDelta, actionName);
    }

    function recordJudgment(grade, delta, actionName) {
      playHit(grade);
      flashPlayhead(grade);

      const deltas = { perfect: 12, good: 6, early: -8, late: -10, miss: -20 };
      state.targetSpeed = Math.max(0, Math.min(300, state.targetSpeed + (deltas[grade] || 0)));

      if (grade === 'perfect' || grade === 'good') {
        state.streak++;
        if (state.streak > state.maxStreak) state.maxStreak = state.streak;
      } else {
        state.streak = 0;
      }

      if (state.targetSpeed > state.topSpeed) state.topSpeed = state.targetSpeed;

      // Stats
      if (!state.stats[actionName]) state.stats[actionName] = { total: 0, perfect: 0, good: 0, early: 0, late: 0, miss: 0 };
      const s = state.stats[actionName];
      s.total++;
      s[grade]++;
      if (grade !== 'miss') state.errors.push(Math.abs(delta));

      // Feed
      state.feed.push({ grade, delta, action: actionName, id: Math.random() });
      if (state.feed.length > 4) state.feed.shift();

      updateFeedUI();
      updateGaugeUI();
    }

    function flashPlayhead(grade) {
      const p = document.getElementById('playhead');
      const b = document.getElementById('playhead-badge');
      const colors = {
        perfect: 'var(--color-perf)',
        good: 'var(--color-good)',
        early: 'var(--color-early)',
        late: 'var(--color-late)',
        miss: 'var(--color-miss)'
      };
      p.style.backgroundColor = colors[grade];
      b.style.color = colors[grade];
      setTimeout(() => {
        p.style.backgroundColor = 'var(--ocean-blue)';
        b.style.color = 'var(--ocean-blue)';
      }, 140);
    }

    function updateFeedUI() {
      const feedEl = document.getElementById('recent-feed');
      // Keep title
      feedEl.innerHTML = '<div class="panel-header-title" style="margin-bottom: auto;">Judgment Feed</div>';

      const colors = {
        perfect: 'var(--color-perf)',
        good: 'var(--color-good)',
        early: 'var(--color-early)',
        late: 'var(--color-late)',
        miss: 'var(--color-miss)'
      };

      state.feed.forEach(item => {
        const row = document.createElement('div');
        row.className = 'feed-entry';
        row.style.borderLeftColor = colors[item.grade];
        const ms = item.grade !== 'miss' ? `${item.delta > 0 ? '+' : ''}${Math.round(item.delta)}ms` : 'MISS';
        row.innerHTML = `
          <span>${item.action}</span>
          <span style="color:${colors[item.grade]}">${item.grade.toUpperCase()} (${ms})</span>
        `;
        feedEl.appendChild(row);
      });
    }

    function updateGaugeUI() {
      document.getElementById('streak-num').textContent = `×${state.streak}`;
      document.getElementById('top-speed-num').textContent = Math.round(state.topSpeed);
    }

    // ══════════════════════════════════════════════════════════════
    //  TIMELINE & SPEEDOMETER RAF ANIMATION
    // ══════════════════════════════════════════════════════════════
    const stageBox = document.getElementById('stage-box');
    const elementsContainer = document.getElementById('timeline-elements');
    const playhead = document.getElementById('playhead');
    const playheadBadge = document.getElementById('playhead-badge');
    let activeElements = {};

    function updateTimelineBars(nowMs) {
      const combo = COMBOS[state.comboKey];
      const stageW = stageBox.clientWidth || 800;
      const playheadX = Math.min(180, stageW * 0.22);
      const pxPerMs = 0.42;

      playhead.style.left = playheadX + 'px';
      playheadBadge.style.left = playheadX + 'px';

      const loopLen = combo.loopLen;
      const curLoop = Math.max(0, Math.floor(nowMs / loopLen));

      const visible = [];
      for (let l = curLoop - 1; l <= curLoop + 4; l++) {
        if (l < 0) continue;
        const offset = l * loopLen;
        combo.bars.forEach((b, idx) => {
          const startT = offset + b.start;
          const endT = offset + b.end;
          const startX = playheadX + (startT - nowMs) * pxPerMs;
          const barW = Math.max(16, (endT - startT) * pxPerMs);

          if (startX + barW > -50 && startX < stageW + 50) {
            visible.push({
              id: `${l}-${idx}`,
              x: startX,
              w: barW,
              lane: b.lane,
              label: b.label
            });
          }
        });
      }

      const activeKeys = {};
      visible.forEach(v => {
        activeKeys[v.id] = true;
        let el = activeElements[v.id];
        if (!el) {
          el = document.createElement('div');
          el.className = `timeline-bar ${v.lane === 'atk' ? 'atk-bar' : 'dash-bar'}`;
          el.innerHTML = `<span>${v.label}</span><span>${v.lane === 'atk' ? 'SPAM' : 'CANCEL'}</span>`;
          elementsContainer.appendChild(el);
          activeElements[v.id] = el;
        }
        el.style.transform = `translateX(${v.x}px)`;
        el.style.width = v.w + 'px';
      });

      Object.keys(activeElements).forEach(k => {
        if (!activeKeys[k]) {
          activeElements[k].remove();
          delete activeElements[k];
        }
      });
    }

    function updateSpeedometer() {
      state.speed += (state.targetSpeed - state.speed) * 0.12;
      document.getElementById('gauge-text').textContent = Math.round(state.speed);

      const pct = Math.max(0, Math.min(1, state.speed / 300));
      const angleDeg = 180 - pct * 180;
      const rad = (angleDeg * Math.PI) / 180;

      const cx = 150, cy = 140, r = 100;
      const nx = cx + r * Math.cos(rad);
      const ny = cy - r * Math.sin(rad);

      document.getElementById('gauge-needle').setAttribute('x2', nx);
      document.getElementById('gauge-needle').setAttribute('y2', ny);

      const arcFill = document.getElementById('gauge-fill');
      if (pct > 0.01) {
        const ax = cx + 120 * Math.cos(rad);
        const ay = cy - 120 * Math.sin(rad);
        arcFill.setAttribute('d', `M 30 140 A 120 120 0 ${pct > 0.5 ? 1 : 0} 1 ${ax} ${ay}`);
      } else {
        arcFill.setAttribute('d', 'M 30 140 A 120 120 0 0 1 30 140');
      }

      // Speed decay
      if (state.running && state.targetSpeed > 0) {
        state.targetSpeed = Math.max(0, state.targetSpeed - 0.08);
      }
    }

    function loop() {
      const nowMs = state.running ? (performance.now() - state.startTime) * state.tempo : 0;
      updateTimelineBars(nowMs);
      updateSpeedometer();
      requestAnimationFrame(loop);
    }

    // ══════════════════════════════════════════════════════════════
    //  RUN & COMBO CONTROLS
    // ══════════════════════════════════════════════════════════════
    function startTrainer() {
      initAudio();
      state.running = true;
      state.awaitingFirst = true;
      state.startTime = performance.now();

      const btn = document.getElementById('btn-ride');
      btn.className = 'btn-main-action stop';
      btn.textContent = 'Stop';

      document.getElementById('stage-overlay').style.display = 'flex';
      stageBox.focus();
    }

    function stopTrainer() {
      state.running = false;
      state.awaitingFirst = false;
      document.getElementById('stage-overlay').style.display = 'none';

      const btn = document.getElementById('btn-ride');
      btn.className = 'btn-main-action start';
      btn.textContent = 'Ride';
    }

    function setCombo(comboKey) {
      state.comboKey = comboKey;
      const combo = COMBOS[comboKey];

      document.querySelectorAll('.combo-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.combo === comboKey);
      });

      // Render flow steps
      const flowEl = document.getElementById('combo-flow');
      flowEl.innerHTML = '';
      combo.flow.forEach((f, idx) => {
        const step = document.createElement('div');
        step.className = `flow-step ${f.type === 'spam' ? 'spam-phase' : 'cancel-target'}`;
        step.textContent = f.label;
        flowEl.appendChild(step);

        if (idx < combo.flow.length - 1) {
          const arrow = document.createElement('span');
          arrow.className = 'flow-arrow';
          arrow.textContent = '→';
          flowEl.appendChild(arrow);
        }
      });

      document.getElementById('lower-lane-tag').textContent = combo.cancelAction === 'walk' ? 'WALK CANCEL' : 'DASH CANCEL';
      document.getElementById('dash-chip').textContent = combo.cancelAction === 'walk' ? 'WALK: W / R-Click' : 'DASH: Shift / R-Click';

      elementsContainer.innerHTML = '';
      activeElements = {};
      stopTrainer();
    }

    // ══════════════════════════════════════════════════════════════
    //  EVENT LISTENERS (MOUSE & KEYBOARD)
    // ══════════════════════════════════════════════════════════════
    stageBox.addEventListener('mousedown', e => {
      e.preventDefault();
      if (e.button === 0) handleAttackInput();
      else if (e.button === 2) handleCancelInput(COMBOS[state.comboKey].cancelAction);
    });

    stageBox.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('keydown', e => {
      if (e.repeat) {
        // Fast key repeat acts as continuous spam
        if (e.code === 'Space') handleAttackInput();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleAttackInput();
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || (COMBOS[state.comboKey].cancelAction === 'walk' && e.code === 'KeyW')) {
        e.preventDefault();
        handleCancelInput(COMBOS[state.comboKey].cancelAction);
      } else if (e.code === 'Digit1') setCombo('n2d');
      else if (e.code === 'Digit2') setCombo('n2cd');
      else if (e.code === 'Digit3') setCombo('n5d');
      else if (e.code === 'Digit4') setCombo('n3w');
    });

    document.getElementById('btn-ride').addEventListener('click', () => {
      if (state.running) stopTrainer();
      else startTrainer();
    });

    document.getElementById('combo-tabs').addEventListener('click', e => {
      const btn = e.target.closest('.combo-btn');
      if (btn) setCombo(btn.dataset.combo);
    });

    // Theme Switch
    function setTheme(theme) {
      state.darkTheme = theme === 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      document.querySelectorAll('#theme-modal-opts .modal-opt-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === theme);
      });
    }

    document.getElementById('btn-theme').addEventListener('click', () => {
      setTheme(state.darkTheme ? 'light' : 'dark');
    });

    // Sound
    document.getElementById('btn-audio').addEventListener('click', () => {
      state.sound = !state.sound;
      document.getElementById('btn-audio').textContent = state.sound ? '🔊' : '🔇';
    });

    // Modals
    const modalSettings = document.getElementById('modal-settings');
    const modalStats = document.getElementById('modal-stats');

    document.getElementById('btn-settings').addEventListener('click', () => modalSettings.style.display = 'flex');
    document.getElementById('modal-settings-close').addEventListener('click', () => modalSettings.style.display = 'none');
    document.getElementById('modal-settings-done').addEventListener('click', () => modalSettings.style.display = 'none');

    document.getElementById('tempo-opts').addEventListener('click', e => {
      const b = e.target.closest('.modal-opt-btn');
      if (!b) return;
      state.tempo = parseFloat(b.dataset.val);
      document.querySelectorAll('#tempo-opts .modal-opt-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });

    document.getElementById('tol-opts').addEventListener('click', e => {
      const b = e.target.closest('.modal-opt-btn');
      if (!b) return;
      state.tolerance = b.dataset.val;
      document.querySelectorAll('#tol-opts .modal-opt-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });

    document.getElementById('theme-modal-opts').addEventListener('click', e => {
      const b = e.target.closest('.modal-opt-btn');
      if (!b) return;
      setTheme(b.dataset.theme);
    });

    function showStats() {
      const tbody = document.getElementById('stat-tbody');
      tbody.innerHTML = '';
      let total = 0, perf = 0, good = 0;

      Object.keys(state.stats).forEach(act => {
        const s = state.stats[act];
        if (s.total > 0) {
          total += s.total;
          perf += s.perfect;
          good += s.good;
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="font-weight:700;">${act}</td>
            <td>${s.total}</td>
            <td style="color:var(--color-perf)">${s.perfect}</td>
            <td style="color:var(--color-good)">${s.good}</td>
            <td style="color:var(--color-early)">${s.early}</td>
            <td style="color:var(--color-late)">${s.late}</td>
            <td style="color:var(--color-miss)">${s.miss}</td>
          `;
          tbody.appendChild(tr);
        }
      });

      if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);padding:10px;">No cancel data recorded yet.</td></tr>';
      }

      document.getElementById('stat-acc').textContent = total > 0 ? (((perf + good) / total) * 100).toFixed(1) + '%' : '100%';
      document.getElementById('stat-max-streak').textContent = state.maxStreak;
      document.getElementById('stat-avg-err').textContent = state.errors.length > 0 ? (state.errors.reduce((a,b)=>a+b,0)/state.errors.length).toFixed(1) + 'ms' : '0ms';

      modalStats.style.display = 'flex';
    }

    document.getElementById('btn-stats').addEventListener('click', showStats);
    document.getElementById('btn-stats-top').addEventListener('click', showStats);
    document.getElementById('modal-stats-close').addEventListener('click', () => modalStats.style.display = 'none');
    document.getElementById('modal-stats-done').addEventListener('click', () => modalStats.style.display = 'none');

    // Init
    setCombo('n2d');
    setTheme('dark');
    requestAnimationFrame(loop);