import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import classifyIntent from "./api/intent.js";
import extractFields from "./api/extract.js";
import { classifyWithJev } from "./server/jev.js";

async function readJson(request: any, maxBytes = 16_384) {
  if (request.body && typeof request.body === "object") return request.body;
  let body = "";
  for await (const chunk of request) {
    body += chunk.toString();
    if (body.length > maxBytes) throw new Error("Request body is too large");
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(response: any, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

const localIntentApi = {
  name: "local-intent-api",
  configureServer(server: { middlewares: { use: (path: string, handler: (request: any, response: any) => void) => void } }) {
    server.middlewares.use("/api/intent", (request, response) => {
      response.status = (code: number) => ({ json: (payload: unknown) => { response.statusCode = code; response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(payload)); } });
      void classifyIntent(request, response);
    });
  },
};

const localFieldExtractionApi = {
  name: "local-field-extraction-api",
  configureServer(server: { middlewares: { use: (path: string, handler: (request: any, response: any) => void) => void } }) {
    server.middlewares.use("/api/extract", (request, response) => {
      response.status = (code: number) => ({ json: (payload: unknown) => { response.statusCode = code; response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(payload)); } });
      void extractFields(request, response);
    });
  },
};

// Dev-only inspection API: reports the same card/app presentation decisions the React app uses.
const intentLabApi = {
  name: "local-intent-lab-api",
  configureServer(server: any) {
    server.middlewares.use("/__internal/intent-lab", (request: any, response: any) => {
      void (async () => {
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          return sendJson(response, 405, { error: "Method not allowed" });
        }
        try {
          const body = await readJson(request);
          const queries = Array.isArray(body.queries) ? body.queries : [body.query];
          const strategies = Array.isArray(body.strategies) ? body.strategies : ["legacy", "incremental", "single-route"];
          const allowed = new Set(["legacy", "incremental", "single-route"]);
          if (!queries.length || queries.length > 12 || queries.some((query: unknown) => typeof query !== "string" || !query.trim() || query.length > 500)) {
            return sendJson(response, 400, { error: "Send 1–12 non-empty queries, each up to 500 characters." });
          }
          if (!strategies.length || strategies.length > 3 || strategies.some((strategy: unknown) => !allowed.has(strategy as string))) {
            return sendJson(response, 400, { error: "Strategies must be legacy, incremental, and/or single-route." });
          }
          const [{ resolveQuery }, { parseNewContactQuery }] = await Promise.all([
            server.ssrLoadModule("/src/intent.ts"),
            server.ssrLoadModule("/src/queryEntities.ts"),
          ]);
          const results = [];
          for (const query of queries) {
            const variants = [];
            for (const strategy of strategies) {
              try {
                const decision = await classifyWithJev(query.trim(), process.env.JEV_API_KEY, { strategy });
                const resolution = resolveQuery(decision);
                const showCard = resolution.intent !== "unknown" || resolution.presentation !== "app-first";
                const showApps = resolution.presentation !== "task-only" && resolution.appCandidates.length > 0;
                variants.push({
                  strategy,
                  decision,
                  presentation: resolution.presentation,
                  card: showCard ? resolution.intent : null,
                  apps: showApps ? resolution.appCandidates.map(({ id, name }: { id: string; name: string }) => ({ id, name })) : [],
                  fields: showCard && resolution.intent === "new-contact" ? parseNewContactQuery(query.trim()) : undefined,
                });
              } catch (error) {
                variants.push({ strategy, error: error instanceof Error ? error.message : "Classification failed" });
              }
            }
            results.push({ query, variants });
          }
          return sendJson(response, 200, { generatedAt: new Date().toISOString(), results });
        } catch (error) {
          const status = error instanceof Error && error.message === "JEV is not configured" ? 503 : 400;
          return sendJson(response, status, { error: error instanceof Error ? error.message : "Invalid request" });
        }
      })();
    });
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.JEV_API_KEY) process.env.JEV_API_KEY = env.JEV_API_KEY;
  if (env.OPENROUTER_API_KEY) process.env.OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
  if (env.OPENROUTER_FIELD_MODEL) process.env.OPENROUTER_FIELD_MODEL = env.OPENROUTER_FIELD_MODEL;
  return { plugins: [react(), localIntentApi, localFieldExtractionApi, intentLabApi] };
});
