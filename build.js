#!/usr/bin/env node
/**
 * يجهّز الملفات للرفع:
 *   node build.js                      ← بدون رابط افتراضي (الموظف يكتب الرابط والكود)
 *   node build.js https://xxx.onrender.com  ← يكتب رابط الداشبورد داخل الإضافة (الموظف يكتب الكود فقط)
 *
 * الناتج داخل مجلد «جاهز للرفع»:
 *   1- GitHub            ← ارفع محتوياته إلى مستودع GitHub
 *   2- Chrome Web Store  ← ملف zip الإضافة + الصور + نصوص صفحة المتجر
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'جاهز للرفع');
const OUT_GH = path.join(OUT, '1- GitHub');
const OUT_CWS = path.join(OUT, '2- Chrome Web Store');

const serverUrl = (process.argv[2] || '').trim().replace(/\/+$/, '');
if (serverUrl && !/^https?:\/\/[^\s/]+/i.test(serverUrl)) {
  console.error('❌ الرابط غير صحيح. مثال: node build.js https://my-dashboard.onrender.com');
  process.exit(1);
}

/* ---------------- أدوات ---------------- */
function listFiles(dir, base = dir, skip = () => false) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (skip(rel, name)) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...listFiles(full, base, skip));
    else out.push({ full, rel });
  }
  return out;
}
function copyTree(src, dst, skip) {
  for (const f of listFiles(src, src, skip)) {
    const to = path.join(dst, f.rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(f.full, to);
  }
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/** كاتب ZIP بسيط بدون مكتبات خارجية */
function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // أسماء UTF-8
    lh.writeUInt16LE(useDeflate ? 8 : 0, 8);
    lh.writeUInt16LE(dosTime, 10);
    lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(useDeflate ? 8 : 0, 10);
    ch.writeUInt16LE(dosTime, 12);
    ch.writeUInt16LE(dosDate, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/* ---------------- البناء ---------------- */
// نفرّغ المجلدات بدلاً من حذفها (ويندوز يمنع حذف مجلد مفتوح في مستكشف الملفات)
function removePath(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true, maxRetries: 3 });
  } catch (e) {
    // مجلد مقفول (مفتوح في برنامج آخر): نحذف ما بداخله ونترك المجلد نفسه فارغاً
    if (!fs.statSync(p).isDirectory()) throw e;
    for (const name of fs.readdirSync(p)) removePath(path.join(p, name));
  }
}
function emptyDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(dir)) removePath(path.join(dir, name));
}
emptyDir(OUT_GH);
emptyDir(OUT_CWS);

// 1) ملفات GitHub (بدون node_modules والبيانات)
const skipRepo = (rel, name) =>
  name === 'node_modules' ||
  name === '.git' ||
  rel === 'server/data' ||
  rel.startsWith('server/data/') ||
  rel === 'جاهز للرفع' ||
  rel.startsWith('جاهز للرفع/') ||
  rel === 'dist' ||
  /\.(zip|log)$/i.test(name);
copyTree(ROOT, OUT_GH, skipRepo);

// 2) ملف zip للإضافة
const EXT = path.join(ROOT, 'extension');
const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
const entries = listFiles(EXT, EXT, (rel, name) => name.startsWith('.') || /\.(zip|md)$/i.test(name)).map((f) => {
  let data = fs.readFileSync(f.full);
  if (f.rel === 'config.js' && serverUrl) {
    data = Buffer.from(String(data).replace(/defaultServer:\s*'[^']*'/, `defaultServer: '${serverUrl.replace(/'/g, '')}'`));
  }
  return { name: f.rel, data };
});
if (!entries.some((e) => e.name === 'manifest.json')) throw new Error('manifest.json مفقود');
const zipName = `notifications-extension-v${manifest.version}.zip`;
fs.writeFileSync(path.join(OUT_CWS, zipName), makeZip(entries));

// 3) صور ونصوص المتجر
const STORE = path.join(ROOT, 'store');
if (fs.existsSync(STORE)) copyTree(STORE, OUT_CWS, (rel, name) => name.startsWith('.'));

console.log('');
console.log('✅ تم التجهيز في: ' + OUT);
console.log('   1- GitHub            : ' + listFiles(OUT_GH).length + ' ملف');
console.log('   2- Chrome Web Store  : ' + zipName + ' (' + entries.length + ' ملف داخل الإضافة)');
console.log(serverUrl ? '   رابط الداشبورد داخل الإضافة: ' + serverUrl : '   بدون رابط افتراضي — لإضافته: node build.js https://رابط-الداشبورد');
console.log('');
