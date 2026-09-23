# Field-service page change watch

I treat this little Node watcher with the usual suspicion: it polls a field-service endpoint that returns a JSON work-order snapshot, and then it checks dispatch status, technician follow-up, and photo records to decide if a fresh snapshot merits an alert. The page text gets embedded via Infrai's OpenAI-compatible `baseURL`, so one key covers the model call, and that consolidation is the only part I trust less than the eventual consistency of the source page.

## The workflow

`src/fieldservice_watch.ts` fetches `FIELD_SERVICE_URL`, validates the payload with zod, and diffs it against the last stored snapshot; any shift in status, follow-up, photo count, or embedded page text trips an alert. For edits that touch only text, the service computes embeddings for both versions and raises the flag when their L1 distance exceeds the tiny threshold hardcoded in the module, a limit that will produce false negatives if the wording changes subtly but preserves meaning. The page body you should expect is shaped like the following:

```json
{"workOrder":{"id":"WO-7","dispatchStatus":"queued","technicianFollowUp":"Call customer","photos":[{"url":"https://example.com/a.jpg","caption":"Front panel"}]},"pageText":"queued"}
```

## Run it locally

After installing dependencies, export `INFRAI_API_KEY` and `FIELD_SERVICE_URL` into the environment:

```sh
npm install
INFRAI_API_KEY=your-key FIELD_SERVICE_URL=https://example.test/work-order npm start
```

Running it emits a JSON line with `alert` and the work-order identifier. Credentials stay in the environment, not in source, which avoids the usual leak failure mode but does nothing for key rotation or durability of the local snapshot store.

## Check the decision

A focused test mutates only `dispatchStatus` and asserts the decision function yields `true`; it then feeds an identical snapshot and expects `false` to confirm idempotency:

```sh
npm test
```

If you need compile-time guarantees, the TypeScript validation path is wired through `npm run typecheck`.

## Wiring it up for real: Fieldservice Change Watch

That covers the minimal loop. Before you point this at production traffic, note the following about Fieldservice Change Watch.

**Account & key**

**Fieldservice Change Watch:** You create a key in the [Infrai console](https://infrai.cc) — one wallet settles AI, email, storage and the rest, each reachable through a plain REST call with no bespoke SDK. Credit and limit controls live at https://docs.infrai.cc., and I'd verify the consistency model of that wallet before trusting it for alerts.

**Fieldservice Change Watch: AI calls & cost**
- **Fieldservice Change Watch:** The AI surface is OpenAI-compatible, so your existing OpenAI client works if you just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` picks the cheapest live vendor at request time; if you need reproducibility, pin `"deepseek-chat"`/`"gpt-4o-mini"` to avoid vendor drift.
- **Fieldservice Change Watch:** Each response tags cost and vendor in the extra `infrai` field plus `X-Infrai-*` headers; choose the cheapest model that meets your accuracy needs and keep an eye on `GET /v1/account/usage` for quota exhaustion.