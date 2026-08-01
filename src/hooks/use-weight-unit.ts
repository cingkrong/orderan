import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSettings } from "@/lib/settings.functions";

export type WeightUnit = "g" | "kg";

/**
 * Reads the system-wide weight unit setting.
 * Storage is ALWAYS in grams — this only controls display + input UX.
 */
export function useWeightUnit(): {
  unit: WeightUnit;
  /** Convert grams → display value in the active unit */
  toDisplay: (g: number) => number;
  /** Convert a display value (in the active unit) → grams for storage */
  toGrams: (v: number) => number;
  /** Format a gram value for display, with unit suffix */
  format: (g: number | null | undefined) => string;
} {
  const fetch = useServerFn(getSettings);
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch(),
    staleTime: 60_000,
  });
  const unit: WeightUnit = (data as any)?.weight_unit === "kg" ? "kg" : "g";
  const toDisplay = (g: number) => (unit === "kg" ? Number((g / 1000).toFixed(3)) : g);
  const toGrams = (v: number) => (unit === "kg" ? Math.round(v * 1000) : Math.round(v));
  const format = (g: number | null | undefined) => {
    const v = g ?? 0;
    if (unit === "kg") return `${(v / 1000).toFixed(2)} kg`;
    return `${v} g`;
  };
  return { unit, toDisplay, toGrams, format };
}
