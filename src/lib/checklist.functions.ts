import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `You are generating a personalized relocation checklist for someone 
moving abroad for work or study. You will be given the person's move 
details and, if available, verified reference information for their 
specific route. Use the reference information as your primary source of 
truth when provided -- don't contradict it or invent conflicting facts. 
If no reference information is provided, use your general knowledge, 
but keep guidance conservative and avoid stating specific fees, 
thresholds, or deadlines with high confidence.

Generate a checklist of concrete tasks grouped into exactly these four 
timing windows: before_arrival, first_week, first_month, first_90_days.

For each task, return:
- category (short label, e.g. "Visa", "Banking", "Housing", "Health")
- title (short, action-oriented, e.g. "Apply for entry visa stamp")
- description (1-2 plain-language sentences explaining why it matters)
- timing_window (one of the four above)
- urgency ("urgent" or "normal") -- mark "urgent" only for genuinely 
  time-sensitive, hard-deadline items
- source_section (string or null) -- the exact section heading or line of 
  the verified reference information that supports this item, copied 
  verbatim, or null if the item comes from general knowledge. Only cite a 
  section if the item's specific claim appears in the blob. Generic advice 
  (housing, banking, insurance, phone, tax, healthcare) is null unless the 
  blob explicitly covers it. When unsure, use null. If no reference 
  information is provided, always use null.

Return 15-25 tasks total, covering visa/immigration, banking, housing, 
health/insurance, and any route-specific essentials. Respond ONLY with 
valid JSON: an array of task objects with the fields above. No preamble, 
no markdown formatting, no explanation outside the JSON.`;

const WINDOWS = ["before_arrival", "first_week", "first_month", "first_90_days"] as const;

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Grounding is decided in code: the cited section must actually appear in the curated blob.
function sectionExists(section: string | null, blob: string | null | undefined) {
  if (!section || !blob) return false;
  const n = norm(section);
  return n.length >= 4 && norm(blob).includes(n);
}

function parseTasks(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array");
  const raw = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(raw)) throw new Error("Not an array");
  const tasks = raw
    .filter((t) => t && typeof t.title === "string" && WINDOWS.includes(t.timing_window))
    .map((t) => ({
      category: typeof t.category === "string" ? t.category : null,
      title: String(t.title),
      description: typeof t.description === "string" ? t.description : null,
      timing_window: t.timing_window as string,
      urgency: t.urgency === "urgent" ? "urgent" : "normal",
      source_section: typeof t.source_section === "string" && t.source_section.trim() ? t.source_section.trim() : null,
    }));
  if (tasks.length === 0) throw new Error("No valid tasks");
  return tasks;
}

export const generateChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ moveId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: move } = await supabase.from("moves").select("*").eq("id", data.moveId).maybeSingle();
    if (!move) return { ok: false as const };

    const { data: corridor } = await supabase
      .from("corridor_knowledge")
      .select("content_blob, last_verified, source_links")
      .ilike("origin_country", move.origin_country)
      .ilike("destination_country", move.destination_country)
      .eq("move_type", move.move_type)
      .limit(1)
      .maybeSingle();

    const lines = [
      `origin_country: ${move.origin_country}`,
      `destination_country: ${move.destination_country}`,
      `move_type: ${move.move_type}`,
      `visa_type: ${move.visa_type ?? "unknown"}`,
      `target_date: ${move.target_date}`,
      "",
    ];
    if (corridor) {
      lines.push(
        "Verified reference information for this route:",
        corridor.content_blob ?? "",
        `last_verified: ${corridor.last_verified ?? "unknown"}`,
        `source_links: ${(corridor.source_links ?? []).join(", ")}`,
      );
    } else {
      lines.push(
        "No verified reference data available for this route -- use general knowledge and keep guidance conservative.",
      );
    }

    try {
      const { generateTextViaGateway } = await import("./ai-gateway.server");
      const text = await generateTextViaGateway(SYSTEM_PROMPT, lines.join("\n"));
      const tasks = parseTasks(text);
      await supabase.from("checklist_items").delete().eq("move_id", move.id);
      const { error } = await supabase.from("checklist_items").insert(
        tasks.map((t) => {
          const grounded = sectionExists(t.source_section, corridor?.content_blob);
          return {
            ...t, move_id: move.id, version: 1, change_reason: null, grounded,
            source_section: grounded ? t.source_section : null,
            source_label: grounded ? "Verified source" : "General knowledge, not verified",
            added_because: null, added_by_message_id: null,
          };
        }),
      );
      if (error) throw error;
      return { ok: true as const };
    } catch (e) {
      console.error("checklist generation failed", e);
      return { ok: false as const };
    }
  });
