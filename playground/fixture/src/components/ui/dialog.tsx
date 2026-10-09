import * as React from "react";
import { cn } from "@/lib/cva";

export function Dialog({ open, children }: { open?: boolean; children?: React.ReactNode }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="dialog-backdrop">
      {children}
    </div>
  );
}

export function DialogContent({ side = "center", className, children }: { side?: "center" | "right"; className?: string; children?: React.ReactNode }) {
  return <div className={cn("dialog-content", side === "right" && "dialog-right", className)}>{children}</div>;
}

export function DialogTitle({ children }: { children?: React.ReactNode }) {
  return <h2 className="dialog-title">{children}</h2>;
}

// Exported, never used anywhere.
export function DialogFooter({ children }: { children?: React.ReactNode }) {
  return <div className="dialog-footer">{children}</div>;
}
