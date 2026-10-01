import { FIELD_SCHEMAS, extractFieldsWithOpenRouter } from "../server/field-extraction.js";

function readRequestBody(request) {
  if (request.body && typeof request.body === "object") return Promise.resolve(request.body);
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4_096) request.destroy();
    });
    request.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("Invalid JSON")); }
    });
    request.on("error", reject);
  });
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  try {
    const body = await readRequestBody(request);
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const intent = typeof body.intent === "string" ? body.intent : "";
    if (!query || query.length > 500) return response.status(400).json({ error: "Enter between 1 and 500 characters" });
    if (!Object.hasOwn(FIELD_SCHEMAS, intent)) return response.status(400).json({ error: "Unsupported card" });
    const result = await extractFieldsWithOpenRouter(query, intent, process.env.OPENROUTER_API_KEY);
    return response.status(200).json(result);
  } catch (error) {
    const status = error instanceof Error && error.message === "OpenRouter is not configured" ? 503 : 502;
    return response.status(status).json({ error: status === 503 ? "Field extraction is not configured" : "Field extraction is temporarily unavailable" });
  }
}
