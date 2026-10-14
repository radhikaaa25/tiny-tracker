const STORAGE_KEY = "tiny-tracker-v1";

const MOODS = [
  { id: "glow", emoji: "🌸", label: "glow" },
  { id: "calm", emoji: "☁️", label: "calm" },
  { id: "meh", emoji: "🫖", label: "meh" },
  { id: "tired", emoji: "🌙", label: "tired" },
  { id: "spicy", emoji: "🌶️", label: "spicy" },
];

const DEFAULT_HABITS = [
  { id: "water", name: "drink water" },
  { id: "stretch", name: "stretch a little" },
  { id: "kind", name: "be kind to yourself" },
  { id: "outside", name: "go outside" },
];

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { habits: DEFAULT_HABITS, days: {} };
    const parsed = JSON.parse(raw);
    return {
      habits: parsed.habits?.length ? parsed.habits : DEFAULT_HABITS,
      days: parsed.days || {},
    };
  } catch {
    return { habits: DEFAULT_HABITS, days: {} };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureToday(state) {
  const key = todayKey();
  if (!state.days[key]) {
    state.days[key] = { mood: null, note: "", checks: {} };
  }
  return state.days[key];
}

function dayCompletion(state, key) {
  const day = state.days[key];
  if (!day || !state.habits.length) return 0;
  const done = state.habits.filter((h) => day.checks[h.id]).length;
  return Math.round((done / state.habits.length) * 100);
}

function streakCount(state) {
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i += 1) {
    const key = todayKey(cursor);
    const complete = dayCompletion(state, key) === 100;
    if (!complete) {
      if (i === 0) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      break;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function migrateUtcKeyedToday(state) {
  const local = todayKey();
  const utc = new Date().toISOString().slice(0, 10);
  if (local === utc) return;
  const utcDay = state.days[utc];
  const localDay = state.days[local];
  const localEmpty =
    !localDay ||
    (!localDay.mood &&
      !localDay.note &&
      !Object.values(localDay.checks || {}).some(Boolean));
  if (utcDay && localEmpty) {
    state.days[local] = utcDay;
    delete state.days[utc];
  }
}

const state = loadState();
migrateUtcKeyedToday(state);
const today = ensureToday(state);

const todayLabel = document.getElementById("today-label");
const streakLabel = document.getElementById("streak-label");
const moodsEl = document.getElementById("moods");
const habitsEl = document.getElementById("habits");
const progressEl = document.getElementById("progress");
const noteEl = document.getElementById("note");
const weekEl = document.getElementById("week");
const addForm = document.getElementById("add-habit");

todayLabel.textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});
noteEl.value = today.note || "";

function renderMoods() {
  moodsEl.innerHTML = MOODS.map(
    (mood) => `
      <button class="mood ${today.mood === mood.id ? "selected" : ""}" data-mood="${mood.id}" type="button">
        <span>${mood.emoji}</span>${mood.label}
      </button>
    `
  ).join("");
}

function renderHabits() {
  const done = state.habits.filter((h) => today.checks[h.id]).length;
  progressEl.textContent = `${done} / ${state.habits.length}`;
  habitsEl.innerHTML = state.habits
    .map((habit) => {
      const checked = Boolean(today.checks[habit.id]);
      return `
        <li class="habit ${checked ? "done" : ""}">
          <input type="checkbox" id="${habit.id}" ${checked ? "checked" : ""} />
          <label for="${habit.id}">${habit.name}</label>
          <button class="remove" data-remove="${habit.id}" type="button" aria-label="Remove ${habit.name}">×</button>
        </li>
      `;
    })
    .join("");
}

function renderStreak() {
  const n = streakCount(state);
  streakLabel.textContent = n === 1 ? "1 day streak" : `${n} day streak`;
}

function renderWeek() {
  const names = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const start = new Date();
  start.setDate(start.getDate() - start.getDay());
  weekEl.innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = todayKey(d);
    const pct = dayCompletion(state, key);
    const isToday = key === todayKey();
    const mark = pct === 100 ? "✿" : pct > 0 ? "•" : "·";
    return `
      <div class="day ${isToday ? "today" : ""}">
        <div>${names[i]}</div>
        <div class="pct">${mark}</div>
        <div>${d.getDate()}</div>
      </div>
    `;
  }).join("");
}

function refresh() {
  saveState(state);
  renderMoods();
  renderHabits();
  renderStreak();
  renderWeek();
}

moodsEl.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-mood]");
  if (!btn) return;
  today.mood = btn.dataset.mood;
  refresh();
});

habitsEl.addEventListener("change", (event) => {
  if (event.target.type !== "checkbox") return;
  today.checks[event.target.id] = event.target.checked;
  refresh();
});

habitsEl.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-remove]");
  if (!btn) return;
  state.habits = state.habits.filter((h) => h.id !== btn.dataset.remove);
  refresh();
});

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = addForm.habit;
  const name = input.value.trim();
  if (!name) return;
  state.habits.push({
    id: `h-${Date.now()}`,
    name,
  });
  input.value = "";
  refresh();
});

function saveNote() {
  today.note = noteEl.value;
  saveState(state);
}

noteEl.addEventListener("input", saveNote);
noteEl.addEventListener("change", saveNote);

refresh();
