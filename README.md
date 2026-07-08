# strapi-plugin-unirate

Strapi v5 plugin that integrates the [UniRate API](https://unirateapi.com) for currency exchange rates and VAT data. Registers four content-API routes and an injectable `unirate` service — your API key stays server-side, never exposed to clients.

## Install

```bash
npm install strapi-plugin-unirate
```

## Configuration

Set your API key as an environment variable:

```bash
UNIRATE_API_KEY=your_key_here
```

Or pass it via Strapi plugin config in `config/plugins.ts`:

```typescript
export default {
  unirate: {
    enabled: true,
    config: {
      apiKey: process.env.UNIRATE_API_KEY,
      // baseUrl: 'https://api.unirateapi.com',  // default
      // timeoutMs: 30000,                        // default
    },
  },
};
```

## Routes

The plugin registers these content-API routes (prefix: `/api/unirate`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/unirate/rate?base=USD&target=EUR` | Exchange rate (single or all) |
| GET | `/api/unirate/convert?from=USD&to=EUR&amount=100` | Convert amount |
| GET | `/api/unirate/currencies` | List supported currencies |
| GET | `/api/unirate/vat?country=DE` | VAT rates (optional country filter) |

Routes have no Strapi auth by default — add Strapi API token restrictions in the admin panel as needed.

## Service usage

Access the service in lifecycle hooks, custom controllers, or middleware:

```typescript
// In a Strapi lifecycle hook or custom controller
const unirate = strapi.plugin('unirate').service('unirate');

// Get a single rate
const rate = await unirate.getRate('USD', 'EUR');   // → 0.92

// Get all rates for a base
const rates = await unirate.getRate('USD');          // → { EUR: 0.92, GBP: 0.79, ... }

// Convert an amount
const result = await unirate.convert('EUR', 100, 'USD');  // → 92.00

// List supported currencies
const currencies = await unirate.listCurrencies();   // → ['USD', 'EUR', 'GBP', ...]

// VAT rates
const vat = await unirate.getVatRates();             // all countries
const de  = await unirate.getVatRates('DE');         // single country
```

## Error handling

All errors extend `UniRateError`:

```typescript
import { UniRateError, AuthenticationError, RateLimitError, ProRequiredError } from 'strapi-plugin-unirate';

try {
  const rate = await unirate.getRate('USD', 'EUR');
} catch (err) {
  if (err instanceof AuthenticationError) { /* invalid key */ }
  if (err instanceof RateLimitError)      { /* slow down */   }
  if (err instanceof ProRequiredError)    { /* upgrade plan */}
}
```

## Free vs Pro tier

Free-tier endpoints: rates, convert, currencies, VAT rates. Historical data and time series require a [Pro subscription](https://unirateapi.com/pricing).

## Related packages

<!-- unirate-ecosystem-start -->
**UniRate API client libraries:** [Python](https://github.com/UniRate-API/unirate-api-python) · [Node.js](https://github.com/UniRate-API/unirate-api-nodejs) · [Go](https://github.com/UniRate-API/unirate-api-go) · [Rust](https://github.com/UniRate-API/unirate-api-rust) · [Ruby](https://github.com/UniRate-API/unirate-api-ruby) · [PHP](https://github.com/UniRate-API/unirate-api-php) · [Java](https://github.com/UniRate-API/unirate-api-java) · [Swift](https://github.com/UniRate-API/unirate-api-swift) · [.NET](https://github.com/UniRate-API/unirate-api-dotnet)

**Framework integrations:** [Next.js](https://github.com/UniRate-API/next-unirate) · [Nuxt](https://github.com/UniRate-API/nuxt-unirate) · [SvelteKit](https://github.com/UniRate-API/sveltekit-unirate) · [Astro](https://github.com/UniRate-API/astro-unirate) · [NestJS](https://github.com/UniRate-API/nestjs-unirate) · [Eleventy](https://github.com/UniRate-API/eleventy-unirate) · [React](https://github.com/UniRate-API/react-unirate) · [Vue](https://github.com/UniRate-API/vue-unirate) · [tRPC](https://github.com/UniRate-API/trpc-unirate) · **Strapi** (this package)

**CMS & e-commerce:** [WordPress](https://github.com/UniRate-API/unirate-currency-converter) · [Directus](https://github.com/UniRate-API/directus-extension-unirate) · [Medusa](https://github.com/UniRate-API/medusa-plugin-unirate) · [Hugo](https://github.com/UniRate-API/hugo-unirate) · [Jekyll](https://github.com/UniRate-API/jekyll-unirate)

**Data & AI:** [LangChain Python](https://github.com/UniRate-API/langchain-unirate) · [FastAPI](https://github.com/UniRate-API/fastapi-unirate) · [Flask](https://github.com/UniRate-API/flask-unirate) · [Django REST](https://github.com/UniRate-API/djangorestframework-unirate) · [dbt](https://github.com/UniRate-API/dbt-unirate) · [Airflow](https://github.com/UniRate-API/airflow-provider-unirate)

**Other:** [MCP server](https://github.com/UniRate-API/unirate-mcp) · [CLI](https://github.com/UniRate-API/unirate-cli) · [Obsidian](https://github.com/UniRate-API/obsidian-currency) · [money gem](https://github.com/UniRate-API/money-unirate-api) · [laravel-money](https://github.com/UniRate-API/laravel-money-unirate)
<!-- unirate-ecosystem-end -->

<!-- unirate-ecosystem-footer:start -->
## UniRate ecosystem

UniRate ships official integrations for 40+ ecosystems, all maintained under the
[UniRate-API](https://github.com/UniRate-API) org.

**Core clients (9 languages)**
[Python](https://github.com/UniRate-API/unirate-api-python) ·
[Node.js / TypeScript](https://github.com/UniRate-API/unirate-api-nodejs) ·
[Go](https://github.com/UniRate-API/unirate-api-go) ·
[Rust](https://github.com/UniRate-API/unirate-api-rust) ·
[Java](https://github.com/UniRate-API/unirate-api-java) ·
[Ruby](https://github.com/UniRate-API/unirate-api-ruby) ·
[PHP](https://github.com/UniRate-API/unirate-api-php) ·
[.NET](https://github.com/UniRate-API/unirate-api-dotnet) ·
[Swift](https://github.com/UniRate-API/unirate-api-swift)

**JavaScript / TypeScript**
[React](https://github.com/UniRate-API/react-unirate) ·
[Next.js](https://github.com/UniRate-API/next-unirate) ·
[Remix](https://github.com/UniRate-API/remix-unirate) ·
[SvelteKit](https://github.com/UniRate-API/sveltekit-unirate) ·
[Vue](https://github.com/UniRate-API/vue-unirate) ·
[Angular](https://github.com/UniRate-API/angular-unirate) ·
[Nuxt](https://github.com/UniRate-API/nuxt-unirate) ·
[NestJS](https://github.com/UniRate-API/nestjs-unirate) ·
[tRPC](https://github.com/UniRate-API/trpc-unirate)

**Static-site generators**
[Astro](https://github.com/UniRate-API/astro-unirate) ·
[Eleventy](https://github.com/UniRate-API/eleventy-unirate) ·
[Hugo](https://github.com/UniRate-API/hugo-unirate) ·
[Jekyll](https://github.com/UniRate-API/jekyll-unirate)

**CMS & e-commerce**
[Wagtail](https://github.com/UniRate-API/wagtail-unirate) ·
[WordPress](https://github.com/UniRate-API/unirate-currency-converter) ·
[WooCommerce](https://github.com/UniRate-API/unirate-woocs) ·
[Drupal](https://github.com/UniRate-API/drupal-unirate) ·
[Strapi](https://github.com/UniRate-API/strapi-plugin-unirate) ·
[Medusa](https://github.com/UniRate-API/medusa-plugin-unirate) ·
[Symfony](https://github.com/UniRate-API/unirate-bundle) ·
[Laravel](https://github.com/UniRate-API/laravel-money-unirate) ·
[Directus](https://github.com/UniRate-API/directus-extension-unirate)

**Data, AI & backend**
[LangChain (Python)](https://github.com/UniRate-API/langchain-unirate) ·
[LangChain.js](https://github.com/UniRate-API/langchain-js-unirate) ·
[FastAPI](https://github.com/UniRate-API/fastapi-unirate) ·
[Flask](https://github.com/UniRate-API/flask-unirate) ·
[Django REST Framework](https://github.com/UniRate-API/djangorestframework-unirate) ·
[Apache Airflow](https://github.com/UniRate-API/airflow-provider-unirate) ·
[dbt](https://github.com/UniRate-API/dbt-unirate)

**Platform & tools**
[MCP server](https://github.com/UniRate-API/unirate-mcp) ·
[CLI](https://github.com/UniRate-API/unirate-cli) ·
[Cloudflare Workers](https://github.com/UniRate-API/cloudflare-workers-unirate) ·
[Home Assistant](https://github.com/UniRate-API/unirate-home-assistant) ·
[n8n](https://github.com/UniRate-API/n8n-nodes-unirate) ·
[Google Sheets](https://github.com/UniRate-API/unirate-sheets) ·
[VS Code](https://github.com/UniRate-API/vscode-unirate) ·
[Obsidian](https://github.com/UniRate-API/obsidian-currency)

**Money library bridges**
[money gem (Ruby)](https://github.com/UniRate-API/money-unirate-api) ·
[NodaMoney (.NET)](https://github.com/UniRate-API/UniRateApi.NodaMoney)

Get a free API key at [unirateapi.com](https://unirateapi.com).
<!-- unirate-ecosystem-footer:end -->

## License

MIT © Unirate Team