// NLP text normalisation for VAANI's spoken voice.
// Optimized for rural Indian citizens, farmers, women self-help groups, and rural youth.
// Converts numbers, currencies, dates, helpline numbers, land units, and complex acronyms into
// natural, easy-to-understand spoken words in Marathi, Hindi, and Indian English.

const DEVANAGARI_DIGITS = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9"
};

// Hindi / Marathi number words for 0-100
const MR_UNITS = [
  "शून्य", "एक", "दोन", "तीन", "चार", "पाच", "सहा", "सात", "आठ", "नऊ", "दहा",
  "अकरा", "बारा", "तेरा", "चौदा", "पंधरा", "सोळा", "सतरा", "अठरा", "एकोणीस", "वीस",
  "एकवीस", "बावीस", "तेवीस", "चोवीस", "पंचवीस", "सव्वीस", "सत्तावीस", "अठ्ठावीस", "एकोणतीस", "तीस",
  "एकतीस", "बत्तीस", "तेहतीस", "चौतीस", "पस्तीस", "छत्तीस", "सदतीस", "अडतीस", "एकेचाळीस", "चाळीस",
  "एक्केचाळीस", "बेचाळीस", "त्रेचाळीस", "चव्वेचाळीस", "पंचेचाळीस", "शेचाळीस", "सत्तेचाळीस", "अठ्ठेचाळीस", "एकोणपन्नास", "पन्नास",
  "एकावन्न", "बावन्न", "त्रेपन्न", "चोपन्न", "पंचावन्न", "छप्पन्न", "सत्तावन्न", "अठ्ठावन्न", "एकोणसाठ", "साठ",
  "एकसष्ठ", "बासष्ठ", "त्रेसष्ठ", "चौसष्ठ", "पासष्ठ", "सहासष्ठ", "सदुसष्ठ", "अडुसष्ठ", "एकोणसत्तर", "सत्तर",
  "एकाहत्तर", "बाहत्तर", "त्र्याहत्तर", "चौऱ्याहत्तर", "पंच्याहत्तर", "शहात्तर", "सत्याहत्तर", "अठ्ठ्याहत्तर", "एकोणऐंशी", "ऐंशी",
  "एक्यांशी", "ब्यांशी", "त्र्यांशी", "चौऱ्यांशी", "पंच्यांशी", "शहांशी", "सत्यांशी", "अठ्ठ्यांशी", "एकोणनव्वद", "नव्वद",
  "एक्याण्णव", "ब्याण्णव", "त्र्याण्णव", "चौऱ्याण्णव", "पंच्याण्णव", "शहाण्णव", "सत्त्याण्णव", "अठ्ठ्याण्णव", "नव्व्याण्णव", "शंभर"
];

const HI_UNITS = [
  "शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ", "दस",
  "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अठारह", "उन्नीस", "बीस",
  "इक्कीस", "बाईस", "तेईस", "चौबीस", "पच्चीस", "छब्बीस", "सत्ताईस", "अट्ठाईस", "उनतीस", "तीस",
  "इकत्तीस", "बत्तीस", "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अड़तीस", "उनतालीस", "चालीस",
  "इकतालीस", "बयालीस", "तैंतालीस", "चवालीस", "पैंतालीस", "छियालीस", "सैंतालीस", "अड़तालीस", "उनचास", "पचास",
  "इक्यावन", "बावन", "तिरेपन", "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन", "उनसठ", "साठ",
  "इकसठ", "बासठ", "तिरसठ", "चौंसठ", "पैंसठ", "छियासठ", "सरसठ", "अड़सठ", "उनहत्तर", "सत्तर",
  "इकहत्तर", "बहत्तर", "तिहत्तर", "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर", "उन्नासी", "अस्सी",
  "इक्यासी", "बयासी", "तिरासी", "चौरासी", "पचासी", "छियासी", "सत्तासी", "अठासी", "नवासी", "नब्बे",
  "इक्यानवे", "बानवे", "तिरानवे", "चौरानवे", "पंचानवे", "छियानवे", "सत्तानवे", "अट्ठानवे", "निन्यानवे", "एक सौ"
];

const EN_UNITS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"
];

const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/**
 * Converts a numeric string (e.g. "6000", "2000", "50000") to spoken words for rural clarity.
 */
export function numberToSpokenWords(numStr, lang = "en") {
  const clean = String(numStr).replace(/,/g, "").trim();
  const n = parseInt(clean, 10);
  if (isNaN(n)) return numStr;

  if (lang === "mr") {
    if (n === 0) return "शून्य";
    if (n <= 100) return MR_UNITS[n] || String(n);
    if (n === 200) return "दोनशे";
    if (n === 300) return "तीनशे";
    if (n === 400) return "चारशे";
    if (n === 500) return "पाचशे";
    if (n === 1000) return "एक हजार";
    if (n === 2000) return "दोन हजार";
    if (n === 5000) return "पाच हजार";
    if (n === 6000) return "सहा हजार";
    if (n >= 100 && n < 1000) {
      const hundreds = Math.floor(n / 100);
      const rem = n % 100;
      const hWord = hundreds === 1 ? "एकशे" : hundreds === 2 ? "दोनशे" : hundreds === 5 ? "पाचशे" : `${MR_UNITS[hundreds] || hundreds}शे`;
      return rem === 0 ? hWord : `${hWord} ${MR_UNITS[rem] || rem}`;
    }
    if (n >= 1000 && n < 100000) {
      const thousands = Math.floor(n / 1000);
      const rem = n % 1000;
      const thWord = MR_UNITS[thousands] || String(thousands);
      if (rem === 0) return `${thWord} हजार`;
      if (rem === 500) return `${thWord} हजार पाचशे`;
      return `${thWord} हजार ${numberToSpokenWords(rem, "mr")}`;
    }
    if (n >= 100000 && n < 10000000) {
      const lakhs = Math.floor(n / 100000);
      const rem = n % 100000;
      const lkWord = MR_UNITS[lakhs] || String(lakhs);
      if (rem === 0) return `${lkWord} लाख`;
      return `${lkWord} लाख ${numberToSpokenWords(rem, "mr")}`;
    }
    if (n >= 10000000) {
      const cr = Math.floor(n / 10000000);
      const rem = n % 10000000;
      const crWord = MR_UNITS[cr] || cr;
      if (rem === 0) return `${crWord} कोटी`;
      return `${crWord} कोटी ${numberToSpokenWords(rem, "mr")}`;
    }
    return String(n);
  }

  if (lang === "hi") {
    if (n === 0) return "शून्य";
    if (n <= 100) return HI_UNITS[n] || String(n);
    if (n === 200) return "दो सौ";
    if (n === 300) return "तीन सौ";
    if (n === 400) return "चार सौ";
    if (n === 500) return "पाँच सौ";
    if (n === 1000) return "एक हज़ार";
    if (n === 2000) return "दो हज़ार";
    if (n === 5000) return "पाँच हज़ार";
    if (n === 6000) return "छह हज़ार";
    if (n >= 100 && n < 1000) {
      const hundreds = Math.floor(n / 100);
      const rem = n % 100;
      const hWord = hundreds === 1 ? "एक सौ" : `${HI_UNITS[hundreds] || hundreds} सौ`;
      return rem === 0 ? hWord : `${hWord} ${HI_UNITS[rem] || rem}`;
    }
    if (n >= 1000 && n < 100000) {
      const thousands = Math.floor(n / 1000);
      const rem = n % 1000;
      const thWord = HI_UNITS[thousands] || String(thousands);
      if (rem === 0) return `${thWord} हज़ार`;
      if (rem === 500) return `${thWord} हज़ार पाँच सौ`;
      return `${thWord} हज़ार ${numberToSpokenWords(rem, "hi")}`;
    }
    if (n >= 100000 && n < 10000000) {
      const lakhs = Math.floor(n / 100000);
      const rem = n % 100000;
      const lkWord = HI_UNITS[lakhs] || String(lakhs);
      if (rem === 0) return `${lkWord} लाख`;
      return `${lkWord} लाख ${numberToSpokenWords(rem, "hi")}`;
    }
    if (n >= 10000000) {
      const cr = Math.floor(n / 10000000);
      const rem = n % 10000000;
      const crWord = HI_UNITS[cr] || cr;
      if (rem === 0) return `${crWord} करोड़`;
      return `${crWord} करोड़ ${numberToSpokenWords(rem, "hi")}`;
    }
    return String(n);
  }

  // English
  if (n <= 20) return EN_UNITS[n] || String(n);
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? EN_TENS[t] : `${EN_TENS[t]} ${EN_UNITS[u]}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    return rem === 0 ? `${EN_UNITS[h]} hundred` : `${EN_UNITS[h]} hundred ${numberToSpokenWords(rem, "en")}`;
  }
  if (n >= 1000 && n < 100000) {
    const th = Math.floor(n / 1000);
    const rem = n % 1000;
    if (rem === 0) return `${numberToSpokenWords(th, "en")} thousand`;
    return `${numberToSpokenWords(th, "en")} thousand ${numberToSpokenWords(rem, "en")}`;
  }
  if (n >= 100000) {
    const lk = Math.floor(n / 100000);
    const rem = n % 100000;
    if (rem === 0) return `${numberToSpokenWords(lk, "en")} lakh`;
    return `${numberToSpokenWords(lk, "en")} lakh ${numberToSpokenWords(rem, "en")}`;
  }
  return String(n);
}

// Spoken expansions for rural government acronyms by language
const RURAL_TERMS_MR = [
  [/\bPM-?KISAN\b/gi, "पीएम किसान सन्मान निधी योजना"],
  [/\bPMFBY\b/gi, "पंतप्रधान पीक विमा योजना"],
  [/\bKCC\b/gi, "किसान क्रेडिट कार्ड"],
  [/\bPACS\b/gi, "पॅक्स सोसायटी"],
  [/\bDBT\b/gi, "थेट बँक खात्यात पैसे (डीबीटी)"],
  [/\be-?KYC\b/gi, "ई केवायसी पडताळणी"],
  [/\bSHG\b/gi, "महिला बचत गट"],
  [/\bCSC\b/gi, "आपले सरकार सेवा केंद्र"],
  [/\bMSP\b/gi, "हमीभाव"],
  [/\bFPO\b/gi, "शेतकरी उत्पादक कंपनी"],
  [/\bMGNREGA\b/gi, "मनरेगा रोजगार योजना"],
  [/\bNABARD\b/gi, "नाबार्ड बँक"],
  [/\bUPI\b/gi, "यूपीआय"],
  [/\bAPMC\b/gi, "कृषी उत्पन्न बाजार समिती (मार्केट यार्ड)"],
  [/\bPMAY(-G)?\b/gi, "प्रधानमंत्री आवास योजना ग्रामीण"],
  [/\bABHA\b/gi, "आभा डिजिटल हेल्थ कार्ड"],
  [/\bPMJAY|PM-JAY\b/gi, "आयुष्मान भारत योजना"],
  [/\b7\s?[\/\\]\s?12\b/gi, "सात बारा उतारा"],
  [/\b8\s?-?A\b|\b8\s?अ\b/gi, "आठ अ नोंदवही"],
  [/\bha\b|\bhectare\b/gi, "हेक्टर"],
  [/\bAcre\b/gi, "एकर"],
  [/\bGuntha\b/gi, "गुंठा"],
  [/\bKisan\b/gi, "शेतकरी"],
];

const RURAL_TERMS_HI = [
  [/\bPM-?KISAN\b/gi, "पीएम किसान सम्मान निधि योजना"],
  [/\bPMFBY\b/gi, "प्रधानमंत्री फसल बीमा योजना"],
  [/\bKCC\b/gi, "किसान क्रेडिट कार्ड"],
  [/\bPACS\b/gi, "पैक्स सहकारी समिति"],
  [/\bDBT\b/gi, "प्रत्यक्ष लाभ अंतरण डीबीटी"],
  [/\be-?KYC\b/gi, "ई केवाईसी सत्यापन"],
  [/\bSHG\b/gi, "महिला स्वयं सहायता समूह"],
  [/\bCSC\b/gi, "सीएससी जन सेवा केंद्र"],
  [/\bMSP\b/gi, "न्यूनतम समर्थन मूल्य"],
  [/\bFPO\b/gi, "किसान उत्पादक संगठन"],
  [/\bMGNREGA\b/gi, "मनरेगा रोजगार योजना"],
  [/\bNABARD\b/gi, "नाबार्ड बैंक"],
  [/\bUPI\b/gi, "यूपीआई"],
  [/\bAPMC\b/gi, "कृषि उपज मंडी"],
  [/\bPMAY(-G)?\b/gi, "प्रधानमंत्री आवास योजना ग्रामीण"],
  [/\bABHA\b/gi, "आभा हेल्थ आईडी कार्ड"],
  [/\bPMJAY|PM-JAY\b/gi, "आयुष्मान भारत योजना"],
  [/\bha\b|\bhectare\b/gi, "हेक्टेयर"],
  [/\bAcre\b/gi, "एकड़"],
  [/\bBigha\b/gi, "बीघा"],
];

const RURAL_TERMS_EN = [
  [/\bPM-?KISAN\b/gi, "P M Kisan scheme"],
  [/\bPMFBY\b/gi, "P M Crop Insurance scheme"],
  [/\bKCC\b/gi, "Kisan Credit Card"],
  [/\bPACS\b/gi, "PACS village cooperative"],
  [/\bDBT\b/gi, "Direct Bank Transfer"],
  [/\be-?KYC\b/gi, "e-K Y C biometric verification"],
  [/\bSHG\b/gi, "Women Self Help Group"],
  [/\bCSC\b/gi, "Common Service Center"],
  [/\bMSP\b/gi, "Minimum Support Price"],
  [/\bFPO\b/gi, "Farmer Producer Organization"],
  [/\bMGNREGA\b/gi, "MGNREGA employment scheme"],
  [/\bABHA\b/gi, "ABHA health ID card"],
  [/\bPM-?JAY\b/gi, "Ayushman Bharat scheme"],
  [/\be\.g\./gi, "for example"],
  [/\bi\.e\./gi, "that is"],
  [/\betc\.?/gi, "and so on"],
  [/\bgovt\.?/gi, "government"],
  [/\bapprox\.?/gi, "approximately"],
  [/\bNo\.\s?/g, "number "],
  [/\bvs\.?/gi, "versus"],
];

/**
 * Phonetic Normalizer:
 * Cleans text for high-intelligibility audio speech synthesis.
 */
export function speechNormalize(text = "", lang = "en") {
  if (!text || typeof text !== "string") return "";
  let s = text;

  // 1. Convert Devanagari numerals to standard digits first for uniform parsing
  s = s.replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] || d);

  // 2. Strip code snippets, urls, citations, markdown artifacts
  s = s.replace(/https?:\/\/\S+/gi, ""); // Remove raw URLs
  s = s.replace(/```[\s\S]*?```/g, ""); // Remove code blocks
  s = s.replace(/`([^`]+)`/g, "$1"); // Inline code
  s = s.replace(/\[\d+\]/g, ""); // Strip [1], [2] citations
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // Markdown links [text](url) -> text
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1"); // Bold
  s = s.replace(/\*([^*]+)\*/g, "$1"); // Italic
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  s = s.replace(/^#+\s+/gm, ""); // Headings
  s = s.replace(/^\s*[-*•]\s+/gm, ", "); // Bullets to pauses
  s = s.replace(/^\s*\d+[.)]\s+/gm, (m) => `, मुद्दा क्रमांक ${m.trim()} `); // Numbered lists to pauses
  s = s.replace(/[>|~]/g, ""); // Blockquotes and tables

  // 3. Normalize Currency: ₹6,000 / Rs 2000 -> spoken words
  s = s.replace(/(?:Rs\.?|₹|INR)\s?([\d,]+(?:\.\d+)?)/gi, (_, amount) => {
    const words = numberToSpokenWords(amount, lang);
    if (lang === "mr") return `${words} रुपये`;
    if (lang === "hi") return `${words} रुपये`;
    return `${words} rupees`;
  });

  // 4. Normalize percentages: 4% -> 4 टक्के / प्रतिशत
  s = s.replace(/(\d+)\s?%/g, (_, num) => {
    const words = numberToSpokenWords(num, lang);
    if (lang === "mr") return `${words} टक्के`;
    if (lang === "hi") return `${words} प्रतिशत`;
    return `${words} percent`;
  });

  // 5. Expand rural scheme acronyms and terms
  if (lang === "mr") {
    for (const [re, rep] of RURAL_TERMS_MR) s = s.replace(re, rep);
  } else if (lang === "hi") {
    for (const [re, rep] of RURAL_TERMS_HI) s = s.replace(re, rep);
  } else {
    for (const [re, rep] of RURAL_TERMS_EN) s = s.replace(re, rep);
  }

  // 6. Convert prominent numbers (e.g. 6000, 2000, 500, 3) to natural words if isolated
  s = s.replace(/\b(\d{1,6})\b/g, (match) => {
    const num = parseInt(match, 10);
    // Convert common round numbers and small numbers for natural speech
    if (num <= 100 || num === 500 || num === 1000 || num === 2000 || num === 3000 || num === 5000 || num === 6000 || num === 10000 || num === 50000) {
      return numberToSpokenWords(match, lang);
    }
    return match;
  });

  // 7. Insert natural breath pauses before major conjunctions
  if (lang === "mr") {
    s = s.replace(/\s+(आणि|तसेच|म्हणून|परंतु|तथापि|व)\s+/g, ", $1 ");
  } else if (lang === "hi") {
    s = s.replace(/\s+(और|तथा|एवं|लेकिन|किंतु|परंतु|इसलिए)\s+/g, ", $1 ");
  }

  // 8. Clean up whitespace and punctuation
  s = s.replace(/\s*—\s*/g, ", ").replace(/\s*–\s*/g, ", ");
  s = s.replace(/\s{2,}/g, " ");
  s = s.replace(/\s+([.,!?।])/g, "$1");
  s = s.replace(/(,\s*){2,}/g, ", ");
  s = s.replace(/[^\S\r\n]+/g, " ");

  return s.trim();
}

/**
 * Splits normalized text into discrete, easily spoken sentences.
 */
export function extractSpokenSentences(text = "") {
  if (!text) return [];
  return text
    .split(/(?<=[.!?।\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Word list used for visual progress / highlight sync
export function speechWords(normalized) {
  return normalized.split(/\s+/).filter(Boolean);
}

// ---------------- RURAL NLU & INTENT ENGINE ----------------

export const RURAL_INTENT_CATEGORIES = [
  {
    id: "crop_insurance",
    name: "Crop Insurance & Damage (पीक विमा व नुकसान)",
    keywords: ["विमा", "नुकसान", "पीक नुकसान", "पाऊस", "गारपीट", "दुष्काळ", "कीड", "इन्शुरन्स", "claim", "damage", "pmfby", "crop loss"],
    domain: "insurance",
    urgencyDefault: "high",
    color: "amber",
  },
  {
    id: "pm_kisan",
    name: "PM-Kisan & Direct DBT (पीएम किसान सन्मान निधी)",
    keywords: ["पीएम किसान", "pm kisan", "हप्ता", "installment", "२ हजार", "2000", "खात्यात पैसे", "dbt", "सन्मान निधी", "kyc", "केवायसी"],
    domain: "dbt",
    urgencyDefault: "medium",
    color: "emerald",
  },
  {
    id: "land_records",
    name: "Land Records & 7/12 (सातबारा व महसूल नोंदणी)",
    keywords: ["सातबारा", "७/१२", "8a", "८-अ", "उतारा", "फेरफार", "जमीन", "खाते", "satbara", "land record", "mutations"],
    domain: "land",
    urgencyDefault: "medium",
    color: "blue",
  },
  {
    id: "shg_women",
    name: "Women SHG & Livelihood (महिला बचत गट व उपजीविका)",
    keywords: ["बचत गट", "महिला बचत गट", "shg", "कर्ज", "उमेद", "लाडकी बहीण", "स्वयं सहायता", "subsidy", "women loan"],
    domain: "schemes",
    urgencyDefault: "medium",
    color: "rose",
  },
  {
    id: "kcc_loan",
    name: "KCC & Agri Credit (किसान क्रेडिट कार्ड व पीक कर्ज)",
    keywords: ["केसीसी", "kcc", "पीक कर्ज", "बँक कर्ज", "व्याज सवलत", "crop loan", "kisan credit card", "nabard"],
    domain: "finance",
    urgencyDefault: "medium",
    color: "indigo",
  },
  {
    id: "solar_pump",
    name: "Solar Pump & Irrigation (सौर कृषी पंप व सिंचन)",
    keywords: ["कुसुम", "kusum", "सौर कृषी पंप", "सोलर", "ठिबक", "तुषार", "विहीर", "drip irrigation", "solar pump"],
    domain: "agriculture",
    urgencyDefault: "medium",
    color: "sky",
  },
  {
    id: "mandi_rates",
    name: "Mandi & MSP Rates (बाजारभाव व हमीभाव)",
    keywords: ["बाजारभाव", "हमीभाव", "msp", "कापूस भाव", "सोयाबीन भाव", "मार्केट यार्ड", "apmc", "mandi rate", "market price"],
    domain: "market",
    urgencyDefault: "low",
    color: "teal",
  },
  {
    id: "healthcare",
    name: "Ayushman & Health (आयुष्मान भारत व आभा कार्ड)",
    keywords: ["आयुष्मान", "आभा", "आरोग्य", "कार्ड", "रुग्णालय", "उपचार", "ayushman", "abha", "pmjay", "hospital"],
    domain: "health",
    urgencyDefault: "high",
    color: "red",
  },
  {
    id: "housing_pmay",
    name: "PMAY Rural Housing (घरकुल आवास योजना)",
    keywords: ["घरकुल", "आवास योजना", "pmay", "घर", "अनुदान", "housing scheme", "gramin"],
    domain: "welfare",
    urgencyDefault: "medium",
    color: "purple",
  }
];

export const NLP_PROMPT_PRESETS = [
  {
    title: "Cotton Crop Damage Claim",
    lang: "mr",
    text: "माझं नाव शांताराम पाटील. माझ्या २ एकर शेतातील कापूस पीक अतिवृष्टीने १००% नुकसान झाले. मला पीएम पीक विमा भरपाई कशी मिळेल?",
    category: "Crop Insurance",
  },
  {
    title: "PM-KISAN DBT Check",
    lang: "hi",
    text: "मेरा आधार नंबर 4521 8920 1192 है। मुझे पीएम किसान सम्मान निधि की 17वीं किस्त ₹2,000 का पैसा अभी तक बैंक खाते में नहीं आया।",
    category: "Direct Benefit",
  },
  {
    title: "Women SHG Loan Subsidy",
    lang: "mr",
    text: "आमच्या जय भवानी महिला बचत गटाला शेळीपालन व्यवसायासाठी ₹५०,००० चे अनुदानित बँक कर्ज हवे आहे. अर्ज कसा करावा?",
    category: "Women & SHG",
  },
  {
    title: "Land 7/12 Extract Verification",
    lang: "mr",
    text: "माझ्या शेताचा गट नंबर ३४/२ असून ३ हेक्टर जमिनीचा डिजिटल स्वाक्षरी असलेला सातबारा उतारा कसा काढायचा?",
    category: "Land Records",
  },
  {
    title: "Solar Pump Kusum Subsidy",
    lang: "en",
    text: "How do I apply for 5 HP solar agricultural pump under PM KUSUM scheme with 90% government subsidy?",
    category: "Solar Energy",
  },
  {
    title: "Ayushman Free Hospitalization",
    lang: "hi",
    text: "आयुष्मान भारत योजना के तहत ₹5,00,000 तक का मुफ्त इलाज कौन-कौन से सरकारी और प्राइवेट अस्पताल में मिलेगा?",
    category: "Healthcare",
  }
];

/**
 * High-speed local NLP query analyzer (Offline / Instant fallback)
 */
export function analyzeClientNLP(query = "", lang = "en") {
  if (!query || typeof query !== "string") {
    return {
      query: "",
      language: lang,
      intent: { id: "general", name: "General Inquiry", confidence: 0.5, domain: "faq" },
      entities: [],
      sentiment: { polarity: "neutral", urgency: "low", score: 0, distressSignal: false },
      speechNormalization: { rawText: "", spokenText: "", transformations: [] },
      summary: [],
      suggestedFollowUps: [],
    };
  }

  const qLower = query.toLowerCase();

  // 1. Intent Detection
  let bestIntent = null;
  let maxScore = 0;

  for (const cat of RURAL_INTENT_CATEGORIES) {
    let score = 0;
    for (const kw of cat.keywords) {
      if (qLower.includes(kw.toLowerCase())) {
        score += 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestIntent = cat;
    }
  }

  const intent = bestIntent
    ? {
        id: bestIntent.id,
        name: bestIntent.name,
        confidence: Math.min(0.96, 0.65 + maxScore * 0.12),
        domain: bestIntent.domain,
        color: bestIntent.color,
      }
    : {
        id: "general",
        name: "General Governance & Civic Inquiry",
        confidence: 0.52,
        domain: "faq",
        color: "stone",
      };

  // 2. Named Entity Extraction (NER)
  const entities = [];

  // Person names with common Marathi / Hindi salutations / prefixes
  const nameMatch = query.match(/(?:नाव|नाम|name\s+is)\s+([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)/i);
  if (nameMatch && nameMatch[1]) {
    entities.push({
      type: "person",
      label: "Citizen Name",
      value: nameMatch[1].trim(),
      confidence: 0.95,
    });
  }

  // Land Holding
  const landMatch = query.match(/(\d+(?:\.\d+)?)\s*(हेक्टर|एकर|गुंठे|गुंठा|बीघा|hectare|hectares|acre|acres|guntha|bigha)/i);
  if (landMatch) {
    entities.push({
      type: "land_size",
      label: "Land Holding",
      value: landMatch[0],
      normalized: `${landMatch[1]} ${landMatch[2]}`,
      confidence: 0.96,
    });
  }

  // Survey / 7/12 / Gat number
  const surveyMatch = query.match(/(?:गट\s*(?:नं|क्रमांक|number)|सर्व्हे\s*(?:नं|क्रमांक)|७\/१२|7\/12|survey\s*no\.?)\s*[:=]?\s*([0-9\/\-]+)/i);
  if (surveyMatch && surveyMatch[1]) {
    entities.push({
      type: "id_number",
      label: "Land Gat / Survey Number",
      value: surveyMatch[0],
      normalized: surveyMatch[1],
      confidence: 0.98,
    });
  }

  // Aadhaar ID
  const aadhaarMatch = query.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
  if (aadhaarMatch) {
    entities.push({
      type: "id_number",
      label: "Aadhaar Number",
      value: aadhaarMatch[0],
      normalized: "12-digit UID",
      confidence: 0.99,
    });
  }

  // Crops
  const cropList = [
    { name: "कापूस (Cotton)", keys: ["कापूस", "cotton", "कपास"] },
    { name: "सोयाबीन (Soybean)", keys: ["सोयाबीन", "soybean", "soya"] },
    { name: "तूर / डाळ (Pigeon Pea)", keys: ["तूर", "तुरी", "arhar", "tur"] },
    { name: "ऊस (Sugarcane)", keys: ["ऊस", "sugarcane", "गन्ना"] },
    { name: "कांदा (Onion)", keys: ["कांदा", "onion", "प्याज़"] },
    { name: "गहू (Wheat)", keys: ["गहू", "wheat", "गेहूं"] },
    { name: "भात / तांदूळ (Paddy)", keys: ["भात", "तांदूळ", "rice", "paddy", "धान"] },
  ];

  for (const c of cropList) {
    if (c.keys.some((k) => qLower.includes(k))) {
      entities.push({
        type: "crop",
        label: "Crop Type",
        value: c.name,
        confidence: 0.94,
      });
    }
  }

  // Amounts / Grants
  const amountMatch = query.match(/(?:₹|Rs\.?|INR)?\s*([०-९\d]{1,3}(?:,[०-९\d]{3})*|[०-९\d]+)\s*(?:रु|रुपये|rupees|हजार|लाख|k)?/i);
  if (amountMatch && amountMatch[1] && !landMatch?.[0].includes(amountMatch[0])) {
    const rawVal = amountMatch[0].trim();
    if (rawVal.length > 1 && !/^\d$/.test(rawVal)) {
      entities.push({
        type: "amount",
        label: "Amount / Grant",
        value: rawVal,
        confidence: 0.9,
      });
    }
  }

  // 3. Distress & Sentiment
  const distressKeywords = [
    "नुकसान", "पिकं जळाली", "पाऊस नाही", "दुष्काळ", "गारपीट", "कीड पडली", "कर्जबाजारी",
    "आत्महत्या", "मदत नाही", "फसगत", "तक्रार", "damage", "crop lost", "drought", "infestation", "flood", "पूर", "बुडाले"
  ];
  const isDistressed = distressKeywords.some((d) => qLower.includes(d.toLowerCase()));

  let polarity = isDistressed ? "distressed" : qLower.includes("धन्यवाद") || qLower.includes("thank") ? "positive" : "neutral";
  let urgency = isDistressed ? (qLower.includes("तातडीने") || qLower.includes("urgent") ? "critical" : "high") : "medium";
  let score = isDistressed ? -0.85 : polarity === "positive" ? 0.8 : 0.0;

  // 4. Speech Normalization & Diff
  const spokenText = speechNormalize(query, lang);
  const transformations = [];

  if (spokenText !== query) {
    if (/₹|\bRs\.?\b/i.test(query)) {
      transformations.push({ original: "₹ / Rs.", spoken: lang === "mr" || lang === "hi" ? "रुपये" : "Rupees", rule: "Currency Expansion" });
    }
    if (/\b\d{1,6}\b/.test(query)) {
      transformations.push({ original: "Numeric Digits", spoken: "Phonetic Number Words", rule: "Devanagari / English Numeral Reading" });
    }
    if (/PM-?KISAN/i.test(query)) {
      transformations.push({ original: "PM-KISAN", spoken: "पीएम किसान सन्मान निधी योजना", rule: "Government Scheme Vernacular Expansion" });
    }
    if (/7\s?[\/\\]\s?12/i.test(query)) {
      transformations.push({ original: "7/12", spoken: "सात बारा उतारा", rule: "Land Revenue Record Pronunciation" });
    }
  }

  // 5. Action Summary
  const summary = [
    `Intent: ${intent.name}`,
    `Found ${entities.length} verified rural parameters (e.g. ${entities.map((e) => e.label).join(", ") || "General"})`,
    `Sentiment Status: ${polarity.toUpperCase()} (${urgency.toUpperCase()} priority)`,
  ];

  const suggestedFollowUps = [];
  if (intent.id === "crop_insurance") {
    suggestedFollowUps.push("ई-पंचनामा आणि महसूल अहवाल कसा मिळवायचा?");
    suggestedFollowUps.push("७२ तासांच्या आत विमा कंपनीकडे ऑनलाइन पूर्वसूचना कशी नोंदवावी?");
  } else if (intent.id === "pm_kisan") {
    suggestedFollowUps.push("माझे आधार बँक खात्याशी NPCI DBT लिंक आहे का ते कसे तपासावे?");
    suggestedFollowUps.push("पीएम किसान पोर्टलवर ई-केवायसी (e-KYC) ऑनलाइन कसे करावे?");
  } else if (intent.id === "land_records") {
    suggestedFollowUps.push("डिजिटल स्वाक्षरीत ७/१२ महाभूमी पोर्टलवरून विनामूल्य कसा डाउनलोड करावा?");
  } else {
    suggestedFollowUps.push("या योजनेसाठी लागणारी आवश्यक कागदपत्रे कोणती आहेत?");
    suggestedFollowUps.push("नजीकच्या आपले सरकार / सीएससी केंद्राची माहिती द्या.");
  }

  return {
    query,
    language: lang,
    intent,
    entities,
    sentiment: {
      polarity,
      urgency,
      score,
      distressSignal: isDistressed,
      recommendedHelpline: isDistressed
        ? {
            name: "Kisan Call Center (कृषी सारथी मदत कक्ष)",
            number: "1800-180-1551",
            description: "Toll-free 24x7 expert agricultural helpline",
          }
        : undefined,
    },
    speechNormalization: {
      rawText: query,
      spokenText,
      transformations,
    },
    summary,
    suggestedFollowUps,
  };
}


