/**
 * سكربت الصفحات: يعرض الإشعارات داخل أي تبويب يعمل عليه الموظف
 * ويرصد إرسال الردود داخل ميتا بيزنس (تقديرياً).
 */
(function () {
  'use strict';
  if (window.top !== window) return;

  const alive = () => {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  };

  const prev = window.__notifAgent;
  if (prev && prev.alive && prev.alive()) return;
  if (prev && prev.dispose) {
    try {
      prev.dispose();
    } catch {}
  }

  let ctx = null;

  function safeSend(m) {
    if (!alive()) return Promise.resolve(null);
    try {
      return chrome.runtime.sendMessage(m).catch(() => null);
    } catch {
      return Promise.resolve(null);
    }
  }

  function ui() {
    if (!ctx) {
      ctx = window.NotifUI.mount(document, {
        handlers: {
          onDisplayed: (id) => safeSend({ t: 'displayed', id }),
          onRespond: (id, status, data) => safeSend({ t: 'respond', id, status, reply: data.reply, choice: data.choice }),
        },
      });
    } else if (!ctx.host.isConnected) {
      (document.documentElement || document.body).appendChild(ctx.host);
    }
    return ctx;
  }

  function onMsg(m, sender, sendResponse) {
    if (!m || !m.t) return;
    switch (m.t) {
      case 'show':
        for (const msg of m.msgs || []) window.NotifUI.show(ui(), msg);
        sendResponse({ ok: true });
        return;
      case 'remove':
        if (ctx) window.NotifUI.remove(ctx, m.id);
        sendResponse({ ok: true });
        return;
      case 'remind':
        if (ctx) window.NotifUI.remind(ctx, m.id);
        sendResponse({ ok: true });
        return;
      case 'ping':
        sendResponse({ ok: true });
        return;
    }
  }

  chrome.runtime.onMessage.addListener(onMsg);

  const cleanups = [];
  window.__notifAgent = {
    alive,
    dispose() {
      try {
        chrome.runtime.onMessage.removeListener(onMsg);
      } catch {}
      for (const f of cleanups) f();
    },
  };

  // عند تحميل الصفحة: اعرض أي رسائل لم يُرد عليها بعد
  safeSend({ t: 'ready' }).then((r) => {
    if (r && r.msgs && r.msgs.length) for (const msg of r.msgs) window.NotifUI.show(ui(), msg);
  });

  /* ---------- رصد الردود المرسلة في ميتا (فيسبوك/ماسنجر/بيزنس سويت) ---------- */
  if (/(^|\.)(facebook|messenger)\.com$/i.test(location.hostname)) {
    let last = 0;
    const hit = () => {
      const t = Date.now();
      if (t - last < 1200) return;
      last = t;
      safeSend({ t: 'metaSend' });
    };
    const inOurUi = (path) => path.some((n) => n && n.id === '__notif_ui_host__');

    const onKey = (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
      const path = e.composedPath ? e.composedPath() : [e.target];
      if (inOurUi(path)) return;
      const el = path[0];
      if (!el || !(el.isContentEditable || el.tagName === 'TEXTAREA')) return;
      const txt = (el.value != null ? el.value : el.innerText || '').trim();
      if (txt) hit();
    };
    const onClick = (e) => {
      const path = e.composedPath ? e.composedPath() : [e.target];
      if (inOurUi(path)) return;
      for (const n of path.slice(0, 6)) {
        if (!n || !n.getAttribute) continue;
        const lab = (n.getAttribute('aria-label') || '').trim().toLowerCase();
        if (/^(send|إرسال|ارسال|send message|press enter to send|إرسال رسالة)$/.test(lab)) {
          hit();
          break;
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('click', onClick, true);
    cleanups.push(() => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('click', onClick, true);
    });
  }
})();
