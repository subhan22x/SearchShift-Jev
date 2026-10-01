import { readFile } from "node:fs/promises";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:5173";
const verbose = process.argv.includes("--verbose");
const cases = JSON.parse(await readFile(new URL("../tests/intent-cases.json", import.meta.url), "utf8"));
const results = [];
for (let start = 0; start < cases.length; start += 12) {
  const batch = cases.slice(start, start + 12);
  const response = await fetch(`${baseUrl}/__internal/intent-lab`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries: batch.map(({ query }) => query) }),
  });
  if (!response.ok) throw new Error(`Intent lab returned ${response.status}: ${await response.text()}`);
  results.push(...(await response.json()).results);
}
const strategies = ["legacy", "incremental", "single-route"];
const scores = new Map(strategies.map((strategy) => [strategy, { correct: 0, complete: 0, failures: [] }]));

for (let index = 0; index < cases.length; index += 1) {
  const testCase = cases[index];
  const result = results[index];
  for (const variant of result.variants) {
    const score = scores.get(variant.strategy);
    if (variant.error) {
      score.failures.push({ query: testCase.query, error: variant.error });
      continue;
    }
    score.complete += 1;
    const expected = variant.strategy === "incremental" && testCase.incremental ? testCase.incremental : testCase;
    const correctRoute = expected.card ? variant.card === expected.card : expected.app ? variant.decision.appId === expected.app : true;
    const correctFields = !testCase.fields || JSON.stringify(variant.fields) === JSON.stringify(testCase.fields);
    const correctApps = !expected.apps || JSON.stringify(variant.apps.map(({ id }) => id)) === JSON.stringify(expected.apps);
    const correctPresentation = !expected.presentation || variant.presentation === expected.presentation;
    const correct = correctRoute && correctFields && correctApps && correctPresentation;
    if (correct) score.correct += 1;
    else score.failures.push({
      query: testCase.query,
      expected: { card: expected.card ?? null, app: expected.app ?? null, apps: expected.apps ?? null, presentation: expected.presentation ?? null, fields: testCase.fields ?? null },
      actual: { card: variant.card, app: variant.decision.appId, apps: variant.apps.map(({ id }) => id), presentation: variant.presentation, fields: variant.fields ?? null },
    });
  }
}

for (const strategy of strategies) {
  const score = scores.get(strategy);
  console.log(`${strategy}: ${score.correct}/${cases.length} correct (${score.complete} responses)`);
  if (score.failures.length) console.log(`${strategy} failures: ${JSON.stringify(score.failures.slice(0, 8))}`);
}
if (verbose) {
  console.log("\nPer-query output:");
  for (const result of results) {
    const descriptions = result.variants.map((variant) => {
      if (variant.error) return `${variant.strategy}=ERROR`;
      const destinations = [
        ...variant.apps.map(({ id }) => `app:${id}`),
        ...(variant.card ? [`card:${variant.card}`] : []),
      ];
      return `${variant.strategy}=${destinations.join("+") || "nothing"} (${variant.presentation})`;
    });
    console.log(`${JSON.stringify(result.query)}  ${descriptions.join("  |  ")}`);
  }
}

const best = strategies.reduce((left, right) => scores.get(right).correct > scores.get(left).correct ? right : left);
console.log(`\nBest observed strategy: ${best}. This is a small regression set, not a calibrated production accuracy estimate.`);
