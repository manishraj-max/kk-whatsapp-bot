# T1: /start + buttons, setup and test

Workflow: `workflows/t1-start-and-buttons.json` (built by `scripts/build_t1.py` from `knowledge/`).

## Flow
```
Telegram Trigger (message + button press)
  └─ Route (Code): /start → opening message · button → its FAQ answer · typed text → "please tap a button"
       ├─ Button press? ── yes → Answer button   (stops the loading spinner on the button)
       └─ Show menu?   ── yes → Send with menu   (answer + the 6 buttons again)
                        └─ no  → Send plain      (only after STOP)
```
Every answer ends with *[DRAFT answer, not yet approved]* until its row in `faqs.csv` says APPROVED.

## Import (about 5 minutes)
1. In n8n, open the Slice 0 echo workflow and switch it **off** (a bot has one webhook; two active workflows fight over it).
2. New workflow → ⋯ → **Import from File** → `workflows/t1-start-and-buttons.json`.
3. Open **Telegram Trigger**, **Answer button**, **Send with menu** and **Send plain** one by one and pick your existing Telegram credential in each.
4. Save, then switch the workflow **Active**.

## Test in Telegram (tick each)
- [ ] `/start` → opening message with your first name, bold name and tagline, italic disclaimer, 6 buttons
- [ ] Each of the 6 buttons → its answer + the DRAFT tag; the menu comes back (except STOP)
- [ ] The button stops spinning after a tap
- [ ] Type "kitna fees" → "please tap one of the buttons" (keywords come in T2)
- [ ] STOP → confirmation, no menu

If a node shows an error, open the failed execution in n8n and send me a screenshot of the red node.

## Changing an answer
Edit `knowledge/faqs.csv` (or the opening message), run `python scripts/build_t1.py`, and re-import (or paste the new code into the Route node).

## Known gaps (on purpose, for T2/T3)
- Typed questions: no keyword matching yet.
- STOP doesn't remember the opt-out yet; Talk to a person doesn't alert you yet.
- Telegram can resend an update, so a reply can come twice (idempotency comes later).
- Answers live inside the workflow for now. Moving them to a Google Sheet is one node swap, done when Kaushal starts editing the wording.
