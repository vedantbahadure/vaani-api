import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Upload,
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Square,
  Printer,
  Download,
  Save,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Landmark,
  ShieldCheck,
  Zap,
  Layers,
  PhoneCall,
  Loader2,
  FileCheck,
  Check,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { useLang } from "../lib/contexts";
import { t } from "../lib/i18n";
import { getFormTemplates, autoFillForm } from "../lib/api";
import { useSpeech } from "../lib/useSpeech";
import { useVoiceRecorder } from "../lib/useVoice";

const SAMPLE_CITIZEN_DATA = {
  pm_kisan: {
    applicant_name: "Ramesh Tukaram Patil",
    father_spouse_name: "Tukaram Shripati Patil",
    gender: "Male",
    category: "OBC",
    aadhaar_number: "482910492817",
    mobile_number: "9823412345",
    dob: "1978-06-14",
    state: "Maharashtra",
    district: "Chhatrapati Sambhajinagar (Aurangabad)",
    taluka: "Paithan",
    village: "Navgaon",
    pincode: "431107",
    bank_name: "State Bank of India (SBI)",
    account_number: "384910294819",
    ifsc_code: "SBIN0001248",
    aadhaar_seeded: "Yes",
    land_ownership: "Single Owner",
    survey_gat_no: "142/2A",
    khata_no: "842",
    land_area_hectares: "2.40 Hectares (approx 6.0 Acres)",
    land_transfer_date: "2015-03-22",
  },
  pmfby: {
    applicant_name: "Sunita Dnyaneshwar Shinde",
    aadhaar_number: "591028471920",
    mobile_number: "9765432109",
    state: "Maharashtra",
    district: "Jalna",
    taluka: "Ambad",
    village: "Dahifal",
    bank_name: "Maharashtra Gramin Bank",
    account_number: "60291827364",
    ifsc_code: "MAHG0004123",
    survey_gat_no: "78/1",
    crop_season: "Kharif",
    crop_name: "Soybean & Cotton",
    sowing_area: "4.5 Acres",
    cause_of_loss: "Unseasonal Rains / Excess Rains",
    loss_date: "2026-08-25",
    loss_percentage: "75%",
  },
  kcc: {
    applicant_name: "Gopal Eknathrao Deshmukh",
    father_spouse_name: "Eknathrao Deshmukh",
    aadhaar_number: "671829401928",
    pan_number: "ABCDE1234F",
    mobile_number: "9421098765",
    village: "Pimpalgaon",
    taluka: "Niphad",
    district: "Nashik",
    state: "Maharashtra",
    pincode: "422209",
    target_bank: "Nashik District Central Co-op Bank (DCCB)",
    existing_account: "0028491827",
    ifsc_code: "NDCB0000014",
    land_holding_acres: "5.0 Acres (Grape Vineyard & Onion)",
    survey_gat_no: "214/3",
    major_crops: "Table Grapes (Thompson Seedless) & Red Onion",
    loan_amount_requested: "250000",
    allied_activities: "2 Holstein Friesian (HF) Milking Dairy Cows",
  },
  ayushman_bharat: {
    applicant_name: "Kavita Bhaskar Jadhav",
    gender: "Female",
    dob: "1982-11-05",
    is_senior_70_plus: "No",
    aadhaar_number: "781920491823",
    mobile_number: "9890123456",
    ration_card_no: "PHH-2719284019",
    family_members_count: "4",
    state: "Maharashtra",
    district: "Solapur",
    taluka: "Pandharpur",
    village: "Karkamb",
    pincode: "413304",
  },
  pm_mudra: {
    applicant_name: "Santosh Vithal Rao (Shri Ganesh Flour & Spices Mill)",
    aadhaar_number: "892019482910",
    pan_number: "XYZPK9876L",
    mobile_number: "9822114477",
    state: "Maharashtra",
    district: "Kolhapur",
    village: "Gandhinagar Main Road",
    pincode: "416119",
    bank_name: "Bank of Maharashtra",
    account_number: "60192837465",
    ifsc_code: "MAHB0000214",
    mudra_category: "Kishore (Rs 50,001 to Rs 5 Lakh)",
    business_activity: "Commercial Spices Grinding, Packaging & Rural Agro-Processing",
    loan_amount_requested: "350000",
    loan_purpose: "Purchase of high-speed stainless steel pulverizer machine and initial inventory batch.",
  },
  pm_vishwakarma: {
    applicant_name: "Maruti Vishwanath Sutar",
    father_spouse_name: "Vishwanath Sutar",
    gender: "Male",
    aadhaar_number: "381920491827",
    mobile_number: "9850123456",
    state: "Maharashtra",
    district: "Satara",
    taluka: "Karad",
    village: "Umbraj",
    pincode: "415109",
    bank_name: "Union Bank of India",
    account_number: "582910293847",
    ifsc_code: "UBIN0532185",
    trade_name: "Carpenter (Suthar)",
    years_in_trade: "18",
    toolkit_voucher_opt_in: "Yes",
    concessional_loan_interest: "Tranche 1 (Rs 1 Lakh)",
  },
  pmay_gramin: {
    applicant_name: "Laxmibai Dashrath Gaikwad",
    father_spouse_name: "Dashrath Gaikwad",
    aadhaar_number: "928104928172",
    job_card_number: "MH-14-002-049/281",
    mobile_number: "9766554433",
    state: "Maharashtra",
    district: "Nanded",
    taluka: "Mukhed",
    village: "Jamb",
    pincode: "431715",
    bank_name: "India Post Payments Bank (IPPB)",
    account_number: "02918273645",
    ifsc_code: "IPOS0000001",
    current_housing_status: "Kutcha Mud House (कच्चे घर)",
    plot_land_available: "Yes",
  },
};

export default function AutoFormFiller() {
  const { lang } = useLang();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("pm_kisan");
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionSummary, setExtractionSummary] = useState("");
  const [promptInput, setPromptInput] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [activeSection, setActiveSection] = useState("all");
  const fileInputRef = useRef(null);

  const { speakText, stopSpeaking, isSpeaking } = useSpeech();
  const { isRecording, startRecording, stopRecording, transcript, interimText, audioLevel } = useVoiceRecorder(lang);

  // Load templates on mount
  useEffect(() => {
    setLoading(true);
    getFormTemplates()
      .then((data) => {
        setTemplates(data || []);
        if (data && data.length > 0) {
          const first = data[0].id;
          setSelectedTemplateId(first);
          loadTemplateFields(first);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  const loadTemplateFields = (templateId) => {
    // Check if user has saved draft in localStorage
    const saved = localStorage.getItem(`vaani_form_draft_${templateId}`);
    if (saved) {
      try {
        setFormData(JSON.parse(saved));
        return;
      } catch (e) {}
    }
    setFormData({});
    setExtractionSummary("");
    setUploadedFileName("");
  };

  const handleSelectTemplate = (id) => {
    setSelectedTemplateId(id);
    loadTemplateFields(id);
  };

  const handleFieldChange = (fieldId, value) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  // Auto-fill from document upload (Aadhaar, 7/12, Passbook, etc.)
  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setExtracting(true);
    toast.info(`Analyzing "${file.name}" with Gemini Vision & OCR...`);

    try {
      const res = await autoFillForm({
        formTypeId: selectedTemplateId,
        file,
        language: lang,
      });

      if (res && res.data && res.data.fields) {
        setFormData((prev) => ({ ...prev, ...res.data.fields }));
        setExtractionSummary(res.data.extractionSummary || "Successfully extracted fields from document.");
        toast.success(`Extracted ${Object.keys(res.data.fields).length} form fields!`);
      }
    } catch (err) {
      toast.error("Could not extract from document. Please verify image clarity.");
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Auto-fill from spoken prompt or text
  const handleTextOrVoiceAutoFill = async (textToProcess) => {
    const prompt = textToProcess || promptInput;
    if (!prompt.trim()) {
      toast.error("Please enter or speak your details first.");
      return;
    }

    setExtracting(true);
    toast.info("Extracting form fields from spoken details...");

    try {
      const res = await autoFillForm({
        formTypeId: selectedTemplateId,
        prompt,
        language: lang,
      });

      if (res && res.data && res.data.fields) {
        setFormData((prev) => ({ ...prev, ...res.data.fields }));
        setExtractionSummary(res.data.extractionSummary || "Successfully extracted fields from voice/text.");
        toast.success(`Extracted ${Object.keys(res.data.fields).length} form fields!`);
      }
    } catch (err) {
      toast.error("Failed to parse details. Please try again.");
    } finally {
      setExtracting(false);
    }
  };

  // Sync transcript from voice recorder
  useEffect(() => {
    if (transcript && !isRecording) {
      setPromptInput(transcript);
      handleTextOrVoiceAutoFill(transcript);
    }
  }, [transcript, isRecording]);

  const handleLoadSample = () => {
    const sample = SAMPLE_CITIZEN_DATA[selectedTemplateId];
    if (sample) {
      setFormData(sample);
      setExtractionSummary("Loaded verified sample citizen application data for demonstration.");
      toast.success("Loaded sample citizen data!");
    }
  };

  const handleSaveDraft = () => {
    localStorage.setItem(`vaani_form_draft_${selectedTemplateId}`, JSON.stringify(formData));
    toast.success("Application draft saved locally!");
  };

  const handleClearForm = () => {
    setFormData({});
    setExtractionSummary("");
    setUploadedFileName("");
    localStorage.removeItem(`vaani_form_draft_${selectedTemplateId}`);
    toast.info("Form cleared.");
  };

  // Calculate completion percentage
  const totalFields = currentTemplate?.fields?.length || 1;
  const filledFieldsCount = currentTemplate?.fields?.filter(
    (f) => formData[f.id] && String(formData[f.id]).trim().length > 0
  ).length || 0;
  const completionPercent = Math.round((filledFieldsCount / totalFields) * 100);

  // Read form aloud for verification (voice accessibility for rural citizens)
  const handleReadAloud = () => {
    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    if (!currentTemplate) return;
    const title = lang === "mr" ? currentTemplate.title_mr : lang === "hi" ? currentTemplate.title_hi : currentTemplate.title;
    
    let speechScript = `${title} चा अर्ज. `;
    if (lang === "hi") speechScript = `${title} का आवेदन पत्र। `;
    if (lang === "en") speechScript = `Application for ${title}. `;

    currentTemplate.fields.forEach((f) => {
      const val = formData[f.id];
      if (val) {
        const fieldName = lang === "mr" ? f.label_mr : lang === "hi" ? f.label_hi : f.label;
        speechScript += `${fieldName}: ${val}. `;
      }
    });

    if (filledFieldsCount === 0) {
      speechScript += lang === "mr" ? "सध्या कोणताही रकाना भरलेला नाही." : lang === "hi" ? "वर्तमान में कोई विवरण नहीं भरा गया है।" : "No fields have been filled yet.";
    }

    speakText(speechScript, lang);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter fields by active section
  const visibleFields = currentTemplate?.fields?.filter((f) => {
    if (activeSection === "all") return true;
    return f.section === activeSection;
  }) || [];

  return (
    <div className="px-4 md:px-10 py-8 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Zap className="w-3.5 h-3.5" />
            <span>AI Multimodal Form Engine</span>
          </div>
          <h1 className="font-head text-3xl md:text-4xl font-light tracking-tight">
            {t(lang, "forms_title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            {t(lang, "forms_sub")}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleReadAloud}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
              isSpeaking
                ? "bg-rose-500 text-white border-rose-500 shadow-md animate-pulse"
                : "bg-card border-border text-foreground hover:bg-accent"
            }`}
          >
            {isSpeaking ? <Square className="w-3.5 h-3.5 fill-current" /> : <Volume2 className="w-3.5 h-3.5 text-primary" />}
            <span>{isSpeaking ? t(lang, "stop") : t(lang, "forms_read_aloud")}</span>
          </button>

          <button
            onClick={() => setShowPrintPreview(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t(lang, "forms_print")} / {t(lang, "forms_export_pdf")}</span>
          </button>
        </div>
      </div>

      {/* Scheme Selector Carousel */}
      <div className="mt-6">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2.5">
          Select Government Scheme / Application Form:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {templates.map((tpl) => {
            const isSelected = tpl.id === selectedTemplateId;
            const title = lang === "mr" ? tpl.title_mr : lang === "hi" ? tpl.title_hi : tpl.title;
            return (
              <button
                key={tpl.id}
                onClick={() => handleSelectTemplate(tpl.id)}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                    : "bg-card border-border hover:bg-accent text-foreground"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {tpl.category}
                  </span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
                <div className="text-xs font-medium line-clamp-2 leading-snug">
                  {title}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Scheme Info Card */}
      {currentTemplate && (
        <div className="mt-5 p-4 rounded-3xl border border-border bg-card/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold text-muted-foreground">{currentTemplate.department}</span>
            </div>
            <h2 className="text-lg font-medium text-foreground">
              {lang === "mr" ? currentTemplate.title_mr : lang === "hi" ? currentTemplate.title_hi : currentTemplate.title}
            </h2>
            <p className="text-xs text-muted-foreground max-w-2xl">
              {lang === "mr" ? currentTemplate.description_mr : lang === "hi" ? currentTemplate.description_hi : currentTemplate.description}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Toll-Free Helpline</div>
              <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                <PhoneCall className="w-3 h-3" />
                {currentTemplate.helpline}
              </div>
            </div>
            <a
              href={currentTemplate.officialPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-full border border-border bg-card hover:bg-accent text-foreground text-xs inline-flex items-center gap-1"
              title="Official Portal"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Three Auto-Fill Extraction Methods */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Method 1: Upload / Scan Photo or Document */}
        <div className="p-5 rounded-3xl border border-border bg-card/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Upload className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-medium">{t(lang, "forms_scan_docs")}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Upload Aadhaar card, 7/12 land extract receipt, bank passbook, ration card, or crop damage photo. Gemini AI extracts all details automatically.
            </p>
          </div>

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.txt"
              onChange={handleDocumentUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={extracting}
              className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 bg-background/50 hover:bg-accent flex items-center justify-center gap-2 text-xs font-medium transition-all cursor-pointer"
            >
              {extracting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Scanning & Extracting Fields...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span>{uploadedFileName ? `Replace: ${uploadedFileName}` : "Click to select document or photo"}</span>
                </>
              )}
            </button>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Required: {currentTemplate?.requiredDocs?.join(" • ")}</span>
            </div>
          </div>
        </div>

        {/* Method 2: Voice Dictation & Text Prompt */}
        <div className="p-5 rounded-3xl border border-border bg-card/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Mic className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-medium">{t(lang, "forms_speak_fill")} / Dictate</h3>
              </div>
              <button
                onClick={handleLoadSample}
                className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
              >
                + Load Sample Data
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Speak or type citizen details in Marathi, Hindi, or English (e.g. name, village, Aadhaar, bank account, land area).
            </p>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder={
                  isRecording
                    ? `Listening in ${lang.toUpperCase()}... speak citizen details clearly.`
                    : "उदा. माझं नाव रमेश पाटील, गाव पैठण, आधार १२३४..., जमीन २.४ हेक्टर कापूस पीक, बँक एसबीआय..."
                }
                rows={2}
                className={`w-full rounded-2xl border bg-background px-3 py-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-primary resize-none transition-all ${
                  isRecording ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-border"
                }`}
              />
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`absolute right-2 bottom-3 p-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isRecording
                    ? "bg-rose-500 text-white animate-pulse shadow-sm shadow-rose-500/30"
                    : "bg-muted hover:bg-accent text-foreground"
                }`}
                title={isRecording ? "Stop recording & parse" : "Speak details"}
              >
                {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-primary" />}
              </button>
            </div>

            {isRecording && (
              <div className="p-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs space-y-1">
                <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Live Speech-to-Text ({lang.toUpperCase()})
                  </span>
                  <span className="text-[10px] text-muted-foreground">Tap mic when done</span>
                </div>
                <div className="text-[11px] text-foreground/90 font-medium italic truncate">
                  “{interimText || "Listening..."}”
                </div>
                <div className="w-full bg-emerald-950/20 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-75"
                    style={{ width: `${Math.max(5, Math.min(100, (audioLevel || 0) * 100))}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => handleTextOrVoiceAutoFill()}
              disabled={extracting || !promptInput.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground hover:opacity-90 text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
            >
              {extracting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Fill Form with AI</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Extraction Summary Notification */}
      {extractionSummary && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{extractionSummary}</span>
          </div>
          <button onClick={() => setExtractionSummary("")} className="text-muted-foreground hover:text-foreground">
            &times;
          </button>
        </motion.div>
      )}

      {/* Form Progress Bar & Section Tabs */}
      <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: "all", label: "All Fields" },
            { id: "personal", label: "1. Personal Info" },
            { id: "address", label: "2. Address & Land" },
            { id: "bank", label: "3. Banking & DBT" },
            { id: "scheme_specific", label: "4. Scheme Specifics" },
          ].map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                activeSection === sec.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {filledFieldsCount}/{totalFields} {t(lang, "forms_fields_extracted")} ({completionPercent}%)
            </span>
            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSaveDraft}
              className="p-2 rounded-xl border border-border bg-card hover:bg-accent text-xs font-medium inline-flex items-center gap-1.5"
              title="Save Draft"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save Draft</span>
            </button>
            <button
              onClick={handleClearForm}
              className="p-2 rounded-xl border border-border bg-card hover:bg-accent text-xs font-medium text-rose-500 inline-flex items-center gap-1.5"
              title="Clear Form"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Form Grid */}
      <div className="mt-4 p-6 rounded-3xl border border-border bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleFields.map((field) => {
            const val = formData[field.id] || "";
            const fieldLabel = lang === "mr" ? field.label_mr : lang === "hi" ? field.label_hi : field.label;
            const hasValue = String(val).trim().length > 0;

            return (
              <div key={field.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1">
                    <span>{fieldLabel}</span>
                    {field.required && <span className="text-rose-500">*</span>}
                  </label>

                  {hasValue && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono inline-flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" /> Auto-filled
                    </span>
                  )}
                </div>

                {field.type === "select" ? (
                  <select
                    value={val}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Select option --</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {lang === "mr" && opt.label_mr ? opt.label_mr : lang === "hi" && opt.label_hi ? opt.label_hi : opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    value={val}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.placeholder || `Enter ${fieldLabel}`}
                    rows={2}
                    className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary resize-none"
                  />
                ) : (
                  <input
                    type={field.type || "text"}
                    value={val}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder={field.placeholder || `Enter ${fieldLabel}`}
                    className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Submission Guidance & Checklist */}
      <div className="mt-8 p-6 rounded-3xl border border-border bg-muted/40">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-semibold">Official Submission Checklist & Next Steps</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
          <div className="p-3.5 rounded-2xl border border-border bg-card">
            <span className="font-bold text-foreground block mb-1">Step 1: Download / Print Form</span>
            Click the print/download button above to generate the official application with barcode and applicant signature block.
          </div>
          <div className="p-3.5 rounded-2xl border border-border bg-card">
            <span className="font-bold text-foreground block mb-1">Step 2: Attach Documents</span>
            Self-attested photocopies of: {currentTemplate?.requiredDocs?.join(", ")}.
          </div>
          <div className="p-3.5 rounded-2xl border border-border bg-card">
            <span className="font-bold text-foreground block mb-1">Step 3: Submit at Center</span>
            Submit at your nearest Gram Panchayat, Talathi / CSC Maha e-Seva Kendra, or online at{" "}
            <a href={currentTemplate?.officialPortalUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              {currentTemplate?.officialPortalUrl?.replace("https://", "")}
            </a>.
          </div>
        </div>
      </div>

      {/* Modal / Print Preview */}
      <AnimatePresence>
        {showPrintPreview && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background text-foreground border border-border rounded-3xl max-w-3xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
                <div>
                  <span className="text-xs uppercase font-mono text-muted-foreground">Official Government Application Preview</span>
                  <h3 className="text-xl font-bold">{currentTemplate?.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Form</span>
                  </button>
                  <button
                    onClick={() => setShowPrintPreview(false)}
                    className="p-2 rounded-full border border-border hover:bg-accent text-xs"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Official Printable Sheet Container */}
              <div id="printable-form-sheet" className="p-6 border border-stone-300 dark:border-stone-700 rounded-2xl bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-sans space-y-6">
                {/* Government Header */}
                <div className="text-center border-b border-stone-300 dark:border-stone-700 pb-4">
                  <div className="text-xs uppercase tracking-widest font-semibold text-stone-500">Government of India / State Administration</div>
                  <h2 className="text-lg font-bold mt-1 uppercase">{currentTemplate?.title}</h2>
                  <div className="text-xs text-stone-500 mt-0.5">{currentTemplate?.department}</div>
                  <div className="mt-2 inline-block px-3 py-0.5 bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-[10px] font-mono rounded">
                    REF NO: VAANI-{selectedTemplateId.toUpperCase()}-{Date.now().toString().slice(-8)}
                  </div>
                </div>

                {/* Form Fields Table */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                  {currentTemplate?.fields?.map((f) => (
                    <div key={f.id} className="border-b border-stone-200 dark:border-stone-800 pb-1">
                      <span className="font-semibold text-stone-600 dark:text-stone-400 block text-[10px] uppercase">
                        {f.label}:
                      </span>
                      <span className="font-medium text-stone-900 dark:text-stone-100">
                        {formData[f.id] || "—"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Declaration & Signature Box */}
                <div className="mt-6 pt-4 border-t border-stone-300 dark:border-stone-700 text-[11px] text-stone-600 dark:text-stone-400 space-y-6">
                  <p>
                    <strong>Applicant Declaration:</strong> I hereby declare that all the information provided above is true and correct to the best of my knowledge. I authorize the verification of my Aadhaar and bank details for Direct Benefit Transfer (DBT).
                  </p>

                  <div className="flex justify-between items-end pt-8">
                    <div>
                      <div>Date: {new Date().toLocaleDateString()}</div>
                      <div>Place: {formData.village || formData.district || "_______________"}</div>
                    </div>
                    <div className="text-center border-t border-stone-400 dark:border-stone-600 pt-1 w-48">
                      Applicant Signature / Thumb Impression
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
