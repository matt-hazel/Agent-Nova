import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { createMemory, deleteMemory, searchMemories } from "./memories";
import { searchConversations } from "./conversations";

export const rememberFactTool = betaTool({
  name: "remember_fact",
  description:
    "Save a fact to long-term memory: about a person, a project, or a general preference. Use this both when the user explicitly says to remember something, and proactively when you notice a clear, stable fact worth keeping (e.g. a name, relationship, or preference stated directly). When you save something proactively, tell the user you did.",
  inputSchema: {
    type: "object",
    properties: {
      category: { type: "string", enum: ["person", "project", "fact"] },
      subject: {
        type: "string",
        description: "Person's name or project name this fact is about, if applicable",
      },
      content: { type: "string", description: "The fact itself, written plainly" },
      source: {
        type: "string",
        enum: ["explicit", "auto"],
        description: "explicit if the user asked you to remember it, auto if you noticed it yourself",
      },
    },
    required: ["category", "content", "source"],
  },
  run: async (input) => {
    const { category, subject, content, source } = input as {
      category: string;
      subject?: string;
      content: string;
      source: string;
    };
    const memory = await createMemory({ category, subject, content, source });
    return JSON.stringify(memory);
  },
});

export const forgetMemoryTool = betaTool({
  name: "forget_memory",
  description:
    "Delete a previously saved memory, e.g. if the user corrects a fact you saved. Requires the memory id (get it from search_memories first).",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string", description: "Memory id" } },
    required: ["id"],
  },
  run: async (input) => {
    const { id } = input as { id: string };
    await deleteMemory(id);
    return JSON.stringify({ deleted: id });
  },
});

export const searchMemoriesTool = betaTool({
  name: "search_memories",
  description:
    "Search saved memories about people, projects, and general facts. Omit query to list all memories, optionally filtered by category.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Text to search for; omit to list all" },
      category: { type: "string", enum: ["person", "project", "fact"] },
    },
  },
  run: async (input) => {
    const { query, category } = input as { query?: string; category?: string };
    const memories = await searchMemories(query, category);
    return JSON.stringify(memories);
  },
});

export const searchConversationsTool = betaTool({
  name: "search_conversations",
  description:
    'Search past conversation history by text and/or date range, e.g. to answer "what did we talk about last week". Returns matching messages with timestamps.',
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Text to search for in past messages" },
      since: { type: "string", description: "ISO date; only messages after this" },
      until: { type: "string", description: "ISO date; only messages before this" },
    },
  },
  run: async (input) => {
    const { query, since, until } = input as {
      query?: string;
      since?: string;
      until?: string;
    };
    const results = await searchConversations({ query, since, until });
    return JSON.stringify(results);
  },
});

export const memoryTools = [
  rememberFactTool,
  forgetMemoryTool,
  searchMemoriesTool,
  searchConversationsTool,
];
