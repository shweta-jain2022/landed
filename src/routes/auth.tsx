import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Landed" },
      { name: "description", content: "Sign in or create your Landed account." },
      { property: "og:title", content: "Sign in — Landed" },
      { property: "og:description", content: "Sign in or create your Landed account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [guestError, setGuestError] = useState(false);

  async function land() {
    // Zero saved moves → setup; one or more → My moves; count failure → My moves.
    const { data: moves, error: countError } = await supabase
      .from("moves")
      .select("id")
      .limit(1);
    navigate({ to: countError ? "/moves" : (moves?.length ?? 0) === 0 ? "/setup" : "/moves" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    await land();
  }

  // Reuses an existing guest session in this browser; otherwise signs in anonymously.
  async function continueAsGuest() {
    setLoading(true);
    setGuestError(false);
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user.is_anonymous) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setLoading(false);
        setGuestError(true);
        return;
      }
    }
    setLoading(false);
    await land();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-8 shadow-soft">
        <span className="font-display text-lg text-primary">Landed</span>
        <h1 className="mt-4 text-3xl font-semibold">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
            {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
        <Button type="button" variant="outline" disabled={loading} onClick={continueAsGuest} className="mt-4 h-11 w-full rounded-xl">
          Continue as guest
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">No account needed. Your data stays in this browser.</p>
        {guestError && (
          <div className="mt-3 flex items-center justify-center gap-3 text-sm text-destructive">
            <span>Couldn't start a guest session.</span>
            <Button type="button" size="sm" variant="outline" onClick={continueAsGuest}>Retry</Button>
          </div>
        )}
        <button
          type="button"
          onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }}
          className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </main>
  );
}
