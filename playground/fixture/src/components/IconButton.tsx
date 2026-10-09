import * as React from "react";
import { Button } from "./ui";

/** A local wrapper around the shared Button: a competing version. */
export function IconButton({ active, ...props }: Omit<React.ComponentProps<typeof Button>, "size"> & { active?: boolean }) {
  return <Button size="icon" variant={active ? "default" : "ghost"} {...props} />;
}
