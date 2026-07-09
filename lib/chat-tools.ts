import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from "./projects";

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
    },
    required: ["name"],
  },
  run: async (input) => {
    const { name, status, notes } = input as {
      name: string;
      status?: string;
      notes?: string;
    };
    const project = await createProject({ name, status, notes });
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
    },
    required: ["id"],
  },
  run: async (input) => {
    const { id, name, status, notes } = input as {
      id: string;
      name?: string;
      status?: string;
      notes?: string;
    };
    const project = await updateProject(id, { name, status, notes });
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
];
