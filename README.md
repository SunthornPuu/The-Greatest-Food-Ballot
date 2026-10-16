# The Greatest Food Ballot

*Hosted by the best looking team of U-Hackathon 2026.*

Our team built an AI model that reads a paper ballot and tells you who it was cast for. This project is the stage for it: a **voting playground** where anyone can draw on a digital copy of our ballot, drop it in the box, and watch the model count it. Every ballot goes into a public log, and the counted votes feed a live ranking of 26 Thai dishes.

The real game is trying to fool the model. Two X's? A tick instead of a cross? An X just outside the box? Go see what it says.

- **The AI model (the heart of the backend):** [VecetyP/U-Hackathon-Demo-ClearVote](https://github.com/VecetyP/U-Hackathon-Demo-ClearVote)
- **Product and design brief:** [CLAUDE.md](CLAUDE.md)

---

## 1. The whole system at a glance

The system has four parts. Each one does one job.

| Part | What it is | Its job | Lives at |
|---|---|---|---|
| **The website** | Next.js 15 app | The three pages people use, and the one server route that runs a ballot through the system | Vercel (this repo) |
| **The AI model** | The ML team's ballot-reading pipeline ([ClearVote repo](https://github.com/VecetyP/U-Hackathon-Demo-ClearVote)) | Looks at a ballot image and decides: a vote for dish 1–26, an abstention, or a spoiled ballot | Vercel Python function, https://ballot-model.vercel.app |
| **The database** | Supabase Postgres | Remembers every ballot and its verdict, and computes the ranking | Supabase |
| **The image store** | Supabase Storage | Keeps every ballot image, its thumbnail, and the model's annotated view | Supabase, bucket `ballots` |

How they talk to each other:

```
                         ┌──────────────────────────────────────────┐
                         │        THE AI MODEL  (ClearVote)         │
                         │  OpenCV pipeline, Vercel Python function │
                         │  POST /evaluate   GET /health            │
                         └──────────────────────────────────────────┘
                                   ▲  ballot image      │ verdict + annotated image
                                   │  (X-API-Key)       ▼
┌──────────────┐  drawn ballot  ┌──────────────────────────────────────────┐
│              │ ─────────────► │         THE WEBSITE'S SERVER             │
│   BROWSER    │                │   Next.js route  POST /api/ballots       │
│  /  /vote    │ ◄───────────── │   (holds all the secret keys)            │
│  /log        │    verdict     └──────────────────────────────────────────┘
│              │                       │ images              │ one row
│              │                       ▼                     ▼
│              │                ┌──────────────┐     ┌──────────────────┐
│              │  read-only     │ IMAGE STORE  │     │    DATABASE      │
│              │ ◄───────────── │   Supabase   │     │ Supabase Postgres│
│              │  (anon key)    │   Storage    │     │  table "ballots" │
│              │ ◄──────────────┴──────────────┴──── │  + live updates  │
└──────────────┘   ranking, log, realtime inserts    └──────────────────┘
```

Two rules shape this layout:

1. **Only the website's server writes.** It holds the Supabase service key and the model key. The browser never sees them.
2. **The browser reads directly from Supabase** with the public anon key. Row-level security makes that key read-only, and Supabase Realtime pushes each new ballot to every open page.

## 2. The life of a ballot

Follow one ballot from a fingertip to the leaderboard.

1. **Drawing.** On `/vote`, someone draws an X on the ballot. The ink is stored as vector strokes in the ballot's own coordinates, so zooming and panning never change where a mark lands.
2. **Casting.** They press "Cast ballot". The browser paints the original `public/ballot.jpg` (2400 × 2880 px) on a hidden canvas, replays the strokes on top at full size, and saves two JPEGs: the full ballot and a 600 px thumbnail. The ballot folds and drops into the ballot box.
3. **Counting.** The browser sends both images to `POST /api/ballots`. The server does three things at once: it sends the full ballot to the **AI model**, and uploads the full image and the thumbnail to the **image store**.
4. **The model decides.** The model finds every box on the ballot, judges the mark in each one, looks for stray ink, and returns a verdict: `1`–`26` (a vote for that dish), `0` (abstained) or `-1` (spoiled). It also sends back a picture of what it saw, with every box outlined and labelled.
5. **Recording.** The server checks the answer, stores the model's picture as `processed/{id}.jpg`, and inserts one row into the **database**. If the model fails, the server deletes the uploads and writes nothing, so a broken count never reaches the log.
6. **The reveal.** The verdict goes back to the browser. The predicted box glows, the camera eases toward it, and a rubber stamp thunks down: "VOTED · GREEN CURRY", "ABSTAINED" or "SPOILED".
7. **Everyone sees it.** Supabase Realtime announces the new row. On `/`, the race bars reorder and the ticker says who just voted. On `/log`, the ballot slides in at the top of the wall. Visitors can mark the model's call 👍 or 👎.

## 3. The parts, one by one

### 3.1 The AI model: ClearVote

**Repo:** [github.com/VecetyP/U-Hackathon-Demo-ClearVote](https://github.com/VecetyP/U-Hackathon-Demo-ClearVote) (the ML team's work)

This is the brain of the project. ClearVote is a computer-vision engine built with OpenCV that reads a photo or scan of a Thai election-style ballot, classifies each box as `VALID`, `INVALID` or `EMPTY`, and rules on the whole ballot like an election official would. It needs no OCR service and no GPU.

How it reads a ballot (details in the ClearVote README):

1. **Normalize** the image: downscale, fix dark images, warn on blur.
2. **Find the boxes** from the ballot's printed lines. Pixel positions are never hard-coded, and printed name and number cells are filtered out.
3. **Find the abstain box**, which sits apart from the candidate grid.
4. **Isolate the ink** in each box, erasing the printed border.
5. **Classify the mark by its shape.** The mark is reduced to a skeleton, and the classifier counts where strokes cross. Exactly one four-way crossing inside the box is a valid X (or +). A tick, a circle, a star, two crosses, or a cross with writing next to it is invalid.
6. **Look for stray marks**: pen ink outside every box.
7. **Rule on the ballot:**
   - **Spoiled (`-1`):** any invalid box, two or more marked boxes, or any stray mark
   - **Vote (`1`–`26`):** exactly one valid cross in a candidate box
   - **Abstained (`0`):** only the abstain box is marked, or nothing is marked

Its HTTP API (from the team's `server.py`):

```
POST /evaluate?first_number=1     multipart image
  → { "output": 25,
      "analysis": { "verdict", "reason", "marks": [...], "boxes_detected", "warnings", "image": "<base64>" } }
GET  /health                       → { "ok": true }
```

**How we run it.** The model lives in a separate Vercel project, `ballot-model`, at https://ballot-model.vercel.app. Full deploy and update steps are in [model-server/README.md](model-server/README.md).

- `model-server/` is that Vercel project. Deploy from there.
- `model-server/U-Hackathon-Demo-ClearVote/` is a clone of the team's repo, used **unchanged**.
- `model-server/api/index.py` is our thin wrapper. It imports the repo's `server.py` and `ballot.py` directly, serves them as a Vercel Python function, and adds an `X-API-Key` check so only our website can use it.
- **Updating to the team's latest model** is a pull and a deploy. The URL stays the same, so the website needs no change:

  ```powershell
  cd model-server\U-Hackathon-Demo-ClearVote; git pull; cd ..
  npx vercel deploy --prod --yes
  ```

- **Boxes are numbered by position.** The pipeline normally reads the printed candidate number next to each box. On our ballot its digit reader still slips: at commit `7b5a18f` it got 27 of 29 test ballots right and read box 6 as 5. Position numbering (left column 1–13, right column 14–26) is right on every box, so the wrapper turns the digit reader off. If the team fixes the reader, delete the single `ballot.read_number = ...` line in `api/index.py`.
- The wrapper also turns the model's annotated PNG into a JPEG (about 260 KB instead of 825 KB) and adds a `Server-Timing` header so slow requests can be told apart from cold starts.
- Expect about 5 s per ballot from a home connection, plus a few seconds on a cold start. The pipeline itself takes about 0.8 s; the rest is moving the images.

### 3.2 The website: three pages

| Page | Name | What happens there |
|---|---|---|
| `/` | **The Count** | Live podium of the top 3, race bars for all 26 dishes that reorder as votes arrive, a live ticker, and stat tiles (total, abstained, spoiled, average model time) |
| `/vote` | **The Booth** | The ballot canvas: draw with pen, finger or mouse, pinch to zoom, three pen colors, an eraser that removes whole strokes, undo and redo. Challenge cards suggest ways to trick the model. Then the cast animation and the verdict stamp. |
| `/log` | **The Ballot Box** | A wall of every ballot with its verdict stamp. Filter by verdict, dish or "model wrong", open any ballot to see the model's annotated view, its reasoning and its marks, and give 👍 / 👎 |

Stack: Next.js 15 (App Router, TypeScript), Tailwind CSS v4, `motion` for animation, `perfect-freehand` for natural ink, `zod` to validate everything the model returns.

### 3.3 The website's server: the routes

| Route | What it does |
|---|---|
| `POST /api/ballots` | The pipeline in section 2: checks the image is a 2400 × 2880 JPEG, calls the model and uploads to Storage in parallel, saves the model's image, inserts the row, returns it. Limits each visitor to 10 ballots a minute. |
| `PATCH /api/ballots/[id]` | Saves 👍 / 👎 feedback on a ballot |
| `GET /api/health` | Pings the model's `/health`. The pages call it on load to wake the model up before anyone casts. |

The code that talks to the model is [lib/model-api.ts](lib/model-api.ts). It checks the model's answer with zod: if `output` is missing or outside -1..26, that is a **model error**, never a spoiled ballot.

### 3.4 The database and image store: Supabase

- **Table `ballots`:** one row per ballot with the verdict (`prediction`), the confidence of the deciding mark, the model's reasoning and marks (`analysis`), timing, an optional nickname, feedback, and a `hidden` flag for moderation.
- **Views:** `rankings` (votes per dish) and `ballot_stats` (totals for the stat tiles). Both skip hidden ballots.
- **Security:** row-level security lets anyone read visible ballots. Nobody but the server can write.
- **Realtime:** new rows are pushed live to the home page and the log.
- **Storage bucket `ballots`** (public read): `full/{id}.jpg` (the ballot), `thumb/{id}.jpg` (600 px), `processed/{id}.jpg` (the model's annotated view).

Everything is defined in [supabase/schema.sql](supabase/schema.sql).

---

## 4. Running it locally

You need **Node 24**.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | What to put there |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The project URL, `https://<project-ref>.supabase.co` (Supabase → Project Settings → API). **This is a URL, not a key.** Pasting a key here breaks everything. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The `anon` / publishable key. Safe in the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | The `service_role` / secret key. Server only, never commit it. |
| `MODEL_API_URL` | `https://ballot-model.vercel.app`, or `http://localhost:8000` for a model running on your machine |
| `MODEL_API_KEY` | The shared key. Must match `MODEL_API_KEY` in the `ballot-model` Vercel project. Leave it empty only if the model has no key set. |
| `MOCK_MODEL` | `true` = don't call the model, return random verdicts after 1.2–2.5 s. `false` = use the real model. |
| `MOCK_PROCESSED` | Mock mode only: `true` also returns a fake "model's view" image. |

Then:

```bash
npm run dev
```

Open http://localhost:3000.

- **No model?** Set `MOCK_MODEL=true`. The whole site works with random verdicts (about 10% spoiled, 10% abstained).
- **No Supabase yet?** In development only, if the Supabase variables are empty, casting does a **dry run**: the model reads the ballot and you see the verdict, but nothing is saved. In production this is an error instead.
- **Model on your own machine?** In `model-server/U-Hackathon-Demo-ClearVote/`, run `pip install -r requirements.txt` and `python server.py`, then set `MODEL_API_URL=http://127.0.0.1:8000` and leave `MODEL_API_KEY` empty (the team's server has no key check).

## 5. Setting up Supabase

1. Create a Supabase project and fill in the three Supabase variables above.
2. Open **SQL Editor**, paste all of [supabase/schema.sql](supabase/schema.sql) and run it. It creates the table, the views, row-level security, realtime and the public storage bucket. It is safe to re-run, and re-running it adds newer columns (`processed_path`, `analysis`) to an older table.
3. Check everything:

   ```bash
   npm run check:supabase
   ```

   [scripts/check-supabase.mjs](scripts/check-supabase.mjs) confirms that the table and columns exist, the anon key can read the views but **can't** insert, Storage upload, public URLs and delete work, and realtime connects. It ends with "All good. Supabase is ready." or lists what failed.

## 6. Moderation

Anyone can draw anything, and the log is public. To take a ballot down: Supabase → **Table Editor** → `ballots` → set `hidden` to `true` on that row. It disappears from the log, the ranking and the stats everywhere. Set it back to `false` to restore it.

## 7. Deploying the website to Vercel

Import this folder as a Vercel project (framework: Next.js) and set these environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
MODEL_API_URL=https://ballot-model.vercel.app
MODEL_API_KEY=...            # the same value as in the ballot-model project
MOCK_MODEL=false
```

`NEXT_PUBLIC_*` values are built into the pages, so redeploy after changing them. **`MODEL_API_KEY` must be identical in both Vercel projects** (the website and `ballot-model`). If they differ, the model answers 401 and every ballot jams.

## 8. Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm test` | Unit tests (vitest): canvas export coordinates, ballot geometry, model response parsing, processed images, ranking data |
| `npm run check:supabase` | Verify the Supabase setup |

## 9. Troubleshooting

**"The counting machine jammed"** on `/vote`: the model call failed. Nothing was saved and the drawing is kept. The server log line `[ballots] predict failed: ...` says why:
- `Model unreachable` or a timeout: wrong `MODEL_API_URL`, or the model is down. Open https://ballot-model.vercel.app/health.
- `Model returned 401`: `MODEL_API_KEY` doesn't match the model project.
- `Bad model response`: the model answered in an unexpected shape, or `output` was outside -1..26.
- `MODEL_API_URL is not set` while `MOCK_MODEL=false`.

**A hand-drawn X comes back "Spoiled"** with the reason "not two lines crossing (arms don't line up)": that is the model's decision, not an app bug. Since commit `ac89e20` the team's X classifier is stricter, so some X's with curved strokes count as spoiled. Two straighter strokes that cross in the middle of the box read as a vote.

**"Couldn't record the ballot"**: the model worked but saving the row failed. The usual cause is a column missing from an older table. Re-run [supabase/schema.sql](supabase/schema.sql), then `npm run check:supabase`.

**"Couldn't store the ballot"**: the image upload failed. Check that the `ballots` bucket exists and the service key is right (`npm run check:supabase`).

**"The ballot box isn't set up yet"** (production only): the Supabase variables are missing in Vercel.

**Avast on Windows**: its HTTPS scanning intercepts secure connections. It broke the `gcloud` CLI and made local uploads to Supabase very slow. Turn off HTTPS scanning, or add an exception, while you develop.

## Credits

- **AI model:** the ClearVote ballot verification engine by the ML team, [VecetyP/U-Hackathon-Demo-ClearVote](https://github.com/VecetyP/U-Hackathon-Demo-ClearVote)
- **Website, booth and live count:** this repo
