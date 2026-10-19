# Ignite Financials

Private finance dashboard for Ignite Company. Built with React, Vite, and Supabase. Protected by Supabase authentication and row-level security.

Features: payments/income, expenses, revenue and profit, manually entered transactions and CSV imports, virtual bucket allocations, and personal/business separation.

Bank APIs are not connected yet. Virtual allocations never transfer money.

## Environment

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel (publishable Supabase key). The service role key must never be exposed to the browser. Run the included `supabase/schema.sql` against your Supabase database.

## Develop

`npm install && npm run dev`
