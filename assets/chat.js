/* Portfolio chat assistant — talks to an n8n Chat Trigger (webhook mode).
   Self-contained: injects its own styles, follows the page theme (CSS vars)
   and language (<html lang/dir>), and stays hidden until CHAT_URL is set. */
(function () {
  var CHAT_URL = 'https://163.245.218.21:8447/webhook/3a9c9ab7-8f8d-4c99-9e07-56a3f1fa0a65/chat';
  if (!CHAT_URL) return;

  var T = {
    en: {
      title: "Jasem's assistant", status: 'AI · replies in seconds',
      hello: "Hi! 👋 I can tell you about Jasem's projects, skills and services, or help you get in touch. What would you like to know?",
      teaser: 'Questions? Ask my assistant', placeholder: 'Ask about projects, skills, hiring…',
      send: 'Send', open: 'Open chat', close: 'Close chat',
      chips: ['What has Jasem built?', 'Is he available for freelance?', 'Tell me about his Odoo work', 'How can I contact him?'],
      error: "Sorry, I can't reach the assistant right now. You can email jasemalyounes@gmail.com or message +1 (931) 623-7215 on WhatsApp.",
      note: 'AI answers can be imperfect — confirm details with Jasem.'
    },
    ar: {
      title: 'مساعد جاسم', status: 'ذكاء اصطناعي · يرد خلال ثوانٍ',
      hello: 'أهلاً! 👋 يمكنني إخبارك عن مشاريع جاسم ومهاراته وخدماته، أو مساعدتك في التواصل معه. ماذا تريد أن تعرف؟',
      teaser: 'لديك سؤال؟ اسأل مساعدي', placeholder: 'اسأل عن المشاريع أو المهارات أو التوظيف…',
      send: 'إرسال', open: 'فتح المحادثة', close: 'إغلاق المحادثة',
      chips: ['ما المشاريع التي بناها جاسم؟', 'هل هو متاح للعمل الحر؟', 'حدثني عن خبرته في Odoo', 'كيف أتواصل معه؟'],
      error: 'عذرًا، لا يمكن الوصول إلى المساعد حاليًا. يمكنك مراسلة jasemalyounes@gmail.com أو التواصل عبر واتساب على ‎+1 (931) 623-7215.',
      note: 'قد تكون إجابات الذكاء الاصطناعي غير دقيقة — تأكد من التفاصيل مع جاسم.'
    }
  };
  function lang() { return document.documentElement.lang === 'ar' ? 'ar' : 'en'; }
  function t(k) { return T[lang()][k]; }

  var css = [
    '.cb-launch{position:fixed;bottom:22px;inset-inline-end:22px;z-index:900;width:58px;height:58px;border-radius:50%;border:none;cursor:pointer;background:var(--accent,#2563eb);color:var(--on-accent,#fff);box-shadow:0 10px 30px rgba(37,99,235,.35);display:flex;align-items:center;justify-content:center;transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .25s;}',
    '.cb-launch:hover{transform:scale(1.08) rotate(-4deg);box-shadow:0 14px 36px rgba(37,99,235,.45);}',
    '.cb-launch svg{width:26px;height:26px;transition:transform .3s,opacity .2s;}',
    '.cb-launch .cb-x{position:absolute;opacity:0;transform:rotate(-90deg);}',
    '.cb-open .cb-launch .cb-x{opacity:1;transform:none;} .cb-open .cb-launch .cb-bubble{opacity:0;transform:rotate(90deg);}',
    '.cb-launch::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid var(--accent,#2563eb);animation:cbRing 2.6s ease-out infinite;}',
    '.cb-open .cb-launch::after{display:none;}',
    '@keyframes cbRing{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.6);opacity:0}}',
    '.cb-teaser{position:fixed;bottom:34px;inset-inline-end:92px;z-index:900;background:var(--bg,#fff);color:var(--text,#1a1a1a);border:1px solid var(--border,#e2e2da);border-radius:14px;padding:9px 30px 9px 14px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.12);opacity:0;transform:translateY(8px) scale(.96);transition:all .35s;pointer-events:none;max-width:230px;}',
    'html[dir="rtl"] .cb-teaser{padding:9px 14px 9px 30px;}',
    '.cb-teaser{visibility:hidden;} .cb-teaser.show{opacity:1;transform:none;pointer-events:auto;visibility:visible;}',
    '.cb-tt{background:none;border:none;padding:0;font:inherit;color:inherit;text-align:start;cursor:pointer;}',
    '.cb-teaser .cb-dismiss{position:absolute;top:4px;inset-inline-end:6px;background:none;border:none;color:var(--text3,#999);cursor:pointer;font-size:15px;line-height:1;}',
    '.cb-panel{position:fixed;bottom:92px;inset-inline-end:22px;z-index:901;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 120px));background:var(--bg,#fff);color:var(--text,#1a1a1a);border:1px solid var(--border,#e2e2da);border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.22);display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(16px) scale(.97);transform-origin:bottom right;pointer-events:none;transition:opacity .25s,transform .3s cubic-bezier(.34,1.3,.64,1);}',
    'html[dir="rtl"] .cb-panel{transform-origin:bottom left;}',
    '.cb-open .cb-panel{opacity:1;transform:none;pointer-events:auto;}',
    '.cb-head{display:flex;align-items:center;gap:.7rem;padding:14px 16px;background:linear-gradient(135deg,var(--accent,#2563eb),var(--accent2,#1d4ed8));color:var(--on-accent,#fff);}',
    '.cb-head img{width:38px;height:38px;border-radius:50%;border:2px solid rgba(255,255,255,.6);object-fit:cover;}',
    '.cb-head b{display:block;font-size:14px;font-weight:600;}',
    '.cb-head small{display:flex;align-items:center;gap:.35rem;font-size:11.5px;opacity:.9;}',
    '.cb-head small::before{content:"";width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 3px rgba(74,222,128,.25);}',
    '.cb-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:var(--bg2,#f7f7f5);scroll-behavior:smooth;}',
    '.cb-msg{max-width:86%;padding:9px 13px;border-radius:14px;font-size:13.5px;line-height:1.55;word-wrap:break-word;animation:cbIn .3s ease;}',
    '@keyframes cbIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '.cb-bot{align-self:flex-start;background:var(--bg,#fff);border:1px solid var(--border,#e2e2da);border-end-start-radius:4px;}',
    '.cb-user{align-self:flex-end;background:var(--accent,#2563eb);color:var(--on-accent,#fff);border-end-end-radius:4px;}',
    '.cb-bot a{color:var(--accent,#2563eb);text-decoration:underline;word-break:break-all;}',
    '.cb-bot ul{margin:.3rem 0;padding-inline-start:1.1rem;}',
    '.cb-typing{display:inline-flex;gap:4px;padding:12px 14px;}',
    '.cb-typing i{width:6px;height:6px;border-radius:50%;background:var(--text3,#999);animation:cbDot 1.2s infinite;}',
    '.cb-typing i:nth-child(2){animation-delay:.15s}.cb-typing i:nth-child(3){animation-delay:.3s}',
    '@keyframes cbDot{0%,60%,100%{transform:none;opacity:.4}30%{transform:translateY(-4px);opacity:1}}',
    '.cb-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px;background:var(--bg2,#f7f7f5);}',
    '.cb-chips button{font:inherit;font-size:12px;padding:6px 11px;border-radius:99px;border:1px solid var(--accent,#2563eb);background:transparent;color:var(--accent,#2563eb);cursor:pointer;transition:all .18s;}',
    '.cb-chips button:hover{background:var(--accent,#2563eb);color:var(--on-accent,#fff);}',
    '.cb-form{display:flex;gap:8px;padding:12px;border-top:1px solid var(--border,#e2e2da);background:var(--bg,#fff);}',
    '.cb-form input{flex:1;min-width:0;font:inherit;font-size:13.5px;padding:10px 14px;border-radius:99px;border:1px solid var(--border,#e2e2da);background:var(--bg2,#f7f7f5);color:var(--text,#1a1a1a);outline:none;transition:border-color .2s;}',
    '.cb-form input:focus{border-color:var(--accent,#2563eb);}',
    '.cb-form button{width:40px;height:40px;flex-shrink:0;border-radius:50%;border:none;background:var(--accent,#2563eb);color:var(--on-accent,#fff);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s,opacity .2s;}',
    '.cb-form button:disabled{opacity:.45;cursor:default;}',
    '.cb-form button:not(:disabled):hover{transform:scale(1.07);}',
    'html[dir="rtl"] .cb-form button svg{transform:scaleX(-1);}',
    '.cb-note{font-size:10.5px;color:var(--text3,#999);text-align:center;padding:0 12px 8px;background:var(--bg,#fff);}',
    '@media(max-width:520px){.cb-panel{inset-inline-end:8px;bottom:84px;width:calc(100vw - 16px);height:calc(100vh - 110px);} .cb-teaser{display:none;}}',
    '@media(prefers-reduced-motion:reduce){.cb-launch::after{animation:none;} .cb-msg{animation:none;}}'
  ].join('');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var ICON_CHAT = '<svg class="cb-bubble" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 9 9 0 01-3.8-.9L3 20.5l1.6-4.6A8.3 8.3 0 013 11.5 8.5 8.5 0 0112 3a8.5 8.5 0 019 8.5z"/><circle cx="8.5" cy="11.5" r=".6" fill="currentColor"/><circle cx="12" cy="11.5" r=".6" fill="currentColor"/><circle cx="15.5" cy="11.5" r=".6" fill="currentColor"/></svg>';
  var ICON_X = '<svg class="cb-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  var root = document.createElement('div');
  root.className = 'cb-root';
  root.innerHTML =
    '<div class="cb-teaser"><button type="button" class="cb-tt"></button><button type="button" class="cb-dismiss" aria-label="Dismiss">×</button></div>' +
    '<section class="cb-panel" role="dialog" aria-modal="false">' +
      '<header class="cb-head"><img src="https://avatars.githubusercontent.com/u/259720871?v=4" alt=""><div><b class="cb-title"></b><small class="cb-status"></small></div></header>' +
      '<div class="cb-msgs" aria-live="polite"></div>' +
      '<div class="cb-chips"></div>' +
      '<form class="cb-form"><input type="text" maxlength="500" autocomplete="off"><button type="submit" disabled>' + ICON_SEND + '</button></form>' +
      '<div class="cb-note"></div>' +
    '</section>' +
    '<button class="cb-launch" type="button">' + ICON_CHAT + ICON_X + '</button>';
  document.body.appendChild(root);

  var $ = function (s) { return root.querySelector(s); };
  var panel = $('.cb-panel'), msgs = $('.cb-msgs'), chips = $('.cb-chips'), form = $('.cb-form'),
      input = $('.cb-form input'), sendBtn = $('.cb-form button'), launch = $('.cb-launch'), teaser = $('.cb-teaser');
  var busy = false, started = false;

  function store(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  var sessionId = store('cb-session');
  if (!sessionId) {
    sessionId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    store('cb-session', sessionId);
  }

  function esc(s) { return s.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // Small, safe formatter: escape first, then **bold**, bullet lists, links, emails, newlines.
  function format(text) {
    var lines = esc(text.trim()).split(/\n/), out = [], inList = false;
    lines.forEach(function (l) {
      var m = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (m) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + m[1] + '</li>'); return; }
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(l === '' ? '<br>' : l + '<br>');
    });
    if (inList) out.push('</ul>');
    return out.join('')
      .replace(/(<br>)+$/, '')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(>])([\w.+-]+@[\w-]+\.[\w.]+[\w])/g, '$1<a href="mailto:$2">$2</a>');
  }

  function add(text, who) {
    var d = document.createElement('div');
    d.className = 'cb-msg ' + (who === 'user' ? 'cb-user' : 'cb-bot');
    if (who === 'user') d.textContent = text; else d.innerHTML = format(text);
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  function renderChips() {
    chips.innerHTML = '';
    if (started) { chips.style.display = 'none'; return; }
    t('chips').forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = c;
      b.addEventListener('click', function () { send(c); });
      chips.appendChild(b);
    });
  }

  function relabel() {
    $('.cb-title').textContent = t('title');
    $('.cb-status').textContent = t('status');
    $('.cb-tt').textContent = t('teaser');
    $('.cb-note').textContent = t('note');
    input.placeholder = t('placeholder');
    sendBtn.setAttribute('aria-label', t('send'));
    panel.setAttribute('aria-label', t('title'));
    launch.setAttribute('aria-label', root.classList.contains('cb-open') ? t('close') : t('open'));
    if (!started) { msgs.innerHTML = ''; add(t('hello'), 'bot'); }
    renderChips();
  }

  function send(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    started = true; renderChips();
    add(text, 'user');
    input.value = ''; sendBtn.disabled = true; busy = true;
    var typing = document.createElement('div');
    typing.className = 'cb-msg cb-bot cb-typing'; typing.innerHTML = '<i></i><i></i><i></i>';
    msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
    // n8n retries Gemini when it's overloaded, so a reply can take well over a minute
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 110000);
    function ask(retries) {
      return fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendMessage', sessionId: sessionId, chatInput: text, metadata: { lang: lang(), page: location.pathname } }),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        if (r.status >= 500 && retries > 0) return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return ask(retries - 1); });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    }
    ask(1)
      .then(function (data) {
        var d = Array.isArray(data) ? data[0] : data;
        var reply = d && (d.output || d.text || d.message);
        if (!reply) throw new Error('empty');
        typing.remove(); add(String(reply), 'bot');
      })
      .catch(function () { typing.remove(); add(t('error'), 'bot'); })
      .then(function () { clearTimeout(timer); busy = false; sendBtn.disabled = !input.value.trim(); input.focus(); });
  }

  function toggle(open) {
    var isOpen = typeof open === 'boolean' ? open : !root.classList.contains('cb-open');
    root.classList.toggle('cb-open', isOpen);
    teaser.classList.remove('show');
    launch.setAttribute('aria-label', isOpen ? t('close') : t('open'));
    if (isOpen) { store('cb-seen', '1'); setTimeout(function () { input.focus(); }, 250); }
  }

  launch.addEventListener('click', function () { toggle(); });
  teaser.addEventListener('click', function (e) {
    if (e.target.classList.contains('cb-dismiss')) { teaser.classList.remove('show'); store('cb-seen', '1'); return; }
    toggle(true);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('cb-open')) toggle(false); });
  input.addEventListener('input', function () { sendBtn.disabled = busy || !input.value.trim(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });

  // follow the page's language toggle
  new MutationObserver(relabel).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  relabel();

  // gentle nudge once per visit
  if (!store('cb-seen')) setTimeout(function () { if (!root.classList.contains('cb-open')) teaser.classList.add('show'); }, 7000);
})();
