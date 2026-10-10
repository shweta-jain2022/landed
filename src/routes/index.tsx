import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Landed — Relocation paperwork, sorted" },
      { name: "description", content: "Moving abroad for work or study? Landed builds your personal move checklist." },
      { property: "og:title", content: "Landed — Relocation paperwork, sorted" },
      { property: "og:description", content: "Moving abroad for work or study? Landed builds your personal move checklist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  // Returning user with an existing session: send them to their moves (or
  // setup if they have none). Only on a fresh app load — navigating to "/"
  // from inside the app (e.g. the "Landed" back button on My moves) shows the
  // home page instead of bouncing straight back. A count failure falls back
  // to My moves.
  useEffect(() => {
    if (hasLandedOnce) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      const { data: moves, error } = await supabase.from("moves").select("id").limit(1);
      if (cancelled) return;
      hasLandedOnce = true;
      if (error) navigate({ to: "/moves" });
      else navigate({ to: (moves?.length ?? 0) === 0 ? "/setup" : "/moves" });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="font-display text-4xl font-bold tracking-tight text-primary sm:text-5xl">Landed</span>
      <h1 className="mt-6 max-w-xl text-5xl font-semibold leading-tight">
        Your move abroad, without the paperwork panic.
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        A personal checklist for every visa, permit and registration — for work or study.
      </p>
      <Button asChild size="lg" className="mt-10 rounded-full px-8">
        <Link to="/setup">Get started</Link>
      </Button>
    </main>
  );
}
