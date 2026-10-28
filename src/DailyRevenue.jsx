import React, { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, CalendarDays, Trophy } from "lucide-react";
import { shiftRevenueMonth, summarizeDailyRevenue } from "./dailyRevenueMath.js";

const formatMoney = value => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(value || 0);
const todayLocal = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const formatMonth = month => {
  const [year, number] = month.split("-").map(Number);
  return new Date(year, number - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};
const formatDay = date => new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
  .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const pluralPayments = count => count + " payment" + (count === 1 ? "" : "s");

export function DailyRevenuePreview({ payments, onViewAll }) {
  const today = todayLocal();
  const summary = useMemo(() => summarizeDailyRevenue(payments, today.slice(0, 7)), [payments, today]);
  const todayRow = summary.days.find(row => row.date === today);
  const recent = summary.days.filter(row => row.date <= today).slice(-7).reverse();

  return <section className="panel daily-preview">
    <div className="panel-head">
      <div><h2>Daily money in</h2><p>Exactly what you collected each day, no averages</p></div>
      <button className="text-action" onClick={onViewAll}>View every day <ArrowUpRight size={15}/></button>
    </div>
    <div className="daily-preview-content">
      <div className="daily-preview-today">
        <span className="daily-overline"><span className="daily-live-dot"/> TODAY'S REVENUE</span>
        <strong>{formatMoney(todayRow?.total)}</strong>
        <span className="daily-preview-count">{pluralPayments(todayRow?.count || 0)} recorded today</span>
        <div className="daily-preview-month"><span>{formatMonth(today.slice(0, 7))} so far</span><b>{formatMoney(summary.total)}</b></div>
      </div>
      <div className="daily-preview-list" aria-label="Last seven days of recorded revenue">
        {recent.map(day => <div className="daily-preview-line" key={day.date}>
          <span>{formatDay(day.date)}{day.date === today && <em>Today</em>}</span>
          <small>{pluralPayments(day.count)}</small>
          <strong className={day.count ? "daily-amount-earned" : "daily-amount-zero"}>{formatMoney(day.total)}</strong>
        </div>)}
      </div>
    </div>
  </section>;
}

export default function DailyRevenue({ payments }) {
  const today = todayLocal();
  const currentMonth = today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [expandedDate, setExpandedDate] = useState(today);
  const summary = useMemo(() => summarizeDailyRevenue(payments, month), [payments, month]);
  const visibleDays = summary.days.filter(day => month !== currentMonth || day.date <= today).reverse();
  const monthLabel = formatMonth(month);
  const todayRow = summary.days.find(day => day.date === today);
  const selectedMonth = month === currentMonth ? "This month" : monthLabel;

  const changeMonth = offset => {
    const next = shiftRevenueMonth(month, offset);
    if (next > currentMonth) return;
    setMonth(next);
    setExpandedDate(next === currentMonth ? today : null);
  };

  return <div className="daily-page">
    <div className="daily-period-bar">
      <div className="daily-month-picker">
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={19}/></button>
        <div><span>VIEWING MONTH</span><strong>{monthLabel}</strong></div>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" disabled={month >= currentMonth}><ChevronRight size={19}/></button>
      </div>
      <span className="daily-record-note"><CalendarDays size={15}/> Recorded payment dates</span>
    </div>
    <div className="daily-summary-grid">
      <div className="daily-summary-card daily-summary-primary">
        <span>COLLECTED {month === currentMonth ? "THIS MONTH" : "IN " + monthLabel.toUpperCase()}</span>
        <strong>{formatMoney(summary.total)}</strong>
        <small>Actual payments recorded, not projected revenue</small>
      </div>
      <div className="daily-summary-card">
        <span>PAYMENTS RECEIVED</span>
        <strong>{summary.paymentCount}</strong>
        <small>{selectedMonth}</small>
      </div>
      <div className="daily-summary-card">
        <span><Trophy size={14}/> BEST SINGLE DAY</span>
        <strong>{formatMoney(summary.bestDay?.total)}</strong>
        <small>{summary.bestDay ? formatDay(summary.bestDay.date) + " · " + pluralPayments(summary.bestDay.count) : "No payments recorded"}</small>
      </div>
    </div>
    {month === currentMonth && <div className="daily-current-today">
      <div><span>Today · {formatDay(today)}</span><strong>{formatMoney(todayRow?.total)}</strong></div>
      <span>{pluralPayments(todayRow?.count || 0)} received today</span>
    </div>}
    <section className="panel daily-history">
      <div className="panel-head"><div><h2>Every day in {monthLabel}</h2><p>Select a date to see the exact payments that made up that day's total</p></div></div>
      <div className="daily-column-head"><span>DATE</span><span>PAYMENTS</span><span>REVENUE</span></div>
      {visibleDays.map(day => <div className="daily-day-block" key={day.date}>
        <button className={"daily-day-row" + (day.date === today ? " is-today" : "") + (expandedDate === day.date ? " is-expanded" : "")}
          type="button" aria-expanded={expandedDate === day.date}
          onClick={() => setExpandedDate(expandedDate === day.date ? null : day.date)}>
          <span className="daily-day-label"><b>{formatDay(day.date)}</b>{day.date === today && <small>Today</small>}</span>
          <span className="daily-count-label">{pluralPayments(day.count)}</span>
          <span className="daily-day-total"><strong className={day.count ? "daily-amount-earned" : "daily-amount-zero"}>{formatMoney(day.total)}</strong><ChevronDown size={16}/></span>
        </button>
        {expandedDate === day.date && <div className="daily-day-details">
          {day.payments.length ? day.payments.map((payment, index) => <div className="daily-payment-detail" key={payment.id || index}>
            <span className="daily-payment-icon"><ArrowDownRight size={16}/></span>
            <div><strong>{payment.payer || payment.description || "Payment received"}</strong><small>{[payment.payer ? payment.description : null, payment.project, payment.category].filter(Boolean).join(" · ")}</small></div>
            <b>{formatMoney(payment.amount)}</b>
          </div>) : <p>No recorded payments on this date.</p>}
        </div>}
      </div>)}
    </section>
    <p className="daily-explainer">These are received payments in your Ignite ledger, grouped by the date saved on each payment. Bank credits are not added automatically because they might be transfers, refunds, or payments already recorded here. To count a payment, record it using its actual received date.</p>
  </div>;
}
