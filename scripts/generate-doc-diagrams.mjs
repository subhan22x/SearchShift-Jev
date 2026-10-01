import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve("docs/diagrams");
await mkdir(output, { recursive: true });

const palette = {
  ink: "#18283D",
  muted: "#52657D",
  edge: "#C9D5E3",
  blue: { fill: "#EAF3FF", stroke: "#5A8BD6", accent: "#3973BD" },
  violet: { fill: "#F2EDFF", stroke: "#9877DC", accent: "#7652C8" },
  green: { fill: "#E9F7EF", stroke: "#6EBD91", accent: "#36875E" },
  amber: { fill: "#FFF4DF", stroke: "#E2B45E", accent: "#B67B1F" },
  teal: { fill: "#E7F6F6", stroke: "#66B9B5", accent: "#277D79" },
  rose: { fill: "#FFF0F0", stroke: "#DA8989", accent: "#AA4F54" },
};

const architecture = {
  file: "architecture",
  width: 1560,
  height: 1030,
  title: "SearchShift-Jev · system architecture",
  subtitle: "JEV routes a query into a bounded app or card; code validates, renders, and keeps each draft editable.",
  nodes: [
    { id: "input", x: 55, y: 168, w: 220, h: 120, title: "Launcher input", lines: ["Natural-language query", "or / command palette"], tone: "blue" },
    { id: "client", x: 325, y: 168, w: 245, h: 120, title: "React client", lines: ["300 ms prefix throttle", "stale-response guard"], tone: "teal" },
    { id: "route", x: 620, y: 168, w: 205, h: 120, title: "POST /api/intent", lines: ["input validation", "JEV key stays server-side"], tone: "amber" },
    { id: "jev", x: 875, y: 150, w: 255, h: 156, title: "TypeSafe Jev", lines: ["mode · task intent · app", "app-retention signal", "approved vocabulary only"], tone: "violet" },
    { id: "resolve", x: 1180, y: 168, w: 300, h: 120, title: "Validate + resolve", lines: ["parseJevDecision()", "resolveQuery() → presentation"], tone: "green" },
    { id: "branch", x: 1128, y: 358, w: 350, h: 88, title: "Presentation decision", lines: ["app-first · app + card · task-only"], tone: "blue" },
    { id: "apps", x: 1160, y: 485, w: 315, h: 112, title: "App candidates", lines: ["up to 3 supported apps", "shown above task cards"], tone: "teal" },
    { id: "cards", x: 780, y: 625, w: 315, h: 112, title: "Approved card registry", lines: ["31 safe, typed UX cards", "React renders; model sends no UI"], tone: "violet" },
    { id: "draft", x: 375, y: 625, w: 315, h: 112, title: "Editable card draft", lines: ["fields stay under user control", "actions are preview-only here"], tone: "green" },
    { id: "extractTrigger", x: 375, y: 808, w: 270, h: 100, title: "Optional extraction", lines: ["supported card · 550 ms pause", "local parser remains available"], tone: "amber" },
    { id: "extractApi", x: 700, y: 808, w: 210, h: 100, title: "POST /api/extract", lines: ["intent schema", "key stays server-side"], tone: "blue" },
    { id: "openrouter", x: 965, y: 808, w: 230, h: 100, title: "OpenRouter · Gemini", lines: ["strict JSON fields", "query is untrusted input"], tone: "violet" },
    { id: "ground", x: 1250, y: 808, w: 250, h: 100, title: "Ground + merge", lines: ["evidence checked; values return", "to the editable card draft"], tone: "rose" },
  ],
  arrows: [
    { from: "input", to: "client", label: "text" },
    { from: "client", to: "route", label: "POST" },
    { from: "route", to: "jev", label: "server request" },
    { from: "jev", to: "resolve", label: "normalized signals" },
    { from: "resolve", to: "branch", label: "safe decision" },
    { from: "branch", to: "apps", label: "app remains plausible" },
    { from: "branch", to: "cards", label: "approved intent" },
    { from: "cards", to: "draft", label: "registered component" },
    { from: "draft", to: "extractTrigger", label: "supported fields" },
    { from: "extractTrigger", to: "extractApi", label: "query + card" },
    { from: "extractApi", to: "openrouter", label: "structured request" },
    { from: "openrouter", to: "ground", label: "candidate fields" },
  ],
  footer: "Classifier failure is visible and retryable—there is no local rule-based intent fallback. Native Android execution and private data access are outside this web prototype.",
};

const lifecycle = {
  file: "query-lifecycle",
  width: 1560,
  height: 900,
  title: "SearchShift-Jev · from text to a useful card",
  subtitle: "A predictable loop: keep up with typing, surface the likely destination, fill only grounded values, then let the user decide.",
  nodes: [
    { id: "type", x: 55, y: 175, w: 235, h: 126, title: "1 · Type a thought", lines: ["“coffee with Alex Friday at 1”", "or a short app query"], tone: "blue" },
    { id: "prefix", x: 355, y: 175, w: 260, h: 126, title: "2 · Predict prefixes", lines: ["JEV call is throttled", "latest typed prefix wins"], tone: "teal" },
    { id: "signals", x: 680, y: 155, w: 280, h: 166, title: "3 · JEV answers in parallel", lines: ["app, task, and confidence", "+ keep-app-results signal", "no generated markup/actions"], tone: "violet" },
    { id: "routeChoice", x: 1035, y: 175, w: 245, h: 126, title: "4 · Choose presentation", lines: ["app-first · dual · task-only", "old prefix holds while pending"], tone: "amber" },
    { id: "appChoice", x: 1300, y: 130, w: 220, h: 120, title: "App search", lines: ["likely app choices", "stay above the card"], tone: "teal" },
    { id: "taskChoice", x: 1300, y: 300, w: 220, h: 120, title: "Task intent", lines: ["registered card", "renders below apps"], tone: "green" },
    { id: "extract", x: 1000, y: 505, w: 285, h: 145, title: "5 · Fill grounded fields", lines: ["after a typing pause, optional", "Gemini extraction for supported", "cards; values require evidence"], tone: "violet" },
    { id: "user", x: 640, y: 505, w: 285, h: 145, title: "6 · Review and edit", lines: ["query values populate fields", "missing details stay blank", "every field stays editable"], tone: "blue" },
    { id: "action", x: 280, y: 505, w: 285, h: 145, title: "7 · Explicit next step", lines: ["preview interaction or hand-off", "no silent system action", "native APIs are not wired here"], tone: "amber" },
    { id: "palette", x: 55, y: 505, w: 175, h: 145, title: "/ palette", lines: ["local card catalog", "select → starter query", "no model needed"], tone: "teal" },
    { id: "error", x: 680, y: 355, w: 390, h: 94, title: "If JEV is unavailable", lines: ["show Error + Retry; do not classify locally"], tone: "rose" },
    { id: "guard", x: 1065, y: 730, w: 455, h: 94, title: "Trust boundary", lines: ["approved choices + validated fields only"], tone: "green" },
  ],
  arrows: [
    { from: "type", to: "prefix", label: "each edit" },
    { from: "prefix", to: "signals", label: "POST /api/intent" },
    { from: "signals", to: "routeChoice", label: "typed decision" },
    { from: "routeChoice", to: "appChoice", label: "app likely" },
    { from: "routeChoice", to: "taskChoice", label: "task likely" },
    { from: "taskChoice", to: "extract", label: "supported fields" },
    { from: "extract", to: "user", label: "evidence-checked" },
    { from: "user", to: "action", label: "user chooses" },
    { from: "type", to: "palette", label: "starts with /" },
    { from: "signals", to: "error", label: "provider failure" },
  ],
  footer: "Examples: app search keeps apps in view · “weather in Houston” selects Weather · “coffee with Alex Friday at 1” drafts an Event.",
};

const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const center = (n) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });
const find = (diagram, id) => diagram.nodes.find((node) => node.id === id);

function svgFor(diagram) {
  const arrowSvg = diagram.arrows.map(({ from, to }) => {
    const a = find(diagram, from);
    const b = find(diagram, to);
    const ac = center(a);
    const bc = center(b);
    let start = { ...ac };
    let end = { ...bc };
    if (Math.abs(bc.x - ac.x) >= Math.abs(bc.y - ac.y)) {
      start.x = bc.x > ac.x ? a.x + a.w : a.x;
      end.x = bc.x > ac.x ? b.x : b.x + b.w;
    } else {
      start.y = bc.y > ac.y ? a.y + a.h : a.y;
      end.y = bc.y > ac.y ? b.y : b.y + b.h;
    }
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const path = Math.abs(bc.x - ac.x) >= Math.abs(bc.y - ac.y)
      ? `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`
      : `M ${start.x} ${start.y} C ${start.x} ${midY}, ${end.x} ${midY}, ${end.x} ${end.y}`;
    return `<path d="${path}" fill="none" stroke="${palette.edge}" stroke-width="3" marker-end="url(#arrow)"/>`;
  }).join("\n");
  const nodeSvg = diagram.nodes.map((node) => {
    const tone = palette[node.tone];
    const titleY = node.y + 30;
    const lines = node.lines.map((line, index) => `<text x="${node.x + 21}" y="${node.y + 65 + index * 23}" class="node-line">${esc(line)}</text>`).join("");
    return `<g><rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="18" fill="${tone.fill}" stroke="${tone.stroke}" stroke-width="2"/><rect x="${node.x}" y="${node.y}" width="8" height="${node.h}" rx="4" fill="${tone.accent}"/><text x="${node.x + 21}" y="${titleY}" class="node-title">${esc(node.title)}</text>${lines}</g>`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${diagram.width} ${diagram.height}" role="img" aria-labelledby="title desc"><title id="title">${esc(diagram.title)}</title><desc id="desc">${esc(diagram.subtitle)}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${palette.muted}"/></marker><style>.title{font:700 35px Inter,system-ui,sans-serif;fill:${palette.ink}}.subtitle{font:17px Inter,system-ui,sans-serif;fill:${palette.muted}}.node-title{font:700 18px Inter,system-ui,sans-serif;fill:${palette.ink}}.node-line{font:15px Inter,system-ui,sans-serif;fill:${palette.muted}}.footer{font:15px Inter,system-ui,sans-serif;fill:${palette.muted}}</style></defs><rect width="100%" height="100%" rx="24" fill="#F7F9FC"/><text x="55" y="63" class="title">${esc(diagram.title)}</text><text x="55" y="99" class="subtitle">${esc(diagram.subtitle)}</text>${arrowSvg}${nodeSvg}<text x="55" y="${diagram.height - 28}" class="footer">${esc(diagram.footer)}</text></svg>`;
}

function excalidrawFor(diagram) {
  const elements = [];
  let nonce = 1;
  const nodeElements = [];
  const arrowElements = [];
  for (const node of diagram.nodes) {
    const tone = palette[node.tone];
    const id = `${diagram.file}-${node.id}`;
    const textId = `${id}-text`;
    const text = [node.title, ...node.lines].join("\n");
    nodeElements.push({
      id, type: "rectangle", x: node.x, y: node.y, width: node.w, height: node.h, angle: 0,
      strokeColor: tone.stroke, backgroundColor: tone.fill, fillStyle: "solid", strokeWidth: 2,
      strokeStyle: "solid", roughness: 1, opacity: 100, groupIds: [], frameId: null,
      roundness: { type: 3 }, seed: 1000 + nonce, version: 1, versionNonce: 2000 + nonce,
      isDeleted: false, boundElements: [{ id: textId, type: "text" }], updated: Date.now(), link: null, locked: false,
    });
    nodeElements.push({
      id: textId, type: "text", x: node.x + 14, y: node.y + 16, width: node.w - 28, height: node.h - 32,
      angle: 0, strokeColor: palette.ink, backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1,
      strokeStyle: "solid", roughness: 0, opacity: 100, groupIds: [], frameId: null,
      seed: 3000 + nonce, version: 1, versionNonce: 4000 + nonce, isDeleted: false, boundElements: null,
      updated: Date.now(), link: null, locked: false, fontSize: 16, fontFamily: 2, text, textAlign: "left",
      verticalAlign: "middle", containerId: id, originalText: text, autoResize: true, lineHeight: 1.25,
    });
    nonce++;
  }
  for (const arrow of diagram.arrows) {
    const from = find(diagram, arrow.from);
    const to = find(diagram, arrow.to);
    const a = center(from);
    const b = center(to);
    const x1 = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? (b.x > a.x ? from.x + from.w : from.x) : a.x;
    const y1 = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? a.y : (b.y > a.y ? from.y + from.h : from.y);
    const x2 = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? (b.x > a.x ? to.x : to.x + to.w) : b.x;
    const y2 = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? b.y : (b.y > a.y ? to.y : to.y + to.h);
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    arrowElements.push({
      id: `${diagram.file}-arrow-${nonce}`, type: "arrow", x, y, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1),
      angle: 0, strokeColor: palette.muted, backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 2,
      strokeStyle: "solid", roughness: 1, opacity: 85, groupIds: [], frameId: null,
      roundness: { type: 2 }, seed: 5000 + nonce, version: 1, versionNonce: 6000 + nonce, isDeleted: false,
      boundElements: null, updated: Date.now(), link: null, locked: false, points: [[x1 - x, y1 - y], [x2 - x, y2 - y]],
      startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: "arrow",
    });
    nonce++;
  }
  return {
    type: "excalidraw", version: 2, source: "https://excalidraw.com",
    elements: [...arrowElements, ...nodeElements],
    appState: { viewBackgroundColor: "#F7F9FC", gridSize: null, gridStep: 5, gridModeEnabled: false, exportBackground: true },
    files: {},
  };
}

for (const diagram of [architecture, lifecycle]) {
  await writeFile(resolve(output, `${diagram.file}.svg`), svgFor(diagram));
  await writeFile(resolve(output, `${diagram.file}.excalidraw`), JSON.stringify(excalidrawFor(diagram), null, 2) + "\n");
}
console.log(`Wrote ${architecture.file} and ${lifecycle.file} SVG/Excalidraw diagrams to ${output}`);
