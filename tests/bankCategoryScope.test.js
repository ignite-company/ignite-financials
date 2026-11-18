import test from "node:test";
import assert from "node:assert/strict";
import {categoriesForWorkspace,BANK_CATEGORY_WORKSPACES} from "../src/bankCategoryScope.js";

test("business categories do not include personal categories",()=>{
 const all=[
  {id:"b1",scope:"business",name:"Subscriptions"},
  {id:"b2",scope:"business",name:"Developers"},
  {id:"p1",scope:"personal",name:"Groceries"},
  {id:"p2",scope:"personal",name:"Subscriptions"}
 ];
 assert.deepEqual(categoriesForWorkspace(all,"business").map(c=>c.id),["b1","b2"]);
 assert.deepEqual(categoriesForWorkspace(all,"personal").map(c=>c.id),["p1","p2"]);
});

test("new business category does not change the personal list",()=>{
 const all=[{id:"p1",scope:"personal",name:"Groceries"}];
 const before=categoriesForWorkspace(all,"personal").map(c=>c.name);
 all.push({id:"b1",scope:"business",name:"Developers"});
 assert.deepEqual(categoriesForWorkspace(all,"personal").map(c=>c.name),before);
 assert.deepEqual(categoriesForWorkspace(all,"business").map(c=>c.name),["Developers"]);
 assert.equal(BANK_CATEGORY_WORKSPACES.business,"Ignite Company");
});

test("invalid scope or missing data exposes no categories",()=>{
 assert.deepEqual(categoriesForWorkspace([{scope:"business",name:"Subscriptions"}],"all"),[]);
 assert.deepEqual(categoriesForWorkspace(null,"personal"),[]);
});
