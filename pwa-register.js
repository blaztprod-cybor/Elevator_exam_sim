(function () {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  let deferredInstallPrompt = null;

  function isStandaloneApp() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function installTargets() {
    return Array.from(document.querySelectorAll(".pwa-install-trigger, .pwa-install-button, .pwa-install-status-link")).filter(Boolean);
  }

  function setInstallButtonState(installed) {
    installTargets().forEach((button) => {
      if (button.classList.contains("pwa-install-status-link")) {
        button.textContent = installed ? "App Installed" : "App Download Link";
        return;
      }

      if (!button.classList.contains("pwa-install-button")) {
        button.textContent = installed ? "App Installed" : button.dataset.installLabel || button.textContent;
      }
      button.disabled = installed;
    });
  }

  function ensureBanner() {
    bindInstallButtons();
  }

  function setStatus(message) {
    ensureBanner();
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
  }

  function bindInstallButtons() {
    installTargets().forEach((button) => {
      if (button.dataset.installBound === "true") {
        return;
      }

      button.dataset.installBound = "true";
      button.dataset.installLabel = button.textContent;
      if (button.classList.contains("pwa-install-status-link")) {
        return;
      }

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
