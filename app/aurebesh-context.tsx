"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Mode = "en" | "aure";

const AurebeshContext = createContext<{
  mode: Mode;
  toggle: () => void;
}>({ mode: "en", toggle: () => {} });

const STORAGE_KEY = "nova-script-mode";

export function AurebeshProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "aure") {
      setMode(stored);
    }
  }, []);

  function toggle() {
    setMode((prev) => {
      const next = prev === "en" ? "aure" : "en";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }

  return (
    <AurebeshContext.Provider value={{ mode, toggle }}>
      {children}
    </AurebeshContext.Provider>
  );
}

export function useAurebesh() {
  return useContext(AurebeshContext);
}
