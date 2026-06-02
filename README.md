# Elevator Exam App

Standalone NYC DOB elevator inspector exam simulator.

## Run

```sh
npm install
npm start
```

Then open:

```text
http://127.0.0.1:4175/start.html
```

## Progressive web app

The simulator is installable as a PWA from `start.html` on HTTPS deployments and on localhost during development.

- `manifest.webmanifest`, `icons/icon.svg`, `sw.js`, and `pwa-register.js` provide install metadata, app-shell caching, and the install prompt.
- The service worker caches the simulator pages, CSS, JavaScript, PDF.js assets, and local question-bank CSV so candidates can keep practicing after the first successful load.
- Reference PDFs selected with **Link to my copy** remain stored in browser IndexedDB on the candidate device and open in `viewer.html`. The service worker does not pre-cache every bundled reference PDF because those files are large and candidates may need to use their own licensed copies.

After deploying, verify PWA support in Chrome DevTools:

1. Open the deployed HTTPS URL.
2. Confirm the install prompt appears or the browser shows an install option.
3. Start the sample exam once, select at least one local reference PDF, then reload with DevTools network set to offline.
4. Confirm `start.html`, the exam pages, the question bank fallback, and the selected reference PDF still open.

## Render deploy

Create a Render Web Service from this GitHub repo.

Use the Node runtime with:

```sh
Build Command: npm install
Start Command: npm start
```

Set these Render environment variables:

```text
TEXTBELT_API_KEY=your Textbelt API key
TEXTBELT_SENDER=Elevator Exam SIM
ACCESS_SHEET_URL=your access-list Google Sheet URL
SAMPLE_SIGNUP_WEBHOOK_URL=your sample signup Apps Script web app URL
SAMPLE_SIGNUP_SHARED_SECRET=the same secret configured in Apps Script
STRIPE_PAYMENT_LINK_URL=your live Stripe Payment Link URL
HOST=0.0.0.0
```

Do not set `PORT`; Render provides it automatically and `server.mjs` reads `process.env.PORT`.

After deployment, test the Render `*.onrender.com` URL:

- `start.html` loads.
- The sample exam starts.
- Starting a sample exam records the email in the access-list Google Sheet.
- A full access code request reaches the backend.
- Reference books show `Choose PDF` and open from browser storage instead of Mac Preview.

Then add `elevatorexamsim.com` and `www.elevatorexamsim.com` as custom domains in Render, copy the DNS records Render shows, and add them in Namecheap.

## Sample email capture

Use [google-apps-script/stripe-access-webhook.gs](./google-apps-script/stripe-access-webhook.gs) to append sample exam email starts to the same Google Sheet used by `ACCESS_SHEET_URL`. The same Apps Script web app can handle both Stripe purchases and sample exam starts.

Setup:

1. Open the Google Sheet used by `ACCESS_SHEET_URL`.
2. Go to `Extensions -> Apps Script`.
3. Paste `google-apps-script/stripe-access-webhook.gs` into `Code.gs`.
4. In Apps Script, open `Project Settings -> Script properties` and add:

```text
WEBHOOK_SHARED_SECRET=a long random password
SPREADSHEET_ID=19YlJUvRQh3bVBeymdreehr8hxK_xVZpbDSJ4n8iru5U
SHEET_NAME=Sheet1
```

5. If you are also using Stripe access automation, add the Stripe script properties listed below.
6. Deploy as a web app:
   - Execute as: `Me`
   - Who has access: `Anyone`
7. Set the Node app environment variables:

```text
SAMPLE_SIGNUP_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
SAMPLE_SIGNUP_SHARED_SECRET=the same long random password
```

When a user starts a sample exam, the backend posts the email to Apps Script, which appends or updates a row with `access status` set to `TRIAL`. `TRIAL` rows do not grant full exam access. Unsubscribed trial users are limited to 4 sample exams per browser/device.

To reset a user's local 4-sample limit, add or update that email in the access sheet with:

```text
access status=TRIAL_RESET
```

The next time that user enters the same email on the sample form, the app clears the browser-local sample count before starting the trial.

## Stripe access automation

Use [google-apps-script/stripe-access-webhook.gs](./google-apps-script/stripe-access-webhook.gs) to automatically add successful Stripe Payment Link buyers to the Google Sheet access list.

Setup:

1. Open the Google Sheet used by `ACCESS_SHEET_URL`.
2. Go to `Extensions -> Apps Script`.
3. Paste `google-apps-script/stripe-access-webhook.gs` into `Code.gs`.
4. In Apps Script, open `Project Settings -> Script properties` and add:

```text
STRIPE_SECRET_KEY=sk_test_... or sk_live_...
WEBHOOK_SHARED_SECRET=a long random password
ACCESS_DAYS=30
SHEET_NAME=Access
```

5. Deploy as a web app:
   - Execute as: `Me`
   - Who has access: `Anyone`
6. In Stripe, add a webhook endpoint using the Apps Script web app URL plus the shared secret:

```text
https://script.google.com/macros/s/.../exec?secret=YOUR_WEBHOOK_SHARED_SECRET
```

7. Subscribe the Stripe endpoint to `checkout.session.completed`.

8. Set `STRIPE_PAYMENT_LINK_URL` in the Node app environment to the live `https://buy.stripe.com/...` Payment Link. Test-mode links that start with `https://buy.stripe.com/test_...` are intentionally disabled in the browser.

When a paid checkout completes, the script verifies the Checkout Session with Stripe, then appends an `ACTIVE` access row with a 30-day expiration.

## Contents

- `start.html`, `exam.html`, `results.html`, `review.html`, and `viewer.html` are the simulator pages.
- `app.js`, `app.css`, and `config.js` contain the app behavior, styling, and question-bank configuration.
- `manifest.webmanifest`, `sw.js`, `pwa-register.js`, and `icons/` make the simulator installable as a progressive web app.
- `question-bank-1000.csv` is the bundled local question bank.
- `reference-pdfs/` contains local reference PDFs used by the app.
- `server.mjs` serves the app, handles access-code requests, and opens linked reference PDFs only on localhost.

This project is independent from the Blueprint Home Solutions marketplace app.
