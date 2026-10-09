import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AuditCanvas,
  CanvasPanel,
  CanvasSpecimen,
  useAuditCanvas,
} from "../../skills/audit/canvas/AuditCanvas";

/**
 * Mock audit for exercising the canvas. This is not the audit page the skill
 * writes; it only uses the same pieces in the same places.
 */

type Group = { id: string; label: string; uses: number; versions: number; handRolled: number };

const GROUPS: Group[] = [
  { id: "modals", label: "Modals", uses: 23, versions: 3, handRolled: 4 },
  { id: "tables", label: "Tables", uses: 14, versions: 3, handRolled: 0 },
  { id: "buttons", label: "Buttons", uses: 41, versions: 2, handRolled: 12 },
  { id: "dropdowns", label: "Dropdowns", uses: 9, versions: 2, handRolled: 0 },
  { id: "inputs", label: "Inputs", uses: 18, versions: 1, handRolled: 0 },
  { id: "tabs", label: "Tabs", uses: 7, versions: 2, handRolled: 0 },
  { id: "cards", label: "Cards", uses: 31, versions: 5, handRolled: 9 },
  { id: "badges", label: "Badges", uses: 17, versions: 1, handRolled: 0 },
];

const BUTTON_STYLES = [
  { background: "#18181b", color: "#fff", borderRadius: 8 },
  { background: "#fff", color: "#18181b", borderRadius: 8, border: "1px solid #e4e4e7" },
  { background: "#f54900", color: "#fff", borderRadius: 999 },
  { background: "#009689", color: "#fff", borderRadius: 4 },
  { background: "#104e64", color: "#fff", borderRadius: 14 },
  { background: "#ffb900", color: "#18181b", borderRadius: 999 },
];

/** `?stress=600` adds that many extra specimens, for checking the canvas stays smooth on a big audit. */
const STRESS = Number(new URLSearchParams(window.location.search).get("stress")) || 0;

declare global {
  interface Window {
    /** How many times a component that reads the canvas context has rendered. Checked by check.mjs. */
    __canvasConsumerRenders?: number;
  }
}

export function Demo() {
  return (
    <AuditCanvas
      id={STRESS ? "stress" : "inventory"}
      topLeft={
        <CanvasPanel className="bar">
          <strong>Design system audit</strong>
          <code>acme-app</code>
          <span className="pill outline">localhost:5173</span>
        </CanvasPanel>
      }
      topRight={
        <>
          <CanvasPanel className="bar">
            <span className="muted">Scanned 412 files, 2 min ago</span>
            <code>48%</code>
          </CanvasPanel>
          <CanvasPanel className="bar">Edit in Lunagraph ↗</CanvasPanel>
        </>
      }
      bottomRight={<WhatNext />}
    >
      <div className="layout">
        <Inventory />
        <div className="groups">
          {GROUPS.map((group) => (
            <GroupBlock key={group.id} group={group} />
          ))}
          {STRESS ? (
            <section className="group">
              <header>
                <strong>Stress</strong>
                <span className="muted">{STRESS} specimens</span>
              </header>
              <div className="tile strip wrap">
                {Array.from({ length: STRESS }, (_, index) => (
                  <CanvasSpecimen key={index} name={`Button ${index + 1}`}>
                    <button className="demo-button" style={BUTTON_STYLES[index % BUTTON_STYLES.length]}>
                      Send invite
                    </button>
                  </CanvasSpecimen>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </AuditCanvas>
  );
}

function Inventory() {
  const { focus } = useAuditCanvas();
  window.__canvasConsumerRenders = (window.__canvasConsumerRenders ?? 0) + 1;
  const total = GROUPS.reduce((sum, group) => sum + group.uses, 0);
  return (
    <div className="inventory" data-canvas-id="inventory">
      <span className="muted small">Inventory</span>
      <div className="tile column">
        <strong>{total} components</strong>
        <span className="muted small">{GROUPS.length} groups, none audited yet</span>
        {GROUPS.map((group) => (
          <button key={group.id} className="row" data-testid={`row-${group.id}`} onClick={() => focus(group.id)}>
            <span className="circle" />
            <span>{group.label}</span>
            <span className="muted count">{group.uses}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupBlock({ group }: { group: Group }) {
  return (
    <section className="group" data-canvas-id={group.id} data-canvas-select={group.label}>
      <header>
        <strong>{group.label}</strong>
        <span className="muted">{group.uses} uses</span>
        {group.versions > 1 ? <span className="pill">{group.versions} versions</span> : null}
        {group.handRolled > 0 ? <span className="pill amber">{group.handRolled} hand-rolled</span> : null}
        {group.versions === 1 && group.handRolled === 0 ? <span className="pill outline">Consistent</span> : null}
      </header>
      <div className="tile strip">{specimensFor(group)}</div>
    </section>
  );
}

function specimensFor(group: Group): ReactNode {
  if (group.id === "buttons") {
    return BUTTON_STYLES.map((style, index) => (
      <CanvasSpecimen key={index} name={`Button ${index + 1}`}>
        <button className="demo-button" style={style}>
          Send invite
        </button>
      </CanvasSpecimen>
    ));
  }
  if (group.id === "modals") {
    return (
      <>
        <CanvasSpecimen name="Dialog" width={420} height={280} scale={0.4}>
          <SharedDialog />
        </CanvasSpecimen>
        <CanvasSpecimen name="Hand-rolled modal" width={420} height={280} scale={0.4} className="dashed">
          <HandRolledModal />
        </CanvasSpecimen>
        <CanvasSpecimen name="LegacyPopup" width={420} height={280} scale={0.4}>
          <Broken />
        </CanvasSpecimen>
      </>
    );
  }
  if (group.id === "inputs") {
    return (
      <CanvasSpecimen name="Input">
        <input className="demo-input" placeholder="name@company.com" />
      </CanvasSpecimen>
    );
  }
  if (group.id === "tables") return <ClickCounter />;
  if (group.id === "tabs") {
    return (
      <CanvasSpecimen name="Live">
        <LiveBits />
      </CanvasSpecimen>
    );
  }
  return <span className="muted small">Specimens for {group.label.toLowerCase()} go here</span>;
}

function SharedDialog() {
  return (
    <div className="demo-backdrop" style={{ position: "absolute", inset: 0 }}>
      <div className="demo-dialog">
        <strong>Invite teammates</strong>
        <span className="muted">They can see every campaign in Acme.</span>
        <div className="demo-actions">
          <button className="demo-button" style={BUTTON_STYLES[1]}>
            Cancel
          </button>
          <button className="demo-button" style={BUTTON_STYLES[0]}>
            Send invite
          </button>
        </div>
      </div>
    </div>
  );
}

/** A modal built the way apps hand-roll them: a fixed full-screen backdrop. The specimen must contain it. */
function HandRolledModal() {
  return (
    <div className="demo-backdrop" data-testid="fixed-backdrop" style={{ position: "fixed", inset: 0 }}>
      <div className="demo-dialog" style={{ borderRadius: 0 }}>
        <strong>Delete contact?</strong>
        <span className="muted">Removes Dana Okafor from 2 campaigns.</span>
        <button className="demo-button" style={{ background: "#e7000b", color: "#fff", borderRadius: 4 }}>
          Delete
        </button>
      </div>
    </div>
  );
}

function Broken(): ReactNode {
  throw new Error("LegacyPopup needs a <ThemeProvider>");
}

/** Lives in the canvas outside a specimen, to show that content stays clickable with the select tool. */
function ClickCounter() {
  const [clicks, setClicks] = useState(0);
  return (
    <button className="demo-button" data-testid="counter" style={BUTTON_STYLES[1]} onClick={() => setClicks(clicks + 1)}>
      Clicked {clicks}
    </button>
  );
}

/** A specimen is live: its button works, its link does not leave the page, its menu opens above the canvas. */
function LiveBits() {
  const [tries, setTries] = useState(0);
  const [open, setOpen] = useState(false);
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button className="demo-button" data-testid="live-button" style={BUTTON_STYLES[1]} onClick={() => setTries(tries + 1)}>
        Tried {tries}
      </button>
      <a data-testid="live-link" href="https://example.com/left-the-audit">
        Leave
      </a>
      <button className="demo-button" data-testid="menu-trigger" style={BUTTON_STYLES[1]} onClick={() => setOpen(!open)}>
        Menu
      </button>
      {open
        ? createPortal(
            // The two ways libraries portal a menu: the positioned element itself, or a plain wrapper around it.
            <>
              <div data-testid="menu-direct" style={{ position: "fixed", top: 300, left: 40, zIndex: 50, padding: 12, background: "#fff", border: "1px solid #e4e4e7" }}>
                Direct
              </div>
              <div data-testid="menu-wrapper">
                <div data-testid="menu-wrapped" style={{ position: "fixed", top: 360, left: 40, zIndex: 50, padding: 12, background: "#fff", border: "1px solid #e4e4e7" }}>
                  Wrapped
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </span>
  );
}

function WhatNext() {
  const [copied, setCopied] = useState<string | null>(null);
  const steps = [
    { title: "Audit the modals", reason: "23 modals, built 4 different ways", prompt: "/lunagraph:audit modals" },
    { title: "Find the hand-rolled buttons", reason: "12 of 41 buttons skip your Button component", prompt: "/lunagraph:audit buttons" },
    { title: "Compare all tables", reason: "14 tables, in 3 different versions", prompt: "/lunagraph:audit tables" },
  ];
  return (
    <CanvasPanel className="next">
      <span className="muted small">What next</span>
      {steps.map((step) => (
        <button
          key={step.title}
          className="row next-row"
          onClick={() => {
            void navigator.clipboard?.writeText(step.prompt);
            setCopied(step.title);
          }}
        >
          <span className="column">
            <span>{step.title}</span>
            <span className="muted small">{step.reason}</span>
          </span>
          <span className="muted small count">{copied === step.title ? "Copied" : "Copy"}</span>
        </button>
      ))}
      <span className="muted small">Copies a prompt for Codex or Claude Code</span>
    </CanvasPanel>
  );
}
