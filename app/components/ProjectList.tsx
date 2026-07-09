"use client";

import { useAurebesh } from "../aurebesh-context";
import { toAurebesh } from "../../lib/aurebesh";
import UiText from "./UiText";

function label(mode: "en" | "aure", text: string) {
  return mode === "aure" ? toAurebesh(text) : text;
}

const STATUS_COLOR: Record<string, string> = {
  active: "#5ad7ff",
  paused: "#ffb000",
  done: "#5c7183",
};

type Project = {
  id: string;
  name: string;
  status: string;
  notes: string | null;
  updatedAt: string;
};

export default function ProjectList({
  projects,
  onChanged,
}: {
  projects: Project[];
  onChanged: () => void;
}) {
  const { mode } = useAurebesh();

  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onChanged();
  }

  async function handleNotesBlur(id: string, notes: string) {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    onChanged();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    onChanged();
  }

  if (projects.length === 0) {
    return (
      <p className="empty-state">
        <UiText>No projects yet — add one above.</UiText>
      </p>
    );
  }

  return (
    <>
      <div className="console-strip">
        <span className="console-label">
          <UiText>Active Registry</UiText>
        </span>
        <span className="console-telemetry">
          {String(projects.length).padStart(2, "0")} ENTRIES
        </span>
      </div>
      <ul className="project-list">
        {projects.map((p) => (
          <li key={p.id} className="project-item">
            <div className="scan-sweep" />
            <span className={`name ${mode === "aure" ? "aurebesh-font" : ""}`}>
              {label(mode, p.name)}
            </span>
            <span
              className="status-dot"
              style={{ "--status-color": STATUS_COLOR[p.status] } as React.CSSProperties}
            />
            <select
              value={p.status}
              onChange={(e) => handleStatusChange(p.id, e.target.value)}
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="done">done</option>
            </select>
            <button className="delete" onClick={() => handleDelete(p.id)}>
              <UiText>Delete</UiText>
            </button>
            <input
              key={`${p.id}-${mode}`}
              type="text"
              readOnly={mode === "aure"}
              className={`notes ${mode === "aure" ? "aurebesh-font" : ""}`}
              defaultValue={label(mode, p.notes ?? "")}
              placeholder="Notes"
              onBlur={(e) => {
                if (mode === "en") handleNotesBlur(p.id, e.target.value);
              }}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
