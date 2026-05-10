// Indonesian language data pack
window.SmartFillerLanguageID = (function () {
  const C = window.SmartFillerChecksums;
  const firstNames = [
    "Budi", "Siti", "Andi", "Dewi", "Agus", "Rina", "Bambang", "Dian", "Eko", "Fitri", 
    "Hendra", "Indah", "Joko", "Kartika", "Lutfi", "Maya", "Nanda", "Putri", "Rizki", "Tono",
    "Ahmad", "Anisa", "Bayu", "Citra", "Doni", "Elisa", "Fajar", "Gita", "Hafiz", "Irma",
    "Kevin", "Laras", "Mulyadi", "Nina", "Oscar", "Pratiwi", "Qori", "Ratna", "Samsul", "Tanti"
  ];
  const femaleNames = [
    "Siti", "Dewi", "Rina", "Dian", "Fitri", "Indah", "Kartika", "Maya", "Putri", 
    "Anisa", "Citra", "Elisa", "Gita", "Irma", "Laras", "Nina", "Pratiwi", "Ratna", "Tanti"
  ];
  const lastNames = [
    "Santoso", "Wijaya", "Pratama", "Saputra", "Kusuma", "Hidayat", "Lestari", "Setiawan", "Nugroho", "Suryadi", 
    "Permana", "Wibowo", "Anwar", "Rahman", "Gunawan", "Siregar", "Nasution", "Lubis", "Pohan", "Sitorus",
    "Halim", "Tan", "Lim", "Sasmita", "Anggraini", "Purnama", "Kurniawan", "Sholeh", "Zulkarnain"
  ];
  const cities = [
    { name: "Jakarta", province: "DKI Jakarta", postal: "10110" },
    { name: "Bandung", province: "Jawa Barat", postal: "40111" },
    { name: "Surabaya", province: "Jawa Timur", postal: "60111" },
    { name: "Yogyakarta", province: "DI Yogyakarta", postal: "55111" },
    { name: "Semarang", province: "Jawa Tengah", postal: "50111" },
    { name: "Medan", province: "Sumatera Utara", postal: "20111" },
    { name: "Denpasar", province: "Bali", postal: "80111" },
    { name: "Makassar", province: "Sulawesi Selatan", postal: "90111" },
    { name: "Palembang", province: "Sumatera Selatan", postal: "30111" },
    { name: "Balikpapan", province: "Kalimantan Timur", postal: "76111" },
    { name: "Malang", province: "Jawa Timur", postal: "65111" },
    { name: "Bogor", province: "Jawa Barat", postal: "16111" }
  ];
  const streets = [
    "Jl. Sudirman", "Jl. Gatot Subroto", "Jl. Diponegoro", "Jl. Merdeka", "Jl. Pahlawan", 
    "Jl. Pemuda", "Jl. Asia Afrika", "Jl. Thamrin", "Jl. MH Thamrin", "Jl. Cendrawasih",
    "Jl. Kartini", "Jl. Imam Bonjol", "Jl. Gajah Mada", "Jl. Hayam Wuruk", "Jl. Rasuna Said"
  ];
  const companies = [
    "PT Maju Jaya", "PT Sinar Abadi", "CV Berkah Mandiri", "PT Karya Utama", "PT Cipta Kreasi", 
    "PT Bumi Sentosa", "PT Telkom Indonesia", "PT Bank Central Asia", "PT Pertamina", "PT Astra International"
  ];
  const jobs = [
    "Software Engineer", "Manajer Produk", "Desainer Grafis", "Analis Data", "Staf Pemasaran", 
    "Akuntan", "Konsultan", "Guru", "Dokter", "Arsitek", "Pengacara", "Wiraswasta"
  ];
  const domains = ["gmail.com", "yahoo.co.id", "mail.com", "outlook.com", "binus.ac.id", "ui.ac.id"];

  return {
    code: "id",
    country: "Indonesia",
    countryCode: "ID",
    generate() {
      const fn = C.pick(firstNames);
      const ln = C.pick(lastNames);
      const genderRaw = femaleNames.includes(fn) ? "Perempuan" : "Laki-laki";
      const city = C.pick(cities);
      const street = `${C.pick(streets)} No. ${C.num(1, 200)}`;
      const phoneLocal = C.generateIDPhone();
      const phone = `+62${phoneLocal.substring(1)}`;
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${C.num(1, 999)}@${C.pick(domains)}`;
      const username = `${fn.toLowerCase()}${C.num(1, 999)}`;
      const birthYear = C.num(1975, 2005);
      const birthMonth = C.num(1, 12);
      const birthDay = C.num(1, 28);
      const nik = C.generateNIK(city.province, genderRaw, birthDay, birthMonth, birthYear);

      return {
        firstName: fn,
        lastName: ln,
        middleName: C.pick(firstNames),
        fullName: `${fn} ${ln}`,
        motherName: `${C.pick(femaleNames)} ${C.pick(lastNames)}`,
        birthPlace: city.name,
        birthDate: `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`,
        religion: C.pick(["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Khonghucu"]),
        nationality: "Indonesia",
        gender: genderRaw === "Laki-laki" ? "Pria" : "Wanita",
        genderRaw, // for NIK generation and internal logic
        maritalStatus: C.pick(["Belum Kawin", "Kawin", "Cerai Hidup", "Cerai Mati"]),
        idType: "KTP",
        education: C.pick(["SMA", "D3", "S1", "S2", "S3"]),
        industry: C.pick(["Teknologi", "Keuangan", "Pendidikan", "Kesehatan", "Manufaktur", "Pariwisata"]),
        workStartDate: `${C.num(2010, 2023)}-${String(C.num(1, 12)).padStart(2, '0')}-01`,
        email,
        phone,
        phoneLocal,
        username,
        password: `Aa1!${username}${C.num(100, 999)}`,
        street,
        addressLine2: `RT ${C.num(1, 20)}/RW ${C.num(1, 15)}`,
        city: city.name,
        state: city.province,
        stateCode: city.province,
        province: city.province,
        zip: city.postal,
        country: "Indonesia",
        countryCode: "ID",
        company: C.pick(companies),
        jobTitle: C.pick(jobs),
        birthYear: String(birthYear),
        birthMonth: String(birthMonth).padStart(2, "0"),
        birthDay: String(birthDay).padStart(2, "0"),
        age: String(2026 - birthYear),
        creditCard: C.generateVisa(),
        cardExpiry: `${String(C.num(1, 12)).padStart(2, "0")}/${C.num(27, 32)}`,
        cardCVV: String(C.num(100, 999)),
        website: `https://www.${ln.toLowerCase()}.co.id`,
        bio: `Halo, saya ${fn}. Saya bekerja sebagai ${C.pick(jobs)} di ${C.pick(companies)}.`,
        nationalId: nik,
        nik,
        taxId: C.generateNPWP(),
        file: "dummy_document.pdf",
        salutation: femaleNames.includes(fn) ? C.pick(["Ibu", "Nyonya", "Nona"]) : C.pick(["Bapak", "Tuan"]),
        monthlyIncome: String(C.num(5, 50) * 1000000),
        yearlyIncome: String(C.num(60, 600) * 1000000),
        contributionAmount: String(C.num(100, 1000) * 1000),
        accountYear: String(C.num(2000, 2024)),
        pensionAge: String(C.num(55, 65))
      };
    }
  };
})();
