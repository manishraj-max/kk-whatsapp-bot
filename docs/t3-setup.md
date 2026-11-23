# T3: book a call + chat log

Live in n8n: workflow `pcJZgD9Phn5ipV0T` (same bot, now 18 boxes). Built and published by Claude through the n8n MCP on 23 Nov.

## What's new
| Before (T2) | Now (T3) |
|---|---|
| "Book a call" replied "available at: [slots]" | It shows **4 time buttons** (next 2 days that aren't Sunday, 11:00 am and 4:00 pm India time) plus "Talk to a person" |
| — | Tapping a time → "✅ Request noted", saved in **`kk_bookings`** (status `requested`), and you get a 📅 alert |
| No record of chats | **Every message** gets a row in **`kk_chat_log`**: who, what they said, which answer it got, and whether the bot replied |

The times are **demo times** and every slot reply says so. Kaushal sets the real days and hours, and that's the only part that changes in Route (`SLOT_HOURS`, and which days count).

## Flow (new parts in bold)
```
Telegram Trigger → 1 Read (opt-out, answers) → 2 Route
   ├─ Button press? → Answer button
   ├─ Reply? → **Which keyboard?** ─ menu  → Send with menu
   │                                ├ slots → **Send with slots**
   │                                └ none  → Send plain
   ├─ 3 Remember STOP
   ├─ 4 Alert Manish        (hand-off 🔔 and now booking 📅)
   ├─ **5 Save booking**    → kk_bookings
   └─ **6 Log every message** → kk_chat_log
```

## The tables now
| Table | Holds | Who edits it |
|---|---|---|
| `kk_faqs` | the 10 answers + hand-off | you / Kaushal (answers, keywords, DRAFT → APPROVED) |
| `kk_contacts` | who said STOP | the bot |
| `kk_bookings` | call requests | the bot adds; you change `status` to `confirmed` / `done` |
| `kk_chat_log` | every message | the bot; we read it for the demo numbers |

Chat logs and bookings hold leads' names and messages, so they stay in n8n and never go into GitHub.

## Test in Telegram (tick each)
- [ ] Tap **Book a call** → "available at: the times below" + 4 time buttons + Talk to a person
- [ ] Type "I want to book a call" → same
- [ ] Tap a time → "✅ Request noted: Tue 24 Nov · 11:00 am…", the menu comes back, you get a 📅 alert
- [ ] `kk_bookings` has your row (I'll check it)
- [ ] `kk_chat_log` has a row for each message you sent (I'll check it)
- [ ] Everything from T2 still works (try "kitna fees")

## Files
- `workflows/t3-route.js`: Route code (same as in n8n)
- `workflows/t3-update-ops.json`: the exact changes sent to n8n on top of T2
- `scripts/test_t3_route.js`: 36 local cases, all pass

## Known gaps (for the demo / later)
- The same slot can be booked twice. Fine for a demo; a real calendar comes later.
- No reminder before the call yet.
- Telegram can resend an update, so a reply (and a log row) can occasionally come twice.
