import { useState, useEffect, useMemo } from "react";
import {
  Sun,
  CloudSun,
  Droplets,
  Bell,
  Clock,
  Check,
  Play,
  Pause,
  RotateCcw,
  MessageCircle,
  Phone,
  Music2,
  ArrowUpRight,
  Plus,
  Minus,
  Users,
  Search,
  Bookmark,
  CheckCircle2,
  Ruler,
  ArrowLeftRight,
  Banknote,
  TimerReset,
  ListChecks,
  X,
} from "lucide-react";
import type { Intent } from "../intent";
import { useQueryState } from "../useQueryState";
import { confidentValue, type ExtractedFields, useExtractedDraft } from "../useExtractedDraft";
import ExtendedCards from "./ExtendedCards";
import {
  convertCurrency,
  convertUnitValue,
  currencySymbol,
  parseChecklist,
  parseContactQuery,
  parseCurrencyConversion,
  parseDurationMinutes,
  parseReminder,
  parseSplit,
  parseUnitConversion,
} from "../queryEntities";

type ChecklistItem = { id: string; text: string; done: boolean };
type Props = {
  intent: Intent;
  query: string;
  notify: (message: string) => void;
  extractedFields?: ExtractedFields | null;
};
export default function Cards({ intent, query, notify, extractedFields = null }: Props) {
  if (intent === "weather")
    return <Weather query={query} />;
  if (intent === "timer") return /focus/i.test(query) ? <Timer query={query} fields={extractedFields} /> : <QuickTimer query={query} fields={extractedFields} />;
  if (intent === "split") return <Split query={query} />;
  if (intent === "save-link") return <SaveLink query={query} notify={notify} />;
  if (intent === "unit") return <UnitConverter query={query} fields={extractedFields} />;
  if (intent === "currency") return <CurrencyConverter query={query} fields={extractedFields} />;
  if (intent === "reminder") return <Reminder query={query} fields={extractedFields} />;
  if (intent === "contact") return <Contact query={query} notify={notify} fields={extractedFields} />;
  if (intent === "music") {
    const requestedTrack = query.match(/(?:play|song)\s+(.+)/i)?.[1]?.trim() ?? "";
    return <MusicSearch query={query} initialTrack={requestedTrack} />;
  }
  if (intent === "checklist") return <Checklist query={query} notify={notify} fields={extractedFields} />;
  if (intent !== "unknown") return <ExtendedCards intent={intent} query={query} notify={notify} extractedFields={extractedFields} />;
  return (
    <article className="card empty">
      <Search size={24} />
      <h2>
        {query
          ? "What would you like to do?"
          : "Natural Language Intent classification using Jev"}
      </h2>
      <p>Try “focus for 25 minutes” or “text Maya”.</p>
    </article>
  );
}
function MusicSearch({ query, initialTrack }: { query: string; initialTrack: string }) {
  const [track, setTrack] = useQueryState(query, initialTrack);
  const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(track || query)}`;
  return (
    <article className="card">
      <div className="label"><Music2 size={18} /> Music<span>Spotify</span></div>
      <div className="music">
        <div className="album"><Music2 size={25} /></div>
        <div className="music-query">
          <input aria-label="Track or artist" placeholder="Track or artist" value={track} onChange={(event) => setTrack(event.target.value)} />
          <p>{track ? "Spotify search" : "No track specified"}</p>
          <small>Search Spotify for a track or artist</small>
        </div>
        <a className="round" aria-label="Open music search in Spotify" href={spotifyUrl} target="_blank" rel="noreferrer"><Play size={20} fill="currentColor" /></a>
      </div>
      <a className="text-link" href={spotifyUrl} target="_blank" rel="noreferrer">Open in Spotify<ArrowUpRight size={15} /></a>
    </article>
  );
}
function Weather({ query }: { query: string }) {
  const initialCity = query.match(/(?:in|for)\s+(.+)/i)?.[1]?.trim() ?? "";
  const [city, setCity] = useQueryState(query, initialCity);
  return (
    <article className="card compact-weather">
      <div className="label"><CloudSun size={18} /> Weather<span>live data needed</span></div>
      <div className="compact-weather-main">
        <Sun className="sun" size={43} />
        <div className="compact-weather-copy">
          <input aria-label="Weather location" className="weather-city-input" placeholder="Enter a city" value={city} onChange={(event) => setCity(event.target.value)} />
          <p>Forecast unavailable in this preview</p>
          <small><Droplets size={12} /> Connect a weather source for current conditions</small>
        </div>
      </div>
    </article>
  );
}
function SaveLink({ query, notify }: { query: string; notify: Props["notify"] }) {
  const [saved, setSaved] = useQueryState(query, false);
  const looksLikeUrl = /https?:\/\/|www\./i.test(query);
  const url = query.match(/https?:\/\/\S+|www\.\S+/i)?.[0] ?? "";
  const host = url ? url.replace(/^https?:\/\//i, "").split("/")[0] : "Current page";
  return (
    <article className="card utility-card link-card">
      <div className="label"><Bookmark size={18} /> Save link<span>Reading list</span></div>
      <div className="utility-row">
        <div className="utility-icon link-icon"><ArrowUpRight size={24} /></div>
        <div className="utility-copy"><h2>{looksLikeUrl ? "Pasted link" : "Save current page"}</h2><p>{host}</p><span className="utility-tag">Read later</span></div>
      </div>
      <button className="primary" disabled={saved} onClick={() => { setSaved(true); notify("Saved locally to your reading list."); }}>
        {saved ? <><CheckCircle2 size={17} /> Saved</> : <><Bookmark size={17} /> Save for later</>}
      </button>
    </article>
  );
}
function canonicalUnit(value: string, target: boolean) {
  if (!value) return "";
  const parsed = target ? parseUnitConversion(`1 m to ${value}`) : parseUnitConversion(`1 ${value} to m`);
  return target ? parsed.toUnit : parsed.fromUnit;
}

function canonicalCurrency(value: string, target: boolean) {
  if (!value) return "";
  const parsed = target ? parseCurrencyConversion(`1 USD to ${value}`) : parseCurrencyConversion(`1 ${value} to USD`);
  return target ? parsed.targetCode : parsed.sourceCode;
}

function UnitConverter({ query, fields }: { query: string; fields: ExtractedFields | null }) {
  const parsed = parseUnitConversion(query);
  const [amount, setAmount] = useExtractedDraft(query, confidentValue(fields, "amount", parsed.amount));
  const [fromUnit, setFromUnit] = useExtractedDraft(query, canonicalUnit(confidentValue(fields, "fromUnit", parsed.fromUnit), false));
  const [toUnit, setToUnit] = useExtractedDraft(query, canonicalUnit(confidentValue(fields, "toUnit", parsed.toUnit), true));
  const [swapped, setSwapped] = useQueryState(query, false);
  const sourceUnit = swapped ? toUnit : fromUnit;
  const targetUnit = swapped ? fromUnit : toUnit;
  const converted = amount && sourceUnit && targetUnit ? convertUnitValue(Number(amount), sourceUnit, targetUnit) : null;
  const sourceDisplay = amount && sourceUnit ? `${amount} ${sourceUnit}` : "—";
  const targetDisplay = converted === null ? "—" : `${Number(converted.toFixed(2))} ${targetUnit}`;
  return (
    <article className="card utility-card">
      <div className="label"><Ruler size={18} /> Unit converter<span>{sourceUnit && targetUnit ? `${sourceUnit} → ${targetUnit}` : "Set units"}</span></div>
      <div className="utility-row"><div className="utility-icon units-icon"><Ruler size={23} /></div><div className="utility-copy"><div className="conversion-values"><strong>{sourceDisplay}</strong><ArrowLeftRight size={17} /><strong>{targetDisplay}</strong></div><p>{parsed.kind} · parsed from “{query}”</p></div></div>
      <div className="event-fields">
        <label><b>Value</b><input aria-label="Unit value" type="number" placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label><b>From</b><input aria-label="From unit" placeholder="ft" value={sourceUnit} onChange={(event) => swapped ? setToUnit(event.target.value) : setFromUnit(event.target.value)} /></label>
        <label><b>To</b><input aria-label="To unit" placeholder="cm" value={targetUnit} onChange={(event) => swapped ? setFromUnit(event.target.value) : setToUnit(event.target.value)} /></label>
      </div>
      <button className="secondary wide-button" onClick={() => setSwapped((value) => !value)}><ArrowLeftRight size={16} /> Swap direction</button>
    </article>
  );
}
function CurrencyConverter({ query, fields }: { query: string; fields: ExtractedFields | null }) {
  const parsed = parseCurrencyConversion(query);
  const [amount, setAmount] = useExtractedDraft(query, confidentValue(fields, "amount", parsed.amount === null ? "" : String(parsed.amount)));
  const [sourceCode, setSourceCode] = useExtractedDraft(query, canonicalCurrency(confidentValue(fields, "sourceCurrency", parsed.sourceCode), false));
  const [targetCode, setTargetCode] = useExtractedDraft(query, canonicalCurrency(confidentValue(fields, "targetCurrency", parsed.targetCode), true));
  const [swapped, setSwapped] = useQueryState(query, false);
  const fromCode = swapped ? targetCode : sourceCode;
  const toCode = swapped ? sourceCode : targetCode;
  const converted = amount && fromCode && toCode ? convertCurrency(Number(amount), fromCode, toCode) : null;
  const sourceDisplay = amount && fromCode ? `${currencySymbol(fromCode)}${Number(amount).toFixed(2)}` : "—";
  const targetDisplay = converted === null ? "—" : `${currencySymbol(toCode)}${converted.toFixed(toCode === "JPY" ? 0 : 2)}`;
  return (
    <article className="card utility-card">
      <div className="label"><Banknote size={18} /> Currency converter<span>{fromCode && toCode ? `${fromCode} → ${toCode}` : "Set currencies"}</span></div>
      <div className="utility-row"><div className="utility-icon currency-icon">{currencySymbol(toCode) || "$"}</div><div className="utility-copy"><div className="conversion-values"><strong>{sourceDisplay}</strong><ArrowLeftRight size={17} /><strong>{targetDisplay}</strong></div><p>Parsed from “{query}”</p></div></div>
      <div className="event-fields">
        <label><b>Amount</b><input aria-label="Currency amount" type="number" min="0" step="0.01" placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label><b>From</b><input aria-label="From currency" maxLength={3} placeholder="USD" value={fromCode} onChange={(event) => swapped ? setTargetCode(event.target.value.toUpperCase()) : setSourceCode(event.target.value.toUpperCase())} /></label>
        <label><b>To</b><input aria-label="To currency" maxLength={3} placeholder="EUR" value={toCode} onChange={(event) => swapped ? setSourceCode(event.target.value.toUpperCase()) : setTargetCode(event.target.value.toUpperCase())} /></label>
      </div>
      <button className="secondary wide-button" onClick={() => setSwapped((value) => !value)}><ArrowLeftRight size={16} /> Swap currencies</button>
    </article>
  );
}
function QuickTimer({ query, fields }: { query: string; fields: ExtractedFields | null }) {
  const parsed = parseDurationMinutes(query);
  const duration = confidentValue(fields, "duration", "");
  const extractedMinutes = duration ? parseDurationMinutes(duration) : null;
  const [minutes, setMinutes] = useExtractedDraft(query, parsed !== null ? String(parsed) : extractedMinutes === null ? "" : String(extractedMinutes));
  const totalSeconds = Math.max(0, Math.round((Number(minutes) || 0) * 60));
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useQueryState(query, false);
  useEffect(() => {
    setRunning(false);
    setRemaining(totalSeconds);
  }, [totalSeconds]);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  useEffect(() => { if (!remaining) setRunning(false); }, [remaining]);
  const display = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <article className="card utility-card timer-card">
      <div className="label"><TimerReset size={18} /> Timer<span>{running ? "In progress" : "Ready"}</span></div>
      <div className="quick-timer"><div className={`timer-orb ${running ? "running" : ""}`}><strong>{display}</strong></div><div><h2>{/pasta/i.test(query) ? "Pasta timer" : "Quick timer"}</h2><p>{totalSeconds ? "Notify when finished." : "Set a duration to begin."}</p></div></div>
      <div className="event-fields"><label><b>Minutes</b><input aria-label="Timer minutes" type="number" min="1" max="180" placeholder="0" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label></div>
      <div className="button-row"><button className="secondary" onClick={() => { setRunning(false); setRemaining(totalSeconds); }}><TimerReset size={17} /></button><button className="primary" disabled={!totalSeconds} onClick={() => { if (remaining === 0) setRemaining(totalSeconds); setRunning((value) => !value); }}>{running ? "Pause" : remaining === 0 ? "Restart" : "Start timer"}</button></div>
    </article>
  );
}
function Reminder({ query, fields }: { query: string; fields: ExtractedFields | null }) {
  const parsed = parseReminder(query);
  const [title, setTitle] = useExtractedDraft(query, confidentValue(fields, "title", parsed.title));
  const [time, setTime] = useQueryState(query, parsed.time);
  const [saved, setSaved] = useQueryState(query, false);
  return (
    <article className="card">
      <div className="label">
        <Bell size={18} />
        Reminder
      </div>
      <input
        className="title-input"
        aria-label="Reminder title"
        placeholder="What should I remind you about?"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setSaved(false);
        }}
      />
      <label className="time-chip">
        <Clock size={17} />
        Today at
        <input
          aria-label="Reminder time"
          type="time"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      <button
        className="primary"
        disabled={!title.trim() || saved}
        onClick={() => {
          localStorage.setItem(
            "horizon-reminder",
            JSON.stringify({ title, time }),
          );
          setSaved(true);
        }}
      >
        {saved ? (
          <>
            <Check size={17} />
            Saved to this preview
          </>
        ) : (
          "Save reminder"
        )}
      </button>
      {saved && (
        <p className="footnote">
          Saved locally. Phone notifications aren’t connected.
        </p>
      )}
    </article>
  );
}
function Contact({
  query,
  notify,
  fields,
}: {
  query: string;
  notify: Props["notify"];
  fields: ExtractedFields | null;
}) {
  const parsed = parseContactQuery(query);
  const [name, setName] = useExtractedDraft(query, confidentValue(fields, "name", parsed.name));
  const [message, setMessage] = useExtractedDraft(query, confidentValue(fields, "message", parsed.message));
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <article className="card">
      <div className="label">
        <MessageCircle size={18} />
        Contact<span>Draft</span>
      </div>
      <div className="contact">
        <div className="avatar">{initial}</div>
        <div className="contact-identity">
          <input aria-label="Contact name" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <p>{name.trim() ? "Draft message" : "No contact selected"}</p>
        </div>
        <button
          className="icon-button"
          aria-label={`Call ${name}`}
          onClick={() =>
            notify(
              `Call preview: ${name}. Connect phone contacts to place a call.`,
            )
          }
        >
          <Phone size={20} />
        </button>
      </div>
      <textarea
        aria-label={`Message to ${name}`}
        placeholder="Write a message…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button
        className="primary"
        disabled={!message.trim()}
        onClick={() =>
          notify(
            `Draft for ${name}: “${message}”. Sending is available in the native app.`,
          )
        }
      >
        <MessageCircle size={16} />
        Review message
      </button>
    </article>
  );
}
function Timer({ query, fields }: { query: string; fields: ExtractedFields | null }) {
  const parsed = parseDurationMinutes(query);
  const duration = confidentValue(fields, "duration", "");
  const extractedMinutes = duration ? parseDurationMinutes(duration) : null;
  const [minutes, setMinutes] = useExtractedDraft(query, parsed !== null ? String(parsed) : extractedMinutes === null ? "" : String(extractedMinutes));
  const totalSeconds = Math.max(0, Math.round((Number(minutes) || 0) * 60));
  const [remaining, setRemaining] = useState(totalSeconds);
  const [end, setEnd] = useQueryState<number | null>(query, null);
  useEffect(() => {
    setEnd(null);
    setRemaining(totalSeconds);
  }, [totalSeconds]);
  // Derive the remaining time from a deadline so background tab throttling does not accumulate drift.
  useEffect(() => {
    if (!end) return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(s);
      if (!s) setEnd(null);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => clearInterval(id);
  }, [end]);
  return (
    <article className="card">
      <div className="label">
        <Clock size={18} />
        Focus timer<span>{end ? "In progress" : "Make a little room"}</span>
      </div>
      <div className="timer-ring">
        <strong>
          {String(Math.floor(remaining / 60)).padStart(2, "0")}
          <span>:</span>
          {String(remaining % 60).padStart(2, "0")}
        </strong>
        <p>{totalSeconds ? (remaining ? "One thing at a time." : "You did it.") : "Set a duration to begin."}</p>
      </div>
      <div className="event-fields"><label><b>Minutes</b><input aria-label="Focus minutes" type="number" min="1" max="180" placeholder="0" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label></div>
      <div className="button-row">
        <button
          className="secondary"
          aria-label="Reset timer"
          onClick={() => {
            setEnd(null);
            setRemaining(totalSeconds);
          }}
        >
          <RotateCcw size={18} />
        </button>
        <button
          className="primary"
          disabled={!end && !totalSeconds}
          onClick={() =>
            end
              ? setEnd(null)
              : setEnd(Date.now() + (remaining || totalSeconds) * 1000)
          }
        >
          {end ? (
            <>
              <Pause size={17} />
              Pause
            </>
          ) : (
            <>
              <Play size={17} />
              Start focus
            </>
          )}
        </button>
      </div>
    </article>
  );
}
function Split({ query }: { query: string }) {
  const parsed = parseSplit(query);
  const [amount, setAmount] = useQueryState(query, parsed.amount);
  const [people, setPeople] = useQueryState(query, parsed.people ?? 1);
  return (
    <article className="card">
      <div className="label">
        <Users size={18} />
        Split a bill
      </div>
      <label className="amount">
        Bill total
        <div>
          $
          <input
            aria-label="Bill total"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </label>
      <div className="people">
        <span>Split between</span>
        <div>
          <button
            aria-label="Fewer people"
            disabled={people === 1}
            onClick={() => setPeople(people - 1)}
          >
            <Minus size={16} />
          </button>
          <strong>{people}</strong>
          <button
            aria-label="More people"
            disabled={people === 99}
            onClick={() => setPeople(people + 1)}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
      <div className="each">
        <span>Each person pays</span>
        <strong>
          ${(Math.max(0, Number(amount) || 0) / people).toFixed(2)}
        </strong>
      </div>
      <p className="footnote">Split equally · No tip included</p>
    </article>
  );
}
function Checklist({ query, notify, fields }: { query: string; notify: Props["notify"]; fields: ExtractedFields | null }) {
  const extractedItems = confidentValue(fields, "items", "");
  const initialItems = useMemo(() => {
    const texts = extractedItems ? parseChecklist(extractedItems) : parseChecklist(query);
    return texts.map((text, index) => ({ id: `${index}-${text}`, text, done: false }));
  }, [query, extractedItems]);
  const [items, setItems] = useExtractedDraft<ChecklistItem[]>(query, initialItems);
  const [draft, setDraft] = useQueryState(query, "");
  const [saved, setSaved] = useQueryState(query, false);
  const addItem = () => {
    const text = draft.trim();
    if (!text) return;
    setItems((values) => [...values, { id: `${Date.now()}-${values.length}`, text, done: false }]);
    setDraft("");
    setSaved(false);
  };
  const toggleItem = (id: string) => setItems((values) => values.map((item) => item.id === id ? { ...item, done: !item.done } : item));
  const updateItem = (id: string, text: string) => setItems((values) => values.map((item) => item.id === id ? { ...item, text } : item));
  const removeItem = (id: string) => { setItems((values) => values.filter((item) => item.id !== id)); setSaved(false); };
  return (
    <article className="card feature-card">
      <div className="label"><ListChecks size={18} /> Checklist<span>{items.length} {items.length === 1 ? "item" : "items"}</span></div>
      {items.length === 0 ? (
        <p className="footnote">No items yet. Add one below.</p>
      ) : (
        <div className="checklist-list">
          {items.map((item) => (
            <div key={item.id} className={item.done ? "check-row checked" : "check-row"}>
              <span
                role="checkbox"
                aria-checked={item.done}
                tabIndex={0}
                onClick={() => toggleItem(item.id)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleItem(item.id); } }}
              >
                {item.done ? <Check size={15} /> : null}
              </span>
              <input aria-label="Checklist item" value={item.text} onChange={(event) => { updateItem(item.id, event.target.value); setSaved(false); }} style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", color: "inherit", font: "inherit" }} />
              <button aria-label={`Remove ${item.text}`} onClick={() => removeItem(item.id)} style={{ border: 0, background: "transparent", color: "#a9c4df", padding: 0 }}><X size={15} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="compact-actions">
        <input className="title-input" aria-label="New checklist item" placeholder="Add an item" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addItem(); } }} style={{ flex: 1, width: "auto", padding: "10px 12px", fontSize: 13 }} />
        <button className="primary" disabled={!draft.trim()} onClick={addItem}>Add item</button>
      </div>
      <button className="secondary wide-button" disabled={items.length === 0} onClick={() => { localStorage.setItem("horizon-checklist", JSON.stringify(items)); setSaved(true); notify(`Checklist saved with ${items.length} ${items.length === 1 ? "item" : "items"}.`); }}>{saved ? "Saved ✓" : "Save list"}</button>
    </article>
  );
}
