import { createElement, type PropsWithChildren } from "react";

const sizes = { sm: "text-sm", md: "text-md", lg: "text-lg" };

type TextProps = PropsWithChildren<{ as?: "p" | "span"; size?: keyof typeof sizes; muted?: boolean }>;

// Built with createElement, not JSX: the scanner must still see it as a component.
export function Text({ as = "p", size = "md", muted, children }: TextProps) {
  return createElement(as, { className: `${sizes[size]} ${muted ? "text-muted" : ""}` }, children);
}
