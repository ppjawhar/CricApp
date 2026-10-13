# CricApp

An independent, mobile-first cricket scoring and club-management PWA built with React, TypeScript, Vite, Tailwind CSS, and Supabase.

## Local development

Use Node.js 22 or later.

```sh
npm install
npm run dev
```

Open `http://localhost:8443`. To access the app from a phone on the same network, use your computer's LAN IP with port `8443`.

## Production

```sh
npm run build
npm run preview
```

The static application is generated in `dist/`. The linked Vercel project can be updated with `npx vercel --prod`.

## Supabase backend

The client connects to the existing Supabase project through `utils/supabase/info.tsx`. Only the project ID and public anonymous key belong in the client; service-role keys stay in Supabase.

The `cricapp-api` Edge Function is configured in `supabase/config.toml` and implemented in `supabase/functions/server/`.

```sh
npx supabase functions deploy cricapp-api --project-ref rhgltihfwacenecyrnqv
```

The existing key-value database table is retained to preserve saved clubs, memberships, and matches. Authentication is required for club and match API operations.
