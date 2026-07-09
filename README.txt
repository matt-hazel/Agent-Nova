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

Planned next (not yet built):
  - Task-level tracking under each project
  - Research feed / agent output log
  - Scheduled automations
  - Gmail / Calendar / Drive integration surfaced on the dashboard
