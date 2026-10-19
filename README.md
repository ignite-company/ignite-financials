# Ignite Financials

Private, mobile-friendly financial command center for Ignite Company and personal finances. Developed with React/Vite, Supabase Auth + PostgreSQL and Vercel-ready GitHub source.

## Implemented

- Private sign-in using Supabase email magic links.
- Separate Business and Personal views, each with independent buckets.
- Revenue received and payment history, including client/payer and project/service.
- Expense logging and simple rule-based merchant categorization.
- CSV imports, import deduplication, search, editing, deletion and CSV export.
- Monthly and all-time revenue, operating expenses, cash-basis profit, margin and 6-month cash-flow reporting.
- Virtual allocation rules, initially Business: 25% taxes, 25% operations, 35% owner pay, 15% cash reserves. Personal: 50% essentials, 25% lifestyle, 15% savings, 10% buffer.
- Historical allocation snapshots for each received payment. Adjusted allocation percentages affect new income but do not rewrite previous payment allocations.
- Internal transfers excluded from revenue and operating expenses, owner draws excluded from operating profit. Internal transfers do not create income allocations.
- Per-owner row-level security, restricted grants and server-side allocation trigger.

**No bank API or automatic money transfers are enabled.** You can add items manually or import CSV statements. CSV expense amounts must be negative and income amounts positive. Validate your bank's exported signs before import.

## Deploy on Vercel

1. Vercel -> Add New -> Project -> import `ignite-company/ignite-financials`.
2. Framework: Vite. Build command: `npm run build`, output: `dist`.
3. Set environment variables for Production, Preview and Development:
   - `VITE_SUPABASE_URL`: URL from the Supabase API settings of the connected project.
   - `VITE_SUPABASE_ANON_KEY`: *publishable* `sb_publishable_...` key, not service role / secret key.
4. Deploy, and in Supabase Authentication -> URL Configuration, add the actual Vercel origin and final domain to allowed Redirect URLs for email-link login.
5. Log in with your email and record an income or expense. The app will create your default virtual allocation buckets on first sign-in.

The Supabase tables and triggers have already been provisioned in the existing Ignite Supabase project. New installations may use `supabase/schema.sql`.

## Important reporting notes

Revenue here means recorded payments received, not invoiced revenue. Profit is recorded revenue minus recorded operating expenses, excluding internal transfers and owner draws. This is a simplified cash-basis management view, not tax or GAAP financial reporting. Account opening balances are labels/reference values; they are not automatically reconciled with actual banking balances.

Read-only bank transaction syncing and smart enrichment can be added later, once a supported bank aggregation provider is connected.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Do not commit .env files or expose the Supabase service-role key to browser code. 
