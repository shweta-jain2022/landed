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
