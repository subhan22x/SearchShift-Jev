import {
  AlarmClock,
  Banknote,
  Bell,
  Bookmark,
  Calculator,
  CalendarDays,
  CircleDot,
  Dumbbell,
  FileSearch,
  Flashlight,
  Flame,
  Globe2,
  ListChecks,
  MapPin,
  MessageCircle,
  Music2,
  Navigation,
  NotebookPen,
  Palette,
  Receipt,
  Ruler,
  SearchCheck,
  Sun,
  Target,
  Timer,
  Trophy,
  UserPlus,
  UtensilsCrossed,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Intent } from "../intent";

type TaskIntent = Exclude<Intent, "unknown">;
export type Command = {
  id: TaskIntent;
  label: string;
  detail: string;
  starter: string;
  keywords: string;
  icon: LucideIcon;
  color: string;
};

// Record keeps the command palette in sync with every supported task intent.
const catalog: Record<TaskIntent, Command> = {
  weather: { id: "weather", label: "Weather", detail: "Check a forecast", starter: "weather", keywords: "forecast rain temperature", icon: Sun, color: "sun" },
  music: { id: "music", label: "Find music", detail: "Search tracks and artists", starter: "play", keywords: "spotify song artist", icon: Music2, color: "music" },
  contact: { id: "contact", label: "Text or call", detail: "Reach someone", starter: "text", keywords: "message phone call", icon: MessageCircle, color: "message" },
  reminder: { id: "reminder", label: "Reminder", detail: "Remember something later", starter: "remind me", keywords: "alert notify", icon: Bell, color: "reminder" },
  timer: { id: "timer", label: "Timer", detail: "Start a quick countdown", starter: "start a timer", keywords: "clock focus minutes", icon: Timer, color: "timer" },
  split: { id: "split", label: "Split a bill", detail: "Divide a total fairly", starter: "split a bill", keywords: "tip people share check", icon: Receipt, color: "split" },
  "save-link": { id: "save-link", label: "Save a link", detail: "Keep a page for later", starter: "save link", keywords: "bookmark article read later", icon: Bookmark, color: "link" },
  unit: { id: "unit", label: "Unit converter", detail: "Convert length, weight, and more", starter: "convert units", keywords: "measurement feet cm kg pounds", icon: Ruler, color: "unit" },
  currency: { id: "currency", label: "Currency converter", detail: "Convert between currencies", starter: "convert currency", keywords: "money dollars euros exchange", icon: Banknote, color: "currency" },
  checklist: { id: "checklist", label: "Checklist", detail: "Make a list and check things off", starter: "make a list", keywords: "todo shopping groceries", icon: ListChecks, color: "checklist" },
  calorie: { id: "calorie", label: "Calorie estimate", detail: "Estimate food nutrition", starter: "calories in", keywords: "food meal nutrition", icon: Flame, color: "calorie" },
  alarm: { id: "alarm", label: "Alarm", detail: "Set a clock-time alarm", starter: "set an alarm", keywords: "wake up clock morning", icon: AlarmClock, color: "alarm" },
  device: { id: "device", label: "Device control", detail: "Toggle a quick setting", starter: "turn on flashlight", keywords: "bluetooth wifi hotspot flashlight", icon: Flashlight, color: "device" },
  timezone: { id: "timezone", label: "Time elsewhere", detail: "Compare time zones", starter: "time in", keywords: "world clock city timezone", icon: Globe2, color: "timezone" },
  "date-countdown": { id: "date-countdown", label: "Date countdown", detail: "Count down to a date", starter: "days until", keywords: "birthday holiday event", icon: CalendarDays, color: "date" },
  coin: { id: "coin", label: "Coin flip", detail: "Pick heads or tails", starter: "heads or tails", keywords: "random choose decide", icon: CircleDot, color: "coin" },
  directions: { id: "directions", label: "Directions", detail: "Get a route to a place", starter: "directions to", keywords: "maps navigate route", icon: Navigation, color: "directions" },
  "food-order": { id: "food-order", label: "Order food", detail: "Find a meal to order", starter: "order food", keywords: "delivery takeout doordash restaurant", icon: UtensilsCrossed, color: "food" },
  note: { id: "note", label: "Quick note", detail: "Capture a thought", starter: "note:", keywords: "obsidian jot down write", icon: NotebookPen, color: "note" },
  event: { id: "event", label: "Calendar event", detail: "Plan time with someone", starter: "create a calendar event", keywords: "calendar lunch meeting appointment", icon: CalendarDays, color: "event" },
  habit: { id: "habit", label: "Habit", detail: "Build a repeating routine", starter: "create a habit", keywords: "routine weekly daily gym", icon: Dumbbell, color: "habit" },
  goal: { id: "goal", label: "Goal", detail: "Track progress toward a target", starter: "set a goal", keywords: "target books exercise progress", icon: Target, color: "goal" },
  "suggested-steps": { id: "suggested-steps", label: "Find personal info", detail: "Plan a search across your sources", starter: "find my information", keywords: "search history email records", icon: SearchCheck, color: "search" },
  "new-contact": { id: "new-contact", label: "New contact", detail: "Save someone's details", starter: "new contact", keywords: "person phone address contacts", icon: UserPlus, color: "contact" },
  reservation: { id: "reservation", label: "Reserve a table", detail: "Plan a restaurant booking", starter: "reserve a table", keywords: "restaurant dinner people time", icon: UtensilsCrossed, color: "reservation" },
  sports: { id: "sports", label: "Sports score", detail: "Check a matchup or result", starter: "sports score", keywords: "team game match league", icon: Trophy, color: "sports" },
  color: { id: "color", label: "Color picker", detail: "Find a color and its value", starter: "color picker", keywords: "hex palette shade", icon: Palette, color: "color" },
  calculate: { id: "calculate", label: "Calculator", detail: "Work out an expression", starter: "calculate", keywords: "math percentage arithmetic", icon: Calculator, color: "calculate" },
  automation: { id: "automation", label: "Automation", detail: "Set a when-this, do-that rule", starter: "when something happens", keywords: "routine trigger action bluetooth", icon: Workflow, color: "automation" },
  parking: { id: "parking", label: "Save parking", detail: "Remember where you parked", starter: "save my parking", keywords: "car location camera garage", icon: MapPin, color: "parking" },
  "find-file": { id: "find-file", label: "Find a file", detail: "Locate a download or document", starter: "find a file", keywords: "pdf downloads document workout", icon: FileSearch, color: "file" },
};

const groups: { label: string; ids: TaskIntent[] }[] = [
  { label: "Everyday", ids: ["checklist", "reminder", "note", "event", "new-contact", "contact", "habit", "goal"] },
  { label: "Time & tools", ids: ["timer", "alarm", "date-countdown", "timezone", "unit", "currency", "split", "calculate", "calorie", "coin", "color"] },
  { label: "Find & go", ids: ["find-file", "suggested-steps", "save-link", "directions", "parking", "reservation", "food-order", "sports"] },
  { label: "Quick controls", ids: ["weather", "device", "automation", "music"] },
];

export const allCommands = groups.flatMap((group) => group.ids.map((id) => catalog[id]));

export function filterCommands(value: string) {
  const term = value.trim().toLocaleLowerCase();
  const searchWords = term.split(/\s+/).filter(Boolean);
  return groups
    .map((group) => ({
      ...group,
      commands: group.ids.map((id) => catalog[id]).filter((command) => {
        if (!searchWords.length) return true;
        const searchableWords = `${command.label} ${command.keywords}`
          .toLocaleLowerCase()
          .split(/[^\p{L}\p{N}-]+/u)
          .filter(Boolean);
        return searchWords.every((word) => searchableWords.some((candidate) => candidate.startsWith(word)));
      }),
    }))
    .filter((group) => group.commands.length > 0);
}

export function CommandOption({ command, active, onSelect, onActivate }: {
  command: Command;
  active: boolean;
  onSelect: () => void;
  onActivate: () => void;
}) {
  const Icon = command.icon;
  return (
    <button
      type="button"
      id={`command-option-${command.id}`}
      role="option"
      aria-selected={active}
      className={`command-option${active ? " is-active" : ""}`}
      onClick={onSelect}
      onMouseEnter={onActivate}
    >
      <span className={`command-icon tone-${command.color}`}><Icon size={19} strokeWidth={2.1} aria-hidden="true" /></span>
      <span className="command-copy"><strong>{command.label}</strong><small>{command.detail}</small></span>
      {active && <span className="command-enter" aria-hidden="true">↵</span>}
    </button>
  );
}

export function CommandsPalette({ filter, activeIndex, onSelect, onActivate }: {
  filter: string;
  activeIndex: number;
  onSelect: (command: Command) => void;
  onActivate: (index: number) => void;
}) {
  const visibleGroups = filterCommands(filter);
  const visibleCommands = visibleGroups.flatMap((group) => group.commands);
  let commandIndex = 0;
  return (
    <section className="command-palette card" aria-label="Available commands">
      <div className="command-header">
        <div><h2>What can I do?</h2><p>Choose a card to get started</p></div>
        <span className="command-count">{visibleCommands.length} cards</span>
      </div>
      {visibleCommands.length ? (
        <div className="command-scroll" role="listbox" aria-label="UX cards">
          {visibleGroups.map((group) => (
            <div className="command-group" role="group" aria-label={group.label} key={group.label}>
              <h3>{group.label}</h3>
              {group.commands.map((command) => {
                const index = commandIndex++;
                return <CommandOption key={command.id} command={command} active={index === activeIndex} onSelect={() => onSelect(command)} onActivate={() => onActivate(index)} />;
              })}
            </div>
          ))}
        </div>
      ) : (
        <p className="command-empty">No cards match “{filter}”. Try another word.</p>
      )}
      <div className="command-hint"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
    </section>
  );
}
