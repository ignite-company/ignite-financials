import test from "node:test";
import assert from "node:assert/strict";
import {recentDailyRevenue} from "../src/dailyRevenueMath.js";
test("most recent ten calendar days crosses month boundaries",()=>{
 const payments=[{type:"income",category:"Retainer",date:"2026-10-30",amount:300},{type:"income",category:"Retainer",date:"2026-11-03",amount:200}];
 const rows=recentDailyRevenue(payments,"2026-11-03");
 assert.equal(rows.length,10);
 assert.equal(rows[0].date,"2026-11-03");
 assert.equal(rows[9].date,"2026-10-25");
 assert.equal(rows.find(x=>x.date==="2026-10-30").total,300);
 assert.equal(rows.find(x=>x.date==="2026-11-03").total,200);
});
