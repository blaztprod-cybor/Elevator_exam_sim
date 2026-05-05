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

## Contents

- `start.html`, `exam.html`, `results.html`, `review.html`, and `viewer.html` are the simulator pages.
- `app.js`, `app.css`, and `config.js` contain the app behavior, styling, and question-bank configuration.
- `question-bank-1000.csv` is the bundled local question bank.
- `reference-pdfs/` contains local reference PDFs used by the app.
- `server.mjs` serves the app and opens linked reference PDFs on the local machine.

This project is independent from the Blueprint Home Solutions marketplace app.
