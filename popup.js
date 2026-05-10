const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const STRINGS = {
  en: {
    sub: "Auto-fill any form, framework-aware",
    fill: "Fill Form",
    clear: "Clear",
    filled: (n) => `Filled ${n} field${n === 1 ? "" : "s"}.`,
    cleared: (n) => `Cleared ${n} field${n === 1 ? "" : "s"}.`,
    none: "No fillable fields detected.",
    error: "Cannot run on this page.",
    stopped: "Stopped by user."
  },
  id: {
    sub: "Isi form otomatis, paham framework JS",
    fill: "Isi Form",
    clear: "Bersihkan",
    filled: (n) => `Berhasil isi ${n} kolom.`,
    cleared: (n) => `Bersihkan ${n} kolom.`,
    none: "Tidak ada kolom yang bisa diisi.",
    error: "Tidak bisa jalan di halaman ini.",
    stopped: "Proses dihentikan."
  }
};

let currentLanguage = "en";

const applyLanguageUI = () => {
  const s = STRINGS[currentLanguage];
  $("#sub").textContent = s.sub;
  $("#fill").textContent = s.fill;
  $("#clear").textContent = s.clear;
  $$(".seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.language === currentLanguage));
};

const showStatus = (msg, isError = false) => {
  const el = $("#status");
  el.textContent = msg;
  el.hidden = false;
  el.classList.toggle("error", isError);
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => { el.hidden = true; }, 3500);
};

const sendToTab = async (action) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  if (!/^https?:|^file:/.test(tab.url || "")) {
    showStatus(STRINGS[currentLanguage].error, true);
    return null;
  }
  try {
    return await chrome.tabs.sendMessage(tab.id, { action, language: currentLanguage });
  } catch {
    // inject then retry
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["data/checksums.js", "data/en.js", "data/id.js", "content.js"]
      });
      return await chrome.tabs.sendMessage(tab.id, { action, language: currentLanguage });
    } catch (e) {
      showStatus(STRINGS[currentLanguage].error, true);
      return null;
    }
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.local.get("language");
  if (stored.language) currentLanguage = stored.language;
  applyLanguageUI();

  $$(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      currentLanguage = btn.dataset.language;
      await chrome.storage.local.set({ language: currentLanguage });
      applyLanguageUI();
    });
  });

  $("#fill").addEventListener("click", async () => {
    const s = STRINGS[currentLanguage];
    $("#fill").hidden = true;
    $("#stop").hidden = false;
    showStatus(s.sub); // optional status message

    const r = await sendToTab("fill");
    
    $("#fill").hidden = false;
    $("#stop").hidden = true;

    if (!r) return;
    showStatus(r.filled > 0 ? s.filled(r.filled) : s.none, r.filled === 0);
  });

  $("#stop").addEventListener("click", async () => {
    await sendToTab("stop");
    showStatus(STRINGS[currentLanguage].stopped, true);
    $("#fill").hidden = false;
    $("#stop").hidden = true;
  });

  $("#clear").addEventListener("click", async () => {
    const r = await sendToTab("clear");
    if (!r) return;
    showStatus(STRINGS[currentLanguage].cleared(r.cleared || 0));
  });
});
