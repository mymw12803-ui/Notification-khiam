// النافذة المستقلة: تعرض كل رسائل الإدارة المعلقة بالترتيب وتُغلق تلقائياً بعد الرد عليها كلها
(async function () {
  let closing = false;
  const closeSoon = () => {
    if (closing) return;
    closing = true;
    setTimeout(() => window.close(), 250);
  };
  const ctx = NotifUI.mount(document, {
    mode: 'page',
    handlers: {
      onDisplayed: (id) => chrome.runtime.sendMessage({ t: 'displayed', id }).catch(() => {}),
      onRespond: (id, status, data) =>
        chrome.runtime.sendMessage({ t: 'respond', id, status, reply: data.reply, choice: data.choice }).catch(() => {}),
      onEmpty: closeSoon,
    },
  });
  let from = 'الإدارة';
  const add = (msg) => {
    if (!msg) return;
    closing = false;
    msg.from = msg.from || from;
    NotifUI.show(ctx, msg);
    if (ctx.current) document.title = (ctx.current.title || 'رسالة') + ' — ' + (ctx.current.from || from);
  };
  chrome.runtime.onMessage.addListener((m) => {
    if (!m || !m.t) return;
    if (m.t === 'win:add') add(m.msg);
    if (m.t === 'remove') NotifUI.remove(ctx, m.id);
    if (m.t === 'remind') NotifUI.remind(ctx, m.id);
  });
  const r = await chrome.runtime.sendMessage({ t: 'getPending' }).catch(() => null);
  document.getElementById('loading').remove();
  if (r && r.from) from = r.from;
  const list = (r && r.msgs) || [];
  if (!list.length) return closeSoon();
  for (const msg of list) add(msg);
})();
