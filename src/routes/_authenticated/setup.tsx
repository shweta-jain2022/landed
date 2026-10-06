import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, GraduationCap, CheckCircle2, ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateChecklist } from "@/lib/checklist.functions";
import { normalizeCountries } from "@/lib/country.functions";
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
  const [moveId, setMoveId] = useState<string | null>(null);
  const generate = useServerFn(generateChecklist);
  const normalize = useServerFn(normalizeCountries);
  const [fieldErr, setFieldErr] = useState<{ origin?: string; destination?: string }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!moveType) return setError("Choose Work or Study.");
    setLoading(true);
    setError(null);
    setFieldErr({});
    let o = origin.trim();
    let d = destination.trim();
    let id = moveId;
    if (!id) {
      const norm = await normalize({ data: { origin: o, destination: d } }).catch(() => ({ ok: false as const }));
      if (!norm.ok) {
        setLoading(false);
        return setError("Something went wrong checking the countries, please try again.");
      }
      if (!norm.origin || !norm.destination) {
        const msg = "We couldn't recognize this as a country -- please check the spelling.";
        setFieldErr({ origin: norm.origin ? undefined : msg, destination: norm.destination ? undefined : msg });
        return setLoading(false);
      }
      o = norm.origin;
      d = norm.destination;
    }
    const { data: corridor } = await supabase
      .from("corridor_knowledge")
      .select("default_visa_type")
      .ilike("origin_country", o)
      .ilike("destination_country", d)
      .eq("move_type", moveType)
      .limit(1)
      .maybeSingle();
    if (!id) {
      const { data: inserted, error } = await supabase.from("moves").insert({
        user_id: user.id,
        origin_country: o,
        destination_country: d,
        move_type: moveType,
        visa_type: corridor?.default_visa_type ?? null,
        target_date: targetDate,
      }).select("id").single();
      if (error || !inserted) {
        setLoading(false);
        return setError(error?.message ?? "Couldn't save your move.");
      }
      id = inserted.id;
      setMoveId(id);
    }
    try {
      const res = await generate({ data: { moveId: id } });
      if (!res.ok) throw new Error();
      navigate({ to: "/move/$moveId", params: { moveId: id } });
    } catch {
      setLoading(false);
      setError("We couldn't generate your checklist, please try again");
    }
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
        {created ? (
          <button type="button" onClick={() => setCreated(false)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-display text-lg text-primary">Landed</span>
          </button>
        ) : (
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-display text-lg text-primary">Landed</span>
          </Link>
        )}
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
                  <Input id="origin" required value={origin} onChange={(e) => { setOrigin(e.target.value); setMoveId(null); }} placeholder="e.g. India" className="h-12 rounded-xl bg-card" />
                  {fieldErr.origin && <p className="text-sm text-destructive">{fieldErr.origin}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination">Moving to</Label>
                  <Input id="destination" required value={destination} onChange={(e) => { setDestination(e.target.value); setMoveId(null); }} placeholder="e.g. Germany" className="h-12 rounded-xl bg-card" />
                  {fieldErr.destination && <p className="text-sm text-destructive">{fieldErr.destination}</p>}
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
                      onClick={() => { setMoveType(value); setMoveId(null); }}
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
                <Input id="date" type="date" required value={targetDate} onChange={(e) => { setTargetDate(e.target.value); setMoveId(null); }} className="h-12 rounded-xl bg-card" />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="text-center">
                <Button type="submit" size="lg" disabled={loading} className="h-12 w-full rounded-xl">
                  {loading ? "Building your checklist…" : "Generate my checklist"}
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
