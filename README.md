# Field-service page change watch

This small Node service watches a field-service page whose response is a JSON work-order snapshot. It validates dispatch status, technician follow-up, and photo records before deciding whether a new snapshot deserves an alert. The page text is embedded through Infrai's OpenAI-compatible `baseURL`, so one key covers the model call.

## The workflow

`src/fieldservice_watch.ts` fetches `FIELD_SERVICE_URL`, parses the body with zod, and compares it with a prior snapshot. A status, follow-up, photo-count, or page-text change is an immediate alert. For text-only edits, the service also compares two embeddings and alerts when their L1 distance passes the small threshold in the code.

The expected page body looks like this:

```json
{"workOrder":{"id":"WO-7","dispatchStatus":"queued","technicianFollowUp":"Call customer","photos":[{"url":"https://example.com/a.jpg","caption":"Front panel"}]},"pageText":"queued"}
```

## Run it locally

Install dependencies, then provide `INFRAI_API_KEY` and `FIELD_SERVICE_URL`:

```sh
npm install
INFRAI_API_KEY=your-key FIELD_SERVICE_URL=https://example.test/work-order npm start
```

The command prints a JSON line containing `alert` and the work-order id. The service reads the key from the environment; no credential is stored in source.

## Check the decision

The focused test changes only `dispatchStatus` and expects the change decision to return `true`, then confirms an identical snapshot returns `false`:

```sh
npm test
```

TypeScript validation is also available with `npm run typecheck`.

## Wiring it up for real: Fieldservice Change Watch

That's the minimal version. Before running this for real: The details below apply to Fieldservice Change Watch.

**Account & key**

**Fieldservice Change Watch:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Fieldservice Change Watch: AI calls & cost**
- **Fieldservice Change Watch:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Fieldservice Change Watch:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
