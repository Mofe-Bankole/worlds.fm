"use client";

import { useEffect, useState } from "react";
import { QLOO_IMAGE_BATCH_MAX } from "@worlds/shared";
import type { OrbitItem } from "@/components/primitives/orbit-edges";
import { fetchArtistImages } from "@/lib/api/discovery";

const CACHE_KEY = "worlds:artist-images:v2";
/** Image URLs rarely change; a week keeps repeat visits instant without pinning stale links forever. */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Stops the cache growing without bound as visitors open new worlds. */
const CACHE_MAX_ENTRIES = 200;

interface CacheEntry {
  url: string;
  savedAt: number;
}

/**
 * One store per page load, shared by every component that asks for images:
 * resolved names (hits and misses), and batches still in flight, so two
 * consumers asking for overlapping names cause one request, not two. Hits are
 * also kept in localStorage, so a returning visitor's wheels and cards render
 * without waiting for the API. Only URLs are stored; the image bytes stay in
 * the browser's HTTP cache.
 */
const resolved = new Map<string, string | null>();
const savedAt = new Map<string, number>();
const inflight = new Map<string, Promise<void>>();
let hydrated = false;

function hydrateFromStorage() {
  if (hydrated) return;
  hydrated = true;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, Partial<CacheEntry>>;
    const now = Date.now();
    for (const [name, entry] of Object.entries(cached)) {
      if (typeof entry?.url === "string" && typeof entry.savedAt === "number" && now - entry.savedAt < CACHE_TTL_MS) {
        resolved.set(name, entry.url);
        savedAt.set(name, entry.savedAt);
      }
    }
  } catch {
    // Storage can be unavailable or full; images are decoration.
  }
}

function persistHits() {
  const entries: [string, CacheEntry][] = [];
  resolved.forEach((url, name) => {
    if (url) entries.push([name, { url, savedAt: savedAt.get(name) ?? Date.now() }]);
  });
  entries.sort((x, y) => y[1].savedAt - x[1].savedAt);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries.slice(0, CACHE_MAX_ENTRIES))));
  } catch {
    // See hydrateFromStorage.
  }
}

/** Resolves once every name is known or its batch has failed. */
export function loadArtistImages(names: readonly string[]): Promise<void> {
  hydrateFromStorage();
  const missing = names.filter((name) => !resolved.has(name) && !inflight.has(name));
  for (let i = 0; i < missing.length; i += QLOO_IMAGE_BATCH_MAX) {
    const batch = missing.slice(i, i + QLOO_IMAGE_BATCH_MAX);
    const request = fetchArtistImages(batch)
      .then((images) => {
        // A failed batch stays unresolved so a later mount can retry it.
        if (!images) return;
        const now = Date.now();
        batch.forEach((name) => {
          resolved.set(name, images[name] ?? null);
          savedAt.set(name, now);
        });
        persistHits();
      })
      .finally(() => batch.forEach((name) => inflight.delete(name)));
    batch.forEach((name) => inflight.set(name, request));
  }
  const pending = names.flatMap((name) => {
    const request = inflight.get(name);
    return request ? [request] : [];
  });
  return Promise.all(pending).then(() => undefined);
}

function toItems(names: readonly string[]): OrbitItem[] {
  return names.map((name) => ({ key: name, name, imageUrl: resolved.get(name) ?? null }));
}

/** Test hook: forget everything the store has learnt. */
export function resetArtistImageStore() {
  resolved.clear();
  savedAt.clear();
  inflight.clear();
  hydrated = false;
}

/**
 * Qloo images for a fixed list of artist names, fetched in one batch request
 * per {@link QLOO_IMAGE_BATCH_MAX} names and cached in localStorage for a week.
 * Pass a module-level constant: the lookup reruns when the array identity
 * changes.
 */
export function useArtistImages(names: readonly string[]): OrbitItem[] {
  // Starts empty on server and client alike so hydration always matches.
  const [items, setItems] = useState<OrbitItem[]>(() =>
    names.map((name) => ({ key: name, name, imageUrl: null })),
  );
  useEffect(() => {
    let live = true;
    void loadArtistImages(names).then(() => {
      if (live) setItems(toItems(names));
    });
    return () => {
      live = false;
    };
  }, [names]);
  return items;
}
