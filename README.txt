7/8/2026

This is to be an AI system to help automate certain sections in my life.

Directions to follow below:

--- Nova v1: Project Tracker Dashboard ---

What this is:
A local Next.js + TypeScript dashboard backed by a local SQLite database
(via Prisma). v1 has one working feature: a project tracker (add/edit
status & notes/delete). Beyond that, Nova's chat (see "Agent Comlink"
below) can now dispatch real coding/automation work to Anthropic's
Managed Agents platform — see "Agent Dispatch" below.

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
toolRunner) with adaptive thinking. Chat history is persisted to the
database (one continuous conversation per browser, tracked via a
localStorage id) so it's searchable later — "Clear" in the UI only
resets what's visible, it doesn't delete history.

--- Agent Dispatch: multi-agent coding via Managed Agents ---

What this is:
  Nova's chat can dispatch real coding/automation work — not just talk
  about it — to Anthropic's Managed Agents platform. Ask Nova to build
  something and it kicks off a coordinator agent with a coding sub-agent
  that actually writes code, runs bash, and sets up environments, then
  reports back (a "Dispatches" panel on the dashboard shows live status
  too). This runs in the background — a dispatch can take several
  minutes, and Nova won't block waiting on it.

Self-improvement:
  Projects about Nova itself (this app) can be flagged as such — Nova
  recognizes this from conversation and tags the project automatically.
  Dispatching coding work against a self-flagged project targets Nova's
  own real GitHub repo (github.com/matt-hazel/Agent-Nova) instead of a
  scratch environment, so Nova can genuinely extend its own source over
  time.

Other repos:
  Any project can be linked to a GitHub repo by setting its repo_url
  (Nova does this automatically when you mention a repo in conversation,
  e.g. "this project is about the Foo repo"). Dispatching coding work
  against a project with a repo_url clones/pushes to that repo, same as
  self-improvement dispatches do for Nova's own repo. A project with no
  repo_url and isSelf: false dispatches into an empty scratch
  environment with nothing to push to — if you expect a dispatch to
  push somewhere and it doesn't seem to have, check whether the project
  actually has a repo_url set.

Safety (read this before dispatching against a real repo):
  The coding sub-agent is instructed to always work on a new branch and
  never push to main/master — but this is a prompt instruction, not a
  hard platform-enforced restriction. Review what it did before merging
  anything. The sub-agent is also instructed never to modify Nova's own
  kill-switch code (see below) — same caveat, it's a prompt instruction.

Kill switch:
  Two stop controls exist. (1) A global emergency stop: click "Stop"
  in the chat panel while Nova is replying (or say/type "stop" /
  "abort" / "kill it"), which both cancels the in-progress chat reply
  and interrupts every currently-running dispatch, regardless of which
  conversation started them. (2) Per-dispatch stop: a "Stop" button on
  each running row in the Dispatches panel, or telling Nova to "stop
  the [name] dispatch" — either interrupts just that one dispatch via
  a real user.interrupt event sent to Anthropic's Sessions API
  (platform-enforced, not something the sub-agent's own code can
  intercept or ignore). If the app itself were ever unhealthy or
  unresponsive, the actual backstop is revoking credentials at the
  source — the GITHUB_TOKEN (GitHub -> Settings -> fine-grained
  tokens) or ANTHROPIC_API_KEY (Anthropic Console) — both work
  independent of whether Nova's own server process is running.

One-time setup:
  1. Run: npm run setup:agents
     This provisions a coordinator agent, a coding sub-agent, and a
     scratch environment on Anthropic's Managed Agents platform, and
     prints the resulting IDs.
  2. Add the printed IDs to .env:
       MANAGED_AGENTS_COORDINATOR_AGENT_ID=...
       MANAGED_AGENTS_ENVIRONMENT_ID=...
  3. If you want dispatch to work against any real repo (Nova's own or
     others), create a fine-grained GitHub PAT at github.com/settings/
     personal-access-tokens, and add it to .env:
       GITHUB_TOKEN=github_pat_...
     One token covers every repo you dispatch against — under
     "Repository access", pick "Only select repositories" and add each
     repo you want Nova to be able to work on (Agent-Nova plus any
     others), rather than "All repositories". Under "Repository
     permissions", set "Contents" to "Read and write" — nothing broader,
     no admin. Add more repos to the token's scope (or issue a new one)
     any time you link a new project to a repo.
  Without step 3, dispatch still works for scratch/new-project work with
  no repo attached — only repo-linked dispatches (self or otherwise)
  need the token.

Planned next (not yet built):
  - Task-level tracking under each project
  - Research feed / agent output log
  - Scheduled automations
  - Gmail / Calendar / Drive integration surfaced on the dashboard
  - Hard per-action approval gating (not just a prompt instruction) for
    self-repo dispatch actions, and landing changes as a reviewable PR
    instead of a pushed branch. (The kill switch above already stops a
    dispatch outright, platform-enforced — this would add a tighter,
    step-by-step confirm/deny gate on top of that, not replace it.)
