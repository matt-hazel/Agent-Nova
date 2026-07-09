"use client";

import { useCallback, useEffect, useState } from "react";
import ProjectForm from "./components/ProjectForm";
import ProjectList from "./components/ProjectList";
import UiText from "./components/UiText";

type Project = {
  id: string;
  name: string;
  status: string;
  notes: string | null;
  updatedAt: string;
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <section>
      <h2>
        <UiText>Projects</UiText>
      </h2>
      <ProjectForm onCreated={refresh} />
      {loading ? (
        <p className="empty-state">
          <UiText>Loading…</UiText>
        </p>
      ) : (
        <ProjectList projects={projects} onChanged={refresh} />
      )}
    </section>
  );
}
