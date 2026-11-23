# T2: typed questions, refusal, STOP memory, hand-off alert

Live in n8n: workflow `pcJZgD9Phn5ipV0T` (same workflow as T1, grown from 7 to 14 boxes). Built and published by Claude through the n8n MCP on 23 Nov.

## What's new
| Before (T1) | Now (T2) |
|---|---|
| Typed text → "please tap a button" | Typed text is matched against keywords, e.g. "kitna fees" → Plans & fees |
| Answers inside the workflow | Answers in the n8n **Data table `kk_faqs`**: edit a cell there and the next message uses it, no workflow change |
| STOP only said "done" | STOP is saved in **`kk_contacts`**; the bot stays silent for that person until they send `/start` |
| Talk to a person: reply only | Unknown questions and Talk to a person also send **you** a Telegram alert |
| — | "hi", "hello", "namaste" → the opening message |
| — | Photos / voice → "I can only read text for now" |

Why Data tables and not a Google Sheet: they're built into n8n, free, and need no Google login. You open them in n8n (Overview → Data tables) and edit them like a sheet. If Kaushal later needs to edit wording himself, we can swap to a Google Sheet.

## Flow
```
Telegram Trigger
  → 1 · Read what we know:  Check opt-out (kk_contacts) → Load answers (kk_faqs)
  → 2 · Decide the reply:   Route
       ├─ Button press?   → Answer button      (stop the spinner)
       ├─ Reply?          → Show menu? → Send with menu / Send plain
       ├─ 3 · Remember STOP:  Opt-out change? → Save opt-out
       └─ 4 · Alert Manish:   Alert Manish?   → Alert Manish
```

## How Route picks an answer
1. Button → that answer.
2. `/start` or a greeting → opening message (and `/start` clears an opt-out).
3. Opted out → say nothing.
4. Typed text → check FAQs in `priority` order (STOP 1, advice refusal 2, guarantee 3, …). First keyword hit wins.
   - STOP words (stop, spam, band karo) count only as the **whole message**, so "my stop loss keeps hitting" never opts anyone out.
5. Nothing matched → hand-off reply + alert to Manish.

## Approving an answer
In `kk_faqs`, change `status` from `DRAFT` to `APPROVED`. The DRAFT tag disappears from that reply on the next message.

## Test in Telegram (all ✅ 23 Nov, checked in the n8n runs)
- [x] "kitna fees" → Plans & fees answer
- [x] "Should I buy Tata Motors?" → polite refusal
- [x] "is profit guaranteed?" → "No. No one can guarantee returns…"
- [x] "my stop loss keeps hitting" → **not** an opt-out (you get the hand-off reply + an alert)
- [x] "do you have an office in Pune?" → hand-off reply, and you get a 🔔 alert
- [x] Tap Talk to a person → 🔔 alert
- [x] Type STOP → confirmation; then type "hello" → **no reply**
- [x] Send `/start` → opening message again (you're back in)

## Local test
`node scripts/test_t2_route.js` runs 25 cases against `workflows/t2-route.js` with the answers from `knowledge/faqs.csv`.

## Files
- `workflows/t2-route.js`: the Route code (same as in n8n)
- `workflows/t2-update-ops.json`: the exact changes sent to n8n on top of T1
- `knowledge/faqs.csv`: source for the `kk_faqs` table (now with `priority`)

## Known gaps (for T3)
- Booking: "Book a call" still shows `[slots]`.
- No chat log yet.
- Telegram can resend an update, so a reply can occasionally come twice.
- Keyword matching is simple: a question using words we didn't list goes to the hand-off. That's the safe direction.
