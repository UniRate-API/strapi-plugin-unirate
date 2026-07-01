import { describe, it, expect, vi, beforeEach } from "vitest";
import { makePlugin } from "../plugin.js";
import { UniRateError } from "../client.js";

const MOCK_RATES = { EUR: 0.92, GBP: 0.79 };
const MOCK_CURRENCIES = ["USD", "EUR", "GBP"];
const MOCK_VAT = { total_countries: 2, vat_rates: { DE: { vat_rate: 19 } } };

function makeFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

function makeCtx(query: Record<string, string> = {}) {
  return {
    query,
    body: undefined as unknown,
    status: undefined as number | undefined,
    throw: vi.fn().mockImplementation((code: number, msg: string) => {
      throw Object.assign(new Error(msg), { status: code });
    }),
  };
}

describe("makePlugin", () => {
  it("throws if apiKey is missing", () => {
    const orig = process.env.UNIRATE_API_KEY;
    delete process.env.UNIRATE_API_KEY;
    expect(() => makePlugin({})).toThrow(UniRateError);
    if (orig) process.env.UNIRATE_API_KEY = orig;
  });

  it("constructs successfully with apiKey in config", () => {
    const p = makePlugin({ apiKey: "test-key" });
    expect(p.client).toBeDefined();
    expect(p.service).toBeDefined();
    expect(p.controllers).toBeDefined();
    expect(p.routes.length).toBe(4);
  });
});

describe("service", () => {
  let fetchFn: ReturnType<typeof vi.fn>;
  let p: ReturnType<typeof makePlugin>;

  beforeEach(() => {
    fetchFn = vi.fn();
    p = makePlugin({ apiKey: "test-key", fetch: fetchFn as unknown as typeof globalThis.fetch });
  });

  it("getRate returns number when to is provided", async () => {
    fetchFn.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ rate: "0.92" })) });
    expect(await p.service.getRate("USD", "EUR")).toBe(0.92);
  });

  it("getRate returns map when to is omitted", async () => {
    fetchFn.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ rates: MOCK_RATES })) });
    expect(await p.service.getRate("USD")).toEqual(MOCK_RATES);
  });

  it("convert returns float", async () => {
    fetchFn.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ result: "92.5" })) });
    expect(await p.service.convert("EUR", 100, "USD")).toBe(92.5);
  });

  it("listCurrencies returns array", async () => {
    fetchFn.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ currencies: MOCK_CURRENCIES })) });
    expect(await p.service.listCurrencies()).toEqual(MOCK_CURRENCIES);
  });

  it("getVatRates returns VAT data", async () => {
    fetchFn.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(MOCK_VAT)) });
    expect(await p.service.getVatRates()).toEqual(MOCK_VAT);
  });
});

describe("controllers", () => {
  let fetchFn: ReturnType<typeof vi.fn>;
  let p: ReturnType<typeof makePlugin>;

  beforeEach(() => {
    fetchFn = vi.fn();
    p = makePlugin({ apiKey: "test-key", fetch: fetchFn as unknown as typeof globalThis.fetch });
  });

  describe("rate controller", () => {
    it("returns rate for base+target pair", async () => {
      fetchFn.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ rate: "0.92" })) });
      const ctx = makeCtx({ base: "USD", target: "EUR" });
      await p.controllers.rate(ctx);
      expect(ctx.body).toEqual({ base: "USD", target: "EUR", rate: 0.92 });
    });

    it("returns all rates when target is omitted", async () => {
      fetchFn.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ rates: MOCK_RATES })) });
      const ctx = makeCtx({ base: "USD" });
      await p.controllers.rate(ctx);
      expect(ctx.body).toEqual({ base: "USD", rates: MOCK_RATES });
    });

    it("calls ctx.throw on API error", async () => {
      fetchFn.mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve(JSON.stringify({ error: "bad key" })) });
      const ctx = makeCtx({ base: "USD", target: "EUR" });
      await expect(p.controllers.rate(ctx)).rejects.toThrow();
      expect(ctx.throw).toHaveBeenCalledWith(401, expect.any(String));
    });

    it("uses USD as default base", async () => {
      fetchFn.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ rates: MOCK_RATES })) });
      const ctx = makeCtx({});
      await p.controllers.rate(ctx);
      expect(fetchFn.mock.calls[0][0] as string).toContain("from=USD");
    });
  });

  describe("convert controller", () => {
    it("returns converted amount", async () => {
      fetchFn.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ result: "92.5" })) });
      const ctx = makeCtx({ from: "USD", to: "EUR", amount: "100" });
      await p.controllers.convert(ctx);
      expect(ctx.body).toEqual({ from: "USD", to: "EUR", amount: 100, result: 92.5 });
    });

    it("400s when `to` is missing", async () => {
      const ctx = makeCtx({ from: "USD" });
      await expect(p.controllers.convert(ctx)).rejects.toThrow();
      expect(ctx.throw).toHaveBeenCalledWith(400, expect.any(String));
    });

    it("calls ctx.throw on 429", async () => {
      fetchFn.mockResolvedValue({ ok: false, status: 429, text: () => Promise.resolve(JSON.stringify({})) });
      const ctx = makeCtx({ from: "USD", to: "EUR" });
      await expect(p.controllers.convert(ctx)).rejects.toThrow();
      expect(ctx.throw).toHaveBeenCalledWith(429, expect.any(String));
    });

    it("uses default amount of 1", async () => {
      fetchFn.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ result: "0.92" })) });
      const ctx = makeCtx({ from: "USD", to: "EUR" });
      await p.controllers.convert(ctx);
      expect((ctx.body as Record<string, unknown>).amount).toBe(1);
    });
  });

  describe("currencies controller", () => {
    it("returns currency list", async () => {
      fetchFn.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ currencies: MOCK_CURRENCIES })) });
      const ctx = makeCtx();
      await p.controllers.currencies(ctx);
      expect(ctx.body).toEqual({ currencies: MOCK_CURRENCIES });
    });

    it("propagates errors via ctx.throw", async () => {
      fetchFn.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve(JSON.stringify({})) });
      const ctx = makeCtx();
      await expect(p.controllers.currencies(ctx)).rejects.toThrow();
    });
  });

  describe("vat controller", () => {
    it("returns VAT rates without country", async () => {
      fetchFn.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(MOCK_VAT)) });
      const ctx = makeCtx();
      await p.controllers.vat(ctx);
      expect(ctx.body).toEqual(MOCK_VAT);
    });

    it("passes country query param", async () => {
      fetchFn.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ country: "DE" })) });
      const ctx = makeCtx({ country: "DE" });
      await p.controllers.vat(ctx);
      expect(fetchFn.mock.calls[0][0] as string).toContain("country=DE");
    });
  });
});

describe("routes", () => {
  it("defines 4 content-api routes", () => {
    const p = makePlugin({ apiKey: "test-key" });
    expect(p.routes).toHaveLength(4);
    expect(p.routes.map((r) => r.path)).toContain("/rate");
    expect(p.routes.map((r) => r.path)).toContain("/convert");
    expect(p.routes.map((r) => r.path)).toContain("/currencies");
    expect(p.routes.map((r) => r.path)).toContain("/vat");
  });

  it("all routes use GET method", () => {
    const p = makePlugin({ apiKey: "test-key" });
    expect(p.routes.every((r) => r.method === "GET")).toBe(true);
  });

  it("handlers reference unirate controller", () => {
    const p = makePlugin({ apiKey: "test-key" });
    expect(p.routes.every((r) => r.handler.startsWith("unirate."))).toBe(true);
  });
});
