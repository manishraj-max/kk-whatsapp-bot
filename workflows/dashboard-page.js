// Dashboard page (n8n Code node "Build page", mode: run once for all items).
// Reads the 4 bot tables and returns one HTML page: numbers on top, then bookings,
// people waiting for a reply, what people ask, and the latest messages.
// Read-only: it never changes a table.

const rows = n => $(n).all().map(i => i.json).filter(r => r && r.id !== undefined);
const log = rows('Read chat log');
const bookings = rows('Read bookings');
const contacts = rows('Read contacts');
const faqs = rows('Read answers');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ms = r => new Date(r.createdAt || 0).getTime();
const newest = (a, b) => ms(b) - ms(a);
const when = r => {
  if (!r.createdAt) return '';
  const d = new Date(ms(r) + 330 * 60000);                 // India time
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  const h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, '0');
  return d.getUTCDate() + ' ' + M + ', ' + ((h % 12) || 12) + ':' + m + (h < 12 ? ' am' : ' pm');
};
const NOW = (typeof $now !== 'undefined' && $now.toMillis) ? $now.toMillis() : Date.now();

// Labels for what the bot answered
const label = Object.fromEntries(faqs.map(f => [f.faq_id, f.button_label || f.faq_id]));
Object.assign(label, { OPENING: 'Opening message', SLOT: 'Picked a call time', SILENT: 'Silent (opted out)', NON_TEXT: 'Photo / voice', HANDOFF: 'Needs a person' });
const nameOf = id => label[id] || id || '?';

// Numbers
const people = new Set(log.map(r => r.chat_id)).size;
const today = log.filter(r => NOW - ms(r) < 86400000).length;
const handoffs = log.filter(r => r.matched === 'HANDOFF');
const optedOut = contacts.filter(r => r.opted_out === true || r.opted_out === 'true').length;
const pending = bookings.filter(r => r.status === 'requested').length;
const approved = faqs.filter(f => f.status === 'APPROVED').length;

const tiles = [
  ['People who chatted', people, ''],
  ['Messages', log.length, today + ' in the last 24 h'],
  ['Call requests', bookings.length, pending + ' waiting to confirm'],
  ['Needed a person', handoffs.length, 'questions the bot could not answer'],
  ['Opted out', optedOut, 'said STOP'],
  ['Answers approved', approved + ' / ' + faqs.length, 'rest are DRAFT'],
];

// What people ask (count by answer)
const counts = {};
for (const r of log) counts[r.matched] = (counts[r.matched] || 0) + 1;
const topics = Object.entries(counts).sort((a, b) => b[1] - a[1]);
const maxCount = topics.length ? topics[0][1] : 1;

const table = (head, body, empty) => body.length
  ? '<table><thead><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + body.join('') + '</tbody></table>'
  : '<p class="empty">' + empty + '</p>';

const bookingRows = bookings.sort(newest).map(r =>
  '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.slot_label) + '</td><td><span class="pill ' + esc(r.status) + '">' + esc(r.status) + '</span></td><td class="muted">' + when(r) + '</td></tr>');
const handoffRows = handoffs.sort(newest).slice(0, 15).map(r =>
  '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.said) + '</td><td class="muted">' + when(r) + '</td></tr>');
const topicRows = topics.map(([k, n]) =>
  '<tr><td>' + esc(nameOf(k)) + '</td><td class="bar"><span style="width:' + Math.max(4, Math.round(n / maxCount * 100)) + '%"></span></td><td class="num">' + n + '</td></tr>');
const logRows = log.sort(newest).slice(0, 25).map(r =>
  '<tr><td class="muted">' + when(r) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.said) + '</td><td>' + esc(nameOf(r.matched)) + (r.replied === false || r.replied === 'false' ? ' <span class="muted">(no reply)</span>' : '') + '</td></tr>');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="60"><title>KK bot dashboard</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#1c2330;--muted:#6b7380;--line:#e3e6ea;--accent:#1f7a5a;--warn:#b26a00}
@media (prefers-color-scheme:dark){:root{--bg:#12151a;--card:#1b2028;--ink:#e8ebef;--muted:#9aa3ae;--line:#2b323c;--accent:#4cc394;--warn:#f0a83a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1000px;margin:0 auto;padding:20px 16px 40px}
h1{font-size:22px;margin:0 0 2px}h2{font-size:16px;margin:0 0 10px}.sub{color:var(--muted);margin:0 0 18px;font-size:13px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.tile,.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
.tile b{display:block;font-size:26px;font-variant-numeric:tabular-nums}.tile span{font-size:13px}.tile small{display:block;color:var(--muted);font-size:12px}
.card{margin-bottom:14px;overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:7px 8px;border-top:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600;border-top:0;font-size:12px}
.muted{color:var(--muted);white-space:nowrap}.num{text-align:right;font-variant-numeric:tabular-nums;width:40px}
.bar{width:55%}.bar span{display:block;height:10px;border-radius:5px;background:var(--accent)}
.pill{font-size:12px;padding:2px 8px;border-radius:10px;border:1px solid var(--line)}.pill.requested{color:var(--warn);border-color:var(--warn)}.pill.confirmed,.pill.done{color:var(--accent);border-color:var(--accent)}
.empty{color:var(--muted);margin:0}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media (max-width:720px){.two{grid-template-columns:1fr}}
</style></head><body><main>
<h1>KK bot dashboard</h1>
<p class="sub">Telegram prototype · updated ${esc(when({ createdAt: new Date(NOW).toISOString() }))} India time · refreshes every minute · read-only</p>
<section class="tiles">${tiles.map(([t, v, s]) => '<div class="tile"><b>' + esc(v) + '</b><span>' + t + '</span><small>' + s + '</small></div>').join('')}</section>
<section class="card"><h2>📅 Call requests</h2>${table(['Name', 'Time asked for', 'Status', 'Asked on'], bookingRows, 'No call requests yet.')}</section>
<div class="two">
<section class="card"><h2>🔔 Waiting for a person</h2>${table(['Name', 'Message', 'When'], handoffRows, 'Nobody is waiting.')}</section>
<section class="card"><h2>💬 What people ask</h2>${table(['Answer', '', 'Times'], topicRows, 'No messages yet.')}</section>
</div>
<section class="card"><h2>🕒 Latest messages</h2>${table(['When', 'Name', 'They said', 'Bot answered'], logRows, 'No messages yet.')}</section>
</main></body></html>`;

return [{ json: { html } }];
