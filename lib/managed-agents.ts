import { anthropic } from "./anthropic";

const COORDINATOR_AGENT_ID = process.env.MANAGED_AGENTS_COORDINATOR_AGENT_ID;
const SCRATCH_ENVIRONMENT_ID = process.env.MANAGED_AGENTS_ENVIRONMENT_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export const NOVA_REPO_URL = "https://github.com/matt-hazel/Agent-Nova";

// Managed Agents' github_repository resource requires a bare
// https://github.com/{owner}/{repo} URL — no .git suffix, no trailing slash.
export function normalizeRepoUrl(url: string): string {
  return url.trim().replace(/\.git$/i, "").replace(/\/+$/, "");
}

export function managedAgentsConfigured(): boolean {
  return Boolean(COORDINATOR_AGENT_ID && SCRATCH_ENVIRONMENT_ID);
}

function assertConfigured() {
  if (!managedAgentsConfigured()) {
    throw new Error(
      "Managed Agents isn't set up. Run `npm run setup:agents` once, then add the printed IDs to .env."
    );
  }
}

export async function startDispatchSession(opts: {
  task: string;
  title: string;
  repoUrl?: string;
}) {
  assertConfigured();

  if (opts.repoUrl && !GITHUB_TOKEN) {
    throw new Error(
      `GITHUB_TOKEN isn't set — required to dispatch work against ${opts.repoUrl}. See README.txt for how to create a scoped token.`
    );
  }

  const resources = opts.repoUrl
    ? [
        {
          type: "github_repository" as const,
          url: normalizeRepoUrl(opts.repoUrl),
          authorization_token: GITHUB_TOKEN!,
          checkout: { type: "branch" as const, name: "main" },
        },
      ]
    : undefined;

  const session = await anthropic.beta.sessions.create({
    agent: COORDINATOR_AGENT_ID!,
    environment_id: SCRATCH_ENVIRONMENT_ID!,
    title: opts.title,
    resources,
  });

  await anthropic.beta.sessions.events.send(session.id, {
    events: [{ type: "user.message", content: [{ type: "text", text: opts.task }] }],
  });

  return session;
}

export async function getDispatchStatus(sessionId: string) {
  return anthropic.beta.sessions.retrieve(sessionId);
}

// the real stop mechanism — pauses agent execution and returns control,
// enforced platform-side rather than something the agent's own code could
// intercept or ignore
export async function interruptSession(sessionId: string) {
  await anthropic.beta.sessions.events.send(sessionId, {
    events: [{ type: "user.interrupt" }],
  });
}

export function sessionConsoleUrl(sessionId: string): string {
  return `https://platform.claude.com/workspaces/default/sessions/${sessionId}`;
}
