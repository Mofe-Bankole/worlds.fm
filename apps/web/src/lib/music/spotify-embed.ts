export const SPOTIFY_EMBED_SCRIPT = "https://open.spotify.com/embed/iframe-api/v1";
export const SPOTIFY_EMBED_TIMEOUT_MS = 8000;

export type SpotifyEntityKind = "album" | "track";

export function spotifyUri(kind: SpotifyEntityKind, id: string): string | null {
  return /^(album|track)$/.test(kind) && /^[A-Za-z0-9]{22}$/.test(id) ? `spotify:${kind}:${id}` : null;
}

export function spotifyEmbedUrl(kind: SpotifyEntityKind, id: string): string | null {
  return spotifyUri(kind, id) ? `https://open.spotify.com/embed/${kind}/${id}` : null;
}

export interface SpotifyPlaybackEvent {
  data: { playingURI?: string; isPaused: boolean; isBuffering: boolean };
}

interface SpotifyEvents {
  ready: undefined;
  playback_update: SpotifyPlaybackEvent;
}

export interface SpotifyEmbedController {
  loadEntity(uri: string): void;
  play(): void;
  destroy(): void;
  addListener<K extends keyof SpotifyEvents>(event: K, listener: (event: SpotifyEvents[K]) => void): void;
  removeListener(event: keyof SpotifyEvents): void;
}

export interface SpotifyIframeApi {
  createController(
    element: HTMLElement,
    options: { uri: string; width: string; height: number },
    callback: (controller: SpotifyEmbedController) => void,
  ): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
  }
}

/**
 * No browser work happens until called. The shared promise outlives a player:
 * a late API can be reused on reopening, but cannot change a fallback session.
 */
export function createSpotifyApiLoader() {
  let pending: Promise<SpotifyIframeApi> | undefined;
  return function load(): Promise<SpotifyIframeApi> {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return Promise.reject(new Error("Spotify Embed requires a browser"));
    }
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SPOTIFY_EMBED_SCRIPT;
      script.async = true;
      const previous = window.onSpotifyIframeApiReady;
      const ready = (api: SpotifyIframeApi) => {
        script.onerror = null;
        resolve(api);
        if (previous) previous(api);
      };
      window.onSpotifyIframeApiReady = ready;
      script.onerror = () => {
        script.remove();
        if (window.onSpotifyIframeApiReady === ready) window.onSpotifyIframeApiReady = previous;
        pending = undefined;
        reject(new Error("Spotify Embed could not load"));
      };
      document.body.appendChild(script);
    });
    return pending;
  };
}

export const loadSpotifyApi = createSpotifyApiLoader();
