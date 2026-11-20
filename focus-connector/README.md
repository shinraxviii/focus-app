# Focus connector for Claude

A small, read-only [MCP](https://modelcontextprotocol.io) server that lets Claude (Claude Duet, claude.ai,
the Claude mobile app, Claude Code) read your Focus to-do list live from Firestore, the same database the app saves to.

## Tools Claude gets

| Tool | What it returns |
| --- | --- |
| `get_daily_briefing` | Overdue, due today, due in the next N days, undated to-dos, weekly recurring progress, counts per list, completed in the last 2 days |
| `list_tasks` | Tasks by list (`personal` / `work`) and section (`todo` / `notrightnow` / `completed`) |
| `search_tasks` | Text search across task text, notes and sub-items |
| `get_completed_tasks` | Your completion log for the last N days |

It is **read-only on purpose**. The Focus app loads tasks once and later saves the whole list, so anything an
outside writer added while the app was open would be overwritten. Writing (add / complete) needs the app
to merge on save first.

## Setup (about 15 minutes)

1. **Service account key**: Firebase console → project `focus-app-38732` → Project settings → Service accounts →
   *Generate new private key*. Keep the downloaded JSON private and never commit it.
2. **Your user ID**: Firebase console → Authentication → Users → copy the *User UID* next to your Google account.
3. **Connector secret**: run `openssl rand -hex 32` (or use any password generator, 32+ characters).
4. **Deploy to Vercel**: *Add New → Project* → import this repo → set **Root Directory** to `focus-connector` →
   add these environment variables:
   - `FIREBASE_SERVICE_ACCOUNT`: paste the entire JSON file contents
   - `FOCUS_UID`: the UID from step 2
   - `FOCUS_CONNECTOR_KEY`: the secret from step 3
   - `FOCUS_TZ` (optional): defaults to `America/Los_Angeles`

   Then click Deploy.
5. **Add it to Claude**: claude.ai → Settings → Connectors → *Add custom connector* →
   URL `https://<your-project>.vercel.app/mcp?key=<FOCUS_CONNECTOR_KEY>`.
   Connectors on your Claude account carry over to Claude Duet.
6. Ask Claude: *"Use Focus to give me my daily briefing."*

The URL contains the secret, so treat it like a password. To revoke access, change `FOCUS_CONNECTOR_KEY`
in Vercel and redeploy.

## Develop

```
npm install
npm test        # runs against fake data, no Firebase needed
```
