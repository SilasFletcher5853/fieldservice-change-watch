import assert from "node:assert/strict";
import { changed, parseSnapshot } from "./fieldservice_watch.js";

const base = parseSnapshot({ workOrder: { id: "WO-7", dispatchStatus: "queued", technicianFollowUp: "Call customer", photos: [{ url: "https://example.com/a.jpg", caption: "Front panel" }] }, pageText: "queued" });
const moved = parseSnapshot({
  pageText: base.pageText,
  workOrder: {
    id: base.workOrder.id,
    dispatchStatus: "en_route",
    technicianFollowUp: base.workOrder.technicianFollowUp,
    photos: base.workOrder.photos
  }
});
assert.equal(changed(base, moved), true);
assert.equal(changed(base, base), false);
console.log("fieldservice change decision: pass");
