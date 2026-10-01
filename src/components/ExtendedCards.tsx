import { useRef, useState } from "react";
import {
  AlarmClock,
  Calculator,
  CalendarDays,
  Camera,
  Check,
  CircleDot,
  Dumbbell,
  FileText,
  Flashlight,
  Globe2,
  ListChecks,
  MapPin,
  Navigation,
  NotebookPen,
  Palette,
  Target,
  Trophy,
  UserPlus,
  Utensils,
  Workflow,
} from "lucide-react";
import type { Intent } from "../intent";
import { useQueryState } from "../useQueryState";
import { confidentValue, type ExtractedFields, useExtractedDraft } from "../useExtractedDraft";
import {
  parseAutomation,
  parseCalorieFood,
  parseColorLabel,
  parseEvent,
  parseFileQuery,
  parseFoodOrder,
  parseNewContactQuery,
  parseParkingLocation,
  parseReservation,
  parseSports,
  titleCase,
} from "../queryEntities";

type Props = {
  intent: Intent;
  query: string;
  notify: (message: string) => void;
  extractedFields?: ExtractedFields | null;
};

const CITY_TIMEZONES: Record<string, string> = {
  tokyo: "Asia/Tokyo",
  london: "Europe/London",
  paris: "Europe/Paris",
  sydney: "Australia/Sydney",
  dubai: "Asia/Dubai",
  chicago: "America/Chicago",
  "new york": "America/New_York",
  "los angeles": "America/Los_Angeles",
  "san francisco": "America/Los_Angeles",
  seattle: "America/Los_Angeles",
  boston: "America/New_York",
  miami: "America/New_York",
  denver: "America/Denver",
  phoenix: "America/Phoenix",
  austin: "America/Chicago",
  houston: "America/Chicago",
  toronto: "America/Toronto",
  "mexico city": "America/Mexico_City",
  "sao paulo": "America/Sao_Paulo",
  honolulu: "Pacific/Honolulu",
  auckland: "Pacific/Auckland",
  berlin: "Europe/Berlin",
  madrid: "Europe/Madrid",
  rome: "Europe/Rome",
  amsterdam: "Europe/Amsterdam",
  zurich: "Europe/Zurich",
  dublin: "Europe/Dublin",
  moscow: "Europe/Moscow",
  istanbul: "Europe/Istanbul",
  cairo: "Africa/Cairo",
  mumbai: "Asia/Kolkata",
  delhi: "Asia/Kolkata",
  singapore: "Asia/Singapore",
  "hong kong": "Asia/Hong_Kong",
  shanghai: "Asia/Shanghai",
  beijing: "Asia/Shanghai",
  seoul: "Asia/Seoul",
  bangkok: "Asia/Bangkok",
};

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const MONTH_PATTERN =
  "january|february|march|april|may|june|july|august|september|october|november|december";
const WEEKDAY_PATTERN =
  "monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight";
const TIME_PATTERN = /\b(?:at|for)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i;
const TYPE_PATTERN = /\b(pdf|docx?|spreadsheet|image|photo|video|presentation|file)\b/i;

function zoneOffsetMinutes(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(new Date());
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

function friendlyZone(timeZone: string) {
  const segment = timeZone.split("/").pop() ?? timeZone;
  return titleCase(segment.replace(/_/g, " "));
}

function upcomingIso(monthIndex: number, day: number, now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const candidate = new Date(now.getFullYear(), monthIndex, day);
  const year = candidate < today ? now.getFullYear() + 1 : now.getFullYear();
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function countdownTarget(query: string, now: Date): { iso: string; label: string } | null {
  if (/new year/i.test(query)) return { iso: `${now.getFullYear() + 1}-01-01`, label: "New Year" };
  if (/christmas|xmas/i.test(query)) return { iso: upcomingIso(11, 25, now), label: "Christmas" };
  const text = query.replace(/^.*?days?\s+(?:until|till|to)\s+/i, "").trim();
  const monthFirst = text.match(new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})\\b`, "i"));
  const dayFirst = text.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\b`, "i"));
  const numeric = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (monthFirst) {
    const monthIndex = MONTH_INDEX[monthFirst[1].toLowerCase()];
    return {
      iso: upcomingIso(monthIndex, Number(monthFirst[2]), now),
      label: titleCase(`${monthFirst[1]} ${monthFirst[2]}`),
    };
  }
  if (dayFirst) {
    const monthIndex = MONTH_INDEX[dayFirst[2].toLowerCase()];
    return {
      iso: upcomingIso(monthIndex, Number(dayFirst[1]), now),
      label: titleCase(`${dayFirst[2]} ${dayFirst[1]}`),
    };
  }
  if (numeric) {
    const monthIndex = Math.min(11, Math.max(0, Number(numeric[1]) - 1));
    const day = Math.min(31, Math.max(1, Number(numeric[2])));
    return {
      iso: upcomingIso(monthIndex, day, now),
      label: titleCase(
        new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(
          new Date(now.getFullYear(), monthIndex, day),
        ),
      ),
    };
  }
  return null;
}

export default function ExtendedCards({ intent, query, notify, extractedFields = null }: Props) {
  if (intent === "checklist") return <ChecklistCard query={query} notify={notify} />;
  if (intent === "calorie") return <CalorieCard query={query} notify={notify} />;
  if (intent === "alarm") return <AlarmCard query={query} notify={notify} />;
  if (intent === "device") return <DeviceCard query={query} notify={notify} />;
  if (intent === "timezone") return <TimezoneCard query={query} />;
  if (intent === "date-countdown") return <DateCountdownCard query={query} />;
  if (intent === "coin") return <CoinCard query={query} />;
  if (intent === "directions") return <DirectionsCard query={query} />;
  if (intent === "food-order") return <FoodOrderCard query={query} fields={extractedFields} />;
  if (intent === "note") return <NoteCard query={query} notify={notify} fields={extractedFields} />;
  if (intent === "event") return <EventCard query={query} notify={notify} fields={extractedFields} />;
  if (intent === "habit") return <HabitCard query={query} notify={notify} />;
  if (intent === "goal") return <GoalCard query={query} notify={notify} />;
  if (intent === "suggested-steps") return <SuggestedStepsCard query={query} notify={notify} />;
  if (intent === "new-contact") return <NewContactCard query={query} notify={notify} fields={extractedFields} />;
  if (intent === "reservation") return <ReservationCard query={query} notify={notify} fields={extractedFields} />;
  if (intent === "sports") return <SportsCard query={query} />;
  if (intent === "color") return <ColorCard query={query} notify={notify} />;
  if (intent === "calculate") return <CalculateCard query={query} notify={notify} />;
  if (intent === "automation") return <AutomationCard query={query} notify={notify} />;
  if (intent === "parking") return <ParkingCard query={query} notify={notify} fields={extractedFields} />;
  if (intent === "find-file") return <FindFileCard query={query} notify={notify} fields={extractedFields} />;
  return null;
}

function ChecklistCard({ query, notify }: Pick<Props, "query" | "notify">) {
  const inferred = query
    .replace(/^(?:buy|get|pick up|shopping list)\s*/i, "")
    .split(/,|\band\b/i)
    .map((item) => item.trim())
    .filter(Boolean);
  const [items, setItems] = useState<string[]>(inferred);
  const [checked, setChecked] = useState<boolean[]>(() => inferred.map(() => false));
  const [draft, setDraft] = useQueryState(query, "");
  const [saved, setSaved] = useQueryState(query, false);
  const addItem = () => {
    const value = draft.trim();
    if (!value) return;
    setItems((values) => [...values, value]);
    setChecked((values) => [...values, false]);
    setDraft("");
    setSaved(false);
  };
  return (
    <article className="card feature-card">
      <div className="label"><ListChecks size={18} /> Checklist<span>{items.length} items</span></div>
      <div className="checklist-list">
        {items.map((item, index) => (
          <div key={index} className={checked[index] ? "check-row checked" : "check-row"}>
            <button aria-label={`Toggle ${item}`} onClick={() => setChecked((values) => values.map((value, i) => i === index ? !value : value))}>
              <span>{checked[index] ? <Check size={15} /> : null}</span>
            </button>
            <input aria-label="Checklist item" value={item} onChange={(event) => { setItems((values) => values.map((value, i) => i === index ? event.target.value : value)); setSaved(false); }} />
          </div>
        ))}
      </div>
      <div className="checklist-add">
        <input aria-label="New checklist item" placeholder="Add an item" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addItem(); }} />
        <button className="secondary" onClick={addItem}>Add</button>
      </div>
      <div className="compact-actions"><button className="primary" disabled={items.length === 0} onClick={() => { setSaved(true); notify("Checklist saved locally."); }}>{saved ? "Added" : "Add list"}</button></div>
    </article>
  );
}

function CalorieCard({ query, notify }: Pick<Props, "query" | "notify">) {
  const parsedFood = parseCalorieFood(query);
  const [food, setFood] = useQueryState(query, parsedFood === "Food" ? "" : parsedFood);
  const [portion, setPortion] = useState<"regular" | "large">("regular");
  const [calories, setCalories] = useQueryState(query, "");
  return (
    <article className="card feature-card calorie-card">
      <div className="label"><Utensils size={18} /> Calorie estimate<span>enter values</span></div>
      <div className="answer-row">
        <div>
          <strong className="answer-value">{calories ? `≈ ${calories} cal` : "— cal"}</strong>
          <p>{food || "Add a food"} · {portion} portion</p>
        </div>
        <button className="primary" onClick={() => { setPortion((value) => value === "regular" ? "large" : "regular"); notify("Portion label updated."); }}>Portion</button>
      </div>
      <div className="calorie-fields">
        <input aria-label="Food" placeholder="Food" value={food} onChange={(event) => setFood(event.target.value)} />
        <input aria-label="Calories" type="number" min="0" placeholder="Calories" value={calories} onChange={(event) => setCalories(event.target.value)} />
      </div>
    </article>
  );
}

function AlarmCard({ query, notify }: Pick<Props, "query" | "notify">) {
  const match = query.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  const initial = match
    ? `${String((Number(match[1]) % 12) + (match[3]?.toLowerCase() === "pm" ? 12 : 0)).padStart(2, "0")}:${match[2] ?? "00"}`
    : "";
  const day = query.match(new RegExp(`\\b(${WEEKDAY_PATTERN})\\b`, "i"))?.[1];
  const [time, setTime] = useQueryState(query, initial);
  const [set, setSet] = useQueryState(query, false);
  return (
    <article className="card feature-card">
      <div className="label"><AlarmClock size={18} /> Alarm<span>{set ? "set" : "new"}</span></div>
      <div className="alarm-row">
        <input aria-label="Alarm time" type="time" value={time} onChange={(event) => { setTime(event.target.value); setSet(false); }} />
        {day && <span className="date-pill">{titleCase(day)}</span>}
        <button className="primary" disabled={!time} onClick={() => { setSet(true); notify(`Alarm set for ${time}.`); }}>{set ? "Set ✓" : "Set"}</button>
      </div>
    </article>
  );
}

function DeviceCard({ query, notify }: Pick<Props, "query" | "notify">) {
  const derived = /hotspot/i.test(query)
    ? "Hotspot"
    : /bluetooth/i.test(query)
      ? "Bluetooth"
      : /wi-?fi/i.test(query)
        ? "Wi-Fi"
        : /flashlight|torch/i.test(query)
          ? "Flashlight"
          : "";
  const [name, setName] = useQueryState(query, derived);
  const [enabled, setEnabled] = useQueryState(query, false);
  return (
    <article className={`card feature-card device-card ${enabled ? "enabled" : ""}`}>
      <div className="label"><Flashlight size={18} /> Device control<span>quick setting</span></div>
      <div className="device-row">
        <div className="device-hero"><Flashlight size={31} /></div>
        <div>
          <input className="device-name-input" aria-label="Device name" placeholder="Device" value={name} onChange={(event) => setName(event.target.value)} />
          <p>{enabled ? "On" : "Off"}</p>
        </div>
        <button className="primary" disabled={!name.trim()} onClick={() => { setEnabled((value) => !value); notify(`${name} ${enabled ? "turned off" : "turned on"} in this preview.`); }}>{enabled ? "Turn off" : "Turn on"}</button>
      </div>
    </article>
  );
}

function TimezoneCard({ query }: Pick<Props, "query">) {
  const matched = query.match(/time in\s+(.+)/i)?.[1]?.trim() ?? "";
  const [destination, setDestination] = useQueryState(query, matched);
  const zone = CITY_TIMEZONES[destination.trim().toLowerCase()] ?? "";
  const homeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const format = (timeZone: string) => new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date());
  const diffMinutes = zone ? zoneOffsetMinutes(zone) - zoneOffsetMinutes(homeZone) : null;
  const diffLabel = diffMinutes == null
    ? ""
    : `${diffMinutes < 0 ? "−" : "+"}${Math.floor(Math.abs(diffMinutes) / 60)}${Math.abs(diffMinutes) % 60 ? `:${String(Math.abs(diffMinutes) % 60).padStart(2, "0")}` : ""} h`;
  return (
    <article className="card feature-card">
      <div className="label"><Globe2 size={18} /> Time zone<span>comparison</span></div>
      <input className="entity-input" aria-label="Destination city" placeholder="Enter a city" value={destination} onChange={(event) => setDestination(event.target.value)} />
      {zone ? (
        <div className="timezone-row">
          <div><small>{friendlyZone(homeZone)}</small><strong>{format(homeZone)}</strong></div>
          <div className="timezone-bridge"><span>{diffLabel}</span><i /></div>
          <div className="align-right"><small>{titleCase(destination)}</small><strong>{format(zone)}</strong></div>
        </div>
      ) : (
        <p className="timezone-empty">Type a city to compare its local time with {friendlyZone(homeZone)}.</p>
      )}
    </article>
  );
}

function DateCountdownCard({ query }: Pick<Props, "query">) {
  const now = new Date();
  const parsed = countdownTarget(query, now);
  const fallbackLabel = titleCase(query.replace(/^.*?days?\s+(?:until|till|to)\s+/i, "").trim());
  const [label, setLabel] = useQueryState(query, parsed?.label ?? fallbackLabel);
  const [date, setDate] = useQueryState(query, parsed?.iso ?? "");
  const target = date ? new Date(`${date}T00:00:00`) : null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = target ? Math.ceil((target.getTime() - today.getTime()) / 86_400_000) : null;
  const targetShort = target ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(target) : "set date";
  const targetLong = target ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(target) : "";
  return (
    <article className="card feature-card">
      <div className="label"><CalendarDays size={18} /> Countdown<span>{targetShort}</span></div>
      {days != null && target && (
        <div className="countdown-row">
          <strong>{days}</strong>
          <div><h2>days to {label || "your date"}</h2><p>{targetLong}</p></div>
        </div>
      )}
      <div className="countdown-fields">
        <input className="entity-input" aria-label="Countdown label" placeholder="Occasion" value={label} onChange={(event) => setLabel(event.target.value)} />
        <input className="entity-input" aria-label="Countdown date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
    </article>
  );
}

function CoinCard({ query }: Pick<Props, "query">) {
  const [side, setSide] = useQueryState<"Heads" | "Tails" | null>(query, null);
  const [flipping, setFlipping] = useQueryState(query, false);
  const flip = () => {
    if (flipping) return;
    setFlipping(true);
    window.setTimeout(() => { setSide(Math.random() > 0.5 ? "Heads" : "Tails"); setFlipping(false); }, 720);
  };
  return (
    <article className="card feature-card">
      <div className="label"><CircleDot size={18} /> Quick choice<span>random</span></div>
      <div className="coin-row"><button aria-label="Flip coin" className={`real-coin ${side?.toLowerCase() ?? "unflipped"} ${flipping ? "flipping" : ""}`} onClick={flip}>{side === "Heads" ? "H" : side === "Tails" ? "T" : "?"}</button><div><h2>{flipping ? "Flipping…" : side ?? "Ready to flip"}</h2><p>Tap the coin or button to flip</p></div><button className="primary" onClick={flip}>Flip</button></div>
    </article>
  );
}

function DirectionsCard({ query }: Pick<Props, "query">) {
  const parsed = query.replace(/^.*?(?:directions?|navigate|route)\s+(?:to|toward|for)\s+/i, "").trim();
  const [place, setPlace] = useQueryState(query, parsed);
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
  return (
    <article className="card feature-card">
      <div className="label"><Navigation size={18} /> Directions<span>route</span></div>
      <input className="entity-input" aria-label="Destination" placeholder="Enter a destination" value={place} onChange={(event) => setPlace(event.target.value)} />
      <div className="answer-row"><div><p>Open Maps for live distance and travel time</p></div><a className="primary maps-action" aria-disabled={!place} href={place ? href : undefined} target="_blank" rel="noreferrer" onClick={(event) => { if (!place) event.preventDefault(); }}><span className="maps-pin" /> Maps</a></div>
    </article>
  );
}

function FoodOrderCard({ query, fields }: Pick<Props, "query"> & { fields: ExtractedFields | null }) {
  const parsed = parseFoodOrder(query);
  const [item, setItem] = useExtractedDraft(query, confidentValue(fields, "item", parsed.item === "Food order" ? "" : parsed.item));
  const [restaurant, setRestaurant] = useExtractedDraft(query, confidentValue(fields, "restaurant", parsed.restaurant));
  return (
    <article className="card feature-card food-card">
      <div className="label"><Utensils size={18} /> Order food<span>nearby</span></div>
      <div className="device-row"><div className="food-hero">🍜</div><div className="adaptive-fields"><small>Order</small><input aria-label="Food item" placeholder="Food item" value={item} onChange={(event) => setItem(event.target.value)} /><input aria-label="Restaurant" placeholder="Any nearby restaurant" value={restaurant} onChange={(event) => setRestaurant(event.target.value)} /></div><a className="food-action" href={`https://www.doordash.com/search/store/${encodeURIComponent(restaurant || item)}/`} target="_blank" rel="noreferrer">DoorDash</a></div>
    </article>
  );
}

function NoteCard({ query, notify, fields }: Pick<Props, "query" | "notify"> & { fields: ExtractedFields | null }) {
  const initial = query.replace(/^note:?\s*/i, "").trim();
  const [title, setTitle] = useExtractedDraft(query, confidentValue(fields, "title", initial));
  const [body, setBody] = useExtractedDraft(query, confidentValue(fields, "body", ""));
  const [saved, setSaved] = useQueryState(query, false);
  return (
    <article className="card feature-card">
      <div className="label"><NotebookPen size={18} /> New note<span>Obsidian</span></div>
      <input className="note-heading-input" aria-label="Note title" placeholder="Note title" value={title} onChange={(event) => { setTitle(event.target.value); setSaved(false); }} />
      <textarea className="note-body-input" aria-label="Note body" placeholder="Write your note" value={body} onChange={(event) => { setBody(event.target.value); setSaved(false); }} />
      <button className="primary" disabled={!title.trim() && !body.trim()} onClick={() => { setSaved(true); notify("Note saved locally."); }}>{saved ? "Saved ✓" : "Save note"}</button>
    </article>
  );
}

function EventCard({ query, notify, fields }: Pick<Props, "query" | "notify"> & { fields: ExtractedFields | null }) {
  const parsed = parseEvent(query);
  const hasDay = new RegExp(`\\b(?:${WEEKDAY_PATTERN})\\b`, "i").test(query);
  const hasTime = TIME_PATTERN.test(query);
  const [title, setTitle] = useExtractedDraft(query, confidentValue(fields, "title", parsed.title === "New event" ? "" : parsed.title));
  const [person, setPerson] = useExtractedDraft(query, confidentValue(fields, "person", parsed.person));
  const [day, setDay] = useExtractedDraft(query, confidentValue(fields, "day", hasDay ? parsed.day : ""));
  const [time, setTime] = useExtractedDraft(query, confidentValue(fields, "time", hasTime ? parsed.time : ""));
  return (
    <article className="card feature-card">
      <div className="label"><CalendarDays size={18} /> Event<span>calendar</span></div>
      <input className="event-title-input" aria-label="Event title" placeholder="Event title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <div className="event-fields"><label><b>With</b><input aria-label="Event person" placeholder="Name" value={person} onChange={(event) => setPerson(event.target.value)} /></label><label><b>Day</b><input aria-label="Event day" placeholder="Day" value={day} onChange={(event) => setDay(event.target.value)} /></label><label><b>Time</b><input aria-label="Event time" placeholder="Time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div>
      <button className="primary" disabled={!title.trim()} onClick={() => notify(`${title}${person ? ` with ${person}` : ""}${day ? ` on ${day}` : ""}${time ? ` at ${time}` : ""} is ready to add to calendar.`)}>Add to calendar</button>
    </article>
  );
}

function HabitCard({ query, notify }: Pick<Props, "query" | "notify">) {
  const rawTitle = query
    .replace(/\b(?:three|\d+)\s+times?\s+(?:a|per)\s+week\b/i, "")
    .replace(/\b(?:daily|every day)\b/i, "")
    .trim();
  const [title, setTitle] = useQueryState(query, rawTitle);
  const requested = query.match(/\b(\d+|one|two|three|four|five|six|seven)\s+times?\s+(?:a|per)\s+week\b/i)?.[1]?.toLowerCase();
  const frequencyTarget = requested ? ({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 }[requested] ?? Number(requested)) : /\bdaily|every day\b/i.test(query) ? 7 : 0;
  // A weekly frequency does not tell us which days the user prefers.
  const [days, setDays] = useState<boolean[]>(() => Array(7).fill(false));
  const [saved, setSaved] = useQueryState(query, false);
  const selected = days.filter(Boolean).length;
  return (
    <article className="card feature-card shapeshift-card">
      <div className="label"><Dumbbell size={18} /> Habit<span>new</span></div>
      <input className="habit-title-input" aria-label="Habit title" placeholder="Habit" value={title} onChange={(event) => { setTitle(event.target.value); setSaved(false); }} />
      <div className="habit-row"><div className="habit-days">{"MTWTFSS".split("").map((label, index) => <button key={index} className={days[index] ? "active" : ""} onClick={() => { setDays((values) => values.map((value, i) => i === index ? !value : value)); setSaved(false); }}>{label}</button>)}</div><span className="frequency-pill">{selected ? `${selected}× selected` : frequencyTarget ? `${frequencyTarget}× per week · choose days` : "Add how often"}</span></div>
      <div className="footer-action"><small>Esc&nbsp; to cancel</small><button className="primary" disabled={!title.trim()} onClick={() => { setSaved(true); notify("Habit saved locally."); }}>{saved ? "Saved ✓" : "Save habit ↵"}</button></div>
    </article>
  );
}

function GoalCard({ query, notify }: Pick<Props, "query" | "notify">) {
  const match = query.match(/\d+/);
  const period = /per\s+year|this year|annual/i.test(query) ? "annual" : /per\s+month|this month/i.test(query) ? "monthly" : /per\s+week|this week/i.test(query) ? "weekly" : "goal";
  const rawTitle = query.replace(/\b(?:this|per)\s+(?:year|month|week)\b.*$/i, "").trim();
  const [title, setTitle] = useQueryState(query, rawTitle);
  const [target, setTarget] = useQueryState(query, match ? Math.max(1, Number(match[0])) : 0);
  const [progress, setProgress] = useQueryState(query, 0);
  const pct = target > 0 ? Math.round(Math.min(progress, target) / target * 100) : 0;
  return (
    <article className="card feature-card shapeshift-card">
      <div className="label"><Target size={18} /> Goal<span>{period}</span></div>
      <input className="goal-title-input" aria-label="Goal title" placeholder="Goal" value={title} onChange={(event) => setTitle(event.target.value)} />
      <div className="goal-header"><div><p>{progress} of {target || "—"} complete</p></div><strong>{pct}%</strong></div>
      <div className="goal-rail"><i style={{ width: `${pct}%` }} /></div>
      <div className="goal-fields"><label><b>Target</b><input className="entity-input" aria-label="Goal target" type="number" min="1" placeholder="0" value={target || ""} onChange={(event) => { const value = Math.max(0, Math.floor(Number(event.target.value) || 0)); setTarget(value); setProgress((current) => Math.min(current, value)); }} /></label></div>
      <div className="footer-action"><div className="goal-buttons"><button disabled={target === 0} onClick={() => setProgress((value) => Math.max(0, value - 1))}>−</button><button disabled={target === 0} onClick={() => setProgress((value) => Math.min(target, value + 1))}>＋</button></div><button className="primary" disabled={!title.trim() || target === 0} onClick={() => notify("Goal saved locally.")}>Save goal ↵</button></div>
    </article>
  );
}

function SuggestedStepsCard({ query, notify }: Pick<Props, "query" | "notify">) {
  const parsedSubject = query.replace(/^\s*(?:find|search for|look for)\s+(?:my\s+)?/i, "").trim();
  const [subject, setSubject] = useQueryState(query, parsedSubject);
  return (
    <article className="card feature-card thinking-card">
      <div className="thinking-heading"><span><i /><i /><i /></span> Thinking</div>
      <input className="entity-input" aria-label="Search subject" placeholder="What should I look for?" value={subject} onChange={(event) => setSubject(event.target.value)} />
      {subject ? <><p className="thought-step one">Search connected email for “{subject}”.</p><p className="thought-step two">Search connected messages for the same terms.</p><p className="thought-step three">Surface the best matching receipt or conversation.</p></> : <p className="thought-step one">Add a subject to plan a search across connected sources.</p>}
      <div className="thinking-summary"><small>Summary · Search 2 approved sources</small><button className="primary" disabled={!subject.trim()} onClick={() => notify("Private-source search requires explicit connection and approval.")}>Review search</button></div>
    </article>
  );
}

function NewContactCard({ query, notify, fields }: Pick<Props, "query" | "notify"> & { fields: ExtractedFields | null }) {
  const parsed = parseNewContactQuery(query);
  const [name, setName] = useExtractedDraft(query, confidentValue(fields, "name", parsed.name));
  const [phone, setPhone] = useExtractedDraft(query, confidentValue(fields, "phone", parsed.phone));
  const [added, setAdded] = useQueryState(query, false);
  return (
    <article className="card feature-card"><div className="label"><UserPlus size={18} /> New contact<span>contacts</span></div><div className="answer-row"><div className="contact-fields"><input aria-label="Contact name" placeholder="Name" value={name} onChange={(event) => { setName(event.target.value); setAdded(false); }} /><input aria-label="Contact phone" placeholder="Phone number" value={phone} onChange={(event) => { setPhone(event.target.value); setAdded(false); }} /></div><button className="primary" disabled={!name.trim() || !phone.trim()} onClick={() => { setAdded(true); notify(`${name} is ready for native contact confirmation.`); }}>{added ? "Added ✓" : "Add"}</button></div></article>
  );
}

function ReservationCard({ query, notify, fields }: Pick<Props, "query" | "notify"> & { fields: ExtractedFields | null }) {
  const parsed = parseReservation(query);
  const hasDay = new RegExp(`\\b(?:${WEEKDAY_PATTERN})\\b`, "i").test(query);
  const hasTime = TIME_PATTERN.test(query);
  const party = query.match(/\b(?:party\s+of|table\s+for|for)\s+(\d+)\s*(?:people|persons?|guests?)\b/i)?.[1];
  const [restaurant, setRestaurant] = useExtractedDraft(query, confidentValue(fields, "restaurant", parsed.restaurant === "Choose restaurant" ? "" : parsed.restaurant));
  const [day, setDay] = useExtractedDraft(query, confidentValue(fields, "day", hasDay ? parsed.day : ""));
  const [time, setTime] = useExtractedDraft(query, confidentValue(fields, "time", hasTime ? parsed.time : ""));
  const [people, setPeople] = useExtractedDraft(query, Number(confidentValue(fields, "people", party ? String(Math.max(1, Number(party))) : "0")) || 0);
  const ready = Boolean(restaurant.trim() && day.trim() && time.trim() && people > 0);
  return (
    <article className="card feature-card reservation-card"><div className="label"><Utensils size={18} /> Reservation<span>{day}</span></div><div className="reservation-fields"><input aria-label="Restaurant name" placeholder="Restaurant" value={restaurant} onChange={(event) => setRestaurant(event.target.value)} /><input aria-label="Reservation day" placeholder="Day" value={day} onChange={(event) => setDay(event.target.value)} /><input aria-label="Reservation time" placeholder="Time" value={time} onChange={(event) => setTime(event.target.value)} /></div><div className="reservation-actions"><div className="mini-stepper"><button aria-label="Fewer people" onClick={() => setPeople((value) => Math.max(0, value - 1))}>−</button><span>{people}</span><button aria-label="More people" onClick={() => setPeople((value) => value + 1)}>＋</button></div><span>{people === 0 ? "Add party size" : `${people} ${people === 1 ? "person" : "people"}`}</span><button className="primary" disabled={!ready} onClick={() => notify(`${restaurant} is ready to reserve for ${people} on ${day} at ${time}.`)}>Reserve</button></div></article>
  );
}

function SportsCard({ query }: Pick<Props, "query">) {
  const parsed = parseSports(query);
  const [home, setHome] = useQueryState(query, parsed.left === "Home" ? "" : parsed.left);
  const [away, setAway] = useQueryState(query, parsed.right === "Away" ? "" : parsed.right);
  return <article className="card feature-card"><div className="label"><Trophy size={18} /> Sports matchup<span>matchup</span></div><div className="score-row"><input className="score-input" aria-label="Home team" placeholder="Home" value={home} onChange={(event) => setHome(event.target.value)} /><b>vs</b><input className="score-input" aria-label="Away team" placeholder="Away" value={away} onChange={(event) => setAway(event.target.value)} /></div></article>;
}

function ColorCard({ query, notify }: Pick<Props, "query" | "notify">) {
  const parsedValue = query.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i)?.[0] ?? "";
  const parsedLabel = parseColorLabel(query);
  const [value, setValue] = useQueryState(query, parsedValue);
  const [label, setLabel] = useQueryState(query, parsedLabel === "Selected color" ? "" : parsedLabel);
  return <article className="card feature-card"><div className="label"><Palette size={18} /> Color<span>hex</span></div><div className="device-row"><span className="color-swatch" style={value ? { background: value } : undefined} /><div className="color-fields"><input aria-label="Color name" placeholder="Color name" value={label} onChange={(event) => setLabel(event.target.value)} /><input aria-label="Color hex" placeholder="#000000" value={value} onChange={(event) => setValue(event.target.value)} /></div><button className="primary" disabled={!value.trim()} onClick={() => { void navigator.clipboard?.writeText(value); notify(`${value} copied.`); }}>Copy</button></div></article>;
}

function CalculateCard({ query, notify }: Pick<Props, "query" | "notify">) {
  const [expression, setExpression] = useQueryState(query, query);
  const percent = expression.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/i);
  const result = percent ? Number(percent[1]) / 100 * Number(percent[2]) : null;
  const display = result == null ? "" : Number.isInteger(result) ? String(result) : result.toFixed(2);
  return <article className="card feature-card"><div className="label"><Calculator size={18} /> Calculate<span>result</span></div><input className="entity-input" aria-label="Calculation" placeholder="e.g. 15% of 80" value={expression} onChange={(event) => setExpression(event.target.value)} /><div className="answer-row"><div><strong className="answer-value">{display || "—"}</strong><p>{display && percent ? `${percent[1]}% of ${percent[2]}` : "Enter a percentage calculation"}</p></div><button className="primary" disabled={!display} onClick={() => { void navigator.clipboard?.writeText(display); notify("Result copied."); }}>Copy</button></div></article>;
}

function AutomationCard({ query, notify }: Pick<Props, "query" | "notify">) {
  const parsed = parseAutomation(query);
  const [condition, setCondition] = useQueryState(query, parsed.condition === "When condition is met" ? "" : parsed.condition);
  const [action, setAction] = useQueryState(query, parsed.action === "Set device state" ? "" : parsed.action);
  return <article className="card feature-card"><div className="label"><Workflow size={18} /> Automation<span>draft</span></div><div className="automation-flow"><input aria-label="Automation condition" placeholder="Condition" value={condition} onChange={(event) => setCondition(event.target.value)} /><b>→</b><input aria-label="Automation action" placeholder="Action" value={action} onChange={(event) => setAction(event.target.value)} /></div><button className="primary" disabled={!condition.trim() || !action.trim()} onClick={() => notify(`${condition} → ${action} is ready for permission review.`)}>Review setup</button></article>;
}

function ParkingCard({ query, notify, fields }: Pick<Props, "query" | "notify"> & { fields: ExtractedFields | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const parsedLocation = parseParkingLocation(query);
  const [location, setLocation] = useExtractedDraft(query, confidentValue(fields, "location", parsedLocation === "Add level, row, or landmark" ? "" : parsedLocation));
  const [photo, setPhoto] = useQueryState(query, "");
  return (
    <article className="card feature-card parking-feature">
      <div className="label"><MapPin size={18} /> Save parking<span>manual</span></div>
      <div className="parking-strip"><span><b>P</b></span></div>
      <input className="parking-location" aria-label="Parking location" placeholder="Level, row, or landmark" value={location} onChange={(event) => setLocation(event.target.value)} />
      <input ref={inputRef} hidden type="file" accept="image/*" capture="environment" onChange={(event) => { const name = event.target.files?.[0]?.name; if (name) { setPhoto(name); notify("Parking photo attached."); } }} />
      <button className={photo ? "parking-camera captured" : "parking-camera"} onClick={() => inputRef.current?.click()}><Camera size={28} /><small>{photo ? "Captured" : "Camera"}</small></button>
    </article>
  );
}

function FindFileCard({ query, notify, fields }: Pick<Props, "query" | "notify"> & { fields: ExtractedFields | null }) {
  const parsed = parseFileQuery(query);
  const [label, setLabel] = useExtractedDraft(query, confidentValue(fields, "subject", parsed.label.startsWith("Matching file") ? "" : parsed.label.replace(/\.pdf$/i, "")));
  const recency = parsed.recency === "Best local match" ? "" : parsed.recency;
  const hasType = TYPE_PATTERN.test(query);
  return (
    <article className="card feature-card file-feature"><div className="label"><FileText size={18} /> Find file<span>search request</span></div><div className="file-row"><span className="pdf-file">{hasType ? parsed.type : "FILE"}</span><div><input className="entity-input" aria-label="File search terms" placeholder="File name or search terms" value={label} onChange={(event) => setLabel(event.target.value)} />{recency && <p>{recency}</p>}{hasType && <div className="file-tags"><span>Filter: {parsed.type}</span></div>}</div><button className="primary" disabled={!label.trim()} onClick={() => notify("File search needs native file access and your approval.")}>Search files</button></div></article>
  );
}
