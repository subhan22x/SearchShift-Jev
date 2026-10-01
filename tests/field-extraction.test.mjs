import test from "node:test";
import assert from "node:assert/strict";
import { extractFieldsWithOpenRouter, FIELD_SCHEMAS, normalizeExtractedFields } from "../server/field-extraction.js";
import { parseEvent, parseReservation, parseNewContactQuery, parseReminder, parseDurationMinutes, parseUnitConversion, parseCurrencyConversion, parseChecklist, parseFoodOrder, parseParkingLocation } from "../src/queryEntities.ts";

const makeFields = (names, values = {}) => Object.fromEntries(names.map((name) => {
  const value = values[name] ?? null;
  return [name, { value, confidence: value === null ? 0 : 0.91, evidence: value === null ? null : value }];
}));

test("event grammar extracts a person role and only explicit date/time values", () => {
  const event = parseEvent("I have to drop Sally off to school tomorrow at 3");
  assert.deepEqual(event, { title: "Drop Sally Off To School", person: "Sally", day: "Tomorrow", time: "3:00" });
  assert.deepEqual(parseEvent("drop Sally off at school at 3"), { title: "Drop Sally Off At School", person: "Sally", day: "", time: "3:00" });
  assert.equal(parseEvent("lunch with Priya Friday at 1").person, "Priya");
  assert.equal(parseEvent("plan dentist visit").day, "");
  assert.equal(parseEvent("plan dentist visit").time, "");
});

test("event grammar handles common pickup phrasing without consuming destination", () => {
  const event = parseEvent("pick up Jamie from school Friday at 4 pm");
  assert.equal(event.person, "Jamie");
  assert.equal(event.day, "Friday");
  assert.equal(event.time, "4:00 PM");
});

test("local parser regression cases cover other supported card families", () => {
  assert.deepEqual(parseReservation("reserve Uchi Friday at 7 for 3 people"), { restaurant: "Uchi", day: "Friday", time: "7:00 PM", people: 3 });
  assert.deepEqual(parseNewContactQuery("add Jamie 512-555-0142"), { name: "Jamie", phone: "512-555-0142" });
  assert.deepEqual(parseReminder("remind me to call Maya at 6"), { title: "Call Maya", time: "18:00" });
  assert.equal(parseDurationMinutes("start a 12 minute timer"), 12);
  assert.deepEqual(parseUnitConversion("5 feet in cm"), { amount: "60", fromUnit: "in", toUnit: "cm", kind: "Length" });
  assert.deepEqual(parseCurrencyConversion("80 dollars to euros"), { amount: 80, sourceCode: "USD", targetCode: "EUR" });
  assert.deepEqual(parseChecklist("buy milk, eggs and coffee"), ["Milk", "Eggs", "Coffee"]);
  assert.deepEqual(parseFoodOrder("order ramen from Tatsu-ya tonight"), { item: "Ramen", restaurant: "Tatsu-Ya" });
  assert.equal(parseParkingLocation("save parking level 2 row C"), "level 2 · row C");
});

test("field schemas are bounded and support planned generalization cards", () => {
  assert.deepEqual(FIELD_SCHEMAS.event, ["title", "person", "day", "time"]);
  assert.ok(Object.keys(FIELD_SCHEMAS).length >= 12);
  assert.equal(FIELD_SCHEMAS["new-contact"].includes("phone"), true);
});

test("normalization rejects ungrounded, low-confidence, malformed, and extra model values", () => {
  const query = "drop Sally off at school tomorrow at 3";
  const good = makeFields(FIELD_SCHEMAS.event, { person: "Sally" });
  const normalized = normalizeExtractedFields(good, "event", query);
  assert.equal(normalized.person.value, "Sally");
  assert.equal(normalizeExtractedFields({ ...good, secret: "extra" }, "event", query), null);
  assert.equal(normalizeExtractedFields({ ...good, person: { value: "Morgan", confidence: 0.99, evidence: "Morgan" } }, "event", query).person.value, null);
  assert.equal(normalizeExtractedFields({ ...good, person: { value: "Sally", confidence: 0.2, evidence: "Sally" } }, "event", query).person.value, null);
  assert.equal(normalizeExtractedFields({ ...good, person: { value: "Sally", confidence: 0.99, evidence: "school" } }, "event", query).person.value, null);
  assert.equal(normalizeExtractedFields({ ...good, time: { value: "3 PM", confidence: 0.99, evidence: "at three" } }, "event", query).time.value, null);
  const note = makeFields(FIELD_SCHEMAS.note, { title: "Dentist appointment", body: "Ask the dentist about teeth whitening." });
  note.title.evidence = "ask dentist about whitening";
  note.body.evidence = "ask dentist about whitening";
  assert.equal(normalizeExtractedFields(note, "note", "note: ask dentist about whitening").title.value, null);
  assert.equal(normalizeExtractedFields(note, "note", "note: ask dentist about whitening").body.value, null);
});

test("unit validation rejects merged units so the exact local compound parser can take over", () => {
  const unit = makeFields(FIELD_SCHEMAS.unit, { amount: "5 feet 11 inches", fromUnit: "feet 11 inches", toUnit: "centimeters" });
  const normalized = normalizeExtractedFields(unit, "unit", "convert 5 feet 11 inches to centimeters");
  assert.equal(normalized.amount.value, null);
  assert.equal(normalized.fromUnit.value, null);
  assert.equal(normalized.toUnit.value, "centimeters");
  assert.deepEqual(parseUnitConversion("convert 5 feet 11 inches to centimeters"), { amount: "71", fromUnit: "in", toUnit: "cm", kind: "Length" });
});

test("OpenRouter request pins the chosen model and requires strict schema output", async () => {
  let captured;
  const query = "lunch with Priya Friday at 1";
  const values = { title: "Lunch", person: "Priya", day: "Friday", time: "1:00 PM" };
  const content = makeFields(FIELD_SCHEMAS.event, values);
  const result = await extractFieldsWithOpenRouter(query, "event", "test-key", async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ model: "google/gemini-3.1-flash-lite", choices: [{ message: { content: JSON.stringify(content) } }] }) };
  });
  assert.equal(captured.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(captured.options.headers.Authorization, "Bearer test-key");
  assert.equal(captured.body.model, "google/gemini-3.1-flash-lite");
  assert.equal(captured.body.temperature, 0);
  assert.equal(captured.body.response_format.json_schema.strict, true);
  assert.equal(captured.body.provider.require_parameters, true);
  assert.equal(result.fields.person.value, "Priya");
});

test("provider failures and malformed output are explicit errors", async () => {
  await assert.rejects(() => extractFieldsWithOpenRouter("test", "event", ""), /not configured/);
  await assert.rejects(() => extractFieldsWithOpenRouter("test", "unsupported", "key"), /Unsupported/);
  await assert.rejects(() => extractFieldsWithOpenRouter("test", "event", "key", async () => ({ ok: false, status: 429 })), /429/);
  await assert.rejects(() => extractFieldsWithOpenRouter("test", "event", "key", async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "not json" } }] }) })), /invalid JSON/);
});
