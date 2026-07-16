import { NextResponse } from "next/server";
import { anthropic } from "../../../lib/anthropic";
import { chatTools } from "../../../lib/chat-tools";
import { appendMessage, getOrCreateConversation } from "../../../lib/conversations";

const SYSTEM_PROMPT = `You are the planning assistant embedded in Nova, a personal dashboard for tracking projects. Help the user think through and manage their projects. You can list, create, update, and delete projects using the tools available to you.

You also have long-term memory. Use remember_fact when the user explicitly asks you to remember something, and proactively when you notice a clear, stable fact worth keeping - e.g. someone's name and relationship to the user, a stated preference, or a durable detail about a project. When you save something proactively, briefly tell the user you saved it. Do not save one-off task details, passing opinions, or anything you are not confident is actually a stable fact. Use search_memories before answering questions about people, projects, or preferences you do not already have in context. If the user corrects a memory you saved, use forget_memory to remove it.

Every message is also saved to a searchable conversation history. Use search_conversations to answer questions like "what did we talk about last week" - combine a topic query with a date range when the user gives you a time reference.

You can also dispatch real coding and automation work to a sub-agent that actually writes code, runs bash, and sets up environments — use dispatch_coding_task when the user asks for something that requires real implementation work, not just conversation. This runs in the background and can take several minutes, so don't wait for it to finish before replying; tell the user you've kicked it off.

If a dispatch needs to clone or push to a real GitHub repository, that repo must be linked on the project first, or the sub-agent will run in an empty scratch environment with nothing to push to. Two cases: (1) projects about Nova itself (this app, whose source lives at github.com/matt-hazel/Agent-Nova) - mark those with is_self when creating or updating them, and dispatches against them automatically target Nova's real repo; (2) any other project that involves a GitHub repo - set repo_url on that project (e.g. when the user mentions "the X repo" or gives you a github.com link) so dispatches against it know what to attach. If the user asks you to dispatch work involving a repo you don't have a URL for, ask for it and save it with update_project before dispatching, rather than dispatching into an empty environment.

At the start of each reply, check list_dispatches for anything that changed to needs_input, completed, or failed since the user's last message, and mention it proactively if so. If the user asks to stop a specific dispatch by name or description, use stop_dispatch with its id (get the id from list_dispatches if you don't already have it) — this is separate from the user's own emergency stop control, which you don't need to invoke yourself.

Be concise — responses may be read aloud, so avoid long lists or markdown formatting; speak in plain sentences.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it to .env to enable chat (see README.txt).",
      },
      { status: 500 }
    );
  }

  const requestBody = await request.json();
  const messages = requestBody.messages as ChatMessage[];
  const conversationId: string = requestBody.conversationId ?? crypto.randomUUID();

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  await getOrCreateConversation(conversationId);
  const lastUserMessage = messages[messages.length - 1];
  if (lastUserMessage?.role === "user" && lastUserMessage.content.trim()) {
    await appendMessage(conversationId, "user", lastUserMessage.content);
  }

  const runner = anthropic.beta.messages.toolRunner(
    {
      model: "claude-opus-4-8",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      tools: chatTools,
      messages,
      stream: true,
    },
    { signal: request.signal }
  );

  const encoder = new TextEncoder();
  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      try {
        for await (const messageStream of runner) {
          for await (const event of messageStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              reply += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        }
      } catch (err) {
        // a deliberate stop (client aborted) isn't an error — just stop
        // quietly and persist whatever text had streamed so far
        if (!(err instanceof Error && err.name === "AbortError")) {
          console.error("Chat error:", err);
          try {
            controller.enqueue(
              encoder.encode(
                `\n[error] ${err instanceof Error ? err.message : "Chat request failed"}`
              )
            );
          } catch {
            // controller may already be closed if the client disconnected
          }
        }
      } finally {
        if (reply.trim()) {
          await appendMessage(conversationId, "assistant", reply);
        }
        try {
          controller.close();
        } catch {
          // already closed (e.g. client aborted) — fine
        }
      }
    },
  });

  return new Response(responseStream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
