const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const fmtDur = (ms) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;

const STRINGS = {
  en: {
    sub: "Auto-fill any form, framework-aware",
    fill: "Fill Form",
    clear: "Clear",
    filled: (n, ms) => `Filled ${n} field${n === 1 ? "" : "s"} in ${fmtDur(ms)}.`,
    cleared: (n) => `Cleared ${n} field${n === 1 ? "" : "s"}.`,
    none: "No fillable fields detected.",
    error: "Cannot run on this page.",
    stopped: (ms) => `Stopped by user after ${fmtDur(ms)}.`,
    scFill: "Fill",
    scClear: "Clear",
    scStop: "Stop"
  },
  id: {
    sub: "Isi form otomatis, paham framework JS",
    fill: "Isi Form",
    clear: "Bersihkan",
    filled: (n, ms) => `Berhasil isi ${n} kolom (${fmtDur(ms)}).`,
    cleared: (n) => `Bersihkan ${n} kolom.`,
    none: "Tidak ada kolom yang bisa diisi.",
    error: "Tidak bisa jalan di halaman ini.",
    stopped: (ms) => `Proses dihentikan (${fmtDur(ms)}).`,
    scFill: "Isi",
    scClear: "Bersih",
    scStop: "Stop"
  }
};

let currentLanguage = "en";

const applyLanguageUI = () => {
  const s = STRINGS[currentLanguage];
  $("#sub").textContent = s.sub;
  $("#fill").textContent = s.fill;
  $("#clear").textContent = s.clear;
  if ($("#lbl-sc-fill")) $("#lbl-sc-fill").textContent = s.scFill;
  if ($("#lbl-sc-clear")) $("#lbl-sc-clear").textContent = s.scClear;
  if ($("#lbl-sc-stop")) $("#lbl-sc-stop").textContent = s.scStop;
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

  const { customData } = await chrome.storage.local.get("customData");

  try {
    return await chrome.tabs.sendMessage(tab.id, {
      action,
      language: currentLanguage,
      customData: customData || {}
    });
  } catch {
    // inject then retry
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["data/checksums.js", "data/en.js", "data/id.js", "content.js"]
      });
      return await chrome.tabs.sendMessage(tab.id, {
        action,
        language: currentLanguage,
        customData: customData || {}
      });
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

    const r = await sendToTab("fill");
    
    $("#fill").hidden = false;
    $("#stop").hidden = true;

    if (!r) return;
    showStatus(r.filled > 0 ? s.filled(r.filled, r.duration) : s.none, r.filled === 0);
  });

  $("#stop").addEventListener("click", async () => {
    const r = await sendToTab("stop");
    const duration = r ? r.duration : "0";
    showStatus(STRINGS[currentLanguage].stopped(duration), true);
    $("#fill").hidden = false;
    $("#stop").hidden = true;
  });

  $("#clear").addEventListener("click", async () => {
    const r = await sendToTab("clear");
    if (!r) return;
    showStatus(STRINGS[currentLanguage].cleared(r.cleared || 0));
  });

  // --- Settings (Row-based) ---
  const renderRow = (key = "", val = "") => {
    const row = document.createElement("div");
    row.className = "override-row";
    row.innerHTML = `
      <input type="text" class="ov-key" placeholder="Label/Key" value="${key}">
      <input type="text" class="ov-val" placeholder="Value" value="${val}">
      <button class="ov-del" title="Remove">✕</button>
    `;
    row.querySelector(".ov-del").addEventListener("click", () => {
      row.remove();
      if ($$(".override-row").length === 0) renderRow();
    });
    $("#overrides-list").appendChild(row);
  };

  $("#toggle-settings").addEventListener("click", () => {
    const panel = $("#settings-panel");
    panel.hidden = !panel.hidden;
  });

  $("#add-override").addEventListener("click", () => renderRow());

  const { customData } = await chrome.storage.local.get("customData");
  if (customData && Object.keys(customData).length > 0) {
    Object.entries(customData).forEach(([k, v]) => renderRow(k, v));
  } else {
    renderRow(); // Initial empty row
  }

  $("#save-settings").addEventListener("click", async () => {
    const rows = $$(".override-row");
    const newData = {};
    rows.forEach(row => {
      const k = row.querySelector(".ov-key").value.trim();
      const v = row.querySelector(".ov-val").value.trim();
      if (k) newData[k] = v;
    });

    await chrome.storage.local.set({ customData: newData });
    showStatus(currentLanguage === "id" ? "Pengaturan disimpan!" : "Settings saved!");
  });
});
