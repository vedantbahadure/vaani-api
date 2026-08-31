export interface SeedDoc {
  title: string;
  domain: string;
  source: string;
  text: string;
}

export const SEED_DOCS: SeedDoc[] = [
  // --- 1. AGRICULTURE & CROP SCHEMES ---
  {
    title: "PM-KISAN Samman Nidhi Scheme",
    domain: "schemes",
    source: "pmkisan.gov.in",
    text: `PM-KISAN (Pradhan Mantri Kisan Samman Nidhi) is a central sector scheme launched in
February 2019 to supplement the financial needs of land-holding farmer families in India.
Under the scheme, eligible farmer families receive an income support of Rs 6,000 per year.
This amount is paid in three equal instalments of Rs 2,000 every four months, transferred
directly into the beneficiary's bank account through Direct Benefit Transfer (DBT).

Eligibility: All land-holding farmer families with cultivable land are eligible, subject to
exclusion criteria. Excluded categories include institutional land holders, families with
members who are or were constitutional post holders, serving or retired government employees
(with some exceptions for Group D / Class IV staff), income tax payers in the last assessment
year, and professionals like doctors, engineers, lawyers and chartered accountants.

How to apply: Farmers can register through the PM-KISAN portal (pmkisan.gov.in), the PM-KISAN
mobile app, or the nearest Common Service Centre (CSC). Required documents include Aadhaar card,
bank account details, and land record/ownership documents (7/12 extract / Khatauni). Aadhaar-based
e-KYC (via OTP, biometric, or face authentication on PM-KISAN app) is mandatory to receive instalments.

Key troubleshooting for farmers: Ensure name spelling matches identically across land records,
Aadhaar and bank account. Keep bank account seeded with Aadhaar for DBT. If an instalment is held up,
check beneficiary status online for 'Land Seeding', 'e-KYC Done', and 'Aadhaar Bank Seeding' status.`,
  },
  {
    title: "Namo Shetkari Mahasanman Nidhi Yojana (Maharashtra)",
    domain: "schemes",
    source: "mahadbt.maharashtra.gov.in",
    text: `Namo Shetkari Mahasanman Nidhi Yojana is a Maharashtra state government scheme launched in
2023 to provide additional annual financial assistance of Rs 6,000 to eligible farmers in Maharashtra.
Combined with the central PM-KISAN scheme (Rs 6,000), eligible farmers in Maharashtra receive a total
of Rs 12,000 per year across six instalments of Rs 2,000 each.

Eligibility: All farmers in Maharashtra approved under the PM-KISAN portal are automatically eligible.
No separate application is required if PM-KISAN e-KYC and land seeding are verified.
Disbursement: Transferred via DBT directly to Aadhaar-linked bank accounts. Farmers can check status
on the MahaDBT portal or PM-KISAN portal.`,
  },
  {
    title: "Pradhan Mantri Fasal Bima Yojana (PMFBY) - Crop Insurance",
    domain: "insurance",
    source: "pmfby.gov.in",
    text: `Pradhan Mantri Fasal Bima Yojana (PMFBY) is the flagship crop insurance scheme of the
Government of India, launched in 2016. It provides comprehensive risk cover for crops against
non-preventable natural risks from pre-sowing to post-harvest stages.

Premium rates paid by farmers: Maximum 2% of sum insured for Kharif food/oilseed crops, 1.5% for
Rabi food/oilseed crops, and 5% for annual commercial/horticultural crops. In states like Maharashtra,
farmers pay only a symbolic token of Rs 1 per application, with the state covering the farmer share.

Coverage: Prevented sowing/planting risk, mid-season adversity (drought, flood, unseasonal rains),
standing crop yield losses, localized calamities (hailstorm, landslide, inundation, cloudburst),
and post-harvest losses up to 14 days after harvesting for crops kept in the field for drying.

Crucial 72-Hour Loss Reporting: In the event of localized calamity or post-harvest loss, the farmer
MUST report the incident within 72 hours via the Crop Insurance App, toll-free number 14447 / 1800-180-1551,
or to the local Taluka Agriculture Officer / Bank branch. Required docs: Crop sowing certificate,
7/12 land extract, bank passbook, and geo-tagged photos of crop damage.`,
  },
  {
    title: "Kisan Credit Card (KCC) & Interest Subvention Scheme",
    domain: "finance",
    source: "nabard.org / rbi.org.in",
    text: `The Kisan Credit Card (KCC) scheme provides farmers with timely, flexible, and affordable
institutional credit for crop cultivation, post-harvest expenses, farm asset maintenance, and allied
activities (dairy, poultry, fisheries, goat farming).

Loan limits & Subsidised Interest: Farmers can get short-term crop loans up to Rs 3 Lakh at a benchmark
subsidised rate of 7% per annum. Under the Modified Interest Subvention Scheme (MISS), farmers who
repay their loans on or before the due date receive an additional 3% Prompt Repayment Incentive (PRI),
bringing the effective interest rate down to just 4% per annum. Collateral-free loan limit is up to
Rs 1.60 Lakh (extendable up to Rs 2 Lakh with tie-up agreements).

Validity: KCC is valid for 5 years with an annual review. It also includes free personal accidental
insurance cover up to Rs 50,000 against death or permanent disability.
Application: Through nationalised banks, regional rural banks (RRB), district cooperative banks (DCCB),
PACS, or the unified Kisan Rin Portal (krishirin.dac.gov.in).`,
  },
  {
    title: "PM-KUSUM Scheme (Solar Agricultural Pumps & Grid Solarization)",
    domain: "schemes",
    source: "pmkusum.mnre.gov.in",
    text: `Pradhan Mantri Kisan Urja Suraksha evam Utthaan Mahabhiyan (PM-KUSUM) enables farmers to
install solar water pumps, solarize existing grid-connected agriculture pumps, and generate clean energy.

Components:
- Component A: Setting up of 10,000 MW decentralized ground-mounted grid-connected solar power plants
  (0.5 MW to 2 MW) on barren/fallow agricultural land by individual farmers, cooperatives, or FPOs.
- Component B: Installation of standalone off-grid solar agriculture water pumps (up to 7.5 HP capacity).
  Central government provides 30% subsidy, State government provides 30% to 60% subsidy, and the farmer
  contributes only 10% to 40% of the total cost.
- Component C: Solarisation of existing grid-connected agriculture pumps and feeder-level solarisation.

Benefits: Day-time reliable irrigation power, elimination of diesel fuel expenditure, and earning extra
income by selling surplus solar electricity back to the state power distribution DISCOM.
Application: Apply via State Nodal Renewable Energy Agency portals (such as MEDA / Mahavitaran in Maharashtra).`,
  },
  {
    title: "Pradhan Mantri Krishi Sinchayee Yojana (PMKSY) - Per Drop More Crop",
    domain: "agriculture",
    source: "pmksy.gov.in",
    text: `PMKSY focuses on expanding irrigable area ('Har Khet Ko Pani') and improving water use efficiency
at the farm level through micro-irrigation systems under 'Per Drop More Crop' (PDMC).

Subsidies: Small and marginal farmers receive 55% subsidy on drip and sprinkler irrigation equipment;
other farmers receive 45% subsidy. In several states, additional top-up subsidies are provided to reach
up to 75%-80% total financial support.
Benefits: 30% to 50% water savings, 20% to 30% reduction in electricity/fuel costs, balanced fertigation
(liquid fertilizer application directly to roots), and 20% to 40% increase in crop productivity.
How to apply: Through State Agriculture / Horticulture Department portals (e.g., MahaDBT in Maharashtra)
submitting 7/12 land extract, 8-A holding, water source proof, electricity bill, and quotation.`,
  },
  {
    title: "Soil Health Card & Paramparagat Krishi Vikas Yojana (PKVY)",
    domain: "agriculture",
    source: "soilhealth.dac.gov.in / pgsi-dac.gov.in",
    text: `Soil Health Card (SHC) provides field-specific nutrient status covering 12 vital parameters:
Macro-nutrients (Nitrogen N, Phosphorus P, Potassium K), Secondary nutrient (Sulphur S), Micronutrients
(Zinc, Iron, Copper, Manganese, Boron), and Physical properties (pH, Electrical Conductivity EC, Organic Carbon OC).
Issued every 2 years by Krishi Vigyan Kendras (KVK) and state testing labs with crop-wise dosage advice.

Paramparagat Krishi Vikas Yojana (PKVY) promotes chemical-free organic and natural farming through cluster
approaches and Participatory Guarantee System (PGS) certification. Financial support of Rs 50,000 per
hectare over 3 years is provided for organic inputs, vermicompost units, bio-fertilizers, and marketing.`,
  },
  {
    title: "e-NAM (National Agriculture Market) & FPO Formation (10,000 FPOs)",
    domain: "agriculture",
    source: "enam.gov.in / sfacindia.com",
    text: `e-NAM is a pan-India electronic trading portal connecting over 1,300 APMC mandis across India,
enabling farmers to discover transparent prices and sell their agricultural produce to online buyers nationally.
Features: Online assaying, e-bidding, digital warehouse receipt financing, and direct bank settlement.

Formation and Promotion of 10,000 Farmer Producer Organisations (FPOs): Central sector scheme providing
management financial support up to Rs 18 Lakh per FPO over 3 years, equity grant matching up to Rs 2,000
per member (max Rs 15 Lakh per FPO), and credit guarantee cover up to Rs 2 Crore through NABARD/NCDC.`,
  },
  {
    title: "Pradhan Mantri Matsya Sampada Yojana (PMMSY) & AHIDF",
    domain: "schemes",
    source: "pmmsy.dof.gov.in / dahd.nic.in",
    text: `PMMSY is the flagship fisheries development scheme with an investment of over Rs 20,050 Crore.
Provides 40% financial assistance for general beneficiaries and 60% for women, SC, and ST beneficiaries
for setting up aquaculture ponds, recirculating aquaculture systems (RAS), biofloc units, fish hatcheries,
refrigerated transport vans, and deep-sea fishing vessels.

Animal Husbandry Infrastructure Development Fund (AHIDF): Provides 3% interest subvention and credit
guarantee for setting up dairy processing plants, meat processing units, cattle feed factories, and
veterinary vaccine manufacturing.`,
  },

  // --- 2. SOCIAL WELFARE, PENSIONS, FOOD SECURITY & HOUSING ---
  {
    title: "Pradhan Mantri Awas Yojana - Gramin (PMAY-G) & Urban (PMAY-U)",
    domain: "schemes",
    source: "pmayg.nic.in / pmayuclap.gov.in",
    text: `PMAY-Gramin provides financial assistance to homeless rural families and those living in kutcha/dilapidated
houses to construct a minimum 25 sq. metre pucca house with hygienic cooking space.

Financial Assistance:
- Plain areas: Rs 1,20,000 per unit.
- Hilly/difficult/North-Eastern/IAP states: Rs 1,30,000 per unit.
- Additional 90 to 95 person-days of unskilled labor wages under MGNREGA (approx Rs 25,000+).
- Rs 12,000 additional financial assistance for toilet construction under Swachh Bharat Mission (Gramin).
- Free LPG connection under PM Ujjwala Yojana and free electricity meter connection under Saubhagya.

Selection: Based on Socio-Economic and Caste Census (SECC) and verified Awas+ survey list.
Disbursement: In 3 to 4 geo-tagged milestone instalments (Foundation, Plinth, Lintel/Roof, Completion)
directly into the woman head of household's bank account via DBT.`,
  },
  {
    title: "Pradhan Mantri Garib Kalyan Anna Yojana (PMGKAY) - Food Security",
    domain: "schemes",
    source: "dfpd.gov.in / nfsa.gov.in",
    text: `Under the National Food Security Act (NFSA) and PMGKAY, the Government of India provides FREE
foodgrains (rice, wheat, coarse grains) to over 81.35 Crore beneficiaries across India through 2028.

Entitlements:
- Antyodaya Anna Yojana (AAY) poorest households: 35 kg of free foodgrains per family per month.
- Priority Household (PHH) ration card holders: 5 kg of free foodgrains per person per month.
- One Nation One Ration Card (ONORC): Beneficiaries and migrant workers can collect their subsidized/free
  ration from ANY Fair Price Shop (FPS) across India using biometric Aadhaar authentication on e-POS devices.
Toll-free National Food Helpline: 1967.`,
  },
  {
    title: "National Social Assistance Programme (NSAP) & State Old Age / Widow Pensions",
    domain: "schemes",
    source: "nsap.nic.in",
    text: `NSAP delivers monthly social pensions to impoverished elderly, widows, and persons with severe disabilities.

Central Components:
- Indira Gandhi National Old Age Pension Scheme (IGNOAPS): For BPL persons aged 60-79 years (Rs 200/mo central
  + state contribution) and for 80+ years (Rs 500/mo central + state contribution). In states like Maharashtra
  (Sanjay Gandhi Niradhar Yojana / Shravanbal Yojana), the total monthly pension is Rs 1,500 per month.
- Indira Gandhi National Widow Pension Scheme (IGNWPS): Monthly pension for BPL widows aged 40-79 years.
- Indira Gandhi National Disability Pension Scheme (IGNDPS): For BPL persons aged 18+ with 80%+ severe disability.
- National Family Benefit Scheme (NFBS): One-time lumpsum grant of Rs 20,000 to a BPL family upon the death
  of the primary breadwinner (aged 18-59).
Application: Through the local Gram Panchayat, Tehsil / Talathi office, or State e-District / DBT portals.`,
  },
  {
    title: "Pradhan Mantri Shram Yogi Maan-dhan (PM-SYM) & PM Kisan Maandhan",
    domain: "schemes",
    source: "maandhan.in / eshram.gov.in",
    text: `Voluntary and contributory pension schemes for unorganized workers, daily wage laborers, rickshaw drivers,
domestic workers, and small/marginal farmers with monthly income of Rs 15,000 or less.

Benefits: Guaranteed assured lifelong monthly pension of Rs 3,000 after attaining 60 years of age.
Family pension: 50% of pension to spouse upon beneficiary's demise.
Contributions: 50:50 matching co-contribution between beneficiary and Central Government.
Entry age 18 to 40 years; monthly contribution ranges from Rs 55 (at age 18) to Rs 200 (at age 40).
Enrolment: Instant registration at any Common Service Centre (CSC) with Aadhaar and Jan Dhan/Savings Bank passbook.`,
  },
  {
    title: "Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA)",
    domain: "schemes",
    source: "nrega.nic.in",
    text: `MGNREGA legally guarantees at least 100 days of wage employment in every financial year to every rural
household whose adult members volunteer to do unskilled manual work.

Key Provisions:
- Legal Right to Work: Must be provided within 15 days of applying; otherwise, statutory unemployment allowance
  is payable by the State Government.
- Equal wages for men and women paid directly into bank/post office accounts via Aadhaar-Based Payment System (ABPS).
- Worksite amenities: Crèche, drinking water, first aid, and shade must be provided.
- Permissible Works: Water conservation, check dams, farm ponds, percolation tanks, rural roads, individual
  land development for SC/ST/small farmers, compost pits, and cattle sheds.
- Job Card: Issued free of cost by the local Gram Panchayat within 15 days of application with photos of adult members.`,
  },

  // --- 3. HEALTHCARE & MOTHER-CHILD WELFARE ---
  {
    title: "Ayushman Bharat PM-JAY & ABHA Health Account",
    domain: "schemes",
    source: "nha.gov.in / pmjay.gov.in",
    text: `Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (AB-PMJAY) is the world's largest government-funded
health assurance scheme, providing free secondary and tertiary hospitalization cover.

Benefits:
- Cashless and paperless inpatient hospitalization cover up to Rs 5,00,000 per family per year across 27,000+
  empanelled public and private hospitals across India.
- No cap on family size, age, or gender. Pre-existing diseases are covered from Day 1.
- All senior citizens aged 70 years and above (Ayushman Vay Vandana Card) receive a distinct Rs 5,00,000
  annual top-up health cover regardless of income.
- Covers 1,949 medical packages including cardiac surgery, joint replacements, chemotherapy, ICU care,
  medications, and 15 days post-discharge diagnostics.

ABHA (Ayushman Bharat Health Account): A 14-digit digital health ID that securely links all your electronic
medical records, lab tests, prescriptions, and discharge summaries across all clinics and hospitals.
Toll-free 24x7 Helpline: 14555. Check eligibility at beneficiary.nha.gov.in with Aadhaar or Ration Card.`,
  },
  {
    title: "Pradhan Mantri Matru Vandana Yojana (PMMVY) & Janani Suraksha Yojana (JSY)",
    domain: "schemes",
    source: "pmmvy.wcd.gov.in / nhm.gov.in",
    text: `PMMVY provides direct maternity cash incentives to pregnant women and lactating mothers for health,
nutrition, and compensation for wage loss during pregnancy and childbirth.

Incentives:
- First Child: Rs 5,000 in two instalments (Rs 3,000 upon early pregnancy registration & at least one ANC checkup;
  Rs 2,000 upon child birth registration and first cycle of vaccinations).
- Second Child (if female child): One-time incentive of Rs 6,000 upon institutional birth and complete immunization
  to promote child sex ratio and prevent female feticide.

Janani Suraksha Yojana (JSY): Additional cash assistance of Rs 1,400 (in rural areas) for institutional delivery
in government or accredited private hospitals with free ambulance and diet support.
Application: Through Anganwadi Centers, ASHA workers, or online at pmmvy.wcd.gov.in.`,
  },
  {
    title: "Pradhan Mantri Bharatiya Janaushadhi Pariyojana (PMBJP)",
    domain: "schemes",
    source: "janaushadhi.gov.in",
    text: `PMBJP delivers high-quality generic medicines, surgical instruments, and nutraceuticals at prices
50% to 90% cheaper than branded market equivalents through over 10,000+ Jan Aushadhi Kendras.

Features:
- Over 2,000 generic medicines and 300 surgical items covering cardiovascular, diabetes, cancer, antibiotics,
  vitamins, pain relief, and chronic illnesses.
- Suvidha Oxo-biodegradable Sanitary Napkins available at just Rs 1 per pad for menstrual hygiene.
- Any individual pharmacist, NGO, cooperative society, or PACS can apply to open a Jan Aushadhi Kendra with
  government incentives up to Rs 5 Lakh for setup and sales margin.`,
  },

  // --- 4. WOMEN EMPOWERMENT, LIVELIHOODS & SHGs ---
  {
    title: "Deendayal Antyodaya Yojana - NRLM & Lakhpati Didi Initiative",
    domain: "schemes",
    source: "aajeevika.gov.in / nrlm.gov.in",
    text: `DAY-NRLM (National Rural Livelihoods Mission) mobilizes rural women into Self-Help Groups (SHGs),
Village Organizations (VO), and Cluster Level Federations (CLF) to achieve sustainable livelihoods and financial independence.

Key Supports:
- Revolving Fund (RF): Rs 20,000 to Rs 30,000 per eligible SHG.
- Community Investment Fund (CIF): Up to Rs 1.5 Lakh per SHG for initiating collective micro-enterprises.
- Collateral-Free Bank Loans: SHGs can access collateral-free loans up to Rs 20 Lakh with interest subvention
  reducing effective interest to 7% per annum.
- Lakhpati Didi Scheme: National initiative to enable over 3 Crore rural women SHG members to earn a sustainable
  annual income of at least Rs 1 Lakh through skills in agro-processing, livestock, drone operation (Namo Drone Didi),
  solar assembly, tailoring, and micro-enterprises.`,
  },
  {
    title: "Pradhan Mantri Ujjwala Yojana (PMUY) - Free LPG Gas",
    domain: "schemes",
    source: "pmuy.gov.in",
    text: `PMUY provides deposit-free LPG gas connections to women belonging to poor households to safeguard health
from hazardous smoke from biomass burning.

Benefits:
- Free LPG connection including security deposit for cylinder, regulator, safety hose pipe, domestic gas passbook,
  and installation charges paid by the Government of India.
- Free first 14.2 kg LPG cylinder refill and hotplate/gas stove.
- Targeted subsidy of Rs 300 per refill directly credited into the woman beneficiary's bank account for up to 12 refills/year.
Eligibility: Adult woman from BPL / SC / ST / PMAY / Antyodaya / Forest dweller / Most backward class households
without an existing LPG connection. Apply at any Indane, Bharatgas, or HP Gas distributor.`,
  },
  {
    title: "Sukanya Samriddhi Yojana (SSY) & Mahila Samman Savings Certificate",
    domain: "finance",
    source: "indiapost.gov.in / rbi.org.in",
    text: `Government-backed high-yield small savings schemes for girls and women.

Sukanya Samriddhi Yojana (SSY):
- Opened by parents for a girl child below 10 years of age at any Post Office or commercial bank.
- Highest government interest rate (currently ~8.2% per annum compounded annually) with full Section 80C tax deduction
  and tax-free maturity interest.
- Minimum annual deposit Rs 250 (max Rs 1.5 Lakh/year). Matures after 21 years with 50% partial withdrawal allowed
  after girl turns 18 for higher education.

Mahila Samman Savings Certificate:
- 2-year deposit scheme for women and girls offering guaranteed 7.5% per annum fixed interest with partial withdrawal facility.`,
  },

  // --- 5. COOPERATIVES, PACS & RURAL GOVERNANCE ---
  {
    title: "Primary Agricultural Credit Societies (PACS) & Model Bye-Laws",
    domain: "pacs",
    source: "Ministry of Cooperation (cooperation.gov.in)",
    text: `PACS are village-level cooperative credit institutions serving as the cornerstone of rural India's economy.
Governed by State Cooperative Societies Acts and guided by the Ministry of Cooperation's Model Bye-Laws.

Key Transformations:
- National ERP Computerisation: Over 63,000 PACS digitized on a unified cloud platform linked to NABARD, DCCBs,
  and StCBs for real-time online accounting, transparency, and instant credit delivery.
- Multi-Purpose Service Hubs: PACS now operate Common Service Centres (CSCs offering 300+ e-governance services),
  PM Kisan Samruddhi Kendras (fertilizer, seed, soil testing), Jan Aushadhi Kendras, LPG cylinder distribution,
  petrol pumps, custom hiring centres for farm machinery, and decentralized grain storage facilities.
Membership: Any rural resident can become a member by purchasing shares with one-member-one-vote democratic rights.`,
  },
  {
    title: "Cooperative Societies Act - Governance, Elections & Member Rights",
    domain: "cooperative",
    source: "cooperation.gov.in / Cooperative Acts",
    text: `Cooperative principles: Voluntary and open membership, democratic member control, member economic participation,
autonomy, continuous education, and community concern (97th Constitutional Amendment).

Key Legal Rights & Protocols:
- Right to Vote: Every active member has one vote regardless of share capital.
- Right to Information & Audit: Right to inspect audited balance sheets, profit-loss accounts, and voter rolls.
- Managing Committee Elections: Conducted democratically every 5 years by the State Cooperative Election Authority.
- Dispute Redressal: Cooperative disputes (elections, recovery, management) are adjudicated through the Cooperative Court /
  Registrar of Cooperative Societies (RCS), rather than standard civil courts.
- Dividend & Reserve Fund: Minimum 25% of net profits must be transferred to the statutory Reserve Fund before
  declaring dividends to members.`,
  },

  // --- 6. MSME, ENTREPRENEURSHIP, SKILLS & BUSINESS LOANS ---
  {
    title: "PM Mudra Yojana (PMMY) - Collateral-Free Business Loans",
    domain: "finance",
    source: "mudra.org.in",
    text: `Pradhan Mantri MUDRA Yojana delivers collateral-free loans up to Rs 20 Lakh to non-corporate, non-farm
micro and small enterprises (shops, artisans, food processing, transport, small manufacturing).

Categories:
1. Shishu: Loans up to Rs 50,000 (for new micro-startups and street vendors).
2. Kishore: Loans from Rs 50,001 to Rs 5 Lakh (for equipment purchase and business expansion).
3. Tarun: Loans from Rs 5 Lakh to Rs 10 Lakh.
4. Tarun Plus: Loans up to Rs 20 Lakh for entrepreneurs who have successfully repaid previous Tarun loans.
Features: Zero processing fee for Shishu/Kishore, no collateral security, Mudra Debit Card for working capital.
Apply at any public sector bank, private bank, RRB, microfinance institution, or via udyamimitra.in.`,
  },
  {
    title: "PM Vishwakarma Scheme - Traditional Artisans & Craftspeople",
    domain: "schemes",
    source: "pmvishwakarma.gov.in",
    text: `Central sector scheme providing holistic end-to-end support to traditional artisans and craftspeople
working with hands and tools across 18 designated trades (Carpenters, Blacksmiths, Potters, Sculptors, Cobblers,
Masons, Basket/Mat weavers, Tailors, Barbers, Washermen, etc.).

Benefits:
- Recognition: PM Vishwakarma Certificate and ID Card.
- Skill Training: 5-7 days basic training and 15+ days advanced training with a daily stipend of Rs 500/day.
- Toolkit Incentive: Modern digital toolkit grant of Rs 15,000 via e-RUPI voucher.
- Subsidised Collateral-Free Loans: Enterprise development loans up to Rs 3 Lakh in two tranches (Tranche 1:
  Rs 1 Lakh for 18 months; Tranche 2: Rs 2 Lakh for 30 months) at a concessional interest rate of just 5%
  (with 8% interest subvention paid by GoI).
- Digital Transaction Incentive: Rs 1 per digital transaction (up to 100 transactions per month).
Apply free at any Common Service Centre (CSC).`,
  },
  {
    title: "PM Employment Generation Programme (PMEGP) & Stand-Up India",
    domain: "finance",
    source: "kviconline.gov.in / standupmitra.in",
    text: `PMEGP is a major credit-linked subsidy program administered by KVIC to establish micro-enterprises in rural and urban areas.

Subsidies:
- Manufacturing Sector: Maximum project cost up to Rs 50 Lakh.
- Service Sector: Maximum project cost up to Rs 20 Lakh.
- Margin Money Subsidy: In rural areas, 25% subsidy for general category and 35% subsidy for special categories
  (SC, ST, OBC, Women, Ex-servicemen, PH, Minorities). Beneficiary contribution is only 5% to 10%.
- Upgradation of existing PMEGP units: Second loan up to Rs 1 Crore (manufacturing) with 15% to 20% subsidy.

Stand-Up India Scheme: Bank loans between Rs 10 Lakh and Rs 1 Crore to at least one SC/ST borrower and at least
one woman borrower per bank branch for setting up greenfield manufacturing, service, or trading enterprises.`,
  },
  {
    title: "PM SVANidhi Scheme - Street Vendors Micro-Credit",
    domain: "schemes",
    source: "pmsvanidhi.mohua.gov.in",
    text: `Special micro-credit facility for urban, peri-urban, and rural street vendors to resume and expand livelihoods.

Loan Tranches:
1. 1st Tranche: Working capital loan up to Rs 10,000 (repayable in 12 months).
2. 2nd Tranche: Enhanced loan up to Rs 20,000 upon timely repayment of first loan.
3. 3rd Tranche: Up to Rs 50,000 with collateral-free terms.
Interest Subvention: 7% interest subsidy per annum credited directly to bank account on timely repayment.
Cashback Incentives: Up to Rs 1,200 per year for adopting digital QR code transactions.`,
  },

  // --- 7. FINANCIAL SECURITY, INSURANCE & CITIZEN HELPLINES ---
  {
    title: "PMJJBY, PMSBY & Atal Pension Yojana (APY) - Social Security Trinity",
    domain: "finance",
    source: "financialservices.gov.in / pfrda.org.in",
    text: `Low-cost government social security micro-insurance and pension schemes:

1. Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY):
   - Pure term life insurance cover of Rs 2,00,000 for death due to any cause.
   - Age eligibility: 18 to 50 years with a bank/post office account.
   - Annual premium: Rs 436 per year (auto-debited from savings account).

2. Pradhan Mantri Suraksha Bima Yojana (PMSBY):
   - Accidental death and full permanent disability cover of Rs 2,00,000 (Rs 1,00,000 for partial disability).
   - Age eligibility: 18 to 70 years.
   - Annual premium: Just Rs 20 per year.

3. Atal Pension Yojana (APY):
   - Guaranteed lifelong monthly pension of Rs 1,000, Rs 2,000, Rs 3,000, Rs 4,000, or Rs 5,000 starting from age 60.
   - Open to all Indian citizens aged 18 to 40 years (non-taxpayers).
   - Same pension continues to spouse upon subscriber's death; full corpus returned to nominee.`,
  },
  {
    title: "Essential Citizen Helplines & Consumer / Cyber Fraud Protection",
    domain: "faq",
    source: "mha.gov.in / consumerhelpline.gov.in",
    text: `Emergency Government Helplines across India:
- National Emergency Number (Police / Fire / Ambulance): 112
- Cyber Crime Financial Fraud Helpline: 1930 (Report within golden hour at cybercrime.gov.in to freeze stolen funds)
- Kisan Call Centre (Agriculture / Crops / Diseases): 1800-180-1551 (Toll-Free, 6 AM to 10 PM daily in all Indian languages)
- National Consumer Helpline (Fraud, disputes, complaints): 1915 or SMS 8800001915
- Women Helpline (All-India 24x7 Domestic & Distress): 181
- Childline (Child protection & rescue): 1098
- Senior Citizen National Helpline (Elder Line): 14567
- Ayushman Bharat PM-JAY Hospitalization Helpline: 14555
- PM-KISAN Scheme Official Helpline: 155261 / 011-24300606
- PMFBY Crop Insurance Loss Claim Helpline: 14447.

Safety Rule: Never share 4/6-digit UPI PINs, Aadhaar OTPs, or CVVs. Government offices never charge processing fees via WhatsApp.`,
  },
];
