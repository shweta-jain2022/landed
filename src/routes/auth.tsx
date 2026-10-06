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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (!error && data.session) {
      navigate({ to: "/setup" });
      return;
    }
    // Existing account: quietly sign in with the same details.
    const res = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (res.error) setError(error?.message ?? "That email is already registered with a different password.");
    else navigate({ to: "/setup" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-8 shadow-soft">
        <span className="font-display text-lg text-primary">Landed</span>
        <h1 className="mt-4 text-3xl font-semibold">Create your account</h1>
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
            {loading ? "Please wait…" : "Create account"}
          </Button>
        </form>
      </div>
    </main>
  );
}
