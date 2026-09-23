# Sync backend — build plan

The web app stores everything in `localStorage`, which lives in one browser on
one device. So your phone and your laptop keep completely separate logs. This
document is the plan for fixing that by writing a small API of your own.

**Stack:** Python + FastAPI + PostgreSQL, using raw SQL rather than an ORM —
the point is to learn SQL, not to hide it.

**Do this after CS50P.** It leans on functions, dictionaries, exceptions, and
file handling, all of which that course covers.

Work through it in order. Every step ends with something you can actually run,
and deployment is deliberately last — it is a separate skill, and front-loading
it is how people quit.

---

## Step 0 — Environment

A **virtual environment** is a private copy of Python for one project, so
packages you install here cannot break anything else on your machine.

```bash
cd C:\Users\matth\code\lift-tracker
```

```bash
python -m venv .venv
```

```bash
.\.venv\Scripts\Activate.ps1
```

Your prompt should now start with `(.venv)`. You need that activate line in
every new terminal.

> If PowerShell refuses with an error about execution policies, that is Windows
> blocking scripts by default. Fix it for your user only:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

Then install what you need:

```bash
pip install "fastapi[standard]" psycopg[binary]
```

- `fastapi` — the web framework
- `psycopg` — the PostgreSQL driver, the thing that lets Python talk to the database

Record your dependencies so the project is reproducible:

```bash
pip freeze > api/requirements.txt
```

Add `.venv/` to `.gitignore`. Never commit a virtual environment.

## Step 1 — One endpoint

Make a folder `api/` with a file `main.py`. In it you want:

- An app object: `app = FastAPI()`
- One function returning a dictionary, decorated with `@app.get("/health")`

FastAPI turns the dictionary into JSON automatically. Run it with:

```bash
fastapi dev api/main.py
```

Open <http://127.0.0.1:8000/health> — you should see your JSON. Then open
<http://127.0.0.1:8000/docs>, which FastAPI generates for you: an interactive
page where you can click buttons to test every endpoint. Use it constantly.

**Concepts to look up here:** what a decorator is, and what the difference
between GET and POST is.

## Step 2 — PostgreSQL

Install it:

```bash
winget install --id PostgreSQL.PostgreSQL.17
```

The installer asks for a password for the `postgres` superuser. **Write it
down.** Then open `psql` (the command-line client) and create a database:

```sql
CREATE DATABASE lifts;
```

Design the table before you write any Python. A set needs: an id, which user it
belongs to, the date, the exercise name, weight, reps, optional RPE, optional
notes, and when the row was last changed.

Things to decide, which is the actual learning:

- **Which type for each column.** `TEXT` for names, `NUMERIC` for weight (not
  `FLOAT` — look up why money and measurements avoid floats), `INTEGER` for
  reps, `DATE` for the date, `TIMESTAMPTZ` for the change time.
- **Primary key.** The app already generates a unique id per set. Use it, so a
  set re-sent twice cannot become two rows.
- **`NOT NULL`.** Which columns must always have a value?

Write the `CREATE TABLE` by hand in `psql`. Then in Python, add two endpoints:
`POST /sets` to insert one, `GET /sets` to return all of them.

> **Critical:** pass values to `psycopg` as parameters — `cur.execute("INSERT
> INTO sets (id, exercise) VALUES (%s, %s)", (id, name))` — never by building
> the SQL string with f-strings or `+`. String-built SQL is how SQL injection
> happens, and it is the single most important habit in this whole document.

## Step 3 — Connect the web app

In `app.js`, the only functions that touch storage are `load` and `save` in
`data.js`. That is the seam — everything else can stay as it is.

Add a `fetch` call to your API. You will immediately hit a **CORS** error,
because a page served from one origin is not allowed to call another by
default. FastAPI ships `CORSMiddleware` to permit it. Read what it actually
does before pasting it in; "allow everything" is fine locally and wrong in
production.

**Keep localStorage as the source of truth.** Write locally first, then sync in
the background. That way the app still works in a gym basement with no signal —
which was the whole reason it was built offline-first.

## Step 4 — Auth

Right now anyone who finds your URL can read and write your data.

Start simple: a long random secret in a request header, which the API checks on
every request. Store it in an **environment variable**, never in the code —
your repo is public.

That teaches headers, secrets, and 401 responses. Real user accounts with
passwords are a much bigger topic; you do not need them for an app with one
user.

## Step 5 — Merging

The genuinely hard part, and the reason this is a good project.

You log sets on your phone with no signal. You also log some on your laptop.
Both eventually sync. Neither should win outright.

Because every set has a unique id, you can merge instead of overwrite:

- A set present in one place and not the other gets copied over
- A set present in both is the same set — do nothing
- A **deleted** set is the hard case: if it is simply missing, the other device
  cannot tell "deleted" from "never seen" and will helpfully restore it

Look up **tombstones** — the standard fix, where you record deletions instead of
just removing rows.

## Step 6 — Deploy

Only once everything works locally.

You need somewhere to run Python and a hosted Postgres. [Render](https://render.com)
and [Neon](https://neon.tech) both have free tiers that suit this.

What you will learn here: environment variables in production, why the database
URL must never be committed, and why a free service that sleeps when idle makes
your first request slow.

---

## Ground rules

- **Read error messages.** Python tracebacks are read bottom-up: the last line
  says what went wrong, the lines above say where. They are genuinely trying to
  help.
- **Commit often**, in small pieces, with messages saying why.
- **Never commit secrets** — passwords, API keys, database URLs. This repo is
  public.
- When stuck, make the smallest thing that reproduces the problem. Half of
  debugging is shrinking the surface.
