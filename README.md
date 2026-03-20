# YuktiMail - AI-first Gmail Client

YuktiMail is an open-source, AI-first Gmail client that turns long email threads into actionable context. Instead of reading everything line-by-line, you get summaries, tasks, and decisions extracted automatically, plus an AI chat for deeper questions.

GitHub: https://github.com/aksharahegde/ai-email

## What you can do

- AI Copilot panel that analyzes the currently selected email thread.
- Thread insights including: a short summary, action items (to-dos), questions, decisions, and key people.
- Ask follow-up questions in a lightweight chat tied to the selected thread.
- AI Priority view that surfaces threads tagged as `action-required`, `question`, or `decision`.
- Smart Inbox: create named, AI-powered inboxes using your own classification and summarization prompts, then sync and browse matched emails.
- Tasks from Email: extract tasks/to-dos from your inbox and mark them done.
- AI-assisted compose: generate an AI draft and improve writing using "make shorter", "make professional", and "make clearer".
- AI configuration: choose an AI provider/model (including Ollama) from the Settings area.

## Open source

YuktiMail is MIT licensed. See [`LICENSE`](./LICENSE).

## Local setup (required)

### 1. Configure environment variables

Copy `.env.example` to `.env` and fill in:

- `NUXT_SESSION_PASSWORD` (required; at least 32 characters)
- `NUXT_OAUTH_GOOGLE_CLIENT_ID` (required)
- `NUXT_OAUTH_GOOGLE_CLIENT_SECRET` (required)

### 2. Install dependencies

```bash
pnpm install
```

### 3. Run the app

```bash
bun run dev
```

Open the app in your browser. (The default dev server URL is shown in terminal output.)

## AI providers (optional)

AI provider/model selection is configurable in the UI under `Settings -> AI Configuration`.

Ollama defaults to `http://localhost:11434` with a default model of `llama3.2` (you can override via Settings, or by setting environment variables like `OLLAMA_BASE_URL`, `AI_PROVIDER`, and `AI_MODEL`).

## Gmail sync + local cache

YuktiMail uses a local SQLite cache (default: `.data/email.db`) for fast loading, and it syncs with Gmail via the app's sync flows (for example, using the Inbox "Refresh" action).

On startup, the app applies DB migrations automatically and seeds the default Smart Inbox items.
