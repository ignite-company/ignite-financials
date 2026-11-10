import test from "node:test";
import assert from "node:assert/strict";
import {summarizePayments,getMostRecentPayment,splitPayment} from "../src/paymentMath.js";

const buckets=[{id:"tax",percentage:25,sort_order:0},{id:"ops",percentage:25,sort_order:1},{id:"owner",percentage:35,sort_order:2},{id:"cash",percentage:15,sort_order:3}];
test("payment average is all eligible receipts divided by their count",()=>{
 assert.deepEqual(summarizePayments([{type:"income",category:"Client payment",amount:"2000"},{type:"income",category:"Retainer",amount:"875.50"},{type:"income",category:"Transfer",amount:"1000"}]),{total:2875.5,count:2,average:1437.75});
 assert.deepEqual(summarizePayments([]),{total:0,count:0,average:0});
});
test("last entered payment wins even when its received date is backdated",()=>{
 const p=[{id:"a",date:"2026-11-09",created_at:"2026-11-09T10:00:00Z"},{id:"b",date:"2026-10-01",created_at:"2026-11-10T10:00:00Z"}];
 assert.equal(getMostRecentPayment(p).id,"b");
});
test("only latest payment is split, precise to the cent",()=>{
 assert.deepEqual(splitPayment({id:"a",amount:2000},buckets,[]).map(r=>r.amount),[500,500,700,300]);
 const parts=splitPayment({id:"b",amount:100.01},buckets,[]);
 assert.equal(Math.round(parts.reduce((n,r)=>n+r.amount,0)*100),10001);
});
test("old snapshots stay intact if percentages are later changed",()=>{
 const saved=[{transaction_id:"p",bucket_id:"tax",amount:200},{transaction_id:"p",bucket_id:"ops",amount:200},{transaction_id:"p",bucket_id:"owner",amount:500},{transaction_id:"p",bucket_id:"cash",amount:100}];
 assert.deepEqual(splitPayment({id:"p",amount:1000},buckets.map(b=>({...b,percentage:25})),saved).map(r=>r.amount),[200,200,500,100]);
});
