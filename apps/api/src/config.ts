import { z } from "zod";

/**
 * Centralized, validated configuration. `loadConfig()` is the single place
 * environment variables are read; everything downstream consumes the typed
 * AppConfig object. Boots fail fast with a readable message on invalid env.
 */

export const ARTIST_IMAGE_PROVIDERS = ["theaudiodb", "fanart"] as const;
export const ALBUM_IMAGE_PROVIDERS = ["coverartarchive", "theaudiodb"] as const;

export type ArtistImageProvider = (typeof ARTIST_IMAGE_PROVIDERS)[number];
export type AlbumImageProvider = (typeof ALBUM_IMAGE_PROVIDERS)[number];

const providerOrderSchema = <T extends readonly [string, ...string[]]>(
  allowed: T
) =>
  z
    .string()
    .min(1)
    .transform((value, ctx) => {
      const names = value
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0);
      const unique = [...new Set(names)];
      for (const name of unique) {
        if (!(allowed as readonly string[]).includes(name)) {
          ctx.addIssue({
            code: "custom",
            message: `unknown provider "${name}"; allowed: ${allowed.join(", ")}`
          });
        }
      }
      return unique as Array<T[number]>;
    });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  CORS_ALLOWED_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  /**
   * Proxies whose X-Forwarded-For is trusted: "false" (default, use the socket
   * address), a hop count such as "1", or comma-separated IPs/CIDRs.
   * "true" is rejected because it trusts any client-supplied header.
   */
  TRUST_PROXY: z
    .string()
    .trim()
    .default("false")
    .refine((v) => v.toLowerCase() !== "true", "TRUST_PROXY=true trusts arbitrary X-Forwarded-For; use a hop count or IP/CIDR list"),

  /** Identifying User-Agent for provider requests (required by MusicBrainz). */
  MEDIA_USER_AGENT: z
    .string()
    .min(1)
    .default("worlds-fm/0.1 (+https://worlds.fm)"),

  /** TheAudioDB v1 key. The documented free development key is "123". */
  THEAUDIODB_API_KEY: z.string().min(1).default("123"),
  /** Fanart.tv API key. When unset or blank, the fanart adapter disables itself. */
  FANART_API_KEY: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(1).optional()
  ),

  /**
   * Qloo Insights API. Server-side only: the key is sent as the `x-api-key`
   * header and must never reach the browser or a NEXT_PUBLIC_* variable.
   * When the key is unset or blank, Qloo features report themselves as disabled.
   */
  QLOO_API_BASE_URL: z.string().url().default("https://hackathon.api.qloo.com"),
  QLOO_API_KEY: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(1).optional()
  ),

  /** Qloo HTTP tuning. Requests are small GETs; keep timeouts and retries tight. */
  QLOO_HTTP_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(8000),
  QLOO_HTTP_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
  /** Private server-side cache only; Qloo allows this, but not public storage. */
  QLOO_CACHE_TTL_MS: z.coerce.number().int().min(0).default(3_600_000),
  QLOO_NEGATIVE_CACHE_TTL_MS: z.coerce.number().int().min(0).default(300_000),
  QLOO_CACHE_MAX_ENTRIES: z.coerce.number().int().min(10).default(500),
  /** Per-client request cap for /api/v1/qloo/* (each request may spend quota). */
  QLOO_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(600).default(20),

  MEDIA_ARTIST_PROVIDER_ORDER: providerOrderSchema(ARTIST_IMAGE_PROVIDERS).prefault(
    "theaudiodb,fanart"
  ),
  MEDIA_ALBUM_PROVIDER_ORDER: providerOrderSchema(ALBUM_IMAGE_PROVIDERS).prefault(
    "coverartarchive,theaudiodb"
  ),

  MEDIA_HTTP_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(8000),
  MEDIA_HTTP_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  MEDIA_HTTP_RETRY_BASE_MS: z.coerce.number().int().min(25).default(300),
  MUSICBRAINZ_MIN_INTERVAL_MS: z.coerce.number().int().min(0).default(1100),

  MEDIA_CACHE_TTL_MS: z.coerce.number().int().min(0).default(86_400_000),
  MEDIA_NEGATIVE_CACHE_TTL_MS: z.coerce.number().int().min(0).default(300_000),
  MEDIA_CACHE_MAX_ENTRIES: z.coerce.number().int().min(10).default(1000)
});

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  trustProxy: boolean | number | string[];
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  corsAllowedOrigin: string[];
  mediaUserAgent: string;
  theAudioDbApiKey: string;
  fanartApiKey: string | undefined;
  qlooApiBaseUrl: string;
  qlooApiKey: string | undefined;
  qlooHttpTimeoutMs: number;
  qlooHttpRetries: number;
  qlooCacheTtlMs: number;
  qlooNegativeCacheTtlMs: number;
  qlooCacheMaxEntries: number;
  qlooRateLimitPerMinute: number;
  artistProviderOrder: ArtistImageProvider[];
  albumProviderOrder: AlbumImageProvider[];
  mediaHttpTimeoutMs: number;
  mediaHttpRetries: number;
  mediaHttpRetryBaseMs: number;
  musicBrainzMinIntervalMs: number;
  mediaCacheTtlMs: number;
  mediaNegativeCacheTtlMs: number;
  mediaCacheMaxEntries: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(`Invalid environment configuration: ${issues}`);
  }
  const cfg = parsed.data;
  return {
    nodeEnv: cfg.NODE_ENV,
    host: cfg.HOST,
    port: cfg.PORT,
    trustProxy: parseTrustProxy(cfg.TRUST_PROXY),
    logLevel: cfg.LOG_LEVEL,
    corsAllowedOrigin: cfg.CORS_ALLOWED_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    mediaUserAgent: cfg.MEDIA_USER_AGENT,
    theAudioDbApiKey: cfg.THEAUDIODB_API_KEY,
    fanartApiKey: cfg.FANART_API_KEY,
    // Normalized so callers can concatenate paths without double slashes.
    qlooApiBaseUrl: cfg.QLOO_API_BASE_URL.replace(/\/+$/, ""),
    qlooApiKey: cfg.QLOO_API_KEY,
    qlooHttpTimeoutMs: cfg.QLOO_HTTP_TIMEOUT_MS,
    qlooHttpRetries: cfg.QLOO_HTTP_RETRIES,
    qlooCacheTtlMs: cfg.QLOO_CACHE_TTL_MS,
    qlooNegativeCacheTtlMs: cfg.QLOO_NEGATIVE_CACHE_TTL_MS,
    qlooCacheMaxEntries: cfg.QLOO_CACHE_MAX_ENTRIES,
    qlooRateLimitPerMinute: cfg.QLOO_RATE_LIMIT_PER_MINUTE,
    artistProviderOrder: cfg.MEDIA_ARTIST_PROVIDER_ORDER as ArtistImageProvider[],
    albumProviderOrder: cfg.MEDIA_ALBUM_PROVIDER_ORDER as AlbumImageProvider[],
    mediaHttpTimeoutMs: cfg.MEDIA_HTTP_TIMEOUT_MS,
    mediaHttpRetries: cfg.MEDIA_HTTP_RETRIES,
    mediaHttpRetryBaseMs: cfg.MEDIA_HTTP_RETRY_BASE_MS,
    musicBrainzMinIntervalMs: cfg.MUSICBRAINZ_MIN_INTERVAL_MS,
    mediaCacheTtlMs: cfg.MEDIA_CACHE_TTL_MS,
    mediaNegativeCacheTtlMs: cfg.MEDIA_NEGATIVE_CACHE_TTL_MS,
    mediaCacheMaxEntries: cfg.MEDIA_CACHE_MAX_ENTRIES
  };
}

function parseTrustProxy(value: string): boolean | number | string[] {
  const v = value.trim();
  if (v === "" || v.toLowerCase() === "false") return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v.split(",").map((part) => part.trim()).filter(Boolean);
}
