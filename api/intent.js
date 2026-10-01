import { classifyWithJev } from "../server/jev.js";

function readRequestBody(request) {
  if (request.body && typeof request.body === "object") return Promise.resolve(request.body);
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4_096) request.destroy();
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
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
    if (query.length < 1 || query.length > 500) return response.status(400).json({ error: "Enter between 1 and 500 characters" });
    const decision = await classifyWithJev(query, process.env.JEV_API_KEY);
    return response.status(200).json(decision);
  } catch (error) {
    const status = error instanceof Error && error.message === "JEV is not configured" ? 503 : 502;
    return response.status(status).json({ error: "Smart classification is temporarily unavailable" });
  }
}
