# VinVerifyTactics website

Three files make up the site:
- `index.html` — public booking page (this is what you'll link from Google Business Profile, dealer flyers, etc.)
- `dashboard.html` — your private internal job tracker (not linked from the public site)
- `style.css`, `app.js`, `dashboard.js` — shared styling and logic

## 1. Put this on GitHub Pages (free hosting)

1. Go to github.com and create a new **public** repository — name it something like `vinverifytactics-site`.
2. Upload all the files in this folder to that repository (drag-and-drop works fine on github.com, or use `git push` if you're comfortable with it).
3. In the repo, go to **Settings → Pages**.
4. Under "Build and deployment," set Source to **Deploy from a branch**, branch `main`, folder `/ (root)`.
5. Save. GitHub will give you a live URL within a minute or two — something like:
   `https://yourusername.github.io/vinverifytactics-site/`

That's your live site. Use that link on Google Business Profile, in emails, on flyers, everywhere — until you have a custom domain.

## 2. Connect your domain later (once you buy vinverifytactics.com)

1. Buy the domain through any registrar (Namecheap, Google Domains successor, etc. — a few dollars a year).
2. In the registrar's DNS settings, add these records pointing at GitHub Pages:
   - Four `A` records for `@` pointing to: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - A `CNAME` record for `www` pointing to `yourusername.github.io`
3. In your GitHub repo, add a file named `CNAME` (no extension) containing just: `vinverifytactics.com`
4. Back in Settings → Pages, enter your custom domain and enable "Enforce HTTPS" once it's available.

DNS changes can take up to 24 hours to fully propagate.

## 3. Connect the booking form to your email (Formspree — free tier)

The form currently points to a placeholder (`YOUR_FORM_ID`) and won't actually send anywhere until you fix this:

1. Go to formspree.io and sign up for a free account (this is a form-delivery utility, not a booking platform — it just emails you what people submit).
2. Create a new form, and copy the endpoint URL it gives you (looks like `https://formspree.io/f/abc123xy`).
3. In `index.html`, find this line:
   `<form id="booking-form" class="form-grid" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">`
   and replace `YOUR_FORM_ID` with your actual endpoint.
4. Commit/upload the updated file back to GitHub.

Free tier covers 50 submissions/month, which is well above what you'll need starting out.

## 4. Using the dashboard

- Open `dashboard.html` on your own device (bookmark it — it's not linked from the public site).
- Default access code is `vinverify2026` — change this in `dashboard.js` (search for `ACCESS_CODE`) before you start using it for real.
- **Important limitation:** all job data is stored in your browser's local storage. It does NOT sync between your phone and laptop, and clearing browser data will erase it. This is fine for getting started, but if you outgrow it, that's the signal to look at a proper backend — not before.
- The access code is a basic deterrent only, not real security. Don't rely on it to protect anything sensitive.

## 5. What's already built in

- The eligibility gate on the booking form hard-blocks submission for salvage/kit-car/tampered-VIN/unverified-motorcycle vehicles and shows the CHP/DMV referral message instead.
- Three service zones are laid out on the page matching your Alameda (no surcharge) / Contra Costa+San Mateo (travel fee) / SF+Santa Clara (appointment only) pricing structure.
- The dashboard tracks status through Pending → Confirmed → En route → Completed.
