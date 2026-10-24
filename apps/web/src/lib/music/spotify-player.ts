import {
  loadSpotifyApi, SPOTIFY_EMBED_TIMEOUT_MS, spotifyEmbedUrl, spotifyUri,
  type SpotifyEmbedController, type SpotifyIframeApi,
} from "./spotify-embed";
import type { PlayerAction, PlayerEntity } from "./player-state";

export interface SpotifyPlayerSession {
  play(entity: PlayerEntity, requestId: number): void;
  destroy(): void;
}

/** One imperative DOM owner, independent of React renders and selection keys. */
export function createSpotifyPlayer(
  host: HTMLElement,
  report: (action: PlayerAction) => void,
  loadApi: () => Promise<SpotifyIframeApi> = loadSpotifyApi,
): SpotifyPlayerSession {
  let active = true;
  let mode: "idle" | "api" | "fallback" | "unavailable" = "idle";
  let target: { entity: PlayerEntity; requestId: number } | undefined;
  let controller: SpotifyEmbedController | undefined;
  let frame: HTMLIFrameElement | undefined;
  let ready = false;
  let loadedUri: string | undefined;
  let handledRequest = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const phase = (value: "loading" | "ready" | "fallback" | "unavailable") => {
    if (active && target) report({ type: "phase", phase: value, requestId: target.requestId });
  };
  const disposeController = (value: SpotifyEmbedController) => {
    // Cleanup must still remove the frame if a provider method throws.
    try { value.removeListener("ready"); } catch { /* Provider may already be destroyed. */ }
    try { value.removeListener("playback_update"); } catch { /* Same. */ }
    try { value.destroy(); } catch { /* The mount is also removed below. */ }
  };
  const title = () => target ? `Spotify ${target.entity.kind}: ${target.entity.title}` : "Spotify player";
  const nameFrame = () => {
    const iframe = host.querySelector("iframe");
    if (iframe) iframe.title = title();
  };
  const failFrame = (requestId: number) => {
    if (!active || mode !== "fallback" || target?.requestId !== requestId) return;
    clearTimeout(timer);
    mode = "unavailable";
    if (frame) { frame.onload = null; frame.onerror = null; }
    frame?.remove();
    phase("unavailable");
  };
  const loadFallbackEntity = () => {
    if (!frame || !target) return;
    clearTimeout(timer);
    const requestId = target.requestId;
    frame.title = title();
    frame.onerror = () => failFrame(requestId);
    // A previous navigation must not clear this selection's timeout.
    // Loading a cross-origin document is not evidence of playback.
    frame.onload = () => {
      if (active && mode === "fallback" && target?.requestId === requestId) clearTimeout(timer);
    };
    frame.src = spotifyEmbedUrl(target.entity.kind, target.entity.id)!;
    phase("fallback");
    timer = setTimeout(() => failFrame(requestId), SPOTIFY_EMBED_TIMEOUT_MS);
  };
  const fallback = () => {
    if (!active || !target || mode === "fallback" || mode === "unavailable") return;
    clearTimeout(timer);
    mode = "fallback";
    if (controller) disposeController(controller);
    controller = undefined;
    host.replaceChildren();
    frame = document.createElement("iframe");
    frame.width = "100%";
    frame.height = "152";
    frame.loading = "lazy";
    frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    loadFallbackEntity();
    host.appendChild(frame);
  };
  const flush = () => {
    if (!active || mode !== "api" || !controller || !ready || !target || handledRequest === target.requestId) return;
    const uri = spotifyUri(target.entity.kind, target.entity.id)!;
    handledRequest = target.requestId;
    try {
      if (loadedUri !== uri) {
        controller.loadEntity(uri);
        loadedUri = uri;
      }
      nameFrame();
      phase("ready");
      // Only a pending, explicit Play request can reach this call.
      controller.play();
    } catch { fallback(); }
  };

  return {
    play(entity, requestId) {
      if (!active || !spotifyUri(entity.kind, entity.id) || (target && requestId <= target.requestId)) return;
      target = { entity, requestId };
      if (mode === "fallback" && frame) {
        loadFallbackEntity();
      } else if (mode === "unavailable") {
        phase("unavailable");
      } else if (mode === "api") {
        flush();
      } else {
        mode = "api";
        phase("loading");
        timer = setTimeout(fallback, SPOTIFY_EMBED_TIMEOUT_MS);
        void loadApi().then((api) => {
          if (!active || mode !== "api" || !target) return;
          // Spotify replaces its mount. Keep a separate owner for pending creation.
          const mount = document.createElement("div");
          host.appendChild(mount);
          loadedUri = spotifyUri(target.entity.kind, target.entity.id)!;
          try {
            api.createController(mount, { uri: loadedUri, width: "100%", height: 152 }, (value) => {
              if (!active || mode !== "api") {
                disposeController(value);
                return;
              }
              controller = value;
              nameFrame();
              value.addListener("ready", () => {
                if (!active || mode !== "api") return;
                clearTimeout(timer);
                ready = true;
                flush();
              });
              value.addListener("playback_update", (event) => {
                if (!active || mode !== "api" || !ready || !target) return;
                const data = event?.data;
                if (typeof data?.playingURI !== "string" || typeof data.isPaused !== "boolean" || typeof data.isBuffering !== "boolean") return;
                report({
                  type: "playback", uri: data.playingURI, paused: data.isPaused,
                  buffering: data.isBuffering, requestId: target.requestId,
                });
              });
            });
          } catch { fallback(); }
        }, fallback);
      }
    },
    destroy() {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      if (frame) { frame.onload = null; frame.onerror = null; }
      if (controller) disposeController(controller);
      host.replaceChildren();
      target = undefined;
    },
  };
}
