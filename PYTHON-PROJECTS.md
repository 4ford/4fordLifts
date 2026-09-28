# Python projects — after CS50P

Three projects that use this app's real data and code, in order. Each one
builds on the last, and the third is the sync backend.

| # | Project | You'll learn |
|---|---|---|
| 1 | Analyse your own training data | Files, dictionaries, dates, then pandas and charts |
| 2 | Port the plateau detector, with tests | Testing, pure functions, working from a spec |
| 3 | The sync backend | Web APIs, SQL, auth — see `BACKEND.md` |

This guide tells you *what* to build and *which ideas to look up*, not the code.
If you get stuck, ask for a hint or an explanation rather than the answer. The
struggle is the part that teaches you.

## Setup (once, for all three)

Do **Step 0 of `BACKEND.md`**: make a virtual environment in this folder and
activate it. Every project below uses the same one.

Suggested layout, so the three projects share code instead of copying it:

```
lift-tracker/
  analysis/     project 1 — scripts that read your CSV export
  lifts/        shared Python: e1rm, plateau detection
  tests/        project 2 — pytest tests for lifts/
  api/          project 3 — the FastAPI backend
```

> **Your data stays private.** This repo is public. Exports named
> `lift-tracker-*.csv` / `.json` are already in `.gitignore`. Keep that naming
> and run `git status` before every commit to check.

---

## Project 1 — Analyse your own training data

**Why first:** it's your real data, nothing can break, and every answer can
be checked against the app.

### Get the data

In the app: **You → Your data → Export (.csv)**. Put the file in `analysis/`.
The columns are:

```
date, muscle_group, exercise, weight, unit, reps, rpe, est_1rm, notes
```

### Stage A — the standard library only

Use the `csv` module (look up `csv.DictReader`). Write one function per
question, and answer them in this order, since each one needs a bit more than
the last:

1. How many sets have you logged?
2. What's your total volume (weight × reps, summed)? **Check:** it should
   match *Total weight lifted* on the You tab.
3. How many sessions? (A session is a distinct date.) **Check:** the
   *Sessions* tile.
4. Your heaviest set for each lift.
5. Total volume per muscle group. Which one are you neglecting?
6. Your biggest week ever by volume.
7. Which weekday you lift heaviest on.

**What you'll hit, and what to look up:**
- Everything from a CSV is a **string**. `"225" * 5` is not what you want.
  Look up converting with `float()` and `int()`, and what happens with an
  empty RPE cell.
- Counting and grouping means **dictionaries**; distinct dates means a
  **set**.
- Questions 6 and 7 need **dates**. Look up `datetime.date.fromisoformat`,
  `.isocalendar()`, and `.weekday()`.
- "Top 3 anything" means sorting with `sorted(..., key=...)`.

### Stage B — pandas and a chart

`pip install pandas matplotlib`, then redo questions 2–7 with pandas. Look up
`read_csv`, `groupby`, and `resample`. You'll find each one becomes a line or
two, and that's the point of learning Stage A first: now you know what pandas
is doing for you.

Then plot your estimated 1RM over time for one lift, and compare it to the
chart on the Progress tab.

### Stretch

Make it a command-line tool:

```
python analysis/report.py lift-tracker-2026-09-28.csv --lift "Bench Press"
```

Look up `argparse`. CS50P covers `sys.argv`; `argparse` is the grown-up
version.

---

## Project 2 — Port the plateau detector, with tests

**Why:** the logic already exists in `data.js` (`function plateau`) and is
specified in plain English in the README's *How plateaus are called* table.
You have a spec *and* a working reference to check against. That's the ideal
way to learn testing, and the finished module drops straight into the backend.

### Steps

1. **Read before you write.** Read `plateau()` in `data.js` and write down,
   in your own words, what it does. Don't worry if some JavaScript syntax is
   new; the logic is what matters.
2. **Start tiny: `e1rm(weight, reps)`** in `lifts/strength.py`. The formula is
   in the README. Write the test *first* in `tests/test_strength.py`, including
   the one-rep edge case. `pip install pytest`, run `pytest`, watch it fail,
   then make it pass.
3. **Write the plateau tests before the function.** Each row is one test.
   These are the exact cases the JavaScript version was checked against:

   | Situation | Expected |
   |---|---|
   | 3 sessions logged | `new` (too early) |
   | New best every week | `progressing` |
   | 3 flat sessions over 3+ weeks | `stalling` |
   | 3 flat sessions inside one week | `progressing`: time span not met |
   | 5 flat sessions over 6 weeks | `plateau` |
   | Same, but recent sessions ~9% under best | `plateau` with `off` ≈ 0.089 |
   | Last session 10 weeks ago | `dormant` |
   | Stuck, then 205×8 after a best of 205×6 | `progressing`: a rep PR |
   | Stuck, then 230×1 after a best of 225×5 | `progressing`: a weight PR |
   | Stuck, then a first-ever 135×10 warm-up | still `plateau` |
   | Stuck, then 205×6 again | still `plateau` |

4. **Pass "today" in as a parameter.** The JavaScript version reads today's
   date internally, which makes it awkward to test. Your version should take
   `today` as an argument. Look up why that makes tests reliable; the idea is
   called *dependency injection*, and it's worth understanding.
5. **Implement until green.** Read pytest's failure output carefully. It
   shows you the expected and actual values.
6. **Check against the app.** Log the same sets in the app (or import a
   hand-made JSON backup into a spare browser) and confirm your statuses
   match.

**Concepts to look up:** `assert`, pytest test discovery (why files are named
`test_*.py`), pure functions, and optionally `dataclasses` for the result
instead of a dictionary.

---

## Project 3 — The sync backend

Follow **`BACKEND.md`** step by step. Two things carry over from above:

- Your `lifts/` package is ready to use. Once sets live in Postgres, an
  endpoint like `GET /lifts/{name}/plateau` is a query plus a call to the
  function you already tested.
- Keep writing tests. FastAPI has a test client, so look up
  *FastAPI TestClient*. Same pytest you already know.

That's the finish line: your phone and laptop share one log, running on code
you wrote.
