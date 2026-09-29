# My Todo List + Focus Timer

A tiny, beginner-friendly web app. No installs, no build step, no internet needed.

## How to run it

1. Open the folder this file is in, in File Explorer.
2. **Double-click `index.html`** — it opens in your web browser.

That's it. Every time you change a file, press **F5** in the browser to see your changes.

> Tip: you can also right-click `index.html` → *Open with* → your browser of choice.

## What it does

| Feature | How you use it |
| --- | --- |
| **Create a task** | Type in the box, press **Enter** (or click **Add**) |
| **Edit a task** | Click the ✏️ button, or **double-click the task text**. Enter = save, Esc = cancel |
| **Mark as done** | Tick the box on the left. Untick to undo |
| **Delete a task** | Click the 🗑️ button (it asks first) |
| **Filter** | *All* / *To do* / *Done* buttons |
| **Clear finished** | *Clear done* link |
| **Focus timer** | Pick Focus 25 / Break 5 / Long 15, then **Start** |
| **Attach timer to a task** | Click 🎯 on a task. When a focus block finishes, that task earns a 🍅 |
| **Shortcut** | Press **n** anywhere to jump to the add-task box |

Your tasks and your tomato count are saved in your browser
(`localStorage`), so they are still there when you close the tab.
They are saved **per browser on this computer only** — clearing your
browser data clears the tasks too.

## The three files

| File | Job | If you change it… |
| --- | --- | --- |
| `index.html` | The **structure** — what's on the page | …you add/remove/move things |
| `styles.css` | The **look** — colours, sizes, spacing | …you change how it looks |
| `app.js` | The **behaviour** — what happens when you click | …you change how it works |
| `test-app.js` | An optional **self-check** script (see below) | …only if you want to change the checks |

`index.html` is the only file a browser needs. `test-app.js` is never loaded by
the app — it is a set of checks you run from the terminal.

## Five easy first experiments

Try one, press F5, see what changed.

1. **Change the app title** — in `index.html`, edit the text inside `<h1>…</h1>`.
2. **Change the main colour** — in `styles.css`, find `--brand: #4f46e5;` and try
   `#e11d48` (red), `#0891b2` (teal) or `#16a34a` (green).
3. **Change the timer length** — in `index.html`, change `data-minutes="25"` to
   `data-minutes="1"`. One-minute focus blocks are great for testing.
4. **Change the placeholder text** — in `index.html`, edit
   `placeholder="What needs doing?"`.
5. **Make the clock smaller** — in `styles.css`, in the `.time` rule, change
   `font-size: 68px;` to `40px`.

## How the code fits together (2-minute tour)

**The data.** All tasks live in one array in `app.js`:

```js
{ id: 'l3k2j9-abc', text: 'Study maths', done: false, pomodoros: 0 }
```

**The golden rule of this app:** *change the data → save it → redraw the screen.*
Every action follows it:

```js
function toggleDone(id) {
  const task = tasks.find((t) => t.id === id); // 1. find it
  task.done = !task.done;                      //    change the data
  saveTasks();                                 // 2. save to the browser
  render();                                    // 3. redraw the list
}
```

`render()` wipes the list and rebuilds it from `tasks`, so the picture can never
disagree with the data. That's the whole trick.

**The timer** does the same idea with time: it stores an **end timestamp** and
works out `time left = endTime - Date.now()` four times a second, instead of
trying to count seconds itself. That's why it stays accurate if you switch tabs.

## Did I break something? Run the self-check

`test-app.js` pretends to be a browser: it clicks the buttons, types in the
boxes and reads back what appeared. 67 checks in total.

Open a terminal in this folder (in VS Code: **Terminal → New Terminal**) and run:

    node test-app.js

- **`67 passed, 0 failed`** → your logic is fine; if the page still looks wrong,
  the cause is in `styles.css` / `index.html`, not `app.js`.
- **A line with `FAIL`** → read it. It names the button or box that stopped
  behaving, which points straight at what you changed.

This is how the two bugs found while building this app were caught: saved tasks
silently never loading, and the timer button saying "Start" instead of "Resume".

## Troubleshooting

- **Blank page / nothing happens** — press **F12** and look at the *Console* tab.
  A red error usually names the line that broke. Fix that line, press F5.
- **My tasks vanished** — they're tied to the browser profile and the file's
  location. Opening `index.html` from a *different folder* looks like a fresh app.
  To start over on purpose, run `localStorage.clear()` in the F12 Console, then F5.
- **The chime didn't play** — browsers block sound until you interact with the
  page. Click any button first, then run the timer.

## Ideas for your next feature

Good "I finished the tutorial, now what?" projects, roughly in order of difficulty:

1. Save the order of tasks so you can drag them up and down.
2. Add a due date, and highlight overdue tasks in red.
3. Add a text input in the timer card so you can rename a mode (e.g. 50/10).
4. Show a small "🍅 4 today" badge in the header instead of under the timer.
5. Start with a few example tasks on first run (look at `loadTasks()`).
