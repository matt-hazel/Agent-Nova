7/8/2026

This is to be an AI system to help automate certain sections in my life.

Directions to follow below:

--- Nova v1: Project Tracker Dashboard ---

What this is:
A local Next.js + TypeScript dashboard backed by a local SQLite database
(via Prisma). v1 has one working feature: a project tracker (add/edit
status & notes/delete). Automation is intended to come from Claude Code
sessions (agents) reading and writing this data over time, not from a
separate agent runtime baked into the app.

Setup (first time / after pulling changes):
  npm install
  npx prisma generate

Run the dashboard:
  npm run dev
  Then open http://localhost:3000

Manage projects from the command line (used by Claude Code / agents to
update project data without going through the UI):
  npm run projects -- list
  npm run projects -- add "Project name" active "optional notes"
  npm run projects -- update <id> status paused
  npm run projects -- update <id> notes "new notes"
  npm run projects -- delete <id>

Data:
  SQLite DB lives at data/nova.db (gitignored). Schema is defined in
  prisma/schema.prisma. After changing the schema, run:
    npx prisma migrate dev --name <change-description>

--- Star Wars HUD styling + Aurebesh toggle ---

Languages used in this project:
  Code:  TypeScript, React (via Next.js), CSS. No other languages.
  UI display: English ("Basic") and Aurebesh. These are NOT two different
  languages — Aurebesh is just a different writing system (alphabet) for
  English/Basic, the same way Star Wars uses it in-universe. Toggling it
  does not translate anything; it respells UI text phonetically (dropping
  silent letters, simplifying digraphs like "ph"->"f") and renders it in
  an Aurebesh-style font, so it reads as an alien alphabet but says the
  same words.

What the toggle affects:
  Only static UI chrome — headings, button labels, placeholders, status
  option text, empty-state messages. Your own data (project names and
  notes you type in) is always left exactly as you wrote it, in both
  modes — the toggle never touches your content.

Aurebesh font:
  Using the Pixel Sagas "Aurebesh" font family, in public/fonts/ (see
  Font License.txt there — free for personal/non-commercial use). Wired
  up via @font-face in app/globals.css (regular/bold/italic/bold-italic).

--- Agent Comlink: chat panel + voice ---

What this is:
  A side chat panel ("Comlink" button in the header) for talking to a
  planning agent about your projects, plus wake-word voice input ("Hey
  Nova, ..."). This is a separate agent from Claude Code — Nova's own
  backend (app/api/chat/route.ts) calls the Anthropic API directly using
  the official @anthropic-ai/sdk. The agent can read and modify your
  projects (list/add/update/delete) via the same lib/projects.ts functions
  the UI and CLI use, so anything it does shows up immediately on the
  dashboard.

Setup required:
  Get an API key at console.anthropic.com -> API Keys, then add it to
  .env:
    ANTHROPIC_API_KEY=sk-ant-...
  Without a key, the chat panel shows a clear inline error instead of
  failing silently — the rest of the dashboard works fine without one.

Voice (wake-word, no push-to-talk button):
  Click "Enable Voice" once per session to grant microphone access (this
  one click is unavoidable — browsers require a user gesture before
  granting mic access, so it can't be fully button-free). After that, Nova
  listens continuously and only acts after hearing "Hey Nova" followed by
  your request — nothing is sent anywhere until the wake word is heard.
  Replies to voice messages are read aloud via the browser's built-in
  text-to-speech. Voice requires a browser with Web Speech API support
  (Chrome, Edge, Safari — not Firefox as of this writing); on unsupported
  browsers you'll see a small "Voice not supported" note instead of a
  broken button, and the rest of the dashboard is unaffected.

Model: claude-opus-4-8, via the SDK's tool runner (client.beta.messages.
toolRunner) with adaptive thinking. Chat history is kept in memory in the
browser tab only (not persisted to the database) — refreshing the page
starts a new conversation.

Planned next (not yet built):
  - Task-level tracking under each project
  - Research feed / agent output log
  - Scheduled automations
  - Gmail / Calendar / Drive integration surfaced on the dashboard
