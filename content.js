// Smart Filler — content script v2
// Multi-pass async fill engine with adapters for popular UI libraries.
// Targets ~95-97% real-world coverage. Hard limits: closed shadow DOM,
// cross-origin iframes without host permission, canvas-rendered inputs.
(function () {
  // Clean up previous instance if any (for re-injection support)
  if (window.__smartFillerCleanup) {
    try { window.__smartFillerCleanup(); } catch (e) { }
  }
  window.__smartFillerLoaded = true;
  window.__smartFillerStopRequested = false;

  const LANGUAGES = {
    en: window.SmartFillerLanguageEN,
    id: window.SmartFillerLanguageID
  };

  // Helper to detect page language
  const detectPageLanguage = () => {
    const htmlLang = document.documentElement.lang?.toLowerCase() || "";
    if (htmlLang.startsWith("id")) return "id";
    if (htmlLang.startsWith("en")) return "en";

    // Heuristic: check for common Indonesian words in the first 1000 chars
    const bodyText = document.body.innerText.slice(0, 1000).toLowerCase();
    const idKeywords = ["adalah", "dengan", "untuk", "yang", "pada", "dalam"];
    const idScore = idKeywords.reduce((acc, word) => acc + (bodyText.includes(word) ? 1 : 0), 0);
    return idScore >= 2 ? "id" : "en";
  };

  // =====================================================================
  // UTILITIES
  // =====================================================================
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const createDummyFile = (name = "dummy.pdf", type = "application/pdf") => {
    const content = type.includes("image") ?
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" :
      "Dummy Document Content for Smart Filler";
    const blob = new Blob([content], { type });
    return new File([blob], name, { type });
  };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // Native value setter — bypasses React/Vue/Angular synthetic event interception.
  const setNativeValue = (el, value) => {
    const proto =
      el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype :
        el.tagName === "SELECT" ? HTMLSelectElement.prototype :
          HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value");
    if (setter && setter.set) setter.set.call(el, value);
    else el.value = value;
  };

  const setNativeChecked = (el, checked) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked");
    if (setter && setter.set) setter.set.call(el, checked);
    else el.checked = checked;
  };

  const fire = (el, types) => {
    for (const t of types) {
      el.dispatchEvent(new Event(t, { bubbles: true, cancelable: true, composed: true }));
    }
  };

  const fireInput = (el, value) => {
    el.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType: "insertText",
      data: value
    }));
  };

  // Pointer + mouse + click chain — what most click-handlers expect.
  const simulateClick = (el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const opts = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, view: window };
    try { el.dispatchEvent(new PointerEvent("pointerover", opts)); } catch { }
    try { el.dispatchEvent(new PointerEvent("pointerenter", opts)); } catch { }
    try { el.dispatchEvent(new MouseEvent("mouseover", opts)); } catch { }
    try { el.dispatchEvent(new PointerEvent("pointerdown", opts)); } catch { }
    try { el.dispatchEvent(new MouseEvent("mousedown", opts)); } catch { }
    try { el.focus(); } catch { }
    try { el.dispatchEvent(new PointerEvent("pointerup", opts)); } catch { }
    try { el.dispatchEvent(new MouseEvent("mouseup", opts)); } catch { }
    try { el.dispatchEvent(new MouseEvent("click", opts)); } catch { }
    try { if (typeof el.click === "function") el.click(); } catch { }
  };

  const sendKey = (el, key) => {
    const opts = { key, code: key, bubbles: true, cancelable: true, composed: true };
    el.dispatchEvent(new KeyboardEvent("keydown", opts));
    el.dispatchEvent(new KeyboardEvent("keypress", opts));
    el.dispatchEvent(new KeyboardEvent("keyup", opts));
  };

  const waitForDomStable = (quietMs = 200, maxMs = 1500) => {
    return new Promise((resolve) => {
      let timeout = setTimeout(resolve, quietMs);
      const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(resolve, quietMs);
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      setTimeout(() => { observer.disconnect(); resolve(); }, maxMs);
    });
  };

  const highlight = (el) => {
    if (!el || !el.style) return;
    const originalTransition = el.style.transition;
    const originalBg = el.style.backgroundColor;
    el.style.transition = "background-color 0.3s ease";
    el.style.backgroundColor = "rgba(76, 175, 80, 0.3)"; // Green highlight
    setTimeout(() => {
      el.style.backgroundColor = originalBg;
      setTimeout(() => { el.style.transition = originalTransition; }, 300);
    }, 800);
  };

  let lastRightClickedElement = null;
  document.addEventListener("contextmenu", (e) => {
    lastRightClickedElement = e.target;
  }, true);


  const textOf = (node) => (node?.textContent || "").trim().replace(/\s+/g, " ");

  // =====================================================================
  // HONEYPOT / VISIBILITY GATE
  // =====================================================================
  const isHoneypot = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const sig = `${el.name || ""} ${el.id || ""} ${el.className || ""}`.toLowerCase();
    if (/honeypot|honey-pot|botcheck|bot-check|spamtrap|spam-trap|hp-field|trap-field|donotfill|do-not-fill/.test(sig)) return true;

    // Detect if this is a known UI component (PrimeVue, MUI, etc.)
    const isUIComponent = !!(el.closest?.("[class*='p-'], [class*='Mui'], [class*='ant-'], .chakra-input") ||
      el.getAttribute?.("role") === "combobox");

    if (el.getAttribute("aria-hidden") === "true" && !isUIComponent) return true;

    if (el.tabIndex === -1 && el.getAttribute("autocomplete") === "off" && !el.placeholder) {
      // weak signal
    }

    let node = el;
    let depth = 0;
    while (node && depth < 6) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const cs = getComputedStyle(node);
        if (cs.display === "none") {
          return true;
        }
        if (cs.visibility === "hidden" || cs.visibility === "collapse") {
          return true;
        }
        if (parseFloat(cs.opacity) < 0.05 && !isUIComponent) {
          return true;
        }
      }
      node = node.parentElement;
      depth++;
    }

    const r = el.getBoundingClientRect();
    if (isUIComponent || el.type === "file") {
      return false; // Trust these elements even if they are 0x0 or off-screen.
    }

    if (r.width < 2 || r.height < 2) {
      return true;
    }

    if (r.left < -3000 || r.top < -3000) {
      return true;
    }
    return false;
  };

  // =====================================================================
  // SIGNAL COLLECTION
  // =====================================================================
  const collectSignals = (el) => {
    const sig = [];
    const push = (s) => { if (s) sig.push(String(s)); };
    push(el.name);
    push(el.id);
    push(el.placeholder);
    push(el.getAttribute && el.getAttribute("aria-label"));
    push(el.getAttribute && el.getAttribute("aria-placeholder"));
    push(el.getAttribute && el.getAttribute("data-testid"));
    push(el.getAttribute && el.getAttribute("data-test"));
    push(el.getAttribute && el.getAttribute("data-cy"));
    push(el.getAttribute && el.getAttribute("data-name"));
    push(el.getAttribute && el.getAttribute("data-field"));
    push(el.getAttribute && el.getAttribute("data-formid"));
    push(el.title);

    if (el.id) {
      try {
        const root = el.getRootNode();
        const lbl = root.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) push(textOf(lbl));
      } catch { }
    }
    const wrapLabel = el.closest && el.closest("label");
    if (wrapLabel) push(textOf(wrapLabel));

    const labelledBy = el.getAttribute && el.getAttribute("aria-labelledby");
    if (labelledBy) {
      labelledBy.split(/\s+/).forEach((id) => {
        try {
          const root = el.getRootNode();
          const ref = root.getElementById(id) || document.getElementById(id);
          if (ref) push(textOf(ref));
        } catch { }
      });
    }

    // Special for PrimeVue: Check for sibling labels or spans (p-dropdown-label, etc)
    let sibling = el.parentElement?.firstElementChild;
    while (sibling) {
      if (sibling !== el && (sibling.tagName === "LABEL" || sibling.classList.contains("p-dropdown-label") || sibling.classList.contains("p-select-label") || sibling.classList.contains("p-placeholder"))) {
        push(textOf(sibling));
      }
      sibling = sibling.nextElementSibling;
    }

    // Deep Sensing: Nearby container text
    const container = el.closest && el.closest("div, section, td, .p-field, .form-group, .v-input, .MuiFormControl-root");
    if (container) {
      push(container.innerText.slice(0, 150));
    }

    const fs = el.closest && el.closest("fieldset");
    if (fs) {
      const legend = fs.querySelector("legend");
      if (legend) push(textOf(legend));
    }

    let prev = el.previousElementSibling;
    let hops = 0;
    while (prev && hops < 2) {
      const t = textOf(prev);
      if (t && t.length < 80) push(t);
      prev = prev.previousElementSibling;
      hops++;
    }

    const wrapper = el.closest && el.closest(
      "[class*='form-field'],[class*='FormField'],[class*='input'],[class*='Input']," +
      ".MuiTextField-root,mat-form-field,.MuiAutocomplete-root,.ant-form-item," +
      ".chakra-form-control,[class*='form-group'],[class*='formGroup']," +
      ".p-field,.p-float-label,.p-inputwrapper"
    );
    if (wrapper) {
      const lblNode = wrapper.querySelector("label,.label,[class*='label'],[class*='Label']");
      if (lblNode && !lblNode.contains(el)) push(textOf(lblNode));

      // If still no label found, maybe it's just a sibling span/div
      if (!lblNode) {
        const spanLbl = wrapper.querySelector("span:first-child, div:first-child, p:first-child");
        if (spanLbl && spanLbl !== el) push(textOf(spanLbl));
      }

      // Look for aria-describedby links
      const descId = el.getAttribute("aria-describedby");
      if (descId) {
        const descEl = document.getElementById(descId);
        if (descEl) push(textOf(descEl));
      }
    }

    // 5. Check Icon classes in the same container
    const icons = wrapper ? wrapper.querySelectorAll("i, span[class*='pi-'], span[class*='fa-'], span[class*='icon-']") : [];
    for (const icon of icons) {
      push(icon.className);
    }

    // 6. Previous Element Context (Crucial for label-above inputs)
    const prevEl = el.previousElementSibling;
    if (prevEl) push(prevEl.innerText);
    const parentPrevEl = el.parentElement?.previousElementSibling;
    if (parentPrevEl) push(parentPrevEl.innerText);

    // 7. Deep Contextual Scan: ALWAYS check wrapper text for custom components
    if (wrapper) {
      const allText = wrapper.innerText.toLowerCase();
      if (allText.length < 100) push(allText); // only if not a giant block
    }

    push(el.className);
    return sig.join(" ").toLowerCase();
  };

  // =====================================================================
  // KEY DETECTION
  // =====================================================================
  const PATTERNS = [
    ["cardCVV", /\b(cvv|cvc|cv2|security[\s\-_]?code|card[\s\-_]?code|kode[\s\-_]?keamanan)\b/],
    ["cardExpiry", /(expir|exp[\s\-_]?(date|month|year)|valid[\s\-_]?thru|masa[\s\-_]?berlaku|kadaluarsa)/],
    ["creditCard", /(card[\s\-_]?number|cc[\s\-_]?number|credit[\s\-_]?card|nomor[\s\-_]?kartu|cardnum)/],
    ["fullName", /\b(nama[\s\-_]?lengkap|full[\s\-_]?name|complete[\s\-_]?name|nama[\s\-_]?(sesuai|pemilik|pada|tertera|atas|di[\s\-_]?ktp|di[\s\-_]?identitas|ktp|identitas)|name[\s\-_]?(on|as|per|according)|legal[\s\-_]?name|cardholder|^nama$|^name$)\b/],
    ["motherName", /\b(ibu[\s\-_]?kandung|mother[\s\-_]?name)\b/],
    ["birthPlace", /\b(tempat[\s\-_]?lahir|pob|birth[\s\-_]?place)\b/],
    ["nationality", /\b(kewarganegaraan|nationality|country[\s\-_]?of[\s\-_]?origin)\b/],
    ["religion", /\b(agama|religion|faith|pilih[\s\-_]?agama)\b/i],
    ["gender", /\b(jenis[\s\-_]?kelamin|gender|sex|kelamin)\b/],
    ["maritalStatus", /\b(status[\s\-_]?perkawinan|marital[\s\-_]?status|status[\s\-_]?nikah)\b/],
    ["idType", /\b(jenis[\s\-_]?identitas|id[\s\-_]?type|identity[\s\-_]?type)\b/],
    ["cardExpiry", /(expir|exp[\s\-_]?(date|month|year)|valid[\s\-_]?thru|masa[\s\-_]?berlaku|kadaluarsa|tanggal[\s\-_]?berlaku)/],
    ["province", /\b(provinsi|province|state)\b/],
    ["city", /\b(kota|kabupaten|city|regency|district)\b/],
    ["district", /\b(kecamatan|sub[\s\-_]?district|area)\b/],
    ["nik", /\b(nik|ktp|nomor[\s\-_]?induk|nomor[\s\-_]?ktp|national[\s\-_]?id|identity[\s\-_]?number|ssn)\b/],
    ["taxId", /\b(npwp|tax[\s\-_]?id|tin|vat[\s\-_]?id)\b/],
    ["companyId", /\b(nib|nomor[\s\-_]?induk[\s\-_]?berusaha|registration[\s\-_]?number|akta|perizinan|nomor[\s\-_]?pendirian|nip|employee[\s\-_]?id|nomor[\s\-_]?induk[\s\-_]?pegawai)\b/],
    ["education", /\b(pendidikan|education|degree|pendidik[\s\-_]?terakhir)\b/],
    ["industry", /\b(bidang[\s\-_]?usaha|industry|sector|business[\s\-_]?type)\b/],
    ["workStartDate", /\b(mulai[\s\-_]?kerja|work[\s\-_]?start|hired[\s\-_]?date|joined[\s\-_]?date)\b/],
    ["passport", /\b(passport|paspor|travel[\s\-_]?document)\b/],
    ["ssn", /\b(ssn|social[\s\-_]?security|sin)\b/],
    ["birthPlace", /(birth[\s\-_]?place|tempat[\s\-_]?lahir|pob)\b/],
    ["birthYear", /(birth[\s\-_]?year|tahun[\s\-_]?lahir|year[\s\-_]?of[\s\-_]?birth)/],
    ["birthMonth", /(birth[\s\-_]?month|bulan[\s\-_]?lahir|month[\s\-_]?of[\s\-_]?birth)/],
    ["birthDay", /(birth[\s\-_]?day|day[\s\-_]?of[\s\-_]?birth)/],
    ["birthDate", /(birth[\s\-_]?date|date[\s\-_]?of[\s\-_]?birth|dob|tanggal[\s\-_]?lahir|tgl[\s\-_]?lahir|bday|tanggal[\s\-_]?pendirian|tgl[\s\-_]?pendirian|birthdate|tanggal[\s\-_]?berlaku|tgl[\s\-_]?berlaku|expired|exp[\s\-_]?date)/],
    ["age", /\b(age|umur|usia)\b/],
    ["gender", /\b(gender|sex|jenis[\s\-_]?kelamin|kelamin|sex)\b/],
    ["religion", /\b(religion|agama|kepercayaan)\b/],
    ["maritalStatus", /\b(marital|marriage|status[\s\-_]?perkawinan|perkawinan|menikah|cerai)\b/],
    ["nationality", /\b(nationality|citizenship|kewarganegaraan|warga[\s\-_]?negara|wni|wna)\b/],
    ["salutation", /\b(salutation|title|panggilan|gelar|salutasi|sapaan)\b/],
    ["addressLine2", /(address[\s\-_]?(line)?[\s\-_]?2|apt|apartment|suite|unit|rt[\s\-_]?\/?[\s\-_]?rw|address2|kecamatan|kelurahan|desa)\b/],
    ["zip", /\b(zip|postal|postcode|post[\s\-_]?code|kode[\s\-_]?pos|kodepos)\b/],
    ["city", /\b(city|town|kota|kabupaten|kab\.|locality|address[\s\-_]?level[\s\-_]?2)\b/],
    ["state", /\b(state|province|provinsi|propinsi|region|address[\s\-_]?level[\s\-_]?1)\b/],
    ["country", /\b(country|negara)\b/],
    ["street", /(street|address[\s\-_]?(line)?[\s\-_]?1?|street[\s\-_]?address|alamat|jalan|^addr$|address$)/],
    ["phone", /\b(phone|tel|telp|telepon|telephone|mobile|hp|handphone|whatsapp|wa[\s\-_]?number|nomor[\s\-_]?(telp|hp|wa|fax|faximile|rumah))\b/],
    ["email", /\b(e[\s\-_]?mail|email|surel|email[\s\-_]?address|alamat[\s\-_]?email)\b/],
    ["password", /\b(pass(word)?|kata[\s\-_]?sandi|sandi|kata[\s\-_]?kunci)\b/],
    ["username", /\b(user[\s\-_]?name|userid|user[\s\-_]?id|login|nama[\s\-_]?pengguna|account[\s\-_]?name|handle)\b/],
    ["jobTitle", /\b(job[\s\-_]?title|position|jabatan|posisi|pekerjaan|profesi|occupation|role)\b/],
    ["company", /\b(company|organization|organisation|employer|perusahaan|organisasi|institusi|nama[\s\-_]?perusahaan|badan[\s\-_]?hukum|instansi|lembaga|nama[\s\-_]?badan)\b/],
    ["website", /\b(website|url|homepage|situs|web[\s\-_]?address)\b/],
    ["bio", /\b(bio|biography|about[\s\-_]?(me|you)?|description|tentang|deskripsi|message|comments?|catatan|pesan)\b/],
    ["middleName", /\b(middle[\s\-_]?name|nama[\s\-_]?tengah)\b/],
    ["firstName", /\b(first[\s\-_]?name|given[\s\-_]?name|fname|forename|nama[\s\-_]?(depan|awal|pertama)|notaris|nama[\s\-_]?kecil|panggilan)\b/],
    ["lastName", /\b(last[\s\-_]?name|surname|family[\s\-_]?name|lname|nama[\s\-_]?(belakang|akhir|keluarga))\b/],
  ];

  const AUTOCOMPLETE_MAP = {
    "given-name": "firstName",
    "additional-name": "middleName",
    "family-name": "lastName",
    "name": "fullName",
    "email": "email",
    "username": "username",
    "new-password": "password",
    "current-password": "password",
    "tel": "phone",
    "tel-national": "phoneLocal",
    "street-address": "street",
    "address-line1": "street",
    "address-line2": "addressLine2",
    "address-level2": "city",
    "address-level1": "state",
    "postal-code": "zip",
    "country": "countryCode",
    "country-name": "country",
    "organization": "company",
    "organization-title": "jobTitle",
    "bday": "birthDate",
    "bday-year": "birthYear",
    "bday-month": "birthMonth",
    "bday-day": "birthDay",
    "sex": "gender",
    "url": "website",
    "cc-number": "creditCard",
    "cc-exp": "cardExpiry",
    "cc-csc": "cardCVV"
  };

  const TYPE_MAP = {
    "email": "email",
    "tel": "phone",
    "url": "website",
    "password": "password"
  };

  const detectKey = (el) => {
    const ac = ((el.getAttribute && el.getAttribute("autocomplete")) || "").toLowerCase().split(/\s+/).pop();
    if (ac && AUTOCOMPLETE_MAP[ac]) return AUTOCOMPLETE_MAP[ac];

    const t = (el.type || "").toLowerCase();
    if (TYPE_MAP[t]) return TYPE_MAP[t];
    if (t === "file") return "file";

    const sig = collectSignals(el);
    if (sig) {
      for (const [key, re] of PATTERNS) {
        if (re.test(sig)) {
          return key;
        }
      }
    }

    if (t === "date") return "birthDate";
    return null;
  };

  const formatForType = (el, key, value) => {
    const t = (el.type || "").toLowerCase();
    if (t === "date") return value;
    if (t === "month") {
      if (key === "birthDate") return value.slice(0, 7);
      if (key === "cardExpiry") {
        const [m, y] = value.split("/");
        return `20${y}-${m}`;
      }
    }
    const max = parseInt(el.getAttribute("maxlength") || "0", 10);
    if (max > 0 && value.length > max) return value.slice(0, max);
    return value;
  };

  // =====================================================================
  // ADAPTERS — library-specific fill strategies
  // First match wins, so order from most-specific to fallback.
  // =====================================================================
  const ADAPTERS = [
    // ---- Vuetify (Vue) ----
    {
      name: "vuetify",
      match(el) {
        return !!el.closest(".v-input, .v-select, .v-checkbox, .v-radio, .v-autocomplete");
      },
      async fill(el, value, key, data) {
        const root = el.closest(".v-input");
        if (!root) return false;

        // Select / Autocomplete
        if (root.classList.contains("v-select") || root.classList.contains("v-autocomplete")) {
          simulateClick(root);
          await sleep(300);
          const menu = $(".v-menu__content, .v-overlay-container");
          const opts = menu ? $$(".v-list-item, [role='option']", menu) : $$(".v-list-item");
          const target = String(value).toLowerCase();
          let opt = opts.find(o => textOf(o).toLowerCase() === target) ||
            opts.find(o => textOf(o).toLowerCase().includes(target)) ||
            opts[0];
          if (opt) {
            simulateClick(opt);
            await sleep(100);
            return true;
          }
        }

        // Standard Input
        el.focus();
        setNativeValue(el, String(value));
        fireInput(el, String(value));
        fire(el, ["change", "blur"]);
        return true;
      }
    },
    // ---- UNIVERSAL COMPONENT ADAPTER (The "Smart" One) ----
    {
      name: "universal-ui",
      match(el) {
        return !!el.closest(".p-dropdown, .p-select, .p-multiselect, .p-calendar, .p-datepicker, .v-select, .ant-select, .select2, .chosen-container, [role='combobox'], [aria-haspopup='listbox']");
      },
      async fill(el, value, key, data) {
        const root = el.closest(".p-dropdown, .p-select, .p-multiselect, .p-calendar, .p-datepicker, .v-select, .ant-select, .select2, .chosen-container, [role='combobox'], [aria-haspopup='listbox']") || el.parentElement;

        // Special: If it's a Calendar/DatePicker
        const isDate = el.classList.contains("p-datepicker-input") ||
          el.closest(".p-datepicker, .p-calendar") ||
          (key && /date|lahir|berlaku|kerja|start|mulai/i.test(key));

        if (isDate && !el.closest(".p-dropdown, .p-select, .p-multiselect")) {
          const input = (el.tagName === "INPUT" ? el : root.querySelector("input")) || el;
          input.focus();

          // Force remove readonly to bypass framework locks
          const wasReadOnly = input.readOnly;
          input.readOnly = false;

          const [y, m, d] = String(value).split("-");
          const formatted = y && y.length === 4 ? `${d}-${m}-${y}` : value;

          // 1. Open the panel (Icon Sniper + Dual Hit)
          const icon = root.querySelector(".pi-calendar, .p-datepicker-trigger");
          if (icon) simulateClick(icon);
          simulateClick(input);
          simulateClick(root);
          await sleep(150); // Ultra-fast response

          // 2. Try to find "Today" button in the panel
          let panel = document.querySelector(".p-datepicker-panel, .p-datepicker, .p-connected-overlay-enter-done");
          if (!panel) {
            await sleep(200);
            panel = document.querySelector(".p-datepicker-panel, .p-datepicker, .p-connected-overlay-enter-done");
          }
          if (panel) {
            const todayBtn = panel.querySelector(".p-datepicker-today-button .p-button-label, .p-datepicker-today-button, .p-datepicker-today") ||
              Array.from(panel.querySelectorAll("button, span, td")).find(el => /today|hari[\s\-_]?ini/i.test(el.innerText));

            const isToday = value && new Date(value).toDateString() === new Date().toDateString();

            if (todayBtn && isToday) {
              // Exact click like user did for today
              simulateClick(todayBtn);
              await sleep(50);
              fire(input, ["input", "change", "blur"]);
              sendKey(input, "Enter");
              return true;
            }

            // For years like 1981, or if Today fails, use the injection fallback below

            // Fallback: click ANY numeric day, prioritize the highlighted/active one
            const days = Array.from(panel.querySelectorAll("td, span, button, a"))
              .filter(el => /^[1-9][0-9]?$/.test(el.innerText.trim()) && el.offsetParent !== null);

            const activeDay = days.find(el => el.classList.contains("p-highlight") || el.classList.contains("p-datepicker-today")) ||
              days.find(el => !el.classList.contains("p-disabled") && !el.classList.contains("p-datepicker-other-month")) ||
              days[0];

            if (activeDay) {
              simulateClick(activeDay);
              await sleep(100);
              fire(input, ["input", "change", "blur"]);
              sendKey(input, "Enter");
              return true;
            }
          }

          // 3. Last Resort: Force Value (No typing, just force)
          input.value = formatted;
          setNativeValue(input, formatted);
          fire(input, ["input", "change", "blur"]);
          sendKey(input, "Enter");
          input.readOnly = wasReadOnly;
          return true;
        }

        // 1. Wait for any previous dropdown animation to finish
        await sleep(100);

        // 2. Click the root dropdown element directly

        simulateClick(root);
        await sleep(150);

        // 3. Find the overlay panel with global fallback
        const findPanel = () => {
          // Method 1: aria-controls
          const ariaCtrl = root.getAttribute("aria-controls");
          if (ariaCtrl) {
            const byAria = document.getElementById(ariaCtrl);
            if (byAria) return byAria;
          }
          // Method 2: Global scan for visible overlays
          const overlays = [
            ".p-select-overlay", ".p-select-panel", ".p-dropdown-panel", ".p-multiselect-panel",
            ".p-connected-overlay-enter-done", "[role='listbox']", ".dropdown-menu"
          ];
          for (const sel of overlays) {
            const found = document.querySelectorAll(sel);
            for (const f of found) {
              if (f.classList.contains("p-anchored-overlay-leave-active")) continue;
              const style = getComputedStyle(f);
              if (style.display !== "none" && style.visibility !== "hidden") return f;
            }
          }
          return null;
        };

        const itemSelectors = [
          ".p-dropdown-item", ".p-select-option", ".p-multiselect-item", "[data-pc-section='item']",
          "[data-pc-section='option']", "[role='option']", "li.p-dropdown-item", "li"
        ];

        // Poll for items (15 × 200ms = 3s max)
        let items = [];
        let panel = null;


        for (let attempt = 0; attempt < 15; attempt++) {
          panel = findPanel();
          if (panel) {
            for (const s of itemSelectors) {
              const found = $$(s, panel);
              const visible = found.filter(el => {
                if (el.classList.contains("p-disabled") || el.classList.contains("p-hidden")) return false;
                if (el.classList.contains("p-dropdown-empty-message") || el.classList.contains("p-select-empty-message")) return false;
                if (el.getAttribute("data-p-hidden-accessible") === "true") return false;
                return true;
              });
              if (visible.length > 0) { items = visible; break; }
            }

          } else {

            // Emergency: if panel still missing after 3 attempts, try clicking trigger
            if (attempt === 3) {
              const trigger = root.querySelector(".p-dropdown-trigger, .p-select-trigger, .pi-chevron-down, svg");
              if (trigger) {

                simulateClick(trigger);
              }
            }
          }
          if (items.length > 0) break;
          await sleep(200);
        }

        if (items.length > 0) {
          const target = String(value).toLowerCase();
          let opt = items.find(o => textOf(o).toLowerCase() === target) ||
            items.find(o => textOf(o).toLowerCase().includes(target)) ||
            items.find(o => textOf(o).trim().length > 0) ||
            items[0];

          if (opt) {
            opt.scrollIntoView({ block: "nearest" });
            simulateClick(opt);
            await sleep(100);
            fire(el, ["change", "blur"]);
            return true;
          }
        }


        return false;
      }
    },

    // ---- FILE UPLOAD (Dummy) ----
    {
      name: "file-upload",
      match(el) { return el.type === "file"; },
      async fill(el) {
        try {
          const blob = new Blob(["dummy content"], { type: "text/plain" });
          const file = new File([blob], "dummy_document.txt", { type: "text/plain" });
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          el.files = dataTransfer.files;
          fire(el, ["change", "input"]);
          return true;
        } catch { return false; }
      }
    },

    // ---- React-Select (`select__control` / `Select-control`) ----
    {
      name: "react-select",
      match(el) {
        if (el.tagName !== "INPUT") return false;
        return !!el.closest("[class*='select__control'], [class*='Select-control'], [class*='select__value-container']");
      },
      async fill(el, value) {
        const control = el.closest("[class*='select__control'], [class*='Select-control']");
        if (!control) return false;
        simulateClick(control);
        await sleep(120);
        el.focus();
        setNativeValue(el, String(value));
        fireInput(el, String(value));
        await sleep(180);
        const opts = $$("[class*='select__option']:not([class*='disabled']), [class*='Select-option']:not([class*='disabled'])");
        const target = String(value).toLowerCase();
        let opt = opts.find((o) => textOf(o).toLowerCase() === target);
        if (!opt) opt = opts.find((o) => textOf(o).toLowerCase().includes(target));
        if (!opt) opt = opts[0];
        if (!opt) {
          sendKey(el, "Enter");
          return false;
        }
        simulateClick(opt);
        await sleep(60);
        return true;
      }
    },

    // ---- MUI Autocomplete ----
    {
      name: "mui-autocomplete",
      match(el) { return el.tagName === "INPUT" && el.closest(".MuiAutocomplete-root"); },
      async fill(el, value) {
        el.focus();
        simulateClick(el);
        await sleep(80);
        setNativeValue(el, String(value));
        fireInput(el, String(value));
        await sleep(220);
        const popup = $(".MuiAutocomplete-popper, [role='presentation'] [role='listbox']");
        const opts = popup ? $$("[role='option']", popup) : $$(".MuiAutocomplete-option, [role='listbox'] [role='option']");
        const target = String(value).toLowerCase();
        let opt = opts.find((o) => textOf(o).toLowerCase() === target);
        if (!opt) opt = opts.find((o) => textOf(o).toLowerCase().includes(target));
        if (!opt) opt = opts[0];
        if (opt) {
          simulateClick(opt);
          await sleep(60);
          return true;
        }
        sendKey(el, "Enter");
        return true;
      }
    },

    // ---- Ant Design Select ----
    {
      name: "ant-select",
      match(el) {
        if (el.tagName === "INPUT" && el.closest(".ant-select")) return true;
        return false;
      },
      async fill(el, value) {
        const root = el.closest(".ant-select");
        simulateClick(root);
        await sleep(150);
        el.focus();
        setNativeValue(el, String(value));
        fireInput(el, String(value));
        await sleep(180);
        const opts = $$(".ant-select-item-option:not(.ant-select-item-option-disabled)");
        const target = String(value).toLowerCase();
        let opt = opts.find((o) => textOf(o).toLowerCase() === target);
        if (!opt) opt = opts.find((o) => textOf(o).toLowerCase().includes(target));
        if (!opt) opt = opts[0];
        if (opt) {
          simulateClick(opt);
          await sleep(60);
          return true;
        }
        return false;
      }
    },

    // ---- Headless UI / generic ARIA combobox ----
    {
      name: "aria-combobox",
      match(el) {
        if (el.tagName === "SELECT" || el.tagName === "INPUT" || el.tagName === "TEXTAREA") return false;
        if (el.getAttribute && el.getAttribute("role") === "combobox") return true;
        if (el.getAttribute && el.getAttribute("role") === "listbox") return true;
        return false;
      },
      async fill(el, value) {
        simulateClick(el);
        await sleep(150);
        const controlsId = el.getAttribute("aria-controls");
        const listbox = controlsId ? document.getElementById(controlsId) : $("[role='listbox']:not([hidden])");
        if (!listbox) return false;
        const opts = $$("[role='option']", listbox);
        const target = String(value).toLowerCase();
        let opt = opts.find((o) => textOf(o).toLowerCase() === target);
        if (!opt) opt = opts.find((o) => textOf(o).toLowerCase().includes(target));
        if (!opt) opt = opts[0];
        if (opt) {
          simulateClick(opt);
          await sleep(60);
          return true;
        }
        return false;
      }
    },

    // ---- react-datepicker ----
    {
      name: "react-datepicker",
      match(el) { return el.tagName === "INPUT" && el.closest(".react-datepicker__input-container"); },
      async fill(el, value, key, data) {
        const dt = data.birthDate;
        const [y, m, d] = dt.split("-");
        el.focus();
        const formatted = `${m}/${d}/${y}`;
        setNativeValue(el, formatted);
        fireInput(el, formatted);
        fire(el, ["change", "blur"]);
        sendKey(el, "Enter");
        return true;
      }
    },

    // ---- Quill rich text ----
    {
      name: "quill",
      match(el) {
        return (el.classList && el.classList.contains("ql-editor")) || (el.closest && el.closest(".ql-container"));
      },
      async fill(el, value) {
        const editor = el.classList && el.classList.contains("ql-editor") ? el : el.closest(".ql-container").querySelector(".ql-editor");
        if (!editor) return false;
        editor.focus();
        editor.innerHTML = `<p>${String(value).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</p>`;
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: String(value) }));
        return true;
      }
    },

    // ---- ProseMirror / Tiptap ----
    {
      name: "prosemirror",
      match(el) {
        return (el.classList && el.classList.contains("ProseMirror")) || (el.closest && el.closest(".ProseMirror"));
      },
      async fill(el, value) {
        const ed = el.classList && el.classList.contains("ProseMirror") ? el : el.closest(".ProseMirror");
        if (!ed) return false;
        ed.focus();
        try { document.execCommand("selectAll", false); } catch { }
        try { document.execCommand("insertText", false, String(value)); } catch { }
        ed.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: String(value) }));
        return true;
      }
    },

    // ---- Slate.js ----
    {
      name: "slate",
      match(el) {
        return el.getAttribute && el.getAttribute("data-slate-editor") === "true";
      },
      async fill(el, value) {
        el.focus();
        try { document.execCommand("selectAll", false); } catch { }
        try { document.execCommand("insertText", false, String(value)); } catch { }
        el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: String(value) }));
        return true;
      }
    },

    // ---- Native <select> ----
    {
      name: "native-select",
      match(el) { return el.tagName === "SELECT"; },
      async fill(el, value, key) {
        const target = String(value).toLowerCase();
        let bestIdx = -1;
        let bestScore = 0;
        for (let i = 0; i < el.options.length; i++) {
          const o = el.options[i];
          const v = (o.value || "").toLowerCase();
          const txt = (o.textContent || "").toLowerCase();
          if (!v && !txt) continue;
          let score = 0;
          if (v === target || txt === target) score = 100;
          else if (v.includes(target) || txt.includes(target)) score = 60;
          else if (target.includes(v) && v.length > 1) score = 50;
          else if (target.includes(txt) && txt.length > 1) score = 40;
          if (key === "gender") {
            if (/^(m|male|laki|pria)/.test(target) && /^(m|male|laki|pria)/.test(v + " " + txt)) score = Math.max(score, 90);
            if (/^(f|female|perempuan|wanita)/.test(target) && /(female|perempuan|wanita)/.test(v + " " + txt)) score = Math.max(score, 90);
          }
          if (score > bestScore) { bestScore = score; bestIdx = i; }
        }
        if (bestIdx === -1) {
          for (let i = 0; i < el.options.length; i++) if (el.options[i].value) { bestIdx = i; break; }
        }
        if (bestIdx < 0) return false;
        setNativeValue(el, el.options[bestIdx].value);
        el.selectedIndex = bestIdx;
        fire(el, ["input", "change", "blur"]);
        return true;
      }
    },

    // ---- Generic contenteditable ----
    {
      name: "contenteditable",
      match(el) { return el.isContentEditable === true; },
      async fill(el, value) {
        el.focus();
        try { document.execCommand("selectAll", false); } catch { }
        try { document.execCommand("insertText", false, String(value)); } catch { }
        if (!el.textContent || el.textContent.trim() === "") {
          el.textContent = String(value);
        }
        el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: String(value) }));
        fire(el, ["change", "blur"]);
        return true;
      }
    },
    // ---- File Uploads ----
    {
      name: "file",
      match(el) { return el.type === "file"; },
      async fill(el, value, key, data) {
        try {
          const isImage = /(photo|foto|image|img|poto|avatar)/i.test(key + (el.name || ""));
          const fileName = isImage ? "dummy_photo.png" : "dummy_document.pdf";
          const fileType = isImage ? "image/png" : "application/pdf";

          const file = createDummyFile(fileName, fileType);
          const dt = new DataTransfer();
          dt.items.add(file);

          el.files = dt.files;
          fire(el, ["change", "input"]);
          return true;
        } catch (e) {
          return false;
        }
      }
    },

    // ---- Native fallback (input / textarea) ----
    {
      name: "native",
      match() { return true; },
      async fill(el, value, key) {
        let formatted = formatForType(el, key, String(value));

        // Anti-double +62 logic
        if (key === "phone" || key === "phoneLocal") {
          const existing = el.value || "";
          if ((existing.includes("+62") || existing.startsWith("62")) && formatted.startsWith("+62")) {
            formatted = formatted.replace("+62", "").trim();
          } else if (existing.startsWith("0") && formatted.startsWith("+62")) {
            formatted = formatted.replace("+62", "0").trim();
          }
        }

        el.focus();
        setNativeValue(el, formatted);
        fireInput(el, formatted);
        fire(el, ["change", "blur"]);
        return true;
      }
    }
  ];

  const findAdapter = (el) => ADAPTERS.find((a) => {
    try { return a.match(el); } catch { return false; }
  });

  // =====================================================================
  // CHECKBOX / RADIO
  // =====================================================================
  const trySetCheckbox = (el) => {
    if (el.checked) return false;
    setNativeChecked(el, true);
    simulateClick(el);
    fire(el, ["input", "change"]);
    return true;
  };

  const setRadioGroup = (radios, value, key) => {
    const target = String(value).toLowerCase();
    let chosen = null;
    for (const r of radios) {
      const v = (r.value || "").toLowerCase();
      const lbl = collectSignals(r);
      const combined = `${v} ${lbl}`;
      if (v === target) { chosen = r; break; }
      if (key === "gender") {
        if (/^(m|male|laki|pria)/.test(target) && /(male|laki|pria)/.test(combined) && !/female|perempuan|wanita/.test(combined)) { chosen = r; break; }
        if (/^(f|female|perempuan|wanita)/.test(target) && /(female|perempuan|wanita)/.test(combined)) { chosen = r; break; }
      }
      if (lbl.includes(target)) chosen = r;
    }
    if (!chosen) chosen = radios[0];
    if (chosen && !chosen.checked) {
      setNativeChecked(chosen, true);
      simulateClick(chosen);
      fire(chosen, ["input", "change"]);
      return true;
    }
    return false;
  };

  // =====================================================================
  // INPUT COLLECTION (incl. open shadow DOM)
  // =====================================================================
  const collectInputs = () => {
    const sel = "input, textarea, select, [contenteditable='true'], [contenteditable=''], [role='combobox'], .p-dropdown, .p-select, .p-datepicker, .p-calendar";
    const out = new Set();
    const stack = [document];
    const visited = new Set();

    while (stack.length > 0) {
      const root = stack.pop();
      if (!root || visited.has(root)) continue;
      visited.add(root);

      try {
        const found = root.querySelectorAll(sel);
        for (const el of found) out.add(el);
      } catch { }

      // Shadow Roots
      try {
        root.querySelectorAll("*").forEach(el => {
          if (el.shadowRoot) stack.push(el.shadowRoot);
        });
      } catch { }

      // Iframes (Same-origin only)
      try {
        root.querySelectorAll("iframe").forEach(ifr => {
          try {
            if (ifr.contentDocument) stack.push(ifr.contentDocument);
          } catch { }
        });
      } catch { }
    }
    return [...out];
  };

  const isFillable = (el) => {
    if (!el) return false;
    if (el.disabled) return false;

    // Skip label spans & child elements inside dropdown containers — only the container is processed
    if (el.classList.contains("p-select-label") || el.classList.contains("p-dropdown-label") || el.classList.contains("p-placeholder")) {
      return false;
    }
    if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") &&
      el.closest(".p-dropdown, .p-select, .p-multiselect") &&
      !el.classList.contains("p-datepicker-input")) {
      return false;
    }

    // PrimeVue & many UI libs use readonly inputs for Dropdowns/Calendars
    const isSpecialUI = el.getAttribute?.("role") === "combobox" ||
      el.classList.contains("p-datepicker-input") ||
      el.closest?.(".p-calendar, .p-datepicker, .p-autocomplete");

    if (el.readOnly && !isSpecialUI) return false;

    const t = (el.type || "").toLowerCase();
    if (t === "hidden" || t === "submit" || t === "button" || t === "reset" || t === "file" || t === "image") return false;
    if (isHoneypot(el)) return false;
    return true;
  };

  // =====================================================================
  // MAIN FILL — multi-pass async
  // =====================================================================

  const fillOnce = async (language, data, filledMarker) => {
    const all = collectInputs();
    let passFilled = 0;
    const radioGroups = new Map();
    const checkboxGroups = new Map();
    const dataKeys = Object.keys(data);

    for (const el of all) {
      if (window.__smartFillerStopRequested) return passFilled;
      if (filledMarker.has(el)) continue;
      if (!isFillable(el)) continue;

      const t = (el.type || "").toLowerCase();
      if (t === "checkbox") {
        const sig = collectSignals(el);
        const isAgreement = /agree|terms|setuju|syarat|consent|privacy|kebijakan|i[\s-]?accept|saya[\s-]?menyetujui|ketentuan|persetujuan|memberikan/i.test(sig);

        if (isAgreement) {
          // Always check agreement checkboxes
          if (trySetCheckbox(el)) { filledMarker.add(el); passFilled++; }
        } else {
          // For non-agreement checkboxes: check at least the first one in each group
          const name = el.name || "__cb_" + (el.closest(".p-field, .form-group, div")?.id || "anon");
          if (!checkboxGroups.has(name)) {
            checkboxGroups.set(name, true);
            // Check this one (first in group)
            if (trySetCheckbox(el)) { filledMarker.add(el); passFilled++; }
          } else {
            filledMarker.add(el); // Skip rest of group
          }
        }
        continue;
      }
      if (t === "radio") {
        const name = el.name || "__nn__";
        if (!radioGroups.has(name)) radioGroups.set(name, []);
        radioGroups.get(name).push(el);
        continue;
      }

      let key = detectKey(el);
      if (!key) {
        const sig = collectSignals(el);
        const semanticMap = {
          // IMPORTANT: Multi-word phrases MUST come before single-word to avoid false matches
          pensionAge: ["usia pensiun", "usia pesiun", "retirement age", "usia peserta", "usia"],
          salutation: ["salutasi", "salutation", "sapaan", "gelar"],
          religion: ["agama", "religion", "keyakinan"],
          gender: ["jenis kelamin", "kelamin", "sex", "gender"],
          maritalStatus: ["status perkawinan", "status nikah", "marital"],
          nationality: ["kewarganegaraan", "nationality", "negara"],
          idType: ["jenis identitas", "identitas"],
          birthDate: ["tanggal lahir", "tgl lahir", "dob", "birth date"],
          birthPlace: ["tempat lahir", "birth place", "pob"],
          workStartDate: ["mulai kerja", "tanggal mulai", "tanggal kerja", "hired date", "joined date"],
          monthlyIncome: ["penghasilan", "gaji", "income", "salary", "pendapatan bersih"],
          contributionAmount: ["iuran", "kontribusi", "contribution", "besaran iuran", "premi"],
          accountYear: ["tahun pembukaan", "tahun rekening", "opening year", "tahun"],
          age: ["umur", "age"]
        };
        for (const [k, synonyms] of Object.entries(semanticMap)) {
          if (synonyms.some(s => sig.includes(s))) { key = k; break; }
        }
        if (!key) key = dataKeys.find(k => sig.includes(k.toLowerCase()));
      }
      if (!key && el.classList.contains("p-datepicker-input")) key = "birthDate";

      let valToFill = null;
      if (!key) {
        const type = (el.type || "").toLowerCase();
        const inputMode = el.getAttribute("inputmode") || "";
        const role = el.getAttribute("role") || "";
        const sig = collectSignals(el);

        // Smart detection based on label context
        const isNumericInput = type === "number" || inputMode === "numeric" || inputMode === "decimal" || role === "spinbutton" || !!el.closest(".p-inputnumber");

        if (isNumericInput) {
          // Context-aware number generation
          if (/usia|umur|age/i.test(sig)) {
            valToFill = String(Math.floor(Math.random() * 56) + 45); // 45-100
          } else if (/tahun|year/i.test(sig)) {
            valToFill = String(Math.floor(Math.random() * 25) + 2000); // 2000-2024
          } else {
            valToFill = String((Math.floor(Math.random() * 10) + 1) * 1000000); // 1M-10M
          }
        } else if (type === "email") {
          valToFill = `user${Math.floor(Math.random() * 1000)}@gmail.com`;
        } else if (type === "tel") {
          valToFill = `0812${Math.floor(Math.random() * 10000000)}`;
        } else {
          // Text input — always use text, never numbers
          valToFill = data.fullName || data.city || "Data Dummy";
        }
        key = "fallback";
      } else {
        valToFill = data[key];
      }

      if (valToFill == null) { filledMarker.add(el); continue; }

      const adapter = findAdapter(el);
      if (!adapter) continue;

      try {
        const ok = await adapter.fill(el, valToFill, key, data);
        if (ok) {
          filledMarker.add(el);
          passFilled++;
          highlight(el);
        }
      } catch (e) {
        console.error("Fill error:", e);
      }
    }

    for (const [, radios] of radioGroups) {
      if (window.__smartFillerStopRequested) return passFilled;
      if (radios.some((r) => filledMarker.has(r))) continue;
      const key = detectKey(radios[0]);
      if (!key || data[key] == null) {
        radios.forEach((r) => filledMarker.add(r));
        continue;
      }
      if (setRadioGroup(radios, data[key], key)) {
        radios.forEach((r) => filledMarker.add(r));
        passFilled++;
      }
    }

    return passFilled;
  };

  const fillAll = async (requestedLanguage) => {
    window.__smartFillerStopRequested = false;
    let finalLanguage = requestedLanguage;

    if (!finalLanguage) {
      try {
        const stored = await new Promise((r, j) => {
          const timeout = setTimeout(() => r(null), 500);
          chrome.storage.local.get("preferredLanguage", (res) => {
            clearTimeout(timeout);
            r(res?.preferredLanguage);
          });
        });
        finalLanguage = stored || detectPageLanguage();
      } catch (e) {
        finalLanguage = detectPageLanguage();
      }
    }

    // 2. Save preference if explicitly requested
    if (requestedLanguage) {
      chrome.storage.local.set({ preferredLanguage: requestedLanguage });
    }

    const pack = LANGUAGES[finalLanguage] || LANGUAGES.en;
    const data = pack.generate();
    const filledMarker = new WeakSet();
    let total = 0;

    // Diagnostic: Force fill all file inputs immediately
    const files = document.querySelectorAll('input[type="file"]');
    for (const f of files) {
      const adapter = findAdapter(f);
      if (adapter) {
        const ok = await adapter.fill(f, "force", "file", data);
        if (ok) {
          filledMarker.add(f);
          total++;
          highlight(f);
        }
      }
    }

    // Up to 5 passes — covers wizard steps, lazy-rendered sections, dependent dropdowns.
    for (let pass = 0; pass < 5; pass++) {
      if (window.__smartFillerStopRequested) break;
      const filledThisPass = await fillOnce(finalLanguage, data, filledMarker);
      total += filledThisPass;
      await waitForDomStable(250, 1200);
      if (filledThisPass === 0) break;
    }

    // 3. Auto-Submit (Experimental)
    // We look for primary buttons after a small delay to let UI settle
    setTimeout(() => {
      const submitSelectors = [
        "button[type='submit']",
        "button.p-button-primary",
        "button.v-btn--primary",
        "button.ant-btn-primary",
        "input[type='submit']"
      ];
      for (const sel of submitSelectors) {
        const btn = document.querySelector(sel);
        // Only auto-click if it looks like a "Kirim/Submit" button and it's visible
        if (btn && !isHoneypot(btn) && /kirim|submit|daftar|simpan|save|next|selanjutnya/i.test(textOf(btn) || btn.value)) {
          // btn.click(); // Decided to keep it commented or as a setting for safety
        }
      }
    }, 1500);

    return { filled: total, data };
  };

  const clearAll = () => {
    const all = collectInputs();
    let cleared = 0;
    for (const el of all) {
      // For clearing, we are aggressive. No isFillable check.
      try {
        const t = (el.type || "").toLowerCase();
        if (t === "file") {
          el.value = "";
          try { el.files = (new DataTransfer()).files; } catch { }
          fire(el, ["change", "input"]);
          cleared++;
          continue;
        }
        if (t === "checkbox" || t === "radio") {
          if (el.checked) {
            setNativeChecked(el, false);
            simulateClick(el);
            fire(el, ["input", "change"]);
            cleared++;
          }
        } else if (el.tagName === "SELECT") {
          if (el.selectedIndex !== 0) {
            el.selectedIndex = 0;
            setNativeValue(el, el.options[0]?.value || "");
            fire(el, ["input", "change", "blur"]);
            cleared++;
          }
        } else if (el.isContentEditable) {
          if (el.textContent) { el.textContent = ""; fire(el, ["input", "change", "blur"]); cleared++; }
        } else if (typeof el.value === "string") {
          if (el.value) {
            setNativeValue(el, "");
            fire(el, ["input", "change", "blur"]);

            // Special: If this is inside a PrimeVue-like component, clear the label too
            const root = el.closest(".p-dropdown, .p-select, .p-calendar, .p-multiselect");
            if (root) {
              const lbl = root.querySelector(".p-dropdown-label, .p-select-label, .p-placeholder");
              if (lbl) lbl.textContent = "";
            }
            cleared++;
          }
        }
      } catch { }
    }
    // reset the marker so user can refill
    window.__smartFillerLoaded = true; // keep loaded
    // recreate WeakSet by reassigning — but const blocks that. Safe alt: tag a version.
    return { cleared };
  };

  // =====================================================================
  // MESSAGE BRIDGE
  // =====================================================================
  const messageListener = (msg, _sender, sendResponse) => {
    (async () => {
      try {
        if (msg.action === "fill") {
          const r = await fillAll(msg.language);
          sendResponse({ ok: true, ...r });
        } else if (msg.action === "fill-single") {
          if (lastRightClickedElement) {
            const language = msg.language || detectPageLanguage();
            const pack = LANGUAGES[language] || LANGUAGES.en;
            const data = pack.generate();
            const key = detectKey(lastRightClickedElement);
            if (key && data[key]) {
              const adapter = findAdapter(lastRightClickedElement);
              if (adapter) {
                await adapter.fill(lastRightClickedElement, data[key], key, data);
                highlight(lastRightClickedElement);
                sendResponse({ ok: true, filled: 1 });
              }
            }
          }
          sendResponse({ ok: false, error: "no element" });
        } else if (msg.action === "clear") {
          const r = clearAll();
          sendResponse({ ok: true, ...r });
        } else if (msg.action === "stop") {
          window.__smartFillerStopRequested = true;
          sendResponse({ ok: true });
        } else if (msg.action === "ping") {
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: "unknown action" });
        }
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  };

  chrome.runtime.onMessage.addListener(messageListener);

  // Cleanup for re-injection
  window.__smartFillerCleanup = () => {
    chrome.runtime.onMessage.removeListener(messageListener);
  };
})();
