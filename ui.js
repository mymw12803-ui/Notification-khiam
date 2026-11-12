/**
 * واجهة عرض الإشعارات (مشتركة بين: صفحات الموظف، النافذة المستقلة، ومعاينة لوحة التحكم)
 * تُرسم داخل Shadow DOM حتى لا تتأثر بتنسيقات الموقع ولا تؤثر فيه.
 */
(function (root) {
  'use strict';
  if (root.NotifUI) return;

  const ICON = {
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    reply: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M13 8H7"/><path d="M17 12H7"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    window: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8h20"/><path d="M6 4v4"/><path d="M10 4v4"/>',
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  };

  const META = {
    toast: { label: 'إشعار', icon: 'bell', color: 'blue' },
    banner: { label: 'تنبيه', icon: 'megaphone', color: 'orange' },
    modal: { label: 'رسالة', icon: 'mail', color: 'blue' },
    alert: { label: 'إنذار', icon: 'alert', color: 'red' },
    violation: { label: 'إشعار مخالفة', icon: 'shield', color: 'red' },
    reply: { label: 'مطلوب رد', icon: 'reply', color: 'purple' },
    choice: { label: 'سؤال', icon: 'help', color: 'blue' },
    system: { label: 'إشعار', icon: 'monitor', color: 'blue' },
    window: { label: 'رسالة', icon: 'window', color: 'blue' },
  };
  const BLOCKING = new Set(['modal', 'alert', 'violation', 'reply', 'choice', 'window']);
  const PRIO = { alert: 3, violation: 2 };

  const CSS = `
:host{all:initial}
*{box-sizing:border-box;margin:0;padding:0}
.root{font-family:"Segoe UI",Tahoma,"Noto Sans Arabic","Noto Naskh Arabic",Arial,sans-serif;direction:rtl;color:#0f172a;font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
button{font:inherit;cursor:pointer;border:0;background:none;color:inherit}
textarea{font:inherit}
svg{width:1em;height:1em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.acc-blue{--a:#2563eb;--a2:#1d4ed8;--as:#dbeafe}
.acc-green{--a:#16a34a;--a2:#15803d;--as:#dcfce7}
.acc-orange{--a:#ea580c;--a2:#c2410c;--as:#ffedd5}
.acc-red{--a:#dc2626;--a2:#b91c1c;--as:#fee2e2}
.acc-purple{--a:#7c3aed;--a2:#6d28d9;--as:#ede9fe}

/* ===== إشعار جانبي ===== */
.stack{position:fixed;display:flex;flex-direction:column;gap:10px;width:380px;max-width:calc(100vw - 24px);z-index:3;pointer-events:none}
.stack.tl{top:calc(14px + var(--bh,0px));left:14px}.stack.tr{top:calc(14px + var(--bh,0px));right:14px}
.stack{transition:top .25s ease}
.stack.bl{bottom:14px;left:14px;flex-direction:column-reverse}.stack.br{bottom:14px;right:14px;flex-direction:column-reverse}
.toast{pointer-events:auto;position:relative;display:flex;gap:12px;align-items:flex-start;background:#fff;border-radius:14px;padding:14px 14px 16px;box-shadow:0 12px 32px rgba(15,23,42,.22),0 2px 6px rgba(15,23,42,.12);border-inline-start:5px solid var(--a);overflow:hidden;animation:tin .35s cubic-bezier(.2,.9,.3,1.2);cursor:pointer}
.stack.tr .toast,.stack.br .toast{animation-name:tinr}
@keyframes tin{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}
@keyframes tinr{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}
.toast.out{animation:tout .25s ease forwards}
@keyframes tout{to{opacity:0;transform:scale(.92)}}
.t-icon{width:38px;height:38px;border-radius:10px;background:var(--as);color:var(--a);display:grid;place-items:center;font-size:20px;flex:none}
.t-main{flex:1;min-width:0}
.t-head{display:flex;gap:8px;font-size:12px;color:#64748b}
.t-from{font-weight:700;color:var(--a)}
.t-title{font-weight:700;font-size:15px;color:#0f172a;margin-top:1px}
.t-body{font-size:14px;color:#334155;white-space:pre-wrap;word-break:break-word;max-height:160px;overflow:auto}
.t-close{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:#64748b;font-size:16px;flex:none}
.t-close:hover{background:#f1f5f9;color:#0f172a}
.t-progress{position:absolute;bottom:0;left:0;right:0;height:3px;background:#f1f5f9}
.t-progress i{display:block;height:100%;background:var(--a);transform-origin:left;animation:prog linear forwards}
.toast:hover .t-progress i{animation-play-state:paused}
@keyframes prog{from{transform:scaleX(1)}to{transform:scaleX(0)}}

/* ===== شريط علوي ===== */
.banners{position:fixed;top:0;left:0;right:0;z-index:4;display:flex;flex-direction:column;pointer-events:none}
.banner{pointer-events:auto;display:flex;align-items:center;gap:14px;padding:12px 20px;color:#fff;background:linear-gradient(90deg,var(--a2),var(--a));box-shadow:0 6px 20px rgba(0,0,0,.25);animation:bin .4s cubic-bezier(.2,.9,.3,1.1);border-bottom:1px solid rgba(255,255,255,.25)}
@keyframes bin{from{transform:translateY(-100%)}to{transform:none}}
.banner.out{animation:bout .25s ease forwards}
@keyframes bout{to{transform:translateY(-100%);opacity:0}}
.b-icon{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;font-size:19px;flex:none;animation:ring 1.4s ease 2}
.b-text{flex:1;min-width:0;font-size:15px}
.b-text b{font-weight:800;margin-inline-end:6px}
.b-text span{white-space:pre-wrap;word-break:break-word;opacity:.95}
.b-ok{background:#fff;color:var(--a2);font-weight:700;padding:7px 18px;border-radius:999px;font-size:14px;flex:none}
.b-ok:hover{filter:brightness(.95)}
.b-x{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-size:17px;flex:none;color:#fff;opacity:.85}
.b-x:hover{background:rgba(255,255,255,.18);opacity:1}

/* ===== النوافذ الوسطية ===== */
.overlay{position:fixed;inset:0;z-index:5;display:none;align-items:center;justify-content:center;padding:20px}
.overlay.on{display:flex}
.backdrop{position:absolute;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(3px);animation:fade .25s ease}
.overlay.t-alert .backdrop{background:radial-gradient(circle at center,rgba(220,38,38,.55),rgba(69,10,10,.92));animation:fade .25s ease,alertbg 1.2s ease-in-out infinite alternate}
.overlay.t-violation .backdrop{background:rgba(40,8,8,.7)}
@keyframes alertbg{from{opacity:.85}to{opacity:1}}
@keyframes fade{from{opacity:0}}
.page .backdrop{background:linear-gradient(135deg,#eef2ff,#f8fafc);backdrop-filter:none;animation:none}
.page .overlay.t-alert .backdrop{background:linear-gradient(135deg,#7f1d1d,#450a0a)}
.page .overlay.t-violation .backdrop{background:linear-gradient(135deg,#3f0d0d,#1c0606)}
.card{position:relative;width:520px;max-width:100%;max-height:calc(100vh - 40px);overflow:auto;background:#fff;border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.35);animation:pop .35s cubic-bezier(.2,.9,.3,1.25)}
@keyframes pop{from{opacity:0;transform:scale(.88) translateY(12px)}to{opacity:1;transform:none}}
.card.shake{animation:shake .6s ease}
@keyframes shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-8px)}40%,60%{transform:translateX(8px)}}
.c-band{height:6px;background:linear-gradient(90deg,var(--a2),var(--a))}
.c-in{padding:22px 24px 22px}
.c-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.c-icon{width:48px;height:48px;border-radius:14px;background:var(--as);color:var(--a);display:grid;place-items:center;font-size:25px;flex:none}
.c-meta{flex:1;min-width:0}
.c-label{font-weight:800;color:var(--a);font-size:14px}
.c-sub{font-size:12.5px;color:#64748b}
.c-count{font-size:12px;background:#f1f5f9;color:#475569;border-radius:999px;padding:3px 10px;font-weight:600;flex:none}
.c-remind{display:none;font-size:12px;background:#fef3c7;color:#92400e;border-radius:999px;padding:3px 10px;font-weight:700;flex:none}
.card.reminded .c-remind{display:inline-block}
.c-title{font-size:21px;font-weight:800;color:#0f172a;line-height:1.4;margin-bottom:6px}
.c-body{font-size:15.5px;color:#334155;white-space:pre-wrap;word-break:break-word;max-height:40vh;overflow:auto}
.c-actions{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 22px;border-radius:12px;font-weight:700;font-size:15px;transition:transform .08s,filter .15s,background .15s}
.btn:active{transform:scale(.97)}
.btn.primary{background:var(--a);color:#fff;flex:1;box-shadow:0 6px 16px color-mix(in srgb,var(--a) 35%,transparent)}
.btn.primary:hover{filter:brightness(1.08)}
.btn.primary:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
.btn.ghost{background:#f1f5f9;color:#334155}
.btn.ghost:hover{background:#e2e8f0}
.ta{width:100%;min-height:96px;margin-top:14px;padding:12px 14px;border:1.5px solid #cbd5e1;border-radius:12px;resize:vertical;font-size:15px;color:#0f172a;background:#f8fafc;outline:none;direction:rtl}
.ta:focus{border-color:var(--a);background:#fff;box-shadow:0 0 0 4px var(--as)}
.hint{font-size:12px;color:#94a3b8;margin-top:6px}
.choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:18px}
.choices .btn{border:2px solid var(--a);color:var(--a);background:#fff;padding:12px}
.choices .btn:hover{background:var(--a);color:#fff}

/* إنذار */
.card.type-alert{border:3px solid #ef4444}
.card.type-alert .c-icon{background:#dc2626;color:#fff;animation:pulse 1s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.6)}50%{box-shadow:0 0 0 14px rgba(220,38,38,0)}}
.alert-top{background:repeating-linear-gradient(-45deg,#dc2626 0 18px,#b91c1c 18px 36px);color:#fff;text-align:center;font-weight:900;font-size:22px;letter-spacing:1px;padding:10px;display:flex;align-items:center;justify-content:center;gap:10px}
.alert-top svg{font-size:26px;animation:ring 1s ease infinite}
@keyframes ring{0%,100%{transform:rotate(0)}20%{transform:rotate(-15deg)}40%{transform:rotate(12deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(5deg)}}

/* مخالفة */
.card.type-violation{border-radius:10px;background:#fffdf7}
.v-top{background:linear-gradient(90deg,#7f1d1d,#b91c1c);color:#fff;padding:14px 22px;display:flex;align-items:center;gap:12px}
.v-top svg{font-size:28px}
.v-top b{font-size:20px;font-weight:900;display:block}
.v-top small{opacity:.85;font-size:12.5px}
.v-grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #e7dcc5;border-radius:10px;overflow:hidden;margin:4px 0 14px}
.v-grid div{padding:8px 12px;border-inline-start:1px solid #e7dcc5}
.v-grid div:first-child{border-inline-start:0}
.v-grid small{display:block;font-size:11.5px;color:#92400e;font-weight:700}
.v-grid span{font-weight:700;font-size:14px;color:#1c1917;word-break:break-word}
.v-reason{font-size:12.5px;color:#92400e;font-weight:700;margin-bottom:2px}
.v-stamp{position:absolute;top:84px;left:22px;border:3px solid rgba(185,28,28,.55);color:rgba(185,28,28,.6);font-weight:900;font-size:18px;padding:2px 12px;border-radius:8px;transform:rotate(-14deg);pointer-events:none}

/* معاينة إشعار ويندوز */
.winnotif{position:fixed;bottom:16px;right:16px;width:364px;max-width:calc(100vw - 32px);background:#202020;color:#fff;border-radius:10px;padding:12px 14px 14px;box-shadow:0 18px 40px rgba(0,0,0,.45);border:1px solid #3a3a3a;animation:winin .35s ease;direction:ltr;z-index:6}
@keyframes winin{from{transform:translateX(110%)}to{transform:none}}
.wn-app{display:flex;align-items:center;gap:8px;font-size:12px;color:#c8c8c8}
.wn-app i{width:16px;height:16px;border-radius:50%;background:conic-gradient(#ea4335 0 33%,#fbbc05 0 66%,#34a853 0);display:inline-block}
.wn-app .x{margin-left:auto;cursor:pointer;color:#aaa}
.wn-row{display:flex;gap:12px;margin-top:10px;direction:rtl;align-items:flex-start}
.wn-ic{width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#2563eb,#7c3aed);display:grid;place-items:center;font-size:22px;flex:none}
.wn-row b{display:block;font-size:14px}
.wn-row p{font-size:13px;color:#d4d4d4;white-space:pre-wrap;word-break:break-word}
.wn-sub{font-size:11.5px;color:#9a9a9a;margin-top:4px}
`;

  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICON[name] || ICON.bell) + '</svg>';
  }
  function el(doc, tag, cls, text) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fmtTime(ts) {
    try {
      return new Date(ts || Date.now()).toLocaleTimeString('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  }
  function fmtDate(ts) {
    try {
      return new Date(ts || Date.now()).toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return '';
    }
  }
  function accent(msg) {
    const c = (msg.options && msg.options.color) || (META[msg.type] || META.toast).color;
    return 'acc-' + c;
  }

  /* ------------------------------------------------------------------ */

  function mount(doc, opts) {
    doc = doc || document;
    opts = opts || {};
    const old = doc.getElementById('__notif_ui_host__');
    if (old) old.remove();
    const host = doc.createElement('div');
    host.id = '__notif_ui_host__';
    host.setAttribute('style', 'all:initial !important;position:fixed !important;top:0 !important;left:0 !important;width:0 !important;height:0 !important;z-index:2147483647 !important;display:block !important;');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = el(doc, 'style');
    style.textContent = CSS;
    shadow.appendChild(style);
    const rootEl = el(doc, 'div', 'root' + (opts.mode === 'page' ? ' page' : ''));
    rootEl.setAttribute('dir', 'rtl');
    const stacks = {};
    for (const p of ['tl', 'tr', 'bl', 'br']) {
      stacks[p] = el(doc, 'div', 'stack ' + p);
      rootEl.appendChild(stacks[p]);
    }
    const banners = el(doc, 'div', 'banners');
    const overlay = el(doc, 'div', 'overlay');
    const backdrop = el(doc, 'div', 'backdrop');
    const center = el(doc, 'div', 'center');
    center.style.position = 'relative';
    center.style.width = '100%';
    center.style.display = 'flex';
    center.style.justifyContent = 'center';
    overlay.append(backdrop, center);
    rootEl.append(banners, overlay);
    shadow.appendChild(rootEl);

    // منع اختصارات لوحة المفاتيح في الموقع من التقاط ما يكتبه الموظف داخل الإشعار
    for (const ev of ['keydown', 'keyup', 'keypress', 'input', 'paste', 'copy', 'cut']) {
      rootEl.addEventListener(ev, (e) => e.stopPropagation());
    }

    (doc.documentElement || doc.body).appendChild(host);

    const ctx = {
      doc,
      host,
      shadow,
      root: rootEl,
      stacks,
      banners,
      overlay,
      center,
      items: new Map(),
      queue: [],
      current: null,
      drafts: {},
      mode: opts.mode || 'overlay',
      handlers: opts.handlers || {},
    };

    // إعادة التثبيت إذا حذف الموقع العنصر
    try {
      const mo = new MutationObserver(() => {
        if (!host.isConnected && (doc.documentElement || doc.body)) (doc.documentElement || doc.body).appendChild(host);
      });
      mo.observe(doc.documentElement, { childList: true });
      ctx.mo = mo;
    } catch {}
    return ctx;
  }

  function call(ctx, name, ...args) {
    try {
      const f = ctx.handlers && ctx.handlers[name];
      if (f) f(...args);
    } catch (e) {
      console.warn('[NotifUI]', e);
    }
  }

  function exitFullscreen(ctx) {
    try {
      if (ctx.doc.fullscreenElement && ctx.doc.exitFullscreen) ctx.doc.exitFullscreen().catch(() => {});
    } catch {}
  }

  function show(ctx, msg) {
    if (!ctx || !msg || !msg.id) return;
    msg.options = msg.options || {};
    if (has(ctx, msg.id)) return;
    exitFullscreen(ctx);
    if (msg.type === 'toast') renderToast(ctx, msg);
    else if (msg.type === 'banner') renderBanner(ctx, msg);
    else if (msg.type === 'system') renderSystemPreview(ctx, msg);
    else enqueue(ctx, msg);
  }

  function has(ctx, id) {
    return ctx.items.has(id) || ctx.queue.some((m) => m.id === id) || (ctx.current && ctx.current.id === id);
  }

  function respond(ctx, msg, status, data) {
    call(ctx, 'onRespond', msg.id, status, data || {});
    remove(ctx, msg.id);
  }

  /* ---------- إشعار جانبي ---------- */
  function renderToast(ctx, msg) {
    const d = ctx.doc;
    const m = META.toast;
    const pos = msg.options.position || 'tl';
    const t = el(d, 'div', 'toast ' + accent(msg));
    t.setAttribute('role', 'status');
    const ic = el(d, 'div', 't-icon');
    ic.innerHTML = icon(m.icon);
    const main = el(d, 'div', 't-main');
    const head = el(d, 'div', 't-head');
    head.append(el(d, 'span', 't-from', msg.from || 'الإدارة'), el(d, 'span', 't-time', fmtTime(msg.createdAt)));
    main.appendChild(head);
    if (msg.title) main.appendChild(el(d, 'div', 't-title', msg.title));
    if (msg.body) main.appendChild(el(d, 'div', 't-body', msg.body));
    const x = el(d, 'button', 't-close');
    x.innerHTML = icon('close');
    x.title = 'إغلاق';
    const prog = el(d, 'div', 't-progress');
    const bar = el(d, 'i');
    bar.style.animationDuration = (msg.options.duration || 12) + 's';
    prog.appendChild(bar);
    t.append(ic, main, x, prog);
    const close = (status) => {
      if (!ctx.items.has(msg.id)) return;
      ctx.items.delete(msg.id);
      if (status) call(ctx, 'onRespond', msg.id, status, {});
      t.classList.add('out');
      setTimeout(() => t.remove(), 260);
    };
    t.addEventListener('click', () => close('read'));
    bar.addEventListener('animationend', () => close(null));
    ctx.items.set(msg.id, { el: t, close: () => close(null) });
    (ctx.stacks[pos] || ctx.stacks.tl).appendChild(t);
    call(ctx, 'onDisplayed', msg.id);
  }

  /* ---------- شريط علوي ---------- */
  function renderBanner(ctx, msg) {
    const d = ctx.doc;
    const b = el(d, 'div', 'banner ' + accent(msg));
    b.setAttribute('role', 'alert');
    const ic = el(d, 'div', 'b-icon');
    ic.innerHTML = icon(META.banner.icon);
    const tx = el(d, 'div', 'b-text');
    if (msg.title) tx.appendChild(el(d, 'b', null, msg.title));
    if (msg.body) tx.appendChild(el(d, 'span', null, msg.body));
    const ok = el(d, 'button', 'b-ok', 'حسناً');
    const x = el(d, 'button', 'b-x');
    x.innerHTML = icon('close');
    x.title = 'إغلاق';
    b.append(ic, tx, ok, x);
    const close = (status) => {
      if (!ctx.items.has(msg.id)) return;
      ctx.items.delete(msg.id);
      if (status) call(ctx, 'onRespond', msg.id, status, {});
      b.classList.add('out');
      setTimeout(() => {
        b.remove();
        bannerOffset(ctx);
      }, 260);
    };
    ok.addEventListener('click', () => close('read'));
    x.addEventListener('click', () => close('read'));
    ctx.items.set(msg.id, { el: b, close: () => close(null) });
    ctx.banners.appendChild(b);
    bannerOffset(ctx);
    call(ctx, 'onDisplayed', msg.id);
  }

  /** الإشعارات الجانبية العلوية تنزل أسفل الشريط العلوي حتى لا يغطيها */
  function bannerOffset(ctx) {
    ctx.root.style.setProperty('--bh', ctx.banners.offsetHeight + 'px');
  }

  /* ---------- معاينة إشعار خارج المتصفح ---------- */
  function renderSystemPreview(ctx, msg) {
    const d = ctx.doc;
    const w = el(d, 'div', 'winnotif');
    const app = el(d, 'div', 'wn-app');
    app.append(el(d, 'i'), el(d, 'span', null, 'Google Chrome'));
    const x = el(d, 'span', 'x', '✕');
    app.appendChild(x);
    const row = el(d, 'div', 'wn-row');
    const ic = el(d, 'div', 'wn-ic');
    ic.innerHTML = icon('bell');
    const tx = el(d, 'div');
    tx.append(el(d, 'b', null, msg.title || 'إشعار'), el(d, 'p', null, msg.body || ''), el(d, 'div', 'wn-sub', msg.from || 'الإدارة'));
    row.append(ic, tx);
    w.append(app, row);
    const close = () => {
      ctx.items.delete(msg.id);
      w.remove();
    };
    x.addEventListener('click', () => {
      call(ctx, 'onRespond', msg.id, 'read', {});
      close();
    });
    ctx.items.set(msg.id, { el: w, close });
    ctx.root.appendChild(w);
    call(ctx, 'onDisplayed', msg.id);
  }

  /* ---------- النوافذ الوسطية (تتطلب تفاعل) ---------- */
  function prio(m) {
    return PRIO[m.type] || 1;
  }

  function enqueue(ctx, msg) {
    ctx.queue.push(msg);
    ctx.queue.sort((a, b) => prio(b) - prio(a) || (a.createdAt || 0) - (b.createdAt || 0));
    if (!ctx.current) next(ctx);
    else if (prio(msg) > prio(ctx.current)) {
      ctx.queue.push(ctx.current);
      ctx.queue.sort((a, b) => prio(b) - prio(a) || (a.createdAt || 0) - (b.createdAt || 0));
      ctx.current = null;
      next(ctx);
    } else updateCount(ctx);
  }

  function next(ctx) {
    ctx.current = ctx.queue.shift() || null;
    ctx.center.textContent = '';
    ctx.overlay.className = 'overlay';
    if (!ctx.current) {
      call(ctx, 'onEmpty');
      return;
    }
    const msg = ctx.current;
    const card = buildCard(ctx, msg);
    ctx.center.appendChild(card);
    ctx.overlay.className = 'overlay on t-' + msg.type;
    updateCount(ctx);
    const f = card.querySelector('textarea') || card.querySelector('.btn.primary,.choices .btn');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 60);
    call(ctx, 'onDisplayed', msg.id);
  }

  function updateCount(ctx) {
    const c = ctx.center.querySelector('.c-count');
    if (!c) return;
    const n = ctx.queue.length;
    c.textContent = n ? `+${n} بانتظارك` : '';
    c.style.display = n ? '' : 'none';
  }

  function buildCard(ctx, msg) {
    const d = ctx.doc;
    const type = msg.type;
    const m = META[type] || META.modal;
    const card = el(d, 'div', 'card type-' + type + ' ' + accent(msg));
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-modal', 'true');

    if (type === 'alert') {
      const top = el(d, 'div', 'alert-top');
      top.innerHTML = icon('alert');
      top.appendChild(el(d, 'span', null, 'إنذار'));
      card.appendChild(top);
    } else if (type === 'violation') {
      const top = el(d, 'div', 'v-top');
      top.innerHTML = icon('shield');
      const w = el(d, 'div');
      w.append(el(d, 'b', null, 'إشعار مخالفة'), el(d, 'small', null, 'صادر من: ' + (msg.from || 'الإدارة')));
      top.appendChild(w);
      card.appendChild(top);
      card.appendChild(el(d, 'div', 'v-stamp', 'مخالفة'));
    } else {
      card.appendChild(el(d, 'div', 'c-band'));
    }

    const inner = el(d, 'div', 'c-in');
    card.appendChild(inner);

    const head = el(d, 'div', 'c-head');
    if (type !== 'violation') {
      const ic = el(d, 'div', 'c-icon');
      ic.innerHTML = icon(m.icon);
      head.appendChild(ic);
    }
    const meta = el(d, 'div', 'c-meta');
    meta.append(
      el(d, 'div', 'c-label', type === 'violation' ? 'برجاء قراءة المخالفة والإقرار بالاطلاع' : m.label + ' من ' + (msg.from || 'الإدارة')),
      el(d, 'div', 'c-sub', fmtTime(msg.createdAt) + ' · ' + fmtDate(msg.createdAt))
    );
    head.append(meta, el(d, 'span', 'c-remind', 'تذكير'), el(d, 'span', 'c-count'));
    inner.appendChild(head);

    if (type === 'violation') {
      const g = el(d, 'div', 'v-grid');
      const cell = (k, v) => {
        const c = el(d, 'div');
        c.append(el(d, 'small', null, k), el(d, 'span', null, v || '—'));
        return c;
      };
      g.append(cell('رقم المخالفة', msg.options.ref), cell('التاريخ', fmtDate(msg.createdAt)), cell('الإجراء', msg.options.penalty));
      inner.appendChild(g);
      inner.appendChild(el(d, 'div', 'v-reason', 'سبب المخالفة'));
    }

    if (msg.title) inner.appendChild(el(d, 'h2', 'c-title', msg.title));
    if (msg.body) inner.appendChild(el(d, 'div', 'c-body', msg.body));

    const actions = el(d, 'div', 'c-actions');

    const mkTextarea = (ph) => {
      const ta = el(d, 'textarea', 'ta');
      ta.placeholder = ph;
      ta.value = ctx.drafts[msg.id] || '';
      ta.addEventListener('input', () => {
        ctx.drafts[msg.id] = ta.value;
      });
      inner.appendChild(ta);
      return ta;
    };

    if (type === 'reply') {
      const ta = mkTextarea(msg.options.placeholder || 'اكتب ردك هنا...');
      inner.appendChild(el(d, 'div', 'hint', 'اضغط Ctrl + Enter للإرسال السريع'));
      const send = el(d, 'button', 'btn primary');
      send.innerHTML = icon('send');
      send.appendChild(el(d, 'span', null, 'إرسال الرد'));
      send.disabled = !ta.value.trim();
      ta.addEventListener('input', () => {
        send.disabled = !ta.value.trim();
      });
      const go = () => {
        const v = ta.value.trim();
        if (!v) return;
        delete ctx.drafts[msg.id];
        respond(ctx, msg, 'replied', { reply: v });
      };
      send.addEventListener('click', go);
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          go();
        }
      });
      actions.appendChild(send);
    } else if (type === 'choice') {
      const box = el(d, 'div', 'choices');
      for (const c of msg.options.choices || ['نعم', 'لا']) {
        const b = el(d, 'button', 'btn', c);
        b.addEventListener('click', () => respond(ctx, msg, 'replied', { choice: c }));
        box.appendChild(b);
      }
      inner.appendChild(box);
    } else if (type === 'violation') {
      const ta = mkTextarea('ملاحظاتك أو تبريرك (اختياري)...');
      ta.style.minHeight = '70px';
      const ok = el(d, 'button', 'btn primary');
      ok.innerHTML = icon('check');
      ok.appendChild(el(d, 'span', null, 'أُقرّ بالاطلاع على المخالفة'));
      ok.addEventListener('click', () => {
        const v = ta.value.trim();
        delete ctx.drafts[msg.id];
        if (v) respond(ctx, msg, 'replied', { reply: v });
        else respond(ctx, msg, 'read');
      });
      actions.appendChild(ok);
    } else if (type === 'alert') {
      const ok = el(d, 'button', 'btn primary');
      ok.innerHTML = icon('check');
      ok.appendChild(el(d, 'span', null, 'أُقرّ باستلام الإنذار'));
      ok.addEventListener('click', () => respond(ctx, msg, 'read'));
      actions.appendChild(ok);
    } else {
      const ok = el(d, 'button', 'btn primary');
      ok.innerHTML = icon('check');
      ok.appendChild(el(d, 'span', null, 'تم الاطلاع'));
      ok.addEventListener('click', () => respond(ctx, msg, 'read'));
      actions.appendChild(ok);
    }
    if (actions.childNodes.length) inner.appendChild(actions);
    return card;
  }

  function remove(ctx, id) {
    if (!ctx) return;
    const it = ctx.items.get(id);
    if (it) {
      it.close();
      ctx.items.delete(id);
    }
    const before = ctx.queue.length;
    ctx.queue = ctx.queue.filter((m) => m.id !== id);
    if (ctx.current && ctx.current.id === id) next(ctx);
    else if (before !== ctx.queue.length) updateCount(ctx);
  }

  function remind(ctx, id) {
    if (!ctx) return;
    exitFullscreen(ctx);
    if (ctx.current && ctx.current.id === id) {
      const card = ctx.center.querySelector('.card');
      if (card) {
        card.classList.add('reminded');
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
      }
    } else if (ctx.queue.some((m) => m.id === id)) {
      const m = ctx.queue.find((x) => x.id === id);
      ctx.queue = ctx.queue.filter((x) => x.id !== id);
      if (ctx.current) ctx.queue.unshift(ctx.current);
      ctx.queue.unshift(m);
      ctx.current = null;
      next(ctx);
      remind(ctx, id);
    }
  }

  function clear(ctx) {
    if (!ctx) return;
    for (const id of [...ctx.items.keys()]) remove(ctx, id);
    ctx.queue = [];
    ctx.current = null;
    next(ctx);
  }

  root.NotifUI = { mount, show, remove, remind, has, clear, META, BLOCKING, ICON, icon };
})(typeof window !== 'undefined' ? window : globalThis);
