# KK WhatsApp bot

Private. WhatsApp assistant for a SEBI-registered research analyst's business: answers FAQs with **pre-approved text only**, books meetings, and hands anything else to a human. Built with n8n (workflow), Claude (intent labels only) and a plain-code guardrail.

Status: **slice 0** (Telegram echo bot, practice for the webhook flow). Nothing talks to real leads yet.

## Rules
- The bot picks approved answers; it never writes advice, names stocks or promises returns.
- No tokens, lead lists, phone numbers or chat logs in this repo.
- Export each n8n workflow to `workflows/` after every working change (no credentials inside).

## Layout
| Folder | Holds |
|---|---|
| `workflows/` | n8n workflow exports (JSON) |
| `knowledge/` | approved answers (id, topic, text, approved_on) |
| `guardrail/` | blocked patterns + the test set |
| `prompts/` | the intent-labelling prompt |
| `docs/` | architecture and decisions |

## Build slices
| Slice | What | Status |
|---|---|---|
| 0 | Telegram echo bot in n8n | in progress |
| 1 | Echo on a WhatsApp test number | not started |
| 2 | Intent labels + approved answers + guardrail | not started |
| 3 | STOP, hand-off, rep alert | not started |
| 4 | Booking + reminders | not started |
| 5 | Logs + weekly report | not started |
| 6–7 | Internal test, then a consented pilot | not started |
