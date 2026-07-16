import "dotenv/config";
import { anthropic } from "../lib/anthropic";

const CODING_SUBAGENT_SYSTEM_PROMPT = `You are a coding agent working on behalf of Nova, a personal dashboard assistant. Complete the task you're given using the tools available to you.

When working in a GitHub repository, always create and work on a new branch (e.g. "nova/<short-task-slug>"). Never push directly to main or master, and never force-push under any circumstances. Leave the branch pushed and ready for the user to review — do not attempt to merge it yourself.

Never modify Nova's own safety/kill-switch code: lib/managed-agents.ts, lib/dispatch-tools.ts, lib/dispatches.ts, lib/dispatch-events.ts, or anything under app/api/kill-switch or app/api/dispatches/*/stop. If a task seems to require touching those files, stop and explain why instead of proceeding.`;

const COORDINATOR_SYSTEM_PROMPT = `You are Nova's coding coordinator. When given a task, delegate the actual implementation work to your coding sub-agent rather than doing it directly yourself, unless the task is trivial enough to just do in one step.`;

async function main() {
  if (process.env.MANAGED_AGENTS_COORDINATOR_AGENT_ID) {
    console.error(
      "MANAGED_AGENTS_COORDINATOR_AGENT_ID is already set in .env — refusing to re-provision.\n" +
        "If you really want to create new agents, remove that variable first."
    );
    process.exitCode = 1;
    return;
  }

  console.log("Creating coding sub-agent...");
  const codingSubAgent = await anthropic.beta.agents.create({
    name: "Nova Coding Sub-Agent",
    model: "claude-opus-4-8",
    system: CODING_SUBAGENT_SYSTEM_PROMPT,
    tools: [{ type: "agent_toolset_20260401" }],
  });
  console.log(`  agent id: ${codingSubAgent.id}`);

  console.log("Creating coordinator agent...");
  const coordinator = await anthropic.beta.agents.create({
    name: "Nova Coordinator",
    model: "claude-opus-4-8",
    system: COORDINATOR_SYSTEM_PROMPT,
    tools: [{ type: "agent_toolset_20260401" }],
    multiagent: {
      type: "coordinator",
      agents: [codingSubAgent.id],
    },
  });
  console.log(`  agent id: ${coordinator.id}`);

  console.log("Creating scratch environment...");
  const environment = await anthropic.beta.environments.create({
    name: "Nova Dispatch Scratch",
    config: {
      type: "cloud",
      networking: { type: "unrestricted" },
    },
  });
  console.log(`  environment id: ${environment.id}`);

  console.log("\nDone. Add these to your .env file:\n");
  console.log(`MANAGED_AGENTS_COORDINATOR_AGENT_ID=${coordinator.id}`);
  console.log(`MANAGED_AGENTS_ENVIRONMENT_ID=${environment.id}`);
  console.log(
    "\nYou'll also need a GITHUB_TOKEN (a fine-grained GitHub PAT scoped to only the\n" +
      "Agent-Nova repository, with Contents: Read and write permission) if you want\n" +
      "Nova to dispatch coding work against its own repo. See README.txt."
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
