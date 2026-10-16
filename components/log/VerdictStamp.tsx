import { Stamp } from "@/components/stamp/Stamp";
import { shortName } from "@/lib/candidates";
import { verdict } from "@/lib/verdict";

/** The verdict as a static stamp, for cards and the detail view. */
export function VerdictStamp({ prediction, size = "sm", className }: { prediction: number; size?: "sm" | "lg"; className?: string }) {
  const v = verdict(prediction);
  return (
    <Stamp
      kind={v.kind}
      title={v.kind === "voted" ? `VOTED · #${prediction}` : v.stamp}
      subtitle={v.kind === "voted" ? shortName(prediction).toUpperCase() : undefined}
      label={v.label}
      size={size}
      animate={false}
      rotate={-9}
      className={className}
    />
  );
}
