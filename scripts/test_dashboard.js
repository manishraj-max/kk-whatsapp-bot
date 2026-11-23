// Local test for the dashboard code: workflows/dashboard-page.js (page) and workflows/dashboard-action.js (buttons).
// Run: node scripts/test_dashboard.js [out.html]   (out.html = the page with made-up rows, to open in a browser)
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'workflows', f), 'utf8');
const page = read('dashboard-page.js'), action = read('dashboard-action.js');

const t = h => new Date(Date.now() - h * 3600000).toISOString();
const data = {
  'Read chat log': [
    { id: 1, chat_id: '1', name: 'Asha Kumari', said: '/start', matched: 'OPENING', replied: true, createdAt: t(50) },
    { id: 2, chat_id: '1', name: 'Asha Kumari', said: 'kitna fees hai?', matched: 'F05', replied: true, createdAt: t(49) },
    { id: 3, chat_id: '2', name: 'Ravi', said: 'do you have an office in <Pune>?', matched: 'HANDOFF', replied: true, handled: false, createdAt: t(3) },
    { id: 4, chat_id: '3', name: 'Neha S', said: 'is profit guaranteed', matched: 'F06', replied: true, createdAt: t(26) },
    { id: 5, chat_id: '3', name: 'Neha S', said: 'can I talk on Sunday?', matched: 'HANDOFF', replied: true, handled: true, team_reply: 'Sunday is off, Monday works', createdAt: t(25) },
    { id: 6, chat_id: '1', name: 'Asha Kumari', said: '(tapped F09)', matched: 'F09', replied: true, createdAt: t(2) },
    { id: 7, chat_id: '1', name: 'Asha Kumari', said: '(picked slot Tue 24 Nov · 4:00 pm)', matched: 'SLOT', replied: true, createdAt: t(1.9) },
    { id: 8, chat_id: '4', name: 'Vikram', said: 'hello', matched: 'SILENT', replied: false, createdAt: t(80) },
  ],
  'Read bookings': [
    { id: 1, chat_id: '1', name: 'Asha Kumari', slot_label: 'Tue 24 Nov · 4:00 pm', status: 'requested', createdAt: t(1.9) },
    { id: 2, chat_id: '3', name: 'Neha S', slot_label: 'Wed 25 Nov · 11:00 am', status: 'confirmed', createdAt: t(24) },
  ],
  'Read contacts': [{ id: 1, chat_id: '4', opted_out: true }],
  'Read answers': [
    { id: 1, faq_id: 'F05', button_label: 'Plans & fees', status: 'DRAFT', priority: 7 },
    { id: 2, faq_id: 'F06', button_label: 'Is profit guaranteed?', status: 'APPROVED', priority: 3 },
    { id: 3, faq_id: 'F09', button_label: 'Book a call', status: 'DRAFT', priority: 8 },
    { id: 4, faq_id: 'HANDOFF', button_label: 'Talk to a person', status: 'DRAFT', priority: 99 },
  ],
};
const runPage = d => new Function('$', page)(n => ({ all: () => d[n].map(json => ({ json })) }))[0].json.html;
const runAct = body => new Function('$input', action)({ first: () => ({ json: { body } }) })[0].json;
const throws = body => { try { runAct(body); return false; } catch (e) { return true; } };

const html = runPage(data);
const empty = runPage({ 'Read chat log': [{}], 'Read bookings': [{}], 'Read contacts': [{}], 'Read answers': [{}] });
const blob = JSON.parse(html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const checks = [
  ['page has data', blob.log.length === 8 && blob.bookings.length === 2 && blob.optedOut === 1],
  ['handled flag read', blob.log.find(r => r.id === 5).handled === true && blob.log.find(r => r.id === 3).handled === false],
  ['team reply read', blob.log.find(r => r.id === 5).reply.includes('Monday')],
  ['no raw < in data', !html.split('<script id="data"')[1].split('</script>')[0].includes('<Pune>')],
  ['browser script included', html.includes('const ACT = location.pathname')],
  ['empty tables ok', JSON.parse(empty.match(/application\/json">([\s\S]*?)<\/script>/)[1]).log.length === 0],
  ['confirm → message', (r => r.table === 'booking' && r.status === 'confirmed' && r.send && r.text.includes('Tue 24 Nov'))(runAct({ action: 'confirm', id: 1, chat: '1', slot: 'Tue 24 Nov · 4:00 pm' }))],
  ['cancel → message', (r => r.status === 'cancelled' && r.send)(runAct({ action: 'cancel', id: 1, chat: '1', slot: 'x' }))],
  ['done → no message', (r => r.status === 'done' && !r.send)(runAct({ action: 'done', id: 2 }))],
  ['reply escaped', (r => r.table === 'log' && r.handled && r.text === 'see &lt;b&gt;' && r.reply === 'see <b>')(runAct({ action: 'reply', id: 3, chat: '2', text: ' see <b> ' }))],
  ['handled → no message', (r => r.handled && !r.send)(runAct({ action: 'handled', id: 3 }))],
  ['empty reply refused', throws({ action: 'reply', id: 3, chat: '2', text: '  ' })],
  ['bad chat refused', throws({ action: 'confirm', id: 1, chat: 'abc', slot: 'x' })],
  ['no id refused', throws({ action: 'done' })],
  ['unknown refused', throws({ action: 'delete', id: 1 })],
];
let fail = 0;
for (const [n, ok] of checks) { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n); }
if (process.argv[2]) fs.writeFileSync(process.argv[2], html);
console.log(`\n${checks.length - fail}/${checks.length} passed`);
process.exit(fail ? 1 : 0);
