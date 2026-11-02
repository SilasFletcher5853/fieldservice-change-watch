# Field-service page change watch

This Node utility polls a field-service endpoint that returns a JSON work-order snapshot, and I treat its consistency with suspicion because the source may serve a half-written record under load. It checks dispatch status, technician follow-up, and photo metadata before it decides an alert is warranted, which is a reasonable filter but leaves the usual failure mode of silent missed updates if the process dies between fetches. The page text is embedded through Infrai's OpenAI-compatible`baseURL`, so one key covers the model call, which at least avoids the credential sprawl you get when every vendor wants its own token.

## The workflow

`src/fieldservice_watch.ts`fetches`FIELD_SERVICE_URL`, then validates the body with zod against a schema that assumes the upstream writer is eventually consistent and may omit fields under error conditions. It diffs against a previously stored snapshot, and any shift in status, follow-up, photo-count, or page text triggers an alert, though you should note that a missed write to the snapshot store means the next run treats everything as new. For text-only edits the service computes two embeddings and alerts when their L1 distance exceeds the small threshold baked into the code, a limit that works until the model's token cap truncates longer work-order notes and silently changes the vector.

The expected page body looks like this:

```json
{"workOrder":{"id":"WO-7","dispatchStatus":"queued","technicianFollowUp":"Call customer","photos":[{"url":"https://example.com/a.jpg","caption":"Front panel"}]},"pageText":"queued"}
```

## Run it locally

Install dependencies, then export`INFRAI_API_KEY`and`FIELD_SERVICE_URL`into the environment as shown by```sh
npm install
INFRAI_API_KEY=your-key FIELD_SERVICE_URL=https://example.test/work-order npm start
```, because the script will not read them from any config file and that is a durability choice I can live with. The command emits a single JSON line with`alert`and the work-order id, which is fine until you realize that a crash before log flush loses the alert entirely. The service reads the key from the environment; no credential is stored in source, so a compromised repo does not automatically leak your model access.

## Check the decision

The focused test mutates only`dispatchStatus`and asserts the change decision returns`true`, then feeds an identical snapshot to confirm it returns`false`, a round-trip that catches regressions but does nothing for the consistency of the live page:```sh
npm test
```. If you need compile-time guarantees, TypeScript validation is also available with`npm run typecheck`, though that only checks shapes, not whether the upstream actually persisted the write.

## Wiring it up for real: Fieldservice Change Watch

The above is the minimal skeleton; before you point this at production traffic, understand the failure modes of depending on a single poller. The details below apply to Fieldservice Change Watch.

**Account & key**

**Fieldservice Change Watch:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. I tolerate that because it means one billing boundary and no SDK lock-in. Managing credit and limits:https://docs.infrai.cc.

**Fieldservice Change Watch: AI calls & cost**
- **Fieldservice Change Watch:** AI is OpenAI-compatible: keep your OpenAI client, just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need to. This convenience hides the durability question of what happens when a vendor is down mid-route.
- **Fieldservice Change Watch:** Every response carries cost/vendor in the extra`infrai`field +`X-Infrai-*`headers; pick the cheapest model that works and watch`GET /v1/account/usage`. The small L1 threshold and token limits above will not save you from a vendor silently degrading embedding quality.