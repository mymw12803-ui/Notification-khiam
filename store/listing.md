# بيانات صفحة الإضافة في Chrome Web Store

انسخ كل حقل إلى مكانه في <https://chrome.google.com/webstore/devconsole>.

---

## 1) تبويب Package (الحزمة)
ارفع ملف `notifications-extension-v1.0.0.zip` الموجود بجانب هذا الملف.

> قبل الرفع يفضَّل إعادة التحزيم برابط الداشبورد حتى لا يكتبه الموظف بنفسه:
> `node build.js https://رابط-الداشبورد`

---

## 2) تبويب Store listing (صفحة المتجر)

**Language / اللغة:** Arabic — العربية

**Title / الاسم** (من manifest تلقائياً):
```
منظومة الإشعارات - الموظف
```

**Summary / الوصف المختصر** (حد أقصى 132 حرف — يُؤخذ من manifest):
```
استقبال إشعارات وإنذارات الإدارة والرد عليها، ومتابعة حالة العمل.
```

**Description / الوصف الكامل:**
```
إضافة عمل داخلية تربط متصفح الموظف بلوحة تحكم الإدارة في شركتك.

ما الذي تفعله؟
• تظهر رسائل الإدارة للموظف في أي صفحة يعمل عليها، بأشكال مختلفة حسب أهمية الرسالة:
  - إشعار جانبي في زاوية الصفحة
  - شريط تنبيه أعلى الصفحة
  - نافذة في منتصف الصفحة
  - إنذار بشاشة حمراء وصوت تنبيه
  - إشعار مخالفة رسمي برقم وإجراء
  - طلب رد: يكتب الموظف رده فيصل للإدارة فوراً
  - سؤال بخيارات (نعم / لا ...)
  - إشعار ويندوز يظهر حتى لو كان المتصفح مصغّراً
• تُبلغ لوحة الإدارة بحالة العمل أثناء الدوام: الموقع الظاهر حالياً، هل المتصفح في المقدمة، هل الجهاز خامل أو مقفل، وانقطاع الإنترنت.
• تقيس سرعة رد الموظف على رسائل الإدارة.
• يستطيع الموظف إرسال رسالة للإدارة من أيقونة الإضافة.

الخصوصية والشفافية
• تُرسل البيانات فقط إلى خادم شركتك (العنوان الذي تحدده الإدارة)، ولا يحصل عليها ناشر الإضافة أو أي طرف آخر.
• لا تسجّل ما يُكتب بلوحة المفاتيح، ولا تقرأ محتوى الصفحات أو المحادثات، ولا تلتقط صوراً للشاشة.
• تُظهر نافذة الإضافة دائماً أن المتصفح مرتبط بنظام العمل.

طريقة الاستخدام
1) تعطيك الإدارة كود الموظف.
2) بعد التثبيت تفتح صفحة الربط: أدخل الكود (وعنوان الخادم إن لم يكن مكتوباً) واضغط «حفظ واتصال».

هذه الإضافة مخصصة للجهات التي تستخدم «منظومة الإشعارات»، ولا تعمل بدون خادم الجهة.

—

An internal workplace extension that connects an employee's browser to their company's management dashboard: management notifications (toasts, banners, modal messages, alerts, formal violation notices, reply requests, multiple-choice questions, and system notifications) appear on whatever page the employee is working on, and replies go straight back to the dashboard. During working hours it reports work status (current site, browser focus, idle/locked state, connection loss) to the company's own self-hosted server only. No keystroke logging, no page or chat content, no screenshots. Requires your organization's server.
```

**Category / الفئة:** `Communication` (أو `Workflow & Planning`)

**Graphic assets / الصور:**
| الحقل | الملف |
|---|---|
| Store icon (128×128) | `icon-128.png` |
| Screenshots (1280×800) — حتى 5 | `screenshot-1-reply.png` ، `screenshot-2-banner-toast.png` ، `screenshot-3-alert.png` ، `screenshot-4-violation.png` ، `screenshot-5-dashboard.png` (و`screenshot-6-setup.png` بديل) |
| Small promo tile (440×280) | `promo-small-440x280.png` |
| Marquee promo tile (1400×560) — اختياري | `promo-marquee-1400x560.png` |

**Official URL / Homepage:** رابط الداشبورد (اختياري)
**Support URL:** رابط مستودع GitHub أو بريد الدعم (اختياري)

---

## 3) تبويب Privacy practices (الخصوصية) — أهم جزء للموافقة

**Single purpose / الغرض الوحيد:**
```
Workplace communication between an organization and its employees: show the organization's notifications on any page the employee is using, collect the employee's replies, and report work status to the organization's own self-hosted dashboard.
```

**Permission justification / تبرير الصلاحيات:**

| الصلاحية | النص |
|---|---|
| `tabs` | `Reads the URL host, path and title of the active tab to report which site the employee is currently working on, and to locate the active tab so notifications are shown where the employee is looking.` |
| `storage` | `Stores the server address, employee code and not-yet-answered notifications so they survive browser restarts.` |
| `alarms` | `Wakes the service worker every 30 seconds to reconnect to the organization's server after a network loss and to record offline periods.` |
| `idle` | `Detects idle/locked state so the dashboard can show whether the employee is active; no input events are recorded.` |
| `notifications` | `Shows system notifications when the employee is outside the browser so urgent management messages are not missed.` |
| `scripting` | `Injects the extension's own notification UI script into tabs that were already open before the extension was installed or updated.` |
| `offscreen` | `Plays notification sounds (AUDIO_PLAYBACK) from an offscreen document, since service workers cannot play audio.` |
| `tts` | `Optionally reads a management message aloud when the manager enables “read aloud” for that message.` |
| Host permission `<all_urls>` | `Notifications must appear on whatever website the employee is using, so the content script that renders the notification UI runs on all pages. The organization's dashboard is self-hosted at an address configured per organization, so the extension must be able to connect to any host.` |

**Remote code / كود خارجي:** `No, I am not using remote code`

**Data usage / البيانات المجمعة** — ضع علامة على:
- ☑ **Personally identifiable information** (كود الموظف الذي يعرّفه لدى جهته)
- ☑ **Authentication information** (كود الموظف يُستخدم كبيانات دخول للخادم)
- ☑ **Personal communications** (الردود التي يكتبها الموظف لرسائل الإدارة)
- ☑ **Web history** (عنوان وموقع التبويب الظاهر حالياً فقط)
- ☑ **User activity** (حالة الخمول/القفل، وعدد مرات «إرسال» في ميتا)
- ☐ الباقي بدون علامة (Health, Financial, Location, Website content)

ثم ضع علامة على الإقرارات الثلاثة:
- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:**
```
https://رابط-الداشبورد/privacy
```
(أو رابط ملف `PRIVACY.md` في مستودع GitHub إذا كان المستودع عاماً)

---

## 4) تبويب Distribution (التوزيع)

- **Visibility:** `Unlisted` ← لا تظهر في البحث، ويثبّتها فقط من معه الرابط (مناسب لموظفيك).
  (إذا كانت شركتك تستخدم Google Workspace يمكن اختيار `Private` لتظهر لحسابات شركتك فقط.)
- **Regions:** All regions

---

## 5) تعليمات للمراجِع (Test instructions) — يقلل احتمال الرفض

أنشئ موظفاً باسم `Chrome Reviewer` من صفحة «الموظفون» وضع كوده هنا:
```
This extension requires the organization's self-hosted server.
Test server: https://رابط-الداشبورد
Employee code: XXXXXX
After installing, the setup page opens automatically: enter the server address and the code above, then click "حفظ واتصال" (Save & connect). The popup will show "متصل بالإدارة" (Connected). Notifications sent from the dashboard will then appear on any page.
```

---

## ملاحظات
- رسوم حساب المطوّر: 5$ مرة واحدة.
- المراجعة تستغرق عادة من يوم إلى عدة أيام؛ صلاحية `<all_urls>` قد تطيل المراجعة قليلاً.
- عند أي تحديث للإضافة: ارفع رقم `version` في `extension/manifest.json` ← `node build.js ...` ← ارفع zip الجديد في تبويب Package.
