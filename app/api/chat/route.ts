import { NextResponse } from "next/server";
import { anthropic } from "../../../lib/anthropic";
import { chatTools } from "../../../lib/chat-tools";

const SYSTEM_PROMPT = `You are the planning assistant embedded in Nova, a personal dashboard for tracking projects. Help the user think through and manage their projects. You can list, create, update, and delete projects using the tools available to you. Be concise — responses may be read aloud, so avoid long lists or markdown formatting; speak in plain sentences.`;

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

  const body = await request.json();
  const messages = body.messages as ChatMessage[];

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  try {
    const runner = anthropic.beta.messages.toolRunner({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      tools: chatTools,
      messages,
    });

    const finalMessage = await runner.runUntilDone();
    const reply = finalMessage.content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat request failed" },
      { status: 500 }
    );
  }
}
