import { WorldsMark } from "@/components/worlds-mark";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 2.5-.34c.85 0 1.71.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

const EXPLORE_LINKS = [
  { label: "Discovery preview", href: "#discovery" },
  { label: "The universe", href: "#universe-heading" },
  { label: "How it works", href: "#how" },
] as const;

const ABOUT_LINKS = [
  { label: "Our mission", href: "#about" },
  { label: "Provenance & evidence", href: "#discovery" },
  { label: "Privacy-first social", href: "#about" },
] as const;

export function Footer() {
  return (
    <footer id="about" className="relative scroll-mt-24 border-t border-white/8 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <WorldsMark className="size-8" />
              <span className="text-lg font-extrabold tracking-[-0.03em]">
                Worlds<span className="text-brand">.fm</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              An AI-powered music and cultural discovery platform. Search a
              sound, then explore the places, people, and movements connected to
              it — with provenance you can trust.
            </p>
          </div>

          <nav aria-label="Explore" className="text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-cloud/90">
              Explore
            </h3>
            <ul className="mt-4 space-y-3">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-muted transition-colors duration-300 hover:text-electric"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="About" className="text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-cloud/90">
              About
            </h3>
            <ul className="mt-4 space-y-3">
              {ABOUT_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-muted transition-colors duration-300 hover:text-electric"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-muted transition-colors duration-300 hover:text-electric"
                >
                  <GithubMark className="size-4" />
                  GitHub
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-white/8 pt-8 text-xs text-muted sm:flex-row sm:items-center">
          <p>© 2026 Worlds.fm. All rights reserved.</p>
          <p className="text-muted/70">
            Demo experience — sample data only. Live discovery arriving soon.
          </p>
        </div>
      </div>
    </footer>
  );
}
