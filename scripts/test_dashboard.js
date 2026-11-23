// Local test for workflows/dashboard-page.js with made-up rows. Writes the page to a scratch file if a path is given.
// Run: node scripts/test_dashboard.js [out.html]
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'workflows', 'dashboard-page.js'), 'utf8');

const t = h => new Date(Date.now() - h * 3600000).toISOString();
const data = {
  'Read chat log': [
    { id: 1, chat_id: '1', name: 'Asha K', said: '/start', matched: 'OPENING', replied: true, createdAt: t(30) },
    { id: 2, chat_id: '1', name: 'Asha K', said: 'kitna fees', matched: 'F05', replied: true, createdAt: t(5) },
    { id: 3, chat_id: '2', name: 'Ravi', said: 'office in <Pune>?', matched: 'HANDOFF', replied: true, createdAt: t(2) },
    { id: 4, chat_id: '2', name: 'Ravi', said: 'hello', matched: 'SILENT', replied: false, createdAt: t(1) },
  ],
  'Read bookings': [{ id: 1, chat_id: '1', name: 'Asha K', slot_label: 'Tue 24 Nov · 4:00 pm', status: 'requested', createdAt: t(4) }],
  'Read contacts': [{ id: 1, chat_id: '2', opted_out: true }],
  'Read answers': [{ id: 1, faq_id: 'F05', button_label: 'Plans & fees', status: 'DRAFT' }, { id: 2, faq_id: 'HANDOFF', status: 'APPROVED' }],
};
const run = d => new Function('$', code)(n => ({ all: () => d[n].map(json => ({ json })) }))[0].json.html;

const html = run(data);
const empty = run({ 'Read chat log': [{}], 'Read bookings': [{}], 'Read contacts': [{}], 'Read answers': [{}] });
const checks = [
  ['2 people', html.includes('<b>2</b><span>People who chatted')],
  ['4 messages', html.includes('<b>4</b><span>Messages')],
  ['booking shown', html.includes('Tue 24 Nov · 4:00 pm') && html.includes('1 waiting to confirm')],
  ['hand-off escaped', html.includes('office in &lt;Pune&gt;?')],
  ['label used', html.includes('Plans &amp; fees')],
  ['1 opted out', html.includes('<b>1</b><span>Opted out')],
  ['approved 1/2', html.includes('1 / 2')],
  ['no-reply marked', html.includes('(no reply)')],
  ['empty tables ok', empty.includes('No call requests yet.') && empty.includes('<b>0</b><span>People')],
];
let fail = 0;
for (const [n, ok] of checks) { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n); }
if (process.argv[2]) fs.writeFileSync(process.argv[2], html);
console.log(`\n${checks.length - fail}/${checks.length} passed`);
process.exit(fail ? 1 : 0);
