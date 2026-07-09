import { prisma } from "./db";

export function listProjects() {
  return prisma.project.findMany({ orderBy: { updatedAt: "desc" } });
}

export function getProject(id: string) {
  return prisma.project.findUnique({ where: { id } });
}

export function createProject(data: {
  name: string;
  status?: string;
  notes?: string;
}) {
  return prisma.project.create({
    data: {
      name: data.name,
      status: data.status ?? "active",
      notes: data.notes,
    },
  });
}

export function updateProject(
  id: string,
  data: { name?: string; status?: string; notes?: string }
) {
  return prisma.project.update({ where: { id }, data });
}

export function deleteProject(id: string) {
  return prisma.project.delete({ where: { id } });
}
