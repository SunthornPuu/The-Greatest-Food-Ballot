# The Greatest Food Ballot — Build Brief

You are building the web front end for a hackathon demo (U-Hackathon 2026). Our team has an AI model that reads a photo of a paper ballot and returns the candidate that was voted for. This app is a **voting playground**: anyone can draw on a digital copy of our ballot, submit it, and watch the model read it. Every submission goes into a public log, and the classified votes feed a live food ranking.

Read this whole file before writing code. Build in the phases at the bottom, and check off each phase's acceptance list before moving on.

---

## 1. Product in one paragraph

Three pages. **Home** shows the live food ranking and sends people to vote or browse the log. **Vote** shows our real ballot image; the user draws on it with a finger, pen or mouse, then submits. The model reads it and the result is revealed with a satisfying "counting" moment. **Log** is a public wall of every submitted ballot with the model's verdict on each one. The real goal is for people to *try to fool the model*, so the UI should invite experimentation, not just one polite vote.

## 2. Tech stack (fixed)

- Next.js 15 (App Router), TypeScript (strict), deployed on **Vercel**
- Tailwind CSS v4
- `motion` (Framer Motion) for animation and layout transitions
- `@supabase/supabase-js` for database, storage and realtime
- `perfect-freehand` for natural-looking ink strokes
- `zod` to validate every response coming from the model API
- No component kit is needed. Build the components by hand so the look is our own. `lucide-react` is fine for icons.

## 3. The ballot (source of truth)

- File: `public/ballot.jpg`. This is our original ballot image, **2400 × 2880 px**. Never resize, crop or recompress it.
- The model was built around this exact layout, so **the submitted image must be the ballot at native 2400 × 2880 with the user's strokes composited on top, and nothing else** (no UI, no zoom, no padding).
- To vote, put an **X** in a "box to mark". To abstain, put an X in the box in the bottom pink band.

### Candidates (`lib/candidates.ts`)

| # | Dish | Emoji | # | Dish | Emoji |
|---|---|---|---|---|---|
| 1 | Pad Thai | 🍜 | 14 | Grilled Pork Neck | 🥩 |
| 2 | American Fried Rice | 🍳 | 15 | Thai Grilled Chicken | 🍗 |
| 3 | Tom Yum Goong (Spicy Shrimp Soup) | 🦐 | 16 | Thai Omelet | 🥚 |
| 4 | Tom Kha Gai (Coconut Chicken Soup) | 🥥 | 17 | Thai Five-Spice Braised Eggs | 🥚 |
| 5 | Green Curry | 🟢 | 18 | Boat Noodles | 🛶 |
| 6 | Massaman Curry | 🥔 | 19 | Thai Tom Yum Noodle Soup | 🍲 |
| 7 | Sour Curry | 🍋 | 20 | Thai Glass Noodle Salad | 🥗 |
| 8 | Panang Curry | 🍛 | 21 | Thai Fried Fish with Fish Sauce | 🐟 |
| 9 | Red Curry with Roasted Duck | 🦆 | 22 | Gaeng Tai Pla | 🌶️ |
| 10 | Hainanese Chicken Rice | 🍚 | 23 | Hang Lay Curry | 🫕 |
| 11 | Braised Pork Leg on Rice | 🐖 | 24 | Spicy Thai Prawn Salad | 🦞 |
| 12 | Shrimp Paste Fried Rice | 🍤 | 25 | Thai Fish Cakes | 🍥 |
| 13 | Thai Chicken Biryani | 🍛 | 26 | Mango Sticky Rice | 🥭 |

The emojis are placeholders. Keep them in one map so they can be swapped for illustrations later.

### Model output codes

| Value | Meaning | UI label |
|---|---|---|
| `1`–`26` | Vote for that candidate | "Voted for {dish}" |
| `0` | No vote / abstained | "Abstained" |
| `-1` | Invalid (spoiled) ballot | "Spoiled ballot" |

### Box geometry (native px, measured from `ballot.jpg`)

This is used **only for UI effects**, such as highlighting the predicted box during the reveal, zooming to a row, and drawing overlays in the log. The model does its own reading. Never use these coordinates to guess or override the model's result.

```ts
// lib/ballot-geometry.ts
export const BALLOT = { width: 2400, height: 2880 };
const ROW_TOP_0 = 679, ROW_PITCH = 142, ROW_H = 124;
const COL_LEFT = { x: 841, w: 241 };   // candidates 1–13
const COL_RIGHT = { x: 1979, w: 240 }; // candidates 14–26
export function markBox(candidate: number) {
  if (candidate === 0) return { x: 1693, y: 2698, w: 240, h: 123 }; // abstain box
  if (candidate < 1 || candidate > 26) return null;
  const col = candidate <= 13 ? COL_LEFT : COL_RIGHT;
  const row = (candidate - 1) % 13;
  return { x: col.x, y: ROW_TOP_0 + row * ROW_PITCH, w: col.w, h: ROW_H };
}
// Dish-name cells sit to the left of each mark box: left x≈437–822, right x≈1574–1960.
```

## 4. Architecture

```
Browser ──► Next.js Route Handler  POST /api/ballots   (runs on Vercel)
               ├─► FastAPI on Google Cloud Run   POST /predict  → { prediction, ... }
               ├─► Supabase Storage  bucket "ballots" (full image + thumbnail)
               └─► Supabase Postgres table "ballots" (insert row)
Browser ◄── Supabase (anon key, read-only): ranking view, ballot list, realtime inserts
```

Why the route goes through Next: the Supabase service key and model URL stay on the server, the ML team's FastAPI only has to do inference (no DB code), and failures are handled in one place.

### 4.1 FastAPI contract (give this to the ML team)

```
POST {MODEL_API_URL}/predict
  Headers: X-API-Key: {MODEL_API_KEY}          (optional shared secret)
  Body: multipart/form-data, field "file" = image/jpeg (2400×2880)
  200 → {
    "prediction": int,            // -1 | 0 | 1..26   (required)
    "confidence": float | null,   // 0..1, top-class probability (optional)
    "scores": { "1": 0.91, ... } | null,  // optional per-class probabilities
    "model_version": string,      // e.g. "ballot-cnn-v3"
    "processed_image": string | null,  // optional: base64 (raw or data URL) PNG/JPEG of the model's view
    "processed_mime": string | null    // optional hint; the server sniffs magic bytes anyway
  }
  4xx/5xx → { "detail": string }

GET {MODEL_API_URL}/health → { "status": "ok" }   // used to warm Cloud Run
```

The frontend must work if `confidence`, `scores`, `model_version` and `processed_image` are missing. When `processed_image` is present, the route decodes it and stores it as `processed/{id}.{jpg|png}` (column `processed_path`); a broken image is logged and skipped, never fatal. Validate the response with zod. If `prediction` is missing or outside -1..26, treat the request as a model error, not as a spoiled ballot.

### 4.2 Our route handler: `app/api/ballots/route.ts`

- `export const runtime = 'nodejs'; export const maxDuration = 60;` (Cloud Run cold starts can be slow)
- Accepts multipart with `image` (JPEG 2400×2880, quality 0.9, about 1 MB) and `thumb` (JPEG, 600 px wide). The client builds both. Keep the total well under Vercel's 4.5 MB body limit.
- Steps: call `/predict` and upload both files to Storage **in parallel** → insert the row → return the row JSON. Measure `latency_ms` around the predict call.
- If predict fails, return 502 with a friendly message, delete the uploaded files and **don't insert a row**.
- Mock mode: when `MOCK_MODEL=true`, skip the API call and return a random prediction after 1.2–2.5 s, weighted so -1 and 0 appear about 10% each. The whole UI must be buildable and demoable before the model is deployed.
- `GET /api/health` proxies the model's `/health`. Home and Vote call it once on load to wake the Cloud Run container.

### 4.3 Supabase setup (put this in `supabase/schema.sql`)

```sql
create table public.ballots (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  image_path    text not null,
  thumb_path    text not null,
  prediction    smallint not null check (prediction between -1 and 26),
  confidence    real,
  scores        jsonb,
  model_version text,
  latency_ms    integer,
  nickname      text check (char_length(nickname) <= 24),
  feedback      smallint check (feedback in (-1, 1)),   -- 👍 = 1, 👎 = -1
  hidden        boolean not null default false           -- moderation switch
);

create view public.rankings as
  select prediction as candidate, count(*)::int as votes
  from public.ballots
  where hidden = false and prediction between 1 and 26
  group by prediction;

create view public.ballot_stats as
  select count(*)::int as total,
         count(*) filter (where prediction = 0)::int  as abstained,
         count(*) filter (where prediction = -1)::int as spoiled,
         round(avg(latency_ms))::int as avg_latency_ms
  from public.ballots where hidden = false;

alter table public.ballots enable row level security;
create policy "public read" on public.ballots for select using (hidden = false);
-- No insert/update policies: only the server (service role) writes.

alter publication supabase_realtime add table public.ballots;
```

- Storage bucket `ballots`, public read. Paths: `full/{id}.jpg` and `thumb/{id}.jpg`.
- The client merges `rankings` with the full candidate list, so dishes with 0 votes still appear.
- Moderation: anything can be drawn and the log is public, so someone will draw something rude. Setting `hidden = true` in the Supabase dashboard removes it everywhere. Mention this in the README.

### 4.4 Environment variables (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server only, never import into client code
MODEL_API_URL=                  # e.g. https://ballot-model-xxxx.a.run.app
MODEL_API_KEY=                  # optional
MOCK_MODEL=true
```

## 5. Design direction

**Concept: "Election night at the food court."** The look takes the civic ritual of voting (ballot boxes, stamps, the count, the results board) and plays it with bubblegum-pink food-stall energy. The ballot is the hero object on every page. The UI should feel like a physical thing: paper, ink, rubber stamps, a ballot box slot.

This needs to be a designed product, not a generic template. Avoid: purple gradients, glassmorphism cards, a centered hero with two buttons and nothing else, default Tailwind grays, and emoji used as decoration everywhere.

### Tokens (taken from the ballot)

```css
--paper:       #FEC5E8;  /* ballot background, main page bg */
--paper-deep:  #FFB5E6;
--cell:        #FDDCF0;  /* ballot name cells, card surfaces */
--hot:         #FF65C3;  /* ballot footer band: primary accent, CTAs */
--ink:         #140710;  /* text, borders: the ballot's black lines */
--white:       #FFFFFF;  /* mark boxes, input surfaces */
--ballpoint:   #1F3FBF;  /* default pen color, like a real ballot pen */
--stamp-void:  #D7263D;  /* "Spoiled" stamp */
--stamp-skip:  #6B5A66;  /* "Abstained" stamp */
```

- Borders: 3 px solid `--ink` with square or slightly rounded (6 px) corners, echoing the ballot's table cells. Use hard offset shadows (`4px 4px 0 var(--ink)`), not blurry ones.
- Type: **Bricolage Grotesque** (700–800) for display, which echoes the ballot's chunky title. **DM Sans** for UI text. **JetBrains Mono** for machine data such as confidence, latency, model version, IDs and timestamps. That contrast between human text and machine data is part of the story.
- Provide a dark mode as "night count": `--ink` background, `--hot` accents, and the ballot itself staying pink paper. Respect `prefers-reduced-motion` everywhere by swapping motion for simple fades.

### Recurring motifs

- **Rubber stamps** for verdicts: rotated −6° to −12°, a slightly rough edge (SVG filter or mask), and a short "thunk" animation (scale 1.4 → 1, small screen shake). Variants: hot pink "VOTED · #5 GREEN CURRY", grey "ABSTAINED", red "SPOILED".
- **Ballot box**: one simple illustrated box with a slot, built in SVG. It appears on Vote (submit animation) and in the Log header.
- **Ticket numbers**: every ballot gets a short display ID (`#A3F9`, from the first 4 characters of its uuid) shown in mono.

## 6. Pages

### 6.1 Home `/` — "The Count"

- **Header strip:** the title "The greatest food ballot", the subtitle "hosted by the best looking team of U-Hackathon 2026", and a small blinking red "LIVE" dot.
- **Podium:** the top 3 dishes on stepped blocks with their emoji/illustration, vote count and share %. A change in leader triggers a confetti burst in pink/ink only.
- **The race:** all 26 dishes as horizontal bars, ranked. Use `motion` layout animations so bars **re-order smoothly** when a realtime insert arrives, and the bar that just got a vote flashes. Show the top 10 by default with "show all 26" to expand.
- **Live ticker:** a thin marquee or toast stack of recent events, e.g. "#A3F9 voted Mango Sticky Rice 🥭 · 4s ago" or "#9C01 was spoiled 🗑️". Fed by Supabase realtime.
- **Stat tiles:** total ballots, abstained, spoiled, and average model time (in mono).
- **Two big CTAs**, styled like physical objects, not plain buttons: "✏️ Cast a ballot" (looks like a ballot sheet) and "🗳️ Open the ballot box" (goes to Log).
- **Empty state** (0 votes): an empty podium with "No votes yet. The polls are open." and the CTA.

### 6.2 Vote `/vote` — "The Booth"

**Layout**
- Desktop: the ballot canvas on the left (fits the viewport height). On the right, a narrow panel holds the tools, the challenge cards and the submit button.
- Mobile: a full-bleed canvas with a **bottom tool dock** within thumb reach, and a sticky submit button.

**Canvas (the most important component; make it excellent)**
- Two layers: the base ballot image (never modified) and a transparent ink layer stored as vector strokes in ballot coordinates (2400×2880 space). Render with `perfect-freehand`.
- Use Pointer Events for mouse, touch and stylus alike. Use pressure when the device reports it. Set `touch-action: none` on the canvas.
- **One pointer draws. Two pointers pan and pinch-zoom** (0.5× to 4×). On a phone the mark boxes are tiny at fit-to-screen, so zoom is essential, not optional.
- Double-tap or double-click zooms in on the area tapped. A "fit" button resets the view.
- On first visit, show a one-time coach mark: "Pinch to zoom · one finger to draw".
- Tools:
  - Pen in 3 colors: ballpoint blue (default), ink black, hot pink
  - 3 widths (thin is the default, sized for an X in a box at about 1× zoom)
  - Eraser that removes **whole strokes it touches**, from the ink layer only; the ballot can never be erased
  - Undo and redo (also Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z)
  - Clear, which needs a hold-to-confirm or a confirm popover
- Keep the canvas sharp on high-DPI screens with `devicePixelRatio` scaling.
- Export: draw `ballot.jpg` at 2400×2880 on an offscreen canvas, replay all strokes at native scale, then save as JPEG (quality 0.9) plus a 600 px wide thumbnail. Unit-test that strokes land at the same native coordinates regardless of zoom.

**Challenge cards**
This is a playground, so a row of small cards suggests ways to test the model. Tapping one shows the tip. It doesn't auto-draw anything.
- "Classic: one clean X"
- "Double trouble: mark two boxes"
- "Outside the lines: X next to the box"
- "Tiny X"
- "Abstain properly"
- "Doodle chaos"
- "Tick ✓ instead of X"

Each card has a one-line hint about what a correct model *should* answer (e.g. "Two marks → should be spoiled (-1)").

**Optional sign-off:** "Sign your ballot" with a nickname input of 24 characters max, which is shown in the log.

**Submit flow** (the signature moment; choreograph it carefully)
1. Press **"Cast ballot"**. The button is disabled while the canvas is empty, with the hint "Mark the ballot first". (Submitting a blank ballot on purpose is allowed through a small link: "submit it blank anyway".)
2. The ballot **folds in half and drops into the ballot box slot** (about 600 ms).
3. **"Counting…"**: the ballot re-appears flat with a scanning line sweeping top to bottom. Rotating mono status lines are shown: "reading marks…", "checking boxes…", "asking the model…". This loops until the API responds. After 8 s, add "waking up the counting machine (cold start)…".
4. **Reveal:** the predicted box gets a pulsing hot-pink ring (using `markBox()`), the camera eases toward it, then the **stamp thunks down** with the verdict, the dish name and emoji, and the confidence in mono if present.
5. **Result card actions:**
   - "Vote again", which keeps or clears the ink as the user chooses
   - "See it in the ballot box", which opens the log with this item highlighted
   - "Did the model get it right? 👍 / 👎", which writes `feedback` via `PATCH /api/ballots/[id]`
6. **Error:** the ballot slides back out of the box with "The counting machine jammed" and a Retry button. The user's ink is never lost on error.

Rate-limit casually on the client with a 5 s cooldown after a submit. The route can also reject more than 10 submissions per minute per IP if time allows.

### 6.3 Log `/log` — "The Ballot Box"

- **Header:** the open ballot box illustration, a total count, and filter chips: All / Voted / Abstained / Spoiled / 👎 Model wrong, plus a dish dropdown. Filters are kept in the URL search params.
- **Wall:** a responsive masonry or grid of ballot thumbnails (2 columns on mobile, up to 5 on desktop). Each card shows:
  - the thumbnail with a mini verdict stamp overlay
  - the ticket number and relative time (mono)
  - the nickname, if any
  - a confidence bar, if present
- New ballots arrive through realtime and **slide in at the top**, with a "1 new ballot ↑" pill if the user has scrolled down.
- Infinite scroll, 24 per page, with skeleton cards shaped like ballots.
- **Detail view** (bottom sheet on mobile, side drawer or modal on desktop, with the URL `/log?b={id}` so it's shareable):
  - the full image with pinch and zoom
  - an overlay outlining the predicted box
  - the verdict stamp
  - confidence, a mini chart of the top-5 `scores` if present, model version, latency, and timestamp
  - feedback buttons
  - prev/next arrows, with keyboard ← → and Esc to close
- When opened from the Vote result, highlight that card with a brief glow.

## 7. Quality bar

- Lighthouse mobile performance ≥ 85. `ballot.jpg` is preloaded on `/vote`, and thumbnails use `next/image` with Supabase as a remote pattern.
- All interactive elements are reachable by keyboard and have visible focus rings (3 px `--hot` outline). Stamps and verdicts have text alternatives for screen readers.
- Tested on iOS Safari and Android Chrome (touch drawing, pinch, no page scroll or bounce while drawing), plus desktop Chrome, Safari and Firefox.
- No layout shift when realtime items arrive.
- No secrets in client bundles. Verify that `SUPABASE_SERVICE_ROLE_KEY` is only imported in server files (`import 'server-only'`).

## 8. Suggested file structure

```
app/
  layout.tsx            fonts, theme, nav (The Count · The Booth · The Ballot Box)
  page.tsx              Home
  vote/page.tsx
  log/page.tsx
  api/ballots/route.ts          POST create
  api/ballots/[id]/route.ts     PATCH feedback
  api/health/route.ts
components/
  ballot-canvas/        BallotCanvas, useStrokes, useViewport (pan/zoom), exportBallot.ts
  stamp/ Stamp.tsx
  ballot-box/ BallotBox.tsx (SVG + fold/drop animation)
  ranking/ Podium.tsx, RaceBars.tsx, LiveTicker.tsx, StatTiles.tsx
  log/ BallotCard.tsx, BallotWall.tsx, BallotDetail.tsx, Filters.tsx
lib/
  candidates.ts  ballot-geometry.ts  supabase/{client,server}.ts  model-api.ts (zod)  verdict.ts
public/ballot.jpg
supabase/schema.sql
```

## 9. Build phases

**Phase 1: Skeleton and mock**
Scaffold the app, tokens, fonts and nav. Add `candidates.ts`, `ballot-geometry.ts`, the schema SQL, and the route handler in `MOCK_MODEL` mode with Supabase writes.
- [ ] A curl POST with an image creates a row and the files in storage.

**Phase 2: The Booth**
Build the canvas (draw, zoom, eraser, undo/redo, export), then the submit choreography and the result card.
- [ ] An exported image is exactly 2400×2880, and an X drawn while zoomed lands in the correct box.
- [ ] Works on a real phone.

**Phase 3: The Ballot Box**
Build the wall, filters, detail view, realtime and feedback.

**Phase 4: The Count**
Build the podium, race bars with live reordering, the ticker and the stats.

**Phase 5: Real model and polish**
Switch `MOCK_MODEL=false`, test against Cloud Run, then cover cold-start messaging, error states, empty states, dark mode, reduced motion, an accessibility pass, and the README with setup and moderation steps.

## 10. Open questions (ask the team; don't guess)

1. Was the model trained on clean digital renders or on phone photos of printed ballots? If it was photos, consider adding an "Upload a photo of a printed ballot" option on `/vote` as a stretch goal.
2. Does `/predict` return `confidence` and `scores`? (The UI is ready either way.)
3. Should abstained and spoiled ballots show anywhere on the Home ranking beyond the stat tiles?
