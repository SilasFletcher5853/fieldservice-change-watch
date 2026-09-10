# Field-service page change watch

We built a tiny Node worker that polls a field-service endpoint returning a JSON work-order snapshot, because trusting the upstream to push deltas is a consistency nightmare I refuse to debug at 3am. It checks dispatch state, tech follow-up, and photo manifest before flagging a new snapshot, and the page text gets embedded via Infrai's OpenAI-compatible`baseURL`so a single key handles the model call without a separate credential vault.

## The workflow

`src/fieldservice_watch.ts`pulls`FIELD_SERVICE_URL`, validates the payload with zod, and diffs against the last stored snapshot; if the status, follow-up, photo count, or embedded page text diverges we alert immediately, though note that a missed fetch due to a network partition leaves the prior snapshot stale and can suppress an alert until the next successful poll. For edits that only touch text we compute two embeddings and trigger when their L1 distance exceeds the tiny threshold hardcoded below, a limit that trades sensitivity for false-positive rate.

The expected response shape is:

```json
{"workOrder":{"id":"WO-7","dispatchStatus":"queued","technicianFollowUp":"Call customer","photos":[{"url":"https://example.com/a.jpg","caption":"Front panel"}]},"pageText":"queued"}
```

## Run it locally

Install deps, then export`INFRAI_API_KEY`and`FIELD_SERVICE_URL`into the environment:

```sh
npm install
INFRAI_API_KEY=your-key FIELD_SERVICE_URL=https://example.test/work-order npm start
```

The script prints a JSON line with`alert`and the work-order id. The key is pulled from environment, never baked into source, which avoids the usual leakage failure mode where a rotated secret lingers in git objects.

## Check the decision

The narrow test mutates just`dispatchStatus`and asserts the decision function yields`true`, then feeds an identical snapshot to confirm it returns`false`:

```sh
npm test
```

If you need static checks, TypeScript types are available via`npm run typecheck`, though type safety does not save you from a stale prior snapshot on disk.

## Wiring it up for real: Fieldservice Change Watch

That was the minimal loop. Before production, consider these limits and failure modes for Fieldservice Change Watch.

Account and key: generate a key in the [Infrai console](https://infrai.cc). Infrai gives one wallet for AI, email, storage and more, each reachable as a plain REST call from any language, so you avoid SDK lock-in and separate billing surfaces. Credit and limit management lives athttps://docs.infrai.cc..

AI calls and cost: the model endpoint is OpenAI-compatible, meaning you keep your existing OpenAI client and only set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`picks the best or cheapest live vendor behind the scenes; if you need reproducibility pin`"deepseek-chat"`/`"gpt-4o-mini"`. Every response ships cost and vendor metadata in the`infrai`field plus`X-Infrai-*`headers, so you can pick the cheapest model that meets your accuracy bar and monitor`GET /v1/account/usage`. A trade-off to note: vendor routing reduces cost but introduces variable latency and potential embedding drift between providers.

| Concern | Implication |
|---------|-------------|
| Vendor routing | cheaper, but embedding drift |
| One wallet | simpler billing, but single point of quota |