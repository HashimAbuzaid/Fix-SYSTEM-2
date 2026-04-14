# Detroit Axle QA System

Internal React + TypeScript + Vite application for QA operations, coaching, monitoring, reporting, and team productivity workflows.

## What was improved in this cleanup pass
- normalized the uploaded files into a standard Vite project structure
- added shared app role and team types in `src/types/app.ts`
- added centralized permission helpers in `src/lib/permissions.ts`
- added shared theme detection helper in `src/lib/theme.ts`
- moved Supabase configuration toward environment-based usage with `.env.example`
- added database and security documentation under `docs/`
- preserved the existing application behavior while making the project easier to maintain

## Project structure
- `src/QA/` feature screens and UI modules
- `src/lib/` shared runtime helpers
- `src/hooks/` reusable hooks
- `src/types/` shared TypeScript types
- `src/services/` shared schema/service metadata
- `docs/` security, schema, and cleanup planning docs

## Security note
This frontend still depends on strong Supabase RLS. The app layer can improve consistency and reduce mistakes, but database policies remain the real enforcement boundary.

## Local setup
```bash
npm install
cp .env.example .env
npm run build
npm run dev
```
