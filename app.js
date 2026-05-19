const STORAGE_KEY = "elevator_exam_state_v1";
const QUESTION_BANK_CACHE_KEY = "elevator_exam_question_bank_v1";
const SAMPLE_ACCOUNT_KEY = "elevator_exam_sample_account_v1";
const FULL_ACCESS_KEY = "elevator_exam_full_access_v1";
const SAMPLE_ACCESS_COUNTS_KEY = "elevator_exam_sample_access_counts_v1";
const SAMPLE_QUESTION_HISTORY_KEY = "elevator_exam_sample_question_history_v1";
const FULL_QUESTION_HISTORY_KEY = "elevator_exam_full_question_history_v1";
const SAMPLE_ACCESS_LIMIT = 3;
const SAMPLE_ACCESS_UNLIMITED_EMAIL = "shawn.raynor@gmail.com";
const SAMPLE_QUESTION_HISTORY_LIMIT = 5000;
const FULL_QUESTION_HISTORY_LIMIT = 20000;
const SESSION_PDF_DB_NAME = "elevator_exam_session_pdf_v1";
const SESSION_PDF_STORE_NAME = "pdfs";
const SESSION_PDF_RECORD_KEY = "active-codebook";
const SESSION_PDF_BOOK_PREFIX = "book:";
const DEFAULT_EXAM_QUESTION_COUNT = 50;
const DEFAULT_EXAM_DURATION_SECONDS = 10800;
const DEFAULT_SAMPLE_QUESTION_COUNT = 5;
const DEFAULT_SAMPLE_DURATION_SECONDS = 1200;

const books = [
  { title: "ASME A17.1-2004", key: "a17-1", path: "./reference-pdfs/national/ASME-A17-1_2013.pdf", requiresLocalCopy: true },
  { title: "ASME A17.2-2010", key: "a17-2", path: "./reference-pdfs/national/A17-2_2014.pdf", requiresLocalCopy: true },
  { title: "ASME A17.3-2015", key: "a17-3", path: "./reference-pdfs/national/ASME-A17-3_2015.pdf", requiresLocalCopy: true },
  { title: "ASME A17.5-2004", key: "a17-5", path: "./reference-pdfs/national/ASME - A17 -5_2004.pdf", requiresLocalCopy: true },
  { title: "ASME A90.1-2009", key: "asme-a90-1", path: "./reference-pdfs/national/ASME-A90-1-2009.pdf", requiresLocalCopy: true },
  { title: "ASME B20.1-2015", key: "b20-1", path: "./reference-pdfs/national/asme-b20-1-2015.pdf.pdf", requiresLocalCopy: true },
  { title: "ANSI A10.4-2016", key: "ansi-a10-4", path: "./reference-pdfs/national/ANSI_A10_4_2016.pdf", requiresLocalCopy: true },
  { title: "ICC A117.1-2009", key: "icc-a117-1", path: "./reference-pdfs/national/ICC - A117 -1- 2009 - ADA.pdf", requiresLocalCopy: true },
  { title: "2014 NYC Construction Codes", key: "nyc-2014-construction-codes", path: "./reference-pdfs/nyc/2014-nyc-construction-codes.pdf", requiresLocalCopy: true },
  { title: "NYC Building Code Chapter 11", key: "nyc-bc-chapter-11", path: "./reference-pdfs/nyc/nyc-building-code-chapter-11.pdf", requiresLocalCopy: true },
  { title: "NYC Building Code Chapter 30", key: "nyc-bc-chapter-30", path: "./reference-pdfs/nyc/nyc-building-code-chapter-30.pdf", requiresLocalCopy: true },
  { title: "NYC Building Code Chapter 33", key: "nyc-chapter-33", path: "./reference-pdfs/nyc/2022BC_Chapter33_Con_DemoSafetyWBwm.pdf", requiresLocalCopy: true },
  { title: "Appendix K1, K2, and K3", key: "appendix-k1", path: "./reference-pdfs/nyc/appendix-k1.pdf", requiresLocalCopy: true },
  { title: "Appendix K4", key: "appendix-k4", path: "./reference-pdfs/nyc/appendix-k4.pdf", requiresLocalCopy: true },
  { title: "NYC Electrical Code 2011", key: "nyc-electrical-code", path: "./reference-pdfs/nyc/Electrical-Code-Local-Law-39of2011.pdf", requiresLocalCopy: true },
];

const SAMPLE_QUESTIONS = [
  {
    id: 1,
    text: "According to ASME A17.1, what is the minimum clear height required in an elevator machine room?",
    options: ["A) 6 ft 6 in", "B) 7 ft 0 in", "C) 7 ft 6 in", "D) 8 ft 0 in"],
    correct: "C",
  },
  {
    id: 2,
    text: "The working clearance in front of electrical equipment operating at 600V or less shall be at least:",
    options: ["A) 30 inches", "B) 36 inches", "C) 42 inches", "D) 48 inches"],
    correct: "B",
  },
  {
    id: 3,
    text: "In NYC Building Code, elevator hoistway doors must comply with which section?",
    options: ["A) BC 3000", "B) BC 3010", "C) BC 2800", "D) BC 2600"],
    correct: "B",
  },
  {
    id: 4,
    text: "What does A17.2 primarily cover?",
    options: [
      "A) Safety Code for Elevators",
      "B) Guide for Inspection of Elevators",
      "C) Performance-Based Safety Code",
      "D) Elevator Electrical Equipment",
    ],
    correct: "B",
  },
  {
    id: 5,
    text: "NEC Article 620 covers:",
    options: [
      "A) Elevators, Dumbwaiters, Escalators",
      "B) Fire Alarm Systems",
      "C) Emergency Lighting",
      "D) Hazardous Locations",
    ],
    correct: "A",
  },
  ...Array.from({ length: 45 }, (_, i) => ({
    id: i + 6,
    text: `Question ${i + 6}: Sample realistic question related to elevator safety, electrical requirements, or NYC code provisions.`,
    options: ["A) Option A", "B) Option B", "C) Option C", "D) Option D"],
    correct: "B",
  })),
];

let currentBook = null;
let questionBank = [...SAMPLE_QUESTIONS];
let questionBankSource = {
  type: "sample",
  label: "Built-in sample questions",
};
let uploadedPdfUrl = "";
let pdfJsModule = null;
let activePdfDocument = null;
let activePdfPageNumber = 1;
let activePdfRenderTask = null;

function openSessionPdfDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SESSION_PDF_DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(SESSION_PDF_STORE_NAME);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function sessionPdfRecordKey(bookKey = "") {
  return bookKey ? `${SESSION_PDF_BOOK_PREFIX}${bookKey}` : SESSION_PDF_RECORD_KEY;
}

async function saveSessionPdf(file, bookKey = "") {
  const db = await openSessionPdfDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSION_PDF_STORE_NAME, "readwrite");
    transaction.objectStore(SESSION_PDF_STORE_NAME).put(
      {
        name: file.name,
        type: file.type,
        updatedAt: Date.now(),
        file,
      },
      sessionPdfRecordKey(bookKey)
    );
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function loadSessionPdf(bookKey = "") {
  const db = await openSessionPdfDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SESSION_PDF_STORE_NAME, "readonly");
    const request = transaction.objectStore(SESSION_PDF_STORE_NAME).get(sessionPdfRecordKey(bookKey));
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function getConfig() {
  const config = window.ELEVATOR_EXAM_CONFIG || {};
  const fullQuestionCount = Number(config.fullQuestionCount || config.questionCount);
  const fullDurationMinutes = Number(config.fullDurationMinutes);
  const sampleQuestionCount = Number(config.sampleQuestionCount);
  const sampleDurationMinutes = Number(config.sampleDurationMinutes);

  return {
    questionSheetUrl: String(config.questionSheetUrl || "").trim(),
    questionSources: Array.isArray(config.questionSources) ? config.questionSources : [],
    localQuestionBankUrl: String(config.localQuestionBankUrl || "./question-bank-1000.csv").trim(),
    fullQuestionCount: fullQuestionCount > 0 ? fullQuestionCount : DEFAULT_EXAM_QUESTION_COUNT,
    fullDurationSeconds: fullDurationMinutes > 0 ? fullDurationMinutes * 60 : DEFAULT_EXAM_DURATION_SECONDS,
    sampleQuestionCount: sampleQuestionCount > 0 ? sampleQuestionCount : DEFAULT_SAMPLE_QUESTION_COUNT,
    sampleDurationSeconds: sampleDurationMinutes > 0 ? sampleDurationMinutes * 60 : DEFAULT_SAMPLE_DURATION_SECONDS,
    sourceMix: Array.isArray(config.sourceMix) ? config.sourceMix : [],
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function normalizeSampleEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function saveSampleAccount(email) {
  const account = {
    email: normalizeSampleEmail(email),
    createdAt: Date.now(),
  };
  localStorage.setItem(SAMPLE_ACCOUNT_KEY, JSON.stringify(account));
  return account;
}

function loadSampleAccount() {
  try {
    const raw = localStorage.getItem(SAMPLE_ACCOUNT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}

function loadSampleAccessCounts() {
  try {
    const raw = localStorage.getItem(SAMPLE_ACCESS_COUNTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveSampleAccessCounts(counts) {
  localStorage.setItem(SAMPLE_ACCESS_COUNTS_KEY, JSON.stringify(counts));
}

function getSampleAccessStatus(email) {
  const normalizedEmail = normalizeSampleEmail(email);
  const isUnlimited = normalizedEmail === SAMPLE_ACCESS_UNLIMITED_EMAIL;
  const used = Number(loadSampleAccessCounts()[normalizedEmail] || 0);
  const remaining = isUnlimited ? Infinity : Math.max(0, SAMPLE_ACCESS_LIMIT - used);

  return {
    allowed: isUnlimited || used < SAMPLE_ACCESS_LIMIT,
    isUnlimited,
    remaining,
    used,
  };
}

function recordSampleAccess(email) {
  const normalizedEmail = normalizeSampleEmail(email);
  if (!normalizedEmail || normalizedEmail === SAMPLE_ACCESS_UNLIMITED_EMAIL) {
    return;
  }

  const counts = loadSampleAccessCounts();
  counts[normalizedEmail] = Number(counts[normalizedEmail] || 0) + 1;
  saveSampleAccessCounts(counts);
}

let accessCountdownTimer = null;

function saveFullAccessSession({ email, phone, accessToken, expiresInSeconds, access = null }) {
  const session = {
    email: String(email || "").trim().toLowerCase(),
    phone: String(phone || "").trim(),
    accessToken: String(accessToken || "").trim(),
    expiresAt: Date.now() + Math.max(0, Number(expiresInSeconds) || 0) * 1000,
    access: access || null,
  };
  localStorage.setItem(FULL_ACCESS_KEY, JSON.stringify(session));
  return session;
}

function loadFullAccessSession() {
  try {
    const raw = localStorage.getItem(FULL_ACCESS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed?.accessToken || !parsed?.email || Number(parsed.expiresAt || 0) <= Date.now()) {
      localStorage.removeItem(FULL_ACCESS_KEY);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(FULL_ACCESS_KEY);
    return null;
  }
}

async function postAccessGate(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Access request failed.");
  }

  return data;
}

async function validateFullAccessSession() {
  const session = loadFullAccessSession();
  if (!session) {
    return null;
  }

  try {
    const validated = await postAccessGate("/api/access/validate-token", {
      accessToken: session.accessToken,
    });
    const nextSession = {
      ...session,
      email: validated.email || session.email,
      access: validated.access || session.access || null,
    };
    localStorage.setItem(FULL_ACCESS_KEY, JSON.stringify(nextSession));
    renderAccessExpiration(nextSession.access);
    return nextSession;
  } catch {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      renderAccessExpiration(session.access);
      return session;
    }

    localStorage.removeItem(FULL_ACCESS_KEY);
    renderAccessExpiration(null);
    return null;
  }
}

function formatAccessCountdown(totalMilliseconds) {
  const totalSeconds = Math.max(0, Math.floor(totalMilliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days} day${days === 1 ? "" : "s"}, ${hours} hour${hours === 1 ? "" : "s"} remaining`;
  }

  if (hours > 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}, ${minutes} minute${minutes === 1 ? "" : "s"} remaining`;
  }

  return `${minutes} minute${minutes === 1 ? "" : "s"} remaining`;
}

function renderAccessExpiration(access) {
  const panel = document.getElementById("access-expiration-panel");
  const startDate = document.getElementById("access-start-date");
  const expirationDate = document.getElementById("access-expiration-date");
  const countdown = document.getElementById("access-countdown");

  if (accessCountdownTimer) {
    window.clearInterval(accessCountdownTimer);
    accessCountdownTimer = null;
  }

  if (!panel || !access?.expiresAt) {
    if (panel) {
      panel.hidden = true;
    }
    return;
  }

  const expiresAt = new Date(access.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  if (startDate) {
    startDate.textContent = access.paymentDate ? `Access started: ${access.paymentDate}` : "Access start date: not listed";
  }
  if (expirationDate) {
    expirationDate.textContent = `Access expires: ${access.expiresDate || expiresAt.toLocaleDateString()}`;
  }

  const updateCountdown = () => {
    const remaining = expiresAt.getTime() - Date.now();
    if (countdown) {
      countdown.textContent = remaining <= 0 ? "Access expired" : formatAccessCountdown(remaining);
    }
  };

  updateCountdown();
  accessCountdownTimer = window.setInterval(updateCountdown, 60000);
}

function isLocalDesktopServer() {
  return ["127.0.0.1", "localhost"].includes(window.location.hostname);
}

async function loadPdfJsModule() {
  if (pdfJsModule) {
    return pdfJsModule;
  }

  pdfJsModule = await import("./vendor/pdf.min.mjs");
  pdfJsModule.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";
  return pdfJsModule;
}

async function renderActivePdfPage() {
  if (!activePdfDocument) {
    return;
  }

  const canvas = document.getElementById("pdf-canvas");
  const pageStatus = document.getElementById("pdf-page-status");
  const previousButton = document.getElementById("pdf-prev-page");
  const nextButton = document.getElementById("pdf-next-page");

  if (!canvas) {
    return;
  }

  if (activePdfRenderTask) {
    activePdfRenderTask.cancel();
    activePdfRenderTask = null;
  }

  const page = await activePdfDocument.getPage(activePdfPageNumber);
  const container = document.getElementById("pdf-js-viewer");
  const availableWidth = Math.max(320, (container?.clientWidth || 720) - 24);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = availableWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d");

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  if (pageStatus) {
    pageStatus.textContent = `Page ${activePdfPageNumber} / ${activePdfDocument.numPages}`;
  }

  if (previousButton) {
    previousButton.disabled = activePdfPageNumber <= 1;
  }

  if (nextButton) {
    nextButton.disabled = activePdfPageNumber >= activePdfDocument.numPages;
  }

  activePdfRenderTask = page.render({ canvasContext: context, viewport });

  try {
    await activePdfRenderTask.promise;
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") {
      throw error;
    }
  } finally {
    activePdfRenderTask = null;
  }
}

async function loadPdfFileIntoCanvas(file) {
  const viewer = document.getElementById("pdf-viewer");
  const canvasViewer = document.getElementById("pdf-js-viewer");
  const status = document.getElementById("pdf-status");
  const pdfjs = await loadPdfJsModule();
  const bytes = await file.arrayBuffer();

  activePdfDocument = await pdfjs.getDocument({ data: bytes }).promise;
  activePdfPageNumber = 1;

  if (viewer) {
    viewer.hidden = true;
  }

  if (canvasViewer) {
    canvasViewer.hidden = false;
  }

  await renderActivePdfPage();

  if (status) {
    status.textContent = "Loaded from this device for the current browser session.";
  }
}

async function preparePdfFromFile(file, { persist = false } = {}) {
  const viewer = document.getElementById("pdf-viewer");
  const openLink = document.getElementById("pdf-open-link");
  const title = document.getElementById("pdf-title");
  const status = document.getElementById("pdf-status");

  if (uploadedPdfUrl) {
    URL.revokeObjectURL(uploadedPdfUrl);
  }

  uploadedPdfUrl = URL.createObjectURL(file);

  if (viewer) {
    viewer.src = uploadedPdfUrl;
  }

  if (openLink) {
    openLink.href = uploadedPdfUrl;
    openLink.hidden = false;
  }

  if (title) {
    title.textContent = file.name;
  }

  if (status) {
    status.textContent = "Rendering PDF from this device...";
  }

  if (persist) {
    await saveSessionPdf(file);
  }

  await loadPdfFileIntoCanvas(file);
}

async function fetchLinkedBooks() {
  try {
    const response = await fetch("/linked-books", { cache: "no-store" });
    if (!response.ok) {
      return {};
    }

    return response.json();
  } catch {
    return {};
  }
}

async function linkReferenceBook(book) {
  const response = await fetch("/link-book", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: book.key,
      title: book.title,
    }),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Unable to link ${book.title}`);
  }

  return response.json();
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
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((line) => line.trim().length);
  if (!lines.length) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header, index) => {
    const normalizedHeader = header
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    return normalizedHeader || (index === 0 ? "id" : "");
  });
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      if (!header) {
        return row;
      }

      row[header] = cells[index] || "";
      return row;
    }, {});
  });
}

function normalizeQuestionSourceUrl(url) {
  if (!url) {
    return "";
  }

  if (url.includes("/pub?output=csv") || url.includes("/pubhtml")) {
    return url.replace("/pubhtml", "/pub?output=csv").replace(/\?.*$/, "?output=csv");
  }

  if (url.includes("/gviz/tq")) {
    return url;
  }

  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    return url;
  }

  const sheetId = match[1];
  const gidMatch = url.match(/[?&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function normalizeQuestionRow(row, index, sourceContext = {}) {
  const rowValue = (...keys) => {
    const foundKey = keys.find((key) => String(row[key] || "").trim());
    return foundKey ? row[foundKey] : "";
  };
  const options = [
    rowValue("option_a", "a", "answer_a", "choice_a"),
    rowValue("option_b", "b", "answer_b", "choice_b"),
    rowValue("option_c", "c", "answer_c", "choice_c"),
    rowValue("option_d", "d", "answer_d", "choice_d"),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const correct = String(rowValue("correct", "correct_answer", "answer", "key")).trim().toUpperCase();
  const text = String(rowValue("text", "question", "question_text", "prompt")).trim();

  if (!text || options.length < 2 || !["A", "B", "C", "D"].includes(correct)) {
    return null;
  }

  const normalizedOptions = options.map((option, optionIndex) => {
    const prefix = `${String.fromCharCode(65 + optionIndex)}) `;
    return option.startsWith(prefix) ? option : `${prefix}${option}`;
  });

  return {
    id: Number(rowValue("id", "number", "question_number", "question_id")) || index + 1,
    text,
    options: normalizedOptions,
    correct,
    source: String(rowValue("source", "book", "reference_book")).trim(),
    topic: String(rowValue("topic", "category", "subject")).trim(),
    reference: String(rowValue("reference", "ref", "citation")).trim(),
    section: String(rowValue("section", "code_section", "part")).trim(),
    page: String(rowValue("page", "page_number")).trim(),
    location: String(rowValue("location", "answer_location")).trim(),
    explanation: String(rowValue("explanation", "rationale", "why")).trim(),
    type: String(rowValue("type", "question_type") || "multiple_choice").trim(),
    sourceGroup: String(sourceContext.sourceGroup || sourceContext.label || "").trim(),
    sourceLabel: String(sourceContext.label || sourceContext.sourceGroup || "").trim(),
    bankKey: `${sourceContext.sourceGroup || sourceContext.label || "default"}:${rowValue("id", "number", "question_number", "question_id") || index + 1}`,
  };
}

function cleanQuestionText(text) {
  return String(text || "")
    .replace(/^question\s+\d+\s*:\s*/i, "")
    .trim();
}

function loadCachedQuestionBank() {
  try {
    const raw = localStorage.getItem(QUESTION_BANK_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

function cacheQuestionBank(bank) {
  try {
    localStorage.setItem(QUESTION_BANK_CACHE_KEY, JSON.stringify(bank));
  } catch {
    // Ignore cache write failures and continue with in-memory data.
  }
}

async function loadQuestionBank() {
  const { questionSheetUrl, questionSources, localQuestionBankUrl } = getConfig();
  const cachedQuestionBank = loadCachedQuestionBank();
  const fallback = cachedQuestionBank || [...SAMPLE_QUESTIONS];

  async function loadCsvQuestionSource(url, sourceContext = {}) {
    const response = await fetch(normalizeQuestionSourceUrl(url), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Question source request failed with ${response.status}`);
    }

    const csvText = await response.text();
    const parsedRows = parseCsv(csvText);
    const loadedQuestions = parsedRows
      .map((row, index) => normalizeQuestionRow(row, index, sourceContext))
      .filter(Boolean);

    if (!loadedQuestions.length) {
      throw new Error("Question source returned no valid questions");
    }

    return loadedQuestions;
  }

  try {
    const configuredSources = questionSources
      .map((source, index) => ({
        label: String(source.label || source.sourceGroup || `Question source ${index + 1}`).trim(),
        sourceGroup: String(source.sourceGroup || source.label || `source-${index + 1}`).trim(),
        url: String(source.url || "").trim(),
      }))
      .filter((source) => source.url);

    if (configuredSources.length) {
      const sourceBanks = await Promise.all(
        configuredSources.map((source) => loadCsvQuestionSource(source.url, source))
      );
      const loadedQuestions = sourceBanks.flat();
      questionBank = loadedQuestions;
      questionBankSource = {
        type: "google-sheet",
        label: `Live Google Sheet (${loadedQuestions.length} questions from ${configuredSources.length} tabs)`,
      };
      cacheQuestionBank(loadedQuestions);
      return questionBank;
    }

    if (questionSheetUrl) {
      const loadedQuestions = await loadCsvQuestionSource(questionSheetUrl, {
        label: "Google Sheet",
        sourceGroup: "Google Sheet",
      });
      questionBank = loadedQuestions;
      questionBankSource = {
        type: "google-sheet",
        label: `Live Google Sheet (${loadedQuestions.length} questions)`,
      };
      cacheQuestionBank(loadedQuestions);
      return questionBank;
    }
  } catch (error) {
    // Fall through to the local CSV bank when the Google Sheet is private, offline, or blocked.
  }

  try {
    const loadedQuestions = await loadCsvQuestionSource(localQuestionBankUrl);
    questionBank = loadedQuestions;
    questionBankSource = {
      type: "local-csv",
      label: `Local CSV fallback (${loadedQuestions.length} questions)`,
    };
    cacheQuestionBank(loadedQuestions);
    return questionBank;
  } catch (error) {
    questionBank = fallback;
    questionBankSource = cachedQuestionBank
      ? {
          type: "cached",
          label: `Cached question bank (${cachedQuestionBank.length} questions)`,
        }
      : {
          type: "sample",
          label: "Built-in sample questions",
        };
    return questionBank;
  }
}

function getActiveQuestions(state = loadState()) {
  if (Array.isArray(state.examQuestions) && state.examQuestions.length) {
    return state.examQuestions;
  }

  return questionBank;
}

function getQuestionKey(question) {
  return String(question?.bankKey || question?.id || "");
}

function loadSampleQuestionHistory() {
  try {
    const raw = localStorage.getItem(SAMPLE_QUESTION_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

function saveSampleQuestionHistory(questionKeys) {
  const deduped = [];
  const seen = new Set();

  questionKeys
    .filter(Boolean)
    .map(String)
    .reverse()
    .forEach((questionKey) => {
      if (!seen.has(questionKey)) {
        seen.add(questionKey);
        deduped.push(questionKey);
      }
    });

  localStorage.setItem(
    SAMPLE_QUESTION_HISTORY_KEY,
    JSON.stringify(deduped.reverse().slice(-SAMPLE_QUESTION_HISTORY_LIMIT))
  );
}

function recordSampleQuestions(questions) {
  const nextHistory = [...loadSampleQuestionHistory(), ...questions.map(getQuestionKey)];
  saveSampleQuestionHistory(nextHistory);
}

function loadFullQuestionHistory() {
  try {
    const raw = localStorage.getItem(FULL_QUESTION_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

function saveFullQuestionHistory(questionKeys) {
  const deduped = [];
  const seen = new Set();

  questionKeys
    .filter(Boolean)
    .map(String)
    .reverse()
    .forEach((questionKey) => {
      if (!seen.has(questionKey)) {
        seen.add(questionKey);
        deduped.push(questionKey);
      }
    });

  localStorage.setItem(
    FULL_QUESTION_HISTORY_KEY,
    JSON.stringify(deduped.reverse().slice(-FULL_QUESTION_HISTORY_LIMIT))
  );
}

function recordFullQuestions(questions) {
  const nextHistory = [...loadFullQuestionHistory(), ...questions.map(getQuestionKey)];
  saveFullQuestionHistory(nextHistory);
}

function getCryptoRandomInt(maxExclusive) {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
    return 0;
  }

  const cryptoApi = window.crypto || window.msCrypto;
  if (!cryptoApi?.getRandomValues) {
    return Math.floor(Math.random() * maxExclusive);
  }

  const maxUint32 = 0x100000000;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const values = new Uint32Array(1);

  do {
    cryptoApi.getRandomValues(values);
  } while (values[0] >= limit);

  return values[0] % maxExclusive;
}

function shuffleArray(items) {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const randomIndex = getCryptoRandomInt(i + 1);
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }

  return shuffled;
}

function normalizeMatchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function questionMatchesSourceRule(question, rule) {
  const questionSource = normalizeMatchValue(question.source);
  const questionTopic = normalizeMatchValue(question.topic);
  const questionSourceGroup = normalizeMatchValue(question.sourceGroup);
  const sourceMatch = normalizeMatchValue(rule.sourceMatch);
  const topicMatch = normalizeMatchValue(rule.topicMatch);
  const sourceGroup = normalizeMatchValue(rule.sourceGroup);

  const sourceOk = !sourceMatch || questionSource.includes(sourceMatch);
  const topicOk = !topicMatch || questionTopic.includes(topicMatch);
  const sourceGroupOk = !sourceGroup || questionSourceGroup === sourceGroup;
  return sourceOk && topicOk && sourceGroupOk;
}

function selectQuestionsFromSourceMix(bank, questionCount, sourceMix) {
  if (!sourceMix.length) {
    return shuffleArray(bank).slice(0, Math.min(questionCount, bank.length));
  }

  const selected = [];
  const usedIds = new Set();

  sourceMix.forEach((rule) => {
    const targetCount = Math.max(0, Number(rule.count) || 0);
    if (!targetCount) {
      return;
    }

    const matchingQuestions = shuffleArray(
      bank.filter((question) => !usedIds.has(question.bankKey || question.id) && questionMatchesSourceRule(question, rule))
    ).slice(0, targetCount);

    matchingQuestions.forEach((question) => {
      selected.push(question);
      usedIds.add(question.bankKey || question.id);
    });
  });

  if (selected.length < questionCount) {
    const leftovers = shuffleArray(bank.filter((question) => !usedIds.has(question.bankKey || question.id)));
    selected.push(...leftovers.slice(0, questionCount - selected.length));
  }

  return shuffleArray(selected).slice(0, Math.min(questionCount, bank.length));
}

function selectQuestionsFromWeightedSourceMix(bank, questionCount, sourceMix, excludedQuestionKeys = new Set()) {
  if (!sourceMix.length) {
    const unseenQuestions = bank.filter((question) => !excludedQuestionKeys.has(getQuestionKey(question)));
    return shuffleArray(unseenQuestions.length ? unseenQuestions : bank).slice(0, Math.min(questionCount, bank.length));
  }

  const selected = [];
  const usedIds = new Set();
  const weightedRules = sourceMix
    .map((rule) => ({
      ...rule,
      weight: Math.max(0, Number(rule.count) || 0),
    }))
    .filter((rule) => rule.weight);

  for (let index = 0; index < questionCount; index += 1) {
    const availableRules = weightedRules.filter((rule) =>
      bank.some((question) => !usedIds.has(getQuestionKey(question)) && questionMatchesSourceRule(question, rule))
    );

    if (!availableRules.length) {
      break;
    }

    const totalWeight = availableRules.reduce((sum, rule) => sum + rule.weight, 0);
    let roll = getCryptoRandomInt(totalWeight);
    const selectedRule =
      availableRules.find((rule) => {
        roll -= rule.weight;
        return roll < 0;
      }) || availableRules[availableRules.length - 1];

    const matchingQuestions = bank.filter(
      (question) => !usedIds.has(getQuestionKey(question)) && questionMatchesSourceRule(question, selectedRule)
    );
    const unseenMatchingQuestions = matchingQuestions.filter((question) => !excludedQuestionKeys.has(getQuestionKey(question)));
    const selectedQuestion = shuffleArray(unseenMatchingQuestions.length ? unseenMatchingQuestions : matchingQuestions)[0];

    if (selectedQuestion) {
      selected.push(selectedQuestion);
      usedIds.add(getQuestionKey(selectedQuestion));
    }
  }

  if (selected.length < questionCount) {
    const leftovers = bank.filter((question) => !usedIds.has(getQuestionKey(question)));
    const unseenLeftovers = leftovers.filter((question) => !excludedQuestionKeys.has(getQuestionKey(question)));
    const fallbackLeftovers = unseenLeftovers.length ? unseenLeftovers : leftovers;
    selected.push(...shuffleArray(fallbackLeftovers).slice(0, questionCount - selected.length));
  }

  return shuffleArray(selected).slice(0, Math.min(questionCount, bank.length));
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, totalSeconds);
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const leftover = String(seconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${leftover}`;
}

function defaultState() {
  return {
    startedAt: null,
    endsAt: null,
    mode: "full",
    questionCount: DEFAULT_EXAM_QUESTION_COUNT,
    durationSeconds: DEFAULT_EXAM_DURATION_SECONDS,
    accountEmail: null,
    currentQ: 0,
    examQuestions: [],
    userAnswers: {},
    reviewMarks: {},
    submitted: false,
    score: null,
    submittedAt: null,
    expired: false,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  const state = defaultState();
  saveState(state);
  return state;
}

function calculateRemainingSeconds(state) {
  if (!state.endsAt || state.submitted) {
    return state.durationSeconds || DEFAULT_EXAM_DURATION_SECONDS;
  }

  return Math.max(0, Math.floor((state.endsAt - Date.now()) / 1000));
}

function calculateScore(state) {
  let score = 0;
  const activeQuestions = getActiveQuestions(state);
  const pointsPerQuestion = activeQuestions.length ? 100 / activeQuestions.length : 0;
  activeQuestions.forEach((question) => {
    if (state.userAnswers[getQuestionKey(question)] === question.correct) {
      score += pointsPerQuestion;
    }
  });
  return Math.round(score);
}

function getUnansweredQuestions(state) {
  return getActiveQuestions(state).filter((question) => !state.userAnswers[getQuestionKey(question)]);
}

function getQuestionDisplayNumber(state, question) {
  const questionKey = getQuestionKey(question);
  return getActiveQuestions(state).findIndex((item) => getQuestionKey(item) === questionKey) + 1;
}

function formatAnswerText(question, answerLetter) {
  if (!answerLetter) {
    return "No answer selected";
  }

  const optionIndex = answerLetter.charCodeAt(0) - 65;
  return question.options[optionIndex] || answerLetter;
}

function buildAnswerReference(question) {
  const details = [
    question.reference || question.source,
    question.section ? `Section: ${question.section}` : "",
    question.page ? `Page: ${question.page}` : "",
    question.location || question.topic,
  ].filter(Boolean);

  return details.length ? details.join(" • ") : "No answer location is listed in the question bank yet.";
}

function showIncompleteSubmitWarning(state) {
  const unanswered = getUnansweredQuestions(state);

  if (!unanswered.length) {
    return false;
  }

  const unansweredList = unanswered
    .map((question) => `Question ${getQuestionDisplayNumber(state, question)}`)
    .join(", ");
  const warning = document.getElementById("submit-warning");

  if (warning) {
    warning.hidden = false;
    warning.innerHTML = `
      <strong>This test is not complete.</strong>
      <span>You have ${unanswered.length} unanswered question${unanswered.length === 1 ? "" : "s"}: ${unansweredList}.</span>
      <a href="./review.html">Go to review</a>
    `;
    warning.scrollIntoView({ block: "nearest" });
  }

  return true;
}

async function startNewExam({ mode = "full", accountEmail = null, accessToken = null } = {}) {
  await loadQuestionBank();
  const startedAt = Date.now();
  const config = getConfig();
  const isSample = mode === "sample";
  if (!isSample && !accessToken) {
    throw new Error("Full exam access is not verified.");
  }
  if (isSample) {
    const sampleAccess = getSampleAccessStatus(accountEmail);
    if (!sampleAccess.allowed) {
      throw new Error("This email has reached the 3 sample exam limit. Use full exam access to continue.");
    }
  }
  const questionCount = isSample ? config.sampleQuestionCount : config.fullQuestionCount;
  const durationSeconds = isSample ? config.sampleDurationSeconds : config.fullDurationSeconds;
  const sampleQuestionHistory = new Set(isSample ? loadSampleQuestionHistory() : []);
  const fullQuestionHistory = new Set(isSample ? [] : loadFullQuestionHistory());
  const selectedQuestions = isSample
    ? selectQuestionsFromWeightedSourceMix(questionBank, questionCount, config.sourceMix, sampleQuestionHistory)
    : selectQuestionsFromWeightedSourceMix(questionBank, questionCount, config.sourceMix, fullQuestionHistory);
  if (isSample) {
    recordSampleQuestions(selectedQuestions);
    recordSampleAccess(accountEmail);
  } else {
    recordFullQuestions(selectedQuestions);
  }
  const state = {
    startedAt,
    endsAt: startedAt + durationSeconds * 1000,
    mode: isSample ? "sample" : "full",
    questionCount,
    durationSeconds,
    accountEmail,
    accessToken: isSample ? null : accessToken,
    currentQ: 0,
    examQuestions: selectedQuestions,
    userAnswers: {},
    reviewMarks: {},
    submitted: false,
    score: null,
    submittedAt: null,
    expired: false,
  };
  saveState(state);
  window.location.href = "./exam.html";
}

function submitExam({ expired = false } = {}) {
  const state = loadState();
  if (!expired && showIncompleteSubmitWarning(state)) {
    return;
  }

  state.submitted = true;
  state.expired = expired;
  state.submittedAt = Date.now();
  state.score = calculateScore(state);
  saveState(state);
  window.location.href = "./results.html";
}

function ensureExamState() {
  const state = loadState();
  if (!state.startedAt || state.submitted) {
    window.location.href = "./start.html";
    return null;
  }
  return state;
}

function renderQuestion(state) {
  const activeQuestions = getActiveQuestions(state);
  const question = activeQuestions[state.currentQ];
  const qNumber = document.getElementById("q-number");
  const currentQuestion = document.getElementById("current-question");
  const reviewStatus = document.getElementById("review-status");
  const totalQuestions = document.getElementById("total-questions");
  const nextButton = document.getElementById("next-question");

  if (!question || !qNumber || !currentQuestion) {
    return;
  }

  qNumber.textContent = String(state.currentQ + 1);
  if (totalQuestions) {
    totalQuestions.textContent = String(activeQuestions.length);
  }
  if (reviewStatus) {
    const pointsPerQuestion = activeQuestions.length ? Math.round(100 / activeQuestions.length) : 0;
    reviewStatus.textContent = state.reviewMarks[getQuestionKey(question)] ? "Marked for review" : `${pointsPerQuestion} points each`;
  }
  if (nextButton) {
    nextButton.textContent = state.currentQ >= activeQuestions.length - 1 ? "Exam Complete" : "Next";
  }

  currentQuestion.innerHTML = `
    <p class="text-xl">${cleanQuestionText(question.text)}</p>
    <div class="answer-list">
      ${question.options
        .map((option, index) => {
          const letter = String.fromCharCode(65 + index);
          const checked = state.userAnswers[getQuestionKey(question)] === letter ? "checked" : "";
          return `
            <label class="answer-option">
              <input type="radio" name="question-${getQuestionKey(question)}" value="${letter}" ${checked}>
              <span>${option}</span>
            </label>
          `;
        })
        .join("")}
    </div>
  `;

  currentQuestion.querySelectorAll("input[type='radio']").forEach((input) => {
    input.addEventListener("change", () => {
      const nextState = loadState();
      const questionKey = getQuestionKey(question);
      nextState.userAnswers[questionKey] = input.value;
      delete nextState.reviewMarks[questionKey];
      saveState(nextState);
      renderQuestion(nextState);
      renderReviewMap(nextState);
    });
  });
}

function buildAnswerOptions(question, selectedAnswer) {
  return `
    <div class="answer-list">
      ${question.options
        .map((option, index) => {
          const letter = String.fromCharCode(65 + index);
          const checked = selectedAnswer === letter ? "checked" : "";
          return `
            <label class="answer-option">
              <input type="radio" name="question-${getQuestionKey(question)}" value="${letter}" ${checked}>
              <span>${option}</span>
            </label>
          `;
        })
        .join("")}
    </div>
  `;
}

function getReviewQuestions(state) {
  return getActiveQuestions(state).filter((question) => {
    const questionKey = getQuestionKey(question);
    return !state.userAnswers[questionKey] || state.reviewMarks[questionKey];
  });
}

function renderReviewListPage(state) {
  const container = document.getElementById("review-list-page");

  if (!container) {
    return;
  }

  const reviewQuestions = getReviewQuestions(state);
  container.innerHTML = "";

  if (!reviewQuestions.length) {
    container.innerHTML = `
      <div class="review-empty">
        <p class="eyebrow">Review Complete</p>
        <p class="muted">There are no unanswered or marked questions left.</p>
      </div>
    `;
    return;
  }

  reviewQuestions.forEach((question) => {
    const card = document.createElement("section");
    card.className = "review-question-card";
    const questionKey = getQuestionKey(question);
    const needsReview = !!state.reviewMarks[questionKey];
    const answered = !!state.userAnswers[questionKey];
    const displayNumber = getQuestionDisplayNumber(state, question);

    card.innerHTML = `
      <div class="question-meta">
        <div>
          <span class="muted">Question</span>
          <strong style="font-size: 1.8rem; margin-left: 8px;">${displayNumber}</strong>
        </div>
        <div class="muted">${needsReview ? "Marked for review" : answered ? "Answered" : "Unanswered"}</div>
      </div>
      <h3>${cleanQuestionText(question.text)}</h3>
      ${buildAnswerOptions(question, state.userAnswers[questionKey])}
    `;

    card.querySelectorAll("input[type='radio']").forEach((input) => {
      input.addEventListener("change", () => {
        const nextState = loadState();
        nextState.userAnswers[questionKey] = input.value;
        delete nextState.reviewMarks[questionKey];
        saveState(nextState);
        renderReviewListPage(nextState);
      });
    });

    container.appendChild(card);
  });
}

function markCurrentQuestionForReview() {
  const state = loadState();
  const question = getActiveQuestions(state)[state.currentQ];

  if (!question) {
    return state;
  }

  state.reviewMarks[getQuestionKey(question)] = true;
  saveState(state);
  return state;
}

function renderReviewMap(state) {
  const reviewGrid = document.getElementById("review-grid");

  if (!reviewGrid) {
    return;
  }

  reviewGrid.innerHTML = "";

  getActiveQuestions(state).forEach((question, index) => {
    const tile = document.createElement("button");
    const questionKey = getQuestionKey(question);
    const hasAnswer = !!state.userAnswers[questionKey];
    const needsReview = !!state.reviewMarks[questionKey];

    tile.type = "button";
    tile.className = "review-tile";

    if (hasAnswer) {
      tile.classList.add("answered");
    }

    if (needsReview) {
      tile.classList.add("review");
    }

    if (index === state.currentQ) {
      tile.classList.add("current");
    }

    tile.textContent = String(index + 1);
    tile.addEventListener("click", () => {
      const nextState = loadState();
      nextState.currentQ = index;
      saveState(nextState);

      if (document.body.dataset.page === "review") {
        window.location.href = "./exam.html";
        return;
      }

      renderQuestion(nextState);
      renderReviewMap(nextState);
    });

    reviewGrid.appendChild(tile);
  });
}

async function updateReferenceStatuses() {
  return Promise.resolve();
}

async function renderPreviewBookSetup() {
  const container = document.getElementById("preview-book-setup-list");
  const onlineList = document.getElementById("online-book-list");

  if (!container && !onlineList) {
    return;
  }

  const requiredBooks = books.filter((book) => book.requiresLocalCopy);
  const onlineBooks = books.filter((book) => book.online);

  if (onlineList) {
    onlineList.textContent = onlineBooks.map((book) => book.title).join(", ");
    const onlineNote = onlineList.closest(".online-reference-note");
    if (onlineNote) {
      onlineNote.hidden = onlineBooks.length === 0;
    }
  }

  if (!container) {
    return;
  }

  container.innerHTML = "";

  requiredBooks.forEach((book) => {
    const row = document.createElement("div");
    row.className = "book-setup-row";
    const localDesktop = isLocalDesktopServer();

    row.innerHTML = localDesktop
      ? `
        <div>
          <strong>${book.title}</strong>
          <span class="book-link-status">Not linked yet</span>
        </div>
        <button class="btn btn-secondary setup-reference-book" type="button">Link to my copy</button>
      `
      : `
        <div>
          <strong>${book.title}</strong>
          <span class="book-link-status">No PDF linked</span>
        </div>
        <label class="btn btn-secondary setup-reference-book">
          Link PDF
          <input type="file" accept="application/pdf" hidden>
        </label>
      `;

    const status = row.querySelector(".book-link-status");

    if (localDesktop) {
      fetchLinkedBooks()
        .then((linkedBooks) => {
          const linked = linkedBooks[book.key];
          if (linked && status) {
            status.textContent = linked.fileName;
          }
        })
        .catch(() => {});

      row.querySelector("button")?.addEventListener("click", async () => {
        const button = row.querySelector("button");
        button.disabled = true;
        button.textContent = "Linking...";

        try {
          const linked = await linkReferenceBook(book);
          if (status) {
            status.textContent = linked.fileName;
          }
          button.textContent = "Linked";
        } catch (error) {
          window.alert(error instanceof Error ? error.message : `Unable to link ${book.title}`);
          button.disabled = false;
          button.textContent = "Link to my copy";
        }
      });
    } else {
      const input = row.querySelector("input");

      loadSessionPdf(book.key)
        .then((record) => {
          if (record?.file && status) {
            status.textContent = record.name || record.file.name;
          }
        })
        .catch(() => {});

      input?.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];

        if (!file) {
          return;
        }

        if (status) {
          status.textContent = "Saving...";
        }

        await saveSessionPdf(file, book.key);

        if (status) {
          status.textContent = file.name;
        }
      });
    }

    container.appendChild(row);
  });
}

async function openReferenceBook(book) {
  if (!book) {
    return;
  }

  if (book.online) {
    window.open(book.path, "_blank", "noopener");
    return;
  }

  if (isLocalDesktopServer()) {
    try {
      const response = await fetch("/open-book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: book.key,
          title: book.title,
          linkIfMissing: true,
        }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || `Unable to open ${book.title}`);
      }
      return;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : `Unable to open ${book.title}`);
      return;
    }
  }

  window.open(`./viewer.html?book=${encodeURIComponent(book.key)}`, "_blank", "noopener");
}

function bindReferenceButtons() {
  document.querySelectorAll(".reference-book, .online-reference").forEach((button) => {
    const book = books.find((entry) => entry.key === button.dataset.bookKey);
    button.addEventListener("click", () => openReferenceBook(book));
  });
}

function bindPdfPageButtons() {
  const previousButton = document.getElementById("pdf-prev-page");
  const nextButton = document.getElementById("pdf-next-page");

  previousButton?.addEventListener("click", async () => {
    if (!activePdfDocument || activePdfPageNumber <= 1) {
      return;
    }

    activePdfPageNumber -= 1;
    await renderActivePdfPage();
  });

  nextButton?.addEventListener("click", async () => {
    if (!activePdfDocument || activePdfPageNumber >= activePdfDocument.numPages) {
      return;
    }

    activePdfPageNumber += 1;
    await renderActivePdfPage();
  });
}

async function initViewerPage() {
  bindPdfPageButtons();

  const params = new URLSearchParams(window.location.search);
  const bookKey = params.get("book") || "";
  const book = books.find((entry) => entry.key === bookKey);
  const title = document.getElementById("pdf-title");
  const status = document.getElementById("pdf-status");

  if (title) {
    title.textContent = book?.title || "Reference PDF";
  }

  if (!bookKey) {
    if (status) {
      status.textContent = "No reference book was selected.";
    }
    return;
  }

  try {
    const record = await loadSessionPdf(bookKey);

    if (!record?.file) {
      if (status) {
        status.textContent = "This PDF was not selected on the opening screen.";
      }
      return;
    }

    await preparePdfFromFile(record.file);
  } catch (error) {
    if (status) {
      status.textContent = "Could not open this PDF from local browser storage.";
    }
  }
}

function bindPreExamPdfUpload() {
  const input = document.getElementById("preexam-pdf-input");
  const status = document.getElementById("preexam-pdf-status");

  if (!input) {
    return;
  }

  loadSessionPdf()
    .then((record) => {
      if (record?.file && status) {
        status.textContent = `Ready for exam: ${record.name || record.file.name}`;
      }
    })
    .catch(() => {
      if (status) {
        status.textContent = "No PDF loaded yet.";
      }
    });

  input.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (status) {
      status.textContent = "Saving PDF for this exam session...";
    }

    try {
      await saveSessionPdf(file);
      if (status) {
        status.textContent = `Ready for exam: ${file.name}`;
      }
    } catch (error) {
      if (status) {
        status.textContent = "Could not prepare this PDF. You can still choose it from the exam page.";
      }
    }
  });
}

function initReviewPage() {
  const state = ensureExamState();
  if (!state) {
    return;
  }

  renderReviewListPage(state);
}

async function initStartPage() {
  await renderPreviewBookSetup();
  bindPreExamPdfUpload();
  const account = loadSampleAccount();
  const emailInput = document.getElementById("sample-email");
  const status = document.getElementById("sample-account-status");
  const accessForm = document.getElementById("full-access-form");
  const accessEmailInput = document.getElementById("access-email");
  const accessPhoneInput = document.getElementById("access-phone");
  const accessCodeInput = document.getElementById("access-code");
  const accessStatus = document.getElementById("access-gate-status");
  const requestCodeButton = document.getElementById("request-access-code");
  const verifyCodeButton = document.getElementById("verify-access-code");
  const fullAccessSession = loadFullAccessSession();

  if (account?.email && emailInput) {
    emailInput.value = account.email;
  }

  if (account?.email && accessEmailInput) {
    accessEmailInput.value = account.email;
  }

  if (fullAccessSession) {
    if (accessEmailInput) {
      accessEmailInput.value = fullAccessSession.email;
    }
    if (accessPhoneInput) {
      accessPhoneInput.value = fullAccessSession.phone || "";
    }
    if (accessStatus) {
      accessStatus.dataset.tone = "success";
      accessStatus.textContent = "Full exam access is verified on this device.";
    }
    renderAccessExpiration(fullAccessSession.access);
    validateFullAccessSession().catch(() => {});
  }

  document.getElementById("sample-account-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput?.value || "";

    if (!isValidEmail(email)) {
      if (status) {
        status.textContent = "Enter a valid email address to start the sample exam.";
      }
      emailInput?.focus();
      return;
    }

    const sampleAccess = getSampleAccessStatus(email);
    if (!sampleAccess.allowed) {
      if (status) {
        status.textContent = "This email has reached the 3 sample exam limit. Use full exam access to continue.";
      }
      return;
    }

    if (status) {
      status.textContent = sampleAccess.isUnlimited
        ? "Loading question bank..."
        : `Loading question bank... ${sampleAccess.remaining} sample exam${sampleAccess.remaining === 1 ? "" : "s"} remaining.`;
    }

    const savedAccount = saveSampleAccount(email);
    try {
      await startNewExam({ mode: "sample", accountEmail: savedAccount.email });
    } catch (error) {
      if (status) {
        status.textContent = error instanceof Error ? error.message : "Unable to start the sample exam.";
      }
    }
  });

  requestCodeButton?.addEventListener("click", async () => {
    const email = accessEmailInput?.value || "";
    const phone = accessPhoneInput?.value || "";

    if (accessStatus) {
      accessStatus.dataset.tone = "";
      accessStatus.textContent = "Checking access list...";
    }

    if (!isValidEmail(email)) {
      if (accessStatus) {
        accessStatus.textContent = "Enter the email address from the access list.";
      }
      return;
    }

    requestCodeButton.disabled = true;
    try {
      await postAccessGate("/api/access/request-code", { email, phone });
      saveSampleAccount(email);
      if (accessStatus) {
        accessStatus.dataset.tone = "success";
        accessStatus.textContent = "Access code sent by text. Enter the 6-digit code to start.";
      }
      accessCodeInput?.focus();
    } catch (error) {
      if (accessStatus) {
        accessStatus.dataset.tone = "";
        accessStatus.textContent = error instanceof Error ? error.message : "Unable to send access code.";
      }
    } finally {
      requestCodeButton.disabled = false;
    }
  });

  accessForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = accessEmailInput?.value || "";
    const phone = accessPhoneInput?.value || "";
    const code = accessCodeInput?.value || "";

    if (accessStatus) {
      accessStatus.dataset.tone = "";
      accessStatus.textContent = "Verifying code...";
    }

    if (verifyCodeButton) {
      verifyCodeButton.disabled = true;
    }
    try {
      const existingSession = loadFullAccessSession();
      const normalizedEmail = normalizeSampleEmail(email);
      if (existingSession?.accessToken && existingSession.email === normalizedEmail && !String(code || "").trim()) {
        const validSession = await validateFullAccessSession();
        if (!validSession) {
          throw new Error("Your saved full exam access could not be verified. Request a new code.");
        }

        if (accessStatus) {
          accessStatus.dataset.tone = "success";
          accessStatus.textContent = "Access verified. Loading full exam...";
        }
        await startNewExam({ mode: "full", accountEmail: validSession.email, accessToken: validSession.accessToken });
        return;
      }

      const verified = await postAccessGate("/api/access/verify-code", { email, phone, code });
      const session = saveFullAccessSession({
        email: verified.email || email,
        phone,
        accessToken: verified.accessToken,
        expiresInSeconds: verified.expiresInSeconds,
        access: verified.access || null,
      });
      renderAccessExpiration(session.access);
      saveSampleAccount(session.email);
      if (accessStatus) {
        accessStatus.dataset.tone = "success";
        accessStatus.textContent = "Access verified. Loading full exam...";
      }
      await startNewExam({ mode: "full", accountEmail: session.email, accessToken: session.accessToken });
    } catch (error) {
      if (accessStatus) {
        accessStatus.dataset.tone = "";
        accessStatus.textContent = error instanceof Error ? error.message : "Unable to verify access.";
      }
    } finally {
      if (verifyCodeButton) {
        verifyCodeButton.disabled = false;
      }
    }
  });

  document.getElementById("start-score-link")?.addEventListener("click", () => {
    window.location.href = "./results.html";
  });
}

async function initExamPage() {
  await loadQuestionBank();
  let state = ensureExamState();
  if (!state) {
    return;
  }

  renderQuestion(state);
  renderReviewMap(state);

  const modeLabel = document.getElementById("exam-mode-label");
  if (modeLabel) {
    modeLabel.textContent =
      state.mode === "sample"
        ? `Sample Exam - ${state.questionCount} Questions - ${Math.round(state.durationSeconds / 60)} Minutes`
        : `Full Exam - ${state.questionCount} Questions - ${Math.round(state.durationSeconds / 60)} Minutes`;
  }

  bindReferenceButtons();
  await updateReferenceStatuses();

  const timer = document.getElementById("timer");
  const previousButton = document.getElementById("prev-question");
  const markReviewButton = document.getElementById("mark-review");
  const nextButton = document.getElementById("next-question");
  const submitButton = document.getElementById("submit-exam");

  const syncTimer = () => {
    state = loadState();
    const remaining = calculateRemainingSeconds(state);

    if (timer) {
      timer.textContent = formatTime(remaining);
    }

    if (remaining <= 0) {
      submitExam({ expired: true });
    }
  };

  syncTimer();
  const timerId = window.setInterval(syncTimer, 1000);

  previousButton?.addEventListener("click", () => {
    const nextState = loadState();
    if (nextState.currentQ > 0) {
      nextState.currentQ -= 1;
      saveState(nextState);
      renderQuestion(nextState);
      renderReviewMap(nextState);
    }
  });

  markReviewButton?.addEventListener("click", () => {
    const nextState = markCurrentQuestionForReview();
    renderQuestion(nextState);
    renderReviewMap(nextState);
  });

  nextButton?.addEventListener("click", () => {
    const nextState = loadState();
    const activeQuestions = getActiveQuestions(nextState);
    const currentQuestion = activeQuestions[nextState.currentQ];

    if (currentQuestion && !nextState.userAnswers[getQuestionKey(currentQuestion)]) {
      nextState.reviewMarks[getQuestionKey(currentQuestion)] = true;
    }

    if (nextState.currentQ < activeQuestions.length - 1) {
      nextState.currentQ += 1;
      saveState(nextState);
      renderQuestion(nextState);
      renderReviewMap(nextState);
      return;
    }

    saveState(nextState);
    window.clearInterval(timerId);
    submitExam();
  });

  submitButton?.addEventListener("click", () => {
    window.clearInterval(timerId);
    submitExam();
  });

  window.addEventListener("beforeunload", () => {
    window.clearInterval(timerId);
  });
}

async function initResultsPage() {
  await loadQuestionBank();
  const state = loadState();
  const scoreCircle = document.getElementById("score-circle");
  const scoreText = document.getElementById("score-text");
  const modeLabel = document.getElementById("results-mode-label");
  const answerReviewList = document.getElementById("answer-review-list");

  if (!scoreCircle || !scoreText) {
    return;
  }

  if (state.score === null) {
    scoreCircle.innerHTML = `<div><div class="score-main">--</div><div class="score-sub">No score yet</div></div>`;
    scoreText.innerHTML = "No exam has been completed yet. Start from the opening screen, take the exam, and this page will show the score.";
  } else {
    const activeQuestions = getActiveQuestions(state);
    const correctCount = activeQuestions.filter((question) => state.userAnswers[getQuestionKey(question)] === question.correct).length;
    const incorrectCount = activeQuestions.length - correctCount;
    const unansweredCount = getUnansweredQuestions(state).length;

    if (modeLabel) {
      modeLabel.textContent = state.mode === "sample" ? "Sample Exam Complete" : "Full Exam Complete";
    }
    scoreCircle.innerHTML = `<div><div class="score-main">${state.score}</div><div class="score-sub">/ 100</div></div>`;
    scoreText.innerHTML = `
      You scored <strong>${state.score}</strong> out of 100 points.
      <br><strong>${correctCount}</strong> correct, <strong>${incorrectCount}</strong> incorrect, <strong>${unansweredCount}</strong> unanswered.
      ${state.expired ? '<br><span style="color:#b03f3f">Time expired</span>' : ""}
    `;
  }

  if (answerReviewList) {
    const activeQuestions = getActiveQuestions(state);
    answerReviewList.innerHTML = "";

    if (!activeQuestions.length) {
      answerReviewList.innerHTML = `<p class="muted">No questions are available for review.</p>`;
    }

    activeQuestions.forEach((question, index) => {
      const userAnswer = state.userAnswers[getQuestionKey(question)] || "";
      const isCorrect = userAnswer === question.correct;
      const card = document.createElement("article");
      card.className = `answer-review-card ${isCorrect ? "correct" : "incorrect"}`;
      card.innerHTML = `
        <div class="answer-review-topline">
          <span class="badge ${isCorrect ? "good" : "warn"}">${isCorrect ? "Correct" : userAnswer ? "Incorrect" : "Unanswered"}</span>
          <span class="muted">Question ${index + 1}</span>
        </div>
        <h3>${cleanQuestionText(question.text)}</h3>
        <div class="answer-review-answers">
          <p><strong>Your answer:</strong> ${formatAnswerText(question, userAnswer)}</p>
          <p><strong>Correct answer:</strong> ${formatAnswerText(question, question.correct)}</p>
        </div>
        <div class="answer-reference">
          <strong>Where to verify:</strong> ${buildAnswerReference(question)}
        </div>
        ${question.explanation ? `<div class="answer-explanation"><strong>Explanation:</strong> ${question.explanation}</div>` : ""}
      `;
      answerReviewList.appendChild(card);
    });
  }

  document.getElementById("results-start-link")?.addEventListener("click", (event) => {
    event.preventDefault();
    resetState();
    window.location.href = "./start.html";
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.dataset.page;

  if (page === "start") {
    await initStartPage();
  } else if (page === "exam") {
    await initExamPage();
  } else if (page === "review") {
    await loadQuestionBank();
    initReviewPage();
  } else if (page === "results") {
    await initResultsPage();
  } else if (page === "viewer") {
    await initViewerPage();
  }
});
