/**
 * Stripe Payment Link -> Elevator Exam SIM access sheet.
 *
 * Apps Script setup:
 * 1. Open the Google Sheet that ACCESS_SHEET_URL points to.
 * 2. Extensions -> Apps Script.
 * 3. Paste this file into Code.gs.
 * 4. Project Settings -> Script properties:
 *    STRIPE_SECRET_KEY=sk_test_... or sk_live_...
 *    WEBHOOK_SHARED_SECRET=a long random password you choose
 *    ACCESS_DAYS=30
 *    SHEET_NAME=Access
 * 5. Deploy -> New deployment -> Web app.
 *    Execute as: Me
 *    Who has access: Anyone
 * 6. Add the web app URL to Stripe as a webhook endpoint, with the shared secret
 *    as a query parameter:
 *    https://script.google.com/macros/s/.../exec?secret=YOUR_WEBHOOK_SHARED_SECRET
 * 7. Subscribe the Stripe endpoint to checkout.session.completed.
 */

const DEFAULT_ACCESS_DAYS = 30;
const DEFAULT_SHEET_NAME = "Access";

function doPost(event) {
  try {
    assertSharedSecret_(event);

    const payload = JSON.parse(event.postData.contents || "{}");
    if (payload.type !== "checkout.session.completed") {
      return json_({ received: true, ignored: payload.type || "unknown" });
    }

    const sessionId = payload.data && payload.data.object && payload.data.object.id;
    if (!sessionId) {
      throw new Error("Missing Stripe checkout session id.");
    }

    const session = retrieveStripeCheckoutSession_(sessionId);
    if (session.payment_status !== "paid") {
      return json_({ received: true, ignored: "payment_not_paid", sessionId });
    }

    const sheet = getAccessSheet_();
    ensureHeaderRow_(sheet);

    const headers = getHeaders_(sheet);
    const existingRow = findRowByValue_(sheet, headers, "stripe_checkout_session_id", session.id);
    if (existingRow) {
      return json_({ received: true, duplicate: true, sessionId: session.id });
    }

    const now = new Date();
    const paymentDate = session.created ? new Date(session.created * 1000) : now;
    const accessDays = Number(getProperty_("ACCESS_DAYS") || DEFAULT_ACCESS_DAYS);
    const expiresAt = addDaysEndOfDay_(paymentDate, accessDays);

    const customerDetails = session.customer_details || {};
    const row = {
      email: customerDetails.email || session.customer_email || "",
      phone: customerDetails.phone || "",
      access_status: "ACTIVE",
      payment_date: formatDate_(paymentDate),
      expires_at: formatDate_(expiresAt),
      exam_access_level: "FULL",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent: session.payment_intent || "",
      stripe_customer_id: session.customer || "",
      amount_paid: session.amount_total ? String(session.amount_total / 100) : "",
      currency: String(session.currency || "").toUpperCase(),
      created_at: now.toISOString(),
    };

    appendMappedRow_(sheet, headers, row);
    return json_({ received: true, granted: true, email: row.email, expires_at: row.expires_at });
  } catch (error) {
    return json_({ received: false, error: error.message || String(error) }, 500);
  }
}

function assertSharedSecret_(event) {
  const expected = getProperty_("WEBHOOK_SHARED_SECRET");
  if (!expected) {
    throw new Error("WEBHOOK_SHARED_SECRET is not configured.");
  }

  const actual = event.parameter && event.parameter.secret;
  if (actual !== expected) {
    throw new Error("Invalid webhook secret.");
  }
}

function retrieveStripeCheckoutSession_(sessionId) {
  const stripeSecretKey = getProperty_("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  const url = "https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sessionId);
  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      Authorization: "Bearer " + stripeSecretKey,
    },
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  const text = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error("Stripe session lookup failed: " + status + " " + text);
  }

  return JSON.parse(text);
}

function getAccessSheet_() {
  const sheetName = getProperty_("SHEET_NAME") || DEFAULT_SHEET_NAME;
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function ensureHeaderRow_(sheet) {
  const requiredHeaders = [
    "email",
    "phone",
    "access_status",
    "payment_date",
    "expires_at",
    "exam_access_level",
    "stripe_checkout_session_id",
    "stripe_payment_intent",
    "stripe_customer_id",
    "amount_paid",
    "currency",
    "created_at",
  ];

  const range = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), requiredHeaders.length));
  const existingHeaders = range.getValues()[0].map(String);
  if (existingHeaders.some(Boolean)) {
    const nextHeaders = existingHeaders.slice();
    requiredHeaders.forEach((header) => {
      if (!nextHeaders.includes(header)) {
        nextHeaders.push(header);
      }
    });
    sheet.getRange(1, 1, 1, nextHeaders.length).setValues([nextHeaders]);
    return;
  }

  sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
}

function getHeaders_(sheet) {
  const width = sheet.getLastColumn();
  return sheet.getRange(1, 1, 1, width).getValues()[0].map(String);
}

function appendMappedRow_(sheet, headers, row) {
  const values = headers.map((header) => row[header] || "");
  sheet.appendRow(values);
}

function findRowByValue_(sheet, headers, headerName, expectedValue) {
  const columnIndex = headers.indexOf(headerName) + 1;
  if (!columnIndex || sheet.getLastRow() < 2) {
    return 0;
  }

  const values = sheet.getRange(2, columnIndex, sheet.getLastRow() - 1, 1).getValues();
  const expected = String(expectedValue || "");
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0] || "") === expected) {
      return index + 2;
    }
  }
  return 0;
}

function addDaysEndOfDay_(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(23, 59, 59, 999);
  return result;
}

function formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function getProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function json_(data, statusCode) {
  if (statusCode) {
    data.statusCode = statusCode;
  }

  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

  return output;
}
