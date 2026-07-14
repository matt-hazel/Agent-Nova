import { prisma } from "./db";

export async function getOrCreateConversation(id: string) {
  return prisma.conversation.upsert({
    where: { id },
    update: {},
    create: { id },
  });
}

export async function appendMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
  return prisma.message.create({ data: { conversationId, role, content } });
}

export function searchConversations(params: {
  query?: string;
  since?: string;
  until?: string;
}) {
  const { query, since, until } = params;
  return prisma.message.findMany({
    where: {
      ...(query ? { content: { contains: query } } : {}),
      ...(since || until
        ? {
            createdAt: {
              ...(since ? { gte: new Date(since) } : {}),
              ...(until ? { lte: new Date(until) } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { conversation: true },
  });
}
