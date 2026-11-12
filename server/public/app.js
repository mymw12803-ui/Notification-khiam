'use strict';
/* =====================================================================
   منظومة الإشعارات — لوحة التحكم
   ===================================================================== */

/* ------------------------------ أدوات ------------------------------ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const LOC = 'ar-EG-u-nu-latn';
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : v;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};
function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

const ICONS = {
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  settings: '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checks: '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  meta: '<path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/>',
  youtube: '<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  briefcase: '<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  monitorOff: '<path d="M17 17H4a2 2 0 0 1-2-2V5c0-1.5 1-2 1-2"/><path d="M22 15V5a2 2 0 0 0-2-2H9"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="m2 2 20 20"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  wifiOff: '<path d="M12 20h.01"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/><path d="M5 12.86a10 10 0 0 1 5.17-2.69"/><path d="M19 12.86a10 10 0 0 0-2.01-1.44"/><path d="M2 8.82a15 15 0 0 1 4.18-2.65"/><path d="M22 8.82a15 15 0 0 0-11.29-3.76"/><path d="m2 2 20 20"/>',
  layout: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/>',
  volume: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 18.4a9 9 0 0 0 0-12.7"/>',
  volumeX: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  edit: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  reply: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M13 8H7"/><path d="M17 12H7"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  window: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8h20"/><path d="M6 4v4"/><path d="M10 4v4"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.bell}</svg>`;
function hydrateIcons(root = document) {
  for (const el of $$('[data-i]', root)) {
    el.outerHTML = ic(el.dataset.i);
  }
}

/* ------------------------------ تعريفات ------------------------------ */
const ACT = {
  meta: { label: 'ميتا بيزنس', icon: 'meta' },
  social: { label: 'تواصل اجتماعي', icon: 'chat' },
  work: { label: 'موقع عمل', icon: 'briefcase' },
  outside: { label: 'خارج المتصفح', icon: 'monitorOff' },
  other: { label: 'موقع آخر', icon: 'globe' },
  youtube: { label: 'يوتيوب', icon: 'youtube' },
  idle: { label: 'خامل', icon: 'moon' },
  browser: { label: 'صفحة المتصفح', icon: 'layout' },
  locked: { label: 'الجهاز مقفل', icon: 'lock' },
  offline: { label: 'غير متصل', icon: 'wifiOff' },
};
const ACT_ORDER = Object.keys(ACT);
const OFF_REASON = {
  timeout: 'انقطع فجأة — غالباً الإنترنت أو سكون الجهاز',
  closed: 'أغلق المتصفح أو أطفأ الجهاز',
  unknown: 'لم يتصل منذ تشغيل الخادم',
  net: 'انقطاع إنترنت',
};
const TYPES = {
  toast: { label: 'إشعار جانبي', desc: 'في زاوية الصفحة ويختفي تلقائياً', icon: 'bell' },
  banner: { label: 'شريط علوي', desc: 'شريط بأعلى الصفحة حتى يغلقه', icon: 'megaphone' },
  modal: { label: 'منتصف الصفحة', desc: 'نافذة بالمنتصف تتطلب «تم الاطلاع»', icon: 'mail' },
  alert: { label: 'إنذار', desc: 'شاشة حمراء كاملة + صفارة حتى يُقرّ', icon: 'alert' },
  violation: { label: 'مخالفة', desc: 'إشعار مخالفة رسمي برقم وإجراء', icon: 'shield' },
  reply: { label: 'طلب رد', desc: 'يكتب رده ويصلك هنا فوراً', icon: 'reply' },
  choice: { label: 'سؤال بخيارات', desc: 'يختار من أزرار (نعم / لا ...)', icon: 'help' },
  system: { label: 'خارج المتصفح', desc: 'إشعار ويندوز يظهر فوق أي برنامج', icon: 'monitor' },
  window: { label: 'نافذة مستقلة', desc: 'نافذة منفصلة تُفتح أمامه', icon: 'window' },
};
const ACTION_TYPES = new Set(['modal', 'alert', 'violation', 'reply', 'choice', 'window']);
const STATUS = {
  queued: { l: 'لم يصل بعد', i: 'clock' },
  delivered: { l: 'وصل', i: 'check' },
  displayed: { l: 'ظهر أمامه', i: 'eye' },
  read: { l: 'اطّلع', i: 'checks' },
  replied: { l: 'ردّ', i: 'reply' },
  cancelled: { l: 'أُلغي', i: 'ban' },
};
const RANK = { queued: 0, delivered: 1, displayed: 2, read: 3, replied: 3, cancelled: 3 };
const RULES = [
  { k: 'youtube', label: 'يوتيوب', desc: 'إذا بقي على يوتيوب أكثر من', action: true },
  { k: 'social', label: 'مواقع التواصل', desc: 'إذا بقي على مواقع التواصل أكثر من', action: true },
  { k: 'outside', label: 'خارج المتصفح', desc: 'إذا بقي خارج المتصفح أكثر من', action: true },
  { k: 'idle', label: 'الخمول', desc: 'إذا لم يحرّك الماوس/الكيبورد أكثر من', action: true },
  { k: 'offline', label: 'الانقطاع', desc: 'إذا كان غير متصل أثناء الدوام أكثر من', action: false },
  { k: 'noReply', label: 'عدم الرد', desc: 'إذا لم يرد على رسالة تتطلب رداً خلال', remind: true },
  { k: 'metaUnread', label: 'رسائل العملاء', desc: 'إذا بقيت رسائل عملاء غير مقروءة في ميتا أكثر من', action: true },
];
const RULE_ACTIONS = [
  ['none', 'تنبيهي فقط (بدون إرسال للموظف)'],
  ['toast', 'إشعار جانبي للموظف'],
  ['banner', 'شريط علوي للموظف'],
  ['modal', 'نافذة بالمنتصف للموظف'],
  ['alert', 'إنذار للموظف'],
  ['system', 'إشعار ويندوز للموظف'],
];
const VIEW_TITLES = {
  live: 'المتابعة الحيّة',
  compose: 'إرسال إشعار',
  log: 'الرسائل والردود',
  reports: 'التقارير',
  employees: 'الموظفون',
  settings: 'الإعدادات والقواعد',
};

/* ------------------------------ الحالة ------------------------------ */
const S = {
  token: store.get('token', ''),
  emps: new Map(),
  msgs: [],
  msgMap: new Map(),
  events: [],
  settings: null,
  addresses: [],
  offset: 0,
  view: 'live',
  liveFilter: null,
  ws: null,
  wsOk: false,
  started: false,
  soundOn: store.get('sound', '1') !== '0',
  seenEv: +store.get('seenEv', '0') || 0,
  compose: { to: new Set(), type: 'modal', position: 'tl' },
  logFilter: 'all',
  drawerId: null,
  drawerReport: null,
  report: null,
  pctx: null,
  pn: 0,
  tplEdit: [],
};
const now = () => Date.now() + S.offset;

/* ------------------------------ تنسيق ------------------------------ */
function fmtClock(ts) {
  return ts ? new Date(ts).toLocaleTimeString(LOC, { hour: 'numeric', minute: '2-digit' }) : '—';
}
function fmtDT(ts) {
  return new Date(ts).toLocaleString(LOC, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  if (sec < 60) return sec + 'ث';
  const m = Math.floor(sec / 60);
  if (m < 60) return m + 'د';
  const h = Math.floor(m / 60);
  return h + 'س' + (m % 60 ? ' ' + (m % 60) + 'د' : '');
}
function fmtMs(ms) {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return s + ' ث';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' د' + (s % 60 ? ' ' + (s % 60) + ' ث' : '');
  return fmtDur(s);
}
function fmtElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
function fmtAgo(ts) {
  if (!ts) return '—';
  const s = (now() - ts) / 1000;
  if (s < 45) return 'الآن';
  if (s < 3600) return 'منذ ' + Math.round(s / 60) + ' د';
  if (s < 86400) return 'منذ ' + Math.floor(s / 3600) + ' س';
  return fmtDT(ts);
}
function todayKey() {
  const d = new Date(now());
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function hue(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
const initial = (name) => (String(name || '?').trim()[0] || '?').toUpperCase();
const empName = (id) => (S.emps.get(id) || {}).name || 'موظف محذوف';

/* ------------------------------ API ------------------------------ */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.token },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) {
    logout(true);
    throw new Error('unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'حدث خطأ');
  return data;
}

/* ------------------------------ الدخول ------------------------------ */
function showLogin() {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  setTimeout(() => $('#pw').focus(), 50);
}
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginErr').textContent = '';
  try {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#pw').value }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'خطأ في الدخول');
    S.token = d.token;
    store.set('token', d.token);
    $('#pw').value = '';
    NotifSounds.unlock();
    boot();
  } catch (err) {
    $('#loginErr').textContent = err.message;
  }
});
function logout(silent) {
  if (!silent && S.token) fetch('/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + S.token } }).catch(() => {});
  S.token = '';
  store.del('token');
  if (S.ws) {
    const w = S.ws;
    S.ws = null;
    try {
      w.close();
    } catch {}
  }
  showLogin();
}

async function boot() {
  let d;
  try {
    d = await api('/api/state');
  } catch (e) {
    if (e.message !== 'unauthorized') {
      $('#loginErr').textContent = 'تعذر الاتصال بالخادم';
      showLogin();
    }
    return;
  }
  applyState(d);
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  connectWs();
  renderAll();
  if (!S.started) {
    S.started = true;
    setInterval(tick, 1000);
    setInterval(() => {
      if (S.drawerId) refreshDrawerReport();
    }, 60000);
  }
}

function applyState(d) {
  S.offset = d.serverTime - Date.now();
  S.emps = new Map(d.employees.map((e) => [e.id, e]));
  S.msgs = d.messages || [];
  S.msgMap = new Map(S.msgs.map((m) => [m.id, m]));
  S.events = d.events || [];
  S.settings = d.settings;
  S.addresses = d.addresses || [];
}

/* ------------------------------ الاتصال الحي ------------------------------ */
function connectWs() {
  if (!S.token) return;
  const old = S.ws;
  S.ws = null;
  if (old) {
    try {
      old.close();
    } catch {}
  }
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/admin?token=${encodeURIComponent(S.token)}`);
  S.ws = ws;
  ws.onopen = async () => {
    const wasDown = S.wsWasDown;
    S.wsOk = true;
    S.wsWasDown = false;
    setConn();
    if (wasDown) {
      try {
        applyState(await api('/api/state'));
        renderAll();
      } catch {}
    }
  };
  ws.onmessage = (ev) => {
    let m;
    try {
      m = JSON.parse(ev.data);
    } catch {
      return;
    }
    onWs(m);
  };
  ws.onclose = () => {
    if (S.ws !== ws) return;
    S.wsOk = false;
    S.wsWasDown = true;
    setConn();
    setTimeout(async () => {
      if (S.ws !== ws || !S.token) return;
      try {
        await api('/api/settings');
      } catch (e) {
        if (e.message === 'unauthorized') return;
      }
      if (S.ws === ws) connectWs();
    }, 3000);
  };
}
function setConn() {
  $('#conn').classList.toggle('on', S.wsOk);
  $('#connText').textContent = S.wsOk ? 'متصل بالخادم — تحديث لحظي' : 'انقطع الاتصال بالخادم...';
}

function onWs(m) {
  switch (m.t) {
    case 'emp': {
      const isNew = !S.emps.has(m.emp.id);
      S.emps.set(m.emp.id, m.emp);
      if (isNew) {
        renderLive();
        renderChips();
        renderEmployees();
      } else updateEmp(m.emp);
      break;
    }
    case 'empRemoved':
      S.emps.delete(m.id);
      S.compose.to.delete(m.id);
      renderLive();
      renderChips();
      renderEmployees();
      if (S.drawerId === m.id) closeDrawer();
      break;
    case 'msg':
      upsertMsg(m.msg);
      break;
    case 'event':
      onEvent(m.ev);
      break;
    case 'eventsCleared':
      S.events = [];
      renderEvents();
      break;
    case 'settings':
      S.settings = m.settings;
      renderTemplateSelect();
      break;
  }
}

/* ------------------------------ العرض العام ------------------------------ */
function renderAll() {
  renderLive();
  renderChips();
  renderTypes();
  renderTypeOpts();
  renderTemplateSelect();
  renderLogEmpSelect();
  renderLog();
  renderEmployees();
  renderSettings();
  renderEvents();
  updateNavCounts();
  setConn();
  setSoundBtn();
  setThemeBtn();
}

function setView(v) {
  S.view = v;
  for (const b of $$('.nav')) b.classList.toggle('on', b.dataset.view === v);
  for (const s of $$('.view')) s.classList.toggle('hidden', s.id !== 'view-' + v);
  $('#viewTitle').textContent = VIEW_TITLES[v] || '';
  if (v === 'reports') loadReport();
  if (v === 'log') renderLog();
  if (v === 'compose') ensurePreview();
  if (v === 'employees') renderEmployees();
  window.scrollTo({ top: 0 });
}
for (const b of $$('.nav')) b.addEventListener('click', () => setView(b.dataset.view));
$('#quickSend').addEventListener('click', () => setView('compose'));
$('#logoutBtn').addEventListener('click', () => {
  if (confirm('تسجيل الخروج من لوحة التحكم؟')) logout();
});

/* ------------------------------ المتابعة الحيّة ------------------------------ */
const KPIS = [
  { k: 'online', label: 'متصلون الآن', icon: 'plug', test: (e) => e.online, total: true },
  { k: 'working', label: 'يعملون (ميتا)', icon: 'meta', act: 'meta', test: (e) => e.activity === 'meta' || e.activity === 'work' },
  { k: 'youtube', label: 'على يوتيوب', icon: 'youtube', act: 'youtube', test: (e) => e.activity === 'youtube' },
  { k: 'other', label: 'مواقع أخرى', icon: 'globe', act: 'other', test: (e) => ['social', 'other', 'browser'].includes(e.activity) },
  { k: 'outside', label: 'خارج المتصفح', icon: 'monitorOff', act: 'outside', test: (e) => e.activity === 'outside' },
  { k: 'idle', label: 'خامل / مقفل', icon: 'moon', act: 'idle', test: (e) => e.activity === 'idle' || e.activity === 'locked' },
  { k: 'offline', label: 'غير متصلين', icon: 'wifiOff', act: 'offline', test: (e) => !e.online },
  { k: 'pending', label: 'لم يردّوا بعد', icon: 'reply', test: (e) => e.pending > 0, sum: 'pending' },
];

function renderLive() {
  renderKpis();
  renderLiveLegend();
  renderGrid();
}

const renderKpisSoon = debounce(() => renderKpis(), 150);

function renderKpis() {
  const list = [...S.emps.values()];
  let html = '';
  for (const k of KPIS) {
    const n = list.filter(k.test).length;
    const val = k.sum ? list.reduce((a, e) => a + (e[k.sum] || 0), 0) : n;
    const sw = k.act ? `<span class="swatch${k.act === 'offline' ? ' hatch' : ''}" style="--c:var(--a-${k.act});background:var(--a-${k.act})"></span>` : ic(k.icon);
    html += `<div class="kpi${S.liveFilter === k.k ? ' on' : ''}" data-k="${k.k}" title="اضغط للتصفية">
      <div class="k-top">${sw}${esc(k.label)}</div>
      <div class="k-val num">${val}${k.total ? `<small> / ${list.length}</small>` : ''}</div>
      ${k.sum ? `<div class="k-sub">${n ? `عند ${n} موظف` : 'لا يوجد'}</div>` : ''}
    </div>`;
  }
  // متوسط سرعة الرد اليوم
  let sum = 0;
  let cnt = 0;
  let sends = 0;
  for (const e of list) {
    const r = e.today && e.today.resp;
    if (r && r.avg != null) {
      sum += r.avg * r.count;
      cnt += r.count;
    }
    sends += (e.today && e.today.sends) || 0;
  }
  html += `<div class="kpi" style="cursor:default"><div class="k-top">${ic('clock')}متوسط سرعة الرد اليوم</div><div class="k-val num">${cnt ? esc(fmtMs(sum / cnt)) : '—'}</div><div class="k-sub">على ${cnt} رسالة</div></div>`;
  html += `<div class="kpi" style="cursor:default"><div class="k-top">${ic('send')}ردود مرسلة في ميتا</div><div class="k-val num">${sends}</div><div class="k-sub">اليوم (تقديري)</div></div>`;
  $('#kpis').innerHTML = html;
  for (const el of $$('.kpi[data-k]')) {
    el.addEventListener('click', () => {
      S.liveFilter = S.liveFilter === el.dataset.k ? null : el.dataset.k;
      renderKpis();
      renderGrid();
    });
  }
}

function legendHTML(acts) {
  return acts
    .map((a) => `<span><i class="swatch${a === 'offline' ? ' hatch' : ''}" style="--c:var(--a-${a});background:var(--a-${a})"></i>${esc(ACT[a].label)}</span>`)
    .join('');
}
function renderLiveLegend() {
  $('#liveLegend').innerHTML = '<span style="font-weight:600">توزيع وقت اليوم:</span>' + legendHTML(ACT_ORDER);
}

function filteredEmps() {
  let list = [...S.emps.values()];
  const q = $('#empSearch').value.trim();
  if (q) list = list.filter((e) => e.name.includes(q));
  if (S.liveFilter) {
    const k = KPIS.find((x) => x.k === S.liveFilter);
    if (k) list = list.filter(k.test);
  }
  return list;
}

function renderGrid() {
  const grid = $('#empGrid');
  if (!S.emps.size) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>لا يوجد موظفون بعد</b>أضف موظفيك من صفحة «الموظفون» ثم ثبّت الإضافة على أجهزتهم.<br><br><button class="btn primary" id="goEmp">${ic('plus')}إضافة موظف</button></div>`;
    $('#goEmp').addEventListener('click', () => setView('employees'));
    return;
  }
  const list = filteredEmps();
  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>لا يوجد موظفون في هذه الحالة</b></div>`;
    return;
  }
  grid.innerHTML = list.map(cardHTML).join('');
  updateTickers();
}

function todayBar(t) {
  if (!t) return '<div class="bar"></div>';
  const total = ACT_ORDER.reduce((a, k) => a + (t[k] || 0), 0);
  if (!total) return '<div class="bar"></div>';
  return (
    '<div class="bar">' +
    ACT_ORDER.filter((k) => t[k] > 0)
      .map((k) => {
        const p = (t[k] / total) * 100;
        return `<i class="${k === 'offline' ? 'hatch' : ''}" style="width:${p.toFixed(2)}%;--c:var(--a-${k})" data-tip="${esc(ACT[k].label)}: ${esc(fmtDur(t[k]))} (${Math.round(p)}%)"></i>`;
      })
      .join('') +
    '</div>'
  );
}

function cardHTML(e) {
  const a = e.activity || 'offline';
  const A = ACT[a] || ACT.offline;
  const t = (e.today && e.today.totals) || {};
  const resp = (e.today && e.today.resp) || {};
  let where;
  if (!e.online) {
    where = `${ic('wifiOff')} ${esc(OFF_REASON[e.offlineReason] || 'غير متصل')}${e.lastSeen ? ` · آخر ظهور ${esc(fmtClock(e.lastSeen))}` : ''}`;
  } else if (a === 'outside') {
    where = `يستخدم برنامجاً آخر خارج كروم${e.host ? ` · آخر تبويب: <span class="host ltr">${esc(e.host)}</span>` : ''}`;
  } else if (a === 'locked') {
    where = 'شاشة الجهاز مقفلة';
  } else if (e.host) {
    where = `<span class="host ltr">${esc(e.host)}</span>${e.title ? ' — ' + esc(e.title) : ''}`;
  } else {
    where = esc(e.title || 'صفحة داخلية في المتصفح');
  }
  if (a === 'idle') where = `لا حركة للماوس/الكيبورد · ${where}`;
  const flags = [];
  if (e.ytAudible && a !== 'youtube') flags.push(`<span class="flag crit">${ic('headphones')}يوتيوب يعمل في الخلفية</span>`);
  if (e.metaUnread > 0) {
    const late = e.metaUnreadSince && now() - e.metaUnreadSince > 5 * 60000;
    flags.push(`<span class="flag ${late ? 'crit' : 'warn'}">${ic('inbox')}${e.metaUnread} رسالة عميل غير مقروءة${e.metaUnreadSince ? ` · <span data-ago="${e.metaUnreadSince}"></span>` : ''}</span>`);
  }
  if (e.pending > 0) flags.push(`<span class="flag crit">${ic('reply')}لم يرد على ${e.pending}</span>`);
  if (e.lastMetaSend && now() - e.lastMetaSend < 12 * 3600000) flags.push(`<span class="flag good">${ic('send')}آخر رد لعميل <span data-ago="${e.lastMetaSend}"></span></span>`);
  const workSec = (t.meta || 0) + (t.work || 0);
  const sub = e.online ? (e.today && e.today.first ? `حضر ${fmtClock(e.today.first)}` : 'متصل') : e.lastSeen ? `آخر ظهور ${fmtAgo(e.lastSeen)}` : 'لم يتصل بعد';
  return `<article class="emp" data-id="${esc(e.id)}" style="--ac:var(--a-${a})">
    <div class="emp-h">
      <div class="avatar" style="--h:${hue(e.name)}">${esc(initial(e.name))}<span class="st${e.online ? ' on' : ''}"></span></div>
      <div class="who"><b>${esc(e.name)}</b><small>${esc(sub)}</small></div>
    </div>
    <div class="now">
      <span class="act-pill" style="--ac:var(--a-${a})">${ic(A.icon)}${esc(A.label)}</span>
      <span class="since num" title="منذ">منذ <span data-since="${e.activitySince || 0}"></span></span>
    </div>
    <div class="where" title="${esc(e.title || '')}">${where}</div>
    ${flags.length ? `<div class="flags">${flags.join('')}</div>` : ''}
    ${todayBar(t)}
    <dl class="stats">
      <div><dt>وقت العمل اليوم</dt><dd class="num">${esc(fmtDur(workSec))}</dd></div>
      <div><dt>ردود مرسلة</dt><dd class="num">${(e.today && e.today.sends) || 0}</dd></div>
      <div><dt>سرعة الرد</dt><dd class="num">${resp.avg != null ? esc(fmtMs(resp.avg)) : '—'}</dd></div>
    </dl>
    <div class="emp-f">
      <button class="btn sm" data-act="modal">${ic('mail')}رسالة</button>
      <button class="btn sm" data-act="reply">${ic('reply')}طلب رد</button>
      <button class="btn sm danger" data-act="alert">${ic('alert')}إنذار</button>
      <button class="btn sm" data-act="detail">${ic('eye')}تفاصيل</button>
    </div>
  </article>`;
}

function updateEmp(e) {
  const card = $(`#empGrid .emp[data-id="${CSS.escape(e.id)}"]`);
  const visible = filteredEmps().some((x) => x.id === e.id);
  if (card && visible) {
    const tmp = document.createElement('div');
    tmp.innerHTML = cardHTML(e);
    const nc = tmp.firstElementChild;
    if (card.classList.contains('flash')) nc.classList.add('flash');
    card.replaceWith(nc);
  } else if (!!card !== visible) renderGrid();
  renderKpisSoon();
  updateChipDot(e);
  if (S.drawerId === e.id) renderDrawerTop();
  if (S.view === 'employees') renderEmployeesSoon();
  updateTickers();
}

$('#empSearch').addEventListener('input', debounce(renderGrid, 150));
$('#empGrid').addEventListener('click', (ev) => {
  const card = ev.target.closest('.emp');
  if (!card) return;
  const id = card.dataset.id;
  const b = ev.target.closest('[data-act]');
  if (!b) return openDrawer(id);
  const act = b.dataset.act;
  if (act === 'detail') openDrawer(id);
  else openCompose([id], act);
});

function updateTickers() {
  const t = now();
  for (const el of $$('[data-since]')) el.textContent = fmtElapsed(t - +el.dataset.since);
  for (const el of $$('[data-ago]')) el.textContent = fmtAgo(+el.dataset.ago);
}
function tick() {
  $('#clock').textContent = new Date(now()).toLocaleTimeString(LOC, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  updateTickers();
}

/* ------------------------------ الإرسال ------------------------------ */
function openCompose(ids, type) {
  S.compose.to = new Set(ids);
  if (type && TYPES[type]) S.compose.type = type;
  renderChips();
  renderTypes();
  renderTypeOpts();
  setView('compose');
  setTimeout(() => $('#cTitle').focus(), 80);
}

function renderChips() {
  const box = $('#toChips');
  const emps = [...S.emps.values()];
  let html = emps
    .map((e) => `<button type="button" class="chip${S.compose.to.has(e.id) ? ' on' : ''}" data-id="${esc(e.id)}"><span class="dot${e.online ? ' on' : ''}"></span>${esc(e.name)}</button>`)
    .join('');
  html += `<button type="button" class="chip ctl" data-ctl="all">الكل</button><button type="button" class="chip ctl" data-ctl="online">المتصلون فقط</button><button type="button" class="chip ctl" data-ctl="none">مسح</button>`;
  box.innerHTML = emps.length ? html : '<span class="hint">لا يوجد موظفون — أضفهم من صفحة الموظفين.</span>';
  updateSendHint();
}
function updateChipDot(e) {
  const d = $(`#toChips .chip[data-id="${CSS.escape(e.id)}"] .dot`);
  if (d) d.classList.toggle('on', !!e.online);
}
$('#toChips').addEventListener('click', (ev) => {
  const c = ev.target.closest('.chip');
  if (!c) return;
  if (c.dataset.id) {
    const id = c.dataset.id;
    if (S.compose.to.has(id)) S.compose.to.delete(id);
    else S.compose.to.add(id);
  } else if (c.dataset.ctl === 'all') S.compose.to = new Set(S.emps.keys());
  else if (c.dataset.ctl === 'online') S.compose.to = new Set([...S.emps.values()].filter((e) => e.online).map((e) => e.id));
  else S.compose.to = new Set();
  renderChips();
});
function updateSendHint() {
  const n = S.compose.to.size;
  const off = [...S.compose.to].filter((id) => !(S.emps.get(id) || {}).online).length;
  $('#sendHint').textContent = n ? `سيُرسل إلى ${n} موظف` + (off ? ` (${off} غير متصل — ستصله عند اتصاله)` : '') : 'اختر المستلمين';
}

function renderTypes() {
  $('#typeGrid').innerHTML = Object.entries(TYPES)
    .map(([k, t]) => `<button type="button" class="type t-${k}${S.compose.type === k ? ' on' : ''}" data-type="${k}"><b>${ic(t.icon)}${esc(t.label)}</b><small>${esc(t.desc)}</small></button>`)
    .join('');
}
$('#typeGrid').addEventListener('click', (ev) => {
  const b = ev.target.closest('.type');
  if (!b) return;
  S.compose.type = b.dataset.type;
  renderTypes();
  renderTypeOpts();
  previewSoon();
});

function renderTypeOpts() {
  const t = S.compose.type;
  const box = $('#typeOpts');
  let html = '';
  if (t === 'toast') {
    html = `<div class="row2">
      <div class="field"><span class="lbl">مكان الظهور</span><div class="seg" id="posSeg">
        ${[['tr', 'أعلى يمين'], ['tl', 'أعلى يسار'], ['br', 'أسفل يمين'], ['bl', 'أسفل يسار']].map(([k, l]) => `<button type="button" data-pos="${k}" class="${S.compose.position === k ? 'on' : ''}">${l}</button>`).join('')}
      </div></div>
      <div class="field"><label for="oDuration">مدة الظهور (ثانية)</label><input class="input" type="number" id="oDuration" min="3" max="300" value="12"></div>
    </div>`;
  } else if (t === 'choice') {
    html = `<div class="field"><label for="oChoices">الخيارات (افصل بفاصلة)</label><input class="input" id="oChoices" value="نعم، لا"></div>`;
  } else if (t === 'violation') {
    html = `<div class="row2">
      <div class="field"><label for="oRef">رقم المخالفة</label><input class="input" id="oRef" placeholder="يُولَّد تلقائياً"></div>
      <div class="field"><label for="oPenalty">الإجراء / الجزاء</label><input class="input" id="oPenalty" placeholder="مثال: خصم يوم، لفت نظر"></div>
    </div>`;
  } else if (t === 'reply') {
    html = `<div class="field"><label for="oPlaceholder">نص توضيحي داخل خانة الرد (اختياري)</label><input class="input" id="oPlaceholder" placeholder="اكتب ردك هنا..."></div>`;
  } else if (t === 'alert') {
    html = `<label class="check"><input type="checkbox" id="oRepeat" checked> تكرار صفارة الإنذار كل 9 ثوانٍ حتى يُقرّ (لمدة دقيقتين)</label>`;
  } else if (t === 'system') {
    html = `<p class="hint" style="margin:0">يظهر كإشعار ويندوز في زاوية الشاشة حتى لو كان المتصفح مصغّراً أو يعمل على برنامج آخر، ويبقى حتى يضغط عليه.</p>`;
  } else if (t === 'window') {
    html = `<p class="hint" style="margin:0">تُفتح نافذة مستقلة صغيرة أمام الموظف تحتوي الرسالة وزر «تم الاطلاع».</p>`;
  }
  box.innerHTML = html;
  box.style.display = html ? '' : 'none';
  $('#colorField').style.visibility = ['alert', 'violation', 'system'].includes(t) ? 'hidden' : '';
  $('#osOpt').style.display = ['system', 'window'].includes(t) ? 'none' : '';
  const ps = $('#posSeg');
  if (ps)
    ps.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-pos]');
      if (!b) return;
      S.compose.position = b.dataset.pos;
      for (const x of $$('button', ps)) x.classList.toggle('on', x === b);
      previewSoon();
    });
}

function buildMsg() {
  const type = S.compose.type;
  const o = {};
  const snd = $('#cSound').value;
  if (snd) o.sound = snd;
  const col = $('#cColor').value;
  if (col) o.color = col;
  o.os = $('#cOs').checked;
  o.speak = $('#cSpeak').checked;
  if (type === 'toast') {
    o.position = S.compose.position;
    o.duration = +($('#oDuration') || {}).value || 12;
  }
  if (type === 'choice') o.choices = String(($('#oChoices') || {}).value || '').split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
  if (type === 'violation') {
    o.ref = ($('#oRef') || {}).value || '';
    o.penalty = ($('#oPenalty') || {}).value || '';
  }
  if (type === 'reply') o.placeholder = ($('#oPlaceholder') || {}).value || '';
  if (type === 'alert') o.repeat = !!($('#oRepeat') || {}).checked;
  return { type, title: $('#cTitle').value.trim(), body: $('#cBody').value.trim(), options: o };
}

function renderTemplateSelect() {
  const tpls = (S.settings && S.settings.templates) || [];
  $('#tplSel').innerHTML = '<option value="">— بدون قالب —</option>' + tpls.map((t, i) => `<option value="${i}">${esc((TYPES[t.type] || {}).label || '')}: ${esc(t.title || t.body.slice(0, 40))}</option>`).join('');
}
$('#tplSel').addEventListener('change', () => {
  const t = ((S.settings && S.settings.templates) || [])[+$('#tplSel').value];
  if (!t) return;
  S.compose.type = t.type;
  renderTypes();
  renderTypeOpts();
  $('#cTitle').value = t.title || '';
  $('#cBody').value = t.body || '';
  const o = t.options || {};
  if (o.choices && $('#oChoices')) $('#oChoices').value = o.choices.join('، ');
  if (o.penalty && $('#oPenalty')) $('#oPenalty').value = o.penalty;
  previewSoon();
});

$('#sendBtn').addEventListener('click', async () => {
  const m = buildMsg();
  if (!S.compose.to.size) return ntoast({ title: 'اختر المستلمين أولاً', level: 'crit' });
  if (!m.title && !m.body) return ntoast({ title: 'اكتب عنواناً أو نص الرسالة', level: 'crit' });
  const btn = $('#sendBtn');
  btn.disabled = true;
  try {
    await api('/api/messages', { method: 'POST', body: { to: [...S.compose.to], ...m } });
    ntoast({ title: 'تم الإرسال ✓', text: `«${m.title || m.body.slice(0, 40)}» إلى ${S.compose.to.size} موظف`, level: 'good', onClick: () => setView('log') });
    $('#cTitle').value = '';
    $('#cBody').value = '';
    $('#tplSel').value = '';
    previewSoon();
  } catch (e) {
    ntoast({ title: 'تعذر الإرسال', text: e.message, level: 'crit' });
  } finally {
    btn.disabled = false;
  }
});

/* ---------- المعاينة ---------- */
const PREVIEW_DOC = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
body{margin:0;font-family:"Segoe UI",Tahoma,sans-serif;background:#f0f2f5;height:100vh;overflow:hidden}
.top{height:50px;background:#fff;border-bottom:1px solid #dde1e6;display:flex;align-items:center;padding:0 16px;gap:10px}
.lg{width:28px;height:28px;border-radius:8px;background:#94a3b8}.sr{flex:0 0 220px;height:30px;border-radius:15px;background:#eef0f3}
.side{position:absolute;top:51px;bottom:0;right:0;width:170px;background:#fff;border-left:1px solid #dde1e6;padding:14px}
.ln{height:10px;border-radius:5px;background:#e4e6eb;margin:14px 0}.ln.s{width:60%}
.main{position:absolute;top:51px;bottom:0;right:171px;left:0;padding:14px;display:flex;gap:12px}
.list{width:200px;background:#fff;border-radius:10px;padding:12px}
.it{display:flex;gap:8px;align-items:center;margin-bottom:14px}.av{width:32px;height:32px;border-radius:50%;background:#d8dde4;flex:none}.it .ln{flex:1;margin:0}
.chat{flex:1;background:#fff;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:12px}
.b{width:55%;height:32px;border-radius:16px;background:#e4e6eb}.b.me{align-self:flex-end;background:#d6e4fb;width:45%}
.in{margin-top:auto;height:38px;border-radius:19px;background:#f0f2f5}
</style></head><body><div class="top"><div class="lg"></div><div class="sr"></div></div>
<div class="side"><div class="ln"></div><div class="ln s"></div><div class="ln"></div><div class="ln s"></div><div class="ln"></div></div>
<div class="main"><div class="list">${'<div class="it"><div class="av"></div><div class="ln"></div></div>'.repeat(6)}</div>
<div class="chat"><div class="b"></div><div class="b me"></div><div class="b"></div><div class="b me"></div><div class="in"></div></div></div>
<script src="/ext/ui.js"><\/script></body></html>`;

function ensurePreview() {
  const f = $('#previewFrame');
  if (f.dataset.ready) {
    previewSoon();
    return;
  }
  f.dataset.ready = '1';
  f.addEventListener('load', () => {
    S.pctx = null;
    renderPreview();
  });
  f.srcdoc = PREVIEW_DOC;
}
function renderPreview() {
  const w = $('#previewFrame').contentWindow;
  if (!w || !w.NotifUI) return;
  if (!S.pctx || !S.pctx.host.isConnected) {
    S.pctx = w.NotifUI.mount(w.document, {
      handlers: {
        onRespond: (id, st, data) => {
          const txt = data.choice ? `اختار «${data.choice}»` : data.reply ? `كتب: «${data.reply}»` : 'ضغط «تم الاطلاع»';
          $('#previewNote').innerHTML = `${ic('check')} هكذا سيصلك رده في السجل: <b>${esc(txt)}</b>`;
        },
      },
    });
  }
  w.NotifUI.clear(S.pctx);
  const m = buildMsg();
  const msg = {
    id: 'p' + ++S.pn,
    type: m.type,
    title: m.title || (m.body ? '' : 'عنوان الرسالة'),
    body: m.body || 'نص الرسالة يظهر هنا للموظف أينما كان يعمل...',
    options: { ...m.options, duration: Math.max(20, m.options.duration || 0) },
    createdAt: Date.now(),
    from: (S.settings && S.settings.senderName) || 'الإدارة',
  };
  if (msg.type === 'violation' && !msg.options.ref) msg.options.ref = 'V-0001';
  if (msg.type === 'choice' && !(msg.options.choices || []).length) msg.options.choices = ['نعم', 'لا'];
  w.NotifUI.show(S.pctx, msg);
}
const previewSoon = debounce(() => S.view === 'compose' && renderPreview(), 450);
for (const id of ['#cTitle', '#cBody', '#cColor', '#typeOpts']) $(id).addEventListener('input', previewSoon);
$('#cColor').addEventListener('change', previewSoon);
$('#previewBtn').addEventListener('click', () => {
  $('#previewNote').textContent = 'جرّب الأزرار داخل المعاينة لترى كيف سيصلك رد الموظف.';
  renderPreview();
  const t = S.compose.type;
  const snd = $('#cSound').value || { alert: 'alarm', violation: 'alarm', reply: 'bell', choice: 'bell', modal: 'bell', window: 'bell' }[t] || 'soft';
  NotifSounds.play(snd);
});

/* ------------------------------ السجل ------------------------------ */
function upsertMsg(m) {
  if (S.msgMap.has(m.id)) {
    const i = S.msgs.findIndex((x) => x.id === m.id);
    if (i >= 0) S.msgs[i] = m;
  } else {
    S.msgs.push(m);
    if (S.msgs.length > 1000) S.msgs.splice(0, S.msgs.length - 1000);
  }
  S.msgMap.set(m.id, m);
  if (S.view === 'log') renderLogSoon();
  updateNavCounts();
  if (S.drawerId && m.recipients[S.drawerId]) renderConvo();
}
function isPending(m) {
  return ACTION_TYPES.has(m.type) && Object.values(m.recipients).some((r) => RANK[r.status] < 3);
}
function updateNavCounts() {
  let n = 0;
  for (const m of S.msgs) if (ACTION_TYPES.has(m.type)) for (const r of Object.values(m.recipients)) if (RANK[r.status] < 3) n++;
  const el = $('#navPending');
  el.textContent = n;
  el.classList.toggle('hidden', !n);
}

function renderLogEmpSelect() {
  const cur = $('#logEmp').value;
  $('#logEmp').innerHTML = '<option value="">كل الموظفين</option>' + [...S.emps.values()].map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
  $('#logEmp').value = cur;
}

const renderLogSoon = debounce(() => renderLog(), 200);
function renderLog() {
  const f = S.logFilter;
  const emp = $('#logEmp').value;
  const q = $('#logSearch').value.trim();
  let list = S.msgs.slice().reverse();
  if (f === 'pending') list = list.filter(isPending);
  if (f === 'replies') list = list.filter((m) => Object.values(m.recipients).some((r) => r.status === 'replied'));
  if (f === 'warn') list = list.filter((m) => m.type === 'alert' || m.type === 'violation');
  if (f === 'auto') list = list.filter((m) => m.source === 'rule');
  if (emp) list = list.filter((m) => m.recipients[emp]);
  if (q) list = list.filter((m) => (m.title + ' ' + m.body + ' ' + Object.values(m.recipients).map((r) => r.reply || '').join(' ')).includes(q));
  const box = $('#msgList');
  if (!list.length) {
    box.innerHTML = `<div class="empty"><b>لا توجد رسائل</b>${f === 'all' ? 'أرسل أول إشعار من صفحة «إرسال إشعار».' : ''}</div>`;
    return;
  }
  box.innerHTML = list.slice(0, 150).map(msgHTML).join('');
}
function rcptHTML(m, empId, r) {
  const st = STATUS[r.status] || STATUS.queued;
  let info = '';
  if (RANK[r.status] === 3 && r.status !== 'cancelled' && r.respMs != null) info = `ردّ بعد <b>${esc(fmtMs(r.respMs))}</b> · ${esc(fmtClock(r.respondedAt))}`;
  else if (r.status === 'displayed' && r.displayedAt) info = `ظهر ${fmtClock(r.displayedAt)} · بانتظار رده <span data-ago="${r.displayedAt}"></span>`;
  else if (r.status === 'delivered') info = `وصل ${fmtClock(r.deliveredAt)}`;
  else if (r.status === 'queued') info = 'سيصله عند اتصاله';
  if (r.reminders) info += ` · ${r.reminders} تذكير`;
  let reply = '';
  if (r.choice) reply = `<div class="reply">اختار: <b>${esc(r.choice)}</b>${r.reply ? '<br>' + esc(r.reply) : ''}</div>`;
  else if (r.reply) reply = `<div class="reply">${esc(r.reply)}</div>`;
  return `<li class="rcpt"><span class="nm">${esc(empName(empId))}</span><span class="st st-${r.status}">${ic(st.i)}${esc(st.l)}</span><span class="rt">${info}</span>${reply}</li>`;
}
function msgHTML(m) {
  const T = TYPES[m.type] || TYPES.toast;
  const pending = Object.values(m.recipients).some((r) => RANK[r.status] < 3);
  return `<article class="msg" data-id="${esc(m.id)}">
    <div class="msg-h">
      <span class="tbadge t-${m.type}">${ic(T.icon)}${esc(T.label)}</span>
      ${m.source === 'rule' ? '<span class="srcbadge">تلقائي</span>' : ''}
      <b>${esc(m.title || '')}</b>
      <time>${esc(fmtDT(m.createdAt))}</time>
      <span class="grow"></span>
      ${pending ? `<button class="btn sm" data-mact="remind">${ic('bell')}تذكير الآن</button><button class="btn sm danger" data-mact="cancel">${ic('x')}إلغاء</button>` : ''}
    </div>
    ${m.body ? `<div class="msg-body">${esc(m.body)}</div>` : ''}
    ${m.type === 'violation' ? `<div class="hint">رقم المخالفة: <b class="ltr">${esc(m.options.ref || '')}</b>${m.options.penalty ? ` · الإجراء: <b>${esc(m.options.penalty)}</b>` : ''}</div>` : ''}
    <ul class="rcpts">${Object.entries(m.recipients).map(([id, r]) => rcptHTML(m, id, r)).join('')}</ul>
  </article>`;
}
$('#logTabs').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  S.logFilter = b.dataset.f;
  for (const x of $$('#logTabs button')) x.classList.toggle('on', x === b);
  renderLog();
});
$('#logEmp').addEventListener('change', renderLog);
$('#logSearch').addEventListener('input', debounce(renderLog, 200));
$('#msgList').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-mact]');
  if (!b) return;
  const id = b.closest('.msg').dataset.id;
  try {
    if (b.dataset.mact === 'cancel') {
      if (!confirm('إلغاء هذه الرسالة وإخفاؤها من عند الموظفين الذين لم يردوا؟')) return;
      await api(`/api/messages/${id}/cancel`, { method: 'POST' });
    } else {
      const r = await api(`/api/messages/${id}/remind`, { method: 'POST' });
      ntoast({ title: 'تم إرسال التذكير', text: r.reminded ? `إلى ${r.reminded} موظف` : 'لا يوجد متصلون حالياً', level: 'good' });
    }
  } catch (e) {
    ntoast({ title: 'خطأ', text: e.message, level: 'crit' });
  }
});

/* ------------------------------ التقارير ------------------------------ */
async function loadReport() {
  if (!$('#repDate').value) $('#repDate').value = todayKey();
  try {
    S.report = await api('/api/report?date=' + $('#repDate').value);
    renderReport();
  } catch (e) {
    ntoast({ title: 'تعذر تحميل التقرير', text: e.message, level: 'crit' });
  }
}
$('#repDate').addEventListener('change', loadReport);
$('#repRefresh').addEventListener('click', loadReport);

const REP_COLS = [
  ['meta', 'ميتا'],
  ['work', 'عمل آخر'],
  ['youtube', 'يوتيوب'],
  ['social', 'تواصل'],
  ['other', 'مواقع أخرى'],
  ['outside', 'خارج المتصفح'],
  ['idleLocked', 'خامل/مقفل'],
  ['offline', 'غير متصل'],
];
function repVal(e, k) {
  const t = e.totals;
  if (k === 'idleLocked') return (t.idle || 0) + (t.locked || 0);
  if (k === 'other') return (t.other || 0) + (t.browser || 0);
  return t[k] || 0;
}
function renderReport() {
  const R = S.report;
  if (!R) return;
  const head = `<tr><th>الموظف</th><th>أول اتصال</th><th>آخر نشاط</th>${REP_COLS.map(([, l]) => `<th>${l}</th>`).join('')}<th>ردود مرسلة</th><th>رسائل الإدارة</th><th>سرعة الرد</th><th>لم يرد</th><th>إنذارات</th><th>مخالفات</th></tr>`;
  const rows = R.employees
    .map((e) => {
      const cells = REP_COLS.map(([k]) => {
        const v = repVal(e, k);
        return `<td class="${v ? '' : 'zero'}">${v ? esc(fmtDur(v)) : '—'}</td>`;
      }).join('');
      return `<tr><td class="name">${esc(e.name)}</td><td>${esc(fmtClock(e.first))}</td><td>${esc(fmtClock(e.last))}</td>${cells}<td>${e.sends || 0}</td><td>${e.resp.sent}</td><td>${e.resp.avg != null ? esc(fmtMs(e.resp.avg)) : '—'}</td><td class="${e.resp.pending ? '' : 'zero'}">${e.resp.pending}</td><td class="${e.resp.alerts ? '' : 'zero'}">${e.resp.alerts}</td><td class="${e.resp.violations ? '' : 'zero'}">${e.resp.violations}</td></tr>`;
    })
    .join('');
  $('#repTable').innerHTML = `<thead>${head}</thead><tbody>${rows || '<tr><td colspan="20" class="zero">لا يوجد موظفون</td></tr>'}</tbody>`;
  $('#repLegend').innerHTML = legendHTML(ACT_ORDER);
  $('#repTimeline').innerHTML = timelineHTML(R, R.employees);
}

function timelineRange(R, emps) {
  const dayStart = new Date(R.date + 'T00:00:00').getTime();
  let s = R.windows && R.windows.length ? R.windows[0][0] : dayStart;
  let e = R.windows && R.windows.length ? R.windows[R.windows.length - 1][1] : dayStart + 86400000;
  for (const emp of emps) {
    for (const seg of emp.segs) {
      if (seg[0] === 'offline') continue;
      s = Math.min(s, seg[1]);
      e = Math.max(e, seg[2]);
    }
  }
  s = Math.max(dayStart, Math.floor(s / 3600000) * 3600000);
  e = Math.min(dayStart + 86400000, Math.ceil(e / 3600000) * 3600000);
  if (e <= s) e = s + 3600000;
  return [s, e];
}
function timelineHTML(R, emps, compact) {
  if (!emps.length) return '<div class="hint">لا توجد بيانات</div>';
  const [s, e] = timelineRange(R, emps);
  const span = e - s;
  const hours = Math.round(span / 3600000);
  const step = hours > 16 ? 3 : hours > 8 ? 2 : 1;
  let ticks = '';
  for (let t = s; t <= e; t += step * 3600000) {
    const p = ((t - s) / span) * 100;
    ticks += `<span style="left:${p}%">${new Date(t).getHours()}:00</span>`;
  }
  const rows = emps
    .map((emp) => {
      const bars = emp.segs
        .map((seg) => {
          const [a, ss, ee, host, reason] = seg;
          const x1 = Math.max(s, ss);
          const x2 = Math.min(e, ee);
          if (x2 <= x1) return '';
          const l = ((x1 - s) / span) * 100;
          const w = ((x2 - x1) / span) * 100;
          const A = ACT[a] || ACT.other;
          const tip = `${A.label}${host ? ' — ' + host : ''}${a === 'offline' && reason ? '\n' + (OFF_REASON[reason] || '') : ''}\n${fmtClock(ss)} ← ${fmtClock(ee)} (${fmtDur((ee - ss) / 1000)})`;
          return `<i class="${a === 'offline' ? 'hatch' : ''}" style="left:${l.toFixed(3)}%;width:${Math.max(0.15, w).toFixed(3)}%;--c:var(--a-${a})" data-tip="${esc(tip)}"></i>`;
        })
        .join('');
      return `<div class="tl-row${compact ? ' c' : ''}">${compact ? '' : `<span class="nm">${esc(emp.name)}</span>`}<div class="tl">${bars}</div></div>`;
    })
    .join('');
  return `${rows}<div class="tl-axis${compact ? ' c' : ''}">${compact ? '' : '<span></span>'}<div class="ticks num">${ticks}</div></div>`;
}

$('#repCsv').addEventListener('click', () => {
  const R = S.report;
  if (!R) return;
  const head = ['الموظف', 'أول اتصال', 'آخر نشاط', ...REP_COLS.map(([, l]) => l + ' (دقيقة)'), 'ردود مرسلة', 'رسائل الإدارة', 'متوسط سرعة الرد (ثانية)', 'لم يرد', 'إنذارات', 'مخالفات'];
  const lines = [head];
  for (const e of R.employees) {
    lines.push([
      e.name,
      fmtClock(e.first),
      fmtClock(e.last),
      ...REP_COLS.map(([k]) => Math.round(repVal(e, k) / 60)),
      e.sends || 0,
      e.resp.sent,
      e.resp.avg != null ? Math.round(e.resp.avg / 1000) : '',
      e.resp.pending,
      e.resp.alerts,
      e.resp.violations,
    ]);
  }
  const csv = '﻿' + lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `تقرير-${R.date}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

/* ------------------------------ الموظفون ------------------------------ */
const renderEmployeesSoon = debounce(() => renderEmployees(), 400);
function renderEmployees() {
  const emps = [...S.emps.values()];
  $('#empTable').innerHTML = emps.length
    ? `<thead><tr><th>الاسم</th><th>كود الربط</th><th>الحالة</th><th>آخر ظهور</th><th>إصدار الإضافة</th><th></th></tr></thead><tbody>${emps
        .map(
          (e) => `<tr data-id="${esc(e.id)}">
        <td class="name">${esc(e.name)}</td>
        <td><span class="code">${esc(e.code)}</span> <button class="btn icon ghost sm" data-eact="copy" data-copy="${esc(e.code)}" title="نسخ">${ic('copy')}</button></td>
        <td><span class="act-pill" style="--ac:var(--a-${e.activity})">${ic((ACT[e.activity] || ACT.offline).icon)}${esc((ACT[e.activity] || ACT.offline).label)}</span></td>
        <td>${e.online ? 'متصل الآن' : esc(fmtAgo(e.lastSeen))}</td>
        <td class="ltr">${esc(e.version || '—')}</td>
        <td style="text-align:end">
          <button class="btn sm" data-eact="rename">${ic('edit')}تعديل الاسم</button>
          <button class="btn sm" data-eact="regen">${ic('refresh')}كود جديد</button>
          <button class="btn sm danger" data-eact="delete">${ic('trash')}حذف</button>
        </td></tr>`
        )
        .join('')}</tbody>`
    : '<tbody><tr><td class="zero">لم تُضف أي موظف بعد.</td></tr></tbody>';
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const addrs = [...new Set([isLocal ? null : location.origin, ...S.addresses].filter(Boolean))];
  $('#addrList').innerHTML = addrs.map((a) => `<button class="chip" data-copy="${esc(a)}" title="نسخ">${ic('copy')}<span class="ltr">${esc(a)}</span></button>`).join('');
  renderLogEmpSelect();
}
$('#addEmpForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#newEmpName').value.trim();
  if (!name) return;
  try {
    const emp = await api('/api/employees', { method: 'POST', body: { name } });
    S.emps.set(emp.id, emp);
    $('#newEmpName').value = '';
    renderEmployees();
    renderLive();
    renderChips();
    ntoast({ title: `تمت إضافة ${emp.name}`, text: `كود الربط: ${emp.code}`, level: 'good' });
  } catch (err) {
    ntoast({ title: 'خطأ', text: err.message, level: 'crit' });
  }
});
document.addEventListener('click', (ev) => {
  const c = ev.target.closest('[data-copy]');
  if (!c) return;
  copyText(c.dataset.copy);
  ntoast({ title: 'تم النسخ', text: c.dataset.copy, level: 'good' });
});
$('#empTable').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-eact]');
  if (!b || b.dataset.eact === 'copy') return;
  const id = b.closest('tr').dataset.id;
  const e = S.emps.get(id);
  if (!e) return;
  try {
    if (b.dataset.eact === 'rename') {
      const name = prompt('الاسم الجديد:', e.name);
      if (!name || !name.trim()) return;
      S.emps.set(id, await api(`/api/employees/${id}`, { method: 'PATCH', body: { name } }));
    } else if (b.dataset.eact === 'regen') {
      if (!confirm(`إنشاء كود جديد لـ ${e.name}؟ سيتوقف الكود القديم وسيحتاج لإدخال الجديد في الإضافة.`)) return;
      S.emps.set(id, await api(`/api/employees/${id}`, { method: 'PATCH', body: { regenCode: true } }));
    } else if (b.dataset.eact === 'delete') {
      if (!confirm(`حذف ${e.name} نهائياً؟`)) return;
      await api(`/api/employees/${id}`, { method: 'DELETE' });
      S.emps.delete(id);
    }
    renderEmployees();
    renderLive();
    renderChips();
  } catch (err) {
    ntoast({ title: 'خطأ', text: err.message, level: 'crit' });
  }
});
function copyText(t) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(t).catch(() => fallbackCopy(t));
  } else fallbackCopy(t);
}
function fallbackCopy(t) {
  const ta = document.createElement('textarea');
  ta.value = t;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {}
  ta.remove();
}

/* ------------------------------ الإعدادات ------------------------------ */
function renderSettings() {
  const s = S.settings;
  if (!s) return;
  $('#sSender').value = s.senderName || '';
  $('#sWorkStart').value = s.workStart || '';
  $('#sWorkEnd').value = s.workEnd || '';
  $('#sIdle').value = s.idleSeconds || 120;
  $('#sCatMeta').value = (s.categories.meta || []).join('\n');
  $('#sCatWork').value = (s.categories.work || []).join('\n');
  $('#sCatYt').value = (s.categories.youtube || []).join('\n');
  $('#sCatSocial').value = (s.categories.social || []).join('\n');
  $('#rulesBox').innerHTML = RULES.map((R) => {
    const r = s.rules[R.k] || {};
    let extra = '';
    if (R.action) {
      extra = `<div class="r-line"><span class="lbl">الإجراء:</span><select class="input" data-f="action">${RULE_ACTIONS.map(([v, l]) => `<option value="${v}"${r.action === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <input class="input" data-f="text" value="${esc(r.text || '')}" placeholder="نص الإشعار التلقائي للموظف">`;
    }
    if (R.remind) {
      extra = `<div class="r-line"><label class="check"><input type="checkbox" data-f="remind"${r.remind ? ' checked' : ''}> إرسال تذكير تلقائي للموظف (صوت + إشعار)</label>
        <span class="lbl">حتى</span><input class="input" type="number" min="1" max="10" data-f="maxReminders" value="${r.maxReminders || 3}"><span class="lbl">مرات</span></div>`;
    }
    return `<div class="rule" data-k="${R.k}">
      <label class="switch"><input type="checkbox" data-f="enabled"${r.enabled ? ' checked' : ''}><span></span></label>
      <div class="r-main">
        <div class="r-line"><b>${esc(R.label)}</b><span class="hint">${esc(R.desc)}</span><input class="input" type="number" min="1" max="600" data-f="minutes" value="${r.minutes || 5}"><span class="hint">دقيقة</span></div>
        ${extra}
      </div>
    </div>`;
  }).join('');
  S.tplEdit = JSON.parse(JSON.stringify(s.templates || []));
  renderTplEdit();
}
function renderTplEdit() {
  $('#tplBox').innerHTML =
    S.tplEdit
      .map(
        (t, i) => `<div class="tpl" data-i="${i}">
      <select class="input" data-f="type">${Object.entries(TYPES).map(([k, T]) => `<option value="${k}"${t.type === k ? ' selected' : ''}>${T.label}</option>`).join('')}</select>
      <input class="input" data-f="title" value="${esc(t.title || '')}" placeholder="العنوان">
      <input class="input" data-f="body" value="${esc(t.body || '')}" placeholder="النص">
      <button class="btn icon danger" data-f="del" type="button" title="حذف">${ic('trash')}</button>
    </div>`
      )
      .join('') || '<p class="hint">لا توجد قوالب.</p>';
}
$('#tplBox').addEventListener('input', (ev) => {
  const row = ev.target.closest('.tpl');
  if (!row) return;
  const t = S.tplEdit[+row.dataset.i];
  t[ev.target.dataset.f] = ev.target.value;
});
$('#tplBox').addEventListener('change', (ev) => {
  const row = ev.target.closest('.tpl');
  if (row && ev.target.dataset.f === 'type') S.tplEdit[+row.dataset.i].type = ev.target.value;
});
$('#tplBox').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-f="del"]');
  if (!b) return;
  S.tplEdit.splice(+b.closest('.tpl').dataset.i, 1);
  renderTplEdit();
});
$('#addTpl').addEventListener('click', () => {
  S.tplEdit.push({ type: 'toast', title: '', body: '' });
  renderTplEdit();
});
$('#saveSettings').addEventListener('click', async () => {
  const lines = (id) => $(id).value.split('\n').map((x) => x.trim()).filter(Boolean);
  const rules = {};
  for (const row of $$('#rulesBox .rule')) {
    const r = {};
    for (const el of $$('[data-f]', row)) r[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
    rules[row.dataset.k] = r;
  }
  const body = {
    senderName: $('#sSender').value,
    workStart: $('#sWorkStart').value,
    workEnd: $('#sWorkEnd').value,
    idleSeconds: +$('#sIdle').value,
    categories: { meta: lines('#sCatMeta'), work: lines('#sCatWork'), youtube: lines('#sCatYt'), social: lines('#sCatSocial') },
    rules,
    templates: S.tplEdit.filter((t) => t.title || t.body),
  };
  try {
    S.settings = await api('/api/settings', { method: 'PUT', body });
    renderSettings();
    renderTemplateSelect();
    $('#settingsMsg').textContent = 'تم الحفظ ✓';
    setTimeout(() => ($('#settingsMsg').textContent = ''), 3000);
  } catch (e) {
    $('#settingsMsg').textContent = e.message;
  }
});
$('#pwForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/password', { method: 'POST', body: { current: $('#pwCur').value, next: $('#pwNew').value } });
    $('#pwMsg').textContent = 'تم تغيير كلمة المرور ✓';
    $('#pwCur').value = $('#pwNew').value = '';
  } catch (err) {
    $('#pwMsg').textContent = err.message;
  }
});

/* ------------------------------ تفاصيل الموظف ------------------------------ */
function openDrawer(id) {
  S.drawerId = id;
  S.drawerReport = null;
  $('#drawerRoot').innerHTML = `<div class="drawer-bg" id="drawerBg"></div>
    <aside class="drawer" role="dialog" aria-modal="true">
      <div class="drawer-h" id="dwHead"></div>
      <div class="drawer-b">
        <div class="panel" id="dwNow"></div>
        <div class="panel" id="dwToday"></div>
        <div class="panel">
          <h3>${ic('reply')}المحادثة والرسائل</h3>
          <div class="convo" id="dwConvo"></div>
          <form class="quick" id="dwQuick">
            <select class="input" id="dwType">
              <option value="modal">منتصف الصفحة</option>
              <option value="reply">طلب رد</option>
              <option value="toast">إشعار جانبي</option>
              <option value="banner">شريط علوي</option>
              <option value="alert">إنذار</option>
              <option value="system">خارج المتصفح</option>
            </select>
            <input class="input" id="dwText" placeholder="اكتب رسالة سريعة..." maxlength="2000">
            <button class="btn primary" type="submit">${ic('send')}</button>
          </form>
        </div>
      </div>
    </aside>`;
  $('#drawerBg').addEventListener('click', closeDrawer);
  $('#dwQuick').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = $('#dwText').value.trim();
    if (!text) return;
    try {
      await api('/api/messages', { method: 'POST', body: { to: [id], type: $('#dwType').value, title: '', body: text } });
      $('#dwText').value = '';
    } catch (err) {
      ntoast({ title: 'تعذر الإرسال', text: err.message, level: 'crit' });
    }
  });
  renderDrawerTop();
  renderConvo();
  refreshDrawerReport();
}
function closeDrawer() {
  S.drawerId = null;
  $('#drawerRoot').innerHTML = '';
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (S.drawerId) closeDrawer();
    $('#events').classList.add('hidden');
  }
});
async function refreshDrawerReport() {
  const id = S.drawerId;
  if (!id) return;
  try {
    const r = await api(`/api/report?emp=${encodeURIComponent(id)}`);
    if (S.drawerId !== id) return;
    S.drawerReport = r;
    renderDrawerTop();
  } catch {}
}
function renderDrawerTop() {
  const e = S.emps.get(S.drawerId);
  if (!e || !$('#dwHead')) return;
  const A = ACT[e.activity] || ACT.offline;
  $('#dwHead').innerHTML = `<div class="avatar" style="--h:${hue(e.name)}">${esc(initial(e.name))}<span class="st${e.online ? ' on' : ''}"></span></div>
    <div class="who"><b>${esc(e.name)}</b><small>${e.online ? 'متصل منذ ' + esc(fmtClock(e.connectedAt)) : 'غير متصل · آخر ظهور ' + esc(fmtAgo(e.lastSeen))}</small></div>
    <span class="act-pill" style="--ac:var(--a-${e.activity})">${ic(A.icon)}${esc(A.label)}</span>
    <button class="btn icon ghost" id="dwClose" title="إغلاق">${ic('x')}</button>`;
  $('#dwClose').addEventListener('click', closeDrawer);
  const idle = { active: 'نشط (يحرك الماوس/الكيبورد)', idle: 'خامل', locked: 'الجهاز مقفل' }[e.idle] || '—';
  $('#dwNow').innerHTML = `<h3>${ic('activity')}الآن</h3><dl class="kv">
    <dt>النشاط</dt><dd>${esc(A.label)} منذ <span class="num" data-since="${e.activitySince}"></span></dd>
    <dt>التبويب الحالي</dt><dd>${e.host ? `<span class="ltr">${esc(e.host)}</span>` : '—'}${e.title ? `<br><span class="hint">${esc(e.title)}</span>` : ''}</dd>
    <dt>المتصفح</dt><dd>${e.online ? (e.focused ? 'في المقدمة' : 'في الخلفية — يعمل على برنامج آخر') : '—'}</dd>
    <dt>الحركة</dt><dd>${e.online ? esc(idle) : '—'}</dd>
    ${!e.online ? `<dt>سبب الانقطاع</dt><dd>${esc(OFF_REASON[e.offlineReason] || '—')}</dd>` : ''}
    ${e.ytAudible ? '<dt>تنبيه</dt><dd><span class="flag crit">يوتيوب يعمل في الخلفية</span></dd>' : ''}
    ${e.metaUnread ? `<dt>رسائل العملاء</dt><dd>${e.metaUnread} غير مقروءة منذ <span data-ago="${e.metaUnreadSince}"></span></dd>` : ''}
    <dt>إصدار الإضافة</dt><dd class="ltr" style="text-align:right">${esc(e.version || '—')}</dd>
  </dl>`;
  const t = e.today || {};
  const tot = t.totals || {};
  const total = ACT_ORDER.reduce((a, k) => a + (tot[k] || 0), 0) || 1;
  const max = Math.max(1, ...ACT_ORDER.map((k) => tot[k] || 0));
  const R = S.drawerReport;
  const remp = R && R.employees && R.employees[0];
  $('#dwToday').innerHTML = `<h3>${ic('chart')}اليوم</h3>
    <dl class="kv" style="margin-bottom:12px">
      <dt>أول اتصال</dt><dd>${esc(fmtClock(t.first))}</dd>
      <dt>ردود مرسلة في ميتا</dt><dd>${t.sends || 0} (تقديري)${e.lastMetaSend ? ` · آخرها <span data-ago="${e.lastMetaSend}"></span>` : ''}</dd>
      <dt>سرعة الرد على الإدارة</dt><dd>${t.resp && t.resp.avg != null ? esc(fmtMs(t.resp.avg)) + ` (على ${t.resp.count} رسالة، أبطأها ${esc(fmtMs(t.resp.max))})` : '—'}</dd>
      ${t.unreadCount ? `<dt>زمن قراءة رسائل العملاء</dt><dd>${esc(fmtMs(t.unreadAvg))} في المتوسط (${t.unreadCount} مرة)</dd>` : ''}
      <dt>لم يرد بعد</dt><dd>${e.pending || 0}</dd>
    </dl>
    ${remp ? `<div class="lbl" style="margin-bottom:6px">الخط الزمني</div>${timelineHTML(R, [remp], true)}<div style="height:12px"></div>` : ''}
    <div class="breakdown">${ACT_ORDER.filter((k) => tot[k] > 0)
      .map((k) => `<div class="bd"><span>${esc(ACT[k].label)}</span><span class="track"><i class="${k === 'offline' ? 'hatch' : ''}" style="width:${((tot[k] / max) * 100).toFixed(1)}%;--c:var(--a-${k})"></i></span><span class="v num">${esc(fmtDur(tot[k]))}</span><span class="p num">${Math.round((tot[k] / total) * 100)}%</span></div>`)
      .join('') || '<span class="hint">لا توجد بيانات اليوم بعد</span>'}</div>`;
  updateTickers();
}
function renderConvo() {
  const id = S.drawerId;
  const box = $('#dwConvo');
  if (!id || !box) return;
  const items = [];
  for (const m of S.msgs) {
    const r = m.recipients[id];
    if (!r) continue;
    items.push({ at: m.createdAt, html: outBubble(m, r) });
    if (r.reply || r.choice) {
      items.push({
        at: r.respondedAt || m.createdAt + 1,
        html: `<div class="bubble in">${r.choice ? `اختار: <b>${esc(r.choice)}</b>${r.reply ? '<br>' : ''}` : ''}${r.reply ? esc(r.reply) : ''}<small>${esc(fmtDT(r.respondedAt))} · بعد ${esc(fmtMs(r.respMs))}</small></div>`,
      });
    }
  }
  for (const ev of S.events) {
    if (ev.empId === id && ev.kind === 'empmsg') items.push({ at: ev.at, html: `<div class="bubble in"><span class="bt">${ic('user')}رسالة من الموظف</span>${esc(ev.text)}<small>${esc(fmtDT(ev.at))}</small></div>` });
  }
  items.sort((a, b) => a.at - b.at);
  box.innerHTML = items.slice(-80).map((x) => x.html).join('') || '<div class="hint">لا توجد رسائل بعد.</div>';
  box.scrollTop = box.scrollHeight;
}
function outBubble(m, r) {
  const T = TYPES[m.type] || TYPES.toast;
  const st = STATUS[r.status] || STATUS.queued;
  return `<div class="bubble out"><span class="bt">${ic(T.icon)}${esc(T.label)}${m.source === 'rule' ? ' · تلقائي' : ''}</span>${m.title ? `<b>${esc(m.title)}</b><br>` : ''}${esc(m.body)}<small>${esc(fmtDT(m.createdAt))} · <span class="st st-${r.status}">${ic(st.i)}${esc(st.l)}</span></small></div>`;
}

/* ------------------------------ التنبيهات ------------------------------ */
const IMPORTANT = new Set(['reply', 'empmsg', 'rule', 'ack']);
const EV_ICON = { reply: 'reply', empmsg: 'user', rule: 'alert', ack: 'checks', conn: 'plug', disc: 'wifiOff', net: 'wifiOff' };

function onEvent(ev) {
  S.events.push(ev);
  if (S.events.length > 500) S.events.splice(0, S.events.length - 500);
  renderEvents();
  if (S.drawerId && ev.empId === S.drawerId && ev.kind === 'empmsg') renderConvo();
  if (!IMPORTANT.has(ev.kind)) return;
  const name = ev.name || empName(ev.empId);
  let title;
  let level = '';
  let snd = 'bell';
  if (ev.kind === 'reply') title = `${name} ردّ${ev.title ? ' على «' + ev.title + '»' : ''}`;
  else if (ev.kind === 'empmsg') title = `رسالة من ${name}`;
  else if (ev.kind === 'ack') {
    title = name;
    level = 'good';
    snd = 'soft';
  } else {
    title = `تنبيه: ${name}`;
    level = 'crit';
    snd = ev.level === 'high' ? 'bell' : 'soft';
    const card = $(`#empGrid .emp[data-id="${CSS.escape(ev.empId || '')}"]`);
    if (card) {
      card.classList.remove('flash');
      void card.offsetWidth;
      card.classList.add('flash');
    }
  }
  ntoast({ title, text: ev.text, level, onClick: () => ev.empId && S.emps.has(ev.empId) && openDrawer(ev.empId) });
  if (S.soundOn) NotifSounds.play(snd);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, { body: ev.text, icon: 'icon.png', tag: ev.id, dir: 'rtl', lang: 'ar' });
      n.onclick = () => {
        window.focus();
        if (ev.empId && S.emps.has(ev.empId)) openDrawer(ev.empId);
        n.close();
      };
    } catch {}
  }
}

function renderEvents() {
  const unseen = S.events.filter((e) => e.at > S.seenEv && IMPORTANT.has(e.kind)).length;
  const b = $('#bellBadge');
  b.textContent = unseen > 99 ? '99+' : unseen;
  b.classList.toggle('hidden', !unseen);
  if ($('#events').classList.contains('hidden')) return;
  const list = S.events.slice(-200).reverse();
  $('#eventsList').innerHTML =
    list
      .map(
        (ev) => `<div class="ev k-${ev.kind}${ev.at > S.seenEvPrev ? ' new' : ''}" data-emp="${esc(ev.empId || '')}">
      <div class="ev-ic">${ic(EV_ICON[ev.kind] || 'bell')}</div>
      <div class="ev-t"><b>${esc(ev.name || empName(ev.empId))}</b><p>${esc(ev.text)}${ev.respMs != null && ev.kind !== 'rule' ? ` <span class="hint">(بعد ${esc(fmtMs(ev.respMs))})</span>` : ''}</p></div>
      <time>${esc(fmtAgo(ev.at))}</time>
    </div>`
      )
      .join('') || '<div class="empty" style="margin:14px;border:0">لا توجد تنبيهات</div>';
  const np = $('#notifPerm');
  np.classList.toggle('hidden', !('Notification' in window) || Notification.permission !== 'default');
}
$('#bellBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  const p = $('#events');
  const opening = p.classList.contains('hidden');
  p.classList.toggle('hidden');
  if (opening) {
    S.seenEvPrev = S.seenEv;
    renderEvents();
    S.seenEv = now();
    store.set('seenEv', String(S.seenEv));
    $('#bellBadge').classList.add('hidden');
  }
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#events') && !e.target.closest('#bellBtn')) $('#events').classList.add('hidden');
});
$('#eventsList').addEventListener('click', (e) => {
  const ev = e.target.closest('.ev');
  if (ev && ev.dataset.emp && S.emps.has(ev.dataset.emp)) {
    $('#events').classList.add('hidden');
    openDrawer(ev.dataset.emp);
  }
});
$('#clearEvents').addEventListener('click', async () => {
  if (!confirm('مسح كل التنبيهات؟')) return;
  await api('/api/events/clear', { method: 'POST' }).catch(() => {});
});
$('#notifPerm').addEventListener('click', async () => {
  try {
    await Notification.requestPermission();
  } catch {}
  renderEvents();
});

function ntoast({ title, text, level, onClick }) {
  const el = document.createElement('div');
  el.className = 'ntoast ' + (level || '');
  el.innerHTML = `<div style="flex:1;min-width:0"><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}</div>`;
  el.addEventListener('click', () => {
    el.remove();
    if (onClick) onClick();
  });
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), level === 'crit' ? 12000 : 8000);
  while ($('#toasts').children.length > 5) $('#toasts').firstElementChild.remove();
}

/* ------------------------------ الصوت والمظهر ------------------------------ */
function setSoundBtn() {
  $('#soundBtn').innerHTML = ic(S.soundOn ? 'volume' : 'volumeX');
  $('#soundBtn').title = S.soundOn ? 'صوت التنبيهات: يعمل' : 'صوت التنبيهات: مكتوم';
}
$('#soundBtn').addEventListener('click', () => {
  S.soundOn = !S.soundOn;
  store.set('sound', S.soundOn ? '1' : '0');
  setSoundBtn();
  if (S.soundOn) NotifSounds.play('soft');
});
function currentTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function setThemeBtn() {
  $('#themeBtn').innerHTML = ic(currentTheme() === 'dark' ? 'sun' : 'moon');
}
$('#themeBtn').addEventListener('click', () => {
  const t = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  store.set('theme', t);
  setThemeBtn();
});
document.addEventListener('pointerdown', () => NotifSounds.unlock(), { once: true });

/* ------------------------------ تلميح عند المرور ------------------------------ */
const tip = $('#tip');
document.addEventListener('mousemove', (e) => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) {
    tip.classList.add('hidden');
    return;
  }
  tip.textContent = t.dataset.tip;
  tip.classList.remove('hidden');
  const r = tip.getBoundingClientRect();
  let x = e.clientX + 14;
  let y = e.clientY + 16;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 12;
  tip.style.left = Math.max(8, x) + 'px';
  tip.style.top = Math.max(8, y) + 'px';
});

/* ------------------------------ البدء ------------------------------ */
hydrateIcons();
S.seenEvPrev = S.seenEv;
if (S.token) boot();
else showLogin();
