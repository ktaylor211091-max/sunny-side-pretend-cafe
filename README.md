# Sunny Side Pretend Cafe

A family food-ordering game with a customer menu and a pretend kitchen. Orders are saved in the current browser by default. Add Supabase settings to share the live kitchen queue between phones, tablets, and computers.

## Run it

```sh
npm install
npm run dev
```

## Share orders between devices

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. Copy `.env.example` to `.env.local` and add the project URL and public anon/publishable key from Supabase project settings.
4. Restart the dev server. Both devices must open the same hosted app URL to share the order queue.

This is a pretend-play app with public database access enabled for simplicity. Do not store personal or sensitive information in orders.

## Publish with GitHub Pages

Push this project to a GitHub repository and set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The included workflow publishes the app when you push to `main`. For shared orders, add repository Actions secrets named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before publishing. Without those secrets the app still works, but orders stay in each browser.

Open the published Pages URL in Safari on iPhone or iPad. To add it to the Home Screen, use **Share → Add to Home Screen**.
