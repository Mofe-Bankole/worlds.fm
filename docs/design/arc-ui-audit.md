# Arc UI audit

**Date:** 19 October 2026 · **Scope:** Phase 0 · **Decision:** Do not install Arc UI yet. Re-evaluate with a spike (see "Recommendation").

## Method

Read-only. Nothing from Arc was installed and the shadcn CLI was not run. We read the public docs (introduction, installation, theming, license, `llms.txt`), downloaded the registry JSON for `arc-foundation`, `button`, `tabs`, `tooltip`, `badge`, `bottom-sheet`, `drawer`, `search-field`, `carousel`, `segmented-control` and `card` to a temp folder, and inspected their source, dependencies and CSS. Package facts came from `npm view`.

## Findings

| Question | Finding | Status |
|---|---|---|
| Installation | Copy-in source, not an npm package. Install with `npx shadcn@latest add https://uiarc.dev/r/<name>.json` (needs `shadcn init` and a `components.json`) or copy files by hand. Files land in `components/arc/`. | Verified |
| Component licence | Free tier (114 components, 22 blocks) is MIT, copyright Elia Kuratli, text at https://uiarc.dev/license. Pro tier (56 components, 72 blocks) is a paid, personal, non-transferable licence ($129/yr or $199 once; team plans) delivered through a token-gated registry. | Verified from docs. We did not confirm the public GitHub repo's `LICENSE` file separately. |
| React 19 | Docs require React 19 with TypeScript and an `@/*` alias. We have React 19.3.1 and the alias. | Compatible on paper |
| Next.js 16 | Docs mention Next.js without a version. Components are `"use client"` with CSS modules, which Next supports. Not compiled in our app. | **Unverified** |
| Tailwind 4 | Arc does not use Tailwind classes (CSS modules plus CSS variables), so it neither needs nor conflicts with Tailwind at the class level. The token collision below is the real issue. | Verified (static) |
| Server vs client | Every inspected component starts with `"use client"`, so each is a client component. Server components can render them as children but they add to client JS. | Verified |
| Extra dependencies | Each item needs `motion` (14.4.0, MIT). Tabs, tooltip, drawer, bottom sheet and card also need Radix packages. Some need `lucide-react` (already installed). | Verified |
| Pro items needed by us | Glass menu, glass card, glass segmented, glass tab bar, orbit logos, dot grid, Feature bento, Scroll story, Spotlight grid and Lightbox gallery are all **Pro**. | Verified |

## Conflicts with our design system

1. **Token collisions with Tailwind v4.** `foundation.css` defines `--text-xs` to `--text-5xl`, `--ease-in-out` and `--radius-*` in `:root`. Tailwind v4 reads these same names for its `text-*` and `ease-*` utilities. For example Arc sets `--text-4xl: 3.25rem` where Tailwind's default is `2.25rem`, so importing the foundation would silently resize every `text-4xl` on the site. It also sets generic names (`--background`, `--surface`, `--foreground`, `--border`, `--accent`) that are easy to clash with.
2. **Its own colour system.** Arc is built on neutral greys with a built-in `green` accent (`#0db879` / `#53dca6`), not our brand greens. Every component would need its tokens remapped to Night, Electric and Mint, and the dark theme is keyed on `data-theme="dark"`.
3. **Opposing style rules.** Arc's agent rules say "no eyebrow labels, no decorative gradients or glows, regular and medium weights only". Our blueprint uses mono eyebrows, controlled glow, and weight 700 to 800 display type.
4. **Fonts.** Arc expects Geist and Inter. We use Manrope, Instrument Serif and JetBrains Mono.
5. **Provider setup.** `shadcn init` writes `components.json` and may touch global CSS and add helper dependencies. That is outside Phase 0.

## What Arc could still give us

Accessible, keyboard-tested behaviour for components we would otherwise build or pull from Radix: Tabs or Segmented control (orbit steps), Tooltip (edge explanations), Bottom sheet or Drawer (mobile menu, node details), Badge, Search field. These are free tier.

## Not suitable

The carousel (we use Embla for drag, touch and keyboard behaviour per the blueprint), and every Pro "glass" or showpiece item (paid, and our glass surface is custom).

## Recommendation

1. **Phase 1 proceeds on our own primitives.** Nothing in Phase 1 needs Arc.
2. **Run a time-boxed spike before adopting anything**, in a throwaway branch or temp copy: `shadcn init`, install `arc-foundation` plus `tabs` and `tooltip`, and check (a) `next build` on Next 16, (b) that `text-*` and `ease-*` utilities are unchanged, (c) the look after remapping tokens.
3. **If adopting**, do not import `foundation.css` as shipped. Copy it into our tokens under prefixed names (or scope it to a wrapper) so it cannot override Tailwind's namespaces, and remap the semantic colours to ours.
4. **Fallback** (already the plan in the blueprint): Radix primitives with our own styling, same APIs.
5. Pro is not required and not recommended for a hackathon timeline. Using it would need purchase approval and its licence terms (no redistribution, seat limits) in the repo's process.
