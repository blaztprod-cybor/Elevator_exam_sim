import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4175);
const LINKED_BOOKS_PATH = path.join(__dirname, ".linked-books.json");

const allowedRoots = [path.join(__dirname, "reference-pdfs")];
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".pdf": "application/pdf",
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendEmpty(res, status = 204) {
  res.writeHead(status);
  res.end();
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function resolveStaticPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  const cleanPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const absolutePath = path.resolve(__dirname, `.${cleanPath}`);

  if (!absolutePath.startsWith(__dirname + path.sep) && absolutePath !== __dirname) {
    throw new Error("Invalid path");
  }

  return absolutePath;
}

async function serveStatic(req, res) {
  try {
    const filePath = resolveStaticPath(new URL(req.url, `http://${req.headers.host}`).pathname);
    await fs.access(filePath, constants.R_OK);
    const content = await fs.readFile(filePath);
    const contentType = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

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
    return linkedPath;
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

    set targetWidth to screenWidth * 0.25
    set targetHeight to screenHeight * 0.88
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

async function handleOpenBook(req, res) {
  try {
    const body = await readJsonBody(req);
    const inputKey = String(body?.key || "");
    const inputTitle = String(body?.title || inputKey || "");
    const inputPath = String(body?.path || "");
    const linkIfMissing = body?.linkIfMissing === true;

    if (!inputKey && !inputPath) {
      sendJson(res, 400, { error: "Missing book key or path" });
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
    sendEmpty(res);
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Unable to open book" });
  }
}

async function handleLinkedBooks(_req, res) {
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
  sendJson(res, 200, response);
}

async function handleLinkBook(req, res) {
  try {
    const body = await readJsonBody(req);
    const key = String(body?.key || "").trim();
    const title = String(body?.title || key || "reference book").trim();

    if (!key) {
      sendJson(res, 400, { error: "Missing book key" });
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
    sendJson(res, 200, {
      key,
      title,
      fileName: path.basename(selectedPath),
      linkedAt: linkedBooks[key].linkedAt,
    });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Unable to link book" });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/open-book") {
    await handleOpenBook(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/linked-books") {
    await handleLinkedBooks(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/link-book") {
    await handleLinkBook(req, res);
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    await serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Elevator exam app running at http://127.0.0.1:${PORT}/start.html`);
});
