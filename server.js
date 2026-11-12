'use strict';
/**
 * خادم منظومة الإشعارات ومتابعة الموظفين
 * - يستقبل اتصالات إضافة كروم من أجهزة الموظفين (WebSocket /ws/agent)
 * - يخدم لوحة التحكم ويبث لها التحديثات الحيّة (WebSocket /ws/admin)
 * - يحسب أوقات النشاط (ميتا/يوتيوب/خارج المتصفح/...) وسرعة الرد
 * - ينفذ قواعد التنبيه التلقائية
 */
const http = require('http');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');
const { JsonFile, flushAll, DATA_DIR } = require('./store');

/* ============================== الإعدادات ============================== */

const DEFAULT_CONFIG = {
  port: 3000,
  adminPassword: null, // {salt, hash}
  senderName: 'الإدارة',
  idleSeconds: 120,
  workStart: '09:00',
  workEnd: '17:00',
  violationCounter: 0,
  categories: {
    meta: [
      'business.facebook.com',
      'facebook.com/latest',
      'adsmanager.facebook.com',
      'facebook.com/business',
    ],
    work: ['web.whatsapp.com', 'business.whatsapp.com'],
    youtube: ['youtube.com', 'youtu.be'],
    social: [
      'facebook.com',
      'instagram.com',
      'messenger.com',
      'tiktok.com',
      'x.com',
      'twitter.com',
      'snapchat.com',
    ],
  },
  rules: {
    youtube: { enabled: true, minutes: 5, action: 'none', text: 'تم رصد تواجدك على يوتيوب أثناء وقت العمل. برجاء العودة للعمل فوراً.' },
    social: { enabled: false, minutes: 10, action: 'none', text: 'برجاء الابتعاد عن مواقع التواصل والعودة للعمل.' },
    outside: { enabled: true, minutes: 10, action: 'none', text: 'أنت خارج المتصفح منذ فترة. برجاء العودة لصفحة ميتا بيزنس.' },
    idle: { enabled: true, minutes: 10, action: 'none', text: 'لم يتم رصد أي نشاط منذ فترة. هل أنت متواجد؟' },
    offline: { enabled: true, minutes: 3 },
    noReply: { enabled: true, minutes: 3, remind: true, maxReminders: 3 },
    metaUnread: { enabled: true, minutes: 5, action: 'toast', text: 'لديك رسائل عملاء غير مقروءة منذ أكثر من {min} دقائق. برجاء الرد عليها.' },
  },
  templates: [
    { type: 'toast', title: 'تذكير', body: 'برجاء مراجعة صندوق الرسائل في ميتا بيزنس والرد على العملاء.' },
    { type: 'alert', title: 'ارجع للعمل فوراً', body: 'تم رصد خروجك عن العمل. برجاء العودة فوراً.' },
    { type: 'reply', title: 'أين أنت الآن؟', body: 'برجاء الرد: ما الذي تعمل عليه حالياً؟' },
    { type: 'choice', title: 'اجتماع', body: 'هل يمكنك حضور اجتماع سريع بعد 10 دقائق؟', options: { choices: ['نعم', 'لا', 'بعد قليل'] } },
    { type: 'banner', title: 'تنبيه عام', body: 'يوجد ضغط رسائل حالياً، برجاء التركيز على صندوق الوارد.' },
    { type: 'violation', title: 'تأخر في الرد على العملاء', body: 'تأخرت في الرد على رسائل العملاء أكثر من المسموح به.', options: { penalty: 'لفت نظر' } },
  ],
};

const configFile = new JsonFile('config.json', {});
const config = mergeDefaults(DEFAULT_CONFIG, configFile.data);
configFile.data = config;

// الرابط العام عند الاستضافة (Render يضبط RENDER_EXTERNAL_URL تلقائياً)
const PUBLIC_URL = String(process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
const HOSTED = !!(PUBLIC_URL || process.env.RENDER || process.env.RAILWAY_ENVIRONMENT || process.env.FLY_APP_NAME);

if (!config.adminPassword || process.env.ADMIN_PASSWORD_RESET === '1') {
  let pw = process.env.ADMIN_PASSWORD;
  let note;
  if (pw) note = 'تم ضبط كلمة مرور اللوحة من المتغير ADMIN_PASSWORD';
  else if (HOSTED) {
    // على الإنترنت لا نستخدم كلمة مرور معروفة أبداً
    pw = crypto.randomBytes(9).toString('base64url');
    note = `كلمة مرور اللوحة (مولّدة عشوائياً): ${pw}  — غيّرها من الإعدادات`;
  } else {
    pw = 'admin';
    note = 'تم إنشاء كلمة مرور افتراضية للوحة التحكم: admin  — غيّرها من الإعدادات.';
  }
  config.adminPassword = hashPassword(pw);
  configFile.flush();
  console.log('⚠  ' + note);
}

function mergeDefaults(def, val) {
  if (Array.isArray(def)) return Array.isArray(val) ? val : def.slice();
  if (def && typeof def === 'object') {
    const out = {};
    const v = val && typeof val === 'object' && !Array.isArray(val) ? val : {};
    for (const k of Object.keys(def)) out[k] = mergeDefaults(def[k], v[k]);
    for (const k of Object.keys(v)) if (!(k in out)) out[k] = v[k];
    return out;
  }
  return val === undefined ? def : val;
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  return { salt, hash };
}
function checkPassword(pw, rec) {
  if (!rec) return false;
  const h = crypto.scryptSync(String(pw || ''), rec.salt, 32);
  const r = Buffer.from(rec.hash, 'hex');
  return h.length === r.length && crypto.timingSafeEqual(h, r);
}

/* ============================== البيانات ============================== */

const employeesFile = new JsonFile('employees.json', { list: [] });
const messagesFile = new JsonFile('messages.json', { list: [] });
const eventsFile = new JsonFile('events.json', { list: [] });
const sessionsFile = new JsonFile('sessions.json', { tokens: {} });

const employees = () => employeesFile.data.list;
const empById = (id) => employees().find((e) => e.id === id);
const messages = () => messagesFile.data.list;
const msgIndex = new Map();
for (const m of messages()) msgIndex.set(m.id, m);

const MAX_MESSAGES = 3000;
const MAX_EVENTS = 1500;

const TYPES = ['toast', 'banner', 'modal', 'alert', 'violation', 'reply', 'choice', 'system', 'window'];
const ACTION_TYPES = new Set(['modal', 'alert', 'violation', 'reply', 'choice', 'window']);
const RANK = { queued: 0, delivered: 1, displayed: 2, read: 3, replied: 3, cancelled: 3 };
const ACTIVITIES = ['meta', 'work', 'youtube', 'social', 'other', 'browser', 'outside', 'idle', 'locked', 'offline'];

const now = () => Date.now();
const uid = (n = 8) => crypto.randomBytes(n).toString('hex');
const str = (v, max = 500) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do {
    c = Array.from(crypto.randomBytes(6), (b) => A[b % A.length]).join('');
  } while (employees().some((e) => e.code === c));
  return c;
}

/* ============================== الوقت ============================== */

const pad = (n) => String(n).padStart(2, '0');
function dateKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dayStart(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function dayStartOfKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}
function hm(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
  return m ? Math.min(23, +m[1]) * 60 + Math.min(59, +m[2]) : null;
}
function minuteOfDay(ts) {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}
function inWorkHours(ts) {
  const s = hm(config.workStart);
  const e = hm(config.workEnd);
  if (s == null || e == null || s === e) return true;
  const m = minuteOfDay(ts);
  return s < e ? m >= s && m < e : m >= s || m < e;
}
/** فترات الدوام داخل يوم معين (لقصّ وقت "غير متصل" عليها) */
function workWindows(dayKey) {
  const base = dayStartOfKey(dayKey);
  const s = hm(config.workStart);
  const e = hm(config.workEnd);
  const DAY = 86400000;
  if (s == null || e == null || s === e) return [[base, base + DAY]];
  if (s < e) return [[base + s * 60000, base + e * 60000]];
  return [
    [base, base + e * 60000],
    [base + s * 60000, base + DAY],
  ];
}
function overlap(a1, a2, b1, b2) {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

/* ============================== سجل النشاط اليومي ============================== */

const dayCache = new Map(); // key -> JsonFile
function dayFile(key) {
  let f = dayCache.get(key);
  if (!f) {
    f = new JsonFile(path.join('activity', key + '.json'), { date: key, emps: {} });
    dayCache.set(key, f);
    if (dayCache.size > 8) {
      const oldest = dayCache.keys().next().value;
      if (oldest !== key) {
        dayCache.get(oldest).close();
        dayCache.delete(oldest);
      }
    }
  }
  return f;
}
function dayEmp(key, empId) {
  const f = dayFile(key);
  let d = f.data.emps[empId];
  if (!d) d = f.data.emps[empId] = { segs: [], sends: 0, first: null, last: null, unreadWaits: [] };
  return { f, d };
}

/** إضافة مقطع نشاط [النوع، البداية، النهاية، الموقع، السبب] مع تقسيمه عند منتصف الليل */
function appendSegment(empId, act, s, e, host, reason) {
  if (!(e > s)) return;
  while (s < e) {
    const key = dateKey(s);
    const end = Math.min(e, dayStart(s) + 86400000);
    if (end - s >= 1000) {
      const { f, d } = dayEmp(key, empId);
      const seg = [act, s, end];
      if (host || reason) seg.push(host || '');
      if (reason) seg.push(reason);
      d.segs.push(seg);
      f.save();
    }
    s = end;
  }
}

function touchDay(empId, ts) {
  if (!empById(empId)) return;
  const { f, d } = dayEmp(dateKey(ts), empId);
  if (!d.first) d.first = ts;
  d.last = ts;
  f.save(5000);
}

/* ============================== الحالة الحيّة ============================== */

const SERVER_START = now();
const live = new Map();

function getLive(empId) {
  let L = live.get(empId);
  if (!L) {
    L = {
      ws: null,
      online: false,
      connectedAt: null,
      lastSeen: null,
      focused: false,
      idle: 'active',
      scheme: '',
      host: '',
      path: '',
      title: '',
      cat: 'other',
      ytAudible: false,
      activity: 'offline',
      activitySince: SERVER_START,
      segStart: SERVER_START,
      segHost: '',
      segReason: 'unknown',
      offlineReason: 'unknown',
      metaUnread: 0,
      metaUnreadSince: null,
      lastMetaSend: null,
      version: '',
      skew: 0,
      fired: {},
      lastBroadcast: 0,
      broadcastTimer: null,
    };
    live.set(empId, L);
  }
  return L;
}

function matchRule(rule, host, pathname) {
  let r = String(rule || '').trim().toLowerCase();
  r = r.replace(/^[a-z]+:\/\//, '').replace(/^\*\./, '').replace(/^www\./, '');
  if (!r) return false;
  const i = r.indexOf('/');
  const rHost = i >= 0 ? r.slice(0, i) : r;
  const rPath = i >= 0 ? r.slice(i) : '';
  const h = host.replace(/^www\./, '');
  if (!(h === rHost || h.endsWith('.' + rHost))) return false;
  return !rPath || (pathname || '/').toLowerCase().startsWith(rPath);
}

function classify(scheme, host, pathname) {
  if (!host || !/^https?$/.test(scheme || '')) return 'browser';
  for (const cat of ['meta', 'work', 'youtube', 'social']) {
    const list = config.categories[cat] || [];
    if (list.some((r) => matchRule(r, host, pathname))) return cat;
  }
  return 'other';
}

function activityOf(L) {
  if (!L.online) return 'offline';
  if (L.idle === 'locked') return 'locked';
  if (L.focused) {
    if (L.cat === 'youtube') return 'youtube'; // مشاهدة فيديو بدون لمس الماوس تُحسب يوتيوب
    if (L.idle === 'idle') return 'idle';
    return L.cat;
  }
  if (L.ytAudible) return 'youtube'; // يوتيوب يعمل في الخلفية وهو خارج المتصفح
  return L.idle === 'idle' ? 'idle' : 'outside';
}

const NO_HOST = new Set(['offline', 'outside', 'idle', 'locked']);

function recompute(empId, at = now()) {
  const L = getLive(empId);
  const act = activityOf(L);
  const host = NO_HOST.has(act) ? '' : L.host || '';
  const reason = act === 'offline' ? L.offlineReason : '';
  if (act === L.activity && host === L.segHost) return false;
  appendSegment(empId, L.activity, L.segStart, at, L.segHost, L.activity === 'offline' ? L.segReason : '');
  if (act !== L.activity) {
    L.activitySince = at;
    L.fired = {};
  }
  L.activity = act;
  L.segStart = at;
  L.segHost = host;
  L.segReason = reason;
  return true;
}

/* ============================== الإحصائيات ============================== */

function totalsFor(empId, key) {
  const totals = Object.fromEntries(ACTIVITIES.map((a) => [a, 0]));
  const hosts = {};
  const f = dayFile(key);
  const d = f.data.emps[empId];
  const segs = d ? d.segs.slice() : [];
  // المقطع المفتوح حالياً
  if (key === dateKey(now())) {
    const L = live.get(empId);
    if (L && L.segStart < now()) {
      const s = Math.max(L.segStart, dayStartOfKey(key));
      const seg = [L.activity, s, now(), L.segHost];
      if (L.activity === 'offline') seg.push(L.segReason);
      segs.push(seg);
    }
  }
  const wins = workWindows(key);
  for (const [a, s, e, h] of segs) {
    let dur;
    if (a === 'offline') {
      dur = wins.reduce((acc, [ws, we]) => acc + overlap(s, Math.min(e, now()), ws, we), 0);
    } else dur = e - s;
    if (!(a in totals)) continue;
    totals[a] += Math.round(dur / 1000);
    if (h && !NO_HOST.has(a)) hosts[h] = (hosts[h] || 0) + Math.round(dur / 1000);
  }
  return { totals, hosts, segs, day: d || null };
}

function responseStats(empId, key) {
  const from = key ? dayStartOfKey(key) : 0;
  const to = key ? from + 86400000 : Infinity;
  let sum = 0;
  let count = 0;
  let max = 0;
  let pending = 0;
  let sent = 0;
  let violations = 0;
  let alerts = 0;
  for (const m of messages()) {
    if (m.createdAt < from || m.createdAt >= to) continue;
    const r = m.recipients[empId];
    if (!r) continue;
    sent++;
    if (m.type === 'violation') violations++;
    if (m.type === 'alert') alerts++;
    if (!ACTION_TYPES.has(m.type) || r.status === 'cancelled') continue;
    if (RANK[r.status] < 3) {
      pending++;
      continue;
    }
    if (typeof r.respMs === 'number' && r.respMs >= 0) {
      sum += r.respMs;
      count++;
      max = Math.max(max, r.respMs);
    }
  }
  return { avg: count ? Math.round(sum / count) : null, count, max, pending, sent, violations, alerts };
}

function pendingFor(empId) {
  let n = 0;
  for (const m of messages()) {
    const r = m.recipients[empId];
    if (r && ACTION_TYPES.has(m.type) && RANK[r.status] < 3) n++;
  }
  return n;
}

function empView(e) {
  const L = getLive(e.id);
  const key = dateKey(now());
  const { totals, day } = totalsFor(e.id, key);
  const resp = responseStats(e.id, key);
  const waits = (day && day.unreadWaits) || [];
  return {
    id: e.id,
    name: e.name,
    code: e.code,
    createdAt: e.createdAt,
    online: L.online,
    activity: L.activity,
    activitySince: L.activitySince,
    focused: L.focused,
    idle: L.idle,
    host: L.host,
    title: L.title,
    cat: L.cat,
    ytAudible: L.ytAudible,
    offlineReason: L.offlineReason,
    lastSeen: L.lastSeen,
    connectedAt: L.connectedAt,
    version: L.version,
    metaUnread: L.metaUnread,
    metaUnreadSince: L.metaUnreadSince,
    lastMetaSend: L.lastMetaSend,
    pending: pendingFor(e.id),
    today: {
      totals,
      sends: day ? day.sends : 0,
      first: day ? day.first : null,
      last: day ? day.last : null,
      resp,
      unreadAvg: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null,
      unreadCount: waits.length,
    },
  };
}

/* ============================== الأحداث (تنبيهات المدير) ============================== */

function logEvent(kind, empId, text, extra = {}) {
  const ev = { id: uid(6), at: now(), kind, empId: empId || null, text: str(text, 2000), ...extra };
  const list = eventsFile.data.list;
  list.push(ev);
  if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
  eventsFile.save();
  broadcastAdmin({ t: 'event', ev });
  return ev;
}

/* ============================== البث ============================== */

const admins = new Set();
function wsSend(ws, obj) {
  if (ws && ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(obj));
    } catch {}
  }
}
function broadcastAdmin(obj) {
  const s = JSON.stringify(obj);
  for (const ws of admins) if (ws.readyState === 1) ws.send(s);
}
function broadcastEmp(empId, immediate = false) {
  const L = getLive(empId);
  const e = empById(empId);
  if (!e) return;
  const fire = () => {
    L.broadcastTimer = null;
    L.lastBroadcast = now();
    broadcastAdmin({ t: 'emp', emp: empView(e) });
  };
  if (immediate || now() - L.lastBroadcast > 400) {
    if (L.broadcastTimer) clearTimeout(L.broadcastTimer);
    fire();
  } else if (!L.broadcastTimer) {
    L.broadcastTimer = setTimeout(fire, 400);
  }
}
function broadcastMsg(m) {
  broadcastAdmin({ t: 'msg', msg: m });
}

/* ============================== الرسائل ============================== */

function publicMsg(m) {
  return {
    id: m.id,
    type: m.type,
    title: m.title,
    body: m.body,
    options: m.options,
    createdAt: m.createdAt,
    from: config.senderName,
  };
}

function sanitizeOptions(type, o = {}) {
  const defSound = { alert: 'alarm', violation: 'alarm', reply: 'bell', choice: 'bell', modal: 'bell', window: 'bell' }[type] || 'soft';
  const out = {
    sound: ['none', 'soft', 'bell', 'alarm'].includes(o.sound) ? o.sound : defSound,
    os: !!o.os,
    speak: !!o.speak,
    color: ['blue', 'green', 'orange', 'red', 'purple'].includes(o.color) ? o.color : undefined,
  };
  if (type === 'toast') {
    out.position = ['tl', 'tr', 'bl', 'br'].includes(o.position) ? o.position : 'tl';
    out.duration = Math.min(300, Math.max(3, parseInt(o.duration, 10) || 12));
  }
  if (type === 'alert') out.repeat = o.repeat !== false;
  if (type === 'choice') {
    let ch = Array.isArray(o.choices) ? o.choices : String(o.choices || '').split(/[\n,،]/);
    ch = ch.map((c) => str(c, 60).trim()).filter(Boolean).slice(0, 6);
    out.choices = ch.length >= 1 ? ch : ['نعم', 'لا'];
  }
  if (type === 'violation') {
    out.ref = str(o.ref, 40).trim();
    out.penalty = str(o.penalty, 200).trim();
  }
  if (type === 'reply') out.placeholder = str(o.placeholder, 120);
  return out;
}

function createMessage({ to, type, title, body, options, source = 'manual', rule = null }) {
  type = TYPES.includes(type) ? type : 'toast';
  const opts = sanitizeOptions(type, options);
  if (type === 'violation' && !opts.ref) {
    config.violationCounter = (config.violationCounter || 0) + 1;
    configFile.save();
    opts.ref = `V-${dateKey(now()).replace(/-/g, '')}-${String(config.violationCounter).padStart(3, '0')}`;
  }
  const m = {
    id: uid(8),
    createdAt: now(),
    type,
    title: str(title, 200).trim(),
    body: str(body, 5000).trim(),
    options: opts,
    source,
    rule,
    recipients: {},
  };
  for (const id of to) m.recipients[id] = { status: 'queued' };
  const list = messages();
  list.push(m);
  msgIndex.set(m.id, m);
  if (list.length > MAX_MESSAGES) {
    const removed = list.splice(0, list.length - MAX_MESSAGES);
    for (const r of removed) msgIndex.delete(r.id);
  }
  messagesFile.save();
  broadcastMsg(m);
  for (const id of to) {
    const L = getLive(id);
    if (L.online) wsSend(L.ws, { t: 'notify', msg: publicMsg(m) });
    broadcastEmp(id);
  }
  return m;
}

function deliverPending(empId) {
  const L = getLive(empId);
  const t = now();
  for (const m of messages()) {
    const r = m.recipients[empId];
    if (!r || RANK[r.status] >= 3) continue;
    const age = t - m.createdAt;
    if (ACTION_TYPES.has(m.type)) {
      if (age > 3 * 86400000) continue;
    } else if (r.status !== 'queued' || age > 2 * 3600000) continue;
    wsSend(L.ws, { t: 'notify', msg: publicMsg(m) });
  }
}

function clientTime(L, at) {
  const t = now();
  if (typeof at !== 'number' || !isFinite(at)) return t;
  const v = at + (L.skew || 0);
  return Math.min(t, Math.max(t - 7 * 86400000, v));
}

function applyStatus(empId, L, m) {
  const msg = msgIndex.get(str(m.id, 40));
  if (!msg) return;
  const r = msg.recipients[empId];
  if (!r || r.status === 'cancelled') return;
  const st = m.status;
  if (!(st in RANK) || st === 'queued' || st === 'cancelled') return;
  if (RANK[st] < RANK[r.status] || (RANK[st] === RANK[r.status] && RANK[st] < 3)) return;
  if (RANK[r.status] >= 3) return; // تمت الإجابة مسبقاً
  const at = clientTime(L, m.at);
  if (!r.deliveredAt) r.deliveredAt = at;
  if (st !== 'delivered' && !r.displayedAt) r.displayedAt = at;
  if (RANK[st] === 3) {
    r.respondedAt = at;
    r.respMs = Math.max(0, at - (r.displayedAt || at));
    if (m.reply) r.reply = str(m.reply, 4000).trim();
    if (m.choice) r.choice = str(m.choice, 200).trim();
  }
  r.status = st;
  messagesFile.save();
  broadcastMsg(msg);
  broadcastEmp(empId);
  const e = empById(empId);
  const name = e ? e.name : '';
  if (st === 'replied') {
    const txt = r.choice ? `اختار: «${r.choice}»` + (r.reply ? ` — ${r.reply}` : '') : r.reply || '';
    logEvent('reply', empId, txt, { msgId: msg.id, title: msg.title, msgType: msg.type, respMs: r.respMs, name });
  } else if (st === 'read' && (msg.type === 'alert' || msg.type === 'violation')) {
    logEvent('ack', empId, `أقرّ باستلام ${msg.type === 'alert' ? 'الإنذار' : 'المخالفة'}: ${msg.title}`, { msgId: msg.id, respMs: r.respMs, name });
  }
}

/* ============================== Express ============================== */

const app = express();
app.disable('x-powered-by');
if (HOSTED) app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(express.json({ limit: '1mb' }));

/** حماية بسيطة من التخمين: عدد المحاولات الفاشلة لكل عنوان IP */
const failures = new Map();
function tooManyFailures(key, limit) {
  const f = failures.get(key);
  if (!f) return false;
  if (now() - f.first > 15 * 60000) {
    failures.delete(key);
    return false;
  }
  return f.n >= limit;
}
function addFailure(key) {
  const f = failures.get(key);
  if (!f || now() - f.first > 15 * 60000) failures.set(key, { n: 1, first: now() });
  else f.n++;
  if (failures.size > 5000) failures.clear();
}
function clientIp(req) {
  if (HOSTED) {
    const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xf) return xf;
  }
  return req.socket.remoteAddress || '';
}

function makeToken() {
  const t = uid(24);
  sessionsFile.data.tokens[t] = { createdAt: now(), lastUsed: now() };
  sessionsFile.save();
  return t;
}
function validToken(t) {
  if (!t) return false;
  const s = sessionsFile.data.tokens[t];
  if (!s) return false;
  if (now() - s.lastUsed > 30 * 86400000) {
    delete sessionsFile.data.tokens[t];
    sessionsFile.save();
    return false;
  }
  if (now() - s.lastUsed > 60000) {
    s.lastUsed = now();
    sessionsFile.save(10000);
  }
  return true;
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!validToken(t)) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.post('/api/login', (req, res) => {
  const pw = req.body && req.body.password;
  const key = 'login:' + clientIp(req);
  if (tooManyFailures(key, 10)) return res.status(429).json({ error: 'محاولات كثيرة خاطئة، حاول بعد 15 دقيقة' });
  const f = failures.get(key);
  const delay = Math.min(3000, (f ? f.n : 0) * 300);
  setTimeout(() => {
    if (!checkPassword(pw, config.adminPassword)) {
      addFailure(key);
      return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    }
    failures.delete(key);
    res.json({ token: makeToken() });
  }, delay);
});

app.post('/api/logout', auth, (req, res) => {
  const t = (req.headers.authorization || '').slice(7);
  delete sessionsFile.data.tokens[t];
  sessionsFile.save();
  res.json({ ok: true });
});

function publicSettings() {
  const { adminPassword, port, violationCounter, ...rest } = config;
  return rest;
}

function serverAddresses() {
  if (PUBLIC_URL) return [PUBLIC_URL];
  const port = server.address() ? server.address().port : PORT;
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) out.push(`http://${a.address}:${port}`);
    }
  }
  out.push(`http://localhost:${port}`);
  return out;
}

app.get('/api/state', auth, (req, res) => {
  const recent = messages().slice(-300);
  res.json({
    employees: employees().map(empView),
    messages: recent,
    events: eventsFile.data.list.slice(-200),
    settings: publicSettings(),
    addresses: serverAddresses(),
    serverTime: now(),
  });
});

/* ---- الموظفون ---- */
app.post('/api/employees', auth, (req, res) => {
  const name = str(req.body && req.body.name, 60).trim();
  if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });
  const e = { id: uid(5), name, code: newCode(), createdAt: now() };
  employees().push(e);
  employeesFile.save(100);
  getLive(e.id);
  broadcastEmp(e.id, true);
  res.json(empView(e));
});

app.patch('/api/employees/:id', auth, (req, res) => {
  const e = empById(req.params.id);
  if (!e) return res.status(404).json({ error: 'غير موجود' });
  const b = req.body || {};
  if (b.name) e.name = str(b.name, 60).trim() || e.name;
  if (b.regenCode) {
    e.code = newCode();
    const L = getLive(e.id);
    if (L.ws) L.ws.close(4401, 'code changed');
  }
  employeesFile.save(100);
  broadcastEmp(e.id, true);
  res.json(empView(e));
});

app.delete('/api/employees/:id', auth, (req, res) => {
  const list = employees();
  const i = list.findIndex((e) => e.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'غير موجود' });
  const [e] = list.splice(i, 1);
  employeesFile.save(100);
  const L = live.get(e.id);
  if (L && L.ws) L.ws.close(4401, 'removed');
  live.delete(e.id);
  broadcastAdmin({ t: 'empRemoved', id: e.id });
  res.json({ ok: true });
});

/* ---- الرسائل ---- */
app.post('/api/messages', auth, (req, res) => {
  const b = req.body || {};
  let to;
  if (b.to === 'all') to = employees().map((e) => e.id);
  else if (b.to === 'online') to = employees().filter((e) => getLive(e.id).online).map((e) => e.id);
  else to = Array.isArray(b.to) ? [...new Set(b.to)].filter((id) => empById(id)) : [];
  if (!to.length) return res.status(400).json({ error: 'اختر موظفاً واحداً على الأقل' });
  if (!str(b.title).trim() && !str(b.body).trim()) return res.status(400).json({ error: 'اكتب عنواناً أو نص الرسالة' });
  const m = createMessage({ to, type: b.type, title: b.title, body: b.body, options: b.options });
  res.json(m);
});

app.post('/api/messages/:id/cancel', auth, (req, res) => {
  const m = msgIndex.get(req.params.id);
  if (!m) return res.status(404).json({ error: 'غير موجود' });
  for (const [empId, r] of Object.entries(m.recipients)) {
    if (RANK[r.status] < 3) {
      r.status = 'cancelled';
      r.cancelledAt = now();
      wsSend(getLive(empId).ws, { t: 'cancel', id: m.id });
      broadcastEmp(empId);
    }
  }
  messagesFile.save();
  broadcastMsg(m);
  res.json(m);
});

app.post('/api/messages/:id/remind', auth, (req, res) => {
  const m = msgIndex.get(req.params.id);
  if (!m) return res.status(404).json({ error: 'غير موجود' });
  let n = 0;
  for (const [empId, r] of Object.entries(m.recipients)) {
    if (RANK[r.status] < 3) {
      const L = getLive(empId);
      if (L.online) {
        wsSend(L.ws, { t: 'notify', msg: publicMsg(m) });
        wsSend(L.ws, { t: 'remind', id: m.id });
        n++;
      }
    }
  }
  res.json({ ok: true, reminded: n });
});

/* ---- التقارير ---- */
app.get('/api/report', auth, (req, res) => {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : dateKey(now());
  const only = req.query.emp;
  const out = [];
  for (const e of employees()) {
    if (only && e.id !== only) continue;
    const { totals, hosts, segs, day } = totalsFor(e.id, key);
    const waits = (day && day.unreadWaits) || [];
    out.push({
      id: e.id,
      name: e.name,
      totals,
      topHosts: Object.entries(hosts).sort((a, b) => b[1] - a[1]).slice(0, 8),
      segs,
      sends: day ? day.sends : 0,
      first: day ? day.first : null,
      last: day ? day.last : null,
      resp: responseStats(e.id, key),
      unreadAvg: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null,
      unreadCount: waits.length,
    });
  }
  res.json({ date: key, workStart: config.workStart, workEnd: config.workEnd, windows: workWindows(key), employees: out });
});

/* ---- الإعدادات ---- */
app.get('/api/settings', auth, (req, res) => res.json(publicSettings()));

app.put('/api/settings', auth, (req, res) => {
  const b = req.body || {};
  if (b.senderName !== undefined) config.senderName = str(b.senderName, 60).trim() || 'الإدارة';
  if (b.idleSeconds !== undefined) config.idleSeconds = Math.min(3600, Math.max(15, parseInt(b.idleSeconds, 10) || 120));
  if (b.workStart !== undefined && hm(b.workStart) != null) config.workStart = b.workStart;
  if (b.workEnd !== undefined && hm(b.workEnd) != null) config.workEnd = b.workEnd;
  if (b.categories && typeof b.categories === 'object') {
    for (const k of ['meta', 'work', 'youtube', 'social']) {
      if (Array.isArray(b.categories[k])) {
        config.categories[k] = b.categories[k].map((x) => str(x, 200).trim()).filter(Boolean).slice(0, 200);
      }
    }
  }
  if (b.rules && typeof b.rules === 'object') {
    for (const [k, def] of Object.entries(DEFAULT_CONFIG.rules)) {
      const v = b.rules[k];
      if (!v || typeof v !== 'object') continue;
      const r = config.rules[k] || { ...def };
      if ('enabled' in v) r.enabled = !!v.enabled;
      if ('minutes' in v) r.minutes = Math.min(600, Math.max(1, parseInt(v.minutes, 10) || def.minutes));
      if ('action' in def && 'action' in v) r.action = ['none', 'toast', 'banner', 'modal', 'alert', 'system'].includes(v.action) ? v.action : 'none';
      if ('text' in def && 'text' in v) r.text = str(v.text, 500);
      if ('remind' in def && 'remind' in v) r.remind = !!v.remind;
      if ('maxReminders' in def && 'maxReminders' in v) r.maxReminders = Math.min(10, Math.max(1, parseInt(v.maxReminders, 10) || 3));
      config.rules[k] = r;
    }
  }
  if (Array.isArray(b.templates)) {
    config.templates = b.templates
      .filter((t) => t && TYPES.includes(t.type))
      .slice(0, 50)
      .map((t) => ({ type: t.type, title: str(t.title, 200), body: str(t.body, 2000), options: t.options && typeof t.options === 'object' ? t.options : undefined }));
  }
  configFile.save(100);
  // إعادة تصنيف الحالات الحالية حسب القواعد الجديدة
  for (const e of employees()) {
    const L = getLive(e.id);
    L.cat = classify(L.scheme, L.host, L.path);
    recompute(e.id);
    if (L.online) wsSend(L.ws, { t: 'settings', settings: agentSettings() });
    broadcastEmp(e.id, true);
  }
  broadcastAdmin({ t: 'settings', settings: publicSettings() });
  res.json(publicSettings());
});

app.post('/api/password', auth, (req, res) => {
  const b = req.body || {};
  if (!checkPassword(b.current, config.adminPassword)) return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  if (!b.next || String(b.next).length < 4) return res.status(400).json({ error: 'كلمة المرور الجديدة قصيرة جداً (4 أحرف على الأقل)' });
  config.adminPassword = hashPassword(b.next);
  configFile.flush();
  res.json({ ok: true });
});

app.post('/api/events/clear', auth, (req, res) => {
  eventsFile.data.list = [];
  eventsFile.save(100);
  broadcastAdmin({ t: 'eventsCleared' });
  res.json({ ok: true });
});

app.get('/api/ping', (req, res) => res.json({ ok: true, time: now() }));

// ملفات الإضافة المستخدمة في معاينة الإشعارات داخل اللوحة
const EXT_DIR = path.join(__dirname, '..', 'extension');
app.get('/ext/ui.js', (req, res) => res.sendFile(path.join(EXT_DIR, 'ui.js')));
app.get('/ext/sounds.js', (req, res) => res.sendFile(path.join(EXT_DIR, 'sounds.js')));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

/* ============================== WebSocket ============================== */

const PORT = parseInt(process.env.PORT, 10) || config.port || 3000;
const server = http.createServer(app);
const wssAgent = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
const wssAdmin = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

function agentSettings() {
  return { idleSeconds: config.idleSeconds, from: config.senderName };
}

server.on('upgrade', (req, socket, head) => {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    socket.destroy();
    return;
  }
  if (url.pathname === '/ws/agent') {
    const code = str(url.searchParams.get('code'), 20).trim().toUpperCase();
    const key = 'agent:' + clientIp(req);
    wssAgent.handleUpgrade(req, socket, head, (ws) => {
      if (tooManyFailures(key, 30)) {
        ws.close(4429, 'too many attempts');
        return;
      }
      const e = employees().find((x) => x.code === code);
      if (!e) {
        addFailure(key);
        ws.close(4401, 'invalid code');
        return;
      }
      onAgent(ws, e);
    });
  } else if (url.pathname === '/ws/admin') {
    if (!validToken(url.searchParams.get('token'))) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wssAdmin.handleUpgrade(req, socket, head, (ws) => onAdmin(ws));
  } else {
    socket.destroy();
  }
});

function onAgent(ws, e) {
  const L = getLive(e.id);
  const t = now();
  if (L.ws && L.ws !== ws) {
    try {
      L.ws.close(4000, 'replaced');
    } catch {}
  }
  const wasOfflineFor = L.online ? 0 : t - (L.lastSeen || SERVER_START);
  L.ws = ws;
  L.online = true;
  L.connectedAt = t;
  L.lastSeen = t;
  L.offlineReason = null;
  ws.isAlive = true;
  ws.empId = e.id;
  touchDay(e.id, t);
  recompute(e.id, t);
  if (wasOfflineFor > 60000) logEvent('conn', e.id, 'اتصل بالنظام', { name: e.name });

  wsSend(ws, { t: 'welcome', name: e.name, settings: agentSettings(), serverTime: t });
  deliverPending(e.id);
  broadcastEmp(e.id, true);

  ws.on('pong', () => {
    ws.isAlive = true;
  });
  ws.on('message', (data) => {
    let m;
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    if (!m || typeof m !== 'object' || L.ws !== ws) return;
    ws.isAlive = true;
    L.lastSeen = now();
    handleAgent(e.id, L, ws, m);
  });
  ws.on('close', () => {
    if (L.ws !== ws) return;
    const t2 = now();
    L.ws = null;
    L.online = false;
    L.offlineReason = ws.timedOut ? 'timeout' : 'closed';
    L.lastSeen = t2;
    L.metaUnread = 0;
    L.metaUnreadSince = null;
    recompute(e.id, t2);
    const emp = empById(e.id);
    if (emp) {
      logEvent('disc', e.id, L.offlineReason === 'timeout' ? 'انقطع الاتصال (الإنترنت أو سكون الجهاز)' : 'أغلق المتصفح أو انقطع الاتصال', { name: emp.name });
      broadcastEmp(e.id, true);
    }
  });
}

function handleAgent(empId, L, ws, m) {
  const t = now();
  switch (m.t) {
    case 'hello':
      L.version = str(m.version, 20);
      if (typeof m.now === 'number') L.skew = t - m.now;
      broadcastEmp(empId);
      break;
    case 'ping':
      wsSend(ws, { t: 'pong', serverTime: t });
      touchDay(empId, t);
      break;
    case 'state': {
      L.focused = !!m.focused;
      L.idle = ['active', 'idle', 'locked'].includes(m.idle) ? m.idle : 'active';
      L.scheme = str(m.scheme, 30).toLowerCase();
      L.host = str(m.host, 200).toLowerCase();
      L.path = str(m.path, 300);
      L.title = str(m.title, 200);
      L.ytAudible = !!m.ytAudible;
      L.cat = classify(L.scheme, L.host, L.path);
      recompute(empId, t);
      touchDay(empId, t);
      broadcastEmp(empId);
      break;
    }
    case 'status':
      applyStatus(empId, L, m);
      break;
    case 'metaSend': {
      const { f, d } = dayEmp(dateKey(t), empId);
      d.sends = (d.sends || 0) + 1;
      f.save(5000);
      L.lastMetaSend = t;
      broadcastEmp(empId);
      break;
    }
    case 'metaUnread': {
      const c = Math.max(0, Math.min(9999, parseInt(m.count, 10) || 0));
      if (c > 0 && !L.metaUnread) L.metaUnreadSince = t;
      if (c === 0 && L.metaUnread && L.metaUnreadSince) {
        const { f, d } = dayEmp(dateKey(t), empId);
        (d.unreadWaits = d.unreadWaits || []).push(t - L.metaUnreadSince);
        f.save(5000);
        L.metaUnreadSince = null;
      }
      L.metaUnread = c;
      broadcastEmp(empId);
      break;
    }
    case 'offlineLog': {
      // الإضافة كانت تعمل لكن بدون إنترنت خلال هذه الفترة
      if (!m.net) break;
      const s = clientTime(L, m.s);
      const e = clientTime(L, m.e);
      for (const key of new Set([dateKey(s), dateKey(e)])) {
        const f = dayFile(key);
        const d = f.data.emps[empId];
        if (!d) continue;
        for (const seg of d.segs) {
          if (seg[0] === 'offline' && overlap(seg[1], seg[2], s - 60000, e + 60000) > 0) {
            seg[3] = seg[3] || '';
            seg[4] = 'net';
          }
        }
        f.save();
      }
      logEvent('net', empId, `كان بدون إنترنت لمدة ${Math.round((e - s) / 60000)} دقيقة`, { name: (empById(empId) || {}).name });
      break;
    }
    case 'toAdmin': {
      const text = str(m.text, 2000).trim();
      if (text) logEvent('empmsg', empId, text, { name: (empById(empId) || {}).name });
      break;
    }
  }
}

function onAdmin(ws) {
  admins.add(ws);
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  ws.on('message', (data) => {
    if (String(data) === 'ping') ws.send('pong');
  });
  ws.on('close', () => admins.delete(ws));
}

// فحص الاتصالات الميتة (انقطاع الإنترنت لا يغلق الاتصال فوراً)
setInterval(() => {
  for (const ws of [...wssAgent.clients, ...wssAdmin.clients]) {
    if (!ws.isAlive) {
      ws.timedOut = true;
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {}
  }
}, 20000);

/* ============================== القواعد التلقائية ============================== */

const RULE_LABEL = {
  youtube: 'على يوتيوب',
  social: 'على مواقع التواصل',
  outside: 'خارج المتصفح',
  idle: 'خامل بدون نشاط',
  offline: 'غير متصل',
};

function minutesText(n) {
  return n === 1 ? 'دقيقة' : n === 2 ? 'دقيقتين' : n <= 10 ? `${n} دقائق` : `${n} دقيقة`;
}

function runRules() {
  const t = now();
  const work = inWorkHours(t);
  for (const e of employees()) {
    const L = getLive(e.id);

    // 1) قواعد مدة النشاط (يوتيوب/تواصل/خارج المتصفح/خامل/غير متصل)
    if (work) {
      for (const key of ['youtube', 'social', 'outside', 'idle', 'offline']) {
        const rule = config.rules[key];
        if (!rule || !rule.enabled || L.activity !== key) continue;
        // "غير متصل" يُنبَّه عنه مرة واحدة يومياً لكل فترة انقطاع، والباقي مرة لكل فترة متصلة
        const tag = key === 'offline' ? dateKey(t) : true;
        if (L.fired[key] === tag) continue;
        const since = key === 'offline' ? Math.max(L.activitySince, todayWorkStart(t)) : L.activitySince;
        const mins = Math.floor((t - since) / 60000);
        if (mins < rule.minutes) continue;
        L.fired[key] = tag;
        logEvent('rule', e.id, `${RULE_LABEL[key]} منذ ${minutesText(mins)}`, { rule: key, name: e.name, level: key === 'youtube' || key === 'offline' ? 'high' : 'mid' });
        if (rule.action && rule.action !== 'none' && L.online && key !== 'offline') {
          createMessage({
            to: [e.id],
            type: rule.action,
            title: rule.action === 'alert' ? 'إنذار تلقائي' : 'تنبيه تلقائي',
            body: (rule.text || '').replace('{min}', mins),
            source: 'rule',
            rule: key,
          });
        }
      }
    }

    // 2) رسائل عملاء غير مقروءة في ميتا
    const ru = config.rules.metaUnread;
    if (ru && ru.enabled && L.online && L.metaUnread > 0 && L.metaUnreadSince) {
      const mins = Math.floor((t - L.metaUnreadSince) / 60000);
      if (mins >= ru.minutes && L.fired.metaUnreadAt !== L.metaUnreadSince) {
        L.fired.metaUnreadAt = L.metaUnreadSince;
        logEvent('rule', e.id, `${L.metaUnread} رسالة عملاء غير مقروءة منذ ${minutesText(mins)}`, { rule: 'metaUnread', name: e.name, level: 'high' });
        if (ru.action && ru.action !== 'none') {
          createMessage({ to: [e.id], type: ru.action, title: 'رسائل عملاء بانتظارك', body: (ru.text || '').replace('{min}', mins), source: 'rule', rule: 'metaUnread' });
        }
      }
    }
  }

  // 3) رسائل تتطلب رداً ولم يُرد عليها
  const nr = config.rules.noReply;
  if (nr && nr.enabled) {
    for (const m of messages()) {
      if (!ACTION_TYPES.has(m.type) || t - m.createdAt > 86400000) continue;
      for (const [empId, r] of Object.entries(m.recipients)) {
        if (RANK[r.status] >= 3 || !r.displayedAt) continue;
        const reminders = r.reminders || 0;
        const due = r.displayedAt + nr.minutes * 60000 * (reminders + 1);
        if (t < due) continue;
        if (reminders >= (nr.maxReminders || 3)) continue;
        r.reminders = reminders + 1;
        messagesFile.save();
        const e = empById(empId);
        if (!e) continue;
        if (reminders === 0) {
          logEvent('rule', empId, `لم يرد على «${m.title || 'رسالة'}» منذ ${minutesText(nr.minutes)}`, { rule: 'noReply', msgId: m.id, name: e.name, level: 'mid' });
        }
        const L = getLive(empId);
        if (nr.remind && L.online) {
          wsSend(L.ws, { t: 'notify', msg: publicMsg(m) });
          wsSend(L.ws, { t: 'remind', id: m.id, n: r.reminders });
        }
        broadcastMsg(m);
      }
    }
  }
}

function todayWorkStart(t) {
  const wins = workWindows(dateKey(t));
  for (const [s, e] of wins) if (t >= s && t < e) return s;
  return dayStart(t);
}

setInterval(() => {
  try {
    runRules();
  } catch (e) {
    console.error('[rules]', e);
  }
}, 10000);

// تحديث دوري للوحة (عدادات اليوم)
setInterval(() => {
  for (const e of employees()) broadcastEmp(e.id);
}, 30000);

/* ============================== التشغيل ============================== */

for (const e of employees()) getLive(e.id);

function shutdown() {
  const t = now();
  for (const e of employees()) {
    const L = getLive(e.id);
    appendSegment(e.id, L.activity, L.segStart, t, L.segHost, L.activity === 'offline' ? L.segReason : '');
  }
  flushAll();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => {
  console.log('');
  console.log('  منظومة الإشعارات تعمل ✅');
  console.log('  مجلد البيانات: ' + DATA_DIR);
  console.log('  افتح لوحة التحكم من أحد العناوين:');
  for (const a of serverAddresses()) console.log('     ' + a);
  console.log('');
});
