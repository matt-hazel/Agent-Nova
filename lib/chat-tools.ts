import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from "./projects";
import { memoryTools } from "./memory-tools";
import { dispatchTools } from "./dispatch-tools";

export const listProjectsTool = betaTool({
  name: "list_projects",
  description:
    "List all projects currently tracked on the dashboard, including their id, name, status, and notes.",
  inputSchema: {
    type: "object",
    properties: {},
  },
  run: async () => {
    const projects = await listProjects();
    return JSON.stringify(projects);
  },
});

export const createProjectTool = betaTool({
  name: "create_project",
  description: "Create a new project on the dashboard.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Project name" },
      status: {
        type: "string",
        enum: ["active", "paused", "done"],
        description: "Project status, defaults to active",
      },
      notes: { type: "string", description: "Optional notes about the project" },
      is_self: {
        type: "boolean",
        description:
          "Set to true if this project is about Nova itself — the personal dashboard app you're part of, whose source lives at github.com/matt-hazel/Agent-Nova. Set this automatically when you recognize the project is self-referential; don't ask the user to confirm.",
      },
      repo_url: {
        type: "string",
        description:
          "GitHub repo URL this project is about, if any (e.g. https://github.com/owner/repo.git). Set this when the user mentions a repo the project relates to, so dispatch_coding_task can clone/push to it. Not needed for is_self projects, which already target Nova's own repo automatically.",
      },
    },
    required: ["name"],
  },
  run: async (input) => {
    const { name, status, notes, is_self, repo_url } = input as {
      name: string;
      status?: string;
      notes?: string;
      is_self?: boolean;
      repo_url?: string;
    };
    const project = await createProject({
      name,
      status,
      notes,
      isSelf: is_self,
      repoUrl: repo_url,
    });
    return JSON.stringify(project);
  },
});

export const updateProjectTool = betaTool({
  name: "update_project",
  description:
    "Update an existing project's name, status, and/or notes. Requires the project id (get it from list_projects first).",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Project id" },
      name: { type: "string", description: "New project name" },
      status: {
        type: "string",
        enum: ["active", "paused", "done"],
        description: "New project status",
      },
      notes: { type: "string", description: "New notes" },
      is_self: {
        type: "boolean",
        description:
          "Set to true if this project is about Nova itself. See create_project's is_self for details.",
      },
      repo_url: {
        type: "string",
        description: "GitHub repo URL this project is about, if any. See create_project's repo_url for details.",
      },
    },
    required: ["id"],
  },
  run: async (input) => {
    const { id, name, status, notes, is_self, repo_url } = input as {
      id: string;
      name?: string;
      status?: string;
      notes?: string;
      is_self?: boolean;
      repo_url?: string;
    };
    const project = await updateProject(id, {
      name,
      status,
      notes,
      isSelf: is_self,
      repoUrl: repo_url,
    });
    return JSON.stringify(project);
  },
});

export const deleteProjectTool = betaTool({
  name: "delete_project",
  description:
    "Delete a project permanently. Requires the project id (get it from list_projects first). Ask the user to confirm before deleting unless they were explicit about which project to delete.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Project id" },
    },
    required: ["id"],
  },
  run: async (input) => {
    const { id } = input as { id: string };
    await deleteProject(id);
    return JSON.stringify({ deleted: id });
  },
});

export const chatTools = [
  listProjectsTool,
  createProjectTool,
  updateProjectTool,
  deleteProjectTool,
  ...memoryTools,
  ...dispatchTools,
];
