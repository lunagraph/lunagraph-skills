import { cn } from "@/lib/cva";

type BadgeTone = "neutral" | "success" | "warning";

export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children?: React.ReactNode }) {
  return <span className={cn("badge", `badge-${tone}`, className)}>{children}</span>;
}
