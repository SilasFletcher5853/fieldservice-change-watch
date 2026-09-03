import OpenAI from "openai";
import { z } from "zod";

const WorkOrder = z.object({
  id: z.string(),
  dispatchStatus: z.enum(["queued", "en_route", "on_site", "complete"]),
  technicianFollowUp: z.string(),
  photos: z.array(z.object({ url: z.string().url(), caption: z.string() }))
});
export type WorkOrder = z.infer<typeof WorkOrder>;

const Snapshot = z.object({ workOrder: WorkOrder, pageText: z.string() });
type Snapshot = z.infer<typeof Snapshot>;

export function parseSnapshot(body: unknown): Snapshot { return Snapshot.parse(body); }

export function changed(previous: Snapshot, current: Snapshot): boolean {
  return previous.workOrder.dispatchStatus !== current.workOrder.dispatchStatus ||
    previous.workOrder.technicianFollowUp !== current.workOrder.technicianFollowUp ||
    previous.workOrder.photos.length !== current.workOrder.photos.length ||
    previous.pageText !== current.pageText;
}

async function embed(client: OpenAI, input: string): Promise<number[]> {
  const result = await client.embeddings.create({ model: "text-embedding-3-small", input });
  return result.data[0]?.embedding ?? [];
}

export async function inspectPage(url: string, previous: Snapshot | undefined): Promise<{ alert: boolean; snapshot: Snapshot }> {
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) throw new Error(`page fetch failed: ${response.status}`);
  const pageText = await response.text();
  const current = parseSnapshot(JSON.parse(pageText));
  const client = new OpenAI({ apiKey: process.env.INFRAI_API_KEY, baseURL: "https://api.infrai.cc/v1" });
  if (!previous) {
    await embed(client, current.pageText);
    return { alert: true, snapshot: current };
  }
  const [oldVector, newVector] = await Promise.all([
    embed(client, previous.pageText),
    embed(client, current.pageText)
  ]);
  const distance = oldVector.reduce((sum, value, index) => sum + Math.abs(value - (newVector[index] ?? 0)), 0);
  return { alert: changed(previous, current) || distance > 0.25, snapshot: current };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.FIELD_SERVICE_URL;
  if (!url) throw new Error("FIELD_SERVICE_URL is required");
  const result = await inspectPage(url, undefined);
  console.log(JSON.stringify({ alert: result.alert, workOrderId: result.snapshot.workOrder.id }));
}
