// Local test for workflows/t2-route.js: fakes n8n's $() with the kk_faqs rows from knowledge/faqs.csv.
// Run: node scripts/test_t2_route.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'workflows', 't2-route.js'), 'utf8');

// tiny CSV reader (all fields quoted)
const lines = fs.readFileSync(path.join(root, 'knowledge', 'faqs.csv'), 'utf8').trim().split(/\r?\n/);
const parse = l => [...l.matchAll(/"((?:[^"]|"")*)"/g)].map(m => m[1].replace(/""/g, '"'));
const head = parse(lines[0]);
const faqs = lines.slice(1).map(l => Object.fromEntries(parse(l).map((v, i) => [head[i], v])))
  .map(r => ({ faq_id: r.id, priority: Number(r.priority), button_label: r.button_label, keywords: r.keywords, answer: r.answer, status: r.status }));

const run = (update, optedOut = false) => {
  const nodes = {
    'Telegram Trigger': [{ json: update }],
    'Load answers': faqs.map(r => ({ json: r })),
    'Check opt-out': optedOut ? [{ json: { chat_id: '1', opted_out: true } }] : [{ json: {} }],
  };
  const $ = n => ({ first: () => nodes[n][0], all: () => nodes[n] });
  return new Function('$', code)($)[0].json;
};
const msg = (text, o) => run({ message: { chat: { id: 1 }, from: { first_name: 'Asha' }, text } }, o);
const tap = (data, o) => run({ callback_query: { id: 'q', data, from: { first_name: 'Asha' }, message: { chat: { id: 1 } } } }, o);

const cases = [
  ['/start', () => msg('/start'), r => r.matched === 'OPENING' && r.send],
  ['hi → opening', () => msg('Hi!'), r => r.matched === 'OPENING'],
  ['kitna fees', () => msg('kitna fees hai?'), r => r.matched === 'F05'],
  ['should I buy Tata', () => msg('Should I buy Tata Motors?'), r => r.matched === 'F08'],
  ['nifty tomorrow', () => msg('where will nifty go tomorrow'), r => r.matched === 'F08'],
  ['guaranteed profit', () => msg('is profit guaranteed?'), r => r.matched === 'F06'],
  ['typo: gauranteed', () => msg('is profit gauranteed'), r => r.matched === 'F06'],
  ['sebi check', () => msg('are you sebi registered or scam'), r => r.matched === 'F01'],
  ['bot?', () => msg('am I talking to a bot'), r => r.matched === 'F02'],
  ['trade for me', () => msg('can you trade for me'), r => r.matched === 'F04'],
  ['book call', () => msg('I want to book a call'), r => r.matched === 'F09'],
  ['method', () => msg('what is your strategy'), r => r.matched === 'F07'],
  ['tell me more', () => msg('tell me more'), r => r.matched === 'F03'],
  ['STOP', () => msg('STOP'), r => r.matched === 'F10' && r.setOptOut === true && !r.showMenu],
  ['band karo', () => msg('band karo'), r => r.matched === 'F10' && r.setOptOut === true],
  ['stop-loss is NOT stop', () => msg('my stop loss keeps hitting'), r => r.matched !== 'F10' && r.setOptOut === null],
  ['stop panic is NOT stop', () => msg('how do you stop panic selling'), r => r.setOptOut === null],
  ['unknown → hand-off + alert', () => msg('do you have an office in Pune?'), r => r.matched === 'HANDOFF' && r.alert && r.alertText.includes('Pune')],
  ['photo', () => run({ message: { chat: { id: 1 }, from: {} } }), r => r.send && r.text.includes('only read text')],
  ['button F05', () => tap('F05'), r => r.matched === 'F05' && r.isButton && r.text.includes('DRAFT')],
  ['button STOP', () => tap('F10'), r => r.setOptOut === true && !r.showMenu],
  ['button person → alert', () => tap('HANDOFF'), r => r.alert],
  ['opted out: text → silent', () => msg('kitna fees', true), r => r.send === false && !r.alert],
  ['opted out: button → silent', () => tap('F05', true), r => r.send === false && r.isButton],
  ['opted out: /start → back in', () => msg('/start', true), r => r.send && r.setOptOut === false],
  ['answers escape <>', () => msg('sebi'), r => r.text.includes('&gt;')],
];
let fail = 0;
for (const [name, fn, ok] of cases) {
  let r, pass;
  try { r = fn(); pass = ok(r); } catch (e) { pass = false; r = e.message; }
  if (!pass) fail++;
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  → ' + JSON.stringify(r).slice(0, 200)));
}
console.log(`\n${cases.length - fail}/${cases.length} passed`);
process.exit(fail ? 1 : 0);
