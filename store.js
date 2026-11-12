'use strict';
/**
 * تخزين بسيط بملفات JSON (يكفي لعشرات الموظفين بدون قاعدة بيانات).
 * كل ملف يُحفظ بشكل مؤجل (throttle) وبكتابة ذرّية لتجنب تلف البيانات.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');

fs.mkdirSync(path.join(DATA_DIR, 'activity'), { recursive: true });

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  const text = JSON.stringify(data);
  const tmp = file + '.tmp';
  try {
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  } catch {
    // على ويندوز قد يفشل rename إذا كان الملف مفتوحاً من برنامج آخر
    fs.writeFileSync(file, text);
  }
}

const allFiles = new Set();

class JsonFile {
  constructor(relPath, fallback) {
    this.file = path.join(DATA_DIR, relPath);
    this.data = readJSON(this.file, fallback);
    this.timer = null;
    allFiles.add(this);
  }
  /** حفظ مؤجل: عدة تعديلات متتالية = كتابة واحدة */
  save(delay = 1500) {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), delay);
  }
  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    try {
      writeJSON(this.file, this.data);
    } catch (e) {
      console.error('[store] فشل الحفظ', this.file, e.message);
    }
  }
  close() {
    if (this.timer) this.flush();
    allFiles.delete(this);
  }
}

function flushAll() {
  for (const f of allFiles) if (f.timer) f.flush();
}

module.exports = { DATA_DIR, JsonFile, flushAll };
