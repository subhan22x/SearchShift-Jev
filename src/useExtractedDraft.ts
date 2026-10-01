import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type DraftState<T> = { query: string; value: T; edited: boolean };

/** Apply changing predictions only until the user edits that field. */
export function useExtractedDraft<T>(query: string, predicted: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<DraftState<T>>({ query, value: predicted, edited: false });
  useEffect(() => {
    setState((current) => {
      if (current.query !== query) return { query, value: predicted, edited: false };
      if (!current.edited && !Object.is(current.value, predicted)) return { ...current, value: predicted };
      return current;
    });
  }, [query, predicted]);

  const setValue: Dispatch<SetStateAction<T>> = (action) => {
    setState((current) => {
      const base = current.query === query ? current.value : predicted;
      return { query, value: typeof action === "function" ? (action as (value: T) => T)(base) : action, edited: true };
    });
  };
  return [state.query === query ? state.value : predicted, setValue];
}

export type ExtractedFields = Record<string, { value: string | null; confidence: number; evidence: string | null }>;
const supportedIntents = new Set(["event", "reservation", "reminder", "contact", "new-contact", "parking", "note", "timer", "unit", "currency", "checklist", "food-order", "find-file"]);
export const supportsFieldExtraction = (intent: string) => supportedIntents.has(intent);

export function useIntentFields(query: string, intent: string, enabled: boolean) {
  const [result, setResult] = useState<{ query: string; intent: string; fields: ExtractedFields } | null>(null);
  useEffect(() => {
    if (!enabled || !supportsFieldExtraction(intent) || query.trim().length < 4) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), intent }),
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error("Extraction unavailable");
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== "object") return;
        const data = payload as { intent?: unknown; fields?: unknown };
        if (data.intent !== intent || !data.fields || typeof data.fields !== "object") return;
        const fields = data.fields as ExtractedFields;
        if (Object.values(fields).some((field) => !field || (field.value !== null && typeof field.value !== "string") || typeof field.confidence !== "number")) return;
        setResult({ query: query.trim(), intent, fields });
      }).catch(() => {
        // Keep local parser predictions available; provider failures are non-fatal.
      });
    }, 550);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, intent, enabled]);
  return result?.query === query.trim() && result.intent === intent ? result.fields : null;
}

export function confidentValue(fields: ExtractedFields | null, key: string, fallback: string, minimum = 0.72) {
  const field = fields?.[key];
  return field?.value && field.confidence >= minimum ? field.value : fallback;
}
