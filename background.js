/**
 * الخدمة الخلفية لإضافة الموظف
 * - تحافظ على اتصال دائم بالخادم (WebSocket)
 * - ترسل حالة الموظف: التبويب الحالي / خارج المتصفح / خامل / مقفل
 * - تستقبل الإشعارات وتعرضها في التبويب النشط أو كإشعار ويندوز أو نافذة مستقلة
 * - ترسل ردود الموظف وأوقات الاستجابة للخادم
 */
'use strict';

try {
  importScripts('config.js');
} catch {}
const DEFAULT_SERVER = (self.NOTIF_CONFIG && self.NOTIF_CONFIG.defaultServer) || '';

const VERSION = chrome.runtime.getManifest().version;
const BLOCKING = new Set(['modal', 'alert', 'violation', 'reply', 'choice', 'window']);
const TYPE_LABEL = {
  toast: 'إشعار',
  banner: 'تنبيه',
  modal: 'رسالة',
  alert: 'إنذار',
  violation: 'إشعار مخالفة',
  reply: 'مطلوب رد',
  choice: 'سؤال',
  system: 'إشعار',
  window: 'رسالة',
};

const S = {
  cfg: { server: '', code: '' },
  name: '',
  from: 'الإدارة',
  idleSeconds: 120,
  msgs: {}, // id -> { msg, done, shown, displayed, at, doneStatus, doneData, doneAt }
  outbox: [], // تحديثات حالة بانتظار الإرسال
  offline: null, // { s, net } بداية فترة الانقطاع
  ws: null,
  connected: false,
  error: '',
  backoff: 2000,
  reconnectTimer: null,
  pingTimer: null,
  pollTimer: null,
  lastStateKey: '',
  lastStateAt: 0,
  windows: {}, // msgId -> windowId
  loops: {}, // msgId -> interval (تكرار صوت الإنذار)
  unread: -1,
};

/* ============================== التخزين ============================== */

let readyPromise = null;
function ready() {
  if (!readyPromise) readyPromise = load();
  return readyPromise;
}
async function load() {
  try {
    const d = await chrome.storage.local.get(['cfg', 'name', 'from', 'idleSeconds', 'msgs', 'outbox', 'offline']);
    if (d.cfg) Object.assign(S.cfg, d.cfg);
    if (!S.cfg.server && DEFAULT_SERVER) S.cfg.server = normServer(DEFAULT_SERVER);
    S.name = d.name || '';
    S.from = d.from || 'الإدارة';
    S.idleSeconds = d.idleSeconds || 120;
    S.msgs = d.msgs || {};
    S.outbox = d.outbox || [];
    S.offline = d.offline || null;
  } catch (e) {
    console.warn('load failed', e);
  }
  cleanup();
  try {
    chrome.idle.setDetectionInterval(Math.max(15, S.idleSeconds));
  } catch {}
}

let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    chrome.storage.local
      .set({ cfg: S.cfg, name: S.name, from: S.from, idleSeconds: S.idleSeconds, msgs: S.msgs, outbox: S.outbox, offline: S.offline })
      .catch(() => {});
  }, 250);
}

function cleanup() {
  const t = Date.now();
  for (const [id, x] of Object.entries(S.msgs)) {
    if ((x.done && t - (x.doneAt || x.at) > 2 * 86400000) || t - x.at > 7 * 86400000) delete S.msgs[id];
  }
  if (S.outbox.length > 500) S.outbox.splice(0, S.outbox.length - 500);
}

/* ============================== الاتصال بالخادم ============================== */

function normServer(s) {
  s = String(s || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) {
    // عنوان محلي (IP أو localhost) => http، أما الدومين على الإنترنت => https
    const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\d+\.\d+\.\d+\.\d+)/i.test(s);
    s = (local ? 'http://' : 'https://') + s;
  }
  return s.replace(/\/+$/, '');
}

function wsUrl() {
  const u = new URL(S.cfg.server);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = u.pathname.replace(/\/+$/, '') + '/ws/agent';
  u.search = '?code=' + encodeURIComponent(S.cfg.code);
  u.hash = '';
  return u.toString();
}

function connect() {
  if (!S.cfg.server || !S.cfg.code) {
    S.error = 'not-configured';
    updateBadge();
    return;
  }
  if (S.ws && (S.ws.readyState === WebSocket.CONNECTING || S.ws.readyState === WebSocket.OPEN)) return;
  clearTimeout(S.reconnectTimer);
  S.reconnectTimer = null;
  let ws;
  try {
    ws = new WebSocket(wsUrl());
  } catch (e) {
    S.error = 'bad-server';
    updateBadge();
    scheduleReconnect(30000);
    return;
  }
  S.ws = ws;

  ws.onopen = () => {
    if (S.ws !== ws) return;
    S.connected = true;
    S.error = '';
    S.backoff = 2000;
    send({ t: 'hello', version: VERSION, now: Date.now() });
    flushOffline();
    flushOutbox();
    S.lastStateKey = '';
    sendState(true);
    S.unread = -1;
    checkUnread();
    startTimers();
    updateBadge();
  };
  ws.onmessage = (ev) => {
    let m;
    try {
      m = JSON.parse(ev.data);
    } catch {
      return;
    }
    onServer(m);
  };
  ws.onclose = (ev) => {
    if (S.ws !== ws) return;
    S.ws = null;
    S.connected = false;
    stopTimers();
    if (ev.code === 4401 || ev.code === 4429) S.error = 'bad-code';
    else if (ev.code === 4000) S.error = 'replaced';
    else S.error = navigator.onLine ? 'server-unreachable' : 'no-internet';
    markOffline();
    updateBadge();
    scheduleReconnect(ev.code === 4401 || ev.code === 4429 || ev.code === 4000 ? 60000 : 0);
  };
  ws.onerror = () => {};
}

function scheduleReconnect(delay) {
  clearTimeout(S.reconnectTimer);
  const d = delay || S.backoff;
  S.backoff = Math.min(30000, S.backoff * 2);
  S.reconnectTimer = setTimeout(connect, d);
}

function reconnectNow() {
  const old = S.ws;
  S.ws = null;
  S.connected = false;
  stopTimers();
  if (old) {
    try {
      old.close();
    } catch {}
  }
  S.backoff = 2000;
  connect();
}

function send(obj) {
  if (!S.connected || !S.ws || S.ws.readyState !== WebSocket.OPEN) return false;
  try {
    S.ws.send(JSON.stringify(obj));
    return true;
  } catch {
    return false;
  }
}

function startTimers() {
  stopTimers();
  // رسائل دورية كل 20 ثانية تبقي الخدمة الخلفية حيّة وتؤكد الاتصال
  S.pingTimer = setInterval(() => send({ t: 'ping' }), 20000);
  S.pollTimer = setInterval(() => sendState(false), 10000);
}
function stopTimers() {
  clearInterval(S.pingTimer);
  clearInterval(S.pollTimer);
  S.pingTimer = S.pollTimer = null;
}

function markOffline() {
  if (!S.cfg.code || !S.cfg.server) return;
  const net = !navigator.onLine;
  if (!S.offline) S.offline = { s: Date.now(), net };
  else if (net) S.offline.net = true;
  save();
}
function flushOffline() {
  if (!S.offline) return;
  send({ t: 'offlineLog', s: S.offline.s, e: Date.now(), net: !!S.offline.net });
  S.offline = null;
  save();
}

function report(id, status, data) {
  const x = S.msgs[id];
  if (status === 'displayed') {
    if (x && x.displayed) return;
    if (x) x.displayed = true;
  }
  data = data || {};
  S.outbox.push({ t: 'status', id, status, at: Date.now(), reply: data.reply || undefined, choice: data.choice || undefined });
  flushOutbox();
  save();
}
function flushOutbox() {
  while (S.outbox.length && S.connected) {
    if (!send(S.outbox[0])) break;
    S.outbox.shift();
  }
  save();
}

function onServer(m) {
  switch (m.t) {
    case 'welcome':
      S.name = m.name || '';
      if (m.settings) applySettings(m.settings);
      save();
      updateBadge();
      break;
    case 'settings':
      applySettings(m.settings || {});
      break;
    case 'notify':
      onNotify(m.msg);
      break;
    case 'cancel':
      resolve(m.id, null, null, true);
      break;
    case 'remind':
      onRemind(m.id);
      break;
  }
}

function applySettings(s) {
  if (s.idleSeconds) {
    S.idleSeconds = Math.max(15, Math.min(3600, s.idleSeconds | 0));
    try {
      chrome.idle.setDetectionInterval(S.idleSeconds);
    } catch {}
  }
  if (s.from) S.from = s.from;
  save();
}

/* ============================== حالة الموظف ============================== */

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
function isYouTube(url) {
  return /(^|\.)(youtube\.com|youtu\.be)$/i.test(hostOf(url));
}
function isMetaInbox(url) {
  try {
    const u = new URL(url);
    return /(^|\.)business\.facebook\.com$/i.test(u.hostname) || (/(^|\.)facebook\.com$/i.test(u.hostname) && u.pathname.startsWith('/latest'));
  } catch {
    return false;
  }
}

async function collectState() {
  let idle = 'active';
  try {
    idle = await chrome.idle.queryState(Math.max(15, S.idleSeconds));
  } catch {}
  let win = null;
  try {
    win = await chrome.windows.getLastFocused({ windowTypes: ['normal', 'popup'] });
  } catch {}
  const focused = !!(win && win.focused);
  let tab = null;
  if (win) {
    try {
      [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
    } catch {}
  }
  let scheme = '';
  let host = '';
  let path = '';
  let title = '';
  if (tab) {
    title = tab.title || '';
    try {
      const u = new URL(tab.url || tab.pendingUrl || '');
      scheme = u.protocol.replace(':', '');
      host = u.hostname;
      path = u.pathname;
    } catch {}
    if (scheme === 'chrome-extension' && host === chrome.runtime.id) {
      scheme = 'notif';
      host = '';
      path = '';
    }
  }
  let ytAudible = false;
  try {
    const aud = await chrome.tabs.query({ audible: true });
    ytAudible = aud.some((t) => isYouTube(t.url));
  } catch {}
  return { focused, idle, scheme, host, path, title: title.slice(0, 200), ytAudible };
}

async function sendState(force) {
  if (!S.connected) return;
  const st = await collectState();
  const key = JSON.stringify(st);
  const t = Date.now();
  if (!force && key === S.lastStateKey && t - S.lastStateAt < 60000) return;
  S.lastStateKey = key;
  S.lastStateAt = t;
  send({ t: 'state', ...st });
}

function debounce(fn, ms) {
  let tm = null;
  return (...a) => {
    clearTimeout(tm);
    tm = setTimeout(() => fn(...a), ms);
  };
}
const sendStateSoon = debounce(() => sendState(false), 700);
const unreadSoon = debounce(() => checkUnread(), 800);
const renderSoon = debounce(() => renderPending(), 350);

/** عدد الرسائل غير المقروءة في ميتا بيزنس (من عنوان التبويب مثل "(3) Inbox") */
async function checkUnread() {
  let max = 0;
  try {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (!isMetaInbox(t.url)) continue;
      const m = /^\((\d+)\+?\)/.exec((t.title || '').trim());
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  } catch {}
  if (max !== S.unread && send({ t: 'metaUnread', count: max })) S.unread = max;
}

/* ============================== عرض الإشعارات ============================== */

function injectable(url) {
  if (!url || !/^(https?|file):/i.test(url)) return false;
  if (/^https:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com)/i.test(url)) return false;
  return true;
}

async function lastNormalWindow() {
  try {
    return await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
  } catch {
    return null;
  }
}

async function activeTab() {
  const win = await lastNormalWindow();
  if (!win) return null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
    return tab || null;
  } catch {
    return null;
  }
}

async function browserFocused() {
  try {
    const w = await chrome.windows.getLastFocused({ windowTypes: ['normal', 'popup'] });
    return !!(w && w.focused);
  } catch {
    return false;
  }
}

async function sendToTab(tabId, payload) {
  try {
    return await chrome.tabs.sendMessage(tabId, payload);
  } catch {
    // الصفحة مفتوحة قبل تثبيت الإضافة أو بعد تحديثها: نحقن السكربت ثم نعيد المحاولة
    await chrome.scripting.executeScript({ target: { tabId }, files: ['ui.js', 'content.js'] });
    return await chrome.tabs.sendMessage(tabId, payload);
  }
}

async function showInActiveTab(msgs) {
  if (!msgs.length) return true;
  const tab = await activeTab();
  if (!tab || !injectable(tab.url)) return false;
  try {
    const r = await sendToTab(tab.id, { t: 'show', msgs });
    return !!(r && r.ok);
  } catch {
    return false;
  }
}

function pendingList() {
  return Object.values(S.msgs)
    .filter((x) => !x.done && x.msg.type !== 'system' && x.msg.type !== 'window' && !(x.msg.type === 'toast' && x.shown))
    .sort((a, b) => (a.msg.createdAt || 0) - (b.msg.createdAt || 0))
    .map((x) => x.msg);
}

async function renderPending() {
  const list = pendingList();
  if (!list.length) return;
  const ok = await showInActiveTab(list);
  if (ok) {
    for (const m of list) if (S.msgs[m.id]) S.msgs[m.id].shown = true;
    save();
  }
}

function osNotify(msg, reminder) {
  const label = TYPE_LABEL[msg.type] || 'إشعار';
  const nid = 'm:' + msg.id;
  const opts = {
    type: 'basic',
    iconUrl: msg.type === 'alert' || msg.type === 'violation' ? 'icons/alert128.png' : 'icons/icon128.png',
    title: (reminder ? '⏰ تذكير: ' : '') + (msg.title || label),
    message: (msg.body || label).slice(0, 400),
    contextMessage: (S.from || 'الإدارة') + ' · ' + label + (BLOCKING.has(msg.type) ? ' — اضغط للفتح' : ''),
    priority: 2,
    requireInteraction: msg.type !== 'toast',
    silent: false,
  };
  chrome.notifications.clear(nid, () => {
    void chrome.runtime.lastError;
    chrome.notifications.create(nid, opts, () => void chrome.runtime.lastError);
  });
}

async function focusBrowser() {
  const w = await lastNormalWindow();
  if (!w) return;
  try {
    if (w.state === 'minimized') await chrome.windows.update(w.id, { state: 'normal' });
    await chrome.windows.update(w.id, { focused: true, drawAttention: true });
  } catch {}
}

/** نافذة مستقلة واحدة تعرض كل الرسائل المعلقة بالترتيب (بدلاً من نافذة لكل رسالة) */
const ALERT_URL = () => chrome.runtime.getURL('alert.html');
async function findQueueWindow() {
  try {
    const tabs = await chrome.tabs.query({ url: ALERT_URL() + '*' });
    return tabs[0] || null;
  } catch {
    return null;
  }
}

let winCreating = null;
async function openWindow(msg) {
  if (winCreating) await winCreating;
  const existing = await findQueueWindow();
  if (existing) {
    if (msg) chrome.runtime.sendMessage({ t: 'win:add', msg }).catch(() => {});
    try {
      await chrome.windows.update(existing.windowId, { focused: true, drawAttention: true });
    } catch {}
    return;
  }
  winCreating = (async () => {
    const opts = { url: ALERT_URL(), type: 'popup', width: 600, height: 640, focused: true };
    const w = await lastNormalWindow();
    if (w && w.width && w.state !== 'minimized') {
      opts.left = Math.max(0, Math.round(w.left + (w.width - opts.width) / 2));
      opts.top = Math.max(0, Math.round(w.top + (w.height - opts.height) / 2));
    }
    try {
      const nw = await chrome.windows.create(opts);
      chrome.windows.update(nw.id, { focused: true, drawAttention: true }).catch(() => {});
    } catch {
      if (msg) osNotify(msg);
    }
  })();
  try {
    await winCreating;
  } finally {
    winCreating = null;
  }
}

async function display(msg) {
  const x = S.msgs[msg.id];
  if (!x) return;
  const type = msg.type;
  const focused = await browserFocused();
  if (type === 'system') {
    osNotify(msg);
    report(msg.id, 'displayed');
    x.shown = true;
  } else if (type === 'window') {
    await openWindow(msg);
    report(msg.id, 'displayed');
    x.shown = true;
  } else {
    const inTab = await showInActiveTab([msg]);
    if (inTab) {
      x.shown = true;
      // خارج المتصفح؟ نُظهر أيضاً إشعار ويندوز حتى يراه أينما كان
      if (msg.options.os || !focused) osNotify(msg);
      if (type === 'alert' && !focused) await openWindow(msg);
    } else if (BLOCKING.has(type)) {
      await openWindow(msg);
      if (msg.options.os || !focused) osNotify(msg);
      report(msg.id, 'displayed');
      x.shown = true;
    } else {
      osNotify(msg);
      report(msg.id, 'displayed');
      x.shown = true;
    }
  }
  save();
  updateBadge();
}

async function onNotify(msg) {
  if (!msg || !msg.id) return;
  msg.options = msg.options || {};
  const ex = S.msgs[msg.id];
  if (ex) {
    if (ex.done) {
      if (ex.doneStatus && ex.doneStatus !== 'cancelled') report(msg.id, ex.doneStatus, ex.doneData);
      return;
    }
    ex.msg = msg;
    if (!BLOCKING.has(msg.type) && ex.shown) {
      report(msg.id, 'displayed');
      return;
    }
    await display(msg);
    return;
  }
  S.msgs[msg.id] = { msg, done: false, shown: false, displayed: false, at: Date.now() };
  save();
  report(msg.id, 'delivered');
  playSound(msg.options.sound);
  if (msg.type === 'alert' && msg.options.repeat) startLoop(msg.id, msg.options.sound);
  if (msg.options.speak) speak(msg);
  await display(msg);
}

async function onRemind(id) {
  const x = S.msgs[id];
  if (!x || x.done) return;
  const snd = x.msg.options.sound && x.msg.options.sound !== 'none' ? x.msg.options.sound : 'bell';
  playSound(snd);
  osNotify(x.msg, true);
  const tab = await activeTab();
  if (tab && injectable(tab.url)) chrome.tabs.sendMessage(tab.id, { t: 'remind', id }).catch(() => {});
  const qw = await findQueueWindow();
  if (qw) {
    chrome.windows.update(qw.windowId, { focused: true, drawAttention: true }).catch(() => {});
    chrome.runtime.sendMessage({ t: 'remind', id }).catch(() => {});
  }
}

function resolve(id, status, data, cancelled) {
  const x = S.msgs[id];
  if (!x) {
    if (!cancelled && status) report(id, status, data);
    closeUi(id);
    return;
  }
  if (x.done) return;
  x.done = true;
  x.doneStatus = cancelled ? 'cancelled' : status;
  x.doneData = data || {};
  x.doneAt = Date.now();
  if (!cancelled) report(id, status, data);
  stopLoop(id);
  closeUi(id);
  save();
  updateBadge();
}

async function closeUi(id) {
  chrome.notifications.clear('m:' + id, () => void chrome.runtime.lastError);
  // النافذة المستقلة تحذف الرسالة وتُغلق نفسها إذا لم يتبقَّ شيء
  chrome.runtime.sendMessage({ t: 'remove', id }).catch(() => {});
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch {}
  for (const t of tabs) {
    if (injectable(t.url)) chrome.tabs.sendMessage(t.id, { t: 'remove', id }).catch(() => {});
  }
}

/* ============================== الصوت والنطق ============================== */

let creatingOffscreen = null;
async function ensureOffscreen() {
  try {
    const c = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (c.length) return;
  } catch {}
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen
      .createDocument({ url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'], justification: 'تشغيل أصوات التنبيهات' })
      .catch(() => {})
      .finally(() => {
        creatingOffscreen = null;
      });
  }
  await creatingOffscreen;
}

async function playSound(kind) {
  if (!kind || kind === 'none') return;
  try {
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ target: 'offscreen', t: 'play', kind });
  } catch {
    setTimeout(() => chrome.runtime.sendMessage({ target: 'offscreen', t: 'play', kind }).catch(() => {}), 200);
  }
}

function startLoop(id, sound) {
  stopLoop(id);
  let n = 0;
  S.loops[id] = setInterval(() => {
    const x = S.msgs[id];
    if (!x || x.done || ++n > 12) return stopLoop(id);
    playSound(sound && sound !== 'none' ? sound : 'alarm');
  }, 9000);
}
function stopLoop(id) {
  if (S.loops[id]) clearInterval(S.loops[id]);
  delete S.loops[id];
}

function speak(msg) {
  try {
    const text = [msg.title, msg.body].filter(Boolean).join('. ').slice(0, 600);
    if (text) chrome.tts.speak(text, { lang: 'ar', rate: 0.95, enqueue: false });
  } catch {}
}

/* ============================== شارة الأيقونة ============================== */

function pendingCount() {
  return Object.values(S.msgs).filter((x) => !x.done && BLOCKING.has(x.msg.type)).length;
}

function updateBadge() {
  const n = pendingCount();
  let text = '';
  let color = '#dc2626';
  let title = 'منظومة الإشعارات';
  if (!S.connected) {
    text = S.cfg.code ? '!' : '?';
    color = '#64748b';
    title += S.cfg.code ? ' — غير متصل' : ' — لم يتم الربط';
  } else title += ' — متصل' + (S.name ? ` (${S.name})` : '');
  if (n) {
    text = String(n);
    color = '#dc2626';
    title += ` — ${n} رسالة بانتظار ردك`;
  }
  try {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
    chrome.action.setTitle({ title });
  } catch {}
}

/* ============================== الأحداث ============================== */

chrome.runtime.onMessage.addListener((m, sender, sendResponse) => {
  if (!m || m.target === 'offscreen' || !m.t) return false;
  (async () => {
    await ready();
    switch (m.t) {
      case 'ready': {
        if (!sender.tab || !sender.tab.active) return { msgs: [] };
        const list = pendingList();
        for (const msg of list) if (S.msgs[msg.id]) S.msgs[msg.id].shown = true;
        save();
        return { msgs: list };
      }
      case 'displayed': {
        const x = S.msgs[m.id];
        if (x) x.shown = true;
        report(m.id, 'displayed');
        return { ok: true };
      }
      case 'respond': {
        const st = m.status === 'replied' ? 'replied' : 'read';
        resolve(m.id, st, { reply: typeof m.reply === 'string' ? m.reply.slice(0, 4000) : undefined, choice: m.choice });
        return { ok: true };
      }
      case 'metaSend':
        send({ t: 'metaSend' });
        return { ok: true };
      case 'getPending': {
        const list = Object.values(S.msgs)
          .filter((x) => !x.done && BLOCKING.has(x.msg.type))
          .map((x) => x.msg);
        return { msgs: list, from: S.from };
      }
      case 'popup:get':
        return popupState();
      case 'popup:save': {
        S.cfg.server = normServer(m.server);
        S.cfg.code = String(m.code || '').trim().toUpperCase();
        S.error = '';
        save();
        reconnectNow();
        await new Promise((r) => setTimeout(r, 1200));
        return popupState();
      }
      case 'popup:toAdmin': {
        const text = String(m.text || '').trim().slice(0, 2000);
        if (!text) return { ok: false };
        return { ok: send({ t: 'toAdmin', text }) };
      }
      case 'popup:showPending': {
        await focusBrowser();
        const list = pendingList();
        const ok = await showInActiveTab(list);
        const blocking = list.filter((msg) => BLOCKING.has(msg.type));
        if (!ok && blocking.length) await openWindow(blocking[0]);
        if (Object.values(S.msgs).some((x) => !x.done && x.msg.type === 'window')) await openWindow(null);
        return { ok: true };
      }
    }
    return null;
  })().then(sendResponse, (e) => sendResponse({ error: String(e) }));
  return true;
});

function popupState() {
  return {
    connected: S.connected,
    error: S.error,
    name: S.name,
    server: S.cfg.server,
    code: S.cfg.code,
    pending: pendingCount(),
    version: VERSION,
    online: navigator.onLine,
  };
}

chrome.tabs.onActivated.addListener(async () => {
  await ready();
  sendStateSoon();
  renderSoon();
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  await ready();
  if (info.title !== undefined && isMetaInbox(tab.url)) unreadSoon();
  if (info.audible !== undefined) sendStateSoon();
  if (!tab.active) return;
  if (info.url || info.title || info.status === 'complete') sendStateSoon();
  if (info.status === 'complete') renderSoon();
});

chrome.tabs.onRemoved.addListener(async () => {
  await ready();
  unreadSoon();
  sendStateSoon();
});

chrome.windows.onFocusChanged.addListener(async (wid) => {
  await ready();
  sendStateSoon();
  if (wid !== chrome.windows.WINDOW_ID_NONE) renderSoon();
});

chrome.idle.onStateChanged.addListener(async () => {
  await ready();
  sendState(true);
});

chrome.notifications.onClicked.addListener(async (nid) => {
  await ready();
  if (!nid.startsWith('m:')) return;
  const id = nid.slice(2);
  chrome.notifications.clear(nid, () => void chrome.runtime.lastError);
  const x = S.msgs[id];
  await focusBrowser();
  if (!x || x.done) return;
  const t = x.msg.type;
  if (t === 'system' || t === 'toast' || t === 'banner') {
    resolve(id, 'read');
    return;
  }
  if (t === 'window') {
    await openWindow(x.msg);
    return;
  }
  const ok = await showInActiveTab([x.msg]);
  if (!ok) await openWindow(x.msg);
});

chrome.notifications.onClosed.addListener(async (nid, byUser) => {
  await ready();
  if (!byUser || !nid.startsWith('m:')) return;
  const x = S.msgs[nid.slice(2)];
  if (x && !x.done && x.msg.type === 'system') resolve(x.msg.id, 'read');
});

chrome.alarms.onAlarm.addListener(async (a) => {
  await ready();
  if (a.name !== 'tick') return;
  if (!S.connected) {
    markOffline();
    connect();
  } else sendState(false);
  cleanup();
});

chrome.runtime.onInstalled.addListener(async (d) => {
  await ready();
  if (d.reason === 'install' && !S.cfg.code) chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?setup=1') });
});

chrome.runtime.onStartup.addListener(async () => {
  await ready();
  connect();
});

/* ============================== التشغيل ============================== */

chrome.alarms.get('tick').then((a) => {
  if (!a) chrome.alarms.create('tick', { periodInMinutes: 0.5 });
});

ready().then(() => {
  updateBadge();
  connect();
});
