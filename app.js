/* ============================================================
   app.js  ->  how the app WORKS
   Read it top to bottom. The sections are:
     1. Shortcuts to the HTML elements
     2. The data (what a "task" looks like)
     3. Saving / loading from the browser (localStorage)
     4. Drawing the list on screen
     5. Create / edit / delete / mark done
     6. Filters + clear done
     7. The Pomodoro focus timer
     8. Starting everything up
   ============================================================ */

/* ------------------------------------------------------------
   1. SHORTCUTS to the HTML elements
   Instead of typing document.getElementById(...) everywhere,
   we look each element up once and store it in a variable.
   ------------------------------------------------------------ */
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const emptyMessage = document.getElementById('emptyMessage');
const taskCounter = document.getElementById('taskCounter');
const clearDoneBtn = document.getElementById('clearDoneBtn');
const filterButtons = document.querySelectorAll('.filter-btn');
const dateLabel = document.getElementById('dateLabel');

const timeDisplay = document.getElementById('timeDisplay');
const startPauseBtn = document.getElementById('startPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const modeButtons = document.querySelectorAll('.mode-btn');
const focusTaskLabel = document.getElementById('focusTaskLabel');
const sessionCountEl = document.getElementById('sessionCount');

/* ------------------------------------------------------------
   2. THE DATA
   Everything the app remembers lives in the `tasks` array.
   One task looks like this:
     {
       id: 'l3k2j9-abc',   <- a unique id, so we know WHICH task
       text: 'Study maths',
       done: false,        <- ticked or not
       pomodoros: 0        <- how many focus sessions you spent on it
     }
   ------------------------------------------------------------ */
let tasks = []; // filled from storage just below, in section 3
let currentFilter = 'all'; // 'all' | 'active' | 'done'
let editingId = null; // the id of the task currently being renamed (or null)
let focusTaskId = null; // the task the Pomodoro timer is attached to

// Makes a short random id like "l3k2j9-4f"
function makeId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

/* ------------------------------------------------------------
   3. SAVING / LOADING
   localStorage is a small key/value store built into every
   browser. Data saved here stays after you close the tab.
   ------------------------------------------------------------ */
const STORAGE_KEY = 'my-todo-app-tasks-v1';

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return []; // first time ever: no tasks yet
    const parsed = JSON.parse(raw);
    // Be strict: only keep entries that actually look like tasks.
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t && typeof t.text === 'string').map((t) => ({
      id: typeof t.id === 'string' ? t.id : makeId(),
      text: t.text,
      done: Boolean(t.done),
      pomodoros: Number(t.pomodoros) || 0,
    }));
  } catch (error) {
    // Broken/corrupt data should never stop the app from opening.
    console.warn('Could not read saved tasks, starting empty.', error);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.warn('Could not save tasks.', error);
  }
}

/* Read the saved tasks back in.
   NOTE: this line has to sit *below* STORAGE_KEY. `const` values are not
   usable before the line they are written on, so calling loadTasks()
   earlier would crash with "Cannot access 'STORAGE_KEY' before initialization". */
tasks = loadTasks();

/* ------------------------------------------------------------
   4. DRAWING THE LIST
   render() throws the old list away and rebuilds it from the
   `tasks` array. That is simple, slow enough not to matter, and
   always matches the data.
   ------------------------------------------------------------ */
function visibleTasks() {
  if (currentFilter === 'active') return tasks.filter((task) => !task.done);
  if (currentFilter === 'done') return tasks.filter((task) => task.done);
  return tasks; // 'all'
}

function render() {
  taskList.innerHTML = ''; // wipe the old list

  const list = visibleTasks();
  list.forEach((task) => taskList.appendChild(createTaskRow(task)));

  // Show the "nothing here yet" note only when the list is empty
  emptyMessage.hidden = list.length !== 0;

  // Little summary under the list
  const left = tasks.filter((task) => !task.done).length;
  if (tasks.length === 0) {
    taskCounter.textContent = '';
  } else if (left === 0) {
    taskCounter.textContent = `All ${tasks.length} task${tasks.length === 1 ? '' : 's'} done 🎉`;
  } else {
    taskCounter.textContent = `${left} of ${tasks.length} still to do`;
  }

  // Keep the timer's "Focusing on:" line in step with the list
  syncFocusLabel();

  // If we are mid-rename, put the cursor in the box at the end of the text
  if (editingId !== null) {
    const box = taskList.querySelector('.edit-input');
    if (box) {
      box.focus();
      box.select();
    }
  }
}

/* Builds one <li> for one task. */
function createTaskRow(task) {
  const li = document.createElement('li');
  li.className = 'task-item';
  if (task.done) li.classList.add('is-done');
  if (task.id === focusTaskId) li.classList.add('is-focused');

  // --- the tick box (mark as done / not done) ---
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-check';
  checkbox.checked = task.done;
  checkbox.setAttribute('aria-label', task.done ? 'Mark as not done' : 'Mark as done');
  checkbox.addEventListener('change', () => toggleDone(task.id));
  li.appendChild(checkbox);

  // --- the middle: either the text, or a rename box ---
  if (task.id === editingId) {
    li.appendChild(createEditor(task));
  } else {
    const body = document.createElement('div');
    body.className = 'task-body';

    const text = document.createElement('span');
    text.className = 'task-text';
    // textContent (NOT innerHTML) means a task typed as <script> stays plain text
    text.textContent = task.text;
    text.title = 'Double-click to rename';
    text.addEventListener('dblclick', () => startEditing(task.id));
    body.appendChild(text);

    // Show how many focus sessions were spent on this task
    if (task.pomodoros > 0) {
      const meta = document.createElement('span');
      meta.className = 'task-meta';
      meta.textContent =
        '🍅'.repeat(Math.min(task.pomodoros, 12)) +
        (task.pomodoros > 12 ? ` (${task.pomodoros})` : '');
      body.appendChild(meta);
    }

    li.appendChild(body);
  }

  // --- the right-hand buttons: focus / edit / delete ---
  const actions = document.createElement('div');
  actions.className = 'task-actions';
  actions.append(
    makeIconButton('🎯', task.id === focusTaskId ? 'Stop focusing on this' : 'Attach the timer to this task', () =>
      setFocusTask(task.id)
    ),
    makeIconButton('✏️', 'Edit this task', () => startEditing(task.id)),
    makeIconButton('🗑️', 'Delete this task', () => deleteTask(task.id), 'delete')
  );
  li.appendChild(actions);

  return li;
}

/* Tiny helper so the three icon buttons are not repeated three times. */
function makeIconButton(emoji, title, onClick, extraClass) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-btn' + (extraClass ? ' ' + extraClass : '');
  btn.textContent = emoji;
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.addEventListener('click', onClick);
  return btn;
}

/* The box that replaces the text while you rename a task. */
function createEditor(task) {
  const row = document.createElement('div');
  row.className = 'edit-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-input';
  input.value = task.text;
  input.maxLength = 120;
  input.setAttribute('aria-label', 'Rename task');
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') saveEdit(task.id, input.value);
    if (event.key === 'Escape') cancelEdit();
  });

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'mini-btn save';
  save.textContent = 'Save';
  save.addEventListener('click', () => saveEdit(task.id, input.value));

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'mini-btn';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', cancelEdit);

  row.append(input, save, cancel);
  return row;
}

/* Keeps the "Focusing on: ..." line in sync with the task list. */
function syncFocusLabel() {
  const task = tasks.find((t) => t.id === focusTaskId);
  focusTaskLabel.textContent = task ? task.text : 'nothing (pick a task with 🎯)';
}

/* ------------------------------------------------------------
   5. CREATE / EDIT / DELETE / MARK DONE
   Each one changes `tasks`, saves it, and redraws the list.
   ------------------------------------------------------------ */

// CREATE
function addTask(rawText) {
  const text = rawText.trim(); // remove spaces from both ends
  if (text === '') return; // ignore an empty submission

  tasks.unshift({
    id: makeId(),
    text: text,
    done: false,
    pomodoros: 0,
  });

  saveTasks();
  render();
}

// MARK AS DONE (or not done)
function toggleDone(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  task.done = !task.done;
  saveTasks();
  render();
}

// DELETE
function deleteTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  // Ask first, because deleting cannot be undone.
  if (!confirm(`Delete "${task.text}"?`)) return;

  tasks = tasks.filter((t) => t.id !== id);
  if (focusTaskId === id) focusTaskId = null; // timer can't point at a deleted task
  saveTasks();
  render();
}

// EDIT - step 1: open the rename box
function startEditing(id) {
  editingId = id;
  render();
}

// EDIT - step 2a: cancel leaves the text untouched
function cancelEdit() {
  editingId = null;
  render();
}

// EDIT - step 2b: save writes the new text
function saveEdit(id, newText) {
  const task = tasks.find((t) => t.id === id);
  editingId = null;

  const trimmed = newText.trim();
  if (task && trimmed !== '') {
    task.text = trimmed;
    saveTasks();
  }
  // If you cleared the text completely we just keep the old one.
  render();
}

// Attach / detach the Pomodoro timer to a task.
// Clicking 🎯 again on the already-selected task detaches it.
function setFocusTask(id) {
  focusTaskId = focusTaskId === id ? null : id;
  render();
}

/* ------------------------------------------------------------
   6. FILTERS + CLEAR DONE
   ------------------------------------------------------------ */
function handleFormSubmit(event) {
  // The browser wants to reload the page when a form is submitted.
  // This stops it so our JavaScript can do the work instead.
  event.preventDefault();
  addTask(taskInput.value);
  taskInput.value = '';
  taskInput.focus(); // ready for the next task
}

function handleFilterClick(event) {
  const button = event.currentTarget;
  currentFilter = button.dataset.filter; // read data-filter="..."

  // Move the "selected" look onto the button you just clicked
  filterButtons.forEach((btn) => btn.classList.toggle('is-active', btn === button));

  render();
}

function clearDoneTasks() {
  const doneCount = tasks.filter((t) => t.done).length;
  if (doneCount === 0) return;
  if (!confirm(`Remove ${doneCount} finished task${doneCount === 1 ? '' : 's'}?`)) return;

  tasks = tasks.filter((t) => !t.done);
  saveTasks();
  render();
}

/* ------------------------------------------------------------
   7. THE POMODORO FOCUS TIMER
   Idea: work 25 minutes, rest 5. That 25-minute block is a
   "pomodoro" (Italian for tomato, after the tomato-shaped timer).

   How the countdown works: instead of trusting setInterval to
   count seconds (it drifts, and browsers slow it down in a
   background tab), we remember the END TIME and recompute
   "time left = end time - now" every quarter second. That way the
   clock stays correct even if the tab was asleep.
   ------------------------------------------------------------ */
const SESSION_KEY = 'my-todo-app-pomodoros-v1';

let timerMinutes = 25; // length of the selected mode
let remainingMs = 25 * 60 * 1000; // milliseconds left on the clock
let endTime = null; // timestamp we count down to (null when paused)
let tickerId = null; // the repeating timer's id, so we can stop it
let isBreak = false; // true while a break mode is selected
let sessionsToday = 0; // finished focus pomodoros since midnight
let hasBeenStarted = false; // true once the current session has been started

function todayKey() {
  return new Date().toDateString(); // e.g. "Mon Sep 29 2026"
}

function loadSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (saved && saved.date === todayKey()) return Number(saved.count) || 0;
  } catch (error) {
    console.warn('Could not read pomodoro count.', error);
  }
  return 0; // a new day (or nothing saved) starts at zero
}

function saveSessions() {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ date: todayKey(), count: sessionsToday }));
  } catch (error) {
    console.warn('Could not save pomodoro count.', error);
  }
}

/* "25:00" out of 1500000 milliseconds */
function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/* One place that paints every timer-related bit of the page. */
function updateTimerUI() {
  const running = tickerId !== null;

  timeDisplay.textContent = formatTime(remainingMs);
  timeDisplay.classList.toggle('is-running', running);
  // One button does three jobs: Start -> Pause -> Resume
  startPauseBtn.textContent =
    running ? 'Pause' : hasBeenStarted && remainingMs > 0 ? 'Resume' : 'Start';
  sessionCountEl.textContent = String(sessionsToday);

  // Show the countdown in the browser tab as well, so you can see
  // it while working in another tab.
  document.title = running
    ? `${formatTime(remainingMs)} · ${isBreak ? 'Break' : 'Focus'}`
    : 'My Todo List + Focus Timer';
}

function stopTicker() {
  if (tickerId !== null) {
    clearInterval(tickerId);
    tickerId = null;
  }
}

function startTimer() {
  if (remainingMs <= 0) remainingMs = timerMinutes * 60 * 1000;
  endTime = Date.now() + remainingMs;
  tickerId = setInterval(tick, 250); // run tick() four times a second
  hasBeenStarted = true; // so a later pause can offer "Resume"
  updateTimerUI();
}

function pauseTimer() {
  stopTicker();
  remainingMs = Math.max(0, endTime - Date.now());
  endTime = null;
  updateTimerUI();
}

function toggleStartPause() {
  if (tickerId === null) startTimer();
  else pauseTimer();
}

function resetTimer() {
  stopTicker();
  endTime = null;
  remainingMs = timerMinutes * 60 * 1000;
  hasBeenStarted = false;
  updateTimerUI();
}

function tick() {
  remainingMs = Math.max(0, endTime - Date.now());
  if (remainingMs <= 0) {
    finishSession();
    return;
  }
  updateTimerUI();
}

/* Runs the moment the clock hits 00:00. */
function finishSession() {
  stopTicker();
  endTime = null;
  remainingMs = 0;
  playChime();

  const finishedAFocusBlock = !isBreak;

  if (finishedAFocusBlock) {
    sessionsToday += 1;
    saveSessions();

    // Credit the task the timer was attached to with one tomato 🍅
    const task = tasks.find((t) => t.id === focusTaskId);
    if (task) {
      task.pomodoros += 1;
      saveTasks();
      render();
    }
  }

  // Suggest the sensible next mode: every 4th focus block earns a long break.
  const longBreakIsDue = sessionsToday % 4 === 0;
  const nextMinutes = finishedAFocusBlock ? (longBreakIsDue ? 15 : 5) : 25;
  const nextLabel = finishedAFocusBlock ? (longBreakIsDue ? 'Long break' : 'Break') : 'Focus';

  updateTimerUI();
  chooseMode(nextMinutes, nextLabel);
  alert(finishedAFocusBlock ? 'Pomodoro done — take a break! ☕' : 'Break over — back to focus 💪');
}

/* Switch between Focus 25 / Break 5 / Long 15. */
function chooseMode(minutes, label) {
  stopTicker();
  timerMinutes = minutes;
  isBreak = label.toLowerCase().includes('break');
  remainingMs = minutes * 60 * 1000;
  endTime = null;
  hasBeenStarted = false;

  modeButtons.forEach((btn) =>
    btn.classList.toggle('is-active', Number(btn.dataset.minutes) === minutes)
  );

  updateTimerUI();
}

function handleModeClick(event) {
  const button = event.currentTarget;
  chooseMode(Number(button.dataset.minutes), button.dataset.label);
}

/* A friendly three-note chime, built in code — no audio file needed. */
function playChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return; // old browser: quietly skip the sound

    const ctx = new AudioContextClass();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((frequency, index) => {
      const startAt = ctx.currentTime + index * 0.18;
      const oscillator = ctx.createOscillator();
      const volume = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;

      volume.gain.setValueAtTime(0.0001, startAt);
      volume.gain.exponentialRampToValueAtTime(0.3, startAt + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.35);

      oscillator.connect(volume);
      volume.connect(ctx.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.4);
    });

    setTimeout(() => ctx.close(), 1500);
  } catch (error) {
    console.warn('Could not play the chime.', error);
  }
}

/* ------------------------------------------------------------
   8. STARTING EVERYTHING UP
   init() runs once, at the bottom of the file, when the page
   has finished loading. All the "when you do X, do Y" wiring
   lives here so you can see every connection in one place.
   ------------------------------------------------------------ */
function init() {
  // Header date, e.g. "Monday, September 29"
  dateLabel.textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  sessionsToday = loadSessions();

  // Wire each HTML control to the function that handles it
  taskForm.addEventListener('submit', handleFormSubmit);
  clearDoneBtn.addEventListener('click', clearDoneTasks);
  filterButtons.forEach((btn) => btn.addEventListener('click', handleFilterClick));
  modeButtons.forEach((btn) => btn.addEventListener('click', handleModeClick));
  startPauseBtn.addEventListener('click', toggleStartPause);
  resetBtn.addEventListener('click', resetTimer);

  // Press "n" anywhere on the page to jump to the add-task box.
  document.addEventListener('keydown', (event) => {
    const alreadyTyping = event.target instanceof HTMLInputElement;
    if (!alreadyTyping && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      taskInput.focus();
    }
  });

  render();
  updateTimerUI();
}

init();
