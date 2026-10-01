export const examples = [
  "weather in Houston",
  "Spotify",
  "text Maya I’m outside",
  "remind me to water plants at 6",
  "focus for 25 minutes",
  "split $86.40 by 4",
  "save this article for later",
  "5 feet 11 inches in cm",
  "80 dollars to euros",
  "start a 12 minute pasta timer",
];

// This is the supported app catalog, not a local text matcher. JEV selects its entries.
export const apps = [
  { id: "spotify", name: "Spotify" },
  { id: "chrome", name: "Chrome" },
  { id: "obsidian", name: "Obsidian" },
  { id: "messages", name: "Messages" },
  { id: "clock", name: "Clock" },
  { id: "calendar", name: "Calendar" },
] as const;

export type Intent =
  | "weather" | "music" | "contact" | "reminder" | "timer" | "split" | "save-link" | "unit" | "currency" | "checklist" | "calorie" | "alarm" | "device" | "timezone" | "date-countdown" | "coin" | "directions" | "food-order" | "note" | "event" | "habit" | "goal" | "suggested-steps" | "new-contact" | "reservation" | "sports" | "color" | "calculate" | "automation" | "parking" | "find-file" | "unknown";

export type AppCandidate = { id: (typeof apps)[number]["id"]; name: (typeof apps)[number]["name"] };

export type RemoteDecision = {
  mode: "app_search" | "task" | "unclear";
  modeConfidence: number;
  intent: Intent;
  intentConfidence: number;
  keepAppResults: number;
  appId: (typeof apps)[number]["id"] | null;
  appScores: Partial<Record<(typeof apps)[number]["id"], number>>;
};

export type QueryResolution = {
  intent: Intent;
  intentConfidence: number;
  appCandidates: AppCandidate[];
  presentation: "app-first" | "dual" | "task-only";
};

// App-possibility is Jev's Noul signal; this threshold only controls whether
// the UI keeps app results visible alongside a provisional task card.
export const APP_SUGGESTION_THRESHOLD = 0.25;
const APP_CANDIDATE_MIN_PROBABILITY = 0.15;

const intentValues = new Set<Intent>([
  "weather", "music", "contact", "reminder", "timer", "split", "save-link", "unit", "currency", "checklist", "calorie", "alarm", "device", "timezone", "date-countdown", "coin", "directions", "food-order", "note", "event", "habit", "goal", "suggested-steps", "new-contact", "reservation", "sports", "color", "calculate", "automation", "parking", "find-file", "unknown",
]);

function isConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Validate JEV's normalized response without making a local classification decision. */
export function parseJevDecision(value: unknown): RemoteDecision | null {
  if (!value || typeof value !== "object") return null;
  const decision = value as Record<string, unknown>;
  const validMode = decision.mode === "app_search" || decision.mode === "task" || decision.mode === "unclear";
  const validApp = decision.appId === null || apps.some((app) => app.id === decision.appId);
  const validAppScores = Boolean(decision.appScores && typeof decision.appScores === "object" && apps.every(({ id }) => isConfidence((decision.appScores as Record<string, unknown>)[id])));
  if (!validMode || !intentValues.has(decision.intent as Intent) || !isConfidence(decision.modeConfidence) || !isConfidence(decision.intentConfidence) || !isConfidence(decision.keepAppResults) || !validApp || !validAppScores) return null;
  return decision as unknown as RemoteDecision;
}

function candidateFor(appId: RemoteDecision["appId"]): AppCandidate | null {
  const app = apps.find((candidate) => candidate.id === appId);
  return app ? { id: app.id, name: app.name } : null;
}

/** Render JEV's chosen task provisionally while retaining a matched app candidate if Jev supplied one. */
export function resolveQuery(remote: RemoteDecision | null): QueryResolution {
  if (!remote) return { intent: "unknown", intentConfidence: 0, appCandidates: [], presentation: "app-first" };

  const taskSelected = remote.mode !== "app_search" && remote.intent !== "unknown";
  const matchedApp = candidateFor(remote.appId);
  // A positive app-search probability with no decisive match keeps app choices
  // visible above the provisional card; a specific Jev match stays focused.
  const plausibleApps = apps
    .map(({ id, name }) => ({ id, name, probability: remote.appScores[id] ?? 0 }))
    .filter(({ probability }) => probability >= APP_CANDIDATE_MIN_PROBABILITY)
    .sort((left, right) => right.probability - left.probability)
    .slice(0, 3)
    .map(({ id, name }) => ({ id, name }));
  const taskIsSettled = remote.mode === "task"
    && remote.modeConfidence >= 0.85
    && remote.intentConfidence >= 0.85
    && remote.keepAppResults < 0.5;
  const appCandidates = matchedApp
    ? [matchedApp]
    : !taskIsSettled && remote.keepAppResults >= APP_SUGGESTION_THRESHOLD
      ? (plausibleApps.length > 0 ? plausibleApps : apps.map(({ id, name }) => ({ id, name })))
      : [];
  const intent = taskSelected ? remote.intent : "unknown";
  const presentation = remote.mode === "app_search"
    ? "app-first"
    : taskSelected && appCandidates.length > 0
      ? "dual"
      : taskSelected
        ? "task-only"
        : "app-first";

  return { intent, intentConfidence: taskSelected ? remote.intentConfidence : 0, appCandidates, presentation };
}
