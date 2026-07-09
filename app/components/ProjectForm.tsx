"use client";

import { useState } from "react";
import UiText from "./UiText";

const STATUS_COLOR: Record<string, string> = {
  active: "#5ad7ff",
  paused: "#ffb000",
  done: "#5c7183",
};

export default function ProjectForm({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, status, notes: notes || undefined }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      setName("");
      setStatus("active");
      setNotes("");
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="project-form" onSubmit={handleSubmit}>
      <div className="scan-sweep" />
      <div className="console-strip">
        <span className="console-label">
          <UiText>Task Registry // Input</UiText>
        </span>
        <span className="console-telemetry">NV-01A</span>
      </div>
      <div className="console-fields">
        <input
          name="name"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <span
          className="status-dot"
          style={{ "--status-color": STATUS_COLOR[status] } as React.CSSProperties}
        />
        <select
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="active">active</option>
          <option value="paused">paused</option>
          <option value="done">done</option>
        </select>
        <input
          name="notes"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="submit" disabled={submitting}>
          <UiText>Add</UiText>
        </button>
      </div>
    </form>
  );
}
