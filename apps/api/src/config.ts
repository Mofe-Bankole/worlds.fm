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
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  corsAllowedOrigin: string[];
  mediaUserAgent: string;
  theAudioDbApiKey: string;
  fanartApiKey: string | undefined;
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
    logLevel: cfg.LOG_LEVEL,
    corsAllowedOrigin: cfg.CORS_ALLOWED_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    mediaUserAgent: cfg.MEDIA_USER_AGENT,
    theAudioDbApiKey: cfg.THEAUDIODB_API_KEY,
    fanartApiKey: cfg.FANART_API_KEY,
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
