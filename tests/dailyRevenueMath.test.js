import test from "node:test";
import assert from "node:assert/strict";
import { summarizeDailyRevenue, shiftRevenueMonth } from "../src/dailyRevenueMath.js";

test("groups actual received payments by their recorded local date, not an average", () => {
  const result = summarizeDailyRevenue([
    { id: "1", scope: "business", type: "income", category: "Client payment", date: "2026-10-28", amount: "875.00" },
    { id: "2", scope: "business", type: "income", category: "Retainer", date: "2026-10-28", amount: "1000.50" },
    { id: "3", scope: "business", type: "income", category: "Client payment", date: "2026-10-26", amount: 250 },
    { id: "4", scope: "business", type: "expense", category: "Software", date: "2026-10-28", amount: 200 },
    { id: "5", scope: "business", type: "income", category: "Transfer", date: "2026-10-28", amount: 900 },
    { id: "6", scope: "business", type: "income", category: "Retainer", date: "2026-09-28", amount: 3000 },
  ], "2026-10");
  assert.equal(result.total, 2125.5);
  assert.equal(result.paymentCount, 3);
  assert.equal(result.days[27].total, 1875.5);
  assert.equal(result.days[27].count, 2);
  assert.equal(result.days[26].total, 0);
  assert.equal(result.days[26].count, 0);
  assert.equal(result.bestDay.date, "2026-10-28");
  assert.equal(result.days.length, 31);
});

test("adds cent values without floating point drift and ignores invalid or negative records", () => {
  const result = summarizeDailyRevenue([
    { type: "income", category: "Client payment", date: "2026-02-03", amount: "0.10" },
    { type: "income", category: "Client payment", date: "2026-02-03", amount: "0.20" },
    { type: "income", category: "Client payment", date: "2026-02-31", amount: "40" },
    { type: "income", category: "Client payment", date: "2026-02-03", amount: "-20" },
    { type: "income", category: "Client payment", date: "2026-02-03", amount: "invalid" },
  ], "2026-02");
  assert.equal(result.days.length, 28);
  assert.equal(result.total, 0.3);
  assert.equal(result.days[2].count, 2);
  assert.equal(result.days[2].total, 0.3);
});
test("empty months list zero payments per day and no best day", () => {
  const result = summarizeDailyRevenue([], "2024-02");
  assert.equal(result.days.length, 29);
  assert.equal(result.total, 0);
  assert.equal(result.paymentCount, 0);
  assert.equal(result.bestDay, null);
  assert.ok(result.days.every(row => row.count === 0 && row.total === 0));
});
test("month navigation handles year boundaries", () => {
  assert.equal(shiftRevenueMonth("2026-01", -1), "2025-12");
  assert.equal(shiftRevenueMonth("2026-12", 1), "2027-01");
});
