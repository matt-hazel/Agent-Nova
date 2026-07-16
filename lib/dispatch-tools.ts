import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import {
  createDispatch,
  getDispatch,
  getDispatchEvents,
  listDispatches,
  stopDispatch,
  updateDispatch,
} from "./dispatches";
import { getProject } from "./projects";
import { getDispatchStatus, sessionConsoleUrl, startDispatchSession, NOVA_REPO_URL } from "./managed-agents";

// turns a raw captured event into a compact, human-readable summary — the
// stored payload stays full/raw (that's the audit trail), but what goes
// back into the model's context should stay token-reasonable
function summarizeEvent(type: string, payload: string): string {
  const event = JSON.parse(payload) as Record<string, unknown>;
  const truncate = (s: string, n = 300) => (s.length > n ? `${s.slice(0, n)}…` : s);

  switch (type) {
    case "agent.tool_use":
    case "agent.custom_tool_use":
    case "agent.mcp_tool_use": {
      const name = event.name as string;
      const input = JSON.stringify(event.input ?? {});
      return `called tool "${name}" with input ${truncate(input)}`;
    }
    case "agent.tool_result":
    case "agent.mcp_tool_result": {
      const content = event.content as Array<{ type: string; text?: string }> | undefined;
      const text = content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text)
        .join(" ");
      const errorNote = event.is_error ? " [error]" : "";
      return `tool result${errorNote}: ${truncate(text ?? "(no text content)")}`;
    }
    case "agent.message": {
      const content = event.content as Array<{ type: string; text?: string }> | undefined;
      const text = content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text)
        .join(" ");
      return `message: ${text ?? ""}`;
    }
    case "agent.thinking":
      return "thinking… (reasoning text isn't available from the API)";
    case "session.status_idle":
    case "session.status_running":
    case "session.status_terminated":
    case "session.status_rescheduled":
      return `status changed: ${type.replace("session.status_", "")}`;
    default:
      return type;
  }
}

export const dispatchCodingTaskTool = betaTool({
  name: "dispatch_coding_task",
  description:
    "Dispatch real coding or automation work to a sub-agent that can write code, run bash, and set up environments. Returns immediately with a dispatch id — the work happens in the background and can take several minutes, so don't wait for it to finish before responding to the user. If project_id refers to a project with isSelf: true, this automatically targets Nova's own real GitHub repo; if the project has a repo_url set, this automatically targets that repo instead. Only pass repo_url to override what the project resolves to, or to attach a repo when there's no linked project. Never dispatch a task that would require modifying Nova's own safety/kill-switch code (lib/managed-agents.ts, lib/dispatch-tools.ts, lib/dispatches.ts, lib/dispatch-events.ts, or anything under app/api/kill-switch or app/api/dispatches/*/stop) — if a self-repo task seems to need that, stop and explain why instead of dispatching it.",
  inputSchema: {
    type: "object",
    properties: {
      task: { type: "string", description: "What the sub-agent should do, written as clear instructions" },
      title: { type: "string", description: "Short human-readable title for this dispatch" },
      project_id: { type: "string", description: "Optional id of the tracked project this work relates to" },
      repo_url: {
        type: "string",
        description:
          "Override which GitHub repo to clone/push to — normally inferred from project_id (isSelf projects target Nova's own repo, other projects use their repo_url if set). Leave unset to just use a scratch environment with no repo attached.",
      },
    },
    required: ["task", "title"],
  },
  run: async (input) => {
    const { task, title, project_id, repo_url } = input as {
      task: string;
      title: string;
      project_id?: string;
      repo_url?: string;
    };

    let repoUrl = repo_url;
    if (repoUrl === undefined && project_id) {
      const project = await getProject(project_id);
      if (project?.isSelf) repoUrl = NOVA_REPO_URL;
      else if (project?.repoUrl) repoUrl = project.repoUrl;
    }

    const dispatch = await createDispatch({
      title,
      projectId: project_id,
      repoUrl,
    });

    try {
      const session = await startDispatchSession({ task, title, repoUrl });
      const updated = await updateDispatch(dispatch.id, {
        status: "running",
        managedAgentsSessionId: session.id,
      });
      return JSON.stringify(updated);
    } catch (err) {
      const failed = await updateDispatch(dispatch.id, {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Failed to start dispatch",
      });
      return JSON.stringify(failed);
    }
  },
});

export const checkDispatchStatusTool = betaTool({
  name: "check_dispatch_status",
  description:
    "Check the current status of a previously dispatched coding task. Requires the dispatch id (get it from list_dispatches or the id returned by dispatch_coding_task). Set verbose to true to get a full, faithful transcript of everything the sub-agent has done so far — every tool call, tool result, and message captured, in order. Use verbose when the user asks what a dispatch actually did, not just whether it's done.",
  inputSchema: {
    type: "object",
    properties: {
      dispatch_id: { type: "string", description: "Dispatch id" },
      verbose: {
        type: "boolean",
        description: "Include the full captured transcript of the sub-agent's actions so far",
      },
    },
    required: ["dispatch_id"],
  },
  run: async (input) => {
    const { dispatch_id, verbose } = input as { dispatch_id: string; verbose?: boolean };
    const dispatch = await getDispatch(dispatch_id);
    if (!dispatch) {
      return JSON.stringify({ error: "No dispatch found with that id" });
    }

    const transcript = verbose
      ? (await getDispatchEvents(dispatch_id)).map((e) => ({
          type: e.type,
          processedAt: e.processedAt,
          summary: summarizeEvent(e.type, e.payload),
        }))
      : undefined;

    if (!dispatch.managedAgentsSessionId) {
      return JSON.stringify({ ...dispatch, transcript });
    }

    const session = await getDispatchStatus(dispatch.managedAgentsSessionId);
    return JSON.stringify({
      ...dispatch,
      liveSessionStatus: session.status,
      consoleUrl: sessionConsoleUrl(dispatch.managedAgentsSessionId),
      transcript,
    });
  },
});

export const stopDispatchTool = betaTool({
  name: "stop_dispatch",
  description:
    "Stop a running dispatch immediately — interrupts the sub-agent and marks the dispatch as stopped. Use this when the user asks to stop, cancel, or kill a specific dispatched task. Requires the dispatch id (get it from list_dispatches if you only have a description of which one).",
  inputSchema: {
    type: "object",
    properties: { dispatch_id: { type: "string", description: "Dispatch id" } },
    required: ["dispatch_id"],
  },
  run: async (input) => {
    const { dispatch_id } = input as { dispatch_id: string };
    const dispatch = await stopDispatch(dispatch_id);
    return JSON.stringify(dispatch);
  },
});

export const listDispatchesTool = betaTool({
  name: "list_dispatches",
  description:
    "List dispatched coding tasks and their current status. Optionally filter by status (queued, running, idle, needs_input, completed, failed).",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Optional status filter" },
    },
  },
  run: async (input) => {
    const { status } = input as { status?: string };
    const dispatches = await listDispatches(status);
    return JSON.stringify(dispatches);
  },
});

export const dispatchTools = [
  dispatchCodingTaskTool,
  checkDispatchStatusTool,
  listDispatchesTool,
  stopDispatchTool,
];
