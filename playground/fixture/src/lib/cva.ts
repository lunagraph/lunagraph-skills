// A tiny stand-in for class-variance-authority, so the fixture needs no install.
type Variants = Record<string, Record<string, string>>;
type Selection<V extends Variants> = { [K in keyof V]?: keyof V[K] | null };

export type VariantProps<T> = T extends (props?: infer P) => string ? P : never;

export function cva<V extends Variants>(base: string, config: { variants: V; defaultVariants?: Selection<V> }) {
  return (props: Selection<V> = {}) =>
    [
      base,
      ...Object.keys(config.variants).map((axis) => {
        const chosen = props[axis] ?? config.defaultVariants?.[axis];
        return chosen ? config.variants[axis][chosen as string] : "";
      }),
    ].join(" ");
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
