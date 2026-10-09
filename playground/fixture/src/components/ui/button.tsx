import * as React from "react";
import { cn, cva, type VariantProps } from "@/lib/cva";

const buttonVariants = cva("btn", {
  variants: {
    variant: {
      default: "btn-default",
      outline: "btn-outline",
      ghost: "btn-ghost",
      destructive: "btn-destructive",
    },
    size: {
      default: "btn-md",
      sm: "btn-sm",
      icon: "btn-icon",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, loading, children, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), loading && "btn-loading", className)} {...props}>
    {children}
  </button>
));
Button.displayName = "Button";
