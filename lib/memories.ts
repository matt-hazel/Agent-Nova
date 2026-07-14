import { prisma } from "./db";

export function listMemories(category?: string) {
  return prisma.memory.findMany({
    where: category ? { category } : undefined,
    orderBy: { updatedAt: "desc" },
  });
}

export function searchMemories(query?: string, category?: string) {
  return prisma.memory.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(query
        ? { OR: [{ content: { contains: query } }, { subject: { contains: query } }] }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createMemory(data: {
  category: string;
  subject?: string;
  content: string;
  source?: string;
}) {
  return prisma.memory.create({
    data: {
      category: data.category,
      subject: data.subject,
      content: data.content,
      source: data.source ?? "explicit",
    },
  });
}

export function deleteMemory(id: string) {
  return prisma.memory.delete({ where: { id } });
}
