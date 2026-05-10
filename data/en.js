// English language data pack
window.SmartFillerLanguageEN = (function () {
  const C = window.SmartFillerChecksums;
  const firstNames = [
    "James", "John", "Michael", "David", "Robert", "Mary", "Jennifer", "Linda", "Patricia", "Sarah", 
    "Emily", "Daniel", "Christopher", "Jessica", "Matthew", "William", "Elizabeth", "Thomas", "Barbara", 
    "Joseph", "Susan", "Charles", "Jessica", "George", "Karen", "Paul", "Nancy", "Mark", "Lisa"
  ];
  const lastNames = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", 
    "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young"
  ];
  const femaleNames = ["Mary", "Jennifer", "Linda", "Patricia", "Sarah", "Emily", "Jessica", "Elizabeth", "Barbara", "Susan", "Karen", "Nancy", "Lisa"];
  const cities = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Seattle", "Miami", "Denver", "Boston"];
  const states = [
    { name: "California", code: "CA" }, { name: "Texas", code: "TX" }, { name: "New York", code: "NY" },
    { name: "Florida", code: "FL" }, { name: "Illinois", code: "IL" }, { name: "Washington", code: "WA" },
    { name: "Georgia", code: "GA" }, { name: "Michigan", code: "MI" }, { name: "Ohio", code: "OH" }
  ];
  const streets = ["Main St", "Oak Ave", "Maple Dr", "Pine St", "Cedar Ln", "Elm St", "Park Ave", "Washington St", "Broad St", "Cherry Ln"];
  const companies = ["Acme Corp", "Globex Inc", "Initech LLC", "Umbrella Co", "Stark Industries", "Wayne Enterprises", "Cyberdyne Systems", "Hooli", "Siedel & Lutz"];
  const jobs = ["Software Engineer", "Product Manager", "Designer", "Data Analyst", "Marketing Lead", "Sales Manager", "Teacher", "Doctor", "Architect", "Consultant"];
  const domains = ["example.com", "mail.com", "test.com", "demo.org", "gmail.com", "outlook.com"];

  return {
    code: "en",
    country: "United States",
    countryCode: "US",
    generate() {
      const fn = C.pick(firstNames);
      const ln = C.pick(lastNames);
      const state = C.pick(states);
      const city = C.pick(cities);
      const street = `${C.num(100, 9999)} ${C.pick(streets)}`;
      const zip = String(C.num(10000, 99999));
      const phoneLocal = `${C.num(200, 999)}-${C.num(200, 999)}-${C.num(1000, 9999)}`;
      const phone = `+1 ${phoneLocal}`;
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${C.num(1, 999)}@${C.pick(domains)}`;
      const username = `${fn.toLowerCase()}${ln.toLowerCase()}${C.num(1, 999)}`;
      const birthYear = C.num(1970, 2005);
      const birthMonth = C.num(1, 12);
      const birthDay = C.num(1, 28);
      const gender = femaleNames.includes(fn) ? "Female" : "Male";

      return {
        firstName: fn,
        lastName: ln,
        middleName: C.pick(firstNames),
        fullName: `${fn} ${ln}`,
        motherName: `${C.pick(femaleNames)} ${C.pick(lastNames)}`,
        email,
        phone,
        phoneLocal,
        username,
        password: `Aa1!${username}${C.num(100, 999)}`,
        street,
        addressLine2: `Apt ${C.num(1, 999)}`,
        city,
        state: state.name,
        stateCode: state.code,
        zip,
        country: "United States",
        countryCode: "US",
        company: C.pick(companies),
        jobTitle: C.pick(jobs),
        birthDate: `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`,
        birthPlace: C.pick(cities),
        birthYear: String(birthYear),
        birthMonth: String(birthMonth).padStart(2, "0"),
        birthDay: String(birthDay).padStart(2, "0"),
        age: String(2026 - birthYear),
        gender,
        religion: C.pick(["Christianity", "Judaism", "Islam", "Buddhism", "Hinduism", "Atheist", "None"]),
        nationality: "American",
        maritalStatus: C.pick(["Single", "Married", "Divorced", "Widowed"]),
        idType: "SSN",
        education: C.pick(["High School", "Bachelor's", "Master's", "PhD"]),
        industry: C.pick(["Technology", "Finance", "Education", "Healthcare", "Manufacturing"]),
        workStartDate: `${C.num(2010, 2023)}-${String(C.num(1, 12)).padStart(2, '0')}-01`,
        creditCard: C.generateVisa(),
        cardExpiry: `${String(C.num(1, 12)).padStart(2, "0")}/${C.num(27, 32)}`,
        cardCVV: String(C.num(100, 999)),
        website: `https://www.${ln.toLowerCase()}.com`,
        bio: `Hi, I'm ${fn}. I work as a ${C.pick(jobs)} at ${C.pick(companies)}.`,
        nationalId: String(C.num(100000000, 999999999)),
        taxId: `${C.num(10, 99)}-${C.num(1000000, 9999999)}`,
        file: "dummy_document.pdf",
        salutation: femaleNames.includes(fn) ? C.pick(["Ms.", "Mrs.", "Miss"]) : C.pick(["Mr.", "Dr."]),
        monthlyIncome: String(C.num(3000, 15000)),
        yearlyIncome: String(C.num(40000, 200000)),
        contributionAmount: String(C.num(100, 1000)),
        accountYear: String(C.num(2000, 2024)),
        pensionAge: String(C.num(62, 70))
      };
    }
  };
})();
