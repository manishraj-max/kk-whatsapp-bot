// T2 router (n8n Code node "Route", mode: run once for all items).
// Reads: Telegram Trigger (the update), Check opt-out (this chat's row, if any), Load answers (kk_faqs table).
// Decides one reply. Never writes advice: every answer comes from the kk_faqs table.

const OPENING = "Hi {{1}},\n\nDoes your trading look like this?\n❌ Panic stop-loss hit, then the stock rallies without you\n❌ Random entry and exit points\n❌ Trades driven by fear or greed\n❌ Scalping intraday against machines faster than you\n❌ Acting on \"tips\" you can't verify\n\nIf your portfolio keeps slipping, the problem is usually the method, not the market.\n\n*KK Stock Trading Research* helps you trade on research, not noise: a clear reason behind every idea, with planned entry, exit and risk levels.\n\n📈 *Transforming your speculation into research-based trading.*\n\nWould you like to see how it works?\n\nKaushal Kumar · SEBI Registered Research Analyst · INH000031587\n_Investments in the securities market are subject to market risks. Read all related documents carefully before investing. Registration granted by SEBI and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors._\n\nReply STOP to opt out";
const DRAFT_TAG = '\n\n<i>[DRAFT answer, not yet approved]</i>';
const GREETINGS = ['hi', 'hii', 'hello', 'hey', 'namaste', 'namaskar', 'good morning', 'good evening'];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = s => esc(s).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>');
const norm = s => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9%'\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const upd = $('Telegram Trigger').first().json;
const faqs = $('Load answers').all().map(i => i.json).filter(r => r.faq_id)
  .sort((a, b) => Number(a.priority) - Number(b.priority));
const byId = Object.fromEntries(faqs.map(r => [r.faq_id, r]));
const contact = $('Check opt-out').all().map(i => i.json).find(r => r.chat_id);
const optedOut = !!(contact && contact.opted_out);

const answerText = id => {
  const r = byId[id];
  if (!r) return 'Sorry, that is not set up yet. Someone from our team will reply.';
  return fmt(r.answer) + (r.status === 'APPROVED' ? '' : DRAFT_TAG);
};

// Does the message match this FAQ? STOP words count only as the whole message
// (so "stop-loss" or "how do you stop panic" never opts anyone out); phrases can appear anywhere.
const matches = (r, text) => {
  const kws = String(r.keywords || '').split('|').map(k => norm(k)).filter(Boolean);
  return kws.some(k => {
    if (r.faq_id === 'F10' && !k.includes(' ')) return text === k;
    return new RegExp('(^|[^a-z0-9])' + reEsc(k) + '($|[^a-z0-9])').test(text);
  });
};

const out = {
  chatId: null, text: '', send: true, showMenu: true,
  isButton: false, callbackId: null,
  setOptOut: null,            // true = save opt-out, false = remove it, null = no change
  alert: false, alertText: '',
  matched: null,              // which FAQ answered (for the log in T3)
};
let who, said;

if (upd.callback_query) {
  const q = upd.callback_query;
  out.chatId = q.message.chat.id; out.isButton = true; out.callbackId = q.id;
  who = q.from || {}; said = '(tapped ' + q.data + ')';
  if (optedOut) { out.send = false; }                       // old buttons after STOP: stay quiet
  else {
    out.matched = q.data;
    out.text = answerText(q.data);
    if (q.data === 'F10') { out.setOptOut = true; out.showMenu = false; }
    if (q.data === 'HANDOFF') { out.alert = true; said = '(tapped Talk to a person)'; }
  }
} else {
  const m = upd.message || {};
  out.chatId = m.chat ? m.chat.id : null;
  who = m.from || {}; said = m.text || '';
  const text = norm(said);
  const isStart = text === '/start' || text === 'start' || said.trim().startsWith('/start');

  if (isStart) {
    if (optedOut) out.setOptOut = false;                     // they asked to hear from us again
    out.matched = 'OPENING';
    out.text = fmt(OPENING.replace('{{1}}', who.first_name || 'there'));
  } else if (optedOut) {
    out.send = false;                                         // opted out: never reply
  } else if (!m.text) {
    out.text = 'I can only read text for now. Please type your question or tap a button.';
  } else if (GREETINGS.includes(text)) {
    out.matched = 'OPENING';
    out.text = fmt(OPENING.replace('{{1}}', who.first_name || 'there'));
  } else {
    const hit = faqs.find(r => r.faq_id !== 'HANDOFF' && matches(r, text));
    if (hit) {
      out.matched = hit.faq_id;
      out.text = answerText(hit.faq_id);
      if (hit.faq_id === 'F10') { out.setOptOut = true; out.showMenu = false; }
    } else {
      out.matched = 'HANDOFF';
      out.text = answerText('HANDOFF');
      out.alert = true;
    }
  }
}

if (out.alert) {
  const name = [who.first_name, who.last_name].filter(Boolean).join(' ') || 'Someone';
  out.alertText = '🔔 KK bot: a person needs to reply\n'
    + 'From: ' + name + (who.username ? ' (@' + who.username + ')' : '') + '\n'
    + 'Message: ' + said;
}
out.hasOptOutChange = out.setOptOut !== null;
return [{ json: out }];
