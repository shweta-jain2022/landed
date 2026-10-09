import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ShieldCheck, Info, MessageCircle } from "lucide-react";
import { VerifyBadge } from "@/components/VerifyBadge";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/move/$moveId")({
  head: () => ({
    meta: [
      { title: "Your move checklist — Landed" },
      { name: "description", content: "Your personal relocation checklist, grouped by when each task matters." },
      { property: "og:title", content: "Your move checklist — Landed" },
      { property: "og:description", content: "Your personal relocation checklist, grouped by when each task matters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MovePage,
});

const SECTIONS = [
  ["before_arrival", "Before arrival"],
  ["first_week", "First week"],
  ["first_month", "First month"],
  ["first_90_days", "First 90 days"],
] as const;

function MovePage() {
  const { moveId } = Route.useParams();
  const qc = useQueryClient();
  const key = ["move", moveId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: move } = await supabase.from("moves").select("*").eq("id", moveId).maybeSingle();
      const { data: items } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("move_id", moveId)
        .order("created_at");
      let corridor = null;
      if (move) {
        const { data: c } = await supabase
          .from("corridor_knowledge")
          .select("last_verified, source_links")
          .ilike("origin_country", move.origin_country)
          .ilike("destination_country", move.destination_country)
          .eq("move_type", move.move_type)
          .limit(1)
          .maybeSingle();
        corridor = c;
      }
      return { move, items: items ?? [], corridor };
    },
  });
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "verified" | "unverified">("all");

  async function toggle(id: string, done: boolean) {
    const status = done ? "done" : "todo";
    setErr(null);
    qc.setQueryData(key, (old: typeof data) =>
      old ? { ...old, items: old.items.map((i) => (i.id === id ? { ...i, status } : i)) } : old,
    );
    const { error } = await supabase.from("checklist_items").update({ status }).eq("id", id);
    if (error) {
      setErr("Couldn't save that change. Please try again.");
      qc.invalidateQueries({ queryKey: key });
    }
  }

  if (isLoading) return <main className="p-10 text-center text-muted-foreground">Loading your checklist…</main>;
  if (!data?.move) return <main className="p-10 text-center text-muted-foreground">Move not found.</main>;

  const { move, items, corridor } = data;
  const done = items.filter((i) => i.status === "done").length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const verifiedCount = items.filter((i) => i.grounded).length;
  const generalCount = items.length - verifiedCount;
  const summary = `${items.length} items: ${verifiedCount} verified, ${generalCount} general knowledge.`;
  const shown = items.filter((i) => (filter === "all" ? true : filter === "verified" ? i.grounded : !i.grounded));

  return (
    <main className="min-h-screen px-6 py-10">
      <header className="mx-auto flex max-w-xl items-center justify-between">
        <Link to="/setup" className="flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          <span className="font-display text-lg text-primary">Landed</span>
        </Link>
        <Link
          to="/move/$moveId/chat"
          params={{ moveId }}
          className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-soft hover:border-primary/50"
        >
          <MessageCircle className="h-4 w-4 text-primary" /> Ask or update your move
        </Link>
      </header>

      <div className="mx-auto mt-12 max-w-xl">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-semibold">Your move</h1>
          <span className="text-sm text-muted-foreground">{done} of {items.length} done</span>
        </div>
        <p className="mt-2 text-muted-foreground">
          {move.origin_country} → {move.destination_country} · <span className="capitalize">{move.move_type}</span>
        </p>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {corridor && verifiedCount > 0 ? (
            <Popover>
              <PopoverTrigger className="flex items-center gap-2 text-left text-sm text-verified underline-offset-4 hover:underline">
                <ShieldCheck className="h-4 w-4 shrink-0" /> {summary}
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-2">
                <p className="text-sm font-medium">Sources (last checked {corridor.last_verified})</p>
                {(corridor.source_links ?? []).map((l) => (
                  <a key={l} href={l} target="_blank" rel="noreferrer" className="block break-all text-sm text-primary hover:underline">{l}</a>
                ))}
              </PopoverContent>
            </Popover>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Info className="h-4 w-4 shrink-0" /> {summary}</p>
          )}
          <div role="group" aria-label="Filter items" className="flex rounded-full border bg-card p-0.5 text-xs shadow-soft">
            {([["all", "All"], ["verified", "Verified"], ["unverified", "General knowledge"]] as const).map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={filter === v}
                onClick={() => setFilter(v)}
                className={cn("rounded-full px-3 py-1 font-medium transition-colors", filter === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {err && <p className="mt-4 text-sm text-destructive">{err}</p>}

        <div className="mt-10 space-y-10">
          {SECTIONS.map(([win, label]) => {
            const list = shown.filter((i) => i.timing_window === win);
            if (!list.length) return null;
            return (
              <section key={win}>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</h2>
                <div className="mt-4 space-y-3">
                  {list.map((i) => {
                    const isDone = i.status === "done";
                    return (
                      <label
                        key={i.id}
                        className={cn(
                          "relative flex cursor-pointer gap-4 rounded-2xl border bg-card p-5 shadow-soft transition-opacity",
                          !i.grounded && "border-l-2 border-l-unverified",
                          isDone && "opacity-60",
                        )}
                      >
                        <Checkbox checked={isDone} onCheckedChange={(v) => toggle(i.id, v === true)} className="mt-0.5" />
                        <div className="min-w-0 flex-1 pr-14">
                          <p className={cn("font-medium", isDone && "line-through")}>{i.title}</p>
                          {i.description && <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>}
                          {!i.grounded && i.added_by_message_id && (
                            <div className="mt-2 space-y-0.5 text-xs">
                              <Link
                                to="/move/$moveId/chat"
                                params={{ moveId }}
                                hash={i.added_by_message_id}
                                onClick={(e) => e.stopPropagation()}
                                className="text-unverified underline-offset-4 hover:underline"
                              >
                                Added because: {i.added_because ?? i.change_reason}
                              </Link>
                              <p className="text-muted-foreground">General guidance, confirm with official sources</p>
                            </div>
                          )}
                          {i.grounded && i.added_by_message_id && (
                            <Link to="/move/$moveId/chat" params={{ moveId }} hash={i.added_by_message_id} onClick={(e) => e.stopPropagation()} className="mt-2 block text-xs text-muted-foreground underline-offset-4 hover:underline">
                              Added because: {i.added_because ?? i.change_reason}
                            </Link>
                          )}
                          {i.grounded && i.source_section && <p className="mt-2 text-xs text-verified">Source: {i.source_section}</p>}
                          <VerifyBadge grounded={i.grounded} small className="mt-3" />
                        </div>
                        {i.urgency === "urgent" && (
                          <span className="absolute right-4 top-4 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                            Urgent
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
