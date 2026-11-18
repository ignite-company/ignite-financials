import test from "node:test";
import assert from "node:assert/strict";
import {compareBankTransactions} from "../src/bankTransactionOrder.js";

const t=(id,date,first_seen_at,category="")=>({id,date,first_seen_at,spend_category_id:category});

test("transactions from the same date stay in place when categories change",()=>{
 const a=t("a","2026-11-18","2026-11-18T12:00:00Z");
 const b=t("b","2026-11-18","2026-11-18T11:00:00Z");
 const c=t("c","2026-11-18","2026-11-18T10:00:00Z");
 const first=[c,b,a].sort(compareBankTransactions).map(x=>x.id);
 const second=[{...b,spend_category_id:"food",updated_at:"2026-11-19"},a,c]
  .sort(compareBankTransactions).map(x=>x.id);
 assert.deepEqual(first,["a","b","c"]);
 assert.deepEqual(second,first);
});

test("new transactions for the same day go to the top",()=>{
 const old=t("old","2026-11-18","2026-11-18T11:00:00Z");
 const fresh=t("new","2026-11-18","2026-11-18T12:00:00Z");
 assert.deepEqual([old,fresh].sort(compareBankTransactions).map(x=>x.id),["new","old"]);
});

test("newer bank dates take priority and legacy ties have a fixed ID order",()=>{
 const rows=[
  t("z","2026-11-17",null),
  t("b","2026-11-18",null),
  t("a","2026-11-18",null)
 ];
 assert.deepEqual(rows.sort(compareBankTransactions).map(x=>x.id),["a","b","z"]);
});
