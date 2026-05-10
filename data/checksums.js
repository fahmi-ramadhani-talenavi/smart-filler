// Checksum & format validators / generators
// Used by locale data packs to produce values that pass real validation.
window.SmartFillerChecksums = (function () {
  const num = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Luhn check digit append. Pass first N-1 digits, get N-digit valid number.
  const luhnAppend = (partial) => {
    const arr = partial.split("").map(Number);
    let sum = 0;
    let toggle = true;
    for (let i = arr.length - 1; i >= 0; i--) {
      let d = arr[i];
      if (toggle) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      toggle = !toggle;
    }
    const check = (10 - (sum % 10)) % 10;
    return partial + check;
  };

  // Generate Luhn-valid Visa (16 digit, starts with 4)
  const generateVisa = () => {
    let body = "4";
    for (let i = 0; i < 14; i++) body += num(0, 9);
    return luhnAppend(body);
  };

  // Generate Luhn-valid Mastercard (16 digit, starts 51-55)
  const generateMastercard = () => {
    let body = "5" + num(1, 5);
    for (let i = 0; i < 13; i++) body += num(0, 9);
    return luhnAppend(body);
  };

  // Indonesian NIK: 16 digits = PPKKCC + DDMMYY + GGGG
  // PP = province code, KK = kabupaten/kota, CC = kecamatan
  // For women: DD + 40 (so DD ranges 41-71)
  // Real province codes (BPS):
  const REGION_CODES = {
    "DKI Jakarta":       { province: "31", samples: ["3171", "3172", "3173", "3174", "3175"] },
    "Jawa Barat":        { province: "32", samples: ["3273", "3275", "3276", "3277", "3278"] },
    "Jawa Tengah":       { province: "33", samples: ["3374", "3373", "3375"] },
    "DI Yogyakarta":     { province: "34", samples: ["3471", "3404"] },
    "Jawa Timur":        { province: "35", samples: ["3578", "3573", "3574"] },
    "Sumatera Utara":    { province: "12", samples: ["1271", "1273"] },
    "Bali":              { province: "51", samples: ["5171"] },
    "Sulawesi Selatan":  { province: "73", samples: ["7371"] }
  };

  const generateNIK = (provinceName, gender, birthDay, birthMonth, birthYear) => {
    const region = REGION_CODES[provinceName] || { province: "31", samples: ["3171"] };
    const kabKecBase = pick(region.samples); // 4 digits
    const kec = String(num(1, 99)).padStart(2, "0");
    const regionPart = (kabKecBase + kec).padEnd(6, "0").slice(0, 6);

    let dd = parseInt(birthDay, 10);
    if (gender === "Perempuan") dd += 40;
    const ddStr = String(dd).padStart(2, "0");
    const mmStr = String(birthMonth).padStart(2, "0");
    const yyStr = String(birthYear).slice(-2);
    const serial = String(num(1, 9999)).padStart(4, "0");
    return regionPart + ddStr + mmStr + yyStr + serial;
  };

  // Indonesian phone: real operator prefixes, then 8 digits
  const ID_PHONE_PREFIXES = [
    "0811", "0812", "0813", "0821", "0822", "0823", "0851", "0852", "0853", // Telkomsel
    "0814", "0815", "0816", "0855", "0856", "0857", "0858",                 // Indosat
    "0817", "0818", "0819", "0859", "0877", "0878",                         // XL
    "0895", "0896", "0897", "0898", "0899",                                 // Tri
    "0881", "0882", "0883", "0884", "0885", "0886", "0887", "0888", "0889"  // Smartfren
  ];
  const generateIDPhone = () => {
    const prefix = pick(ID_PHONE_PREFIXES);
    let rest = "";
    for (let i = 0; i < 8; i++) rest += num(0, 9);
    return prefix + rest;
  };

  // NPWP format: XX.XXX.XXX.X-XXX.XXX (15 digits, but checksum complex; format valid is enough for most forms)
  const generateNPWP = () => {
    const d = (n) => String(num(0, Math.pow(10, n) - 1)).padStart(n, "0");
    return `${d(2)}.${d(3)}.${d(3)}.${num(1, 9)}-${d(3)}.${d(3)}`;
  };

  return {
    luhnAppend,
    generateVisa,
    generateMastercard,
    generateNIK,
    generateIDPhone,
    generateNPWP,
    pick,
    num
  };
})();
