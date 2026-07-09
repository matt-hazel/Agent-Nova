import type { Metadata } from "next";
import "./globals.css";
import { AurebeshProvider } from "./aurebesh-context";
import AurebeshToggle from "./components/AurebeshToggle";
import UiText from "./components/UiText";
import { toAurebesh } from "../lib/aurebesh";

const READOUT_LEFT = ["SECTOR 7", "STATUS NOMINAL", "COMLINK ACTIVE", "HOLD PATTERN"].map(
  toAurebesh
);
const READOUT_RIGHT = ["DEFLECTOR UP", "NAV LOCKED", "SCAN RANGE OK", "STANDBY MODE"].map(
  toAurebesh
);

export const metadata: Metadata = {
  title: "Nova",
  description: "Agent-driven personal dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="hud-starfield" aria-hidden="true">
          <div className="star-layer star-layer-small" />
          <div className="star-layer star-layer-med" />
          <span className="star-twinkle" style={{ top: "12%", left: "22%", animationDelay: "0s" }} />
          <span className="star-twinkle" style={{ top: "68%", left: "8%", animationDelay: "1.2s" }} />
          <span className="star-twinkle" style={{ top: "34%", left: "76%", animationDelay: "2.4s" }} />
          <span className="star-twinkle" style={{ top: "81%", left: "62%", animationDelay: "0.6s" }} />
          <span className="star-twinkle" style={{ top: "6%", left: "55%", animationDelay: "3.1s" }} />
          <span className="star-twinkle" style={{ top: "48%", left: "90%", animationDelay: "1.8s" }} />
          <span className="star-twinkle" style={{ top: "90%", left: "35%", animationDelay: "2.9s" }} />
          <span className="star-twinkle" style={{ top: "24%", left: "4%", animationDelay: "0.3s" }} />
        </div>
        <div className="hud-scope" aria-hidden="true">
          <div className="scope-rotator">
            <div className="scope-bezel" />
            <div className="scope-ring-outer" />
            <div className="scope-ring-inner" />
            <div className="scope-spoke spoke-a" />
            <div className="scope-spoke spoke-b" />
            <div className="scope-spoke spoke-c" />
          </div>
          <div className="scope-crosshair" />
          <div className="scope-center" />
        </div>
        <div className="hud-nav" aria-hidden="true">
          <div className="nav-bezel" />
          <div className="nav-orbit orbit-a" />
          <div className="nav-orbit orbit-b" />
          <div className="nav-orbit orbit-c" />
          <div className="nav-line line-a" />
          <div className="nav-line line-b" />
          <div className="nav-line line-c" />
          <div className="nav-line line-d" />
          <div className="nav-waypoint waypoint-a" />
          <div className="nav-waypoint waypoint-b" />
          <div className="nav-waypoint waypoint-c" />
          <div className="nav-waypoint waypoint-d" />
          <div className="nav-center" />
        </div>
        <div className="hud-readout readout-left" aria-hidden="true">
          {READOUT_LEFT.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <div className="hud-readout readout-right" aria-hidden="true">
          {READOUT_RIGHT.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <div className="hud-sweep" aria-hidden="true" />
        <AurebeshProvider>
          <header className="app-header">
            <h1>
              <UiText>Nova</UiText>
            </h1>
            <div className="header-controls">
              <span className="header-status" aria-hidden="true">
                <span className="alert-dot" />
                <UiText>Systems Nominal</UiText>
              </span>
              <AurebeshToggle />
            </div>
          </header>
          <main className="app-main">{children}</main>
        </AurebeshProvider>
      </body>
    </html>
  );
}
