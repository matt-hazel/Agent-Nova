"use client";

import { useAurebesh } from "../aurebesh-context";

export default function AurebeshToggle() {
  const { mode, toggle } = useAurebesh();

  return (
    <button
      type="button"
      className="script-toggle"
      onClick={toggle}
      aria-label="Toggle between Basic and Aurebesh"
    >
      <span className={mode === "en" ? "active" : ""}>BASIC</span>
      <span className="divider">/</span>
      <span className={mode === "aure" ? "active" : ""}>AUREK</span>
    </button>
  );
}
