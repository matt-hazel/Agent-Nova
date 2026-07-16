import { EventEmitter } from "node:events";
import { prisma } from "./db";
import { anthropic } from "./anthropic";

const CHANGED = "changed";
// this hits Anthropic's Sessions API, not local sqlite, so keep it well
// above project-events.ts's 3s interval
const POLL_INTERVAL_MS = 20000;

const NON_TERMINAL_STATUSES = ["queued", "running", "idle", "needs_input"];
const TERMINAL_STATUSES = ["completed", "failed", "stopped"];
// how long a dispatch stays eligible for one more poll tick after going
// terminal, so the last few events (final message, last tool result) that
// land right around completion aren't lost — a bit more than one tick's
// worth of margin
const TERMINAL_GRACE_MS = 25000;

const globalForEvents = globalThis as unknown as {
  dispatchEvents: EventEmitter | undefined;
  dispatchPollTimer: NodeJS.Timeout | undefined;
};

const emitter = globalForEvents.dispatchEvents ?? new EventEmitter();
emitter.setMaxListeners(50);

if (process.env.NODE_ENV !== "production") {
  globalForEvents.dispatchEvents = emitter;
}

export function emitDispatchesChanged() {
  emitter.emit(CHANGED);
}

export function onDispatchesChanged(listener: () => void) {
  emitter.on(CHANGED, listener);
}

export function offDispatchesChanged(listener: () => void) {
  emitter.off(CHANGED, listener);
}

// maps a Managed Agents session's status/stop_reason onto our local
// Dispatch.status enum
function deriveStatus(session: {
  status: string;
  stop_reason?: { type: string } | null;
}): string {
  if (session.status === "terminated") return "failed";
  if (session.status === "idle") {
    const reason = session.stop_reason?.type;
    if (reason === "requires_action") return "needs_input";
    return "completed";
  }
  if (session.status === "rescheduling") return "queued";
  return "running";
}

// pulls every session event newer than the last one we've captured for
// this dispatch and persists it verbatim — the full audit trail, not a
// summary. Dedups on the event's own id via upsert, since the
// created_at[gt] boundary can occasionally re-return the cursor event.
async function captureNewEvents(dispatch: {
  id: string;
  managedAgentsSessionId: string | null;
}) {
  if (!dispatch.managedAgentsSessionId) return;

  const latest = await prisma.dispatchEvent.findFirst({
    where: { dispatchId: dispatch.id },
    orderBy: { processedAt: "desc" },
  });

  const events = await anthropic.beta.sessions.events.list(
    dispatch.managedAgentsSessionId,
    {
      order: "asc",
      ...(latest ? { "created_at[gt]": latest.processedAt.toISOString() } : {}),
    }
  );

  for await (const event of events) {
    const processedAt = (event as { processed_at?: string }).processed_at;
    await prisma.dispatchEvent.upsert({
      where: { remoteEventId: event.id },
      create: {
        dispatchId: dispatch.id,
        remoteEventId: event.id,
        type: event.type,
        processedAt: new Date(processedAt ?? Date.now()),
        payload: JSON.stringify(event),
      },
      update: {},
    });
  }
}

async function pollActiveDispatches() {
  const graceCutoff = new Date(Date.now() - TERMINAL_GRACE_MS);
  const eligible = await prisma.dispatch.findMany({
    where: {
      managedAgentsSessionId: { not: null },
      OR: [
        { status: { in: NON_TERMINAL_STATUSES } },
        { status: { in: TERMINAL_STATUSES }, updatedAt: { gt: graceCutoff } },
      ],
    },
  });

  for (const dispatch of eligible) {
    try {
      await captureNewEvents(dispatch);
    } catch (err) {
      // a single dispatch failing to capture events shouldn't stop the
      // others, or block the status check below — just try again next tick
      console.warn(`Failed to capture events for dispatch ${dispatch.id}:`, err);
    }

    if (!NON_TERMINAL_STATUSES.includes(dispatch.status)) continue;

    try {
      const session = await anthropic.beta.sessions.retrieve(
        dispatch.managedAgentsSessionId!
      );
      const nextStatus = deriveStatus(session);
      if (nextStatus !== dispatch.status) {
        await prisma.dispatch.update({
          where: { id: dispatch.id },
          data: { status: nextStatus },
        });
        emitDispatchesChanged();
      }
    } catch (err) {
      // a single dispatch failing to refresh shouldn't stop the others —
      // just try again next tick
      console.warn(`Failed to poll dispatch ${dispatch.id}:`, err);
    }
  }
}

if (!globalForEvents.dispatchPollTimer) {
  globalForEvents.dispatchPollTimer = setInterval(
    pollActiveDispatches,
    POLL_INTERVAL_MS
  );
  globalForEvents.dispatchPollTimer.unref?.();
}
