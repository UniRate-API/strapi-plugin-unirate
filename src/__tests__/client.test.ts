import { describe, it, expect, vi } from "vitest";
import {
  UniRateClient,
  UniRateError,
  AuthenticationError,
  RateLimitError,
  InvalidCurrencyError,
  InvalidRequestError,
  ProRequiredError,
} from "../client.js";

function makeFetch(status: number, body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

function makeClient(status: number, body: unknown) {
  return new UniRateClient({ apiKey: "test-key", fetch: makeFetch(status, body) });
}

describe("UniRateClient constructor", () => {
  it("throws when apiKey is empty", () => {
    expect(() => new UniRateClient({ apiKey: "" })).toThrow(UniRateError);
  });

  it("throws when fetch is not a function", () => {
    expect(
      () => new UniRateClient({ apiKey: "k", fetch: "not-a-fn" as unknown as typeof fetch }),
    ).toThrow(UniRateError);
  });

  it("constructs successfully with valid options", () => {
    const c = new UniRateClient({ apiKey: "k", fetch: vi.fn() });
    expect(c).toBeInstanceOf(UniRateClient);
  });
});

describe("getRate", () => {
  it("returns a number when `to` is provided", async () => {
    const c = makeClient(200, { rate: "0.92" });
    const rate = await c.getRate("USD", "EUR");
    expect(rate).toBe(0.92);
  });

  it("returns a rate map when `to` is omitted", async () => {
    const c = makeClient(200, { rates: { EUR: "0.92", GBP: "0.79" } });
    const rates = await c.getRate("USD");
    expect(rates).toEqual({ EUR: 0.92, GBP: 0.79 });
  });

  it("uppercases currency codes", async () => {
    const fetch = makeFetch(200, { rate: "0.92" });
    const c = new UniRateClient({ apiKey: "k", fetch });
    await c.getRate("usd", "eur");
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("from=USD");
    expect(url).toContain("to=EUR");
  });

  it("throws UniRateError on malformed single-rate response", async () => {
    const c = makeClient(200, {});
    await expect(c.getRate("USD", "EUR")).rejects.toThrow(UniRateError);
  });

  it("throws UniRateError on malformed all-rates response", async () => {
    const c = makeClient(200, {});
    await expect(c.getRate("USD")).rejects.toThrow(UniRateError);
  });
});

describe("convert", () => {
  it("returns converted amount as float", async () => {
    const c = makeClient(200, { result: "92.5" });
    expect(await c.convert("EUR", 100, "USD")).toBe(92.5);
  });

  it("throws on malformed response", async () => {
    const c = makeClient(200, {});
    await expect(c.convert("EUR", 100, "USD")).rejects.toThrow(UniRateError);
  });
});

describe("listCurrencies", () => {
  it("returns array of currency codes", async () => {
    const c = makeClient(200, { currencies: ["USD", "EUR", "GBP"] });
    expect(await c.listCurrencies()).toEqual(["USD", "EUR", "GBP"]);
  });

  it("throws on malformed response", async () => {
    const c = makeClient(200, { currencies: "not-array" });
    await expect(c.listCurrencies()).rejects.toThrow(UniRateError);
  });
});

describe("getVatRates", () => {
  it("returns all VAT rates when no country given", async () => {
    const body = { total_countries: 2, vat_rates: { DE: { vat_rate: 19 } } };
    const c = makeClient(200, body);
    expect(await c.getVatRates()).toEqual(body);
  });

  it("returns single country VAT data when country given", async () => {
    const body = { country: "DE", vat_data: { vat_rate: 19 } };
    const c = makeClient(200, body);
    expect(await c.getVatRates("DE")).toEqual(body);
  });
});

describe("error mapping", () => {
  it("throws AuthenticationError on 401", async () => {
    const c = makeClient(401, { error: "bad key" });
    await expect(c.getRate("USD", "EUR")).rejects.toThrow(AuthenticationError);
  });

  it("throws ProRequiredError on 403", async () => {
    const c = makeClient(403, { error: "pro required" });
    await expect(c.getRate("USD", "EUR")).rejects.toThrow(ProRequiredError);
  });

  it("throws InvalidCurrencyError on 404", async () => {
    const c = makeClient(404, { error: "not found" });
    await expect(c.getRate("USD", "EUR")).rejects.toThrow(InvalidCurrencyError);
  });

  it("throws RateLimitError on 429", async () => {
    const c = makeClient(429, { error: "rate limit" });
    await expect(c.getRate("USD", "EUR")).rejects.toThrow(RateLimitError);
  });

  it("throws InvalidRequestError on 400", async () => {
    const c = makeClient(400, { error: "bad request" });
    await expect(c.getRate("USD", "EUR")).rejects.toThrow(InvalidRequestError);
  });

  it("throws UniRateError on other status codes", async () => {
    const c = makeClient(503, { error: "unavailable" });
    await expect(c.getRate("USD", "EUR")).rejects.toThrow(UniRateError);
  });

  it("preserves status code on errors", async () => {
    const c = makeClient(429, {});
    try {
      await c.getRate("USD", "EUR");
    } catch (e) {
      expect((e as UniRateError).status).toBe(429);
    }
  });

  it("throws UniRateError on network failure", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const c = new UniRateClient({ apiKey: "k", fetch });
    await expect(c.getRate("USD", "EUR")).rejects.toThrow(UniRateError);
  });

  it("throws UniRateError on non-JSON response body", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve("<html>Service Unavailable</html>"),
    } as Response);
    const c = new UniRateClient({ apiKey: "k", fetch });
    await expect(c.getRate("USD", "EUR")).rejects.toThrow(UniRateError);
  });
});
