"use client";

import { useCallback, useEffect, useState } from "react";
import ProjectForm from "./components/ProjectForm";
import ProjectList from "./components/ProjectList";
import DispatchList from "./components/DispatchList";
import UiText from "./components/UiText";

type Project = {
  id: string;
  name: string;
  status: string;
  notes: string | null;
  updatedAt: string;
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

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/projects/stream");
    source.onmessage = (event) => {
      setProjects(JSON.parse(event.data));
      setLoading(false);
    };
    return () => source.close();
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/dispatches/stream");
    source.onmessage = (event) => {
      setDispatches(JSON.parse(event.data));
    };
    return () => source.close();
  }, []);

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
      <h2>
        <UiText>Dispatches</UiText>
      </h2>
      <DispatchList dispatches={dispatches} />
    </section>
  );
}
