// Dashboard actions (n8n Code node "Check action", mode: run once for all items).
// Input: POST body from a dashboard button. Output: one item saying which table row to change,
// and whether the bot should message the lead (and what).
const b = $input.first().json.body || {};
const action = String(b.action || '');
const id = Number(b.id);
if (!Number.isInteger(id) || id < 1) throw new Error('Missing row id');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const DEMO = '\n\n<i>[DEMO: Telegram prototype]</i>';
const out = { table: '', id, status: '', handled: false, reply: '', send: false, chatId: String(b.chat || ''), text: '' };

if (action === 'confirm') {
  Object.assign(out, { table: 'booking', status: 'confirmed', send: true,
    text: '✅ Your call is confirmed: <b>' + esc(b.slot) + '</b>.\nKaushal ji\'s team will call you at that time.' + DEMO });
} else if (action === 'cancel') {
  Object.assign(out, { table: 'booking', status: 'cancelled', send: true,
    text: 'Sorry, <b>' + esc(b.slot) + '</b> doesn\'t work for us after all. Please tap <b>Book a call</b> to pick another time.' + DEMO });
} else if (action === 'done') {
  Object.assign(out, { table: 'booking', status: 'done' });
} else if (action === 'reply') {
  const text = String(b.text || '').trim().slice(0, 1000);
  if (!text) throw new Error('Empty reply');
  Object.assign(out, { table: 'log', handled: true, reply: text, send: true, text: esc(text) });
} else if (action === 'handled') {
  Object.assign(out, { table: 'log', handled: true });
} else {
  throw new Error('Unknown action');
}
if (out.send && !/^-?\d+$/.test(out.chatId)) throw new Error('Bad chat id');
return [{ json: out }];
