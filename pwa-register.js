(function () {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  let deferredInstallPrompt = null;
  let installButton = null;
  let statusNode = null;

  function isStandaloneApp() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function installTargets() {
    return Array.from(document.querySelectorAll(".pwa-install-trigger, .pwa-install-button")).filter(Boolean);
  }

  function setInstallButtonState(installed) {
    installTargets().forEach((button) => {
      if (!button.classList.contains("pwa-install-button")) {
        button.textContent = installed ? "App Installed" : "App Download Link";
      }
      button.disabled = installed;
    });
  }

  function ensureBanner() {
    if (document.querySelector(".pwa-banner")) {
      return;
    }

    const banner = document.createElement("div");
    banner.className = "pwa-banner";
    banner.innerHTML = `
      <span class="pwa-status" aria-live="polite"></span>
      <button class="btn btn-secondary pwa-install-button" type="button" hidden>Install</button>
    `;
    document.body.appendChild(banner);
    installButton = banner.querySelector(".pwa-install-button");
    statusNode = banner.querySelector(".pwa-status");

    bindInstallButtons();
  }

  function setStatus(message) {
    ensureBanner();
    statusNode.textContent = message;

    const pageStatus = document.getElementById("install-app-status");
    if (pageStatus) {
      pageStatus.textContent = message;
    }
  }

  async function requestInstall() {
    if (isStandaloneApp()) {
      setInstallButtonState(true);
      setStatus("App installed.");
      return;
    }

    if (!deferredInstallPrompt) {
      setStatus("Use your browser menu to install, or on iOS use Safari Share then Add to Home Screen.");
      return;
    }

    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    const installed = choice?.outcome === "accepted";
    setInstallButtonState(installed);
    if (installed && installButton) {
      installButton.hidden = true;
    }
  }

  function bindInstallButtons() {
    installTargets().forEach((button) => {
      if (button.dataset.installBound === "true") {
        return;
      }

      button.dataset.installBound = "true";
      button.addEventListener("click", requestInstall);
    });
  }

  function updateOnlineStatus() {
    if (isStandaloneApp()) {
      setInstallButtonState(true);
      setStatus("App installed.");
      return;
    }

    setInstallButtonState(false);
    if (navigator.onLine) {
      setStatus("Ready for offline practice after first load.");
    } else {
      setStatus("Offline mode");
    }
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    ensureBanner();
    bindInstallButtons();
    installTargets().forEach((button) => {
      button.hidden = false;
      button.disabled = false;
    });
    setInstallButtonState(isStandaloneApp());
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    setInstallButtonState(true);
    setStatus("App installed.");
    if (installButton) {
      installButton.hidden = true;
    }
  });

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  window.addEventListener("load", async () => {
    try {
      bindInstallButtons();
      await navigator.serviceWorker.register("./sw.js");
      updateOnlineStatus();
    } catch {
      setStatus("Offline install is unavailable in this browser.");
    }
  });
})();
