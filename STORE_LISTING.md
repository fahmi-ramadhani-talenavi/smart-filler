# Chrome Web Store — Listing Copy

Use the following content when submitting Smart Filler to the Chrome Web Store.

---

## Item Details

**Name** (max 75 chars)
```
Smart Filler — Form Autofill for QA & Developers
```

**Summary** (max 132 chars)
```
Fills web forms with realistic test data. Supports React, Vue, Angular, PrimeVue, MUI, and bilingual EN/ID labels.
```

**Category**
```
Developer Tools
```

---

## Detailed Description (English)

```
Smart Filler is a powerful form autofill extension designed for developers and QA engineers who need to populate web forms with realistic, language-aware test data—instantly and repeatedly.

KEY FEATURES
- One-Click Fill: Populate every visible field on the page with localized data.
- Stop Button: Halt the filling process immediately at any time.
- Language Switch: Toggle between English (US) and Indonesian datasets.
- Framework Support: Works seamlessly with React, Vue, Angular, and Svelte.
- Deep Component Support: Native-like interaction with PrimeVue, MUI, Ant Design, react-select, and rich text editors (Quill, Tiptap).

ADVANCED DETECTION
- Uses a multi-signal engine: autocomplete tokens, ARIA attributes, semantic regex, and nearby label context.
- Skips honeypots and hidden anti-bot traps automatically.

REALISTIC DATA PACKS
- Luhn-valid Credit Cards (Test only).
- Valid Indonesian NIK & NPWP (Fictitious).
- Localized Phone Numbers, Addresses, and Names.

PRIVACY BY DESIGN
- 100% Offline: No analytics, no tracking, no remote requests.
- Local Storage: Only remembers your language preference.
```

---

## Detailed Description (Indonesian)

```
Smart Filler adalah alat pengisi form otomatis untuk developer dan QA yang membutuhkan data uji realistis secara instan.

FITUR UTAMA
- Sekali Klik: Isi semua kolom di halaman dengan data uji lokal.
- Tombol Stop: Hentikan proses pengisian kapan saja.
- Ganti Bahasa: Pilih antara data pack English (US) atau Indonesia.
- Dukungan Framework: Kompatibel dengan React, Vue, Angular, dan Svelte.
- Komponen Kompleks: Mendukung PrimeVue, MUI, Ant Design, react-select, dan editor teks (Quill, Tiptap).

DETEKSI PINTAR
- Menggunakan mesin deteksi multi-sinyal: atribut ARIA, regex semantik, dan konteks label di sekitar input.
- Secara otomatis menghindari jebakan bot (honeypots).

DATA REALISTIS
- Kartu Kredit valid Luhn (Hanya untuk pengujian).
- NIK & NPWP Indonesia valid secara struktur (Fiktif).
- Nama, Alamat, dan Nomor Telepon lokal.

PRIVASI
- 100% Offline: Tanpa analytics, tanpa pelacakan data.
- Penyimpanan Lokal: Hanya menyimpan preferensi bahasa Anda.
```

---

## Permissions Rationale

**activeTab**
Used to run the filling engine on the current tab upon user request.

**scripting**
Allows the extension to inject the engine into the page when the popup or shortcut is used.

**storage**
Used only to persist the user's preferred language (en/id).

**Host permission (<all_urls>)**
Ensures the extension works on any domain where the user needs to test forms.
```
