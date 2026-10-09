import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, SendHorizontal, ShieldCheck, Globe, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendChatMessage } from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/move_/$moveId/chat")({
  head: () => ({
    meta: [
      { title: "Ask or update your move — Landed" },
      { name: "description", content: "Ask questions or tell Landed about changes, and your checklist updates." },
      { property: "og:title", content: "Ask or update your move — Landed" },
      { property: "og:description", content: "Ask questions or tell Landed about changes, and your checklist updates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

type Source = { last_verified: string | null; source_links: string[] } | null;
type Msg =
  | { role: "user"; text: string }
  | { role: "ai"; text: string; grounded: boolean; matchNote: string | null; source: Source; changes: { title: string; description: string | null; change_reason: string | null }[] }
  | { role: "error"; text: string };

function Tag({ grounded, source, small }: { grounded: boolean; source: Source; small?: boolean }) {
  const base = cn("inline-flex items-center gap-1.5 rounded-full border font-medium", small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs");
  if (!grounded)
    return (
      <span className={cn(base, "border-dashed border-muted-foreground/40 bg-muted text-muted-foreground")}>
        <Globe className="h-3.5 w-3.5" /> General knowledge -- not verified
      </span>
    );
  return (
    <Popover>
      <PopoverTrigger className={cn(base, "border-accent bg-accent text-accent-foreground")}>
        <ShieldCheck className="h-3.5 w-3.5" /> Verified source
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2">
        <p className="text-sm">Last verified {source?.last_verified ?? "—"}</p>
        {(source?.source_links ?? []).map((l) => (
          <a key={l} href={l} target="_blank" rel="noreferrer" className="block break-all text-sm text-primary hover:underline">{l}</a>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ChatPage() {
  const { moveId } = Route.useParams();
  const qc = useQueryClient();
  const send = useServerFn(sendChatMessage);
  const [pending, setPending] = useState<string | null>(null);
  const historyKey = ["chat", moveId];
  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: historyKey,
    queryFn: async () => {
      const { data } = await supabase.from("chat_messages").select("*").eq("move_id", moveId).order("created_at");
      return data ?? [];
    },
  });
  const { data: itemRows = [] } = useQuery({
    queryKey: ["chat-items", moveId],
    queryFn: async () => {
      const { data } = await supabase.from("checklist_items").select("id, title, description, change_reason, added_by_message_id").eq("move_id", moveId);
      return data ?? [];
    },
  });
  const msgs: (Msg & { id: string })[] = history.map((h) =>
    h.role === "user"
      ? { id: h.id, role: "user", text: h.content }
      : h.role === "error"
        ? { id: h.id, role: "error", text: h.content }
        : {
            id: h.id, role: "ai", text: h.content, grounded: h.grounded, matchNote: h.closest_topic,
            source: h.grounded ? { last_verified: h.source_last_verified, source_links: h.source_links ?? [] } : null,
            changes: itemRows.filter((i) => i.added_by_message_id === h.id).map((i) => ({ title: i.title, description: i.description, change_reason: i.change_reason })),
          },
  );
  if (pending) msgs.push({ id: "pending", role: "user", text: pending });
  const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: chips = [] } = useQuery({
    queryKey: ["chips", moveId],
    queryFn: async () => {
      const { data: move } = await supabase.from("moves").select("destination_country").eq("id", moveId).maybeSingle();
      if (!move) return [];
      const { data } = await supabase
        .from("modifier_knowledge")
        .select("id, quick_select_label")
        .ilike("destination_country", move.destination_country);
      return data ?? [];
    },
  });

  const scrolledToHash = useRef(false);
  useEffect(() => {
    const target = hash && !scrolledToHash.current ? document.getElementById(`msg-${hash}`) : null;
    if (target) {
      scrolledToHash.current = true;
      target.scrollIntoView({ block: "center" });
    } else if (!hash || scrolledToHash.current) endRef.current?.scrollIntoView({ behavior: "smooth" });
    if (!busy) inputRef.current?.focus();
  }, [history.length, itemRows.length, pending, busy, hash]);

  async function submit(message: string) {
    const m = message.trim();
    if (!m || busy) return;
    setText("");
    setBusy(true);
    setPending(m);
    scrolledToHash.current = true;
    try {
      await send({ data: { moveId, message: m } });
    } catch {
      // the server saves its own error row when it can
    } finally {
      await Promise.all([
        qc.invalidateQueries({ queryKey: historyKey }),
        qc.invalidateQueries({ queryKey: ["chat-items", moveId] }),
        qc.invalidateQueries({ queryKey: ["move", moveId] }),
      ]);
      setPending(null);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col px-6 py-10">
      <header className="mx-auto w-full max-w-xl">
        <Link to="/move/$moveId" params={{ moveId }} className="flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to checklist
        </Link>
        <h1 className="mt-8 text-3xl font-semibold">Ask or update your move</h1>
        {chips.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={() => submit(c.quick_select_label ?? "")}
                className="rounded-full border bg-card px-3.5 py-1.5 text-sm shadow-soft transition-colors hover:border-primary/50 disabled:opacity-50"
              >
                {c.quick_select_label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="mx-auto mt-8 w-full max-w-xl flex-1 space-y-5">
        {!loadingHistory && msgs.length === 0 && (
          <p className="text-sm text-muted-foreground">Tap a topic above or type anything about your move — a question, or a change like "I'm bringing my cat".</p>
        )}
        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.id} id={`msg-${m.id}`} className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground">{m.text}</p>
            </div>
          ) : m.role === "error" ? (
            <p key={m.id} id={`msg-${m.id}`} className="text-sm text-destructive">{m.text}</p>
          ) : (
            <div key={m.id} id={`msg-${m.id}`} className={cn("max-w-[90%] space-y-3 rounded-2xl", hash === m.id && "ring-2 ring-primary/40 ring-offset-4 ring-offset-background")}>
              <div className="rounded-2xl rounded-bl-md border bg-card px-4 py-3 shadow-soft">
                <p className="whitespace-pre-wrap">{m.text}</p>
                <div className="mt-3"><Tag grounded={m.grounded} source={m.source} /></div>
                {m.matchNote && <p className="mt-2 text-xs text-muted-foreground">{m.matchNote}</p>}
              </div>
              {m.changes.map((c, j) => (
                <div key={j} className={cn("rounded-xl border-l-4 bg-card px-4 py-3 shadow-soft", m.grounded ? "border-l-accent" : "border-l-muted-foreground/40")}>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Plus className="h-3 w-3" /> added because {c.change_reason}</p>
                  <p className="mt-1 font-medium">{c.title}</p>
                  {c.description && <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>}
                  <div className="mt-2"><Tag small grounded={m.grounded} source={m.source} /></div>
                </div>
              ))}
            </div>
          ),
        )}
        {busy && <p className="text-sm text-muted-foreground animate-pulse">Thinking…</p>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(text); }}
        className="sticky bottom-4 mx-auto mt-6 flex w-full max-w-xl gap-2 rounded-2xl border bg-card p-2 shadow-soft"
      >
        <Input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a question or change…" className="border-0 shadow-none focus-visible:ring-0" />
        <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send"><SendHorizontal className="h-4 w-4" /></Button>
      </form>
    </main>
  );
}
