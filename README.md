# Ollama-WhatsApp

A WhatsApp chatbot that uses a **local** [Ollama](https://ollama.com) model to
generate replies. WhatsApp Web automation is handled by
[venom-bot](https://github.com/orkestral/venom).

Per-chat conversation memory, group-chat filtering, allow/ignore lists,
typing indicators, and simple `/help` and `/reset` commands.

## How it works

1. `venom-bot` opens a WhatsApp Web session (you scan a QR code once).
2. Every incoming text message is appended to that chat's history.
3. The history is sent to a locally-running Ollama model via the
   [`ollama`](https://www.npmjs.com/package/ollama) Node SDK.
4. The model's reply is sent back into the chat.

```
WhatsApp ──┐                                           ┌── Ollama (local)
           ▼                                           ▼
       venom-bot ──► message handler ──► OllamaClient ──► chat()
           ▲                                           │
           └────────────────── reply ──────────────────┘
```

## Requirements

- **Node.js 18+**
- **Ollama** running locally with at least one model pulled
  (`ollama pull llama3.2`). See https://ollama.com/download.
- A WhatsApp account on a phone you can use to scan the QR code.

## Setup

```bash
git clone <this-repo>
cd personal
npm install
cp .env.example .env
# edit .env if you want a different model / behavior
npm start
```

On first run, an ASCII QR code is printed in the terminal. Open WhatsApp on
your phone → Settings → Linked Devices → Link a device → scan it. The
session token is cached under `tokens/<SESSION_NAME>/`, so you only need to
scan once.

## Configuration

All settings come from environment variables (see `.env.example`):

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama server URL. |
| `OLLAMA_MODEL` | `llama3.2` | Model tag. Must be pulled beforehand. |
| `SYSTEM_PROMPT` | (see file) | Prepended to every conversation. |
| `SESSION_NAME` | `ollama-wa` | venom-bot session name → `tokens/<name>/`. |
| `REPLY_IN_GROUPS` | `false` | Reply inside group chats. |
| `REPLY_ONLY_ON_MENTION` | `true` | In groups, only reply when @mentioned. |
| `HISTORY_LIMIT` | `20` | Number of past messages kept per chat. |
| `SEND_TYPING` | `true` | Show "typing…" presence while generating. |
| `RATE_LIMIT_MS` | `1000` | Min milliseconds between replies per chat (spam prevention). |
| `IGNORE_CHATS` | _empty_ | Comma-separated chat IDs to skip. |
| `ALLOW_CHATS` | _empty_ | If set, only these chat IDs get replies. |

A chat ID looks like `5215551234567@c.us` (DM) or `1203630@g.us` (group).
You can grab them from the console log when a message arrives.

## In-chat commands

### Core

| Command | What it does |
| ------- | ------------ |
| `/help` | Show available commands and current settings. |
| `/reset` | Forget this chat's history and start fresh. |
| `/stats` | Show usage stats for this chat and across all chats. |
| `/export [json\|text]` | Dump this chat's entire history (default: text format). |

### Model & creativity (if `ALLOW_MODEL_SWITCH=true`)

| Command | What it does |
| ------- | ------------ |
| `/model <name>` | Switch to a different model (e.g. `/model llama2`). Lists available models if no arg given. |
| `/temp <0-1>` | Set response temperature directly (0=precise, 1=creative). |
| `/creative` | Shortcut for `/temp 0.9` (high variance). |
| `/precise` | Shortcut for `/temp 0.3` (low variance, more focused). |

## Features

- **Per-chat conversation memory** — keeps rolling history (configurable limit).
- **Persistent storage** — conversations saved to disk, survive bot restarts.
- **Model switching** — `/model <name>` to test different models without restarting.
- **Temperature control** — adjust creativity with `/creative`, `/precise`, or `/temp <0-1>`.
- **Export & backup** — `/export json` or `/export text` to dump a chat's history.
- **Usage stats** — `/stats` shows message counts and settings.
- **Group chat support** — opt-in, @mention-aware (configurable).
- **Rate limiting** — per-chat cooldown to prevent spam (configurable).
- **Allow/ignore lists** — whitelist or blacklist chats by ID.
- **Typing indicators** — shows "typing…" while the model generates.
- **Message truncation** — long responses auto-truncated to WhatsApp's 4096-char limit.
- **Graceful degradation** — missing Ollama, unpulled models, and network errors are handled clearly.

## Project layout

```
ollama.js               # entry point: venom session + message loop
src/
  config.js             # env → config object + validation
  history.js            # per-chat rolling message store + rate limiter
  ollamaClient.js       # wrapper around the `ollama` SDK
  storage.js            # persistent disk-based history
.env.example            # copy to `.env`
package.json
data/                   # persistent storage (gitignored)
  chats/
    <chatId>.json       # one file per chat
tokens/                 # venom-bot session data (gitignored)
```

## Security notes

- `tokens/`, `session/`, and `.env` are gitignored. **Never commit them** —
  they contain WhatsApp auth tokens.
- The bot replies to every DM by default. Use `ALLOW_CHATS` to restrict it
  while testing.
- Treat the bot's output as untrusted user content; don't pipe it into
  shells, eval, etc.

## Disclaimer

WhatsApp Web automation is not officially supported by WhatsApp and may
violate their Terms of Service. Use a dedicated test number, and use this
project at your own risk.

## License

MIT
