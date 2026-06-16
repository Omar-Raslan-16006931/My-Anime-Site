# Handoff: AniWave — Show Detail Page (Fusion direction) + Long-Runner Episode Browser

## Overview
A redesign of the AniWave anime/TV **show detail page**: a cinematic, immersive hero
followed by a season-aware episode list. Includes a dedicated pattern for **very long
series** (e.g. One Piece, 1–1165 episodes) using saga tabs, paged ranges, and
jump-to-episode.

The recommended production direction is **"Fusion"** (labeled **D** in the prototype):
a full-bleed immersive hero with an electric violet/cyan palette and **image-based
episode rows**. The prototype file also contains three earlier explorations (A
Atmosphere, B Frame, C Spotlight) for reference only — **build the Fusion direction**.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes that
show the intended look and behavior. They are **not production code to copy directly**.
The HTML uses inline styles and a small custom runtime purely so the prototype renders;
none of that should ship.

Your task is to **recreate these designs in the target codebase's existing environment**
(React, Vue, Svelte, SwiftUI, etc.) using its established components, design tokens,
routing, and data layer. If no front-end environment exists yet, choose the most
appropriate framework for the project and implement the designs there. Wire the episode
data, posters/stills, and "continue watching" progress to real APIs — in the prototype
they are placeholders.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, radii, shadows, and interactions
are all final and intentional. Recreate the UI to match, mapping the literal values
below onto the codebase's token system where one exists.

---

## Design Tokens

### Colors
| Token | Value | Usage |
|---|---|---|
| Page background | `#0a0a10` | App / card base |
| Hero gradient stops | `#16122a` → `#0b0b12` → `#0a0c10` | Diagonal hero base (120deg) |
| Accent violet | `#9d86ff` | Primary accent, gradients, active states |
| Accent cyan | `#5ec6ec` / `#46c8e8` | Secondary accent, gradient partner |
| Accent gradient | `linear-gradient(135deg, #9d86ff, #5ec6ec)` | Primary buttons, play affordances |
| Accent text (light) | `#a99cff` / `#c7bdff` | Eyebrows, accent labels, chips |
| Text primary | `#ffffff` | Titles |
| Text body | `#b4b2c4` | Synopsis / paragraph |
| Text muted | `#8e8ca0` | Meta lines (mono) |
| Text dim | `#9b99a8` | Inactive nav |
| Status green | `#6fe0a8` | "Returning"/"Ongoing" dot |
| Milestone gradient | `linear-gradient(135deg, #ffd76a, #ffb14a)` | Landmark-episode badge |
| Surface (glass) | `rgba(255,255,255,0.05)` fill, `rgba(255,255,255,0.10)` border | Search, tiles, tabs, pager |
| Row surface | `rgba(255,255,255,0.018)` fill, `rgba(255,255,255,0.06)` border | Episode rows |
| Row hover | `rgba(157,134,255,0.07)` fill, `rgba(157,134,255,0.30)` border | Episode row hover |

### Typography
- **Display / UI sans:** `Space Grotesk` (400/500/600/700) — titles, body, buttons.
- **Mono (labels/meta):** `JetBrains Mono` (400/500) — eyebrows, episode badges, meta
  lines, page counters. Used uppercase with `letter-spacing: 0.06em–0.3em`.
- Hero title: 150px / `line-height: 0.84` / weight 700 / `letter-spacing: -0.045em`
  (FROM). One Piece hero: 76px / `0.9` / 700 / `-0.04em`.
- Section H2: 36px (detail) / 26px (OP range header) / weight 700 / `-0.02em..-0.025em`.
- Episode title: 21px (detail rows) / 16px (OP rows) / weight 600 / `-0.01em`.
- Eyebrow (mono): 12px / `letter-spacing: 0.3em` / uppercase / accent violet.
- Meta (mono): 12–13px / muted `#8e8ca0`.

### Spacing / Radius / Shadow
- Card radius: **24px** (outer frame), **18px** (episode rows), **14px** (buttons,
  stills), **11–13px** (tabs, pager buttons, chips → `999px` for genre pills).
- Hero height: **760px**. Detail still: **300×170**. OP still: **176×99**. OP poster: **150×222**.
- Card content padding: hero `0 56px 54px`; episode section `50px 56px 66px`;
  OP body `0 48px`.
- Card shadow: `0 50px 130px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.045)`.
- Primary button shadow: `0 12px 44px rgba(140,120,255,0.4)`; hover lifts `-2px` and
  deepens to `0 18px 54px rgba(140,120,255,0.55)`.
- Glass surfaces use `backdrop-filter: blur(14–16px)`.

---

## Screens / Views

### 1. Show Detail — Hero (Fusion / D)
- **Purpose:** Establish the show, let the user resume/play, add to list, pick a source.
- **Layout:** Full-bleed hero, 760px tall, content anchored bottom-left in a max-width
  780px column. Top nav overlaid (logo + Home/Anime/TV/Movies/List + glass search +
  avatar). Animated background: layered radial glows (violet top-right, cyan top-left)
  over a 120° dark gradient, plus a faint SVG noise overlay at 6% opacity; a 3-stop
  vertical scrim and a left-to-right scrim keep text legible.
- **Components:**
  - **Eyebrow** (mono, violet `#a99cff`): `Series · 2022 · TV-14`.
  - **Title** `FROM` — 150px, white, text-shadow `0 14px 64px rgba(70,40,150,0.5)`.
  - **Meta row:** ★ 8.5 · 4 Seasons · 40 Episodes · ● Returning (green dot, glow).
  - **Genre pills:** Mystery / Drama / Sci-Fi & Fantasy — violet-tinted, `999px`.
  - **Synopsis:** body `#b4b2c4`, 16px/1.66, max-width 630px, `text-wrap: pretty`.
  - **Actions:** Primary "Resume · S1 E1" (accent gradient, play glyph). Secondary
    "My List" (glass) — **toggles** to "In Your List" with a violet check. Round
    share button (glass).
  - **Sources row** (toggleable): mono "SOURCES" label + 4 glass chips with a download
    glyph — **DLHub, VideoDownloader, Nyaa, 1337x**. Hover → violet border + text.

### 2. Show Detail — Episodes (Fusion / D)
- **Purpose:** Browse and play episodes within a season.
- **Layout:** Below the hero, on `#0a0a10`. Header row: left = season eyebrow +
  "Episodes" H2; right = **season switcher** (segmented control in a glass pill,
  Season 1–4). Episode list = vertical stack, `gap: 12px`.
- **Episode row:** 300×170 still (rounded 14) with an "EP n" mono badge top-left;
  title (21px/600) + optional **CONTINUE** tag; mono meta line (`date · runtime`);
  synopsis (toggleable). Trailing 54px round play button. Hover: row tints violet,
  border violet, shifts `translateX(5px)`, play button fills with accent gradient.
- **Continue-watching:** first episode shows a progress bar pinned to the bottom of the
  still (track `rgba(255,255,255,0.28)`, fill = accent gradient at a % width) and the
  CONTINUE tag.

### 3. Long-Runner Episode Browser (One Piece, 1–1165)
- **Purpose:** Make a 1000+ episode series navigable. This is the key pattern.
- **Layout (top→bottom):**
  1. **Compact hero:** 150×222 poster (rounded 16) + eyebrow `Anime · 1999– ·
     Action / Adventure` + title `ONE PIECE` (76px) + meta (★ 9.0 · **1,165** episodes ·
     11 sagas · ● Ongoing · weekly) + a "Resume EP 1089" primary button.
  2. **Saga tabs:** horizontally scrollable row of 11 tabs. Each tab is two-line:
     saga **name** + mono **EP range**. Active tab = violet/cyan gradient fill, violet
     border, glow. (See saga table below.)
  3. **Range header bar:** left = "Episode {start}–{end}" H2 + mono saga name; right =
     **jump-to-episode** input (number 1–1165 + Go) and a **pager** (prev / "Page x / y"
     / next). Disabled pager buttons drop to `opacity: 0.32` + `pointer-events: none`.
  4. **Episode grid:** **2 columns** of compact image rows (`gap: 12px`). Each row:
     176×99 still + "EP n" badge, title, mono meta (`{Arc} Arc · Subbed · Dubbed ·
     ~24 min`), trailing 44px round play. **Milestone** episodes show a gold "★
     MILESTONE" badge; the in-progress episode shows CONTINUE + progress bar.

#### Saga model (name → inclusive episode range)
| # | Saga | Range |
|---|---|---|
| 0 | East Blue | 1–61 |
| 1 | Alabasta | 62–135 |
| 2 | Sky Island | 136–206 |
| 3 | Water 7 | 207–325 |
| 4 | Thriller Bark | 326–384 |
| 5 | Summit War | 385–516 |
| 6 | Fish-Man Island | 517–574 |
| 7 | Dressrosa | 575–746 |
| 8 | Whole Cake Island | 747–889 |
| 9 | Wano Country | 890–1085 |
| 10 | Final Saga | 1086–1165 |

#### Milestone episodes (gold badge)
`1`, `377`, `1000`, `1015`, `1071`, `1086` — in production, source these from a
per-show "landmark episodes" list rather than hard-coding.

---

## Interactions & Behavior
- **Season switch (detail):** selecting a season replaces the episode list with that
  season's episodes; active tab gets the gradient fill. No animation required beyond
  the default; a short fade is a nice-to-have.
- **My List toggle:** flips button label/icon between "My List" (plus) and "In Your
  List" (violet check). Persist to the user's list via API.
- **Saga tab (OP):** sets the active saga AND resets the page to 0 (first range of that
  saga).
- **Pager (OP):** prev/next move one page of **12** episodes within the current saga;
  clamp at first/last page; disabled state as above. Page count =
  `ceil((end - start + 1) / 12)`.
- **Jump-to-episode (OP):** parse the integer; ignore if outside 1–1165. Find the saga
  whose range contains it, then set page = `floor((n - sagaStart) / 12)`. Triggers on
  the Go button and on Enter in the field.
- **Hover states:** rows lift/tint violet; play buttons fill with the accent gradient
  and scale `1.06`; source chips and nav items shift to violet. All transitions
  ~`0.15s–0.22s ease`.
- **Range label:** "Episode {start}–{end}" where end = `min(start + 11, sagaEnd)`.

## State Management
- `season` (detail): which season's list is shown (1–4).
- `addedToList` (detail): My List boolean.
- `currentSaga` (OP): saga index (0–10).
- `currentPage` (OP): page within the saga (0-based).
- Derived (compute, don't store): visible episode range, page count, pager
  enabled/disabled, range label, whether each episode is a milestone / the
  continue-watching episode.
- **Data fetching:** episode lists per season/range, poster + still image URLs, and
  per-episode watch progress should come from the real API. Lazy-load stills as ranges
  page in (1000+ episodes — never fetch all at once; the saga+page windowing already
  paginates this for you).

## Assets
- **No baked-in art.** Posters and episode stills are drop-in placeholders in the
  prototype (`<image-slot>`). Wire them to real CDN/image URLs. Use the codebase's
  existing image component (lazy loading, blur-up, aspect-ratio boxes).
- **Icons** are inline SVGs (play, plus, check, search, share, chevrons, download).
  Replace with the codebase's icon library — shapes/stroke-widths documented inline in
  the HTML if you need to match exactly.
- **Fonts:** Space Grotesk + JetBrains Mono (Google Fonts). Swap to the site's families
  if it has an established type system; otherwise import these.

## Files
- `AniWave Detail.dc.html` — the full prototype (frames A/B/C/D + One Piece browser).
  **Build the D "Fusion" frame and the One Piece browser.** A/B/C are prior
  explorations, included only for context.
- `image-slot.js` — prototype-only helper backing the drag-and-drop image placeholders.
  **Do not port** — replace with the codebase's real image component.

> Tip for Claude Code: open `AniWave Detail.dc.html` and search for the comment markers
> `Fusion` and `One Piece` to jump straight to the two frames to implement. The episode/
> saga/pager/jump logic is all in the `<script>` logic class at the bottom of the file
> (`opSagas`, `opRows`, `opPager`, `jumpToEp`, `tabs`, `episodesFor`).
