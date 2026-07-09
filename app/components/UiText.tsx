"use client";

import { useAurebesh } from "../aurebesh-context";
import { toAurebesh } from "../../lib/aurebesh";

export default function UiText({ children }: { children: string }) {
  const { mode } = useAurebesh();
  if (mode === "aure") {
    return <span className="aurebesh-font">{toAurebesh(children)}</span>;
  }
  return <>{children}</>;
}
