'use strict';
const $ = (s) => document.querySelector(s);
const isPage = new URLSearchParams(location.search).has('setup');
if (isPage) document.body.classList.add('page');

const ERR = {
  'not-configured': ['لم يتم الربط بعد', 'أدخل عنوان الخادم وكود الموظف من الإعدادات بالأسفل'],
  'bad-code': ['كود الموظف غير صحيح', 'تأكد من الكود مع الإدارة'],
  replaced: ['الكود مستخدم في متصفح آخر', 'تم فتح نفس الكود على جهاز/متصفح آخر'],
  'no-internet': ['لا يوجد اتصال بالإنترنت', 'سيتم الاتصال تلقائياً عند عودة الإنترنت'],
  'server-unreachable': ['تعذر الوصول للخادم', 'جارٍ إعادة المحاولة تلقائياً...'],
  'bad-server': ['عنوان الخادم غير صحيح', 'مثال: https://dashboard.example.com'],
};

let filled = false;

function render(s) {
  if (!s) return;
  $('#ver').textContent = 'v' + s.version;
  const dot = $('#dot');
  dot.className = 'dot ' + (s.connected ? 'ok' : s.error === 'not-configured' ? '' : 'bad');
  if (s.connected) {
    $('#stText').textContent = 'متصل بالإدارة';
    $('#stSub').textContent = 'الإشعارات ستظهر لك في أي صفحة تعمل عليها';
  } else {
    const e = ERR[s.error] || ['غير متصل', 'جارٍ المحاولة...'];
    $('#stText').textContent = e[0];
    $('#stSub').textContent = e[1];
  }
  $('#hello').textContent = s.name ? 'أهلاً، ' + s.name : 'إضافة الموظف';
  const p = $('#pending');
  p.classList.toggle('on', s.pending > 0);
  $('#pendingText').textContent = s.pending ? `لديك ${s.pending} رسالة بانتظار ردك` : '';
  $('#toAdminCard').style.display = s.connected ? '' : 'none';
  if (!filled) {
    filled = true;
    $('#server').value = s.server || '';
    $('#code').value = s.code || '';
    if (!s.code || isPage || (!s.connected && s.error !== 'server-unreachable' && s.error !== 'no-internet')) $('#setup').open = true;
  }
}

async function refresh() {
  try {
    render(await chrome.runtime.sendMessage({ t: 'popup:get' }));
  } catch {}
}

$('#save').addEventListener('click', async () => {
  const server = $('#server').value.trim();
  const code = $('#code').value.trim();
  const msg = $('#saveMsg');
  if (!server || !code) {
    msg.className = 'msg bad';
    msg.textContent = 'أدخل العنوان والكود';
    return;
  }
  $('#save').disabled = true;
  msg.className = 'msg';
  msg.textContent = 'جارٍ الاتصال...';
  const s = await chrome.runtime.sendMessage({ t: 'popup:save', server, code }).catch(() => null);
  $('#save').disabled = false;
  render(s);
  if (s && s.connected) {
    msg.className = 'msg ok';
    msg.textContent = 'تم الربط بنجاح ✓';
  } else {
    msg.className = 'msg bad';
    msg.textContent = s && ERR[s.error] ? ERR[s.error][0] : 'لم يتم الاتصال بعد';
  }
});

$('#sendAdmin').addEventListener('click', async () => {
  const text = $('#toAdmin').value.trim();
  const m = $('#adminMsg');
  if (!text) return;
  const r = await chrome.runtime.sendMessage({ t: 'popup:toAdmin', text }).catch(() => null);
  if (r && r.ok) {
    $('#toAdmin').value = '';
    m.className = 'msg ok';
    m.textContent = 'تم الإرسال ✓';
  } else {
    m.className = 'msg bad';
    m.textContent = 'تعذر الإرسال، غير متصل';
  }
  setTimeout(() => (m.textContent = ''), 3000);
});

$('#showPending').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ t: 'popup:showPending' }).catch(() => null);
  if (!isPage) window.close();
});

refresh();
setInterval(refresh, 2000);
