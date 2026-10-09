import { CircleCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifyBadge({ grounded, label, small, className }: { grounded: boolean; label?: string | undefined; small?: boolean | undefined; className?: string | undefined }) {
  const base = cn("inline-flex items-center gap-1.5 rounded-full border font-medium", small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs", className);
  return grounded ? (
    <span className={cn(base, "border-verified/40 bg-verified-soft text-verified")}>
      <CircleCheck className="h-3.5 w-3.5" /> {label ?? "Verified"}
    </span>
  ) : (
    <span className={cn(base, "border-unverified/40 bg-unverified-soft text-unverified")}>
      <TriangleAlert className="h-3.5 w-3.5" /> {label ?? "General knowledge"}
    </span>
  );
}
