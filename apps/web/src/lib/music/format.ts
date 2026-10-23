import type { ReleaseKind } from "@worlds/shared";

/** "3:38", or "1:02:05" past an hour. */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** "51 min" or "1 hr 12 min" for a whole release. */
export function formatRuntime(ms: number | null): string {
  if (ms === null || ms <= 0) return "";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)} min`;
  const rest = minutes % 60;
  return rest === 0 ? `${Math.floor(minutes / 60)} hr` : `${Math.floor(minutes / 60)} hr ${rest} min`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** MusicBrainz partial dates: "2015", "Jul 2015" or "17 Jul 2015". */
export function formatPartialDate(date: string | null): string {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  const month = m ? MONTHS[Number(m) - 1] : undefined;
  if (!y) return "";
  if (!month) return y;
  return d ? `${Number(d)} ${month} ${y}` : `${month} ${y}`;
}

export const KIND_LABEL: Record<ReleaseKind, { one: string; many: string }> = {
  album: { one: "Album", many: "Albums" },
  ep: { one: "EP", many: "EPs" },
  single: { one: "Single", many: "Singles" },
};

export function countLabel(count: number, kind: ReleaseKind): string {
  const label = KIND_LABEL[kind];
  return `${count} ${count === 1 ? label.one : label.many}`;
}

/**
 * True when a MusicBrainz credit names one artist, so it can be searched as a
 * name. "A feat. B" or "A & B" would not resolve to a single world.
 */
export function isSingleArtistCredit(credit: string | null): credit is string {
  if (!credit) return false;
  return !/\s(?:feat\.?|ft\.?|featuring|with|x|vs\.?)\s|\s&\s|,\s|\s\/\s/i.test(credit);
}
