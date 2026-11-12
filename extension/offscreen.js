// مستند خفي مهمته الوحيدة تشغيل أصوات التنبيه
chrome.runtime.onMessage.addListener((m) => {
  if (m && m.target === 'offscreen' && m.t === 'play') NotifSounds.play(m.kind);
});
