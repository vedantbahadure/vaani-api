import { getGeminiClient } from "./gemini";
import { generateJsonWithProvider, isGeminiAvailable, reportGeminiError } from "./llm/manager";

export interface FormFieldDefinition {
  id: string;
  label: string;
  label_hi: string;
  label_mr: string;
  type: "text" | "number" | "select" | "date" | "textarea";
  options?: { value: string; label: string; label_hi?: string; label_mr?: string }[];
  placeholder?: string;
  required?: boolean;
  section: "personal" | "address" | "bank" | "scheme_specific";
  validationPattern?: string;
  helpText?: string;
}

export interface FormTemplate {
  id: string;
  title: string;
  title_hi: string;
  title_mr: string;
  department: string;
  category: "agriculture" | "welfare" | "health" | "msme" | "finance";
  description: string;
  description_hi: string;
  description_mr: string;
  officialPortalUrl: string;
  helpline: string;
  requiredDocs: string[];
  fields: FormFieldDefinition[];
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "pm_kisan",
    title: "PM-KISAN Samman Nidhi Registration",
    title_hi: "पीएम-किसान सम्मान निधि पंजीकरण",
    title_mr: "पीएम-किसान सन्मान निधी नोंदणी",
    department: "Ministry of Agriculture & Farmers Welfare, GoI",
    category: "agriculture",
    description: "Annual Rs 6,000 direct income support in 3 equal instalments for landholding farmer families.",
    description_hi: "जमीन धारक किसान परिवारों के लिए 3 किस्तों में वार्षिक ₹6,000 की सीधी सहायता।",
    description_mr: "शेतकरी कुटुंबांसाठी वार्षिक ₹६,००० चे थेट बँक खात्यात आर्थिक अनुदान.",
    officialPortalUrl: "https://pmkisan.gov.in",
    helpline: "155261 / 1800-115-526",
    requiredDocs: ["Aadhaar Card", "7/12 Extract / Khatauni", "Bank Passbook", "Active Mobile Number"],
    fields: [
      // Personal
      { id: "applicant_name", label: "Farmer Full Name", label_hi: "किसान का पूरा नाम", label_mr: "शेतकऱ्याचे पूर्ण नाव", type: "text", required: true, section: "personal" },
      { id: "father_spouse_name", label: "Father / Husband Name", label_hi: "पिता / पति का नाम", label_mr: "वडील / पतीचे नाव", type: "text", required: true, section: "personal" },
      { id: "gender", label: "Gender", label_hi: "लिंग", label_mr: "लिंग", type: "select", required: true, section: "personal", options: [{ value: "Male", label: "Male", label_hi: "पुरुष", label_mr: "पुरुष" }, { value: "Female", label: "Female", label_hi: "महिला", label_mr: "महिला" }, { value: "Other", label: "Other", label_hi: "अन्य", label_mr: "इतर" }] },
      { id: "category", label: "Social Category", label_hi: "सामाजिक श्रेणी", label_mr: "सामाजिक वर्ग", type: "select", required: true, section: "personal", options: [{ value: "General", label: "General", label_hi: "सामान्य", label_mr: "खुला प्रवर्ग" }, { value: "OBC", label: "OBC", label_hi: "ओबीसी", label_mr: "इतर मागासवर्गीय (OBC)" }, { value: "SC", label: "SC", label_hi: "अनुसूचित जाति (SC)", label_mr: "अनुसूचित जाती (SC)" }, { value: "ST", label: "ST", label_hi: "अनुसूचित जनजाति (ST)", label_mr: "अनुसूचित जमाती (ST)" }] },
      { id: "aadhaar_number", label: "12-Digit Aadhaar Number", label_hi: "12 अंकों का आधार नंबर", label_mr: "१२ अंकी आधार क्रमांक", type: "text", required: true, section: "personal", validationPattern: "^[0-9]{12}$" },
      { id: "mobile_number", label: "Mobile Number", label_hi: "मोबाइल नंबर", label_mr: "मोबाईल क्रमांक", type: "text", required: true, section: "personal", validationPattern: "^[0-9]{10}$" },
      { id: "dob", label: "Date of Birth", label_hi: "जन्म तिथि", label_mr: "जन्मतारीख", type: "date", required: false, section: "personal" },

      // Address & Land
      { id: "state", label: "State", label_hi: "राज्य", label_mr: "राज्य", type: "text", required: true, section: "address" },
      { id: "district", label: "District", label_hi: "ज़िला", label_mr: "जिल्हा", type: "text", required: true, section: "address" },
      { id: "taluka", label: "Sub-District / Taluka / Tehsil", label_hi: "तहसील / तालुका", label_mr: "तालुका", type: "text", required: true, section: "address" },
      { id: "village", label: "Village / Town", label_hi: "गाँव", label_mr: "गाव", type: "text", required: true, section: "address" },
      { id: "pincode", label: "PIN Code", label_hi: "पिन कोड", label_mr: "पिन कोड", type: "text", required: true, section: "address", validationPattern: "^[0-9]{6}$" },

      // Bank & DBT
      { id: "bank_name", label: "Bank Name", label_hi: "बैंक का नाम", label_mr: "बँकेचे नाव", type: "text", required: true, section: "bank" },
      { id: "account_number", label: "Bank Account Number", label_hi: "बैंक खाता संख्या", label_mr: "बँक खाते क्रमांक", type: "text", required: true, section: "bank" },
      { id: "ifsc_code", label: "Bank IFSC Code", label_hi: "बैंक आईएफएससी कोड", label_mr: "बँक IFSC कोड", type: "text", required: true, section: "bank", validationPattern: "^[A-Z]{4}0[A-Z0-9]{6}$" },
      { id: "aadhaar_seeded", label: "Aadhaar Linked with Bank (DBT Active)", label_hi: "आधार बैंक से लिंक है (DBT सक्रिय)", label_mr: "आधार बँक खात्याशी जोडलेले आहे (DBT)", type: "select", required: true, section: "bank", options: [{ value: "Yes", label: "Yes (हाँ / होय)" }, { value: "No", label: "No (नहीं / नाही)" }] },

      // Scheme Specific (Land details)
      { id: "land_ownership", label: "Land Ownership Type", label_hi: "भूमि स्वामित्व प्रकार", label_mr: "जमीन मालकी प्रकार", type: "select", required: true, section: "scheme_specific", options: [{ value: "Single Owner", label: "Single Owner (एकल मालक)" }, { value: "Joint Owner", label: "Joint Owner (संयुक्त मालक)" }] },
      { id: "survey_gat_no", label: "Survey / Gat / Khatauni Number", label_hi: "सर्वे / खतौनी / गट नंबर", label_mr: "सर्व्हे / गट / ७-१२ क्रमांक", type: "text", required: true, section: "scheme_specific" },
      { id: "khata_no", label: "Khata / 8-A Number", label_hi: "खाता संख्या (8-A)", label_mr: "खाते क्रमांक (८-अ)", type: "text", required: false, section: "scheme_specific" },
      { id: "land_area_hectares", label: "Cultivable Land Area (in Hectares or Acres)", label_hi: "कृषि भूमि क्षेत्रफल (हेक्टेयर/एकड़)", label_mr: "शेती जमीन क्षेत्रफळ (हेक्टर / एकर)", type: "text", required: true, section: "scheme_specific" },
      { id: "land_transfer_date", label: "Land Registration / Ownership Date", label_hi: "भूमि पंजीकरण / नामांतरण तिथि", label_mr: "जमीन नोंदणी / खरेदी तारीख", type: "date", required: false, section: "scheme_specific" },
    ],
  },
  {
    id: "pmfby",
    title: "PMFBY Crop Insurance Loss Claim & Enrollment",
    title_hi: "प्रधानमंत्री फसल बीमा योजना (PMFBY) दावा व आवेदन",
    title_mr: "प्रधानमंत्री पीक विमा योजना (PMFBY) नुकसान भरपाई व अर्ज",
    department: "Ministry of Agriculture & Farmers Welfare, GoI",
    category: "agriculture",
    description: "Comprehensive risk cover for standing crops, localized calamity (hailstorm/flood), and post-harvest loss.",
    description_hi: "प्राकृतिक आपदाओं, ओलावृष्टि, बेमौसम बारिश व बाढ़ से फसल नुकसान पर व्यापक बीमा कवर।",
    description_mr: "अवेळी पाऊस, गारपीट, दुष्काळ व नैसर्गिक आपत्तीमुळे झालेल्या पीक नुकसानीसाठी भरपाई अर्ज.",
    officialPortalUrl: "https://pmfby.gov.in",
    helpline: "14447 / 1800-180-1551",
    requiredDocs: ["7/12 & 8-A Extract", "Crop Sowing Certificate", "Bank Passbook", "Aadhaar Card", "Damage Photos"],
    fields: [
      { id: "applicant_name", label: "Farmer Full Name", label_hi: "किसान का पूरा नाम", label_mr: "शेतकऱ्याचे नाव", type: "text", required: true, section: "personal" },
      { id: "aadhaar_number", label: "Aadhaar Number", label_hi: "आधार नंबर", label_mr: "आधार क्रमांक", type: "text", required: true, section: "personal" },
      { id: "mobile_number", label: "Mobile Number", label_hi: "मोबाइल नंबर", label_mr: "मोबाईल क्रमांक", type: "text", required: true, section: "personal" },
      { id: "state", label: "State", label_hi: "राज्य", label_mr: "राज्य", type: "text", required: true, section: "address" },
      { id: "district", label: "District", label_hi: "ज़िला", label_mr: "जिल्हा", type: "text", required: true, section: "address" },
      { id: "taluka", label: "Taluka / Tehsil", label_hi: "तालुका", label_mr: "तालुका", type: "text", required: true, section: "address" },
      { id: "village", label: "Village", label_hi: "गाँव", label_mr: "गाव", type: "text", required: true, section: "address" },
      { id: "bank_name", label: "Bank Name", label_hi: "बैंक का नाम", label_mr: "बँकेचे नाव", type: "text", required: true, section: "bank" },
      { id: "account_number", label: "Account Number", label_hi: "खाता संख्या", label_mr: "खाते क्रमांक", type: "text", required: true, section: "bank" },
      { id: "ifsc_code", label: "IFSC Code", label_hi: "आईएफएससी कोड", label_mr: "IFSC कोड", type: "text", required: true, section: "bank" },
      { id: "survey_gat_no", label: "Gat / Survey Number", label_hi: "गट / सर्वे नंबर", label_mr: "गट / सर्व्हे क्रमांक", type: "text", required: true, section: "scheme_specific" },
      { id: "crop_season", label: "Season", label_hi: "मौसम", label_mr: "हंगाम", type: "select", required: true, section: "scheme_specific", options: [{ value: "Kharif", label: "Kharif (खरीप)" }, { value: "Rabi", label: "Rabi (रब्बी)" }, { value: "Summer", label: "Summer (उन्हाळी)" }] },
      { id: "crop_name", label: "Crop Name (e.g. Cotton, Soybean, Wheat, Onion)", label_hi: "फसल का नाम (कपास, सोयाबीन, गेहूं, प्याज)", label_mr: "पिकाचे नाव (कापूस, सोयाबीन, गहू, कांदा)", type: "text", required: true, section: "scheme_specific" },
      { id: "sowing_area", label: "Insured Area (Acres/Hectares)", label_hi: "बीमाकृत क्षेत्र (एकड़/हेक्टेयर)", label_mr: "विमा क्षेत्र (एकर/हेक्टर)", type: "text", required: true, section: "scheme_specific" },
      { id: "cause_of_loss", label: "Cause of Loss / Calamity", label_hi: "नुकसान का कारण (आपदा)", label_mr: "नुकसानीचे कारण", type: "select", required: true, section: "scheme_specific", options: [{ value: "Unseasonal Rains / Excess Rains", label: "Excess Rains (अतिवृष्टी / अवेळी पाऊस)" }, { value: "Hailstorm", label: "Hailstorm (गारपीट)" }, { value: "Drought / Dry Spell", label: "Drought (दुष्काळ / पावसाचा खंड)" }, { value: "Pest Attack / Disease", label: "Pest / Disease (कीड व रोग)" }, { value: "Inundation / Flooding", label: "Flooding (पूर परिस्थिती)" }, { value: "Post-Harvest Cyclone", label: "Post-Harvest Drying Loss" }] },
      { id: "loss_date", label: "Date of Occurrence of Loss", label_hi: "नुकसान होने की तिथि", label_mr: "नुकसान झाल्याची तारीख", type: "date", required: true, section: "scheme_specific" },
      { id: "loss_percentage", label: "Estimated Damage Percentage (e.g. 50%, 80%)", label_hi: "अनुमानित नुकसान प्रतिशत (%)", label_mr: "अंदाजे नुकसान टक्केवारी (%)", type: "text", required: true, section: "scheme_specific" },
    ],
  },
  {
    id: "kcc",
    title: "Kisan Credit Card (KCC) Institutional Loan Form",
    title_hi: "किसान क्रेडिट कार्ड (KCC) फसली ऋण आवेदन",
    title_mr: "किसान क्रेडिट कार्ड (KCC) पीक कर्ज अर्ज",
    department: "NABARD / Department of Financial Services, GoI",
    category: "finance",
    description: "Subsidised agricultural crop loan up to Rs 3 Lakh at 4% prompt repayment interest rate.",
    description_hi: "3 लाख रुपये तक का रियायती फसली ऋण केवल 4% वार्षिक ब्याज दर पर।",
    description_mr: "४% सवलतीच्या व्याजदरावर ₹३ लाखांपर्यंतचे अल्पमुदत पीक कर्ज.",
    officialPortalUrl: "https://krishirin.dac.gov.in",
    helpline: "1800-180-1551",
    requiredDocs: ["7/12 & 8-A Extract", "No Dues Certificate / Self Declaration", "Aadhaar Card", "PAN Card", "Passport Photo"],
    fields: [
      { id: "applicant_name", label: "Applicant Name", label_hi: "आवेदक का नाम", label_mr: "अर्जदाराचे नाव", type: "text", required: true, section: "personal" },
      { id: "father_spouse_name", label: "Father / Husband Name", label_hi: "पिता / पति का नाम", label_mr: "वडील / पतीचे नाव", type: "text", required: true, section: "personal" },
      { id: "aadhaar_number", label: "Aadhaar Number", label_hi: "आधार नंबर", label_mr: "आधार क्रमांक", type: "text", required: true, section: "personal" },
      { id: "pan_number", label: "PAN Card Number", label_hi: "पैन नंबर", label_mr: "पॅन क्रमांक", type: "text", required: false, section: "personal" },
      { id: "mobile_number", label: "Mobile Number", label_hi: "मोबाइल नंबर", label_mr: "मोबाईल क्रमांक", type: "text", required: true, section: "personal" },
      { id: "village", label: "Village", label_hi: "गाँव", label_mr: "गाव", type: "text", required: true, section: "address" },
      { id: "taluka", label: "Taluka", label_hi: "तालुका", label_mr: "तालुका", type: "text", required: true, section: "address" },
      { id: "district", label: "District", label_hi: "ज़िला", label_mr: "जिल्हा", type: "text", required: true, section: "address" },
      { id: "state", label: "State", label_hi: "राज्य", label_mr: "राज्य", type: "text", required: true, section: "address" },
      { id: "pincode", label: "PIN Code", label_hi: "पिन कोड", label_mr: "पिन कोड", type: "text", required: true, section: "address" },
      { id: "target_bank", label: "Preferred Bank & Branch Name", label_hi: "बैंक व शाखा का नाम", label_mr: "बँक व शाखेचे नाव", type: "text", required: true, section: "bank" },
      { id: "existing_account", label: "Existing Account No. (if any)", label_hi: "मौजूदा खाता संख्या", label_mr: "सध्याचा खाते क्रमांक", type: "text", required: false, section: "bank" },
      { id: "ifsc_code", label: "IFSC Code", label_hi: "IFSC कोड", label_mr: "IFSC कोड", type: "text", required: true, section: "bank" },
      { id: "land_holding_acres", label: "Total Land Holding (Acres)", label_hi: "कुल भूमि (एकड़)", label_mr: "एकूण शेती जमीन (एकर)", type: "text", required: true, section: "scheme_specific" },
      { id: "survey_gat_no", label: "Gat / Survey Numbers", label_hi: "गट / सर्वे नंबर", label_mr: "गट / सर्व्हे क्रमांक", type: "text", required: true, section: "scheme_specific" },
      { id: "major_crops", label: "Major Crops Planned for Season", label_hi: "बोई जाने वाली मुख्य फसलें", label_mr: "घेण्यात येणारी प्रमुख पिके", type: "text", required: true, section: "scheme_specific" },
      { id: "loan_amount_requested", label: "Requested Credit Limit (Rs)", label_hi: "अपेक्षित ऋण राशि (₹)", label_mr: "मागणी केलेली कर्ज रक्कम (₹)", type: "number", required: true, section: "scheme_specific" },
      { id: "allied_activities", label: "Allied Activity (Dairy, Poultry, Fisheries)", label_hi: "पशुपालन / डेयरी / मत्स्यपालन", label_mr: "पूरक व्यवसाय (दुग्ध व्यवसाय / कुक्कुटपालन)", type: "text", required: false, section: "scheme_specific" },
    ],
  },
  {
    id: "ayushman_bharat",
    title: "Ayushman Bharat PM-JAY & ABHA Card Form",
    title_hi: "आयुष्मान भारत PM-JAY व आभा कार्ड आवेदन",
    title_mr: "आयुष्मान भारत PM-JAY व आभा आरोग्य कार्ड अर्ज",
    department: "National Health Authority (NHA), MoHFW, GoI",
    category: "health",
    description: "Free cashless hospitalization cover up to Rs 5 Lakh/year + Rs 5 Lakh top-up for senior citizens (70+).",
    description_hi: "प्रति परिवार ₹5 लाख तक का निःशुल्क अस्पताल इलाज व 70+ वरिष्ठ नागरिकों हेतु विशेष सुरक्षा।",
    description_mr: "प्रति कुटुंब ₹५ लाखांपर्यंत मोफत कॅशलेस उपचार व ७०+ ज्येष्ठ नागरिकांसाठी विशेष आरोग्य संरक्षण.",
    officialPortalUrl: "https://beneficiary.nha.gov.in",
    helpline: "14555",
    requiredDocs: ["Aadhaar Card", "Ration Card (PHH / Antyodaya)", "Mobile Linked with Aadhaar"],
    fields: [
      { id: "applicant_name", label: "Full Name (as per Aadhaar)", label_hi: "पूरा नाम (आधार अनुसार)", label_mr: "पूर्ण नाव (आधारप्रमाणे)", type: "text", required: true, section: "personal" },
      { id: "gender", label: "Gender", label_hi: "लिंग", label_mr: "लिंग", type: "select", required: true, section: "personal", options: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }, { value: "Other", label: "Other" }] },
      { id: "dob", label: "Date of Birth / Year of Birth", label_hi: "जन्म तिथि / वर्ष", label_mr: "जन्मतारीख / जन्म वर्ष", type: "text", required: true, section: "personal" },
      { id: "is_senior_70_plus", label: "Senior Citizen (Age 70 or Above)?", label_hi: "वरिष्ठ नागरिक (70 वर्ष या अधिक)?", label_mr: "ज्येष्ठ नागरिक (वय ७० किंवा जास्त)?", type: "select", required: true, section: "personal", options: [{ value: "No", label: "No (नाही)" }, { value: "Yes", label: "Yes (होय - Vay Vandana Card)" }] },
      { id: "aadhaar_number", label: "Aadhaar Number", label_hi: "आधार नंबर", label_mr: "आधार क्रमांक", type: "text", required: true, section: "personal" },
      { id: "mobile_number", label: "Mobile Number", label_hi: "मोबाइल नंबर", label_mr: "मोबाईल क्रमांक", type: "text", required: true, section: "personal" },
      { id: "ration_card_no", label: "Ration Card Number (NFSA / State)", label_hi: "राशन कार्ड नंबर", label_mr: "रेशन कार्ड क्रमांक", type: "text", required: true, section: "personal" },
      { id: "family_members_count", label: "Total Family Members", label_hi: "परिवार के कुल सदस्य", label_mr: "कुटुंबातील एकूण सदस्य संख्या", type: "number", required: true, section: "personal" },
      { id: "state", label: "State", label_hi: "राज्य", label_mr: "राज्य", type: "text", required: true, section: "address" },
      { id: "district", label: "District", label_hi: "ज़िला", label_mr: "जिल्हा", type: "text", required: true, section: "address" },
      { id: "taluka", label: "Taluka", label_hi: "तालुका", label_mr: "तालुका", type: "text", required: true, section: "address" },
      { id: "village", label: "Village / Ward", label_hi: "गाँव / वार्ड", label_mr: "गाव / वॉर्ड", type: "text", required: true, section: "address" },
      { id: "pincode", label: "PIN Code", label_hi: "पिन कोड", label_mr: "पिन कोड", type: "text", required: true, section: "address" },
    ],
  },
  {
    id: "pm_mudra",
    title: "PM MUDRA Yojana Micro-Enterprise Loan Application",
    title_hi: "प्रधानमंत्री मुद्रा योजना ऋण आवेदन",
    title_mr: "प्रधानमंत्री मुद्रा योजना सूक्ष्म व्यवसाय कर्ज अर्ज",
    department: "Ministry of Finance, GoI",
    category: "msme",
    description: "Collateral-free business loans up to Rs 20 Lakh (Shishu: up to 50k, Kishore: up to 5L, Tarun: up to 20L).",
    description_hi: "दुकानदारों, कारीगरों व लघु उद्यमियों हेतु ₹20 लाख तक का बिना गारंटी व्यवसाय ऋण।",
    description_mr: "लहान दुकानदार, शेतीपूरक व्यवसाय व उद्योजकांसाठी ₹२० लाखांपर्यंत विनातारण कर्ज.",
    officialPortalUrl: "https://www.mudra.org.in",
    helpline: "1800-180-1111 / 1800-11-0001",
    requiredDocs: ["Aadhaar & PAN", "Business Address Proof", "Quotation of Machinery/Stock", "6-Month Bank Statement"],
    fields: [
      { id: "applicant_name", label: "Proprietor / Enterprise Name", label_hi: "उद्यमी / प्रतिष्ठान का नाम", label_mr: "उद्योजक / व्यवसायाचे नाव", type: "text", required: true, section: "personal" },
      { id: "aadhaar_number", label: "Aadhaar Number", label_hi: "आधार नंबर", label_mr: "आधार क्रमांक", type: "text", required: true, section: "personal" },
      { id: "pan_number", label: "PAN Number", label_hi: "पैन नंबर", label_mr: "पॅन क्रमांक", type: "text", required: true, section: "personal" },
      { id: "mobile_number", label: "Mobile Number", label_hi: "मोबाइल नंबर", label_mr: "मोबाईल क्रमांक", type: "text", required: true, section: "personal" },
      { id: "state", label: "State", label_hi: "राज्य", label_mr: "राज्य", type: "text", required: true, section: "address" },
      { id: "district", label: "District", label_hi: "ज़िला", label_mr: "जिल्हा", type: "text", required: true, section: "address" },
      { id: "village", label: "Business Location / Address", label_hi: "व्यवसाय का पता", label_mr: "व्यवसायाचा पत्ता", type: "text", required: true, section: "address" },
      { id: "pincode", label: "PIN Code", label_hi: "पिन कोड", label_mr: "पिन कोड", type: "text", required: true, section: "address" },
      { id: "bank_name", label: "Lending Bank & Branch", label_hi: "बैंक व शाखा", label_mr: "बँक व शाखा", type: "text", required: true, section: "bank" },
      { id: "account_number", label: "Account Number", label_hi: "खाता संख्या", label_mr: "खाते क्रमांक", type: "text", required: true, section: "bank" },
      { id: "ifsc_code", label: "IFSC Code", label_hi: "IFSC कोड", label_mr: "IFSC कोड", type: "text", required: true, section: "bank" },
      { id: "mudra_category", label: "MUDRA Category", label_hi: "मुद्रा श्रेणी", label_mr: "मुद्रा प्रवर्ग", type: "select", required: true, section: "scheme_specific", options: [{ value: "Shishu (Up to Rs 50,000)", label: "Shishu (शिशु - Up to ₹50,000)" }, { value: "Kishore (Rs 50,001 to Rs 5 Lakh)", label: "Kishore (किशोर - ₹50,001 to ₹5 Lakh)" }, { value: "Tarun (Rs 5 Lakh to Rs 10 Lakh)", label: "Tarun (तरुण - ₹5L to ₹10L)" }, { value: "Tarun Plus (Rs 10 Lakh to Rs 20 Lakh)", label: "Tarun Plus (₹10L to ₹20L)" }] },
      { id: "business_activity", label: "Type of Business / Activity", label_hi: "व्यवसाय का प्रकार (उदा. किराना, रिपेयरिंग, डेयरी)", label_mr: "व्यवसायाचे स्वरूप (उदा. किराणा, वर्कशॉप, डेअरी)", type: "text", required: true, section: "scheme_specific" },
      { id: "loan_amount_requested", label: "Required Loan Amount (Rs)", label_hi: "आवश्यक ऋण राशि (₹)", label_mr: "आवश्यक कर्ज रक्कम (₹)", type: "number", required: true, section: "scheme_specific" },
      { id: "loan_purpose", label: "Purpose of Loan", label_hi: "ऋण का उद्देश्य (मशीन, कच्चा माल)", label_mr: "कर्जाचा हेतू (यंत्रसामग्री, कच्चा माल)", type: "textarea", required: true, section: "scheme_specific" },
    ],
  },
  {
    id: "pm_vishwakarma",
    title: "PM Vishwakarma Artisan Toolkit & 5% Loan Form",
    title_hi: "पीएम विश्वकर्मा योजना पंजीकरण व टूलकिट अनुदान",
    title_mr: "पीएम विश्वकर्मा योजना नोंदणी व टूलकिट अनुदान अर्ज",
    department: "Ministry of MSME, GoI",
    category: "msme",
    description: "Holistic support, Rs 15,000 digital toolkit voucher, and Rs 3 Lakh collateral-free loan at 5% interest.",
    description_hi: "पारंपरिक कारीगरों हेतु ₹15,000 का टूलकिट अनुदान व 5% ब्याज पर ₹3 लाख तक ऋण।",
    description_mr: "पारंपरिक कारागिरांसाठी ₹१५,००० टूलकिट व्हाउचर व ५% व्याजाने ₹३ लाखांपर्यंत कर्ज.",
    officialPortalUrl: "https://pmvishwakarma.gov.in",
    helpline: "1800-267-7777",
    requiredDocs: ["Aadhaar Card", "Bank Passbook", "Active Mobile Linked with Aadhaar", "Trade Verification"],
    fields: [
      { id: "applicant_name", label: "Artisan Full Name", label_hi: "कारीगर का नाम", label_mr: "कारागिराचे पूर्ण नाव", type: "text", required: true, section: "personal" },
      { id: "father_spouse_name", label: "Father / Spouse Name", label_hi: "पिता / पति का नाम", label_mr: "वडील / पतीचे नाव", type: "text", required: true, section: "personal" },
      { id: "gender", label: "Gender", label_hi: "लिंग", label_mr: "लिंग", type: "select", required: true, section: "personal", options: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }, { value: "Other", label: "Other" }] },
      { id: "aadhaar_number", label: "Aadhaar Number", label_hi: "आधार नंबर", label_mr: "आधार क्रमांक", type: "text", required: true, section: "personal" },
      { id: "mobile_number", label: "Mobile Number", label_hi: "मोबाइल नंबर", label_mr: "मोबाईल क्रमांक", type: "text", required: true, section: "personal" },
      { id: "state", label: "State", label_hi: "राज्य", label_mr: "राज्य", type: "text", required: true, section: "address" },
      { id: "district", label: "District", label_hi: "ज़िला", label_mr: "जिल्हा", type: "text", required: true, section: "address" },
      { id: "taluka", label: "Taluka", label_hi: "तालुका", label_mr: "तालुका", type: "text", required: true, section: "address" },
      { id: "village", label: "Village", label_hi: "गाँव", label_mr: "गाव", type: "text", required: true, section: "address" },
      { id: "pincode", label: "PIN Code", label_hi: "पिन कोड", label_mr: "पिन कोड", type: "text", required: true, section: "address" },
      { id: "bank_name", label: "Bank Name", label_hi: "बैंक का नाम", label_mr: "बँकेचे नाव", type: "text", required: true, section: "bank" },
      { id: "account_number", label: "Bank Account Number", label_hi: "खाता संख्या", label_mr: "खाते क्रमांक", type: "text", required: true, section: "bank" },
      { id: "ifsc_code", label: "IFSC Code", label_hi: "IFSC कोड", label_mr: "IFSC कोड", type: "text", required: true, section: "bank" },
      { id: "trade_name", label: "Traditional Artisan Trade (18 Trades)", label_hi: "पारंपरिक व्यवसाय / शिल्प", label_mr: "पारंपरिक व्यवसाय (१८ पारंपरिक कामे)", type: "select", required: true, section: "scheme_specific", options: [
        { value: "Carpenter (Suthar)", label: "Carpenter (सुथार / सुतार)" },
        { value: "Blacksmith (Lohar)", label: "Blacksmith (लोहार)" },
        { value: "Potter (Kumhaar)", label: "Potter (कुंभार)" },
        { value: "Sculptor / Stone Carver (Murtikar)", label: "Sculptor (मूर्तिकार / पाथरवट)" },
        { value: "Cobbler / Footwear Artisan (Charmakar)", label: "Cobbler (चर्मकार / मोची)" },
        { value: "Mason (Rajmistri)", label: "Mason (राजमिस्त्री / गवंडी)" },
        { value: "Basket / Mat / Broom Maker", label: "Basket/Mat Maker (बुरुड / झाडू बनवणारे)" },
        { value: "Doll & Toy Maker (Traditional)", label: "Doll & Toy Maker (खेळणी बनवणारे)" },
        { value: "Barber (Naai)", label: "Barber (न्हावी / नाई)" },
        { value: "Garland Maker (Malakaar)", label: "Garland Maker (माळी / फुलहार बनवणारे)" },
        { value: "Washerman (Dhobi)", label: "Washerman (धोबी / परीट)" },
        { value: "Tailor (Darzi)", label: "Tailor (शिंपी / दर्जी)" },
        { value: "Fishing Net Maker", label: "Fishing Net Maker (मासेमारी जाळे विणणारे)" },
      ] },
      { id: "years_in_trade", label: "Years of Experience in Trade", label_hi: "व्यवसाय में अनुभव (वर्ष)", label_mr: "व्यवसायातील अनुभव (वर्षे)", type: "number", required: true, section: "scheme_specific" },
      { id: "toolkit_voucher_opt_in", label: "Avail Rs 15,000 Toolkit e-RUPI Voucher?", label_hi: "₹15,000 टूलकिट वाउचर चाहिए?", label_mr: "₹१५,००० टूलकिट व्हाउचर हवे आहे का?", type: "select", required: true, section: "scheme_specific", options: [{ value: "Yes", label: "Yes (होय / हाँ)" }, { value: "No", label: "No (नाही / नहीं)" }] },
      { id: "concessional_loan_interest", label: "Apply for 5% Concessional Enterprise Loan?", label_hi: "5% ब्याज पर उद्यम ऋण चाहिए?", label_mr: "५% सवलतीच्या व्याजदरावर व्यवसाय कर्ज हवे आहे का?", type: "select", required: true, section: "scheme_specific", options: [{ value: "Tranche 1 (Rs 1 Lakh)", label: "Tranche 1 (₹1 Lakh)" }, { value: "Tranche 2 (Rs 2 Lakh)", label: "Tranche 2 (₹2 Lakh)" }, { value: "Not Now", label: "Not Now (आत्ता नको)" }] },
    ],
  },
  {
    id: "pmay_gramin",
    title: "Pradhan Mantri Awas Yojana (PMAY-G) Housing Assistance",
    title_hi: "प्रधानमंत्री आवास योजना - ग्रामीण (PMAY-G) आवेदन",
    title_mr: "प्रधानमंत्री आवास योजना - ग्रामीण (PMAY-G) घरकुल अर्ज",
    department: "Ministry of Rural Development, GoI",
    category: "welfare",
    description: "Financial assistance of Rs 1.20 Lakh / Rs 1.30 Lakh + 95 days MGNREGA wages for pucca house construction.",
    description_hi: "कच्चे व बेघर परिवारों को पक्का मकान निर्माण हेतु ₹1.20 लाख सहायता व मनरेगा मजदूरी।",
    description_mr: "ग्रामीण बेघर व कच्च्या घरात राहणाऱ्या कुटुंबांना पक्के घर बांधण्यासाठी ₹१.२० लाखांचे अनुदान.",
    officialPortalUrl: "https://pmayg.nic.in",
    helpline: "1800-11-6446",
    requiredDocs: ["Aadhaar of All Adults", "Job Card (MGNREGA)", "Bank Passbook", "Land/Plot Ownership Proof", "SECC Awas+ Survey Details"],
    fields: [
      { id: "applicant_name", label: "Female Head / Beneficiary Name", label_hi: "महिला मुखिया / लाभार्थी का नाम", label_mr: "कुटुंबप्रमुख महिला / लाभार्थीचे नाव", type: "text", required: true, section: "personal" },
      { id: "father_spouse_name", label: "Father / Husband Name", label_hi: "पिता / पति का नाम", label_mr: "वडील / पतीचे नाव", type: "text", required: true, section: "personal" },
      { id: "aadhaar_number", label: "Aadhaar Number", label_hi: "आधार नंबर", label_mr: "आधार क्रमांक", type: "text", required: true, section: "personal" },
      { id: "job_card_number", label: "MGNREGA Job Card Number", label_hi: "मनरेगा जॉब कार्ड नंबर", label_mr: "मनरेगा जॉब कार्ड क्रमांक", type: "text", required: false, section: "personal" },
      { id: "mobile_number", label: "Mobile Number", label_hi: "मोबाइल नंबर", label_mr: "मोबाईल क्रमांक", type: "text", required: true, section: "personal" },
      { id: "state", label: "State", label_hi: "राज्य", label_mr: "राज्य", type: "text", required: true, section: "address" },
      { id: "district", label: "District", label_hi: "ज़िला", label_mr: "जिल्हा", type: "text", required: true, section: "address" },
      { id: "taluka", label: "Taluka / Block", label_hi: "प्रखंड / तालुका", label_mr: "तालुका / पंचायत समिती", type: "text", required: true, section: "address" },
      { id: "village", label: "Gram Panchayat / Village", label_hi: "ग्राम पंचायत / गाँव", label_mr: "ग्रामपंचायत / गाव", type: "text", required: true, section: "address" },
      { id: "pincode", label: "PIN Code", label_hi: "पिन कोड", label_mr: "पिन कोड", type: "text", required: true, section: "address" },
      { id: "bank_name", label: "Bank Name (Aadhaar Seeded)", label_hi: "बैंक का नाम", label_mr: "बँकेचे नाव", type: "text", required: true, section: "bank" },
      { id: "account_number", label: "Account Number", label_hi: "खाता संख्या", label_mr: "खाते क्रमांक", type: "text", required: true, section: "bank" },
      { id: "ifsc_code", label: "IFSC Code", label_hi: "IFSC कोड", label_mr: "IFSC कोड", type: "text", required: true, section: "bank" },
      { id: "current_housing_status", label: "Current House Status", label_hi: "वर्तमान आवास स्थिति", label_mr: "सध्याच्या घराची स्थिती", type: "select", required: true, section: "scheme_specific", options: [{ value: "Kutcha Mud House (कच्चे घर)", label: "Kutcha Mud House (कच्चे घर / मातीचे घर)" }, { value: "Dilapidated / Damaged Roof", label: "Dilapidated Roof (पडके / पत्र्याचे घर)" }, { value: "Homeless / Landless", label: "Homeless (घरहीन / जागा उपलब्ध)" }] },
      { id: "plot_land_available", label: "Do you own a plot/land for house construction?", label_hi: "क्या मकान बनाने हेतु स्वयं की जगह है?", label_mr: "घर बांधण्यासाठी स्वतःची जागा उपलब्ध आहे का?", type: "select", required: true, section: "scheme_specific", options: [{ value: "Yes", label: "Yes (होय / हाँ)" }, { value: "No (Need Govt Plot)", label: "No (जागा उपलब्ध नाही)" }] },
    ],
  },
];

export async function autoFillFormWithGemini({
  formTypeId,
  rawTextPrompt,
  fileBase64,
  fileMimeType,
  targetLang = "en",
}: {
  formTypeId?: string;
  rawTextPrompt?: string;
  fileBase64?: string;
  fileMimeType?: string;
  targetLang?: string;
}) {
  const ai = getGeminiClient();
  const selectedTemplate = FORM_TEMPLATES.find((t) => t.id === formTypeId) || FORM_TEMPLATES[0];

  const systemInstruction = `You are the AI Auto-Form Filler Engine for VAANI (The Indian Rural Governance & Citizen Services Platform).
Your job is to accurately extract citizen details, land records, banking information, and application specifics from uploaded documents (Aadhaar cards, 7/12 land extract receipts, bank passbooks, ration cards, crop damage receipts) and/or natural language user queries/speech transcripts.

Extract values precisely matching the target Form Schema:
Form ID: ${selectedTemplate.id}
Form Title: ${selectedTemplate.title}
Fields to populate:
${JSON.stringify(
  selectedTemplate.fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    options: f.options?.map((o) => o.value),
  })),
  null,
  2
)}

EXTRACTION RULES:
1. Normalize names into proper Capitalized English (or respectful Devanagari if appropriate).
2. Clean Aadhaar numbers to 12 contiguous digits or standard 4-4-4 format without dashes.
3. Clean IFSC codes to standard 11-character uppercase format (e.g. SBIN0001234, MAHB0000123).
4. For Land details (Survey/Gat number, Area in Hectares/Acres), extract exact numbers from the document or text.
5. If a field value cannot be determined from the inputs, set it to "" (empty string). Do NOT hallucinate random numbers.
6. Provide an 'extractionSummary' explaining in 1-2 friendly sentences what was extracted and which documents were recognized.
7. Return strictly a JSON object with this exact schema:
{
  "detectedFormId": "${selectedTemplate.id}",
  "confidenceScore": 0.95,
  "extractionSummary": "string",
  "fields": {
    "applicant_name": "...",
    "father_spouse_name": "...",
    "aadhaar_number": "...",
    "mobile_number": "...",
    "state": "...",
    "district": "...",
    "taluka": "...",
    "village": "...",
    "pincode": "...",
    "bank_name": "...",
    "account_number": "...",
    "ifsc_code": "...",
    ...
  }
}`;

  const prompt = `Please analyze the provided input and extract all form values according to the schema:
User Input Prompt/Voice Transcript: "${rawTextPrompt || "Extract data from uploaded document"}"`;

  const contents: any[] = [];
  const parts: any[] = [];

  if (fileBase64 && fileMimeType) {
    parts.push({
      inlineData: {
        data: fileBase64,
        mimeType: fileMimeType,
      },
    });
  }

  parts.push({ text: prompt });
  contents.push({ role: "user", parts });

  if (isGeminiAvailable() && ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "{}";
      const parsed = JSON.parse(text);
      return {
        success: true,
        template: selectedTemplate,
        data: parsed,
      };
    } catch (err: any) {
      reportGeminiError(err);
    }
  }

  // Multi-model LLM fallback (Groq / OpenRouter / OpenAI)
  try {
    const providerParsed = await generateJsonWithProvider({
      systemInstruction,
      prompt: `${prompt}\nReturn strict JSON matching the requested schema.`,
    });
    if (providerParsed && typeof providerParsed === "object") {
      return {
        success: true,
        template: selectedTemplate,
        data: providerParsed,
      };
    }
  } catch (providerErr: any) {
    // Continue to regex fallback
  }

  // Basic regex fallback if API key or client is unavailable
  const fallbackFields: Record<string, string> = {};
  if (rawTextPrompt) {
    const text = rawTextPrompt;
    const aadhaarMatch = text.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
    if (aadhaarMatch) fallbackFields.aadhaar_number = aadhaarMatch[0].replace(/\s+/g, "");

    const phoneMatch = text.match(/\b[6-9]\d{9}\b/);
    if (phoneMatch) fallbackFields.mobile_number = phoneMatch[0];

    const ifscMatch = text.match(/\b[A-Z]{4}0[A-Z0-9]{6}\b/i);
    if (ifscMatch) fallbackFields.ifsc_code = ifscMatch[0].toUpperCase();
  }

  return {
    success: true,
    template: selectedTemplate,
    data: {
      detectedFormId: selectedTemplate.id,
      confidenceScore: 0.7,
      extractionSummary: "Extracted basic fields using smart parser fallback.",
      fields: fallbackFields,
    },
  };
}
