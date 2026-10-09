import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

function createRunIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
    const response = await fetch(input, { ...init, headers });
    runId ??= response.headers.get(RUN_ID_HEADER)?.trim() || undefined;
    return response;
  };
}

export class AiGatewayError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export const DEFAULT_MODEL = "openai/gpt-6-astra";

/** Streams a Responses call and returns the final text. */
export async function generateTextViaGateway(
  instructions: string,
  userMessage: string,
  model: string = DEFAULT_MODEL,
  maxOutputTokens?: number,
) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiGatewayError("AI is not configured", 401);
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: createRunIdFetch(),
  });
  let streamError: unknown;
  const result = streamText({
    model: provider.responses(model),
    instructions,
    messages: [{ role: "user", content: userMessage }],
    maxRetries: 0,
    ...(maxOutputTokens ? { maxOutputTokens } : {}),
    onError: ({ error }) => {
      streamError = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const text = await result.text;
  if (streamError) {
    const status = (streamError as { statusCode?: number }).statusCode;
    throw new AiGatewayError(String((streamError as Error)?.message ?? streamError), status);
  }
  return text;
}
