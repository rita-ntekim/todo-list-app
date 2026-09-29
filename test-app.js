/* Temporary test harness: a tiny fake DOM so we can run app.js in Node
   and click through the whole app. Not part of the app itself. */
const fs = require('fs');
const vm = require('vm');

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this.classes = new Set();
    this.dataset = {};
    this.attrs = {};
    this._text = '';
    this.hidden = false;
    this.value = '';
    this.checked = false;
  }
  get className() {
    return [...this.classes].join(' ');
  }
  set className(v) {
    this.classes = new Set(String(v).split(/\s+/).filter(Boolean));
  }
  get classList() {
    const set = this.classes;
    return {
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      contains: (c) => set.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !set.has(c) : Boolean(force);
        if (on) set.add(c);
        else set.delete(c);
        return on;
      },
    };
  }
  get innerHTML() {
    return this._text;
  }
  set innerHTML(v) {
    if (v === '') this.children.forEach((c) => (c.parentNode = null));
    this.children = [];
    this._text = String(v);
  }
  get textContent() {
    if (this.children.length) return this.children.map((c) => c.textContent).join('');
    return this._text;
  }
  set textContent(v) {
    this.children.forEach((c) => (c.parentNode = null));
    this.children = [];
    this._text = String(v);
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  append(...kids) {
    kids.forEach((k) => this.appendChild(k));
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  getAttribute(k) {
    return this.attrs[k];
  }
  addEventListener(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  }
  fire(type, extra) {
    const ev = Object.assign(
      { type, target: this, currentTarget: this, preventDefault() {} },
      extra || {}
    );
    (this.listeners[type] || []).slice().forEach((fn) => fn(ev));
    return ev;
  }
  focus() {}
  select() {}
  descendants() {
    const out = [];
    const walk = (n) => n.children.forEach((c) => { out.push(c); walk(c); });
    walk(this);
    return out;
  }
  querySelector(sel) {
    const cls = sel.startsWith('.') ? sel.slice(1) : null;
    return this.descendants().find((e) => (cls ? e.classes.has(cls) : e.id === sel)) || null;
  }
}
class HTMLInputElement extends El {}

const make = (tag) => new (tag === 'input' ? HTMLInputElement : El)(tag);

/* ---- the static HTML bits app.js looks up, mirrored by hand ---- */
/* One shared `store` stands in for the browser's persistent storage, so
   building a second app behaves like reloading the page: it sees old data. */
const store = new Map();
let confirmAnswer = true;
const warns = [];

function createApp() {
const byId = {};
const reg = (id, tag) => ((byId[id] = make(tag)), (byId[id].id = id), byId[id]);

reg('taskForm', 'form');
reg('taskInput', 'input');
reg('taskList', 'ul');
reg('emptyMessage', 'p');
reg('taskCounter', 'p');
reg('clearDoneBtn', 'button');
reg('dateLabel', 'p');
reg('timeDisplay', 'p');
reg('startPauseBtn', 'button');
reg('resetBtn', 'button');
reg('focusTaskLabel', 'strong');
reg('sessionCount', 'strong');

const filterButtons = ['all', 'active', 'done'].map((f) => {
  const b = make('button');
  b.classes.add('filter-btn');
  b.dataset.filter = f;
  if (f === 'all') b.classes.add('is-active');
  return b;
});
const modeButtons = [
  { minutes: '25', label: 'Focus' },
  { minutes: '5', label: 'Break' },
  { minutes: '15', label: 'Long break' },
].map((m) => {
  const b = make('button');
  b.classes.add('mode-btn');
  b.dataset.minutes = m.minutes;
  b.dataset.label = m.label;
  if (m.minutes === '25') b.classes.add('is-active');
  return b;
});

const docListeners = {};
const alerts = [];

const sandbox = {
  HTMLInputElement,
  console: { log: (...a) => console.log(...a), warn: (...a) => warns.push(a.join(' ')), error: () => {} },
  setTimeout,
  setInterval,
  clearInterval,
  alerts,
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  document: {
    title: '',
    getElementById: (id) => byId[id] || null,
    querySelectorAll: (sel) =>
      sel === '.filter-btn' ? filterButtons : sel === '.mode-btn' ? modeButtons : [],
    createElement: (tag) => make(tag),
    addEventListener: (type, fn) => (docListeners[type] = (docListeners[type] || []).concat(fn)),
  },
  window: {},
  alert: (m) => alerts.push(String(m)),
  confirm: () => confirmAnswer,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
return { byId, filterButtons, modeButtons, docListeners, sandbox };
}

const { byId, filterButtons, modeButtons, docListeners, sandbox } = createApp();

/* ---- small assertion helpers ---- */
let pass = 0;
let fail = 0;
const log = [];
function check(name, cond, extra) {
  if (cond) {
    pass++;
    log.push('  PASS  ' + name);
  } else {
    fail++;
    log.push('  FAIL  ' + name + (extra !== undefined ? '   got: ' + JSON.stringify(extra) : ''));
  }
}

const items = () => byId.taskList.children;
const bodyOf = (li) => li.children.find((c) => c.classes.has('task-body'));
const textOf = (li) => {
  const b = bodyOf(li);
  return b && b.children[0] ? b.children[0]._text : null;
};
const metaOf = (li) => {
  const b = bodyOf(li);
  return b && b.children[1] ? b.children[1]._text : '';
};
const checkOf = (li) => li.children.find((c) => c instanceof HTMLInputElement);
const actionOf = (li, labelPart) => {
  const a = li.children.find((c) => c.classes.has('task-actions'));
  return a ? a.children.find((b) => (b.attrs['aria-label'] || '').includes(labelPart)) : null;
};

let lastFocused = null;
HTMLInputElement.prototype.focus = function () {
  lastFocused = this;
};

/* ---- run the real app.js inside the fake DOM ---- */
const code = fs.readFileSync('app.js', 'utf8');
try {
  vm.runInContext(code, sandbox, { filename: 'app.js' });
  pass++;
  log.push('  PASS  app.js loaded and init() ran without throwing');
} catch (err) {
  fail++;
  log.push('  FAIL  app.js threw on load: ' + err.message);
}

/* 1. initial paint */
check('clock starts at 25:00', byId.timeDisplay._text === '25:00', byId.timeDisplay._text);
check('date label filled', byId.dateLabel._text.length > 4, byId.dateLabel._text);
check('empty message shown when no tasks', byId.emptyMessage.hidden === false);
check('session count starts at 0', byId.sessionCount._text === '0', byId.sessionCount._text);
check('focus label default text', byId.focusTaskLabel._text.startsWith('nothing'), byId.focusTaskLabel._text);

/* 2. create */
byId.taskInput.value = '  Buy milk  ';
byId.taskForm.fire('submit');
check('add task renders one row', items().length === 1, items().length);
check('text is trimmed on save', textOf(items()[0]) === 'Buy milk', textOf(items()[0]));
check('input box cleared after add', byId.taskInput.value === '', byId.taskInput.value);
check('input keeps focus for fast typing', lastFocused === byId.taskInput);

byId.taskInput.value = '     ';
byId.taskForm.fire('submit');
check('blank input ignored', items().length === 1, items().length);

byId.taskInput.value = 'Study maths';
byId.taskForm.fire('submit');
check('newest task appears on top', textOf(items()[0]) === 'Study maths', textOf(items()[0]));
check('counter reads 2 of 2', byId.taskCounter._text === '2 of 2 still to do', byId.taskCounter._text);
check('empty message hidden now', byId.emptyMessage.hidden === true);

/* 3. mark done */
checkOf(items()[1]).fire('change');
check('done task gets is-done class', items()[1].classes.has('is-done'));
check('counter counts only unfinished', byId.taskCounter._text === '1 of 2 still to do', byId.taskCounter._text);

/* 4. filters */
filterButtons[2].fire('click');
check('filter Done shows 1', items().length === 1, items().length);
check('filter Done button is active', filterButtons[2].classes.has('is-active'));
check('All button no longer active', !filterButtons[0].classes.has('is-active'));
filterButtons[1].fire('click');
check(
  'filter To-do shows the right task',
  items().length === 1 && textOf(items()[0]) === 'Study maths',
  textOf(items()[0])
);
filterButtons[0].fire('click');
check('filter All shows 2', items().length === 2, items().length);

/* 5. edit */
actionOf(items()[0], 'Edit').fire('click');
check('edit box appears', !!byId.taskList.querySelector('.edit-input'));
byId.taskList.querySelector('.edit-input').value = 'Study physics';
byId.taskList.querySelector('.edit-input').fire('keydown', { key: 'Enter' });
check('edit saved on Enter', textOf(items()[0]) === 'Study physics', textOf(items()[0]));
check('edit box gone after save', !byId.taskList.querySelector('.edit-input'));

actionOf(items()[1], 'Edit').fire('click');
byId.taskList.querySelector('.edit-input').value = 'should not be saved';
byId.taskList.querySelector('.edit-input').fire('keydown', { key: 'Escape' });
check('Escape cancels the edit', textOf(items()[1]) === 'Buy milk', textOf(items()[1]));
check('edit box gone after Escape', !byId.taskList.querySelector('.edit-input'));

/* 6. delete (with the confirm dialog) */
const actionsOf = (li) => li.children.find((c) => c.classes.has('task-actions')).children;

confirmAnswer = false;
actionsOf(items()[1])[2].fire('click');
check('saying No to delete keeps the task', items().length === 2, items().length);

confirmAnswer = true;
actionsOf(items()[1])[2].fire('click');
check('saying Yes deletes the task', items().length === 1, items().length);
check('the right task was deleted', textOf(items()[0]) === 'Study physics', textOf(items()[0]));

/* 7. attach the timer to a task */
actionsOf(items()[0])[0].fire('click');
check('focus label shows the task', byId.focusTaskLabel._text === 'Study physics', byId.focusTaskLabel._text);
check('focused row gets is-focused class', items()[0].classes.has('is-focused'));
actionsOf(items()[0])[0].fire('click');
check('clicking 🎯 again detaches it', items()[0].classes.has('is-focused') === false);
actionsOf(items()[0])[0].fire('click');

/* 8. timer start / pause / resume / reset */
byId.startPauseBtn.fire('click');
check('Start becomes Pause', byId.startPauseBtn._text === 'Pause', byId.startPauseBtn._text);
check('clock turns "running"', byId.timeDisplay.classes.has('is-running'));
check('tab title shows the countdown', /· Focus$/.test(sandbox.document.title), sandbox.document.title);
byId.startPauseBtn.fire('click');
check('Pause becomes Resume after pausing', byId.startPauseBtn._text === 'Resume', byId.startPauseBtn._text);
check('clock stops the running style', !byId.timeDisplay.classes.has('is-running'));
check('tab title restored', sandbox.document.title === 'My Todo List + Focus Timer', sandbox.document.title);
byId.resetBtn.fire('click');
check('Reset puts the full 25:00 back', byId.timeDisplay._text === '25:00', byId.timeDisplay._text);
check('Reset puts the button back to Start', byId.startPauseBtn._text === 'Start', byId.startPauseBtn._text);

modeButtons[1].fire('click');
check('Break 5 mode shows 05:00', byId.timeDisplay._text === '05:00', byId.timeDisplay._text);
check('Break button is the active one', modeButtons[1].classes.has('is-active'));
check('Focus button no longer active', !modeButtons[0].classes.has('is-active'));
check('switching mode resets the button to Start', byId.startPauseBtn._text === 'Start', byId.startPauseBtn._text);

/* 9. a break ending: nothing counted, back to Focus */
check('finishSession is callable', typeof sandbox.finishSession === 'function');
sandbox.finishSession();
check('a finished break counts as 0 pomodoros', byId.sessionCount._text === '0', byId.sessionCount._text);
check('after a break, Focus 25 is loaded', byId.timeDisplay._text === '25:00', byId.timeDisplay._text);
check('break message shown', String(sandbox.alerts[sandbox.alerts.length - 1]).startsWith('Break over'), sandbox.alerts);

/* 10. a focus block ending: session counted, tomato on the task */
sandbox.finishSession();
check('focus block counts 1 pomodoro today', byId.sessionCount._text === '1', byId.sessionCount._text);
check('task earned a tomato', metaOf(items()[0]).includes('🍅'), metaOf(items()[0]));
check('next mode auto-switched to Break 5', byId.timeDisplay._text === '05:00', byId.timeDisplay._text);
check('focus message shown', String(sandbox.alerts[sandbox.alerts.length - 1]).includes('take a break'), sandbox.alerts);
check('the auto-selected break starts fresh', byId.startPauseBtn._text === 'Start', byId.startPauseBtn._text);

/* 11. persistence */
const saved = JSON.parse(sandbox.localStorage.getItem('my-todo-app-tasks-v1'));
check('tasks saved to localStorage', Array.isArray(saved) && saved.length === 1, saved);
check('saved task kept its text', saved[0].text === 'Study physics', saved[0]);
check('saved task kept its tomato count', saved[0].pomodoros === 1, saved[0]);
const savedSessions = JSON.parse(sandbox.localStorage.getItem('my-todo-app-pomodoros-v1'));
check(
  'pomodoro count saved for today',
  savedSessions.count === 1 && savedSessions.date === new Date().toDateString(),
  savedSessions
);

/* 11b. RELOAD test: a brand-new app instance reading the same storage.
        This is the regression test for the "tasks never load back" bug. */
const app2 = createApp();
try {
  vm.runInContext(code, app2.sandbox, { filename: 'app.js (reload)' });
  const restored = app2.byId.taskList.children;
  check('reload made no console warnings', warns.length === 0, warns);
  check('tasks survive a page reload', restored.length === 1, restored.length);
  check('restored text is correct', textOf(restored[0]) === 'Study physics', textOf(restored[0]));
  check('restored tomato count is shown', metaOf(restored[0]).includes('🍅'), metaOf(restored[0]));
  check('restored pomodoro total shown', app2.byId.sessionCount._text === '1', app2.byId.sessionCount._text);
} catch (err) {
  check('reload threw: ' + err.message, false);
}

/* 12. clear completed */
checkOf(items()[0]).fire('change');
confirmAnswer = true;
byId.clearDoneBtn.fire('click');
check('clear done empties the list', items().length === 0, items().length);
check('empty message returns', byId.emptyMessage.hidden === false);
check('counter cleared', byId.taskCounter._text === '', byId.taskCounter._text);

/* 13. the "n" keyboard shortcut */
docListeners.keydown[0]({ key: 'n', target: new El('p'), preventDefault() {} });
check('n jumps to the add-task box', lastFocused === byId.taskInput);
lastFocused = null;
docListeners.keydown[0]({ key: 'n', target: byId.taskInput, preventDefault() {} });
check('n still types normally inside a box', lastFocused === null, lastFocused);

/* ---- tidy up so node can exit ---- */
sandbox.stopTicker();

/* ---- report ---- */
console.log('\n=== todo app behaviour test ===');
log.forEach((l) => console.log(l));
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail === 0 ? 0 : 1;
