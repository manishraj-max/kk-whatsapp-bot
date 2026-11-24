# Dashboard: the bot's control room

Live in n8n: workflow `Ccx6KX9AX1qExr01` "KK bot dashboard (control room)", built and published by Claude through the n8n MCP on 23 Nov (v1 read-only, v2 same evening: new look + buttons).

## What it is
A web page with two halves, both in the same n8n workflow:

```
A · Show the page:   open the link → read the 4 tables → Build page → page
B · Button actions:  a button on the page → Do action → Check action → (Message the lead) → update the row → "ok"
```

The page is the same for any screen (phone works too), follows light/dark mode, and refreshes itself every minute unless you're typing a reply.

## What's on it
| Part | Shows | You can |
|---|---|---|
| Banner | how many things need you right now | – |
| 5 numbers | people reached, call requests, % of questions the bot answered itself, waiting for you, opted out | – |
| **Needs you** | call requests not yet confirmed; questions the bot handed to a person | **Confirm and tell them** · **Can't do this time** · **Send reply** · **Mark handled** |
| Confirmed calls | calls you confirmed | **Call done** |
| Lead funnel | started a chat → asked a question → requested a call → call confirmed | – |
| Messages per day | last 7 days, hover for details, "Show as table" | – |
| What people ask | questions per answer; orange = handed to a person | – |
| Answers | which of the FAQ answers Kaushal ji has approved | – |
| Conversations | latest 40 messages, search box, your replies shown under the question | – |

## What each button does
| Button | Table change | Message to the lead (from the bot) |
|---|---|---|
| Confirm and tell them | booking → `confirmed` | "✅ Your call is confirmed: <slot>…" |
| Can't do this time | booking → `cancelled` | "Sorry, <slot> doesn't work… tap Book a call to pick another time" |
| Call done | booking → `done` | none |
| Send reply | chat log row → `handled`, `team_reply` saved | your text |
| Mark handled | chat log row → `handled` | none |

Every button that messages someone needs two taps: the first turns it yellow ("Tap again to send") and says what will happen, the second sends; it stays yellow until you tap again (no time limit), and the page doesn't auto-refresh meanwhile. (A browser pop-up was used before, but in-app browsers block pop-ups, so clicks silently did nothing; fixed 24 Nov.) Messages carry a `[DEMO: Telegram prototype]` tag while this is a demo.

New columns for this: `kk_chat_log.handled` (yes/no) and `kk_chat_log.team_reply` (text).

## The link
- The address is `https://candlesticks.app.n8n.cloud/webhook/kk-dash-<secret>`; the buttons post to the same address + `-act`. The secret part is kept **out of GitHub**: open the workflow in n8n, click **Open dashboard** and copy the Production URL.
- Anyone with the link can see names and messages **and press the buttons**, so share it only with Kaushal, and don't post it anywhere.
- To change the link (for example after sharing it by mistake), change the path in **Open dashboard** and **Do action** (keep `-act` on the second) and publish.
- Link previewers and bots are blocked (`ignoreBots`), so pasting the link into WhatsApp/Telegram shows no preview. Opening it in a browser works.

## Files
- `workflows/dashboard-page.js`: the Build page code (same as in n8n)
- `workflows/dashboard-action.js`: the Check action code (same as in n8n)
- `workflows/dashboard.sdk.ts`: v1 of the workflow (path replaced by `kk-dash-SECRET`)
- `workflows/dashboard-v2-ops.json`: the exact changes sent to n8n for v2 (path replaced)
- `scripts/test_dashboard.js`: 15 local checks with made-up rows (`node scripts/test_dashboard.js out.html` also saves a preview page)

## Later
- When the bot moves to WhatsApp, the page and buttons stay; only "Message the lead" swaps from Telegram to WhatsApp.
- Real login instead of a secret link, if more than one person uses it.
