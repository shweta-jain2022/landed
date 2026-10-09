import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODIFY_PROMPT = `The user is updating details about their relocation move. You'll be 
given their move details, the titles of their current checklist items, the 
last few chat messages, their new message, and possibly verified reference 
information for their specific situation.

If verified reference information is provided, use it as your primary 
source of truth for any new or changed items -- don't contradict it.
If no verified reference information is provided, use your general 
knowledge, and keep specific facts (fees, dates, thresholds) 
conservative rather than stated with high confidence.

Decide: does the user's message require adding, removing, or modifying 
checklist items? Return ONLY the items you add or change -- never the full 
checklist. Each item has category, title, description (1-2 plain-language 
sentences), timing_window (before_arrival | first_week | first_month | 
first_90_days), urgency ("urgent" or "normal"), and change_reason (short 
phrase, e.g. "traveling with a dog"). To change an existing item, reuse its 
exact title. Never add a new item whose title duplicates an existing one. 
List the exact titles of any items to remove in "removed_titles".

Respond ONLY with compact valid JSON, no markdown, no preamble.

Output shape: {"items": [...], "removed_titles": [...], "response": "short reply to the user (always include one; if you changed the checklist, briefly say what changed)"}`;

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

const key = (s: string) => s.trim().toLowerCase();
const sig = (t: { title: string; description: string | null; timing_window: string | null; urgency: string }) =>
  [key(t.title), (t.description ?? "").trim(), t.timing_window, t.urgency].join("|");

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        moveId: z.string().uuid(),
        message: z.string().trim().min(1).max(2000),
        modifierId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const t0 = Date.now();
    const timings: Record<string, number> = {};
    const { data: move } = await supabase.from("moves").select("*").eq("id", data.moveId).maybeSingle();
    if (!move) return { ok: false as const };

    const [{ data: modifiers }, { data: items }, { data: recent }] = await Promise.all([
      supabase
        .from("modifier_knowledge")
        .select("id, modifier_type, quick_select_label, content_blob, last_verified, source_links")
        .ilike("destination_country", move.destination_country),
      supabase.from("checklist_items").select("*").eq("move_id", move.id).order("created_at"),
      supabase
        .from("chat_messages")
        .select("role, content")
        .eq("move_id", move.id)
        .in("role", ["user", "assistant"])
        .order("created_at", { ascending: false })
        .limit(3),
    ]);
    const current = items ?? [];
    timings["db_lookup_ms"] = Date.now() - t0;

    const { error: userErr } = await supabase.from("chat_messages").insert({ move_id: move.id, role: "user", content: data.message });
    if (userErr) console.error("save user message failed", userErr);

    try {
      const { generateTextViaGateway, DEFAULT_MODEL } = await import("./ai-gateway.server");

      let matched: NonNullable<typeof modifiers>[number] | null = null;
      let level: "exact" | "partial" | "none" = "none";
      let reason = "No curated topics exist for this destination.";
      const chip = data.modifierId ? modifiers?.find((m) => m.id === data.modifierId) ?? null : null;
      if (chip) {
        // A tapped chip already names its curated topic: no classifier call.
        matched = chip;
        level = "exact";
        reason = `Selected topic: ${chip.quick_select_label ?? chip.modifier_type}.`;
        timings["classification_ms"] = 0;
      } else if (modifiers?.length) {
        const tc = Date.now();
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
          const c = parseJson(await generateTextViaGateway("Follow the instructions exactly.", classify, DEFAULT_MODEL, 2000)) as Record<string, unknown>;
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
        timings["classification_ms"] = Date.now() - tc;
      }

      const history = (recent ?? []).reverse().map((r) => `${r.role}: ${r.content.slice(0, 400)}`);
      const userMsg = [
        `Move details: origin_country: ${move.origin_country}; destination_country: ${move.destination_country}; move_type: ${move.move_type}; visa_type: ${move.visa_type ?? "unknown"}; target_date: ${move.target_date}`,
        "",
        "Existing checklist item titles:",
        JSON.stringify(current.map((i) => i.title)),
        "",
        history.length ? `Recent messages:\n${history.join("\n")}\n` : "",
        `User's message: "${data.message}"`,
        "",
        level === "exact" && matched
          ? `Verified reference information:\n${matched.content_blob}\nlast_verified: ${matched.last_verified}\nsource_links: ${(matched.source_links ?? []).join(", ")}`
          : level === "partial" && matched
            ? `PARTIAL MATCH -- the closest verified topic is "${matched.quick_select_label ?? matched.modifier_type}", which does NOT cover this request (${reason}). Use the content below only as background, never as a verified answer:\n${matched.content_blob}\n\nYour "response" MUST open by stating this limit, e.g. "Our verified answers cover dogs only. For a parrot, here's general guidance, which is not verified." Keep specific facts conservative.${/pet|animal|dog|cat/i.test(matched.modifier_type + " " + (matched.quick_select_label ?? "")) ? ` Also advise confirming with ${move.destination_country}'s official animal import authority.` : ""}`
            : "No verified reference information available for this message -- use general knowledge.",
      ].join("\n");

      const tm = Date.now();
      const parsed = parseJson(await generateTextViaGateway(MODIFY_PROMPT, userMsg, DEFAULT_MODEL, 8000)) as Record<string, unknown> | unknown[];
      timings["main_generation_ms"] = Date.now() - tm;
      const obj: Record<string, unknown> = Array.isArray(parsed) ? { items: parsed } : parsed;
      const delta = normTasks(obj["items"] ?? obj["checklist"]);
      const removedTitles = new Set(
        (Array.isArray(obj["removed_titles"]) ? obj["removed_titles"] : []).filter((x): x is string => typeof x === "string").map(key),
      );
      // Grounding is decided by code: only an exact curated match counts as verified.
      const grounded = level === "exact" && !!matched;
      let response = typeof obj["response"] === "string" ? obj["response"] : "";

      // Merge the delta into the saved checklist in code.
      const deltaByTitle = new Map(delta.map((t) => [key(t.title), t]));
      const kept = current.filter((i) => !removedTitles.has(key(i.title)));
      const removed = current.length - kept.length;
      const currentTitles = new Set(current.map((i) => key(i.title)));
      const effective = delta.filter((t) => {
        const old = current.find((i) => key(i.title) === key(t.title));
        return !old || sig(old) !== sig(t);
      });
      const changed = removed > 0 || effective.length > 0;

      const changes: Task[] = [];
      const replyId = crypto.randomUUID();
      const itemsAdded: string[] = [];
      if (changed) {
        const version = Math.max(0, ...current.map((i) => i.version)) + 1;
        const effTitles = new Set(effective.map((t) => key(t.title)));
        const rows = kept
          .filter((old) => !effTitles.has(key(old.title)))
          .map((old) => ({
            // Unchanged item: keep its own label and reason permanently.
            id: old.id, move_id: move.id, category: old.category, title: old.title, description: old.description,
            timing_window: old.timing_window, urgency: old.urgency, status: old.status, version,
            change_reason: old.change_reason, grounded: old.grounded, source_label: old.source_label, source_section: old.source_section,
            added_because: old.added_because, added_by_message_id: old.added_by_message_id,
          }));
        const statusByTitle = new Map(current.map((i) => [key(i.title), i.status]));
        for (const t of effective) {
          if (!deltaByTitle.has(key(t.title))) continue;
          const reasonTxt = t.change_reason ?? data.message.slice(0, 80);
          changes.push({ ...t, change_reason: reasonTxt });
          const id = crypto.randomUUID();
          itemsAdded.push(id);
          rows.push({
            id, move_id: move.id, category: t.category, title: t.title, description: t.description,
            timing_window: t.timing_window, urgency: t.urgency,
            status: currentTitles.has(key(t.title)) ? statusByTitle.get(key(t.title)) ?? "todo" : "todo",
            version, change_reason: reasonTxt,
            grounded, source_label: grounded ? "Verified source" : "General knowledge, not verified",
            added_because: reasonTxt, added_by_message_id: replyId, source_section: null,
          });
        }
        const { error: delErr } = await supabase.from("checklist_items").delete().eq("move_id", move.id);
        if (delErr) throw delErr;
        const { error: insErr } = await supabase.from("checklist_items").insert(rows);
        if (insErr) throw insErr;
        if (!response) response = `I updated your checklist: ${changes.length} added or changed, ${removed} removed.`;
      }
      if (!response) response = "No changes needed to your checklist.";

      const matchNote =
        level !== "exact" && matched
          ? `Closest verified topic: ${matched.quick_select_label ?? matched.modifier_type} (${reason.replace(/\.$/, "")}).`
          : null;
      const { error: replyErr } = await supabase.from("chat_messages").insert({
        id: replyId, move_id: move.id, role: "assistant", content: response, match_level: level, grounded,
        source_label: grounded ? "Verified source" : "General knowledge, not verified",
        match_reason: reason, closest_topic: matchNote, items_added: itemsAdded,
        source_last_verified: grounded && matched ? matched.last_verified : null,
        source_links: grounded && matched ? matched.source_links ?? [] : null,
      });
      if (replyErr) console.error("save reply failed", replyErr);

      timings["total_ms"] = Date.now() - t0;
      await supabase.from("move_events").insert({
        move_id: move.id,
        event_text: data.message,
        match_level: level,
        match_reason: reason,
        matched_modifier: matched?.modifier_type ?? null,
        timings,
      });

      return {
        ok: true as const,
        response,
        grounded,
        matchLevel: level,
        matchNote,
        source: grounded && matched ? { last_verified: matched.last_verified, source_links: matched.source_links ?? [] } : null,
        changes: changes.map((c) => ({ title: c.title, description: c.description, change_reason: c.change_reason })),
      };
    } catch (e) {
      console.error("chat failed", e);
      await supabase.from("chat_messages").insert({ move_id: move.id, role: "error", content: "Something went wrong, please try again." });
      return { ok: false as const };
    }
  });
