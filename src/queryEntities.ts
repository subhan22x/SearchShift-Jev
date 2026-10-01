const WEEKDAY = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight)\b/i;

export function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

export function extractDay(query: string, fallback = "Today") {
  const value = query.match(WEEKDAY)?.[1];
  return value ? titleCase(value) : fallback;
}

export function extractDisplayTime(query: string, fallback: string, defaultMeridiem: "AM" | "PM" = "PM") {
  const match = query.match(/\b(?:at|for)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return fallback;
  const hour = Math.min(12, Math.max(1, Number(match[1])));
  const minutes = match[2] ?? "00";
  const meridiem = (match[3]?.toUpperCase() as "AM" | "PM" | undefined) ?? defaultMeridiem;
  return `${hour}:${minutes} ${meridiem}`;
}

export function displayTimeToInput(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return "12:00";
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

export function inputTimeToDisplay(value: string) {
  const [rawHour, minute = "00"] = value.split(":");
  const hour = Number(rawHour);
  const meridiem = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minute} ${meridiem}`;
}

export function parseReservation(query: string) {
  const peopleMatch = query.match(/\b(?:party\s+of|table\s+for|for)\s+(\d+)\s*(?:people|persons?|guests?)\b/i);
  const time = extractDisplayTime(query, "7:00 PM", /breakfast|morning/i.test(query) ? "AM" : "PM");
  const day = extractDay(query, "Today");
  const timePattern = /\b(?:at|for)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i;
  const partyPattern = /\b(?:party\s+of|table\s+for|for)\s+\d+\s*(?:people|persons?|guests?)\b/i;
  const restaurant = query
    .replace(partyPattern, " ")
    .replace(timePattern, " ")
    .replace(WEEKDAY, " ")
    .replace(/^\s*(?:please\s+)?(?:reserve|book|make)\s*(?:me\s+)?(?:a\s+)?(?:reservation|table)?\s*/i, "")
    .replace(/\b(?:dinner|lunch|breakfast)\b/gi, " ")
    .replace(/^\s*(?:at|for)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    restaurant: restaurant ? titleCase(restaurant) : "Choose restaurant",
    day,
    time,
    people: Math.max(1, Number(peopleMatch?.[1] ?? 2)),
  };
}

export function parseEvent(query: string) {
  const explicitDay = query.match(WEEKDAY)?.[1];
  const day = explicitDay ? titleCase(explicitDay) : "";
  const timeMatch = query.match(/\b(?:at|for)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  const rawHour = timeMatch ? Number(timeMatch[1]) : 0;
  const time = timeMatch
    ? timeMatch[3]
      ? extractDisplayTime(query, "", "PM")
      : `${Math.min(12, Math.max(1, rawHour))}:${timeMatch[2] ?? "00"}`
    : "";
  const stopWords = "off|up|to|from|at|on|today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday";
  const person = query.match(new RegExp(`\\bwith\\s+([\\p{L}'’-]+(?:\\s+(?!${stopWords}\\b)[\\p{L}'’-]+)?)(?=\\s+(?:${stopWords})\\b|$)`, "iu"))
    ?? query.match(new RegExp(`\\b(?:drop|take|drive)\\s+([\\p{L}'’-]+)(?:\\s+(?!${stopWords}\\b)[\\p{L}'’-]+)?\\s+(?:off|to)\\b`, "iu"))
    ?? query.match(new RegExp(`\\bpick\\s+up\\s+([\\p{L}'’-]+)(?:\\s+(?!${stopWords}\\b)[\\p{L}'’-]+)?(?=\\s+(?:${stopWords})\\b|$)`, "iu"));
  const personName = person?.[1] ?? "";
  const title = query
    .replace(/^\s*(?:please\s+)?(?:i\s+)?(?:have|need)\s+to\s+/i, "")
    .replace(/^\s*(?:please\s+)?remind\s+me\s+to\s+/i, "")
    .replace(WEEKDAY, " ")
    .replace(/\b(?:at|for)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title: titleCase(title || "New event"), person: titleCase(personName), day, time };
}

export function parseContactQuery(query: string) {
  const cleaned = query.replace(/^\s*(?:text|message|call)\b\s*/i, "").trim();
  const capitalizedName = cleaned.match(/^([A-Z][\p{L}'-]*(?:\s+[A-Z][\p{L}]*)?)(?=\s|$)/u)?.[1];
  const firstToken = cleaned.split(/\s+/)[0] ?? "";
  const name = capitalizedName ?? titleCase(firstToken);
  const message = cleaned.slice(name.length).trim().replace(/^[:,]\s*/, "");
  return { name, message };
}

export function parseNewContactQuery(query: string) {
  const phone = query.match(/\+?\d[\d\s().-]{5,}\d/)?.[0]?.trim() ?? "";
  const withoutPhone = query.replace(phone, " ").trim();
  const commandOnly = withoutPhone.toLowerCase();
  const command = "new contact";
  if (commandOnly && command.startsWith(commandOnly)) return { name: "", phone };

  const name = withoutPhone
    .replace(/^\s*(?:please\s+)?(?:add|create|save)\s+/i, "")
    .replace(/^\s*(?:a\s+)?(?:new\s+)?contact\b/i, "")
    .replace(/^\s*(?:for|named|called|as)\s+/i, "")
    .replace(/\bto\s+contacts?\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,:-]+|[\s,:-]+$/g, "");
  return { name: titleCase(name), phone };
}

export function parseChecklist(query: string) {
  const cleaned = query
    .replace(/^\s*(?:(?:add|create|make|build|start|new)\s+)?(?:a\s+)?(?:shopping|grocery|to-?do|check)?\s*list(?:\s+(?:of|for|with))?\b[:\s]*/i, " ")
    .replace(/^\s*(?:buy|get|pick up|grab|shop for|add|create|make|start|new)\b[:\s]+/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  return cleaned
    .split(/\s*(?:[,;]|\band\b)\s*/i)
    .flatMap((part) => part.split(/\s+/))
    .map((item) => item.replace(/^[-•*]+/, "").trim())
    .map(titleCase)
    .filter(Boolean);
}

export function parseSplit(query: string) {
  const peopleMatch = query.match(/(?:by|between|among|for)\s+(\d+)(?:\s*(?:people|persons?|ways?|guests?))?/i);
  const people = peopleMatch ? Math.min(99, Math.max(1, Number(peopleMatch[1]))) : null;
  const remainder = peopleMatch ? query.replace(peopleMatch[0], " ") : query;
  const amount = remainder.match(/\$?\s*(\d+(?:\.\d+)?)/)?.[1] ?? "";
  return { amount, people };
}

export function parseDurationMinutes(query: string) {
  const match = query.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|hours?|hrs?)\b/i) ?? query.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  const minutes = /hour|hr/i.test(match[0]) ? value * 60 : value;
  return Math.min(180, Math.max(1, Math.round(minutes)));
}

export function parseFoodOrder(query: string) {
  const restaurant = query.match(/\bfrom\s+(.+?)(?=\s+(?:at|for|today|tomorrow|tonight)\b|$)/i)?.[1]?.trim() ?? "";
  const item = query
    .replace(/^\s*(?:order|deliver|get)\s+/i, "")
    .replace(/\bfrom\s+.+?(?=\s+(?:at|for|today|tomorrow|tonight)\b|$)/i, " ")
    .replace(/\b(?:today|tomorrow|tonight)\b/gi, " ")
    .replace(/\b(?:at|for)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { item: titleCase(item || "Food order"), restaurant: titleCase(restaurant) };
}

export function parseReminder(query: string) {
  const title = query
    .replace(/^.*?remind(?:er)?(?:\s+me)?(?:\s+to)?\s*/i, "")
    .replace(/\s+(?:at|for)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b.*$/i, "")
    .trim();
  const displayTime = extractDisplayTime(query, "", "PM");
  return { title: titleCase(title), time: displayTime ? displayTimeToInput(displayTime) : "" };
}

export function parseSports(query: string) {
  const [left = "Home", right = "Away"] = query.split(/\s+(?:vs\.?|versus)\s+/i);
  return { left: titleCase(left), right: titleCase(right) };
}

export function parseAutomation(query: string) {
  const [action = "Set device state", condition = "When condition is met"] = query.split(/\s+when\s+/i);
  return { action: titleCase(action), condition: titleCase(condition) };
}

export function parseFileQuery(query: string) {
  const type = query.match(/\b(pdf|docx?|spreadsheet|image|photo|video|presentation|file)\b/i)?.[1]?.toUpperCase() ?? "FILE";
  const subject = query
    .replace(/^\s*(?:find|locate|open|where is)\s+/i, "")
    .replace(/\b(?:pdf|docx?|spreadsheet|image|photo|video|presentation|file)\s+(?:of|for)\s+/i, "")
    .replace(/\s+(?:i\s+)?downloaded\b.*$/i, "")
    .replace(/\s+last\s+(?:week|month|year)\b.*$/i, "")
    .trim();
  const extension = type === "PDF" ? ".pdf" : "";
  return { type, label: `${titleCase(subject || "Matching file")}${extension}`, recency: /last week/i.test(query) ? "Downloaded last week" : "Best local match" };
}

export function parseCalorieFood(query: string) {
  return titleCase(query.replace(/^.*?calories?(?:\s+in|\s+for|\s+of)?\s*/i, "").trim() || "Food");
}

export function parseColorLabel(query: string) {
  return titleCase(query.replace(/\b(?:what is|show|find|the|hex|rgb|color|colour|of|for)\b/gi, " ").replace(/\s+/g, " ").trim() || "Selected color");
}

export function parseParkingLocation(query: string) {
  const first = query.match(/\b(?:level|floor|row|spot|section)\s+[\w-]+/i)?.[0];
  if (!first) return "Add level, row, or landmark";
  const remainder = query.slice((query.indexOf(first) ?? 0) + first.length);
  const second = remainder.match(/\b(?:level|floor|row|spot|section)\s+[\w-]+/i)?.[0];
  return second ? `${first} · ${second}` : first;
}

const unitAliases: Record<string, { label: string; kind: "length" | "weight"; toBase: number }> = {
  ft: { label: "ft", kind: "length", toBase: 0.3048 }, feet: { label: "ft", kind: "length", toBase: 0.3048 }, foot: { label: "ft", kind: "length", toBase: 0.3048 },
  in: { label: "in", kind: "length", toBase: 0.0254 }, inch: { label: "in", kind: "length", toBase: 0.0254 }, inches: { label: "in", kind: "length", toBase: 0.0254 },
  cm: { label: "cm", kind: "length", toBase: 0.01 }, centimeter: { label: "cm", kind: "length", toBase: 0.01 }, centimeters: { label: "cm", kind: "length", toBase: 0.01 },
  m: { label: "m", kind: "length", toBase: 1 }, meter: { label: "m", kind: "length", toBase: 1 }, meters: { label: "m", kind: "length", toBase: 1 },
  km: { label: "km", kind: "length", toBase: 1000 }, kilometer: { label: "km", kind: "length", toBase: 1000 }, kilometers: { label: "km", kind: "length", toBase: 1000 },
  mi: { label: "mi", kind: "length", toBase: 1609.344 }, mile: { label: "mi", kind: "length", toBase: 1609.344 }, miles: { label: "mi", kind: "length", toBase: 1609.344 },
  kg: { label: "kg", kind: "weight", toBase: 1 }, kilogram: { label: "kg", kind: "weight", toBase: 1 }, kilograms: { label: "kg", kind: "weight", toBase: 1 },
  lb: { label: "lb", kind: "weight", toBase: 0.45359237 }, lbs: { label: "lb", kind: "weight", toBase: 0.45359237 }, pound: { label: "lb", kind: "weight", toBase: 0.45359237 }, pounds: { label: "lb", kind: "weight", toBase: 0.45359237 },
};

const unitPattern = "cm|centimeters?|m|meters?|km|kilometers?|in|inches?|ft|feet|foot|mi|miles?|kg|kilograms?|lb|lbs|pounds?";

export function parseUnitConversion(query: string) {
  const targetToken = query.match(new RegExp(`\\b(?:to|in)\\s+(${unitPattern})\\b`, "i"))?.[1]?.toLowerCase();
  const targetUnit = targetToken ? unitAliases[targetToken] : null;
  const feet = query.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|foot)\b/i);
  const inches = query.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/i);
  if (feet && targetUnit?.kind === "length") {
    const totalInches = Number(feet[1]) * 12 + Number(inches?.[1] ?? 0);
    return { amount: String(Number(totalInches.toFixed(2))), fromUnit: "in", toUnit: targetUnit.label, kind: "Length" };
  }
  const sourceMatch = query.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\b`, "i"));
  const sourceUnit = sourceMatch ? unitAliases[sourceMatch[2].toLowerCase()] : null;
  return {
    amount: sourceMatch?.[1] ?? "",
    fromUnit: sourceUnit?.label ?? "",
    toUnit: targetUnit?.label ?? "",
    kind: sourceUnit ? titleCase(sourceUnit.kind) : "Conversion",
  };
}

export function convertUnitValue(value: number, fromLabel: string, toLabel: string) {
  const units = Object.values(unitAliases);
  const from = units.find((unit) => unit.label === fromLabel);
  const to = units.find((unit) => unit.label === toLabel);
  if (!from || !to || from.kind !== to.kind) return null;
  return value * from.toBase / to.toBase;
}

const currencies = {
  usd: { code: "USD", symbol: "$", perUsd: 1, aliases: /\b(?:usd|dollars?|bucks?)\b/i },
  eur: { code: "EUR", symbol: "€", perUsd: 0.9205, aliases: /\b(?:eur|euros?)\b/i },
  gbp: { code: "GBP", symbol: "£", perUsd: 0.79, aliases: /\b(?:gbp|pounds?|sterling)\b/i },
  jpy: { code: "JPY", symbol: "¥", perUsd: 150, aliases: /\b(?:jpy|yen)\b/i },
  cad: { code: "CAD", symbol: "CA$", perUsd: 1.36, aliases: /\b(?:cad|canadian dollars?)\b/i },
};

export function currencySymbol(code: string) {
  return Object.values(currencies).find((currency) => currency.code === code)?.symbol ?? "";
}

export function convertCurrency(amount: number, fromCode: string, toCode: string) {
  const list = Object.values(currencies);
  const from = list.find((currency) => currency.code === fromCode);
  const to = list.find((currency) => currency.code === toCode);
  if (!from || !to) return null;
  return amount / from.perUsd * to.perUsd;
}

export function parseCurrencyConversion(query: string) {
  const amountMatch = query.match(/\d+(?:\.\d+)?/);
  const amount = amountMatch ? Number(amountMatch[0]) : null;
  const separator = query.search(/\b(?:to|in)\b/i);
  const before = separator >= 0 ? query.slice(0, separator) : query;
  const after = separator >= 0 ? query.slice(separator) : "";
  const list = Object.values(currencies);
  const detect = (text: string) => {
    const named = list.find((currency) => currency.aliases.test(text));
    if (named) return named.code;
    if (text.includes("€")) return "EUR";
    if (text.includes("£")) return "GBP";
    if (text.includes("¥")) return "JPY";
    if (text.includes("$")) return "USD";
    return "";
  };
  return { amount, sourceCode: detect(before), targetCode: detect(after) };
}
