# Worlds.fm landing page: creative direction and design blueprint

**Status:** Approved direction, implementation not started · **Date:** 19 October 2026 · **Owner:** `apps/web`

## Decisions recorded

| Topic | Decision |
|---|---|
| Palette | Adopt the official brand palette below. Update AGENTS.md §8 and the README "Visual identity" table in Phase 0. |
| Photography | Wikimedia Commons, licence-verified, with attribution. Typographic or duotone placeholders where no suitable licensed image exists. See §9. |
| Scope | Build the core cut first: phases 0–4. Phases 5–8 follow only if P0 work is on track. |
| Arc UI | Not yet verified (uiarc.dev did not respond during planning). Audit in Phase 0. |

## 1. Visual concept: "Signal Cartography"

Every sound leaves rings: a record groove, an orbit, the contour lines of a map. Worlds.fm uses these concentric rings as its navigational language:

- Hero: faint contour rings behind the headline, read as a record seen from above.
- Cultural connections: the same rings become orbits around an artist.
- How it works: a single contour line draws between the steps.
- Footer: an electric-green signal sweeps across an outlined wordmark.

**Reference adaptation (Roninxx portfolio), not copying:**

| Reference trait | Worlds.fm version |
|---|---|
| Near-black UI | Green-tinted night `#08120B` with warm mint text, not pure white |
| Rounded bento cards with inset media | Rounded panels where media bleeds off one edge instead of an inset frame |
| Mono eyebrows | Mono metadata that carries meaning: index, city, evidence type |
| Outlined footer wordmark | Outlined wordmark illuminated by a pointer- or scroll-driven green signal |
| Pixel-art ornaments | None used. Replaced by contour rings and connection lines |

**Rule: green means signal.** Saturated green marks only what is interactive, live, or verified, and should cover at most about 5% of the viewport at any moment (photos excluded). Forest green and Soft Mint carry the atmosphere.

**What makes it original**

1. **Provenance as visual language.** Each connection line encodes its evidence kind through line pattern, icon, and label. The AGENTS.md trust model becomes part of the design, not a disclaimer.
2. **One motif, three readings.** Groove, orbit, and contour link music to geography without a globe cliché.
3. **Editorial serif voice.** Instrument Serif italic only for pull quotes and single accent words, which separates the identity from both Spotify and the reference.
4. **A narrative footer.** The light reads as a signal finding its world; on touch devices it is driven by scroll instead of hover.

## 2. Design tokens

### Color

The first six are official brand colors; other neutrals are derived from the background hue.

| Token | Value | Use | Contrast on `#08120B` |
|---|---|---|---|
| `--color-night` | `#08120B` | Page background | – |
| `--color-surface-1` | `#0E1912` | Raised panels | – |
| `--color-surface-2` | `#142219` | Hover and elevated panels | – |
| `--color-electric` | `#00CD37` | Primary CTA, focus ring, live/verified signal | ≈ 8.9:1 |
| `--color-vibrant` | `#46D35D` | Affinity accents, hover on green elements | ≈ 9:1 |
| `--color-fresh` | `#5DDE6C` | Primary CTA hover | ≈ 10:1 |
| `--color-mint` | `#CBF2CD` | Wordmark stroke, pull quotes, glass highlights | ≈ 16:1 |
| `--color-forest` | `#2A6E4C` | Ambient glow, map land, selected backgrounds; large decoration only | ≈ 3.1:1 (never body text) |
| `--color-text` | `#EEF6EF` | Primary text | ≈ 17:1 |
| `--color-text-2` | `#A3B5A8` | Secondary text | ≈ 8.8:1 |
| `--color-text-3` | `#8AA090` | Tertiary text, metadata. Raised from `#74877A` in the Phase 1 refinement pass: now 6.8:1 on Night, 6.4:1 on `surface-1`, 5.9:1 on `surface-2`. | 6.8:1 |
| `--color-line` | mint at 8% | Hairline borders | – |
| `--color-line-strong` | mint at 16% | Hover and focus borders | – |
| `--color-on-accent` | `#08120B` | Text on green fills (white on `#00CD37` fails at ≈ 2.1:1) | – |

### Provenance

| Kind | Line | Icon | Label |
|---|---|---|---|
| `verified` | solid, mint | check | Verified connection |
| `affinity` | dashed 4/4, vibrant | ≈ | Cultural affinity |
| `community` | dotted, text-2 | people | Community report |
| `editorial` | long dash 10/4, text | pen | Editorial perspective |

Color is never the only signal; pattern, icon, and label always accompany it.

### Typography (all OFL, loaded via `next/font`)

| Role | Font | Size | Weight / leading / tracking |
|---|---|---|---|
| Hero display | Manrope | `clamp(3rem, 9vw, 8.5rem)` | 800 / 0.92 / -0.045em |
| CTA display | Manrope | `clamp(2.5rem, 6vw, 5.5rem)` | 800 / 0.95 / -0.04em |
| Section heading | Manrope | `clamp(2.25rem, 4.5vw, 4rem)` | 700 / 1.0 / -0.035em |
| Subheading | Manrope | `clamp(1.5rem, 2.5vw, 2.25rem)` | 700 / 1.1 / -0.02em |
| Body large | Manrope | 1.125rem | 400 / 1.6 |
| Body / small | Manrope | 1rem / 0.875rem | 400–500 / 1.6 |
| Editorial accent | Instrument Serif italic | contextual | 400 |
| Eyebrow / metadata | JetBrains Mono | 0.75rem, uppercase | 500 / tracking 0.14em |
| Footer wordmark | Manrope | `clamp(3rem, 20vw, 26rem)` (was `clamp(6rem, 22vw, 26rem)`, which overflows a 390px phone) | 800 / 0.8 / -0.03em (was -0.06em, which made outlined letters cross). Changed in Phase 0 after rendering; see the Phase 4 note on overlapping glyph contours. |

### Space, layout, shape, depth

- 4px base unit. Section padding `clamp(6rem, 12vw, 11rem)`.
- Container 1280px; gutters `clamp(1.25rem, 4vw, 3rem)`; 12-column grid, gaps 16 / 20 / 24px.
- Breakpoints: 640, 768, 1024, 1280, 1536.
- Radii: `xs 8`, `sm 12`, `md 20`, `lg 28` (bento, cards), `xl 36` (search), `full`.
- Elevation: top inner highlight `inset 0 1px 0 rgb(203 242 205 / .06)` plus ambient `0 30px 80px -20px rgb(0 0 0 / .6)`.
- Z-index: content 0, raised 10, sticky 40, nav 50, overlay 60, toast 70.

### Glass

- Background `rgb(14 25 18 / .55)`, `backdrop-filter: blur(20px) saturate(160%)`.
- 1px gradient border from mint 22% to mint 4%; soft radial highlight at the top edge.
- Fallbacks: no `backdrop-filter` support → solid `surface-1` at 94%; `prefers-reduced-transparency` → solid surface.
- Used only on: navigation, hero search, carousel caption controls, orbit detail card, mobile sheets. Never on bento or gallery cards.

### Motion

- Durations: 120 / 200 / 320 / 600 / 900 / 1400ms.
- Easing: `expo.out` (`cubic-bezier(.16,1,.3,1)`) for reveals; `power2.inOut` for scrubbed scroll.
- Stagger: words 60ms, cards 50ms.

## 3. Section layouts

### 01 Hero + 02 Artist discovery

One component, not two carousels: the carousel is anchored to the base of the hero and peeks above the fold.

- **Desktop:** floating glass nav pill (about 720px, 20px from top). Centred two-line headline, with "Discover it." in an outlined-to-filled treatment. Glass search (about 640px) with example-artist chips. Carousel's first row peeks into the bottom of the viewport.
- **Mobile:** compact glass top bar with menu sheet. Headline wraps to 3–4 lines. Full-width search; chips scroll horizontally. Cards at about 78% viewport width so the next card is visible.
- **Card anatomy:** 3:4 photo with bottom scrim; name, city, genre chip, two-line cultural insight, provenance badge, "Enter world" arrow, photo credit affordance. Controls: mono "01 / 08" counter and previous/next buttons.

### 03 Six-feature bento

Features map to real P0/P1 capabilities so nothing is overclaimed.

```
Desktop (12 columns)                          Mobile (1 column, in order)
┌───────────────────────┬──────────────┐     A Search
│ A  Search a sound (7) │ B  The map   │     E A World graph
│    typing demo        │    (5 cols,  │     B The map (4:5)
├──────────┬────────────┤    3 rows,   │     D Cultural affinity
│ C Trust  │ D Affinity │    one real  │     C Provenance
│ (4)      │ (3)        │    place)    │     F Share a journey
├──────────┴────────────┴───┬──────────┤
│ E  A World, as a graph    │ F Share  │
│    (8 cols, photo + nodes)│ (4 cols) │
└───────────────────────────┴──────────┘
```

The map pin must be a sourced, verified place or carry a DEMO DATA label (AGENTS.md §5).

### 04 Cultural connections (orbit)

- **Desktop:** pinned for about 250vh. Left 4 columns: step caption, provenance legend, artist switcher. Right 8 columns: SVG with four rings (genres, places, artists, movements) around a circular portrait; glass detail card anchored to the focused node.
- **Mobile:** not pinned. Square orbit diagram, segmented tabs (Genres / Places / Artists / Movements), node cards below; tapping opens a bottom sheet with evidence.

### 05 Editorial gallery

```
Desktop
┌──────────────┬──────────┬───────┐
│ Large        │ Story    │ Quote │
│ portrait     │ panel    │(serif)│
│ (5 cols,     ├──────────┴───────┤
│  2 rows)     │ Wide landscape   │
├──────┬───────┼──────────────────┤
│Story │ Stat  │ Story + photo    │
└──────┴───────┴──────────────────┘
```

Mobile: vertical stack alternating full-bleed photos and text panels; pull quotes as large serif breaks.

### 06 How it works

Desktop: three columns (Search → Enter the World → Explore & share), linked by one contour line, each step with a small vignette. Mobile: vertical timeline with the line on the left.

### 07 Final call to action

Full-width, dim contour rings behind. Display headline (working copy: "Where does your sound live?"), a second search field, one green button. No other green in the section.

### 08 Signature footer

Link columns (Explore, Trust & privacy, Project), photo credits, artist non-affiliation note, then an enormous outlined "Worlds.fm" wordmark bleeding off both edges, then a copyright and "Back to top" bar. Mobile: same structure, stacked; the wordmark still spans the full width.

## 4. Motion storyboard

| Section | Trigger | Choreography | Reduced motion |
|---|---|---|---|
| Hero intro | Load (about 2s; page usable throughout) | 0ms rings fade in and settle 1.04 → 1 (1.2s, expo). 150ms nav drops in. 300ms line-1 words rise from a mask (SplitText, 60ms stagger). 650ms "Discover it." wipes from outlined to filled. 1000ms search scales 0.96 → 1 with one light sweep across the glass. 1150ms chips stagger in. 1300ms carousel cards slide in from the right. | Content visible immediately; 200ms fade |
| Hero scroll | Scrubbed scroll | Headline scales to 0.92 and fades to 60%; rings rotate up to 12°; nav glass becomes more opaque after 80px. | Nav background change only |
| Carousel | Drag, touch, keys, wheel | Embla with momentum. Centred card at scale 1, neighbours at 0.94 and 70% opacity, driven by scroll progress. Hover: photo scales to 1.04, insight slides up, a ring draws around the arrow. | No scaling or parallax; drag and keys still work |
| Bento | Enter viewport | Panels rise 40px over 600ms in sequence. A types sample queries while visible. B pin pulses twice then rests. E graph edges draw in. | Static; typing shows final text |
| Orbit | Pinned scroll, 4 steps | Step 0 rings draw. Steps 1–4 nodes travel along their ring into place while captions crossfade. Final step cross-links draw and rings drift at different speeds. Hover or focus: node edges brighten, others dim to 25%, detail card opens. Artist switch re-flows nodes with GSAP Flip. | No pin; all rings visible; tabs filter instead |
| Gallery | Scroll | ±6% image parallax; panels reveal via clip inset 8% → 0. | Static |
| How it works | Scrubbed scroll | Contour line draws with scroll; each step number turns green as the line reaches it. | Line fully drawn |
| Final CTA | Enter viewport | Headline words rise; rings slowly brighten. | Fade only |
| Footer wordmark | Pointer or scroll | Desktop: radial light follows the pointer with about 120ms smoothing (`gsap.quickTo`), fades on pointer leave. Touch: a light sweep crosses the letters as the footer scrolls into view, ending on ".fm"; dragging on the wordmark moves the light. | Static, faint mint gradient |

The page must be fully readable without JavaScript. Elements start hidden for animation only after a `js-motion` class is set and reduced motion is not requested.

## 5. Component architecture

```
apps/web/src/
  app/page.tsx                 server component; composes sections
  app/globals.css              @theme tokens (§2)
  components/
    ui/                        Arc UI primitives themed with our tokens
    primitives/                glass-surface, contour-field, provenance-badge,
                               section-header, outlined-text, media-frame (image + credit)
    sections/
      site-nav.tsx
      hero/                    hero, hero-headline (client), hero-search
      artist-carousel/         artist-carousel (client, Embla), artist-card
      feature-bento/           feature-bento + six panel components
      cultural-orbit/          orbit (client), ring, node, detail card, list fallback
      editorial-gallery/       gallery, story-panel
      how-it-works/            how-it-works, step
      final-cta.tsx
      signature-footer/        footer, wordmark-light (client)
  motion/                      gsap.ts (registers plugins once), use-motion-prefs,
                               use-pointer-light, presets.ts (named timelines)
  content/landing.ts           typed content, labelled DEMO DATA, image credits, provenance
```

- Sections render on the server; motion is added by small client islands.
- The existing `ExplorerProvider` stays. Hero search updates the carousel and the orbit. Later, search calls Fastify `/api/v1/search` through the client fetch layer; no Next.js route handlers.
- New dependencies: `gsap` (ScrollTrigger, SplitText, Flip), `@gsap/react`, `embla-carousel-react`, Arc UI packages once confirmed, Instrument Serif and JetBrains Mono via `next/font`.
- No smooth-scroll library such as Lenis; native scrolling is better for accessibility and mobile.

## 6. Arc UI integration plan

1. **Phase 0 audit (done):** see [`arc-ui-audit.md`](./arc-ui-audit.md). Arc is a copy-in shadcn registry (free tier MIT, Pro paid) whose foundation CSS collides with Tailwind v4 token names, so nothing is installed yet. Adoption needs a time-boxed spike first.
2. **Candidate mapping:** Button (CTA), Input or Command (search), Badge (provenance, genre), Tooltip (edge explanations), Tabs or segmented control (orbit steps), Sheet or Drawer (mobile menu, node detail), Separator, Visually Hidden.
3. **Custom-built:** carousel (Embla), orbit (SVG + GSAP), contour field, glass surface, bento grid, footer wordmark.
4. **Rules:** Arc components live in `components/ui`, consume tokens only (no hard-coded hex). If a component is missing or incompatible, use a Radix primitive with the same API.

## 7. Phased implementation plan (Claude Sonnet)

Every phase ends with `pnpm --filter @worlds/web lint`, `pnpm --filter @worlds/web typecheck`, `pnpm --filter @worlds/web build`, and a manual check at 375px and 1440px.

**Core cut (approved first):**

0. **Foundations:** tokens, fonts, dependencies, Arc UI audit; `content/landing.ts` with credits and provenance; `motion/` utilities; glass primitive. Update AGENTS.md §8 and README visual identity to the new palette. Run the photography sourcing process in §9.
1. **Static page:** all eight sections, responsive and semantic, no GSAP. Shippable on its own.
2. **Hero and navigation:** intro timeline, nav scroll states, search wired to the explorer state.
3. **Artist carousel:** Embla with drag, touch, keyboard, buttons, scaled neighbours.
4. **Signature footer:** pointer light, touch scroll sweep, reduced-motion version.

**Follow-on (only if P0 is on track):**

5. Bento interactions: typing demo, map pin, graph edge draw.
6. Cultural orbit: pinned steps, Flip transitions, detail card, mobile tabs and sheet, list fallback.
7. Gallery, How it works, and final CTA motion.
8. QA: keyboard pass, VoiceOver pass, reduced motion, Lighthouse, iOS Safari, contrast audit, credit audit.

## 8. Performance and accessibility

**Performance**

- Targets: LCP < 2.5s on mid-range 4G, CLS < 0.05, INP < 200ms, landing JavaScript under about 120 KB gzipped.
- The LCP element is the headline text, not an image. Only the first two carousel images are prioritised.
- `next/image` with AVIF/WebP, correct `sizes`, blur placeholders. `content-visibility: auto` below the fold.
- GSAP only in client islands; ScrollTriggers killed on unmount; loops pause off-screen or in hidden tabs.
- Pointer light writes CSS variables in `requestAnimationFrame`, with no React re-renders; animate only transform, opacity, and mask.
- Backdrop blur limited to nav, search, and detail card; lighter blur on mobile.

**Accessibility**

- Landmarks, skip link, logical heading order.
- SplitText `aria` option keeps the headline readable as whole sentences.
- Carousel: region with `aria-roledescription="carousel"`, slides labelled "3 of 8", arrow keys when focused, no autoplay.
- Orbit: every node is a focusable button; an equivalent plain list exists; pinned scrolling never traps focus.
- Provenance always shown with label, icon, and pattern, never color alone.
- 2px Electric focus ring with 3px offset on all interactive elements.
- `gsap.matchMedia()` for reduced motion; `prefers-reduced-transparency` switches glass to solid.
- Footer wordmark is decorative (`aria-hidden`) with real text alongside.
- Touch targets at least 44px. WCAG AA contrast throughout.

## 9. Photography and content policy

**Sourcing**

- Use Wikimedia Commons only, and only images whose licence permits this use (public domain, CC0, CC BY, CC BY-SA). Exclude non-commercial (NC) and no-derivatives (ND) licences, and any file whose licence cannot be confirmed on its file page.
- Verify each file individually: author, licence, licence URL, and any additional notices on the file page. Do not rely on search-result metadata.
- Do not use press photography, publicity shots, or images scraped from other sites without documented permission.
- Prefer high-resolution, editorial-style images (strong light, uncluttered background, consistent tone) so the gallery reads as one cohesive magazine.

**Attribution**

- Store per-image metadata in `content/landing.ts`: `src`, `alt`, `author`, `licence`, `licenceUrl`, `sourceUrl` (Commons file page), `modified` (for example, "cropped, duotone applied").
- Show credits next to the image (caption or credit affordance) and in the footer photo-credits list.
- For CC BY-SA, indicate any modification (crop, duotone, colour grade) and keep the licence notice.

**No implied endorsement**

- The footer and credits include: "Featured artists are not affiliated with or endorsing Worlds.fm."
- Copy must never suggest an artist uses, recommends, or partners with Worlds.fm.

**Fallback**

- If no suitable licensed image exists, use a typographic or duotone placeholder built from the official palette (for example, the artist name set in display type over a Forest-to-Night gradient with contour rings). Placeholders are designed as first-class cards, not empty states.

**Content claims**

- Every card insight and orbit connection carries a provenance kind. Unsourced sample content is visibly labelled **DEMO DATA** (AGENTS.md §5).
- Qloo attribution wording follows Qloo's current display terms, to be checked before any "powered by" copy ships.

## 10. Open risks

1. `#00CD37` sits close to Spotify green; the green-means-signal rule, Soft Mint, Forest, and the serif voice keep the identity distinct.
2. The landing page is not P0. Today (19 October) is the start of M1, so the core cut must not delay search and the World page.
3. Arc UI compatibility is unverified until the Phase 0 audit.
4. Licensed editorial-quality photos may not exist for every featured artist; the placeholder system covers the gap.
5. **Outlined wordmark artifact (found in Phase 0).** Manrope glyphs contain overlapping contours, so stroking live text shows stray inner lines (in "d", "m", "t"). A static weight instance did not remove them. Phase 4 should render the wordmark as an overlap-free SVG path (generated once from the font with overlaps removed), which also gives a precise shape for the pointer-light mask.
