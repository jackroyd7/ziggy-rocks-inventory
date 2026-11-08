# Ziggy Rocks

Web app for the Ziggy Rocks rental: the inventory, owner/guest changeover checklists and a log of
issues that need sorting. It runs on Vercel and works on phones, where it can be added to the home screen.

- **Inventory**: items by room, with quantity, condition, notes, the date each was last checked and a photo.
  "Scan photos" sends photos of a cupboard or drawer to Claude, which lists and counts what it sees. You check
  the list before it's saved, and items already listed are updated instead of added twice.
- **Changeovers**: start "Owners leaving → guests arriving" or "Guests leaving → owners arriving". Every task
  has a tickbox and each tick is saved with the time. Finishing marks anything unticked as missed.
  The floor plans and a checklist editor are on the same tab.
- **Issues**: things that need sorting, with room, priority, date, details and photos, moved through
  open, in progress and resolved.

Everyone signs in with one shared password. There is no Claude account needed.

## Deploy on Vercel

1. In Vercel, choose **Add New → Project** and import this GitHub repository. Leave the framework as **Other**
   and the build settings empty.
2. In the project's **Storage** tab, add:
   - **Upstash for Redis** (from the Marketplace, free plan is fine) for the records.
   - **Blob** for the photos.
   Connect both to the project. Vercel adds their environment variables for you.
3. In **Settings → Environment Variables**, add:
   - `APP_PASSWORD`: the password everyone will use to sign in.
   - `ANTHROPIC_API_KEY`: a Claude API key from https://platform.claude.com, used for photo scanning.
4. Redeploy so the new variables take effect.

On first load, the app adds the two changeover checklists and the open questions from the
"Ziggy owner to guest checklist" doc as issues.

Changing `APP_PASSWORD` signs everyone out. Photos are stored in Vercel Blob at long, unguessable public URLs.

## Run it locally

```bash
npm install
APP_PASSWORD=test npm run dev
```

Then open http://localhost:3000. Without the Redis variables, records are kept in memory until the server
stops; without `BLOB_READ_WRITE_TOKEN`, photos are kept inline. Photo scanning needs `ANTHROPIC_API_KEY`.

## Layout

- `public/`: the app itself (`index.html`, `app.js`, `app.css`), icons and floor plans.
- `api/`: Vercel functions for sign-in (`login`), reading records (`state`), changing records (`doc`),
  photos (`photo`) and photo scanning with Claude (`scan`).
- `lib/`: sign-in, storage and the starting data.
