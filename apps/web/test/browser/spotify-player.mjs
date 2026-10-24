/**
 * Local-only browser verification, using Chrome's built-in DevTools protocol.
 * No Spotify audio or live Spotify IDs. All provider traffic is intercepted.
 * Run from apps/api: node --import tsx ../web/test/browser/spotify-player.mjs
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureResponse } from "../fixtures.ts";

const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const origin = "http://localhost:3000";
const evidence = fileURLToPath(new URL("./evidence/", import.meta.url));
const albumId = "A".repeat(22);
const trackId = "B".repeat(22);
const otherId = "C".repeat(22);
const mbid = "aaaaaaaa-0000-4000-8000-000000000001";
const at = "2026-10-24T00:00:00.000Z";
const release = {
  id: mbid, title: "Currents [TEST FIXTURE]", kind: "album", secondaryTypes: [],
  firstReleaseDate: "2015-07-15", year: 2015, trackCount: 13, cover: null,
  spotify: { id: albumId, url: `https://open.spotify.com/album/${albumId}` },
  musicbrainzUrl: `https://musicbrainz.org/release-group/${mbid}`,
};
const discography = {
  status: "ok", artist: { mbid, name: "Mock Artist", disambiguation: "TEST FIXTURE",
    musicbrainzUrl: `https://musicbrainz.org/artist/${mbid}`, spotify: null },
  candidates: [], releases: [release, { ...release, id: "aaaaaaaa-0000-4000-8000-000000000002", title: "Unmatched fixture album", spotify: null }],
  counts: { album: 2, ep: 0, single: 0 }, spotifyStatus: "linked", spotifyPending: [],
  notice: "TEST FIXTURE. No real provider response or audio.", retrievedAt: at,
};
const tracks = {
  release: { id: mbid, releaseMbid: mbid, title: release.title, date: "2015", country: "XW", format: "Digital Media", musicbrainzUrl: release.musicbrainzUrl },
  discCount: 1, totalDurationMs: 2600000,
  tracks: Array.from({ length: 13 }, (_, i) => {
    const id = i === 6 ? trackId : i === 7 ? otherId : "D".repeat(22);
    return {
      disc: 1, position: i + 1, number: String(i + 1), title: `Fixture track ${i + 1}`, durationMs: 200000,
      artistCredit: "Mock Artist", featured: [], recordingMbid: `aaaaaaaa-0000-4000-8000-${String(i + 10).padStart(12, "0")}`,
      isrc: null, explicit: null, spotify: i === 12 ? null : { id, url: `https://open.spotify.com/track/${id}` },
    };
  }),
  spotifyAlbum: release.spotify, spotifyStatus: "linked", notice: discography.notice, retrievedAt: at,
};

const mockScript = `
window.__spotifyDouble = {
  creates: 0, plays: 0, loads: [], destroyed: 0, emit: null,
  deliver() {
    window.onSpotifyIframeApiReady({
      createController(mount, options, callback) {
        const test = window.__spotifyDouble;
        test.creates++;
        const frame = document.createElement('iframe');
        frame.width = options.width; frame.height = options.height;
        frame.src = 'https://open.spotify.com/embed/' + options.uri.split(':').slice(1).join('/');
        mount.replaceWith(frame);
        const listeners = {};
        test.emit = (uri, paused = false) => listeners.playback_update?.({ data: { playingURI: uri, isPaused: paused, isBuffering: false } });
        callback({
          loadEntity(uri) { test.loads.push(uri); frame.src = 'https://open.spotify.com/embed/' + uri.split(':').slice(1).join('/'); },
          play() { test.plays++; },
          destroy() { test.destroyed++; frame.remove(); },
          addListener(name, listener) { listeners[name] = listener; },
          removeListener(name) { delete listeners[name]; },
        });
        setTimeout(() => listeners.ready?.(), 20);
      }
    });
  }
};
if (!window.__delaySpotifyApi) window.__spotifyDouble.deliver();
`;

const profile = await mkdtemp(join(tmpdir(), "worlds-spotify-browser-"));
const chrome = spawn(chromePath, [
  "--headless", "--disable-gpu", "--enable-logging=stderr", "--no-first-run", "--no-default-browser-check",
  "--disable-background-networking", "--disable-component-update", "--disable-sync", "--disable-extensions",
  "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
let socket;
try {
  let output = "";
  let startupError;
  chrome.on("error", (error) => { startupError = error; });
  chrome.stderr.on("data", (chunk) => { output += chunk; });
  let wsUrl;
  const deadline = Date.now() + 15000;
  while (!wsUrl && Date.now() < deadline) {
    if (startupError) throw startupError;
    wsUrl = output.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
    if (!wsUrl) {
      try {
        const [port, path] = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).trim().split(/\r?\n/);
        wsUrl = `ws://127.0.0.1:${port}${path}`;
      } catch { /* Some Windows launchers exit before the browser writes this file. */ }
    }
    if (!wsUrl) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!wsUrl) throw new Error(`Browser DevTools unavailable (exit ${chrome.exitCode}): ${output}`);
  socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const handlers = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) task?.reject(new Error(JSON.stringify(message.error)));
      else task?.resolve(message.result);
    } else handlers.get(message.method)?.(message.params, message.sessionId);
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const commandId = ++id;
    pending.set(commandId, { resolve, reject });
    socket.send(JSON.stringify({ id: commandId, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const wait = async (expression, timeout = 25000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out: ${expression}\n${await evaluate("document.body.innerText")}`);
  };
  const requests = [];
  const interceptionErrors = [];
  let cancelledInterceptions = 0;
  let failScript = false;
  let holdTracks = false;
  const heldTracks = [];
  handlers.set("Fetch.requestPaused", async (event) => {
    try {
      const url = new URL(event.request.url);
      requests.push({ url: event.request.url, method: event.request.method });
      let body, contentType = "application/json";
      if (url.host === "open.spotify.com") {
        if (url.pathname === "/embed/iframe-api/v1") {
          if (failScript) { await call("Fetch.failRequest", { requestId: event.requestId, errorReason: "Failed" }); return; }
          body = mockScript;
          contentType = "application/javascript";
        } else {
          body = '<!doctype html><html><body style="background:#142219;color:#eef6ef;font:16px sans-serif"><strong>TEST DOUBLE</strong><p>No Spotify audio. Browser lifecycle verification only.</p><button>Fixture control</button></body></html>';
          contentType = "text/html";
        }
      } else if (url.pathname === "/api/v1/graph/artist") body = JSON.stringify(fixtureResponse());
      else if (url.pathname === "/api/v1/music/discography") body = JSON.stringify(discography);
      else if (url.pathname.includes("/tracks")) {
        if (holdTracks) { heldTracks.push(event.requestId); return; }
        body = JSON.stringify(tracks);
      }
      else body = JSON.stringify({ images: [], provenance: { provider: "qloo", mode: "live", environment: "hackathon", retrievedAt: at } });
      await call("Fetch.fulfillRequest", {
        requestId: event.requestId, responseCode: 200,
        responseHeaders: [{ name: "content-type", value: contentType }, { name: "access-control-allow-origin", value: origin }],
        body: Buffer.from(body).toString("base64"),
      });
    } catch (error) {
      // Closing/replacing an iframe cancels its paused network request.
      if (error.message.includes("Invalid InterceptionId.")) cancelledInterceptions++;
      else interceptionErrors.push(error.message);
    }
  });
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Fetch.enable", { patterns: [{ urlPattern: "*code.run/api/v1/*" }, { urlPattern: "https://open.spotify.com/*" }] });
  await call("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__maxPlayerFrames = 0;
    window.__storageKeys = [];
    window.__playbackEffects = [];
    window.__watchPlaybackEffects = false;
    const effect = name => { if (window.__watchPlaybackEffects) window.__playbackEffects.push(name); };
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { effect('storage'); window.__storageKeys.push(key); return setItem.call(this, key, value); };
    for (const [target, name] of [[window, 'fetch'], [XMLHttpRequest.prototype, 'send'], [Navigator.prototype, 'sendBeacon']]) {
      const original = target[name];
      target[name] = function(...args) {
        const request = args[0] instanceof Request ? args[0] : null;
        const url = name === 'fetch' ? new URL(request?.url ?? String(args[0]), location.href) : null;
        const headers = new Headers(args[1]?.headers ?? request?.headers);
        const songPrefetch = url?.origin === location.origin && /^\\/song\\/[a-f0-9-]+$/.test(url.pathname)
          && headers.get('next-router-prefetch') === '1';
        // Next Link may prefetch song pages as layout changes. This is not
        // playback reporting; all other fetches remain forbidden here.
        if (!songPrefetch) effect(name);
        return original.apply(this, args);
      };
    }
    for (const name of ['log', 'info', 'debug', 'warn', 'error']) {
      const original = console[name];
      console[name] = function(...args) { effect('console.' + name); return original.apply(this, args); };
    }
    new MutationObserver(() => {
      window.__maxPlayerFrames = Math.max(window.__maxPlayerFrames, document.querySelectorAll('iframe[src*="open.spotify.com/embed"]').length);
    }).observe(document, { subtree: true, childList: true });
  ` });
  const click = async (label) => {
    const selector = `button[aria-label=${JSON.stringify(label)}]`;
    await wait(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  };
  const navigate = async (width, waitForTracks = true) => {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await call("Page.navigate", { url: `${origin}/explore?q=Tame%20Impala` });
    await wait(`Boolean(document.querySelector('button[aria-label="Currents [TEST FIXTURE], 2015. Show tracks"]'))`);
    await click("Currents [TEST FIXTURE], 2015. Show tracks");
    if (waitForTracks) await wait("document.body.innerText.includes('Fixture track 13')");
  };
  await mkdir(evidence, { recursive: true });
  for (const width of [390, 1440]) {
    const before = requests.length;
    await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: width === 390 ? "reduce" : "no-preference" }] });
    await navigate(width);
    assert.equal(requests.slice(before).filter((request) => request.url.includes("open.spotify.com/embed")).length, 0, "no embed traffic before Play");
    assert.equal(await evaluate("document.querySelectorAll('iframe').length"), 0);
    assert.equal(await evaluate("Boolean(document.querySelector('button[aria-label=\"Play Fixture track 13 in the player\"]'))"), false);
    await evaluate("document.querySelector('button[aria-label=\"Play Currents [TEST FIXTURE] in the player\"]').focus()");
    assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), "Play Currents [TEST FIXTURE] in the player");
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", modifiers: 8, windowsVirtualKeyCode: 9 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", modifiers: 8, windowsVirtualKeyCode: 9 });
    assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), "Play Currents [TEST FIXTURE] in the player");
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", windowsVirtualKeyCode: 13 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await wait("window.__spotifyDouble?.plays === 1");
    assert.equal(await evaluate("document.activeElement.id"), "music-mini-player");
    if (width === 390) assert.equal(await evaluate("getComputedStyle(document.querySelector('#music-mini-player')).animationName"), "none");
    assert.equal(await evaluate("document.querySelector('#music-mini-player [role=status]').innerText.includes('Playing')"), false);
    await evaluate("window.__initialFrame = document.querySelector('#music-mini-player iframe')");
    await click("Play Fixture track 7 in the player");
    await wait(`window.__spotifyDouble.loads.at(-1) === 'spotify:track:${trackId}'`);
    assert.equal(await evaluate("window.__initialFrame === document.querySelector('#music-mini-player iframe')"), true);
    await evaluate(`window.__watchPlaybackEffects = true; window.__spotifyDouble.emit('spotify:track:${trackId}')`);
    await wait("document.querySelector('#music-mini-player [role=status]').innerText.includes('Playing')");
    assert.deepEqual(await evaluate("window.__watchPlaybackEffects = false; window.__playbackEffects"), [], "observed playback must not log, store, or transmit anything");
    await evaluate(`document.querySelector('button[aria-label="Play Fixture track 7 in the player"]').click(); document.querySelector('button[aria-label="Play Fixture track 8 in the player"]').click()`);
    await wait(`window.__spotifyDouble.loads.at(-1) === 'spotify:track:${otherId}'`);
    assert.equal(await evaluate("window.__spotifyDouble.creates"), 1);
    assert.equal(await evaluate("window.__maxPlayerFrames"), 1);
    await evaluate("window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })");
    const clearance = await evaluate(`({
      footerBottom: document.querySelector('footer').getBoundingClientRect().bottom,
      dockTop: document.querySelector('#music-mini-player').getBoundingClientRect().top,
      overflow: document.documentElement.scrollWidth > innerWidth
    })`);
    assert.ok(clearance.footerBottom <= clearance.dockTop, JSON.stringify(clearance));
    assert.equal(clearance.overflow, false);
    const screenshot = await call("Page.captureScreenshot", { format: "png" });
    await writeFile(join(evidence, `spotify-player-${width}.png`), Buffer.from(screenshot.data, "base64"));
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await wait("!document.querySelector('#music-mini-player')");
    assert.equal(await evaluate("document.querySelectorAll('iframe').length"), 0);
    assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), "Play Currents [TEST FIXTURE] in the player");
    await click("Play Fixture track 7 in the player");
    await wait("window.__spotifyDouble.creates === 2");
    assert.equal(requests.slice(before).filter((request) => request.url.includes("/embed/iframe-api/v1")).length, 1);
    await evaluate("document.querySelector('#music-mini-player button').click()");
    await wait("!document.querySelector('#music-mini-player')");
    await click("Unmatched fixture album, 2015. Show tracks");
    assert.equal(await evaluate("Boolean(document.querySelector('button[aria-label=\"Play Unmatched fixture album in the player\"]'))"), false);
    assert.deepEqual(await evaluate("window.__storageKeys.filter(key => /playback|spotify|player/i.test(key))"), []);
    console.log(JSON.stringify({ width, result: "passed", mocked: true, maxIframes: 1, clearance }));
  }
  holdTracks = true;
  await navigate(390, false);
  await click("Play Currents [TEST FIXTURE] in the player");
  await wait("window.__spotifyDouble?.plays === 1");
  assert.ok(heldTracks.length > 0);
  holdTracks = false;
  for (const requestId of heldTracks.splice(0)) {
    try {
      await call("Fetch.fulfillRequest", {
        requestId, responseCode: 200,
        responseHeaders: [{ name: "content-type", value: "application/json" }, { name: "access-control-allow-origin", value: origin }],
        body: Buffer.from(JSON.stringify(tracks)).toString("base64"),
      });
    } catch (error) {
      if (!error.message.includes("Invalid InterceptionId.")) throw error;
    }
  }
  await wait("document.body.innerText.includes('Fixture track 13')");
  await evaluate(`window.__spotifyDouble.emit('spotify:track:${trackId}')`);
  await wait("document.querySelector('#music-mini-player [role=status]').innerText.includes('Playing')", 2000);
  assert.equal(await evaluate("window.__spotifyDouble.plays"), 1, "catalogue updates must not replay");
  assert.deepEqual(await evaluate("window.__spotifyDouble.loads"), [], "catalogue updates must not reload");
  await evaluate("document.querySelector('#music-mini-player button').click()");
  console.log(JSON.stringify({ lateTrackMatches: "passed", mocked: true }));
  await navigate(390);
  await evaluate("window.__delaySpotifyApi = true");
  await click("Play Fixture track 7 in the player");
  await wait("Boolean(window.__spotifyDouble)");
  await evaluate("document.querySelector('#music-mini-player button').click()");
  await evaluate("window.__spotifyDouble.deliver()");
  await wait("!document.querySelector('#music-mini-player')");
  assert.equal(await evaluate("window.__spotifyDouble.creates"), 0, "late API must not create after close");
  await click("Play Fixture track 8 in the player");
  await wait("window.__spotifyDouble.plays === 1");
  await evaluate("document.querySelector('#music-mini-player button').click()");

  await navigate(390);
  await evaluate("window.__delaySpotifyApi = true");
  await click("Play Fixture track 7 in the player");
  await wait("document.querySelector('#music-mini-player [role=status]').innerText.includes('playback status unavailable')", 12000);
  await evaluate("window.__fallbackFrame = document.querySelector('#music-mini-player iframe'); window.__spotifyDouble.deliver()");
  assert.equal(await evaluate("window.__spotifyDouble.creates"), 0);
  await click("Play Fixture track 8 in the player");
  await wait(`document.querySelector('#music-mini-player iframe').src.endsWith('/track/${otherId}')`);
  assert.equal(await evaluate("window.__fallbackFrame === document.querySelector('#music-mini-player iframe')"), true);
  await evaluate("document.querySelector('#music-mini-player button').click()");
  failScript = true;
  await navigate(390);
  await click("Play Fixture track 7 in the player");
  await wait("document.querySelector('#music-mini-player [role=status]').innerText.includes('playback status unavailable')");
  await evaluate("document.querySelector('#music-mini-player button').click()");
  assert.deepEqual(interceptionErrors, []);
  assert.ok(requests.every((request) => request.method === "GET"), "no playback API writes");
  console.log(JSON.stringify({ lifecycle: "passed", mocked: true, scenarios: ["close-before-ready", "reopen", "timeout", "late API", "fallback replacement", "script failure"], cancelledInterceptions, evidence }));
  await send("Browser.close");
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: 999999, method: "Browser.close" }));
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 2000);
      socket.onclose = () => { clearTimeout(timer); resolve(); };
    });
  }
  socket?.close();
  if (chrome.exitCode === null) chrome.kill();
}
