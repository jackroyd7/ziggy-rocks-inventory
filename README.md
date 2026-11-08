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

Everyone signs in with their own name and password, so their name shows on issues they log, changeovers
they start, tasks they tick and inventory they change. No Claude account is needed.

- **First time**: sign in with the `APP_PASSWORD` set in Vercel and create the owner account.
- **Adding people**: the owner adds people by name under Account → People. The first time someone signs in
  with their name, they choose their own password. The owner can reset a password or remove someone there too.
- **Owner only**: issues marked "Only visible to me", and the **My list** tab for private reminders, jobs and
  things to take to the house.

## Deploy on Vercel

1. In Vercel, choose **Add New → Project** and import this GitHub repository. Leave the framework as **Other**
   and the build settings empty.
2. In the project's **Storage** tab, add **Neon** (Postgres, from the Marketplace) on its free plan and
   connect it to the project. Vercel adds `DATABASE_URL` for you, and the app creates its own tables on first use.
   Records and photos are both kept there.
   Optional: if you later add a **Blob** store, new photos go there instead, which leaves more room in the database.
3. In **Settings → Environment Variables**, add:
   - `APP_PASSWORD`: the password everyone will use to sign in.
   - `ANTHROPIC_API_KEY`: a Claude API key from https://platform.claude.com, used for photo scanning.
4. Redeploy so the new variables take effect.

On first load, the app adds the two changeover checklists and the open questions from the
"Ziggy owner to guest checklist" doc as issues.

Changing `APP_PASSWORD` signs everyone out (it also signs the session cookies). Photos kept in the database are only shown to signed-in people. Photos in Vercel Blob (if you add it) sit at long, unguessable public URLs.

## Run it locally

```bash
npm install
APP_PASSWORD=test npm run dev
```

Then open http://localhost:3000. Without a database connected (`DATABASE_URL`, or the Upstash variables), records are kept in memory until the server
stops; photos are kept the same way. Photo scanning needs `ANTHROPIC_API_KEY`.

## Layout

- `public/`: the app itself (`index.html`, `app.js`, `app.css`), icons and floor plans.
- `api/`: Vercel functions for sign-in (`login`), reading records (`state`), changing records (`doc`),
  photos (`photo`) and photo scanning with Claude (`scan`).
- `lib/`: sign-in, storage and the starting data.
