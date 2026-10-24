import { vi } from "vitest";
import type { PlayerEntity } from "../src/lib/music/player-state";
import type { SpotifyEmbedController, SpotifyIframeApi } from "../src/lib/music/spotify-embed";

/** Invented IDs and a deliberately tiny DOM double. Never used by the app. */
export const ALBUM: PlayerEntity = { kind: "album", id: "A".repeat(22), title: "Fixture album", artist: "Fixture artist", trackIds: ["B".repeat(22)] };
export const TRACK: PlayerEntity = { kind: "track", id: "B".repeat(22), title: "Fixture track", artist: "Fixture artist" };
export const OTHER: PlayerEntity = { ...TRACK, id: "C".repeat(22), title: "Other fixture" };

export class ElementDouble {
  children: ElementDouble[] = [];
  parent: ElementDouble | null = null;
  src = "";
  title = "";
  width = "";
  height = "";
  loading = "";
  allow = "";
  async = false;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  constructor(public tagName: string) {}
  appendChild(child: ElementDouble) { child.parent = this; this.children.push(child); return child; }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }
  replaceChildren(...children: ElementDouble[]) {
    this.children.forEach((child) => { child.parent = null; });
    this.children = [];
    children.forEach((child) => this.appendChild(child));
  }
  replaceWith(child: ElementDouble) {
    const parent = this.parent;
    if (!parent) return;
    const index = parent.children.indexOf(this);
    parent.children[index] = child;
    child.parent = parent;
    this.parent = null;
  }
  querySelector(tag: string): ElementDouble | null {
    for (const child of this.children) {
      if (child.tagName === tag) return child;
      const nested = child.querySelector(tag);
      if (nested) return nested;
    }
    return null;
  }
  asElement() { return this as unknown as HTMLElement; }
}

export function browserDouble() {
  const body = new ElementDouble("body");
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { body, createElement: (tag: string) => new ElementDouble(tag) });
  return body;
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export function apiDouble(delayed = false) {
  const listeners = new Map<string, (event?: unknown) => void>();
  const controller: SpotifyEmbedController = {
    loadEntity: vi.fn(),
    play: vi.fn(),
    destroy: vi.fn(() => iframe?.remove()),
    addListener: vi.fn((event, listener) => { listeners.set(event, listener as (event?: unknown) => void); }),
    removeListener: vi.fn((event) => { listeners.delete(event); }),
  };
  let callback: ((controller: SpotifyEmbedController) => void) | undefined;
  let iframe: ElementDouble | undefined;
  const api: SpotifyIframeApi = {
    createController: vi.fn((mount, _options, done) => {
      iframe = new ElementDouble("iframe");
      (mount as unknown as ElementDouble).replaceWith(iframe);
      callback = done;
      if (!delayed) done(controller);
    }),
  };
  return {
    api, controller,
    attach: () => callback?.(controller),
    ready: () => listeners.get("ready")?.(),
    playback: (uri: string, paused = false, buffering = false) =>
      listeners.get("playback_update")?.({ data: { playingURI: uri, isPaused: paused, isBuffering: buffering } }),
    listenerCount: () => listeners.size,
  };
}
