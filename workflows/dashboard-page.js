// Dashboard v2 (n8n Code node "Build page", mode: run once for all items).
// Reads the 4 bot tables, packs them into the page as JSON, and ships a small browser script
// that draws the control room and sends button actions (confirm / cancel / done / reply / handled)
// to the "-act" webhook of the same workflow. This node itself only reads.

const rows = n => $(n).all().map(i => i.json).filter(r => r && r.id !== undefined);
const yes = v => v === true || v === 'true';
const NOW = (typeof $now !== 'undefined' && $now.toMillis) ? $now.toMillis() : Date.now();

const data = {
  now: NOW,
  log: rows('Read chat log').map(r => ({ id: r.id, chat: String(r.chat_id), name: r.name || 'Someone', said: r.said || '', matched: r.matched || '', replied: !(r.replied === false || r.replied === 'false'), handled: yes(r.handled), reply: r.team_reply || '', at: r.createdAt })),
  bookings: rows('Read bookings').map(r => ({ id: r.id, chat: String(r.chat_id), name: r.name || 'Someone', slot: r.slot_label || '', status: r.status || 'requested', at: r.createdAt })),
  optedOut: rows('Read contacts').filter(r => yes(r.opted_out)).length,
  faqs: rows('Read answers').map(r => ({ id: r.faq_id, label: r.button_label || r.faq_id, status: r.status || 'DRAFT', priority: Number(r.priority) || 99 })),
};

// ---------- runs in the browser ----------
function client() {
  const D = JSON.parse(document.getElementById('data').textContent);
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const IST = 330 * 60000, DAY = 86400000;
  const ms = t => new Date(t || 0).getTime();
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const W = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const clock = t => { const d = new Date(ms(t) + IST), h = d.getUTCHours(); return ((h % 12) || 12) + ':' + String(d.getUTCMinutes()).padStart(2, '0') + (h < 12 ? ' am' : ' pm'); };
  const ago = t => {
    const s = (D.now - ms(t)) / 1000;
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < DAY / 1000) return Math.floor(s / 3600) + ' h ago';
    const d = new Date(ms(t) + IST); return d.getUTCDate() + ' ' + M[d.getUTCMonth()] + ', ' + clock(t);
  };
  const dayKey = t => Math.floor((ms(t) + IST) / DAY);
  const label = Object.fromEntries(D.faqs.map(f => [f.id, f.label]));
  Object.assign(label, { OPENING: 'Opening message', SLOT: 'Picked a call time', SILENT: 'Silent (opted out)', NON_TEXT: 'Photo / voice', HANDOFF: 'Needs a person', F10: 'Stop messages' });
  const nameOf = k => label[k] || k || '?';
  const newest = (a, b) => ms(b.at) - ms(a.at);

  // ----- numbers -----
  const people = new Set(D.log.map(r => r.chat));
  const askedIds = new Set(D.log.filter(r => /^F0\d$|^HANDOFF$/.test(r.matched)).map(r => r.chat));
  const bookedIds = new Set(D.bookings.map(r => r.chat));
  const confirmedIds = new Set(D.bookings.filter(r => r.status === 'confirmed' || r.status === 'done').map(r => r.chat));
  const pending = D.bookings.filter(r => r.status === 'requested').sort(newest);
  const upcoming = D.bookings.filter(r => r.status === 'confirmed').sort(newest);
  const waiting = D.log.filter(r => r.matched === 'HANDOFF' && !r.handled).sort(newest);
  const answeredByBot = D.log.filter(r => /^F\d\d$/.test(r.matched)).length;
  const questions = D.log.filter(r => /^F\d\d$|^HANDOFF$/.test(r.matched)).length;
  const today = dayKey(D.now);
  const msgsToday = D.log.filter(r => dayKey(r.at) === today).length;
  const approved = D.faqs.filter(f => f.status === 'APPROVED').length;

  const kpis = [
    ['People reached', people.size, msgsToday + ' messages today'],
    ['Call requests', D.bookings.length, pending.length ? pending.length + ' to confirm' : 'none waiting'],
    ['Bot answered', questions ? Math.round(answeredByBot / questions * 100) + '%' : '–', answeredByBot + ' of ' + questions + ' questions'],
    ['Waiting for you', waiting.length + pending.length, waiting.length + (waiting.length === 1 ? ' question' : ' questions') + ' · ' + pending.length + (pending.length === 1 ? ' call' : ' calls')],
    ['Opted out', D.optedOut, 'said STOP'],
  ];
  $('#kpis').innerHTML = kpis.map(([t, v, s], i) => '<div class="kpi' + (i === 3 && (waiting.length + pending.length) ? ' hot' : '') + '"><div class="kt">' + t + '</div><div class="kv">' + esc(v) + '</div><div class="ks">' + esc(s) + '</div></div>').join('');

  const todo = waiting.length + pending.length;
  $('#banner').innerHTML = todo
    ? '<span class="dot warn"></span><b>' + todo + ' thing' + (todo > 1 ? 's' : '') + ' need you</b>' + (pending.length ? ' · ' + pending.length + ' call request' + (pending.length > 1 ? 's' : '') + ' to confirm' : '') + (waiting.length ? ' · ' + waiting.length + ' question' + (waiting.length > 1 ? 's' : '') + ' to answer' : '')
    : '<span class="dot good"></span><b>All clear</b> · nothing is waiting for you';
  $('#banner').className = 'banner ' + (todo ? 'warn' : 'good');

  // ----- needs you -----
  const card = (kind, r, body, actions) => '<article class="task ' + kind + '" data-id="' + r.id + '">' +
    '<div class="th"><span class="avatar">' + esc((r.name || '?').trim().charAt(0).toUpperCase()) + '</span><div><b>' + esc(r.name) + '</b><div class="muted">' + ago(r.at) + '</div></div>' +
    '<span class="tag ' + kind + '">' + (kind === 'call' ? '📅 Call request' : '💬 Question') + '</span></div>' + body + '<div class="acts">' + actions + '</div></article>';
  const callCards = pending.map(r => card('call', r,
    '<p class="big">' + esc(r.slot) + '</p>',
    '<button class="btn primary" data-act="confirm" data-id="' + r.id + '" data-chat="' + esc(r.chat) + '" data-slot="' + esc(r.slot) + '">Confirm and tell them</button>' +
    '<button class="btn" data-act="cancel" data-id="' + r.id + '" data-chat="' + esc(r.chat) + '" data-slot="' + esc(r.slot) + '">Can\'t do this time</button>'));
  const qCards = waiting.map(r => card('q', r,
    '<blockquote>' + esc(r.said) + '</blockquote><textarea rows="2" placeholder="Type your reply. It goes to them from the bot." id="reply-' + r.id + '"></textarea>',
    '<button class="btn primary" data-act="reply" data-id="' + r.id + '" data-chat="' + esc(r.chat) + '">Send reply</button>' +
    '<button class="btn" data-act="handled" data-id="' + r.id + '">Mark handled</button>'));
  $('#todo').innerHTML = (callCards.concat(qCards).join('')) || '<p class="empty">Nothing is waiting. New call requests and questions the bot can\'t answer show up here.</p>';

  $('#upcoming').innerHTML = upcoming.length
    ? upcoming.map(r => '<li><span class="pill good">✓ Confirmed</span><b>' + esc(r.name) + '</b><span class="muted">' + esc(r.slot) + '</span><button class="btn small" data-act="done" data-id="' + r.id + '">Call done</button></li>').join('')
    : '<li class="empty">No confirmed calls yet.</li>';

  // ----- chart: messages per day, last 7 days -----
  const days = []; for (let k = today - 6; k <= today; k++) days.push(k);
  const perDay = days.map(k => D.log.filter(r => dayKey(r.at) === k).length);
  const peoplePerDay = days.map(k => new Set(D.log.filter(r => dayKey(r.at) === k).map(r => r.chat)).size);
  const dayName = k => { const d = new Date(k * DAY); return W[d.getUTCDay()] + ' ' + d.getUTCDate(); };
  const max = Math.max(4, ...perDay), top = Math.ceil(max / 4) * 4;
  const cw = 560, ch = 180, pl = 28, pb = 24, bw = (cw - pl) / 7;
  let svg = '<svg viewBox="0 0 ' + cw + ' ' + ch + '" role="img" aria-label="Messages per day, last 7 days">';
  for (let g = 0; g <= 4; g++) { const y = (ch - pb) - (ch - pb - 8) * g / 4; svg += '<line class="grid" x1="' + pl + '" x2="' + cw + '" y1="' + y + '" y2="' + y + '"/><text class="axis" x="' + (pl - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + (top * g / 4) + '</text>'; }
  days.forEach((k, i) => {
    const h = (ch - pb - 8) * perDay[i] / top, x = pl + i * bw + bw * 0.22, w = bw * 0.56, y = ch - pb - h;
    if (perDay[i]) svg += '<path class="bar" d="M' + x + ',' + (ch - pb) + 'V' + (y + 4) + 'q0,-4 4,-4h' + (w - 8) + 'q4,0 4,4V' + (ch - pb) + 'Z"/>';
    svg += '<text class="axis" x="' + (pl + i * bw + bw / 2) + '" y="' + (ch - 6) + '" text-anchor="middle">' + (k === today ? 'Today' : dayName(k)) + '</text>';
    svg += '<rect class="hit" x="' + (pl + i * bw) + '" y="0" width="' + bw + '" height="' + (ch - pb) + '" data-tip="' + esc((k === today ? 'Today' : dayName(k)) + ': ' + perDay[i] + ' messages from ' + peoplePerDay[i] + (peoplePerDay[i] === 1 ? ' person' : ' people')) + '"/>';
  });
  $('#chart').innerHTML = svg + '</svg>';
  $('#chartTable').innerHTML = '<tr><th>Day</th><th>Messages</th><th>People</th></tr>' + days.map((k, i) => '<tr><td>' + dayName(k) + '</td><td>' + perDay[i] + '</td><td>' + peoplePerDay[i] + '</td></tr>').join('');

  // ----- funnel -----
  const steps = [['Started a chat', people.size], ['Asked a question', askedIds.size], ['Requested a call', bookedIds.size], ['Call confirmed', confirmedIds.size]];
  const f0 = Math.max(1, steps[0][1]);
  $('#funnel').innerHTML = steps.map(([t, n], i) => '<div class="fs" title="' + esc(t + ': ' + n) + '"><div class="fl"><span>' + t + '</span><b>' + n + '</b></div><div class="ft"><span class="f' + i + '" style="width:' + (n ? Math.max(3, n / f0 * 100) : 0) + '%"></span></div><div class="muted fp">' + (i ? (steps[i - 1][1] ? Math.round(n / steps[i - 1][1] * 100) + '% of previous step' : '–') : 'everyone') + '</div></div>').join('');

  // ----- what people ask -----
  const counts = {}; D.log.filter(r => /^F\d\d$|^HANDOFF$/.test(r.matched)).forEach(r => { counts[r.matched] = (counts[r.matched] || 0) + 1; });
  const topics = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const tmax = topics.length ? topics[0][1] : 1;
  $('#topics').innerHTML = topics.length ? topics.map(([k, n]) => '<div class="tr" title="' + esc(nameOf(k) + ': ' + n) + '"><span class="tl">' + esc(nameOf(k)) + '</span><span class="tb"><span style="width:' + Math.max(3, n / tmax * 100) + '%"' + (k === 'HANDOFF' ? ' class="alt"' : '') + '></span></span><b>' + n + '</b></div>').join('') : '<p class="empty">No questions yet.</p>';

  // ----- answers status -----
  $('#answers').innerHTML = '<div class="meter"><span style="width:' + (D.faqs.length ? approved / D.faqs.length * 100 : 0) + '%"></span></div><p class="muted">' + approved + ' of ' + D.faqs.length + ' answers approved by Kaushal ji. Draft answers carry a DRAFT tag in the chat.</p>' +
    '<ul class="alist">' + D.faqs.slice().sort((a, b) => a.priority - b.priority).map(f => '<li><span>' + esc(f.label || f.id) + '</span>' + (f.status === 'APPROVED' ? '<span class="pill good">✓ Approved</span>' : '<span class="pill warn">✎ Draft</span>') + '</li>').join('') + '</ul>';

  // ----- conversation feed -----
  const feed = q => {
    const list = D.log.slice().sort(newest).filter(r => !q || (r.name + ' ' + r.said + ' ' + nameOf(r.matched)).toLowerCase().includes(q)).slice(0, 40);
    $('#feed').innerHTML = list.length ? list.map(r => '<tr><td class="muted nowrap">' + ago(r.at) + '</td><td><b>' + esc(r.name) + '</b></td><td>' + esc(r.said) + (r.reply ? '<div class="sent">↳ You replied: ' + esc(r.reply) + '</div>' : '') + '</td><td><span class="chip' + (r.matched === 'HANDOFF' ? ' alt' : '') + '">' + esc(nameOf(r.matched)) + '</span>' + (r.replied ? '' : ' <span class="muted">no reply</span>') + '</td></tr>').join('') : '<tr><td colspan="4" class="empty">No messages match.</td></tr>';
  };
  feed('');
  $('#search').addEventListener('input', e => feed(e.target.value.trim().toLowerCase()));

  // ----- tooltip -----
  const tip = $('#tip');
  document.addEventListener('mousemove', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.getAttribute('data-tip'); tip.hidden = false;
    tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (e.clientY - 34) + 'px';
  });

  // ----- actions -----
  const toast = (msg, bad) => { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); setTimeout(() => { t.className = 'toast'; }, 3500); };
  const ACT = location.pathname.replace(/\/$/, '') + '-act';
  const ask = {
    confirm: b => 'Confirm ' + b.dataset.slot + '? The bot will message them that the call is confirmed.',
    cancel: b => 'Tell them ' + b.dataset.slot + ' does not work, and ask them to pick another time?',
    reply: () => 'Send this reply to them through the bot?',
  };
  document.addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const act = b.dataset.act, body = { action: act, id: Number(b.dataset.id), chat: b.dataset.chat || '', slot: b.dataset.slot || '' };
    if (act === 'reply') { body.text = ($('#reply-' + body.id).value || '').trim(); if (!body.text) { toast('Type a reply first.', true); return; } }
    // Two-tap confirm inside the page (browser pop-ups are blocked in in-app browsers, so no confirm()).
    if (ask[act] && b.dataset.armed !== '1') {
      b.dataset.armed = '1'; b.dataset.label = b.textContent; b.textContent = 'Tap again to send'; b.classList.add('armed');
      toast(ask[act](b) + ' Tap the button again to go ahead.');
      setTimeout(() => { if (b.dataset.armed === '1') { b.dataset.armed = ''; b.textContent = b.dataset.label; b.classList.remove('armed'); } }, 5000);
      return;
    }
    b.dataset.armed = '';
    b.disabled = true; const old = b.dataset.label || b.textContent; b.textContent = 'Working…';
    try {
      const r = await fetch(ACT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      toast({ confirm: 'Confirmed. They got a message.', cancel: 'Done. They were asked to pick another time.', done: 'Marked as done.', reply: 'Reply sent.', handled: 'Marked handled.' }[act]);
      setTimeout(() => location.reload(), 1200);
    } catch (err) { b.disabled = false; b.textContent = old; toast('That did not work (' + err.message + '). Try again.', true); }
  });
  $('#refresh').addEventListener('click', () => location.reload());
  $('#updated').textContent = 'Updated ' + clock(D.now);
  setInterval(() => { if (!document.querySelector('textarea:focus') && ![...document.querySelectorAll('textarea')].some(t => t.value)) location.reload(); }, 60000);
}
// ---------- end browser part ----------

const CSS = `
:root{color-scheme:light;--bg:#f3f3f1;--card:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--muted:#7a7974;--line:#e4e3df;--s1:#2a78d6;--s1soft:#e8f1fc;--s2:#eb6834;
--good:#0ca30c;--goodsoft:#e7f6e7;--warn:#b77900;--warnbar:#fab219;--warnsoft:#fff5dc;--crit:#d03b3b;--f0:#86b6ef;--f1:#5598e7;--f2:#2a78d6;--f3:#1c5cab;--shadow:0 1px 2px rgba(0,0,0,.04),0 4px 16px rgba(0,0,0,.04)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#111110;--card:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--muted:#8f8e86;--line:#2e2e2b;--s1:#3987e5;--s1soft:#1b2a3d;--s2:#d95926;
--good:#0ca30c;--goodsoft:#16291a;--warn:#fab219;--warnbar:#fab219;--warnsoft:#2e2613;--f0:#184f95;--f1:#256abf;--f2:#3987e5;--f3:#6da7ec;--shadow:none}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:20px 16px 48px}
header{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px}
.logo{width:40px;height:40px;border-radius:10px;background:var(--s1);color:#fff;display:grid;place-items:center;font-weight:700;font-size:15px;letter-spacing:.5px}
h1{font-size:20px;margin:0;line-height:1.2}.sub{color:var(--muted);font-size:13px}
.hr{margin-left:auto;display:flex;gap:8px;align-items:center}.live{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ink2);border:1px solid var(--line);border-radius:20px;padding:4px 10px;background:var(--card)}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block}.dot.good{background:var(--good)}.dot.warn{background:var(--warnbar)}
.banner{display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:12px;margin-bottom:16px;border:1px solid var(--line);background:var(--card)}
.banner.warn{background:var(--warnsoft);border-color:transparent}.banner.good{background:var(--goodsoft);border-color:transparent}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:var(--shadow)}
.kpi.hot{border-color:var(--warnbar)}.kt{color:var(--ink2);font-size:12.5px}.kv{font-size:28px;font-weight:650;letter-spacing:-.5px;font-variant-numeric:tabular-nums;line-height:1.3}.ks{color:var(--muted);font-size:12px}
.grid2{display:grid;grid-template-columns:1.35fr 1fr;gap:16px;margin-bottom:16px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px;box-shadow:var(--shadow);min-width:0}
.panel h2{font-size:15px;margin:0 0 2px}.panel .hint{color:var(--muted);font-size:12.5px;margin:0 0 12px}
.todo{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.task{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--bg)}
.task.call{border-left:3px solid var(--s1)}.task.q{border-left:3px solid var(--s2)}
.th{display:flex;align-items:center;gap:10px}.th .tag{margin-left:auto;font-size:11.5px;color:var(--ink2)}
.avatar{width:32px;height:32px;border-radius:50%;background:var(--s1soft);color:var(--s1);display:grid;place-items:center;font-weight:700}
.big{font-size:16px;font-weight:600;margin:10px 0 4px}blockquote{margin:10px 0 8px;padding:8px 10px;border-radius:8px;background:var(--card);border:1px solid var(--line)}
textarea{width:100%;font:inherit;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 10px;resize:vertical}
textarea:focus{outline:2px solid var(--s1);outline-offset:0;border-color:transparent}
.acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.btn{font:inherit;font-size:13px;font-weight:550;padding:7px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
.btn:hover{border-color:var(--ink2)}.btn.primary{background:var(--s1);border-color:var(--s1);color:#fff}.btn.primary:hover{filter:brightness(1.08)}.btn.armed{background:var(--warnbar);border-color:var(--warnbar);color:#1a1a1a;font-weight:600}
.btn.small{padding:4px 10px;font-size:12px;margin-left:auto}.btn:disabled{opacity:.6;cursor:wait}
.upcoming{list-style:none;margin:14px 0 0;padding:0}.upcoming li{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line);flex-wrap:wrap}
.pill{font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:20px;white-space:nowrap}.pill.good{background:var(--goodsoft);color:var(--good)}.pill.warn{background:var(--warnsoft);color:var(--warn)}
svg{width:100%;height:auto;display:block}.grid{stroke:var(--line);stroke-width:1}.axis{fill:var(--muted);font-size:11px}
.bar{fill:var(--s1)}.hit{fill:transparent}.hit:hover{fill:var(--s1soft);fill-opacity:.5}
details{margin-top:8px;font-size:12.5px;color:var(--ink2)}details table{margin-top:6px}
.fs{margin-bottom:12px}.fl{display:flex;justify-content:space-between}.fl b{font-variant-numeric:tabular-nums}
.ft{height:12px;background:var(--bg);border-radius:6px;margin:4px 0 2px;overflow:hidden}.ft span{display:block;height:100%;border-radius:6px}
.f0{background:var(--f0)}.f1{background:var(--f1)}.f2{background:var(--f2)}.f3{background:var(--f3)}.fp{font-size:11.5px}
.tr{display:grid;grid-template-columns:150px 1fr 28px;gap:10px;align-items:center;padding:5px 0}.tl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tb{height:10px;border-radius:5px;background:var(--bg);overflow:hidden}.tb span{display:block;height:100%;border-radius:5px;background:var(--s1)}.tb span.alt{background:var(--s2)}.tr b{text-align:right;font-variant-numeric:tabular-nums}
.meter{height:8px;border-radius:4px;background:var(--bg);overflow:hidden;margin:6px 0}.meter span{display:block;height:100%;background:var(--good)}
.alist{list-style:none;margin:6px 0 0;padding:0;columns:2;column-gap:20px}.alist li{display:flex;justify-content:space-between;gap:8px;padding:5px 0;break-inside:avoid;border-bottom:1px solid var(--line)}
.feedhead{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px}.feedhead input{margin-left:auto;font:inherit;padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:inherit;min-width:220px}
.tablewrap{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px;border-top:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600;font-size:12px;border-top:0}
.chip{font-size:12px;padding:2px 8px;border-radius:20px;background:var(--s1soft);color:var(--s1);white-space:nowrap}.chip.alt{background:var(--warnsoft);color:var(--warn)}
.sent{color:var(--good);font-size:12.5px;margin-top:3px}.muted{color:var(--muted)}.nowrap{white-space:nowrap}.empty{color:var(--muted);margin:4px 0}
.tip{position:fixed;pointer-events:none;background:var(--ink);color:var(--card);font-size:12px;padding:5px 9px;border-radius:6px;white-space:nowrap;z-index:9}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);opacity:0;transition:.25s;background:var(--ink);color:var(--card);padding:10px 16px;border-radius:10px;font-weight:550}
.toast.show{opacity:1;transform:translateX(-50%)}.toast.bad{background:var(--crit);color:#fff}
footer{color:var(--muted);font-size:12px;margin-top:18px;text-align:center}
@media (max-width:960px){.grid2{grid-template-columns:1fr}.alist{columns:1}}
@media (max-width:520px){.hr{margin-left:0}.feedhead input{margin-left:0;width:100%;min-width:0}.tr{grid-template-columns:110px 1fr 24px}}
`;

const json = JSON.stringify(data).replace(/</g, '\\u003c');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>KK bot · Control room</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;550;600;650;700&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body><div class="wrap">
<header><div class="logo">KK</div><div><h1>Research Assistant · Control room</h1><div class="sub">KK Stock Trading Research · lead assistant bot</div></div>
<div class="hr"><span class="live"><span class="dot good"></span>Live · Telegram demo</span><span class="live" id="updated"></span><button class="btn" id="refresh">↻ Refresh</button></div></header>
<div id="banner" class="banner"></div>
<section class="kpis" id="kpis"></section>
<div class="grid2">
<section class="panel"><h2>Needs you</h2><p class="hint">Confirm calls and answer what the bot couldn't. Buttons that message someone need two taps.</p><div class="todo" id="todo"></div>
<h2 style="margin-top:18px">Confirmed calls</h2><ul class="upcoming" id="upcoming"></ul></section>
<section class="panel"><h2>Lead funnel</h2><p class="hint">How far people get, from first message to a confirmed call</p><div id="funnel"></div></section>
</div>
<div class="grid2">
<section class="panel"><h2>Messages per day</h2><p class="hint">Last 7 days, India time. Hover a day for details.</p><div id="chart"></div><details><summary>Show as table</summary><table id="chartTable"></table></details></section>
<section class="panel"><h2>What people ask</h2><p class="hint">Questions by answer. Orange = the bot had to hand it to a person.</p><div id="topics"></div></section>
</div>
<section class="panel" style="margin-bottom:16px"><h2>Answers</h2><div id="answers"></div></section>
<section class="panel"><div class="feedhead"><div><h2>Conversations</h2><p class="hint" style="margin:0">Latest 40 messages and what the bot answered</p></div><input id="search" type="search" placeholder="Search name or message"></div>
<div class="tablewrap"><table><thead><tr><th>When</th><th>Person</th><th>Said</th><th>Bot answered</th></tr></thead><tbody id="feed"></tbody></table></div></section>
<footer>Private page. Don't share the link. Names and messages come from the bot's tables in n8n.</footer>
</div><div class="tip" id="tip" hidden></div><div class="toast" id="toast"></div>
<script id="data" type="application/json">${json}</script>
<script>(${client.toString()})();</script>
</body></html>`;

return [{ json: { html } }];
