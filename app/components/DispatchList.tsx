"use client";

import { useEffect, useState } from "react";
import UiText from "./UiText";

const STATUS_COLOR: Record<string, string> = {
  queued: "#5c7183",
  running: "#5ad7ff",
  idle: "#ffb000",
  needs_input: "#ffb000",
  completed: "#3ddc84",
  failed: "#ff4d4d",
  stopped: "#ff4d4d",
};

type Dispatch = {
  id: string;
  title: string;
  status: string;
  projectId: string | null;
  repoUrl: string | null;
  errorMessage: string | null;
  updatedAt: string;
};

type DispatchEvent = {
  id: string;
  type: string;
  processedAt: string;
  payload: Record<string, unknown>;
};

const ACTIVE_STATUSES = ["queued", "running", "idle", "needs_input"];
const TRANSCRIPT_REFRESH_MS = 10000;

// pulls "owner/repo" out of a GitHub URL for a compact badge
function repoLabel(repoUrl: string): string {
  const match = repoUrl.match(/github\.com\/([^/]+\/[^/.]+)/);
  return match ? match[1] : repoUrl;
}

function textContentOf(payload: Record<string, unknown>): string | null {
  const content = payload.content as Array<{ type: string; text?: string }> | undefined;
  if (!content) return null;
  const text = content.filter((b) => b.type === "text").map((b) => b.text).join(" ");
  return text || null;
}

function EventRow({ event }: { event: DispatchEvent }) {
  const time = new Date(event.processedAt).toLocaleTimeString();

  if (event.type === "agent.thinking") {
    return (
      <li className="dispatch-event dispatch-event-thinking">
        <span className="dispatch-event-time">{time}</span>
        <span className="dispatch-event-body">
          🧠 thinking… <em>(reasoning text isn't exposed by the API — only actions are captured)</em>
        </span>
      </li>
    );
  }

  if (
    event.type === "agent.tool_use" ||
    event.type === "agent.custom_tool_use" ||
    event.type === "agent.mcp_tool_use"
  ) {
    const name = event.payload.name as string;
    const input = JSON.stringify(event.payload.input ?? {});
    return (
      <li className="dispatch-event dispatch-event-tool-use">
        <span className="dispatch-event-time">{time}</span>
        <span className="dispatch-event-body">
          <strong>{name}</strong>({input})
        </span>
      </li>
    );
  }

  if (event.type === "agent.tool_result" || event.type === "agent.mcp_tool_result") {
    const text = textContentOf(event.payload) ?? "(no text content)";
    const isError = Boolean(event.payload.is_error);
    return (
      <li className={`dispatch-event dispatch-event-tool-result ${isError ? "dispatch-event-error" : ""}`}>
        <span className="dispatch-event-time">{time}</span>
        <span className="dispatch-event-body">{isError ? "✗ " : "→ "}{text}</span>
      </li>
    );
  }

  if (event.type === "agent.message") {
    const text = textContentOf(event.payload) ?? "";
    return (
      <li className="dispatch-event dispatch-event-message">
        <span className="dispatch-event-time">{time}</span>
        <span className="dispatch-event-body">{text}</span>
      </li>
    );
  }

  if (event.type.startsWith("session.status_")) {
    return (
      <li className="dispatch-event dispatch-event-status">
        <span className="dispatch-event-time">{time}</span>
        <span className="dispatch-event-body">
          status → {event.type.replace("session.status_", "")}
        </span>
      </li>
    );
  }

  return (
    <li className="dispatch-event">
      <span className="dispatch-event-time">{time}</span>
      <span className="dispatch-event-body">{event.type}</span>
    </li>
  );
}

function DispatchTranscript({ dispatchId, active }: { dispatchId: string; active: boolean }) {
  const [events, setEvents] = useState<DispatchEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/dispatches/${dispatchId}/events`);
        const data = await res.json();
        if (!cancelled) {
          setEvents(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = active ? setInterval(load, TRANSCRIPT_REFRESH_MS) : undefined;
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [dispatchId, active]);

  if (loading) {
    return (
      <p className="dispatch-transcript-empty">
        <UiText>Loading transcript…</UiText>
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="dispatch-transcript-empty">
        <UiText>No actions captured yet.</UiText>
      </p>
    );
  }

  return (
    <ul className="dispatch-transcript">
      {events.map((e) => (
        <EventRow key={e.id} event={e} />
      ))}
    </ul>
  );
}

function stopDispatch(id: string) {
  fetch(`/api/dispatches/${id}/stop`, { method: "POST" }).catch(() => {
    // best-effort — the SSE stream will just keep showing the current
    // status if this fails, and the user can retry
  });
}

export default function DispatchList({ dispatches }: { dispatches: Dispatch[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (dispatches.length === 0) {
    return (
      <p className="empty-state">
        <UiText>No dispatches yet — ask Nova to build something.</UiText>
      </p>
    );
  }

  return (
    <>
      <div className="console-strip">
        <span className="console-label">
          <UiText>Agent Dispatches</UiText>
        </span>
        <span className="console-telemetry">
          {String(dispatches.length).padStart(2, "0")} ENTRIES
        </span>
      </div>
      <ul className="project-list">
        {dispatches.map((d) => {
          const expanded = expandedId === d.id;
          return (
            <li key={d.id} className="project-item dispatch-item">
              <div className="scan-sweep" />
              <button
                type="button"
                className="dispatch-expand-toggle"
                onClick={() => setExpandedId(expanded ? null : d.id)}
                aria-expanded={expanded}
              >
                <span className="name">
                  {d.title}
                  {d.repoUrl && (
                    <span className="dispatch-self-badge" title={d.repoUrl}>
                      {" "}
                      · {repoLabel(d.repoUrl)}
                    </span>
                  )}
                </span>
              </button>
              <span
                className="status-dot"
                style={{ "--status-color": STATUS_COLOR[d.status] ?? "#5c7183" } as React.CSSProperties}
                title={d.status}
              />
              <span className="dispatch-status-label">
                <UiText>{d.status.replace("_", " ")}</UiText>
              </span>
              {ACTIVE_STATUSES.includes(d.status) && (
                <button
                  type="button"
                  className="dispatch-stop-button"
                  onClick={() => stopDispatch(d.id)}
                  aria-label={`Stop ${d.title}`}
                >
                  <UiText>Stop</UiText>
                </button>
              )}
              {d.errorMessage && <span className="chat-error">{d.errorMessage}</span>}
              {expanded && (
                <div className="dispatch-transcript-wrap">
                  <DispatchTranscript dispatchId={d.id} active={ACTIVE_STATUSES.includes(d.status)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
