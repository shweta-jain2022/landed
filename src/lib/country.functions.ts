import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const COUNTRY_MODEL = "openai/gpt-5.4-mini";

const prompt = (raw: string) => `The user typed this as a country name, possibly using an abbreviation, 
alias, or with a typo: "${raw}"

Return ONLY the standard official English country name as it would 
appear in formal/diplomatic contexts -- for example, "United Arab 
Emirates" not "UAE", "United States" not "USA" or "America", 
"Philippines" not "Phillipines". 

If the input is genuinely not a recognizable country, respond with 
exactly: UNKNOWN

Respond with ONLY the country name or UNKNOWN. No explanation, no 
punctuation beyond what's part of the name itself.`;

export const normalizeCountries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ origin: z.string().trim().min(1).max(100), destination: z.string().trim().min(1).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { generateTextViaGateway } = await import("./ai-gateway.server");
    const one = async (raw: string) => {
      const out = (await generateTextViaGateway("Follow the instructions exactly.", prompt(raw), COUNTRY_MODEL))
        .trim()
        .replace(/^["']|["'.]$/g, "")
        .trim();
      return !out || out.toUpperCase() === "UNKNOWN" ? null : out;
    };
    try {
      const [origin, destination] = await Promise.all([one(data.origin), one(data.destination)]);
      return { ok: true as const, origin, destination };
    } catch (e) {
      console.error("normalize failed", e);
      return { ok: false as const };
    }
  });
