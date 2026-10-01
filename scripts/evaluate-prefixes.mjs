import { readFile } from "node:fs/promises";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:5173";
const curatedCases = JSON.parse(await readFile(new URL("../tests/prefix-intent-cases.json", import.meta.url), "utf8"));
const intentCases = JSON.parse(await readFile(new URL("../tests/intent-cases.json", import.meta.url), "utf8"));
const destination = ({ card, app }) => card ? `card:${card}` : app ? `app:${app}` : null;
const casesByDestination = new Map(curatedCases.map((testCase) => [destination(testCase), testCase]));
for (const testCase of intentCases) {
  const key = destination(testCase);
  if (key && !casesByDestination.has(key)) casesByDestination.set(key, { query: testCase.query, ...(testCase.card ? { card: testCase.card } : { app: testCase.app }) });
}
const cases = [...casesByDestination.values()];
const jobs = [];
const negativePrefixes = ["f", "w", "n"];

for (const testCase of cases) {
  let previous = "";
  for (let position = 1; position <= testCase.query.length; position += 1) {
    const prefix = testCase.query.slice(0, position).trim();
    if (!prefix || prefix === previous) continue;
    jobs.push({ caseIndex: cases.indexOf(testCase), query: prefix, typedLength: position });
    previous = prefix;
  }
}
for (const query of negativePrefixes) jobs.push({ caseIndex: -1, query, typedLength: query.length, negativePrefix: true });

const results = new Array(jobs.length);
for (let start = 0; start < jobs.length; start += 12) {
  const batch = jobs.slice(start, start + 12);
  const response = await fetch(`${baseUrl}/__internal/intent-lab`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries: batch.map(({ query }) => query), strategies: ["incremental"] }),
  });
  if (!response.ok) throw new Error(`Intent lab returned ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  for (let offset = 0; offset < batch.length; offset += 1) {
    results[start + offset] = payload.results[offset].variants[0];
  }
  console.log(`Classified ${Math.min(start + batch.length, jobs.length)}/${jobs.length} prefixes`);
}

const perCase = cases.map((testCase, caseIndex) => {
  const samples = jobs
    .map((job, index) => ({ ...job, result: results[index] }))
    .filter((job) => job.caseIndex === caseIndex);
  const match = (result) => testCase.card
    ? result.card === testCase.card
    : result.decision?.appId === testCase.app;
  const first = samples.find(({ result }) => !result.error && match(result));
  const intermediateCards = samples
    .filter(({ result }) => result.card && result.card !== (testCase.card ?? null))
    .map(({ query, result }) => ({ prefix: query, card: result.card }));
  const complete = samples.at(-1);
  const fullInputClassified = complete && !complete.result.error && match(complete.result);
  return {
    query: testCase.query,
    expected: testCase.card ? `card:${testCase.card}` : `app:${testCase.app}`,
    firstCorrectPrefix: first?.query ?? null,
    typedCharacters: first?.typedLength ?? null,
    fractionTyped: first ? Number((first.typedLength / testCase.query.length).toFixed(2)) : null,
    beforeComplete: Boolean(first && first.typedLength < testCase.query.length),
    correctAtComplete: Boolean(fullInputClassified),
    intermediateCards,
    error: samples.find(({ result }) => result.error)?.result.error,
  };
});

const negativeResults = jobs
  .map((job, index) => ({ ...job, result: results[index] }))
  .filter(({ negativePrefix }) => negativePrefix)
  .map(({ query, result }) => ({ query, noCard: !result.error && !result.card, accidentalCard: result.card ?? null, apps: result.apps?.map(({ id }) => id) ?? [], error: result.error }));

const beforeComplete = perCase.filter((item) => item.beforeComplete).length;
const completeCorrect = perCase.filter((item) => item.correctAtComplete).length;
const transitionsBeforeCompletion = perCase.filter((item) => item.intermediateCards.some(({ prefix }) => prefix.length < item.query.length)).length;
console.log(`\nDistinct card/app destinations audited: ${cases.length} (curated prefix flows plus all unique regression destinations)`);
console.log(`Correct destination before final character: ${beforeComplete}/${cases.length}`);
console.log(`Correct destination by complete query: ${completeCorrect}/${cases.length}`);
console.log(`Queries with an intermediate card transition before the final destination: ${transitionsBeforeCompletion}/${cases.length}`);
console.log(`Single-character prefixes with no premature task card: ${negativeResults.filter(({ noCard }) => noCard).length}/${negativeResults.length}`);
for (const item of perCase) console.log(JSON.stringify(item));
for (const item of negativeResults) console.log(JSON.stringify({ negativePrefix: item }));
