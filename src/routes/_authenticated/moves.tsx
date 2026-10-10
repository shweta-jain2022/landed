import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/moves")({
  head: () => ({
    meta: [
      { title: "My moves — Landed" },
      { name: "description", content: "All your saved relocation checklists in one place." },
      { property: "og:title", content: "My moves — Landed" },
      { property: "og:description", content: "All your saved relocation checklists in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MovesPage,
});

type Card = {
  id: string; title: string | null; origin: string; destination: string; moveType: string;
  targetDate: string; done: number; total: number; updated: string;
};

const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function MovesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [toDelete, setToDelete] = useState<Card | null>(null);
  const { user } = Route.useRouteContext();

  const { data: moves = [], isLoading } = useQuery({
    queryKey: ["my-moves"],
    queryFn: async (): Promise<Card[]> => {
      const { data: rows } = await supabase.from("moves").select("*").order("created_at", { ascending: false });
      if (!rows?.length) return [];
      const { data: items } = await supabase.from("checklist_items").select("move_id, status, created_at").in("move_id", rows.map((r) => r.id));
      return rows.map((r) => {
        const mine = (items ?? []).filter((i) => i.move_id === r.id);
        const updated = mine.reduce((a, i) => (i.created_at > a ? i.created_at : a), r.created_at);
        return {
          id: r.id, title: r.title, origin: r.origin_country, destination: r.destination_country,
          moveType: r.move_type, targetDate: r.target_date,
          done: mine.filter((i) => i.status === "done").length, total: mine.length, updated,
        };
      });
    },
  });

  async function saveTitle(id: string) {
    const t = draft.trim();
    await supabase.from("moves").update({ title: t || null }).eq("id", id);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["my-moves"] });
  }

  async function remove(id: string) {
    await Promise.all([
      supabase.from("checklist_items").delete().eq("move_id", id),
      supabase.from("chat_messages").delete().eq("move_id", id),
      supabase.from("move_events").delete().eq("move_id", id),
    ]);
    await supabase.from("moves").delete().eq("id", id);
    setToDelete(null);
    qc.invalidateQueries({ queryKey: ["my-moves"] });
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const newBtn = (
    <Button asChild className="rounded-full"><Link to="/setup"><Plus className="h-4 w-4" /> New move</Link></Button>
  );

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-xl">
        <header className="flex items-center justify-between gap-3">
          <Link to="/" className="font-display text-lg text-primary">Landed</Link>
          <div className="flex items-center gap-3">
            {moves.length > 0 && newBtn}
            <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground">
              Sign out
            </button>
          </div>
        </header>
        <h1 className="mt-8 text-3xl font-semibold">My moves</h1>
        {user.is_anonymous && !isLoading && (
          <p className="mt-1 text-sm text-muted-foreground">{moves.length} of 5 moves used</p>
        )}

        {!isLoading && moves.length === 0 && (
          <div className="mt-10 rounded-2xl border bg-card p-8 text-center shadow-soft">
            <p className="text-muted-foreground">No saved moves yet</p>
            <div className="mt-5">{newBtn}</div>
          </div>
        )}

        <ul className="mt-6 space-y-3">
          {moves.map((m) => {
            const route = `${m.origin} → ${m.destination}`;
            const pct = m.total ? (m.done / m.total) * 100 : 0;
            return (
              <li key={m.id} className="relative rounded-2xl border bg-card p-5 shadow-soft transition-colors hover:border-primary/50">
                {editing === m.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); saveTitle(m.id); }} className="flex gap-2">
                    <Input autoFocus value={draft} placeholder={route} onChange={(e) => setDraft(e.target.value)} />
                    <Button type="submit" size="sm">Save</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <Link to="/move/$moveId" params={{ moveId: m.id }} className="min-w-0 flex-1 after:absolute after:inset-0">
                      <p className="truncate font-semibold">{m.title || route}</p>
                      {m.title && <p className="truncate text-sm text-muted-foreground">{route}</p>}
                    </Link>
                    <div className="relative z-10 flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" aria-label="Rename" onClick={() => { setEditing(m.id); setDraft(m.title ?? ""); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setToDelete(m)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <p className="mt-2 text-sm text-muted-foreground">
                  {m.moveType === "study" ? "Study" : "Work"} · Target {fmt(m.targetDate)}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{m.done} of {m.total} done</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Last updated {fmt(m.updated)}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this move?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {toDelete ? toDelete.title || `${toDelete.origin} → ${toDelete.destination}` : "it"} with its checklist and chat history. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && remove(toDelete.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
