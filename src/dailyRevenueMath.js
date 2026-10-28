// Daily revenue is based on recorded income in the ledger, never unverified bank credits.
// Dates are YYYY-MM-DD values from Supabase DATE columns, so do not parse them as UTC instants.
export function summarizeDailyRevenue(transactions, month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Expected a YYYY-MM month");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const countOfDays = new Date(year, monthNumber, 0).getDate();
  const days = Array.from({ length: countOfDays }, (_, index) => {
    const date = month + "-" + String(index + 1).padStart(2, "0");
    return { date, day: index + 1, total: 0, count: 0, payments: [] };
  });
  let totalCents = 0;
  let paymentCount = 0;
  for (const payment of transactions || []) {
    if (payment?.type !== "income" || payment.category === "Transfer" ||
        typeof payment.date !== "string" || !payment.date.startsWith(month + "-")) continue;
    const dayNumber = Number(payment.date.slice(8, 10));
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > days.length ||
        days[dayNumber - 1].date !== payment.date) continue;
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const cents = Math.round(amount * 100);
    if (!cents) continue;
    const day = days[dayNumber - 1];
    day.total = Math.round(day.total * 100 + cents) / 100;
    day.count += 1;
    day.payments.push(payment);
    totalCents += cents;
    paymentCount += 1;
  }
  const bestDay = days.reduce((best, day) => day.total > (best?.total || 0) ? day : best, null);
  return { month, days, total: totalCents / 100, paymentCount, bestDay };
}

export function shiftRevenueMonth(month, offset) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}
