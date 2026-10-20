import test from "node:test";
import assert from "node:assert/strict";
import {summarizeInflows,INFLOW_TYPES} from "../src/inflowMath.js";

const bank=[
 {id:"a",amount:-250,pending:false,inflow_type:"business_revenue"},
 {id:"b",amount:-50,pending:false,inflow_type:"personal_income"},
 {id:"c",amount:-100,pending:false,inflow_type:"transfer"},
 {id:"d",amount:-25,pending:true,inflow_type:"refund"},
 {id:"e",amount:-15,pending:false,inflow_type:null},
 {id:"f",amount:60,pending:false,inflow_type:null},
 {id:"g",amount:-10,pending:false,inflow_type:"business_revenue"}
];
test("each credit is grouped exactly once; purchases are excluded",()=>{
 const result=summarizeInflows(bank);
 assert.equal(result.deposits.length,6);
 assert.equal(result.total,450);
 assert.equal(result.posted,425);
 assert.equal(result.pending,25);
 assert.equal(result.groups.reduce((sum,x)=>sum+x.count,0),result.deposits.length);
 assert.equal(result.groups.reduce((sum,x)=>sum+x.total,0),result.total);
 assert.equal(result.groups.find(x=>x.id==="business_revenue").total,260);
 assert.equal(result.groups.find(x=>x.id==="personal_income").total,50);
 assert.equal(result.groups.find(x=>x.id==="transfer").total,100);
 assert.equal(result.groups.find(x=>x.id==="refund").total,25);
 assert.equal(result.groups.find(x=>x.id==="unclassified").total,15);
 assert.equal(INFLOW_TYPES.length,4);
});
test("reclassification immediately moves value to correct bucket without changing total money in",()=>{
 const first=summarizeInflows(bank);
 const second=summarizeInflows(bank.map(t=>t.id==="c"?{...t,inflow_type:"refund"}:t));
 assert.equal(second.total,first.total);
 assert.equal(second.groups.find(x=>x.id==="transfer").count,0);
 assert.equal(second.groups.find(x=>x.id==="refund").count,2);
 assert.equal(second.groups.find(x=>x.id==="refund").total,125);
});
test("empty state produces zero counts",()=>{
 const r=summarizeInflows([]);
 assert.equal(r.total,0);
 assert.equal(r.groups.length,5);
 assert.ok(r.groups.every(x=>x.count===0 && x.total===0));
});
