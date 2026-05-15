import express from "express";
import path from "node:path";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadLocalEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fsSync.existsSync(envPath)) {
    return;
  }

  const lines = fsSync.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadLocalEnvFile();

const app = express();
const PORT = Number(process.env.PORT || 4175);
const HOST = process.env.HOST || "127.0.0.1";
const LINKED_BOOKS_PATH = path.join(__dirname, ".linked-books.json");
const ACCESS_SHEET_URL =
  process.env.ACCESS_SHEET_URL ||
  "https://docs.google.com/spreadsheets/d/19YlJUvRQh3bVBeymdreehr8hxK_xVZpbDSJ4n8iru5U/edit?usp=sharing";
const TEXTBELT_API_KEY = process.env.TEXTBELT_API_KEY || "";
const TEXTBELT_SENDER = process.env.TEXTBELT_SENDER || "Elevator Exam SIM";
const ACCESS_CODE_TTL_MS = 10 * 60 * 1000;
const VERIFIED_ACCESS_TTL_MS = 12 * 60 * 60 * 1000;
const accessCodes = new Map();
const verifiedAccessTokens = new Map();

app.use(express.json());
app.use(express.static(__dirname));

const allowedRoots = [
  path.join(__dirname, "reference-pdfs"),
];

function resolveBookPath(relativePath) {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.resolve(__dirname, normalized);
  const allowed = allowedRoots.some((root) => absolute.startsWith(root + path.sep) || absolute === root);

  if (!allowed) {
    throw new Error("Book path is outside the allowed reference folder");
  }

  return absolute;
}

async function readLinkedBooks() {
  try {
    const raw = await fs.readFile(LINKED_BOOKS_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeLinkedBooks(linkedBooks) {
  await fs.writeFile(LINKED_BOOKS_PATH, JSON.stringify(linkedBooks, null, 2));
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

function normalizeUsPhoneNumber(value) {
  const digits = normalizePhoneDigits(value);
  return digits.length === 10 ? `+1${digits}` : String(value || "").trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function normalizeSheetUrlToCsv(url) {
  const input = String(url || "").trim();
  if (!input) {
    return "";
  }

  if (input.includes("/gviz/tq") || input.includes("output=csv")) {
    return input;
  }

  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    return input;
  }

  const sheetId = match[1];
  const gid = input.match(/[?&]gid=([0-9]+)/)?.[1] || "0";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim());

  if (!lines.length) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    header
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      if (header) {
        row[header] = cells[index] || "";
      }
      return row;
    }, {});
  });
}

function parseSheetDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]), 23, 59, 59, 999);
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return new Date(Number(slashMatch[3]), Number(slashMatch[1]) - 1, Number(slashMatch[2]), 23, 59, 59, 999);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateOnly(date) {
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildAccessInfo(record) {
  const paymentDate = parseSheetDate(record?.payment_date || record?.started_at || record?.start_date);
  const expiresAt = parseSheetDate(record?.expires_at || record?.expires || record?.expiration);

  return {
    accessStatus: String(record?.access_status || record?.access_status_ || record?.accessstatus || "").trim().toUpperCase(),
    paymentDate: paymentDate ? formatDateOnly(paymentDate) : "",
    expiresAt: expiresAt ? expiresAt.toISOString() : "",
    expiresDate: expiresAt ? formatDateOnly(expiresAt) : "",
    examAccessLevel: String(record?.exam_access_level || record?.access_level || "").trim(),
  };
}

async function fetchAccessRows() {
  const response = await fetch(normalizeSheetUrlToCsv(ACCESS_SHEET_URL), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Access list request failed with ${response.status}`);
  }
  return parseCsv(await response.text());
}

async function findAccessRecord(email) {
  const normalizedEmail = normalizeEmail(email);
  const rows = await fetchAccessRows();
  return rows.find((row) => normalizeEmail(row.email) === normalizedEmail) || null;
}

function validateAccessRecord(record, phone) {
  if (!record) {
    return { ok: false, error: "This email is not on the access list yet." };
  }

  const status = String(record.access_status || record.access_status_ || record.accessstatus || "").trim().toUpperCase();
  if (status !== "ACTIVE" && status !== "TRIAL") {
    return { ok: false, error: "This account is not active." };
  }

  const expiresAt = parseSheetDate(record.expires_at || record.expires || record.expiration);
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This 30-day access has expired." };
  }

  const sheetPhone = normalizePhoneDigits(record.phone);
  const submittedPhone = normalizePhoneDigits(phone);
  if (sheetPhone && sheetPhone !== submittedPhone) {
    return { ok: false, error: "The phone number does not match the access list." };
  }

  if (submittedPhone.length !== 10) {
    return { ok: false, error: "Enter a valid 10-digit US phone number." };
  }

  return { ok: true, accessInfo: buildAccessInfo(record) };
}

function createAccessCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashAccessCode({ email, phone, code }) {
  return crypto
    .createHash("sha256")
    .update(`${normalizeEmail(email)}:${normalizePhoneDigits(phone)}:${code}`)
    .digest("hex");
}

async function sendAccessCodeSms({ phone, code }) {
  if (!TEXTBELT_API_KEY) {
    throw new Error("TEXTBELT_API_KEY is not configured.");
  }

  const params = new URLSearchParams({
    phone: normalizeUsPhoneNumber(phone),
    message: `Your Elevator Inspector Exam SIM access code is ${code}. It expires in 10 minutes.`,
    key: TEXTBELT_API_KEY,
  });

  if (TEXTBELT_SENDER) {
    params.set("sender", TEXTBELT_SENDER);
  }

  const response = await fetch("https://textbelt.com/text", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Unable to send SMS access code.");
  }

  return data;
}

function pruneAccessMaps() {
  const now = Date.now();
  for (const [key, record] of accessCodes.entries()) {
    if (record.expiresAt <= now || record.attemptCount >= 5) {
      accessCodes.delete(key);
    }
  }

  for (const [token, record] of verifiedAccessTokens.entries()) {
    if (record.expiresAt <= now) {
      verifiedAccessTokens.delete(token);
    }
  }
}

function isLocalDesktopRequest(req) {
  const hostname = String(req.hostname || "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

async function chooseBookFile(title) {
  const safeTitle = String(title || "reference book").replace(/"/g, "'");
  const script = `POSIX path of (choose file with prompt "Select your ${safeTitle} PDF")`;
  const { stdout } = await execFileAsync("osascript", ["-e", script]);
  return stdout.trim();
}

async function resolveOpenBookRequest({ key, title, path: inputPath, linkIfMissing = false }) {
  const linkedBooks = await readLinkedBooks();
  const linkedPath = key ? linkedBooks[key]?.path : "";

  if (linkedPath) {
    return path.isAbsolute(linkedPath) ? linkedPath : resolveBookPath(linkedPath);
  }

  if (key && linkIfMissing) {
    const selectedPath = await chooseBookFile(title || key);
    linkedBooks[key] = {
      title: title || key,
      path: selectedPath,
      linkedAt: Date.now(),
    };
    await writeLinkedBooks(linkedBooks);
    return selectedPath;
  }

  if (inputPath) {
    return resolveBookPath(inputPath);
  }

  throw new Error("Book has not been linked yet");
}

async function constrainPreviewWindow() {
  const script = `
    tell application "Preview"
      activate
    end tell

    tell application "Finder"
      set screenBounds to bounds of window of desktop
    end tell

    set screenLeft to item 1 of screenBounds
    set screenTop to item 2 of screenBounds
    set screenRight to item 3 of screenBounds
    set screenBottom to item 4 of screenBounds
    set screenWidth to screenRight - screenLeft
    set screenHeight to screenBottom - screenTop

    set targetWidth to screenWidth * 0.42
    set targetHeight to screenHeight * 0.9
    set targetLeft to screenLeft
    set targetTop to screenTop + ((screenHeight - targetHeight) / 2)
    set targetRight to targetLeft + targetWidth
    set targetBottom to targetTop + targetHeight

    tell application "Preview"
      repeat 20 times
        if (count of windows) > 0 then exit repeat
        delay 0.1
      end repeat

      if (count of windows) > 0 then
        set bounds of front window to {targetLeft, targetTop, targetRight, targetBottom}
        delay 0.6
        set bounds of front window to {targetLeft, targetTop, targetRight, targetBottom}
      end if

      activate
    end tell
  `;

  await execFileAsync("osascript", ["-e", script]);
}

app.post("/open-book", async (req, res) => {
  try {
    if (!isLocalDesktopRequest(req)) {
      res.status(403).json({ error: "Desktop PDF linking is only available from localhost." });
      return;
    }

    const inputKey = String(req.body?.key || "");
    const inputTitle = String(req.body?.title || inputKey || "");
    const inputPath = String(req.body?.path || "");
    const linkIfMissing = req.body?.linkIfMissing === true;
    if (!inputKey && !inputPath) {
      res.status(400).json({ error: "Missing book key or path" });
      return;
    }

    const absolutePath = await resolveOpenBookRequest({
      key: inputKey,
      title: inputTitle,
      path: inputPath,
      linkIfMissing,
    });
    await execFileAsync("open", ["-a", "Preview", absolutePath]);
    await constrainPreviewWindow();
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to open book" });
  }
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/access/request-code", async (req, res) => {
  try {
    pruneAccessMaps();
    const email = normalizeEmail(req.body?.email);
    const phone = String(req.body?.phone || "").trim();

    if (!isValidEmail(email)) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }

    const accessRecord = await findAccessRecord(email);
    const accessResult = validateAccessRecord(accessRecord, phone);
    if (!accessResult.ok) {
      res.status(403).json({ error: accessResult.error });
      return;
    }

    const code = createAccessCode();
    const key = `${email}:${normalizePhoneDigits(phone)}`;
    accessCodes.set(key, {
      codeHash: hashAccessCode({ email, phone, code }),
      expiresAt: Date.now() + ACCESS_CODE_TTL_MS,
      attemptCount: 0,
    });

    const smsResult = await sendAccessCodeSms({ phone, code });
    res.json({
      success: true,
      expiresInSeconds: Math.floor(ACCESS_CODE_TTL_MS / 1000),
      quotaRemaining: smsResult.quotaRemaining,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to request access code." });
  }
});

app.post("/api/access/verify-code", async (req, res) => {
  try {
    pruneAccessMaps();
    const email = normalizeEmail(req.body?.email);
    const phone = String(req.body?.phone || "").trim();
    const code = String(req.body?.code || "").replace(/\D/g, "");
    const key = `${email}:${normalizePhoneDigits(phone)}`;
    const pending = accessCodes.get(key);

    if (!pending || pending.expiresAt <= Date.now()) {
      accessCodes.delete(key);
      res.status(403).json({ error: "The access code expired. Request a new code." });
      return;
    }

    pending.attemptCount += 1;
    if (pending.codeHash !== hashAccessCode({ email, phone, code })) {
      res.status(403).json({ error: "That access code is not correct." });
      return;
    }

    const accessRecord = await findAccessRecord(email);
    const accessResult = validateAccessRecord(accessRecord, phone);
    if (!accessResult.ok) {
      res.status(403).json({ error: accessResult.error });
      return;
    }

    accessCodes.delete(key);
    const token = crypto.randomBytes(32).toString("hex");
    verifiedAccessTokens.set(token, {
      email,
      phone: normalizePhoneDigits(phone),
      expiresAt: Date.now() + VERIFIED_ACCESS_TTL_MS,
    });

    res.json({
      success: true,
      accessToken: token,
      email,
      access: accessResult.accessInfo,
      expiresInSeconds: Math.floor(VERIFIED_ACCESS_TTL_MS / 1000),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to verify access code." });
  }
});

app.post("/api/access/validate-token", async (req, res) => {
  try {
    pruneAccessMaps();
    const token = String(req.body?.accessToken || "").trim();
    const record = verifiedAccessTokens.get(token);

    if (!record || record.expiresAt <= Date.now()) {
      verifiedAccessTokens.delete(token);
      res.status(403).json({ error: "Full exam access is not verified." });
      return;
    }

    const accessRecord = await findAccessRecord(record.email);
    const accessResult = validateAccessRecord(accessRecord, record.phone);
    if (!accessResult.ok) {
      res.status(403).json({ error: accessResult.error });
      return;
    }

    res.json({ success: true, email: record.email, access: accessResult.accessInfo });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to validate access." });
  }
});

app.get("/linked-books", async (req, res) => {
  if (!isLocalDesktopRequest(req)) {
    res.json({});
    return;
  }

  const linkedBooks = await readLinkedBooks();
  const response = Object.fromEntries(
    Object.entries(linkedBooks).map(([key, value]) => [
      key,
      {
        title: value.title,
        fileName: path.basename(value.path),
        linkedAt: value.linkedAt,
      },
    ])
  );
  res.json(response);
});

app.get("/book-pdf/:key", async (req, res) => {
  try {
    if (!isLocalDesktopRequest(req)) {
      res.status(403).send("Desktop PDF linking is only available from localhost.");
      return;
    }

    const key = String(req.params.key || "").trim();
    const linkedBooks = await readLinkedBooks();
    const linkedPath = linkedBooks[key]?.path;

    if (!linkedPath) {
      res.status(404).send("Book has not been linked yet");
      return;
    }

    const absolutePath = path.isAbsolute(linkedPath) ? linkedPath : resolveBookPath(linkedPath);
    await fs.access(absolutePath);
    res.sendFile(absolutePath, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : "Unable to load book PDF");
  }
});

app.post("/link-book", async (req, res) => {
  try {
    if (!isLocalDesktopRequest(req)) {
      res.status(403).json({ error: "Desktop PDF linking is only available from localhost." });
      return;
    }

    const key = String(req.body?.key || "").trim();
    const title = String(req.body?.title || key || "reference book").trim();

    if (!key) {
      res.status(400).json({ error: "Missing book key" });
      return;
    }

    const selectedPath = await chooseBookFile(title);
    const linkedBooks = await readLinkedBooks();
    linkedBooks[key] = {
      title,
      path: selectedPath,
      linkedAt: Date.now(),
    };
    await writeLinkedBooks(linkedBooks);
    res.json({
      key,
      title,
      fileName: path.basename(selectedPath),
      linkedAt: linkedBooks[key].linkedAt,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unable to link book" });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Elevator exam app running at http://${HOST}:${PORT}/start.html`);
});
