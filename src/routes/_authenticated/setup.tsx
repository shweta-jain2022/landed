import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, GraduationCap, CheckCircle2, ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Where are you moving? — Landed" },
      { name: "description", content: "Tell us about your move and we'll build your personal checklist." },
      { property: "og:title", content: "Where are you moving? — Landed" },
      { property: "og:description", content: "Tell us about your move and we'll build your personal checklist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

type MoveType = "work" | "study";

function SetupPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [moveType, setMoveType] = useState<MoveType | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!moveType) return setError("Choose Work or Study.");
    setLoading(true);
    setError(null);
    const o = origin.trim();
    const d = destination.trim();
    const { data: corridor } = await supabase
      .from("corridor_knowledge")
      .select("default_visa_type")
      .ilike("origin_country", o)
      .ilike("destination_country", d)
      .eq("move_type", moveType)
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("moves").insert({
      user_id: user.id,
      origin_country: o,
      destination_country: d,
      move_type: moveType,
      visa_type: corridor?.default_visa_type ?? null,
      target_date: targetDate,
    });
    setLoading(false);
    if (error) return setError(error.message);
    setCreated(true);
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <header className="mx-auto flex max-w-xl items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          <span className="font-display text-lg text-primary">Landed</span>
        </Link>
        <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground">
          Sign out
        </button>
      </header>

      <div className="mx-auto mt-16 max-w-xl">
        {created ? (
          <div className="rounded-3xl border bg-card p-10 text-center shadow-soft">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 text-3xl font-semibold">Your move is saved</h1>
            <p className="mt-2 text-muted-foreground">Your checklist is coming next.</p>
          </div>
        ) : (
          <>
            <h1 className="text-4xl font-semibold">Where are you moving?</h1>
            <p className="mt-3 text-muted-foreground">We'll build your personal move checklist.</p>

            <form onSubmit={submit} className="mt-10 space-y-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="origin">Moving from</Label>
                  <Input id="origin" required value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. India" className="h-12 rounded-xl bg-card" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination">Moving to</Label>
                  <Input id="destination" required value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Germany" className="h-12 rounded-xl bg-card" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {([
                  { value: "work", label: "Work", Icon: Briefcase },
                  { value: "study", label: "Study", Icon: GraduationCap },
                ] as const).map(({ value, label, Icon }) => {
                  const active = moveType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setMoveType(value)}
                      className={cn(
                        "flex flex-col items-center gap-3 rounded-2xl border-2 bg-card px-4 py-8 transition-all",
                        active ? "border-primary bg-selected shadow-soft" : "border-border hover:border-primary/40",
                      )}
                    >
                      <Icon className={cn("h-7 w-7", active ? "text-primary" : "text-muted-foreground")} />
                      <span className="font-medium">{label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Target move date</Label>
                <Input id="date" type="date" required value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="h-12 rounded-xl bg-card" />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="text-center">
                <Button type="submit" size="lg" disabled={loading} className="h-12 w-full rounded-xl">
                  {loading ? "Saving…" : "Generate my checklist"}
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">Takes about 15 seconds</p>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
