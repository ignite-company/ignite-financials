import test from "node:test";
import assert from "node:assert/strict";
import { summarizeSpending } from "../src/spendingMath.js";
const cat=[{id:"takeout",name:"Takeout"},{id:"payments",name:"Bills"}];
const tx=[
 {id:"a",amount:"6.70",pending:true,exclude_from_spending:false,spend_category_id:"takeout"},
 {id:"b",amount:"25.00",pending:true,exclude_from_spending:true,spend_category_id:"payments"},
 {id:"c",amount:"9.25",pending:false,exclude_from_spending:false,spend_category_id:"takeout"},
 {id:"d",amount:"40.00",pending:false,exclude_from_spending:false,spend_category_id:null},
 {id:"deposit",amount:"-250.00",pending:false,exclude_from_spending:false,spend_category_id:null}
];
test("category cards include excluded and pending purchases while total spending excludes marked items",()=>{
 const r=summarizeSpending(tx,cat);
 assert.equal(r.purchases.length,4);
 assert.equal(r.spending.length,3);
 assert.ok(Math.abs(r.spendingTotal-55.95)<0.001);
 assert.equal(r.pendingTotal,6.7);
 assert.equal(r.excludedTotal,25);
 assert.equal(r.uncategorized.count,1);
 const takeout=r.categoryCards.find(c=>c.id==="takeout");
 assert.equal(takeout.count,2);
 assert.ok(Math.abs(takeout.total-15.95)<0.001);
 assert.equal(takeout.pendingCount,1);
 const bills=r.categoryCards.find(c=>c.id==="payments");
 assert.equal(bills.total,25);
 assert.equal(bills.count,1);
 assert.equal(bills.excludedCount,1);
 assert.equal(r.categoryCards.reduce((n,c)=>n+c.count,0)+r.uncategorized.count,4);
});
test("changing a transaction category recomputes the card totals and purchase counts",()=>{
 const original=summarizeSpending(tx,cat);
 const moved=summarizeSpending(tx.map(t=>t.id==="c"?{...t,spend_category_id:"payments"}:t),cat);
 assert.equal(original.categoryCards.find(c=>c.id==="takeout").count,2);
 assert.equal(moved.categoryCards.find(c=>c.id==="takeout").count,1);
 assert.equal(moved.categoryCards.find(c=>c.id==="payments").count,2);
 assert.equal(moved.spendingTotal,original.spendingTotal);
});
test("deleted categories put transactions in Uncategorized without discarding their amounts",()=>{
 const r=summarizeSpending(tx,[cat[0]]);
 assert.equal(r.uncategorized.count,2);
 assert.equal(r.uncategorized.total,65);
});
test("empty month and no categories render 0 without exceptions",()=>{
 const r=summarizeSpending([] ,[]);
 assert.equal(r.spendingTotal,0);
 assert.deepEqual(r.categoryCards,[]);
 assert.equal(r.uncategorized.count,0);
});
