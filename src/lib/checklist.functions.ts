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

Return 15-25 tasks total, covering visa/immigration, banking, housing, 
health/insurance, and any route-specific essentials. Respond ONLY with 
valid JSON: an array of task objects with the fields above. No preamble, 
no markdown formatting, no explanation outside the JSON.`;

const WINDOWS = ["before_arrival", "first_week", "first_month", "first_90_days"] as const;

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
        tasks.map((t) => ({ ...t, move_id: move.id, version: 1, change_reason: null, grounded: !!corridor, source_label: corridor ? "Verified source" : "General knowledge, not verified", added_because: null, added_by_message_id: null })),
      );
      if (error) throw error;
      return { ok: true as const };
    } catch (e) {
      console.error("checklist generation failed", e);
      return { ok: false as const };
    }
  });
