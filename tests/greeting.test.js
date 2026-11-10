import test from "node:test";
import assert from "node:assert/strict";
import {getDaypartGreeting} from "../src/greeting.js";
test("greeting changes at noon and 6pm in the device time zone",()=>{
 const at=h=>new Date(2026,10,10,h,0,0);
 assert.equal(getDaypartGreeting(at(0)),"Good morning");
 assert.equal(getDaypartGreeting(at(11)),"Good morning");
 assert.equal(getDaypartGreeting(at(12)),"Good afternoon");
 assert.equal(getDaypartGreeting(at(17)),"Good afternoon");
 assert.equal(getDaypartGreeting(at(18)),"Good evening");
 assert.equal(getDaypartGreeting(at(23)),"Good evening");
});
