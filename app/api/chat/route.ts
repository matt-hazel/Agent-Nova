import { NextResponse } from "next/server";
import { anthropic } from "../../../lib/anthropic";
import { chatTools } from "../../../lib/chat-tools";
import { appendMessage, getOrCreateConversation } from "../../../lib/conversations";

const SYSTEM_PROMPT = `You are the planning assistant embedded in Nova, a personal dashboard for tracking projects. Help the user think through and manage their projects. You can list, create, update, and delete projects using the tools available to you.

You also have long-term memory. Use remember_fact when the user explicitly asks you to remember something, and proactively when you notice a clear, stable fact worth keeping - e.g. someone's name and relationship to the user, a stated preference, or a durable detail about a project. When you save something proactively, briefly tell the user you saved it. Do not save one-off task details, passing opinions, or anything you are not confident is actually a stable fact. Use search_memories before answering questions about people, projects, or preferences you do not already have in context. If the user corrects a memory you saved, use forget_memory to remove it.

Every message is also saved to a searchable conversation history. Use search_conversations to answer questions like "what did we talk about last week" - combine a topic query with a date range when the user gives you a time reference.

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

  const runner = anthropic.beta.messages.toolRunner({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    tools: chatTools,
    messages,
    stream: true,
  });

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
        console.error("Chat error:", err);
        controller.enqueue(
          encoder.encode(
            `\n[error] ${err instanceof Error ? err.message : "Chat request failed"}`
          )
        );
      } finally {
        if (reply.trim()) {
          await appendMessage(conversationId, "assistant", reply);
        }
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
