import { performance } from "node:perf_hooks";
import { extractFieldsWithOpenRouter } from "../server/field-extraction.js";
import { parseUnitConversion } from "../src/queryEntities.ts";

try { process.loadEnvFile(".env.local"); } catch { /* CI may provide the key through the environment. */ }
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("Set OPENROUTER_API_KEY in .env.local or the environment to run live extraction evaluation.");
  process.exitCode = 1;
} else {
  const cases = [
    { intent: "event", query: "I have to drop Sally off at school tomorrow at 3", check: (f) => /drop/i.test(f.title.value) && /school/i.test(f.title.value) && f.person.value === "Sally" && /^tomorrow$/i.test(f.day.value) && f.time.value === "3" },
    { intent: "reservation", query: "reserve Uchi Friday at 7 for 3 people", check: (f) => f.restaurant.value === "Uchi" && /^friday$/i.test(f.day.value) && f.time.value === "7" && f.people.value === "3" },
    { intent: "new-contact", query: "add Jamie 512-555-0142", check: (f) => f.name.value === "Jamie" && f.phone.value === "512-555-0142" },
    { intent: "contact", query: "text Maya I am outside", check: (f) => f.name.value === "Maya" && /outside/i.test(f.message.value) },
    { intent: "timer", query: "start a 25 minute timer", check: (f) => /25\s+minutes?/i.test(f.duration.value) },
    { intent: "unit", query: "convert 5 feet 11 inches to centimeters", check: (f) => f.amount.value === null && f.fromUnit.value === null && /centimeters?/i.test(f.toUnit.value) && parseUnitConversion("5 feet 11 inches in cm").amount === "71" },
    { intent: "currency", query: "convert 80 dollars to euros", check: (f) => f.amount.value === "80" && /dollars?/i.test(f.sourceCurrency.value) && /euros?/i.test(f.targetCurrency.value) },
    { intent: "checklist", query: "buy milk, eggs, and coffee", check: (f) => ["milk", "eggs", "coffee"].every((item) => f.items.value.toLowerCase().includes(item)) },
    { intent: "food-order", query: "order ramen from Tatsu-ya tonight", check: (f) => /ramen/i.test(f.item.value) && /tatsu-ya/i.test(f.restaurant.value) },
    { intent: "parking", query: "save parking level 2 row C", check: (f) => /level 2/i.test(f.location.value) && /row c/i.test(f.location.value) },
    { intent: "find-file", query: "find PDF of a workout plan I downloaded last week", check: (f) => /workout plan/i.test(f.subject.value) && /pdf/i.test(f.fileType.value) && /last week/i.test(f.recency.value) },
    { intent: "note", query: "note: ask dentist about whitening", check: (f) => f.title.value.split(/\s+/).length <= 3 && /ask dentist about whitening/i.test(f.body.value) },
  ];
  const results = await Promise.all(cases.map(async (item) => {
    const start = performance.now();
    try {
      const response = await extractFieldsWithOpenRouter(item.query, item.intent, apiKey);
      const latencyMs = Math.round(performance.now() - start);
      return { intent: item.intent, latencyMs, pass: item.check(response.fields), fields: response.fields };
    } catch (error) {
      return { intent: item.intent, latencyMs: Math.round(performance.now() - start), pass: false, error: error instanceof Error ? error.message : "Extraction failed" };
    }
  }));
  const latencies = results.map(({ latencyMs }) => latencyMs).sort((a, b) => a - b);
  const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * p) - 1)] ?? 0;
  console.log(JSON.stringify({ model: process.env.OPENROUTER_FIELD_MODEL || "google/gemini-3.1-flash-lite", cases: results.length, passed: results.filter(({ pass }) => pass).length, medianMs: percentile(0.5), p95Ms: percentile(0.95), results }, null, 2));
  if (results.some(({ pass }) => !pass)) process.exitCode = 1;
}
