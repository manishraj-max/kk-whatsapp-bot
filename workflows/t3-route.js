// T3 router (n8n Code node "Route", mode: run once for all items).
// Reads: Telegram Trigger (the update), Check opt-out (this chat's row, if any), Load answers (kk_faqs table).
// Decides one reply, which keyboard to show, and what to log / save / alert.
// Never writes advice: every answer comes from the kk_faqs table.

const OPENING = "Hi {{1}},\n\nDoes your trading look like this?\n❌ Panic stop-loss hit, then the stock rallies without you\n❌ Random entry and exit points\n❌ Trades driven by fear or greed\n❌ Scalping intraday against machines faster than you\n❌ Acting on \"tips\" you can't verify\n\nIf your portfolio keeps slipping, the problem is usually the method, not the market.\n\n*KK Stock Trading Research* helps you trade on research, not noise: a clear reason behind every idea, with planned entry, exit and risk levels.\n\n📈 *Transforming your speculation into research-based trading.*\n\nWould you like to see how it works?\n\nKaushal Kumar · SEBI Registered Research Analyst · INH000031587\n_Investments in the securities market are subject to market risks. Read all related documents carefully before investing. Registration granted by SEBI and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors._\n\nReply STOP to opt out";
const DRAFT_TAG = '\n\n<i>[DRAFT answer, not yet approved]</i>';
const DEMO_TAG = '\n\n<i>[DEMO times: Kaushal ji will set the real ones]</i>';
const GREETINGS = ['hi', 'hii', 'hello', 'hey', 'namaste', 'namaskar', 'good morning', 'good evening'];

// Demo call slots: next 2 days that aren't Sunday, at 11:00 and 16:00 India time.
const SLOT_HOURS = [11, 16];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NOW_MS = (typeof $now !== 'undefined' && $now.toMillis) ? $now.toMillis() : Date.now();

const nextSlots = () => {
  const ist = new Date(NOW_MS + 330 * 60000);             // UTC fields of this = India time
  let day = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const slots = [];
  while (slots.length < 4) {
    day += 86400000;
    const d = new Date(day);
    if (d.getUTCDay() === 0) continue;                    // no Sundays
    for (const h of SLOT_HOURS) {
      const date = d.toISOString().slice(0, 10);
      const time = h === 11 ? '11:00 am' : '4:00 pm';
      slots.push({ key: date + '-' + h, label: DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' · ' + time });
    }
  }
  return slots.slice(0, 4);
};
const slotLabel = key => {
  const m = /^(\d{4})-(\d{2})-(\d{2})-(\d{1,2})$/.exec(key || '');
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' · ' + (m[4] === '11' ? '11:00 am' : '4:00 pm');
};

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
  let a = r.answer;
  if (id === 'F09') a = a.replace('[slots]', 'the times below');
  return fmt(a) + (r.status === 'APPROVED' ? '' : DRAFT_TAG) + (id === 'F09' ? DEMO_TAG : '');
};

// STOP words count only as the whole message (so "stop-loss" never opts anyone out); phrases can appear anywhere.
const matches = (r, text) => {
  const kws = String(r.keywords || '').split('|').map(k => norm(k)).filter(Boolean);
  return kws.some(k => {
    if (r.faq_id === 'F10' && !k.includes(' ')) return text === k;
    return new RegExp('(^|[^a-z0-9])' + reEsc(k) + '($|[^a-z0-9])').test(text);
  });
};

const slots = nextSlots();
const out = {
  chatId: null, text: '', send: true,
  keyboard: 'menu',           // menu | slots | none
  showMenu: true,
  isButton: false, callbackId: null,
  setOptOut: null,            // true = save opt-out, false = remove it, null = no change
  alert: false, alertText: '', alertKind: '',
  isBooking: false, slotKey: '', slotLabel: '',
  matched: null,              // what answered: OPENING, F01..F10, HANDOFF, SLOT, SILENT, NON_TEXT
  slots,
};
let who, said;

const pick = id => {
  out.matched = id;
  out.text = answerText(id);
  if (id === 'F10') { out.setOptOut = true; out.keyboard = 'none'; }
  if (id === 'F09') out.keyboard = 'slots';
  if (id === 'HANDOFF') { out.alert = true; out.alertKind = 'handoff'; }
};

if (upd.callback_query) {
  const q = upd.callback_query;
  out.chatId = q.message.chat.id; out.isButton = true; out.callbackId = q.id;
  who = q.from || {}; said = '(tapped ' + q.data + ')';
  if (optedOut) { out.send = false; out.matched = 'SILENT'; }
  else if (String(q.data).startsWith('SLOT|')) {
    const key = q.data.slice(5);
    const label = slotLabel(key);
    out.matched = 'SLOT';
    if (label) {
      out.isBooking = true; out.slotKey = key; out.slotLabel = label;
      out.text = '✅ Request noted: <b>' + esc(label) + '</b>.\nSomeone from our team will confirm the call on this chat.' + DEMO_TAG;
      out.alert = true; out.alertKind = 'booking';
      said = '(picked slot ' + label + ')';
    } else {
      out.text = 'Sorry, that time is no longer available. Please pick another one.';
      out.keyboard = 'slots';
    }
  } else {
    pick(q.data);
    if (q.data === 'HANDOFF') said = '(tapped Talk to a person)';
  }
} else {
  const m = upd.message || {};
  out.chatId = m.chat ? m.chat.id : null;
  who = m.from || {}; said = m.text || '';
  const text = norm(said);
  const isStart = text === '/start' || text === 'start' || said.trim().startsWith('/start');

  if (isStart) {
    if (optedOut) out.setOptOut = false;
    out.matched = 'OPENING';
    out.text = fmt(OPENING.replace('{{1}}', who.first_name || 'there'));
  } else if (optedOut) {
    out.send = false; out.matched = 'SILENT';
  } else if (!m.text) {
    out.matched = 'NON_TEXT'; said = '(non-text message)';
    out.text = 'I can only read text for now. Please type your question or tap a button.';
  } else if (GREETINGS.includes(text)) {
    out.matched = 'OPENING';
    out.text = fmt(OPENING.replace('{{1}}', who.first_name || 'there'));
  } else {
    const hit = faqs.find(r => r.faq_id !== 'HANDOFF' && matches(r, text));
    pick(hit ? hit.faq_id : 'HANDOFF');
  }
}

out.showMenu = out.keyboard !== 'none';
out.name = [who.first_name, who.last_name].filter(Boolean).join(' ') || 'Someone';
out.said = String(said).slice(0, 500);
if (out.alert) {
  const from = 'From: ' + out.name + (who.username ? ' (@' + who.username + ')' : '');
  out.alertText = out.alertKind === 'booking'
    ? '📅 KK bot: call request\n' + from + '\nSlot: ' + out.slotLabel
    : '🔔 KK bot: a person needs to reply\n' + from + '\nMessage: ' + out.said;
}
out.hasOptOutChange = out.setOptOut !== null;
return [{ json: out }];
