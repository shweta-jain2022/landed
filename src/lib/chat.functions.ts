import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODIFY_PROMPT = `The user is updating details about their relocation move. You'll be 
given their current checklist, their move details, their message, and 
possibly verified reference information for their specific situation.

If verified reference information is provided, use it as your primary 
source of truth for any new or changed items -- don't contradict it.
If no verified reference information is provided, use your general 
knowledge, and keep specific facts (fees, dates, thresholds) 
conservative rather than stated with high confidence.

Decide: does the user's message require adding, removing, or modifying 
checklist items? If yes, return the complete updated checklist (all 
existing items plus your changes) in this JSON structure: an array of 
task objects with category, title, description, timing_window, urgency, 
and for any item you added or changed, a change_reason (short phrase, 
e.g. "traveling with a dog"). If the message is just a question and 
needs no checklist changes, return the existing checklist unchanged 
plus a separate "response" field with your answer.

Always also return a top-level "grounded" field: true if you used 
provided verified reference information for your answer/changes, false 
if you relied on general knowledge instead.

Respond ONLY with valid JSON, no markdown, no preamble.

Output shape: {"checklist": [...tasks], "response": "short reply to the user (always include one; if you changed the checklist, briefly say what changed)", "grounded": true|false}`;

const WINDOWS = ["before_arrival", "first_week", "first_month", "first_90_days"];

type Task = {
  category: string | null;
  title: string;
  description: string | null;
  timing_window: string;
  urgency: string;
  change_reason: string | null;
};

function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const s = t.search(/[[{]/);
  const e = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  return JSON.parse(t.slice(s, e + 1));
}

function normTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && typeof t.title === "string" && WINDOWS.includes(t.timing_window))
    .map((t) => ({
      category: typeof t.category === "string" ? t.category : null,
      title: t.title,
      description: typeof t.description === "string" ? t.description : null,
      timing_window: t.timing_window,
      urgency: t.urgency === "urgent" ? "urgent" : "normal",
      change_reason: typeof t.change_reason === "string" && t.change_reason.trim() ? t.change_reason : null,
    }));
}

const sig = (t: { title: string; description: string | null; timing_window: string | null; urgency: string }) =>
  [t.title.trim().toLowerCase(), (t.description ?? "").trim(), t.timing_window, t.urgency].join("|");

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ moveId: z.string().uuid(), message: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: move } = await supabase.from("moves").select("*").eq("id", data.moveId).maybeSingle();
    if (!move) return { ok: false as const };

    const [{ data: modifiers }, { data: items }] = await Promise.all([
      supabase
        .from("modifier_knowledge")
        .select("modifier_type, quick_select_label, content_blob, last_verified, source_links")
        .ilike("destination_country", move.destination_country),
      supabase.from("checklist_items").select("*").eq("move_id", move.id).order("created_at"),
    ]);
    const current = items ?? [];

    try {
      const { generateTextViaGateway } = await import("./ai-gateway.server");

      let matched: NonNullable<typeof modifiers>[number] | null = null;
      let level: "exact" | "partial" | "none" = "none";
      let reason = "No curated topics exist for this destination.";
      if (modifiers?.length) {
        const classify = `You are classifying a user's message about their relocation move against a list of curated, pre-verified topics.

Curated topics for this destination (modifier_type: label -- content):
${modifiers.map((m) => `- ${m.modifier_type}: "${m.quick_select_label ?? ""}" -- ${(m.content_blob ?? "").slice(0, 400)}`).join("\n")}

User's message: "${data.message}"

Return one match level:
- exact: the request is fully covered by a curated topic's scope (e.g. "bringing my husky" matches a dog topic; "my wife is coming later" matches a spouse topic).
- partial: related to a curated topic but not covered by it (e.g. a parrot or cat vs. a dog-only entry; a parent joining vs. a spouse-only entry).
- none: no curated topic is relevant.

Match on the specific subject, not just the general category. A different animal, relative type, or item category is partial at best. When unsure, choose partial or none, never exact.

Respond ONLY with JSON: {"match_level":"exact"|"partial"|"none","modifier_type":"<closest modifier_type or empty string>","reason":"<one sentence>"}`;
        try {
          const c = parseJson(await generateTextViaGateway("Follow the instructions exactly.", classify)) as Record<string, unknown>;
          const lv = c["match_level"];
          const m = modifiers.find((x) => x.modifier_type === c["modifier_type"]) ?? null;
          level = lv === "exact" || lv === "partial" ? lv : "none";
          if (!m) level = "none";
          matched = level === "none" ? null : m;
          reason = typeof c["reason"] === "string" ? c["reason"] : "";
        } catch {
          level = "none";
          reason = "Classification could not be parsed.";
        }
      }

      await supabase.from("move_events").insert({
        move_id: move.id,
        event_text: data.message,
        match_level: level,
        match_reason: reason,
        matched_modifier: matched?.modifier_type ?? null,
      });


      const userMsg = [
        `Move details: origin_country: ${move.origin_country}; destination_country: ${move.destination_country}; move_type: ${move.move_type}; visa_type: ${move.visa_type ?? "unknown"}; target_date: ${move.target_date}`,
        "",
        "Current checklist (JSON):",
        JSON.stringify(
          current.map((i) => ({
            category: i.category,
            title: i.title,
            description: i.description,
            timing_window: i.timing_window,
            urgency: i.urgency,
          })),
        ),
        "",
        `User's message: "${data.message}"`,
        "",
        matched
          ? `Verified reference information:\n${matched.content_blob}\nlast_verified: ${matched.last_verified}\nsource_links: ${(matched.source_links ?? []).join(", ")}`
          : "No verified reference information available for this message -- use general knowledge.",
      ].join("\n");

      const parsed = parseJson(await generateTextViaGateway(MODIFY_PROMPT, userMsg)) as Record<string, unknown> | unknown[];
      const obj: Record<string, unknown> = Array.isArray(parsed) ? { checklist: parsed } : parsed;
      const listRaw = obj["checklist"] ?? obj["tasks"] ?? obj["items"];
      const next = normTasks(listRaw);
      const grounded = obj["grounded"] === true && !!matched;
      let response = typeof obj["response"] === "string" ? obj["response"] : "";

      const before = new Set(current.map(sig));
      const after = new Set(next.map(sig));
      const changed =
        next.length > 0 && (next.length !== current.length || next.some((t) => !before.has(sig(t))));

      const changes: Task[] = [];
      if (changed) {
        const statusByTitle = new Map(current.map((i) => [i.title.trim().toLowerCase(), i.status]));
        const version = Math.max(0, ...current.map((i) => i.version)) + 1;
        const rows = next.map((t) => {
          const isNew = !before.has(sig(t));
          const reason = isNew ? t.change_reason ?? data.message.slice(0, 80) : null;
          if (isNew) changes.push({ ...t, change_reason: reason });
          return {
            move_id: move.id,
            category: t.category,
            title: t.title,
            description: t.description,
            timing_window: t.timing_window,
            urgency: t.urgency,
            status: statusByTitle.get(t.title.trim().toLowerCase()) ?? "todo",
            version,
            change_reason: reason,
          };
        });
        const removed = current.filter((i) => !after.has(sig(i))).length;
        const { error: delErr } = await supabase.from("checklist_items").delete().eq("move_id", move.id);
        if (delErr) throw delErr;
        const { error: insErr } = await supabase.from("checklist_items").insert(rows);
        if (insErr) throw insErr;
        if (!response) response = `I updated your checklist: ${changes.length} added or changed, ${removed} removed.`;
      }
      if (!response) response = "No changes needed to your checklist.";

      return {
        ok: true as const,
        response,
        grounded,
        source: grounded && matched ? { last_verified: matched.last_verified, source_links: matched.source_links ?? [] } : null,
        changes: changes.map((c) => ({ title: c.title, description: c.description, change_reason: c.change_reason })),
      };
    } catch (e) {
      console.error("chat failed", e);
      return { ok: false as const };
    }
  });
