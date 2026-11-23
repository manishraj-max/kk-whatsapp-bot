# KK WhatsApp bot

Private. WhatsApp assistant for a SEBI-registered research analyst's business: answers FAQs with **pre-approved text only**, books meetings, and hands anything else to a human. Built with n8n (workflow), Claude (intent labels only) and a plain-code guardrail.

Status: **Telegram prototype** (zero cost: Telegram + n8n + Google Sheet, buttons and keyword matching, no Claude yet). Nothing talks to real leads. All answers are DRAFT until Kaushal and compliance approve.

## Rules
- The bot picks approved answers; it never writes advice, names stocks or promises returns.
- No tokens, lead lists, phone numbers or chat logs in this repo.
- Every n8n change is made through the n8n MCP and the same code is committed to `workflows/` (no secrets inside; credentials are referenced by id only).

## Layout
| Folder | Holds |
|---|---|
| `workflows/` | n8n workflow exports (JSON) |
| `knowledge/` | approved answers (id, topic, text, approved_on) |
| `guardrail/` | blocked patterns + the test set |
| `prompts/` | the intent-labelling prompt |
| `docs/` | architecture, decisions, setup steps |
| `scripts/` | build the workflows from `knowledge/` |

## Build slices (Telegram prototype first, 23 Nov)
| Slice | What | Status |
|---|---|---|
| T0 | Telegram echo bot in n8n | ✅ works (switch to Active) |
| T1 | `/start` → opening message + 6 buttons; FAQ answers built from `knowledge/faqs.csv` (`scripts/build_t1.py`; Sheet later) | ✅ live and tested by Manish, 23 Nov (n8n `pcJZgD9Phn5ipV0T`) |
| T2 | Keyword matching for typed text, advice refusal, STOP memory, hand-off alert to Manish; answers in n8n Data table `kk_faqs` (`docs/t2-setup.md`) | ✅ live and tested by Manish, 23 Nov |
| T3 | Book a call (slots) + log every chat to a Data table | next |
| T4 | Demo to Kaushal: walk through the flow, collect his answers for the `[ ]` gaps | not started |
| Later | WhatsApp adapter, Claude intent labels, guardrail, pilot (backend and cost decided after the demo) | parked |

Knowledge: `knowledge/opening_message.md` (Version A, finalised 19 Nov) · `knowledge/faqs.csv` (10 FAQs + hand-off).
