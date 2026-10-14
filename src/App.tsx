import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { BatteryFull, CalendarDays, Clock3, MessageCircle, Search, Signal, Wifi, X } from "lucide-react";
import { siGoogle, siGooglechrome, siObsidian, siSpotify, siWikipedia, siYoutube } from "simple-icons";
import { type AppCandidate, type Intent, type RemoteDecision, examples, parseJevDecision, resolveQuery } from "./intent";
import Cards from "./components/Cards";
import { type Command, CommandsPalette, filterCommands } from "./components/CommandsPalette";
import { type ExtractedFields, supportsFieldExtraction, useIntentFields } from "./useExtractedDraft";

function SearchWithApps({ query }: { query: string }) {
  const encoded = encodeURIComponent(query || "launcher search");
  return (
    <div className="search-with-apps" aria-label="Search this query in apps">
      <a className="shortcut-google" href={`https://www.google.com/search?q=${encoded}`} target="_blank" rel="noreferrer" aria-label="Search on Google"><svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="searchshift-google-spectrum" x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse"><stop stopColor="#4285f4" /><stop offset=".34" stopColor="#34a853" /><stop offset=".67" stopColor="#fbbc05" /><stop offset="1" stopColor="#ea4335" /></linearGradient></defs><path d={siGoogle.path} fill="url(#searchshift-google-spectrum)" /></svg></a>
      <a href={`https://www.youtube.com/results?search_query=${encoded}`} target="_blank" rel="noreferrer" aria-label="Search on YouTube"><svg className="youtube-mark" viewBox="0 0 24 24" aria-hidden="true"><path d={siYoutube.path} /></svg></a>
      <a href={`https://en.wikipedia.org/w/index.php?search=${encoded}`} target="_blank" rel="noreferrer" aria-label="Search Wikipedia"><svg className="wikipedia-mark" viewBox="0 0 24 24" aria-hidden="true"><path d={siWikipedia.path} /></svg></a>
    </div>
  );
}

const brandIcons = {
  spotify: siSpotify,
  chrome: siGooglechrome,
  obsidian: siObsidian,
};

const utilityAppIcons = {
  messages: MessageCircle,
  clock: Clock3,
  calendar: CalendarDays,
};

function AppMatches({ candidates, notify, label = "Likely apps" }: { candidates: AppCandidate[]; notify: (message: string) => void; label?: string }) {
  return (
    <div className="app-candidates" aria-label={label}>
      <small>{label}</small>
      <div>
        {candidates.map((candidate) => {
          const brandIcon = brandIcons[candidate.id as keyof typeof brandIcons];
          const Icon = utilityAppIcons[candidate.id as keyof typeof utilityAppIcons];
          return (
            <button key={candidate.id} className={`app-match app-${candidate.id}`} onClick={() => notify(`${candidate.name} would open here in the native launcher.`)}>
              <span className="app-match-icon">
                {brandIcon ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d={brandIcon.path} /></svg> : Icon && <Icon size={23} strokeWidth={1.9} aria-hidden="true" />}
              </span>
              <span className="app-match-name">{candidate.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClassificationMessage({ status, retry }: { status: "loading" | "error"; retry?: () => void }) {
  return (
    <article className="card empty" role={status === "error" ? "alert" : "status"}>
      <Search size={24} />
      <h2>{status === "loading" ? "Checking apps and tasks with JEV…" : "JEV classification is unavailable"}</h2>
      {status === "error" && <><p>No local rules were used as a fallback.</p><button className="primary" onClick={retry}>Try again</button></>}
    </article>
  );
}

export default function App() {
  const [query, setQuery] = useState(examples[0]);
  const currentQuery = useRef(examples[0]);
  const lastRequestAt = useRef(0);
  const requestTimer = useRef<number | null>(null);
  const requestSequence = useRef(0);
  const appliedSequence = useRef(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const [selectedCommand, setSelectedCommand] = useState<Exclude<Intent, "unknown"> | null>(null);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [classification, setClassification] = useState<{ query: string; status: "idle" | "loading" | "ready" | "error"; decision: RemoteDecision | null }>({ query: "", status: "idle", decision: null });
  const [retryKey, setRetryKey] = useState(0);
  const choose = (value: string) => { currentQuery.current = value.trim(); setQuery(value); setNotice(""); setSelectedCommand(null); };
  const trimmed = query.trim();
  const commandPaletteOpen = trimmed.startsWith("/");
  const commandFilter = commandPaletteOpen ? trimmed.slice(1) : "";
  const matchingCommands = filterCommands(commandFilter).flatMap((group) => group.commands);
  const commandIndex = Math.min(activeCommandIndex, Math.max(0, matchingCommands.length - 1));
  const isCurrent = classification.query === trimmed;
  const status = !trimmed ? "idle" : isCurrent ? classification.status : "loading";
  const isPrefixPrediction = Boolean(classification.decision && trimmed.startsWith(classification.query));
  const remoteDecision = classification.decision && (isCurrent || isPrefixPrediction) ? classification.decision : null;
  const resolution = resolveQuery(remoteDecision);
  const displayedIntent = selectedCommand ?? resolution.intent;
  const extractionEnabled = Boolean(selectedCommand || (classification.status === "ready" && classification.query === trimmed && resolution.intent !== "unknown"));
  const extractedFields = useIntentFields(trimmed, displayedIntent, extractionEnabled);
  const cardsKey = `${selectedCommand ?? (supportsFieldExtraction(displayedIntent) ? displayedIntent : classification.query)}:${displayedIntent}`;

  const selectCommand = (command: Command) => {
    if (requestTimer.current !== null) window.clearTimeout(requestTimer.current);
    requestTimer.current = null;
    const sequence = ++requestSequence.current;
    appliedSequence.current = sequence;
    currentQuery.current = command.starter;
    setQuery(command.starter);
    setClassification({ query: command.starter, status: "ready", decision: null });
    setSelectedCommand(command.id);
    setActiveCommandIndex(0);
    setNotice("");
    window.requestAnimationFrame(() => searchInput.current?.focus());
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!commandPaletteOpen) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveCommandIndex((index) => matchingCommands.length ? (index + 1) % matchingCommands.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveCommandIndex((index) => matchingCommands.length ? (index - 1 + matchingCommands.length) % matchingCommands.length : 0);
    } else if (event.key === "Enter" && matchingCommands.length) {
      event.preventDefault();
      selectCommand(matchingCommands[commandIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      choose("");
    }
  };

  useEffect(() => {
    const requestQuery = query.trim();
    if (selectedCommand) return;
    if (requestQuery.startsWith("/")) {
      if (requestTimer.current !== null) window.clearTimeout(requestTimer.current);
      requestTimer.current = null;
      setClassification({ query: requestQuery, status: "idle", decision: null });
      return;
    }
    if (!requestQuery) {
      if (requestTimer.current !== null) window.clearTimeout(requestTimer.current);
      requestTimer.current = null;
      setClassification({ query: "", status: "idle", decision: null });
      return;
    }
    if (requestQuery.length < 1) return;

    // Leading + trailing throttle: don't reset the scheduled trailing call on
    // every keystroke. It reads the newest prefix when the 300ms window ends.
    const classify = async (value: string) => {
      if (!value) return;
      lastRequestAt.current = Date.now();
      const sequence = ++requestSequence.current;
      try {
        const response = await fetch("/api/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: value }),
        });
        if (!response.ok) throw new Error(`JEV request failed (${response.status})`);
        const decision = parseJevDecision(await response.json());
        if (!decision) throw new Error("JEV returned an invalid decision");
        const current = currentQuery.current;
        if (sequence < appliedSequence.current || !current.startsWith(value)) return;
        appliedSequence.current = sequence;
        setClassification({ query: value, status: current === value ? "ready" : "loading", decision });
      } catch (error) {
        const current = currentQuery.current;
        if (sequence >= appliedSequence.current && current === value) {
          appliedSequence.current = sequence;
          setClassification((previous) => previous.decision && current.startsWith(previous.query)
            ? previous
            : { query: requestQuery, status: "error", decision: null });
        }
      }
    };

    const wait = Math.max(0, 300 - (Date.now() - lastRequestAt.current));
    if (wait === 0 && requestTimer.current === null) {
      void classify(requestQuery);
      return;
    }
    if (requestTimer.current === null) {
      requestTimer.current = window.setTimeout(() => {
        requestTimer.current = null;
        void classify(currentQuery.current);
      }, wait);
    }
  }, [query, retryKey, selectedCommand]);

  useEffect(() => () => {
    if (requestTimer.current !== null) window.clearTimeout(requestTimer.current);
  }, []);

  return (
    <main className="workspace">
      <div className="phone" aria-label="SearchShift-Jev launcher preview">
        <div className="status" aria-hidden="true"><span>9:41</span><div><Signal size={14} /><Wifi size={15} /><BatteryFull size={20} /></div></div>
        <section className="launcher">
          <label className="search">
            <Search size={21} />
            <input
              ref={searchInput}
              aria-label="Search apps, tasks, or commands"
              aria-expanded={commandPaletteOpen}
              aria-haspopup={commandPaletteOpen ? "listbox" : undefined}
              aria-controls={commandPaletteOpen ? "launcher-command-list" : undefined}
              aria-activedescendant={commandPaletteOpen && matchingCommands.length ? `command-option-${matchingCommands[commandIndex].id}` : undefined}
              placeholder="Search / for commands"
              value={query}
              onChange={(event) => { setActiveCommandIndex(0); choose(event.target.value); }}
              onKeyDown={handleSearchKeyDown}
            />
            <button aria-label="Clear search" onClick={() => choose("")}><X size={18} /></button>
          </label>
          <div className="results">
            {commandPaletteOpen ? <div id="launcher-command-list"><CommandsPalette filter={commandFilter} activeIndex={commandIndex} onSelect={selectCommand} onActivate={setActiveCommandIndex} /></div> : <>
            {status === "loading" && remoteDecision ? <>
              {resolution.presentation !== "task-only" && resolution.appCandidates.length > 0 && <AppMatches candidates={resolution.appCandidates} notify={setNotice} label={resolution.presentation === "app-first" ? "Apps" : "Also try apps"} />}
              {(displayedIntent !== "unknown" || resolution.presentation !== "app-first") && <Cards key={cardsKey} intent={displayedIntent} query={query} notify={setNotice} extractedFields={extractedFields} />}
              <small className="classification-progress">Updating prediction as you type…</small>
            </> : status === "loading" ? <ClassificationMessage status="loading" /> : null}
            {status === "error" && <ClassificationMessage status="error" retry={() => setRetryKey((value) => value + 1)} />}
            {status === "ready" && <>
              {!selectedCommand && resolution.presentation !== "task-only" && resolution.appCandidates.length > 0 && <AppMatches candidates={resolution.appCandidates} notify={setNotice} label={resolution.presentation === "app-first" ? "Apps" : "Also try apps"} />}
              {(displayedIntent !== "unknown" || selectedCommand || resolution.presentation !== "app-first") && <Cards key={cardsKey} intent={displayedIntent} query={query} notify={setNotice} extractedFields={extractedFields} />}
            </>}
            {status === "idle" && <Cards intent="unknown" query={query} notify={setNotice} />}
            {!selectedCommand && <SearchWithApps query={query} />}
            </>}
          </div>
          {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss" onClick={() => setNotice("")}><X size={15} /></button></div>}
        </section>
        <div className="gesture" aria-hidden="true" />
      </div>
    </main>
  );
}
