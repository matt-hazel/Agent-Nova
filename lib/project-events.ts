import { EventEmitter } from "node:events";
import { listProjects } from "./projects";

const CHANGED = "changed";
const POLL_INTERVAL_MS = 3000;

const globalForEvents = globalThis as unknown as {
  projectEvents: EventEmitter | undefined;
  projectPollTimer: NodeJS.Timeout | undefined;
  projectPollFingerprint: string | undefined;
};

const emitter = globalForEvents.projectEvents ?? new EventEmitter();
emitter.setMaxListeners(50);

if (process.env.NODE_ENV !== "production") {
  globalForEvents.projectEvents = emitter;
}

export function emitProjectsChanged() {
  emitter.emit(CHANGED);
}

export function onProjectsChanged(listener: () => void) {
  emitter.on(CHANGED, listener);
}

export function offProjectsChanged(listener: () => void) {
  emitter.off(CHANGED, listener);
}

function fingerprint(projects: { id: string; updatedAt: Date }[]) {
  return projects
    .map((p) => `${p.id}:${p.updatedAt.getTime()}`)
    .sort()
    .join(",");
}

async function pollForExternalChanges() {
  try {
    const projects = await listProjects();
    const next = fingerprint(projects);
    if (
      globalForEvents.projectPollFingerprint !== undefined &&
      globalForEvents.projectPollFingerprint !== next
    ) {
      emitProjectsChanged();
    }
    globalForEvents.projectPollFingerprint = next;
  } catch {
    // probably just a blip, we'll try again next tick
  }
}

if (!globalForEvents.projectPollTimer) {
  globalForEvents.projectPollTimer = setInterval(
    pollForExternalChanges,
    POLL_INTERVAL_MS
  );
  // don't want this timer to be the reason the process won't exit
  globalForEvents.projectPollTimer.unref?.();
}
