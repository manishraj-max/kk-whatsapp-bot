"""Build workflows/t1-start-and-buttons.json from knowledge/.

The CSV and the opening message stay the single source of truth: edit them,
run `python scripts/build_t1.py`, re-import the workflow in n8n.
"""
import csv, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
KNOW = ROOT / "knowledge"

# Opening message = the text between the first two '---' lines
md = (KNOW / "opening_message.md").read_text(encoding="utf-8")
opening = md.split("\n---\n")[1].strip()

faqs = {}
with open(KNOW / "faqs.csv", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        faqs[r["id"]] = {"label": r["button_label"], "answer": r["answer"], "status": r["status"]}

# Menu = the rows that have a button label, in CSV order, two per row
ORDER = ["F03", "F05", "F01", "F09", "HANDOFF", "F10"]  # menu order; other labelled rows go last
buttons = [(i, faqs[i]["label"]) for i in ORDER if faqs.get(i, {}).get("label")]
buttons += [(i, v["label"]) for i, v in faqs.items() if v["label"] and i not in ORDER]
rows = [buttons[k:k + 2] for k in range(0, len(buttons), 2)]

js = r"""// T1 router. Built by scripts/build_t1.py from knowledge/ - do not hand-edit.
const OPENING = %s;
const FAQS = %s;
const DRAFT_TAG = '\n\n<i>[DRAFT answer, not yet approved]</i>';

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// *bold* and _italic_ from the WhatsApp text -> Telegram HTML
const fmt = s => esc(s).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>');

const j = $json;
if (j.callback_query) {
  const q = j.callback_query;
  const id = q.data;
  const faq = FAQS[id];
  const text = faq ? fmt(faq.answer) + (faq.status === 'DRAFT' ? DRAFT_TAG : '') : 'Sorry, that button is not set up yet.';
  return { json: { chatId: q.message.chat.id, text, isButton: true, callbackId: q.id, showMenu: id !== 'F10' } };
}

const m = j.message || {};
const chatId = m.chat ? m.chat.id : null;
const said = (m.text || '').trim();
if (said.startsWith('/start')) {
  const name = (m.from && m.from.first_name) || 'there';
  return { json: { chatId, text: fmt(OPENING.replace('{{1}}', name)), isButton: false, showMenu: true } };
}
// T1 only answers buttons. Typed questions (keywords, refusal, STOP) come in T2.
return { json: { chatId, text: 'Thanks! For now please tap one of the buttons below. Typed questions come in the next version.', isButton: false, showMenu: true } };
""" % (json.dumps(opening, ensure_ascii=False), json.dumps(faqs, ensure_ascii=False, indent=1))

keyboard = {"rows": [{"row": {"buttons": [
    {"text": label, "additionalFields": {"callback_data": fid}} for fid, label in row]}} for row in rows]}

def send(name, pos, with_menu):
    p = {"chatId": "={{ $json.chatId }}", "text": "={{ $json.text }}",
         "additionalFields": {"appendAttribution": False, "parse_mode": "HTML"}}
    if with_menu:
        p["replyMarkup"] = "inlineKeyboard"
        p["inlineKeyboard"] = keyboard
    return {"parameters": p, "name": name, "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": pos}

def if_node(name, field, pos):
    return {"parameters": {"conditions": {"boolean": [{"value1": "={{ $json.%s }}" % field, "value2": True}]}},
            "name": name, "type": "n8n-nodes-base.if", "typeVersion": 1, "position": pos}

wf = {
    "name": "T1 - Start + buttons (DRAFT answers)",
    "nodes": [
        {"parameters": {"updates": ["message", "callback_query"], "additionalFields": {}},
         "name": "Telegram Trigger", "type": "n8n-nodes-base.telegramTrigger", "typeVersion": 1.1, "position": [0, 100]},
        {"parameters": {"mode": "runOnceForEachItem", "jsCode": js},
         "name": "Route", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [240, 100]},
        if_node("Button press?", "isButton", [480, -60]),
        {"parameters": {"resource": "callback", "operation": "answerQuery", "queryId": "={{ $json.callbackId }}", "additionalFields": {}},
         "name": "Answer button", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [720, -80]},
        if_node("Show menu?", "showMenu", [480, 200]),
        send("Send with menu", [720, 120], True),
        send("Send plain", [720, 300], False),
    ],
    "connections": {
        "Telegram Trigger": {"main": [[{"node": "Route", "type": "main", "index": 0}]]},
        "Route": {"main": [[{"node": "Button press?", "type": "main", "index": 0},
                            {"node": "Show menu?", "type": "main", "index": 0}]]},
        "Button press?": {"main": [[{"node": "Answer button", "type": "main", "index": 0}], []]},
        "Show menu?": {"main": [[{"node": "Send with menu", "type": "main", "index": 0}],
                                [{"node": "Send plain", "type": "main", "index": 0}]]},
    },
    "settings": {"executionOrder": "v1"},
}

out = ROOT / "workflows" / "t1-start-and-buttons.json"
out.write_text(json.dumps(wf, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"wrote {out.name}: {len(faqs)} answers, {len(buttons)} buttons in {len(rows)} rows")
