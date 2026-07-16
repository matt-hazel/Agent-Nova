import { prisma } from "./db";
import { emitDispatchesChanged } from "./dispatch-events";
import { interruptSession } from "./managed-agents";

const ACTIVE_STATUSES = ["queued", "running", "idle", "needs_input"];

export function listDispatches(status?: string) {
  return prisma.dispatch.findMany({
    where: status ? { status } : undefined,
    orderBy: { updatedAt: "desc" },
  });
}

export function getDispatch(id: string) {
  return prisma.dispatch.findUnique({ where: { id } });
}

export async function createDispatch(data: {
  title: string;
  conversationId?: string;
  projectId?: string;
  repoUrl?: string;
}) {
  const dispatch = await prisma.dispatch.create({
    data: {
      title: data.title,
      conversationId: data.conversationId,
      projectId: data.projectId,
      repoUrl: data.repoUrl,
    },
  });
  emitDispatchesChanged();
  return dispatch;
}

export async function updateDispatch(
  id: string,
  data: {
    status?: string;
    managedAgentsSessionId?: string;
    errorMessage?: string;
  }
) {
  const dispatch = await prisma.dispatch.update({ where: { id }, data });
  emitDispatchesChanged();
  return dispatch;
}

export function getDispatchEvents(dispatchId: string) {
  return prisma.dispatchEvent.findMany({
    where: { dispatchId },
    orderBy: { processedAt: "asc" },
  });
}

export async function stopDispatch(id: string) {
  const dispatch = await getDispatch(id);
  if (!dispatch) throw new Error("No dispatch found with that id");
  if (dispatch.managedAgentsSessionId) {
    await interruptSession(dispatch.managedAgentsSessionId);
  }
  return updateDispatch(id, { status: "stopped" });
}

export async function stopAllActiveDispatches() {
  const active = (await listDispatches()).filter((d) => ACTIVE_STATUSES.includes(d.status));
  return Promise.allSettled(active.map((d) => stopDispatch(d.id)));
}
