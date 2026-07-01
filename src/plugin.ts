import { UniRateClient, UniRateError } from "./client.js";
import type {
  AuthenticationError,
  InvalidCurrencyError,
  InvalidRequestError,
  ProRequiredError,
  RateLimitError,
} from "./client.js";

export type {
  UniRateError,
  AuthenticationError,
  InvalidCurrencyError,
  InvalidRequestError,
  ProRequiredError,
  RateLimitError,
};

export interface UniRatePluginConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Injected fetch for testing; defaults to globalThis.fetch */
  fetch?: typeof fetch;
}

type StrapiCtx = {
  query?: Record<string, string>;
  body?: unknown;
  status?: number;
  throw?: (code: number, msg: string) => never;
};

function mapError(err: unknown, ctx: StrapiCtx) {
  if (err instanceof UniRateError) {
    const status = err.status ?? 500;
    if (ctx.throw) ctx.throw(status, err.message);
    ctx.status = status;
    ctx.body = { error: err.message };
    return;
  }
  if (ctx.throw) ctx.throw(500, "Internal server error");
  ctx.status = 500;
  ctx.body = { error: "Internal server error" };
}

export function makePlugin(config: UniRatePluginConfig) {
  const apiKey = config.apiKey ?? process.env.UNIRATE_API_KEY ?? "";
  if (!apiKey) throw new UniRateError("strapi-plugin-unirate: UNIRATE_API_KEY is not set");

  const client = new UniRateClient({
    apiKey,
    baseUrl: config.baseUrl ?? process.env.UNIRATE_API_BASE_URL,
    timeoutMs: config.timeoutMs,
    fetch: config.fetch,
  });

  const service = {
    async getRate(from: string, to?: string): Promise<number | Record<string, number>> {
      return client.getRate(from, to);
    },
    async convert(to: string, amount: number, from: string): Promise<number> {
      return client.convert(to, amount, from);
    },
    async listCurrencies(): Promise<string[]> {
      return client.listCurrencies();
    },
    async getVatRates(country?: string): Promise<unknown> {
      return client.getVatRates(country);
    },
  };

  const controllers = {
    async rate(ctx: StrapiCtx) {
      const { base = "USD", target } = ctx.query ?? {};
      try {
        const result = await service.getRate(base, target);
        ctx.body = typeof result === "number"
          ? { base, target, rate: result }
          : { base, rates: result };
      } catch (err) {
        mapError(err, ctx);
      }
    },

    async convert(ctx: StrapiCtx) {
      const { from = "USD", to, amount = "1" } = ctx.query ?? {};
      if (!to) {
        if (ctx.throw) ctx.throw(400, "Missing required query param: to");
        ctx.status = 400;
        ctx.body = { error: "Missing required query param: to" };
        return;
      }
      try {
        const result = await service.convert(to, Number(amount), from);
        ctx.body = { from, to, amount: Number(amount), result };
      } catch (err) {
        mapError(err, ctx);
      }
    },

    async currencies(ctx: StrapiCtx) {
      try {
        const currencies = await service.listCurrencies();
        ctx.body = { currencies };
      } catch (err) {
        mapError(err, ctx);
      }
    },

    async vat(ctx: StrapiCtx) {
      const { country } = ctx.query ?? {};
      try {
        ctx.body = await service.getVatRates(country);
      } catch (err) {
        mapError(err, ctx);
      }
    },
  };

  const routes = [
    { method: "GET", path: "/rate", handler: "unirate.rate", config: { auth: false } },
    { method: "GET", path: "/convert", handler: "unirate.convert", config: { auth: false } },
    { method: "GET", path: "/currencies", handler: "unirate.currencies", config: { auth: false } },
    { method: "GET", path: "/vat", handler: "unirate.vat", config: { auth: false } },
  ];

  return { client, service, controllers, routes };
}

const plugin = {
  config: {
    default: {
      apiKey: undefined as string | undefined,
      baseUrl: undefined as string | undefined,
      timeoutMs: 30_000,
    },
    validator(cfg: UniRatePluginConfig) {
      const key = cfg.apiKey ?? process.env.UNIRATE_API_KEY;
      if (!key) throw new Error("strapi-plugin-unirate: UNIRATE_API_KEY env var or plugin config.apiKey is required");
    },
  },

  register({ strapi }: { strapi: { config: { get: (k: string) => UniRatePluginConfig } } }) {
    const cfg = strapi.config.get("plugin::unirate") as UniRatePluginConfig;
    (strapi as unknown as Record<string, unknown>)["_uniratePlugin"] = makePlugin(cfg);
  },
};

export default plugin;
