# Dashboard: what's going on with the bot

Live in n8n: workflow `Ccx6KX9AX1qExr01` "KK bot dashboard (read-only)", built and published by Claude through the n8n MCP on 23 Nov.

## What it is
A web page. Opening its link runs a small n8n workflow that reads the bot's 4 tables and draws the page. It **only reads**. It never changes a table and never messages anyone. The page refreshes itself every minute.

```
Open the link → Open dashboard (webhook) → Read chat log → Read bookings → Read contacts → Read answers → Build page → Show page
```

## What's on it
| Part | From | Shows |
|---|---|---|
| 6 numbers on top | all tables | people who chatted, messages (and last 24 h), call requests (and how many wait for confirmation), questions that needed a person, opted out, answers approved / total |
| 📅 Call requests | `kk_bookings` | name, slot, status (`requested` / `confirmed` / `done`), when asked |
| 🔔 Waiting for a person | `kk_chat_log` (HANDOFF) | the last 15 questions the bot couldn't answer |
| 💬 What people ask | `kk_chat_log` | how often each answer was used, as bars |
| 🕒 Latest messages | `kk_chat_log` | the last 25 messages and what the bot answered |

## The link
- The address is `https://candlesticks.app.n8n.cloud/webhook/kk-dash-<secret>`. The secret part is kept **out of GitHub**: open the workflow in n8n, click **Open dashboard** and copy the Production URL.
- Anyone with the link can see names and messages, so share it only with Kaushal, and don't post it anywhere.
- To change the link (for example after sharing it by mistake), change the path in **Open dashboard** and publish.
- Link previewers and bots are blocked (`ignoreBots`), so pasting the link into WhatsApp/Telegram shows no preview. Opening it in a browser works.

## Files
- `workflows/dashboard-page.js`: the Build page code (same as in n8n)
- `workflows/dashboard.sdk.ts`: the full workflow, with the path replaced by `kk-dash-SECRET`
- `scripts/test_dashboard.js`: 9 local checks with made-up rows (`node scripts/test_dashboard.js out.html` also saves the page)

## Later
- When the bot moves to WhatsApp, the same page works: it only reads the tables.
- To mark a call confirmed, change its `status` in `kk_bookings` (n8n → Data tables). The dashboard shows the change on its next refresh.
