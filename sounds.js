/** أصوات التنبيه (مولّدة برمجياً بدون ملفات صوتية) */
(function (root) {
  'use strict';
  if (root.NotifSounds) return;
  let ac = null;

  function ctx() {
    if (!ac) ac = new (root.AudioContext || root.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }

  function tone(freq, start, dur, opts) {
    opts = opts || {};
    const c = ctx();
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to) osc.frequency.linearRampToValueAtTime(opts.to, t0 + dur);
    const vol = opts.vol == null ? 0.25 : opts.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.setValueAtTime(vol, t0 + Math.max(0.02, dur - (opts.release || 0.12)));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  const SOUNDS = {
    soft() {
      tone(880, 0, 0.18, { vol: 0.22 });
      tone(1318.5, 0.15, 0.32, { vol: 0.22, release: 0.25 });
    },
    bell() {
      for (const t of [0, 0.32]) {
        tone(1046.5, t, 0.9, { vol: 0.28, release: 0.8 });
        tone(2093, t, 0.5, { vol: 0.07, release: 0.45 });
        tone(1568, t, 0.7, { vol: 0.06, release: 0.6 });
      }
    },
    alarm() {
      for (let i = 0; i < 5; i++) {
        tone(650, i * 0.5, 0.45, { type: 'square', to: 1300, vol: 0.12, release: 0.05 });
        tone(655, i * 0.5, 0.45, { type: 'sawtooth', to: 1310, vol: 0.06, release: 0.05 });
      }
    },
  };

  root.NotifSounds = {
    /** تهيئة الصوت بعد أول نقرة (سياسة المتصفح تمنع الصوت قبل أي تفاعل) */
    unlock() {
      try {
        ctx();
      } catch {}
    },
    play(kind) {
      try {
        if (SOUNDS[kind]) SOUNDS[kind]();
      } catch (e) {
        console.warn('[sound]', e);
      }
    },
    kinds: Object.keys(SOUNDS),
  };
})(typeof window !== 'undefined' ? window : globalThis);
