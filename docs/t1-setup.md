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

## In n8n (done by Claude through the n8n MCP, 23 Nov)
- Workflow **KK bot T1 - Start + buttons (DRAFT answers)**, id `pcJZgD9Phn5ipV0T`, published (live). Uses the existing "Telegram account" login.
- Source: `workflows/t1-start-and-buttons.sdk.ts` (what was sent to n8n) and `workflows/t1-start-and-buttons.json` (same flow as an import file, as a backup).
- Slice 0 echo is off. Only one workflow can listen to the bot at a time.
- No manual import needed any more: Claude updates the workflow in n8n and commits the same code here.

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
