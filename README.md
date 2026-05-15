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

## Railway deploy

Create a Railway project from this GitHub repo.

Use the default Node workflow:

```sh
npm install
npm start
```

Set these Railway environment variables:

```text
TEXTBELT_API_KEY=your Textbelt API key
TEXTBELT_SENDER=Elevator Exam SIM
ACCESS_SHEET_URL=your access-list Google Sheet URL
HOST=0.0.0.0
```

Do not set `PORT`; Railway provides it automatically and `server.mjs` reads `process.env.PORT`.

After deployment, test the temporary `*.up.railway.app` URL:

- `start.html` loads.
- The sample exam starts.
- A full access code request reaches the backend.
- Reference books show `Choose PDF` and open from browser storage instead of Mac Preview.

Then add `elevatorexamsim.com` and `www.elevatorexamsim.com` as custom domains in Railway, copy the DNS records Railway shows, and add them in Namecheap.

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

When a paid checkout completes, the script verifies the Checkout Session with Stripe, then appends an `ACTIVE` access row with a 30-day expiration.

## Contents

- `start.html`, `exam.html`, `results.html`, `review.html`, and `viewer.html` are the simulator pages.
- `app.js`, `app.css`, and `config.js` contain the app behavior, styling, and question-bank configuration.
- `question-bank-1000.csv` is the bundled local question bank.
- `reference-pdfs/` contains local reference PDFs used by the app.
- `server.mjs` serves the app, handles access-code requests, and opens linked reference PDFs only on localhost.

This project is independent from the Blueprint Home Solutions marketplace app.
