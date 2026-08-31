import { GoogleGenAI } from "@google/genai";

export interface NLPEntity {
  type: "person" | "crop" | "land_size" | "amount" | "scheme" | "location" | "id_number" | "bank" | "season" | "other";
  value: string;
  normalized?: string;
  confidence: number;
}

export interface NLPAnalysisResult {
  query: string;
  language: string;
  intent: {
    name: string;
    category: string;
    confidence: number;
    description: string;
  };
  entities: NLPEntity[];
  sentiment: {
    polarity: "positive" | "neutral" | "negative" | "distressed";
    urgency: "low" | "medium" | "high" | "critical";
    score: number; // -1.0 to 1.0
    distressSignal: boolean;
    recommendedHelpline?: {
      name: string;
      number: string;
      description: string;
    };
  };
  speechNormalization: {
    rawText: string;
    spokenText: string;
    changesCount: number;
    transformations: Array<{ original: string; spoken: string; rule: string }>;
  };
  summary: string[];
  suggestedFollowUps: string[];
}

// Regional rural dictionary and entity matchers
const RURAL_INTENTS = [
  {
    name: "crop_insurance_claim",
    category: "Agriculture & Insurance",
    keywords: ["विमा", "नुकसान", "पीक नुकसान", "पाऊस", "गारपीट", "दुष्काळ", "कीड", "इन्शुरन्स", "claim", "damage", "pmfby"],
    desc: "Crop insurance claim or natural calamity damage assessment"
  },
  {
    name: "pm_kisan_installment",
    category: "Direct Benefit Transfer",
    keywords: ["पीएम किसान", "pm kisan", "हप्ता", "installment", "२ हजार", "2000", "खात्यात पैसे", "dbt", "सन्मान निधी"],
    desc: "PM-Kisan scheme installment and payment verification"
  },
  {
    name: "land_records_satbara",
    category: "Revenue & Land Records",
    keywords: ["सातबारा", "७/१२", "8a", "८-अ", "उतारा", "फेरफार", "जमीन", "खाते", "satbara", "land record", "mutations"],
    desc: "Land ownership records, 7/12 extract and mutation verification"
  },
  {
    name: "shg_women_loan",
    category: "Rural Livelihoods & Women",
    keywords: ["बचत गट", "महिला बचत गट", "shg", "कर्ज", "उमेद", "लाडकी बहीण", "स्वयं सहायता", "subsidy", "women loan"],
    desc: "Self Help Group micro-finance, livelihood grants and subsidies"
  },
  {
    name: "kcc_crop_loan",
    category: "Agricultural Credit",
    keywords: ["केसीसी", "kcc", "पीक कर्ज", "बँक कर्ज", "व्याज सवलत", "crop loan", "kisan credit card", "nabard"],
    desc: "Kisan Credit Card low-interest short-term crop loans"
  },
  {
    name: "irrigation_solar_pump",
    category: "Water & Energy",
    keywords: ["कुसुम", "kusum", "सौर कृषी पंप", "सोलर", "ठिबक", "तुषार", "विहीर", "drip irrigation", "solar pump"],
    desc: "PM-KUSUM solar pump subsidy and micro-irrigation grants"
  },
  {
    name: "mandi_market_price",
    category: "Commodity Markets",
    keywords: ["बाजारभाव", "हमीभाव", "msp", "कापूस भाव", "सोयाबीन भाव", "मार्केट यार्ड", "apmc", "mandi rate"],
    desc: "APMC market yard daily arrivals and Minimum Support Prices"
  },
  {
    name: "health_ayushman_card",
    category: "Healthcare & Welfare",
    keywords: ["आयुष्मान", "आभा", "आरोग्य", "कार्ड", "रुग्णालय", "उपचार", "ayushman", "abha", "pmjay", "hospital"],
    desc: "Ayushman Bharat / ABHA health coverage and free hospitalization"
  },
  {
    name: "housing_pmay",
    category: "Social Welfare",
    keywords: ["घरकुल", "आवास योजना", "pmay", "घर", "अनुदान", "housing scheme", "gramin"],
    desc: "Pradhan Mantri Awas Yojana rural pucca house grant"
  },
  {
    name: "general_inquiry",
    category: "General Information",
    keywords: [],
    desc: "General public service and civic inquiries"
  }
];

export function analyzeQueryLocally(query: string, language: string = "en"): NLPAnalysisResult {
  const qLower = query.toLowerCase();
  const lang = (language || "en").toLowerCase();

  // 1. Intent Detection
  let bestIntent = RURAL_INTENTS[RURAL_INTENTS.length - 1]; // general
  let maxScore = 0;

  for (const item of RURAL_INTENTS) {
    let matches = 0;
    for (const kw of item.keywords) {
      if (qLower.includes(kw.toLowerCase())) {
        matches++;
      }
    }
    if (matches > maxScore) {
      maxScore = matches;
      bestIntent = item;
    }
  }

  const intentConfidence = maxScore > 0 ? Math.min(0.96, 0.65 + maxScore * 0.12) : 0.55;

  // 2. Named Entity Recognition (NER)
  const entities: NLPEntity[] = [];

  // Land size (e.g. 2.5 हेक्टर, 5 एकर, 20 गुंठे, 3 bigha)
  const landMatch = query.match(/(\d+(?:\.\d+)?)\s*(हेक्टर|एकर|गुंठे|गुंठा|बीघा|hectare|hectares|acre|acres|guntha|bigha)/i);
  if (landMatch) {
    entities.push({
      type: "land_size",
      value: landMatch[0],
      normalized: `${landMatch[1]} ${landMatch[2]}`,
      confidence: 0.95,
    });
  }

  // Crops
  const cropKeywords = [
    { name: "कापूस (Cotton)", match: ["कापूस", "cotton", "कपास"] },
    { name: "सोयाबीन (Soybean)", match: ["सोयाबीन", "soybean", "soya"] },
    { name: "तूर / डाळ (Pigeon Pea)", match: ["तूर", "तुरी", "arhar", "tur"] },
    { name: "ऊस (Sugarcane)", match: ["ऊस", "sugar cane", "sugarcane", "गन्ना"] },
    { name: "कांदा (Onion)", match: ["कांदा", "onion", "प्याज़"] },
    { name: "गहू (Wheat)", match: ["गहू", "wheat", "गेहूं"] },
    { name: "भात / तांदूळ (Paddy/Rice)", match: ["भात", "तांदूळ", "rice", "paddy", "धान"] },
    { name: "मका (Maize)", match: ["मका", "maize", "corn", "मक्का"] },
  ];

  for (const c of cropKeywords) {
    if (c.match.some((m) => qLower.includes(m))) {
      entities.push({
        type: "crop",
        value: c.name,
        confidence: 0.94,
      });
    }
  }

  // Currency / Amounts
  const amountMatch = query.match(/(?:₹|Rs\.?|INR)?\s*(\d{1,3}(?:,\d{3})*|\d+)\s*(?:रु|रुपये|rupees|हजार|लाख|k)?/i);
  if (amountMatch && amountMatch[1] && parseInt(amountMatch[1].replace(/,/g, ""), 10) > 0) {
    const rawVal = amountMatch[0].trim();
    if (rawVal.length > 1 && !landMatch?.[0].includes(rawVal)) {
      entities.push({
        type: "amount",
        value: rawVal,
        confidence: 0.9,
      });
    }
  }

  // Schemes
  const schemePatterns = [
    { name: "PM-KISAN", regex: /pm-?kisan|पीएम किसान|सन्मान निधी/i },
    { name: "PMFBY (Crop Insurance)", regex: /pmfby|पीक विमा|फसल बीमा/i },
    { name: "Kisan Credit Card (KCC)", regex: /kcc|किसान क्रेडिट|पीक कर्ज/i },
    { name: "PM-KUSUM (Solar Pump)", regex: /kusum|कुसुम|सौर कृषी|solar pump/i },
    { name: "Ladki Bahin Yojana", regex: /लाडकी बहीण|ladki bahin/i },
    { name: "Ayushman Bharat (PM-JAY)", regex: /ayushman|आयुष्मान|pmjay|आभा/i },
    { name: "PMAY-Gramin (Housing)", regex: /pmay|घरकुल|आवास योजना/i },
  ];

  for (const sp of schemePatterns) {
    if (sp.regex.test(query)) {
      entities.push({
        type: "scheme",
        value: sp.name,
        confidence: 0.96,
      });
    }
  }

  // ID Numbers (Aadhaar, Account, 7/12 Survey)
  const aadhaarMatch = query.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
  if (aadhaarMatch) {
    entities.push({
      type: "id_number",
      value: aadhaarMatch[0],
      normalized: "Aadhaar Card (12 Digits)",
      confidence: 0.99,
    });
  }

  const satbaraMatch = query.match(/\b(७\/१२|7\/12|गट\s?क्र|सर्व्हे\s?नं)\s*(\d+)?/i);
  if (satbaraMatch) {
    entities.push({
      type: "id_number",
      value: satbaraMatch[0],
      normalized: "7/12 Land Survey Number",
      confidence: 0.95,
    });
  }

  // 3. Distress & Urgency Assessment
  const distressTerms = [
    "नुकसान", "पिकं जळाली", "पाऊस नाही", "दुष्काळ", "गारपीट", "कीड पडली", "कर्जबाजारी",
    "आत्महत्या", "आत्महत्याग्रस्त", "मदत नाही", "फसगत", "तक्रार", "urgent", "emergency",
    "damage", "crop lost", "drought", "infestation", "flood", "पूर", "बुडाले"
  ];

  const hasDistress = distressTerms.some((term) => qLower.includes(term.toLowerCase()));
  let urgency: "low" | "medium" | "high" | "critical" = "low";
  let polarity: "positive" | "neutral" | "negative" | "distressed" = "neutral";
  let score = 0.0;

  if (hasDistress) {
    urgency = "high";
    polarity = "distressed";
    score = -0.75;
    if (qLower.includes("तातडीने") || qLower.includes("urgent") || qLower.includes("मदत")) {
      urgency = "critical";
      score = -0.9;
    }
  } else if (qLower.includes("कसा") || qLower.includes("माहिती") || qLower.includes("how") || qLower.includes("status")) {
    urgency = "medium";
    polarity = "neutral";
    score = 0.1;
  } else if (qLower.includes("धन्यवाद") || qLower.includes("मिळाले") || qLower.includes("यशस्वी") || qLower.includes("thank")) {
    urgency = "low";
    polarity = "positive";
    score = 0.8;
  }

  const recommendedHelpline = hasDistress
    ? {
        name: "Kisan Call Center (कृषी सारथी मदत कक्ष)",
        number: "1800-180-1551",
        description: "Toll-free 24x7 expert agricultural helpline in Marathi, Hindi & English",
      }
    : undefined;

  // 4. Speech Normalization Transformations
  const transformations: Array<{ original: string; spoken: string; rule: string }> = [];

  // Currency rule
  if (/₹|\bRs\.?\b/i.test(query)) {
    transformations.push({
      original: "₹ / Rs.",
      spoken: lang === "mr" || lang === "hi" ? "रुपये" : "Rupees",
      rule: "Currency unit expansion",
    });
  }

  // Digits to words rule
  const digitMatches = query.match(/\b\d{1,6}\b/g);
  if (digitMatches && digitMatches.length > 0) {
    transformations.push({
      original: digitMatches.slice(0, 3).join(", "),
      spoken: "Phonetic number words (दोन हजार / पाँच सौ / 6000)",
      rule: "Numeric reading cadence",
    });
  }

  // Scheme acronyms
  if (/PM-?KISAN/i.test(query)) {
    transformations.push({
      original: "PM-KISAN",
      spoken: "पीएम किसान सन्मान निधी योजना",
      rule: "Rural government scheme phonetic expansion",
    });
  }
  if (/7\s?[\/\\]\s?12/i.test(query)) {
    transformations.push({
      original: "7/12",
      spoken: "सात बारा उतारा",
      rule: "Revenue record vernacular pronunciation",
    });
  }

  // Summary Key Points
  const summary: string[] = [
    `Category: ${bestIntent.category} (${bestIntent.name.replace(/_/g, " ")})`,
    `Extracted ${entities.length} key agricultural/civic parameters`,
    `Sentiment status: ${polarity.toUpperCase()} (Urgency: ${urgency.toUpperCase()})`,
  ];

  // Follow-up Recommendations
  const followUps: string[] = [];
  if (bestIntent.name === "crop_insurance_claim") {
    followUps.push("पीक नुकसान भरपाईसाठी ई-पंचनामा झाला आहे का?");
    followUps.push("७२ तासांच्या आत विमा कंपनीकडे ऑनलाइन पूर्वसूचना दिली आहे का?");
  } else if (bestIntent.name === "pm_kisan_installment") {
    followUps.push("आधार ई-केवायसी (e-KYC) पूर्ण आहे का?");
    followUps.push("बँक खात्याला NPCI आधार डीबीटी लिंक झाले आहे का?");
  } else if (bestIntent.name === "land_records_satbara") {
    followUps.push("डिजिटल स्वाक्षरीत ७/१२ महाभूमी पोर्टलवरून डाउनलोड करायचा आहे का?");
  } else {
    followUps.push("या योजनेसाठी लागणारी कागदपत्रे तपासायची आहेत का?");
    followUps.push("नजीकच्या आपले सरकार / सीएससी केंद्राची माहिती हवी आहे का?");
  }

  return {
    query,
    language: lang,
    intent: {
      name: bestIntent.name,
      category: bestIntent.category,
      confidence: intentConfidence,
      description: bestIntent.desc,
    },
    entities,
    sentiment: {
      polarity,
      urgency,
      score,
      distressSignal: hasDistress,
      recommendedHelpline,
    },
    speechNormalization: {
      rawText: query,
      spokenText: query, // Will be enriched on client or LLM
      changesCount: transformations.length,
      transformations,
    },
    summary,
    suggestedFollowUps: followUps,
  };
}

/**
 * Enhanced LLM-powered NLP Analyzer for deep semantic breakdown
 */
export async function analyzeQueryWithGemini(
  query: string,
  language: string = "en"
): Promise<NLPAnalysisResult> {
  const localAnalysis = analyzeQueryLocally(query, language);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return localAnalysis;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are the core NLP understanding engine for VAANI, India's AI voice assistant for rural citizens, farmers, and women self-help groups.
Analyze the following user query with utmost precision in Marathi/Hindi/English context.

User Query: "${query}"
Language: ${language}

Return a STRICT JSON object with this exact structure:
{
  "intent": {
    "name": "snake_case_intent_name",
    "category": "Category Name (e.g. Agriculture, Land Records, Finance, Health, Welfare)",
    "confidence": 0.95,
    "description": "Short explanation of user intent"
  },
  "entities": [
    {
      "type": "person" | "crop" | "land_size" | "amount" | "scheme" | "location" | "id_number" | "bank" | "season" | "other",
      "value": "extracted text",
      "normalized": "standardized value",
      "confidence": 0.95
    }
  ],
  "sentiment": {
    "polarity": "positive" | "neutral" | "negative" | "distressed",
    "urgency": "low" | "medium" | "high" | "critical",
    "score": -0.5,
    "distressSignal": true/false
  },
  "summary": [
    "Key point 1",
    "Key point 2"
  ],
  "suggestedFollowUps": [
    "Follow-up question in query language 1",
    "Follow-up question in query language 2"
  ]
}

Only return valid JSON, no markdown blocks.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text?.trim();
    if (text) {
      const parsed = JSON.parse(text);
      return {
        query,
        language,
        intent: parsed.intent || localAnalysis.intent,
        entities: parsed.entities?.length ? parsed.entities : localAnalysis.entities,
        sentiment: {
          ...localAnalysis.sentiment,
          ...(parsed.sentiment || {}),
        },
        speechNormalization: localAnalysis.speechNormalization,
        summary: parsed.summary?.length ? parsed.summary : localAnalysis.summary,
        suggestedFollowUps: parsed.suggestedFollowUps?.length ? parsed.suggestedFollowUps : localAnalysis.suggestedFollowUps,
      };
    }
  } catch (err) {
    console.warn("Gemini NLP Analysis fallback to local parser:", err);
  }

  return localAnalysis;
}
