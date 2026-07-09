import { prisma } from "./db";
import { emitProjectsChanged } from "./project-events";

export function listProjects() {
  return prisma.project.findMany({ orderBy: { updatedAt: "desc" } });
}

export function getProject(id: string) {
  return prisma.project.findUnique({ where: { id } });
}

export async function createProject(data: {
  name: string;
  status?: string;
  notes?: string;
}) {
  const project = await prisma.project.create({
    data: {
      name: data.name,
      status: data.status ?? "active",
      notes: data.notes,
    },
  });
  emitProjectsChanged();
  return project;
}

export async function updateProject(
  id: string,
  data: { name?: string; status?: string; notes?: string }
) {
  const project = await prisma.project.update({ where: { id }, data });
  emitProjectsChanged();
  return project;
}

export async function deleteProject(id: string) {
  const project = await prisma.project.delete({ where: { id } });
  emitProjectsChanged();
  return project;
}
