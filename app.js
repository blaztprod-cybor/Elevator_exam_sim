import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/build/pdf.min.mjs";
import { questionBank } from "./questions.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs";

const screens = {
  welcome: document.querySelector("#welcome-screen"),
  exam: document.querySelector("#exam-screen"),
  review: document.querySelector("#review-screen"),
  results: document.querySelector("#results-screen")
};

const elements = {
  landingScreen: document.querySelector("#landing-screen"),
  examShell: document.querySelector("#exam-shell"),
  enterExam: document.querySelector("#enter-exam"),
  timer: document.querySelector("#timer"),
  pauseExam: document.querySelector("#pause-exam"),
  pauseOverlay: document.querySelector("#pause-overlay"),
  resumeExam: document.querySelector("#resume-exam"),
  referenceLinks: document.querySelectorAll(".reference-link"),
  pdfModal: document.querySelector("#pdf-modal"),
  pdfModalTitle: document.querySelector("#pdf-modal-title"),
  pdfModalMeta: document.querySelector("#pdf-modal-meta"),
  pdfThumbnails: document.querySelector("#pdf-thumbnails"),
  pdfViewport: document.querySelector("#pdf-viewport"),
  pdfDocument: document.querySelector("#pdf-document"),
  pdfLoading: document.querySelector("#pdf-loading"),
  pdfSearchInput: document.querySelector("#pdf-search-input"),
  pdfSearchButton: document.querySelector("#pdf-search-button"),
  pdfSearchStatus: document.querySelector("#pdf-search-status"),
  pdfZoomIn: document.querySelector("#pdf-zoom-in"),
  pdfZoomOut: document.querySelector("#pdf-zoom-out"),
  pdfZoomLevel: document.querySelector("#pdf-zoom-level"),
  pdfPrevPage: document.querySelector("#pdf-prev-page"),
  pdfNextPage: document.querySelector("#pdf-next-page"),
  pdfPageIndicator: document.querySelector("#pdf-page-indicator"),
  closePdfModal: document.querySelector("#close-pdf-modal"),
  questionPrompt: document.querySelector("#question-prompt"),
  answerOptions: document.querySelector("#answer-options"),
  reviewSummary: document.querySelector("#review-summary"),
  reviewList: document.querySelector("#review-list"),
  categoryBreakdown: document.querySelector("#category-breakdown"),
  resultsList: document.querySelector("#results-list"),
  scoreHeading: document.querySelector("#score-heading"),
  scoreSummary: document.querySelector("#score-summary"),
  scorePercent: document.querySelector("#score-percent"),
  scoreCorrect: document.querySelector("#score-correct"),
  scoreFlagged: document.querySelector("#score-flagged"),
  scoreTime: document.querySelector("#score-time"),
  prevQuestion: document.querySelector("#prev-question"),
  nextQuestion: document.querySelector("#next-question"),
  flagQuestion: document.querySelector("#flag-question"),
  markReview: document.querySelector("#mark-review"),
  submitExam: document.querySelector("#submit-exam")
};

const EXAM_CONFIG = {
  count: 25,
  durationMinutes: 180,
  shuffleQuestions: true,
  showExplanations: true
};

const state = {
  questions: [],
  currentIndex: 0,
  startedAt: null,
  durationSeconds: 0,
  remainingSeconds: 0,
  timerId: null,
  paused: false,
  completed: false,
  showExplanations: true,
  pdfZoom: 1,
  pdfDoc: null,
  pdfCurrentPage: 1,
  pdfPageCount: 0,
  pdfMatches: [],
  pdfScrollSyncLocked: false
};

function shuffleArray(items) {
  const clone = [...items];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }

  return clone;
}

function showScreen(key) {
  Object.entries(screens).forEach(([name, screen]) => {
    screen.classList.toggle("active", name === key);
  });
}

function formatClock(totalSeconds) {
  const seconds = Math.max(0, totalSeconds);
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const leftover = String(seconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${leftover}`;
}

function formatUsedTime() {
  const used = state.durationSeconds - state.remainingSeconds;
  return formatClock(used);
}

function buildExamSet({ count, durationMinutes }) {
  const base = EXAM_CONFIG.shuffleQuestions ? shuffleArray(questionBank) : [...questionBank];
  const selected = base.slice(0, Math.min(count, questionBank.length)).map((question) => {
    const choiceObjects = question.choices.map((choice, index) => ({
      text: choice,
      originalIndex: index
    }));
    const choices = EXAM_CONFIG.shuffleQuestions ? shuffleArray(choiceObjects) : choiceObjects;
    const answer = choices.findIndex((choice) => choice.originalIndex === question.answer);

    return {
      ...question,
      choices: choices.map((choice) => choice.text),
      answer,
      userAnswer: null,
      flagged: false,
      seen: false
    };
  });

  state.questions = selected;
  state.currentIndex = 0;
  state.durationSeconds = durationMinutes * 60;
  state.remainingSeconds = durationMinutes * 60;
  state.startedAt = Date.now();
  state.completed = false;
  state.paused = false;
  state.showExplanations = EXAM_CONFIG.showExplanations;
}

function startTimer() {
  stopTimer();
  state.timerId = window.setInterval(() => {
    if (state.paused || state.completed) return;

    state.remainingSeconds -= 1;
    elements.timer.textContent = formatClock(state.remainingSeconds);

    if (state.remainingSeconds <= 0) {
      state.remainingSeconds = 0;
      stopTimer();
      renderReviewScreen();
      showScreen("review");
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function renderQuestion() {
  const question = state.questions[state.currentIndex];
  question.seen = true;

  elements.timer.textContent = formatClock(state.remainingSeconds);
  elements.questionPrompt.textContent = question.prompt;
  elements.flagQuestion.textContent = question.flagged ? "Unflag Question" : "Flag For Review";
  elements.answerOptions.innerHTML = "";

  question.choices.forEach((choice, choiceIndex) => {
    const button = document.createElement("button");
    button.className = "answer-card";
    button.innerHTML = `
      <span class="answer-letter">${String.fromCharCode(65 + choiceIndex)}</span>
      <span>${choice}</span>
    `;

    if (question.userAnswer === choiceIndex) button.classList.add("selected");

    button.addEventListener("click", () => {
      question.userAnswer = choiceIndex;
      renderQuestion();
    });

    elements.answerOptions.appendChild(button);
  });

  elements.prevQuestion.disabled = state.currentIndex === 0;
  elements.nextQuestion.textContent = state.currentIndex === state.questions.length - 1 ? "Review Exam" : "Next";
}

function reviewCounts() {
  const answered = state.questions.filter((question) => question.userAnswer !== null).length;
  const flagged = state.questions.filter((question) => question.flagged).length;
  const unanswered = state.questions.length - answered;
  return { answered, flagged, unanswered };
}

function renderReviewScreen() {
  const counts = reviewCounts();
  elements.reviewSummary.innerHTML = `
    <div class="review-item">
      <div>
        <h3>Exam Snapshot</h3>
        <p class="muted">Check unanswered or flagged items before submitting.</p>
      </div>
      <div class="review-badges">
        <span class="badge">${counts.answered} answered</span>
        <span class="badge ${counts.unanswered ? "warn" : "good"}">${counts.unanswered} unanswered</span>
        <span class="badge ${counts.flagged ? "warn" : "good"}">${counts.flagged} flagged</span>
      </div>
    </div>
  `;
  elements.reviewList.innerHTML = "";

  state.questions.forEach((question, index) => {
    const row = document.createElement("div");
    row.className = "review-item";
    const badges = [
      question.userAnswer !== null ? '<span class="badge good">Answered</span>' : '<span class="badge warn">Unanswered</span>'
    ];

    if (question.flagged) badges.push('<span class="badge warn">Flagged</span>');

    row.innerHTML = `
      <div>
        <strong>Question ${index + 1}</strong>
        <p class="muted">${question.prompt}</p>
      </div>
      <div class="review-badges">${badges.join("")}</div>
    `;
    row.addEventListener("click", () => {
      state.currentIndex = index;
      renderQuestion();
      showScreen("exam");
    });
    elements.reviewList.appendChild(row);
  });
}

function buildCategoryBreakdown() {
  const categories = new Map();

  state.questions.forEach((question) => {
    if (!categories.has(question.category)) categories.set(question.category, { total: 0, correct: 0 });

    const bucket = categories.get(question.category);
    bucket.total += 1;
    if (question.userAnswer === question.answer) bucket.correct += 1;
  });

  elements.categoryBreakdown.innerHTML = "";
  [...categories.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([category, bucket]) => {
      const percent = Math.round((bucket.correct / bucket.total) * 100);
      const card = document.createElement("div");
      card.className = "category-card";
      card.innerHTML = `
        <h4>${category}</h4>
        <p class="muted">${bucket.correct} of ${bucket.total} correct</p>
        <strong>${percent}%</strong>
      `;
      elements.categoryBreakdown.appendChild(card);
    });
}

function renderResults() {
  state.completed = true;
  stopTimer();

  const correct = state.questions.filter((question) => question.userAnswer === question.answer).length;
  const percent = Math.round((correct / state.questions.length) * 100);
  const flagged = state.questions.filter((question) => question.flagged).length;
  const unanswered = state.questions.filter((question) => question.userAnswer === null).length;

  elements.scoreHeading.textContent = percent >= 70 ? "Practice exam completed" : "Practice exam needs review";
  elements.scoreSummary.textContent =
    unanswered > 0
      ? `You left ${unanswered} question${unanswered === 1 ? "" : "s"} unanswered. Review those weak spots and try another run.`
      : "You completed every question. Review category performance to target your next study block.";
  elements.scorePercent.textContent = `${percent}%`;
  elements.scoreCorrect.textContent = `${correct} / ${state.questions.length}`;
  elements.scoreFlagged.textContent = String(flagged);
  elements.scoreTime.textContent = formatUsedTime();

  buildCategoryBreakdown();
  elements.resultsList.innerHTML = "";

  state.questions.forEach((question, index) => {
    const isCorrect = question.userAnswer === question.answer;
    const userLabel =
      question.userAnswer === null
        ? "No answer"
        : `${String.fromCharCode(65 + question.userAnswer)}. ${question.choices[question.userAnswer]}`;
    const correctLabel = `${String.fromCharCode(65 + question.answer)}. ${question.choices[question.answer]}`;
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-meta">
        <span class="badge">${question.category}</span>
        <span class="badge ${isCorrect ? "good" : "warn"}">${isCorrect ? "Correct" : "Needs review"}</span>
      </div>
      <h4>Question ${index + 1}</h4>
      <p>${question.prompt}</p>
      <p><strong>Your answer:</strong> ${userLabel}</p>
      <p><strong>Correct answer:</strong> ${correctLabel}</p>
      ${state.showExplanations ? `<div class="explanation"><strong>Why:</strong> ${question.explanation}</div>` : ""}
    `;
    elements.resultsList.appendChild(card);
  });

  showScreen("results");
}

function resetExam() {
  stopTimer();
  state.questions = [];
  state.currentIndex = 0;
  state.startedAt = null;
  state.durationSeconds = 0;
  state.remainingSeconds = 0;
  state.paused = false;
  state.completed = false;
  elements.timer.textContent = "03:00:00";
  elements.pauseExam.textContent = "Pause Exam";
  elements.pauseOverlay.classList.remove("active");
  elements.pauseOverlay.setAttribute("aria-hidden", "true");
  elements.reviewSummary.innerHTML = "";
  elements.reviewList.innerHTML = "";
  elements.categoryBreakdown.innerHTML = "";
  elements.resultsList.innerHTML = "";
  showScreen("exam");
}

function enterExamWorkspace() {
  elements.landingScreen.classList.remove("active");
  elements.examShell.classList.remove("hidden");
  startExam({
    count: EXAM_CONFIG.count,
    durationMinutes: EXAM_CONFIG.durationMinutes
  });
}

window.startExamApp = enterExamWorkspace;

function startExam({ count, durationMinutes }) {
  buildExamSet({ count, durationMinutes });
  renderQuestion();
  startTimer();
  showScreen("exam");
}

function setPdfLoading(isLoading, message = "Loading reference...") {
  elements.pdfLoading.textContent = message;
  elements.pdfLoading.classList.toggle("active", isLoading);
}

function updatePdfControls() {
  elements.pdfZoomLevel.textContent = `${Math.round(state.pdfZoom * 100)}%`;
  elements.pdfPageIndicator.textContent = state.pdfPageCount ? `Page ${state.pdfCurrentPage} / ${state.pdfPageCount}` : "Page 0 / 0";
  elements.pdfPrevPage.disabled = !state.pdfDoc || state.pdfCurrentPage <= 1;
  elements.pdfNextPage.disabled = !state.pdfDoc || state.pdfCurrentPage >= state.pdfPageCount;
  elements.pdfZoomOut.disabled = !state.pdfDoc || state.pdfZoom <= 0.75;
  elements.pdfZoomIn.disabled = !state.pdfDoc || state.pdfZoom >= 2;
  elements.pdfSearchButton.disabled = false;
  elements.pdfSearchInput.disabled = false;
}

function setActivePdfPage(pageNumber) {
  state.pdfCurrentPage = pageNumber;
  elements.pdfDocument.querySelectorAll(".pdf-page-sheet").forEach((page) => {
    page.classList.toggle("active", Number(page.dataset.pageNumber) === pageNumber);
  });
  elements.pdfThumbnails.querySelectorAll(".pdf-thumbnail").forEach((thumb) => {
    const isActive = Number(thumb.dataset.pageNumber) === pageNumber;
    thumb.classList.toggle("active", isActive);
    if (isActive) thumb.scrollIntoView({ block: "nearest" });
  });
  updatePdfControls();
}

function scrollPdfPageIntoView(pageNumber, behavior = "smooth") {
  const targetPage = elements.pdfDocument.querySelector(`[data-page-number="${pageNumber}"]`);
  if (!targetPage) return;

  state.pdfScrollSyncLocked = true;
  targetPage.scrollIntoView({ block: "start", behavior });
  setActivePdfPage(pageNumber);
  window.setTimeout(() => {
    state.pdfScrollSyncLocked = false;
  }, behavior === "smooth" ? 350 : 0);
}

function syncPdfPageFromScroll() {
  if (!state.pdfDoc || state.pdfScrollSyncLocked) return;

  const viewportTop = elements.pdfViewport.scrollTop;
  const pages = [...elements.pdfDocument.querySelectorAll(".pdf-page-sheet")];
  if (!pages.length) return;

  let closestPage = pages[0];
  let closestDistance = Math.abs(pages[0].offsetTop - viewportTop);

  pages.slice(1).forEach((page) => {
    const distance = Math.abs(page.offsetTop - viewportTop);
    if (distance < closestDistance) {
      closestPage = page;
      closestDistance = distance;
    }
  });

  const nextPage = Number(closestPage.dataset.pageNumber);
  if (nextPage !== state.pdfCurrentPage) setActivePdfPage(nextPage);
}

async function renderPdfDocument() {
  if (!state.pdfDoc) return;

  try {
    setPdfLoading(true, `Loading ${state.pdfPageCount} pages...`);
    elements.pdfDocument.innerHTML = "";
    elements.pdfThumbnails.innerHTML = "";

    for (let pageNumber = 1; pageNumber <= state.pdfPageCount; pageNumber += 1) {
      const page = await state.pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: state.pdfZoom });
      const thumbViewport = page.getViewport({ scale: 0.22 });
      const pageShell = document.createElement("div");
      const thumbButton = document.createElement("button");
      const thumbCanvas = document.createElement("canvas");
      const thumbContext = thumbCanvas.getContext("2d");
      const thumbLabel = document.createElement("span");
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      pageShell.className = "pdf-page-sheet";
      pageShell.dataset.pageNumber = String(pageNumber);
      thumbButton.className = "pdf-thumbnail";
      thumbButton.type = "button";
      thumbButton.dataset.pageNumber = String(pageNumber);
      thumbLabel.className = "pdf-thumbnail-label";
      thumbLabel.textContent = `Page ${pageNumber}`;
      thumbCanvas.width = Math.ceil(thumbViewport.width);
      thumbCanvas.height = Math.ceil(thumbViewport.height);
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      thumbButton.appendChild(thumbCanvas);
      thumbButton.appendChild(thumbLabel);
      pageShell.appendChild(canvas);
      elements.pdfThumbnails.appendChild(thumbButton);
      elements.pdfDocument.appendChild(pageShell);
      thumbButton.addEventListener("click", () => scrollPdfPageIntoView(pageNumber));
      await page.render({ canvasContext: thumbContext, viewport: thumbViewport }).promise;
      await page.render({ canvasContext: context, viewport }).promise;
    }

    elements.pdfViewport.scrollTop = 0;
    setActivePdfPage(Math.min(state.pdfCurrentPage, state.pdfPageCount) || 1);
  } catch (error) {
    elements.pdfSearchStatus.textContent = "The reference could not be rendered.";
  } finally {
    setPdfLoading(false);
  }
}

async function loadPdfDocument(path) {
  try {
    setPdfLoading(true);
    const loadingTask = pdfjsLib.getDocument(path);
    state.pdfDoc = await loadingTask.promise;
    state.pdfCurrentPage = 1;
    state.pdfPageCount = state.pdfDoc.numPages;
    state.pdfMatches = [];
    elements.pdfModalMeta.textContent = `${state.pdfPageCount} pages`;
    updatePdfControls();
    await renderPdfDocument();
    elements.pdfSearchStatus.textContent = "";
  } catch (error) {
    state.pdfDoc = null;
    state.pdfPageCount = 0;
    elements.pdfModalMeta.textContent = "Unable to load reference";
    elements.pdfSearchStatus.textContent =
      "This reference could not be loaded in the embedded viewer. Add the PDF locally or try a source that allows browser rendering.";
    setPdfLoading(false);
    updatePdfControls();
  }
}

function openPdfModal(path, title) {
  elements.pdfModalTitle.textContent = title;
  elements.pdfModalMeta.textContent = "Loading pages...";
  elements.pdfSearchInput.value = "";
  elements.pdfSearchStatus.textContent = "";
  state.pdfZoom = 1;
  state.pdfCurrentPage = 1;
  state.pdfPageCount = 0;
  state.pdfMatches = [];
  elements.pdfModal.classList.add("active");
  elements.pdfModal.setAttribute("aria-hidden", "false");
  updatePdfControls();
  loadPdfDocument(path);
}

function closePdfModal() {
  elements.pdfModal.classList.remove("active");
  elements.pdfModal.setAttribute("aria-hidden", "true");
  elements.pdfSearchInput.value = "";
  elements.pdfSearchStatus.textContent = "";
  elements.pdfModalMeta.textContent = "0 pages";
  state.pdfZoom = 1;
  state.pdfDoc = null;
  state.pdfCurrentPage = 1;
  state.pdfPageCount = 0;
  state.pdfMatches = [];
  elements.pdfThumbnails.innerHTML = "";
  elements.pdfDocument.innerHTML = "";
  setPdfLoading(false);
  updatePdfControls();
}

async function runPdfSearch() {
  const keyword = elements.pdfSearchInput.value.trim();
  if (!keyword) {
    elements.pdfSearchStatus.textContent = "Enter a keyword to search this reference.";
    return;
  }
  if (!state.pdfDoc) {
    elements.pdfSearchStatus.textContent = "Open a reference first.";
    return;
  }

  setPdfLoading(true, `Searching for "${keyword}"...`);

  try {
    const normalizedKeyword = keyword.toLowerCase();
    const matches = [];

    for (let pageNumber = 1; pageNumber <= state.pdfDoc.numPages; pageNumber += 1) {
      const page = await state.pdfDoc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ").toLowerCase();
      if (pageText.includes(normalizedKeyword)) matches.push(pageNumber);
    }

    if (!matches.length) {
      elements.pdfSearchStatus.textContent = `No matches found for "${keyword}".`;
      return;
    }

    state.pdfMatches = matches;
    scrollPdfPageIntoView(matches[0]);
    elements.pdfSearchStatus.textContent = `Found ${matches.length} page match${matches.length === 1 ? "" : "es"} for "${keyword}". Jumped to page ${matches[0]}.`;
  } catch (error) {
    elements.pdfSearchStatus.textContent = "This reference could not be searched. Some scanned or protected PDFs may not expose searchable text.";
  } finally {
    setPdfLoading(false);
  }
}

function updatePauseUi() {
  elements.pauseExam.textContent = state.paused ? "Resume Exam" : "Pause Exam";
  elements.pauseOverlay.classList.toggle("active", state.paused);
  elements.pauseOverlay.setAttribute("aria-hidden", state.paused ? "false" : "true");
}

function togglePauseExam(forceValue) {
  state.paused = typeof forceValue === "boolean" ? forceValue : !state.paused;
  updatePauseUi();
}

function adjustPdfZoom(direction) {
  const nextZoom = Math.max(0.75, Math.min(2, state.pdfZoom + direction * 0.1));
  state.pdfZoom = Number(nextZoom.toFixed(2));
  renderPdfDocument();
}

function changePdfPage(direction) {
  if (!state.pdfDoc) return;
  const nextPage = Math.max(1, Math.min(state.pdfPageCount, state.pdfCurrentPage + direction));
  scrollPdfPageIntoView(nextPage);
}

elements.prevQuestion.addEventListener("click", () => {
  if (state.currentIndex > 0) {
    state.currentIndex -= 1;
    renderQuestion();
  }
});

elements.nextQuestion.addEventListener("click", () => {
  if (state.currentIndex === state.questions.length - 1) {
    renderReviewScreen();
    showScreen("review");
    return;
  }
  state.currentIndex += 1;
  renderQuestion();
});

elements.flagQuestion.addEventListener("click", () => {
  const question = state.questions[state.currentIndex];
  question.flagged = !question.flagged;
  renderQuestion();
});

elements.markReview.addEventListener("click", () => {
  const question = state.questions[state.currentIndex];
  question.flagged = true;
  if (state.currentIndex === state.questions.length - 1) {
    renderReviewScreen();
    showScreen("review");
    return;
  }
  state.currentIndex += 1;
  renderQuestion();
});

elements.submitExam.addEventListener("click", renderResults);
elements.enterExam.addEventListener("click", enterExamWorkspace);
elements.pauseExam.addEventListener("click", () => togglePauseExam());
elements.resumeExam.addEventListener("click", () => togglePauseExam(false));
elements.referenceLinks.forEach((link) => {
  link.addEventListener("click", () => {
    openPdfModal(link.dataset.pdf, link.dataset.title);
  });
});
elements.closePdfModal.addEventListener("click", closePdfModal);
elements.pdfSearchButton.addEventListener("click", runPdfSearch);
elements.pdfZoomIn.addEventListener("click", () => adjustPdfZoom(1));
elements.pdfZoomOut.addEventListener("click", () => adjustPdfZoom(-1));
elements.pdfPrevPage.addEventListener("click", () => changePdfPage(-1));
elements.pdfNextPage.addEventListener("click", () => changePdfPage(1));
elements.pdfSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runPdfSearch();
});
elements.pdfModal.addEventListener("click", (event) => {
  if (event.target === elements.pdfModal) closePdfModal();
});
elements.pdfViewport.addEventListener("scroll", syncPdfPageFromScroll);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.pdfModal.classList.contains("active")) closePdfModal();
});

resetExam();
updatePdfControls();
elements.examShell.classList.add("hidden");
