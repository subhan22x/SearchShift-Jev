// The configured key is a TypeSafe JEV key; thejevai.com is a separate service and rejects it.
const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

const intentCriteria = {
  weather: "Weather or forecast. Examples: 'weather in Houston', 'will it rain tomorrow'. Do not use for opening a weather app by name.",
  music: "Play or find music. Examples: 'play jazz', 'listen to a song'. Do not use for an app-only query such as 'Spotify'.",
  contact: "Send a message or place a call. Examples: 'text Maya I am outside', 'call Dad'. Do not use for creating a contact with a phone number.",
  reminder: "Remember something at a time or date. Example: 'remind me to water plants at 6'.",
  timer: "Start a relative timer or countdown. Examples: 'start a 12 minute timer', 'count down 10 minutes'. Do not use for a clock-time alarm.",
  split: "Split a bill or amount among people. Example: 'split $86.40 by 4'.",
  "save-link": "Bookmark or save a link for later. Examples: 'save this article', 'read this later'.",
  unit: "Convert physical units. Examples: '5 feet in cm', '2 kg in pounds'. Do not use for money conversion.",
  currency: "Convert money between currencies. Examples: '80 dollars to euros', '100 USD in GBP'.",
  checklist: "Create a short checklist or shopping list from multiple named items. Example: 'buy milk, eggs and coffee'.",
  calorie: "Estimate calories or nutrition. Example: 'calories in a chicken burrito'.",
  alarm: "Set an alarm for a clock time. Example: 'alarm at 6:30 tomorrow'. Do not use for a relative timer.",
  device: "Directly toggle a device quick setting. Examples: 'turn on flashlight', 'turn off Bluetooth'. Do not use when the request contains a when/condition clause; that is automation.",
  timezone: "Show the current time in another place. Example: 'time in Tokyo'.",
  "date-countdown": "Count days until a date or occasion. Example: 'days until Christmas'.",
  coin: "Flip a coin or choose heads or tails. Example: 'heads or tails'.",
  directions: "Get navigation directions to a place. Examples: 'directions to Barton Springs', 'route to the airport'.",
  "food-order": "Order or deliver food. Examples: 'order ramen tonight', 'get pizza delivered'. Do not use for reserving a table.",
  note: "Capture a note or thought. Example: 'note: ask dentist about whitening'.",
  event: "Create a calendar event with a title, person, date, or time. Example: 'lunch with Priya Friday at 1'. Do not use when the verb is reserve/book a restaurant table.",
  habit: "Create a recurring habit with a cadence. Example: 'gym three times a week'.",
  goal: "Create a measurable goal with a numeric target. Example: 'read 12 books this year'.",
  "suggested-steps": "Draft reviewable search steps across private sources. Example: 'find my last mechanic oil change'. Do not claim to access Gmail or messages.",
  "new-contact": "Open a new-contact card when the user wants to create a contact, even if the name or phone number has not been typed yet. Example: 'new contact' (incomplete but clearly this task) or 'add Jamie 512-555-0142' (details included).",
  reservation: "Reserve a restaurant table, usually with a date, time, or party size. Example: 'reserve dinner Friday at 7'.",
  sports: "Show a sports matchup or result. Example: 'Barcelona vs Sevilla'.",
  color: "Identify or copy a color value. Example: 'minecraft diamond color'.",
  calculate: "Perform arithmetic or a percentage calculation. Example: '18% of 3450'.",
  automation: "Create a conditional when/then automation. Example: 'turn off Bluetooth when I get home'.",
  parking: "Save a parked location with a note or photo. Example: 'save my parking'.",
  "find-file": "Locate a local file or download by name, type, or recency. Example: 'find PDF of a workout plan I downloaded last week'.",
  unknown: "No approved task fits, or the query is primarily an app search. Never invent a task category.",
};
const legacyIntentCriteria = {
  ...intentCriteria,
  "new-contact": "Create a contact from a name and phone number. Example: 'add Jamie 512-555-0142'.",
};

const appCriteria = {
  none: "No installed app is a plausible primary match.",
  spotify: "Spotify music/audio app. Strong match: explicit Spotify search/open, or a request to play music that is likely fulfilled in Spotify. Not a generic answer for unrelated audio information.",
  chrome: "Chrome web browser. Strong match: explicit Chrome/browser search/open or a request to browse the web. Not a generic answer for ordinary weather, fact, or utility queries.",
  obsidian: "Obsidian notes and knowledge app. Strong match: explicit Obsidian search/open or a request to create/search a note likely kept there. Do not match every note-capture card by default.",
  messages: "Messages app for SMS/texting. Strong match: explicit Messages search/open or a request to send a text. Do not use for phone calls or reminders about contacting someone.",
  clock: "Clock app for clock-time alarms and relative timers. Strong match: explicit Clock search/open, setting an alarm, or starting a timer. Do not use for reminders, time zones, or any query that merely mentions a time.",
  calendar: "Calendar app for creating or opening events. Strong match: explicit Calendar search/open or creating a calendar event. Do not use for generic dates, time zones, or countdowns.",
};

const installedApps = Object.entries(appCriteria)
  .filter(([id]) => id !== "none")
  .map(([id, description]) => ({ id, description }));

function choice(answer) {
  if (!answer || typeof answer !== "object" || typeof answer.choice !== "string") return null;
  return {
    value: answer.choice,
    confidence: typeof answer.confidence === "number" ? answer.confidence : 0,
  };
}

function noul(answer) {
  if (!answer || typeof answer !== "object" || typeof answer.noul !== "number") return 0;
  return Math.max(0, Math.min(1, answer.noul));
}

const incrementalGuidance = "This is an incremental launcher search box: users often pause on a short fragment before finishing. Prefer the best provisional task card when the fragment points to a utility, even if required fields are missing; the card collects missing values. Do not require a complete sentence or enough parameters to execute. But a single character is not enough evidence for a task: 'f', 'w', and 'n' -> unclear/unknown, not find-file, weather, or new-contact. Use a meaningful multi-character phrase before showing a task card: 'find' or 'find f' -> find-file, 'wea' or 'weather' -> weather, 'new c' or 'new contact' -> new-contact, 'habi' or 'habit' -> habit, 'tim' or 'timer' -> timer. Disambiguate search: 'find my last mechanic oil change' is suggested-steps because it asks for a personal record, while 'find PDF of a workout plan I downloaded last week' is find-file because it asks for a local download. Do not call the incomplete phrase 'find my' a local-file request without file/download/name evidence. A fragment such as 'tim' may also be an app search for Clock, so select the timer card and Clock as the possible app result together. Use unclear only when neither a task card nor an app destination is reasonably indicated. Opening a task card is not the same as executing its action.";

function questionsFor(strategy) {
  if (strategy === "legacy") {
    return {
      query_mode: {
        type: "choice",
        instructions: "Classify the query's primary mode. Choose app_search only when opening/finding an installed app is the main request. Choose task when a concrete utility action is explicit. Choose unclear for a fragment or unresolved ambiguity.",
        criteria: {
          app_search: "The user is primarily trying to find or open one installed app, for example 'Spotify' or 'open Chrome'.",
          task: "The user is primarily describing one concrete launcher task, for example 'turn on flashlight' or '18% of 3450'.",
          unclear: "The input is too short, partial, or ambiguous between an app and a task.",
        },
      },
      task_intent: {
        type: "choice",
        instructions: "If query_mode is task, select exactly one best approved task card. If query_mode is app_search or unclear, select unknown unless the query also contains an explicit task request. Use the examples and exclusions in each criterion. Do not invent an intent.",
        criteria: legacyIntentCriteria,
      },
      app_match: {
        type: "choice",
        instructions: "If query_mode is app_search or the query is still plausibly an app search, choose the best installed app. Otherwise choose none. Never choose an app merely because a task could use it.",
        criteria: appCriteria,
      },
      keep_app_results: {
        type: "noul",
        instructions: "Answer yes when app results should remain visible while the person finishes typing because the query could still be an app search; answer no when a task is clearly established.",
      },
    };
  }

  if (strategy === "single-route") {
    const routeCriteria = Object.fromEntries([
      ...Object.entries(intentCriteria).filter(([id]) => id !== "unknown").map(([id, description]) => [`task:${id}`, `${description} This is a task destination, even if the query is only a fragment or omits fields the card can collect.`]),
      ...installedApps.map(({ id, description }) => [`app:${id}`, `The user wants to open or find this installed app: ${description}`]),
      ["unknown", "No task card or installed app is reasonably indicated yet."],
    ]);
    return {
      primary_route: {
        type: "choice",
        instructions: `${incrementalGuidance} Choose exactly one primary destination from the task cards, installed apps, or unknown. A clear task card and an app to open are different destinations.`,
        criteria: routeCriteria,
      },
      keep_app_results: {
        type: "noul",
        instructions: "Should installed-app results remain visible alongside the provisional destination while the user continues typing? Answer yes only when an app destination is still plausible.",
        criteria: {
          true: "A specific installed app may be what the user is searching for.",
          false: "The input points to a task card or does not plausibly request an installed app.",
        },
      },
    };
  }

  if (strategy !== "incremental") throw new Error("Unknown JEV prompt strategy");
  return {
    query_mode: {
      type: "choice",
      instructions: `${incrementalGuidance} Choose app_search only when the user likely wants to open/find an installed app. Choose task when any approved task category is indicated, even if incomplete. Choose unclear only when no destination is reasonably indicated.`,
      criteria: {
        app_search: "The user is primarily looking for an installed app to open, such as 'Spotify' or 'open Chrome'.",
        task: "The user signals an approved task/card, including an incomplete card request such as 'weather', 'habit', 'new contact', or 'find file'.",
        unclear: "The fragment has no reasonably identifiable task card or app destination.",
      },
    },
    task_intent: {
      type: "choice",
      instructions: `${incrementalGuidance} Independently choose the best task card suggested by the text; questions are evaluated in parallel, so do not depend on another answer. Choose unknown only when no task card is indicated or the query is primarily an app-open request.`,
      criteria: intentCriteria,
    },
    app_match: {
      type: "choice",
      instructions: "Choose the best matching installed app if the query names it, describes it, or is still a plausible app-search fragment; an app may appear alongside a task card while the user is typing. For task requests, choose the app only when it is a natural likely destination (for example Spotify for playing music, Clock for an alarm, Messages for texting, Calendar for creating an event). Choose none when no listed app is a plausible result; do not force a generic app for unrelated tasks.",
      criteria: appCriteria,
    },
    keep_app_results: {
      type: "noul",
      instructions: "Is an installed-app search still a plausible destination for this exact prefix, in addition to any task card? Judge against the provided installed-app catalog, not all apps that exist in the world. Do not say yes just because the text is short: a recognizable task such as 'weather' or 'new contact' should be no when no listed app matches. A truly unresolved prefix such as 'w' can be yes; 'wea' can remain uncertain between web/app and weather-task; the completed 'weather in Austin' should be no. A matched app and task card may both be shown.",
      criteria: {
        true: "An installed app is still a plausible user destination, or this prefix is genuinely too incomplete to rule out app search.",
        false: "The query clearly indicates a task card and no app in the supplied installed-app catalog is a plausible result.",
      },
    },
  };
}

function normalize(payload, strategy) {
  if (!payload?.answers) throw new Error("JEV returned an invalid decision");
  if (strategy === "single-route") {
    const routeAnswer = payload.answers.primary_route;
    const route = choice(routeAnswer);
    const selected = route?.value ?? "unknown";
    const isTask = selected.startsWith("task:");
    const isApp = selected.startsWith("app:");
    const mode = isTask ? "task" : isApp ? "app_search" : "unclear";
    const intent = isTask && Object.hasOwn(intentCriteria, selected.slice(5)) ? selected.slice(5) : "unknown";
    const appId = isApp && Object.hasOwn(appCriteria, selected.slice(4)) && selected.slice(4) !== "none" ? selected.slice(4) : null;
    const appScores = Object.fromEntries(installedApps.map(({ id }) => [id, routeAnswer?.probabilities?.[`app:${id}`] ?? 0]));
    const appProbability = Object.values(appScores).reduce((sum, probability) => sum + probability, 0);
    return {
      mode,
      modeConfidence: route?.confidence ?? 0,
      modeProbability: routeAnswer?.probabilities?.[selected] ?? 0,
      intent,
      intentConfidence: isTask ? route?.confidence ?? 0 : 0,
      intentProbability: isTask ? routeAnswer?.probabilities?.[selected] ?? 0 : 0,
      keepAppResults: noul(payload.answers.keep_app_results),
      appId,
      appProbability: appId ? appScores[appId] : 0,
      appNoneProbability: Math.max(0, 1 - appProbability),
      appScores,
    };
  }

  const modeAnswer = payload.answers.query_mode;
  const intentAnswer = payload.answers.task_intent;
  const appAnswer = payload.answers.app_match;
  const mode = choice(modeAnswer);
  const intent = choice(intentAnswer);
  const app = choice(appAnswer);
  const appId = Object.hasOwn(appCriteria, app?.value) && app?.value !== "none" ? app.value : null;
  return {
    mode: mode?.value === "app_search" || mode?.value === "task" || mode?.value === "unclear" ? mode.value : "unclear",
    modeConfidence: mode?.confidence ?? 0,
    modeProbability: modeAnswer?.probabilities?.[mode?.value] ?? 0,
    intent: Object.hasOwn(intentCriteria, intent?.value) ? intent.value : "unknown",
    intentConfidence: intent?.confidence ?? 0,
    intentProbability: intentAnswer?.probabilities?.[intent?.value] ?? 0,
    keepAppResults: noul(payload.answers.keep_app_results),
    appId,
    appProbability: appId ? appAnswer?.probabilities?.[appId] ?? 0 : 0,
    appNoneProbability: appAnswer?.probabilities?.none ?? 0,
    appScores: Object.fromEntries(installedApps.map(({ id }) => [id, appAnswer?.probabilities?.[id] ?? 0])),
  };
}

// Jev only selects from this approved vocabulary. It never supplies markup, actions, or executable code.
export async function classifyWithJev(query, apiKey, { strategy = "incremental" } = {}) {
  if (!apiKey) throw new Error("JEV is not configured");

  const questions = questionsFor(strategy);

  const response = await fetch(JEV_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: "jev-latest",
      state: strategy === "legacy" ? {
        query: query.slice(0, 500),
        product: "SearchShift-Jev Android-style launcher prototype",
        routing_context: {
          query_kind: "One short natural-language launcher query. Classify the user's primary intent, not every possible interpretation.",
          app_search: "An app search names or describes an installed app the user wants to open. A task that happens to mention a service is still a task when it contains an action request.",
          task: "A task asks the launcher to perform one concrete utility action using one approved card.",
          ambiguity: "If the query is too short or genuinely ambiguous, use unclear mode and keep app results visible. Do not guess a task from a fragment.",
          installed_apps: installedApps,
          approved_task_cards: legacyIntentCriteria,
        },
        policy: "Choose only from the approved task cards and installed-app catalog. App search and task mode are mutually exclusive primary modes. Do not infer private information, claim that an external action happened, or invent a card.",
      } : {
        query: query.slice(0, 500),
        product: "SearchShift-Jev Android-style launcher prototype",
        interaction: "The launcher predicts a destination while the person types. Each card is a safe, editable draft that can collect missing details; selecting a card does not execute its action.",
        routing_context: {
          query_kind: "One short, possibly incomplete prefix from a live launcher search box.",
          app_search: "An app search names or describes an installed app the user wants to open. A task that happens to mention a service is still a task when it contains an action request.",
          task: "A task asks the launcher to perform one concrete utility action using one approved card.",
          ambiguity: incrementalGuidance,
          installed_apps: installedApps,
          approved_task_cards: intentCriteria,
        },
        policy: "Choose only from the approved task cards and installed-app catalog. A selected card is an editable draft, not an executed action. Do not infer private information, claim that an external action happened, or invent a card.",
      },
      questions,
    }),
    signal: AbortSignal.timeout(4_000),
  });

  if (!response.ok) throw new Error(`JEV returned ${response.status}`);
  const payload = await response.json();
  return { ...normalize(payload, strategy), strategy, model: payload.model ?? null };
}
