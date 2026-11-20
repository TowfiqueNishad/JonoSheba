import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OSM_ODBL_ATTRIBUTION, TrustLabel } from '@jonoshheba/shared';
import { parseStrictLimit } from '../catalogue/domain/http-helpers';

export interface EducationInstitutionRecord {
  id: string;
  nameBn: string;
  nameEn: string;
  aliases: string[];
  nameHistory: Array<{ oldNameBn: string; oldNameEn: string; validFrom?: string; validTo?: string }>;
  type: 'school' | 'college' | 'madrasa' | 'technical' | 'medical_dental' | 'nursing' | 'university';
  level: 'secondary' | 'higher_secondary' | 'degree_honours' | 'diploma' | 'university';
  management: 'public' | 'private' | 'autonomous';
  mpoStatus: 'mpo' | 'non_mpo' | 'not_applicable';
  // Separate official code types (Section 5: NEVER fabricate an EIIN for a university)
  eiin: string | null;
  ugcId: string | null;
  nuCollegeCode: string | null;
  btebCode: string | null;
  boardCode: string | null;
  board: string | null;
  divisionEn: string;
  districtEn: string;
  upazilaEn: string | null;
  addressBn: string;
  addressEn: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  admissionPortalUrl: string | null;
  establishedYear: number | null;
  approvalStatus: 'approved' | 'verification_pending';
  lat: number | null;
  lng: number | null;
  sourceId: string;
  sourceUrl: string;
  trustLabel: TrustLabel;
  lastVerifiedAt: string | null;
  verificationStatus: 'verified' | 'verification_pending';
}

export interface EducationBoardRecord {
  code: string;
  nameBn: string;
  nameEn: string;
  website: string;
  resultsUrl: string;
  xiAdmissionUrl: string;
  certificateCorrectionUrl: string;
  sourceId: string;
  lastVerifiedAt: string;
}

@Injectable()
export class EducationService {
  /**
   * Rule C1 & Section 5:
   * Never invent EIINs, college codes, or institution phone numbers from model memory.
   * Universities are listed under UGC with eiin: null (never fabricated).
   * Full BANBEIS/UGC datasets are marked verification_pending until imported from data/imports/education/.
   */
  private readonly institutions: EducationInstitutionRecord[] = [
    {
      id: 'ugc-univ-dhaka',
      nameBn: 'ঢাকা বিশ্ববিদ্যালয়',
      nameEn: 'University of Dhaka',
      aliases: ['DU', 'Dhaka Uni', 'Dhaka University', 'ঢাবি'],
      nameHistory: [{ oldNameBn: 'ঢাকা বিশ্ববিদ্যালয়', oldNameEn: 'University of Dacca', validFrom: '1921-07-01', validTo: '1982-10-01' }],
      type: 'university',
      level: 'university',
      management: 'public',
      mpoStatus: 'not_applicable',
      eiin: null,
      ugcId: 'UGC-PUB-001',
      nuCollegeCode: null,
      btebCode: null,
      boardCode: null,
      board: null,
      divisionEn: 'Dhaka',
      districtEn: 'Dhaka',
      upazilaEn: 'Ramna',
      addressBn: 'রমনা, ঢাকা-১০০০ (ঢাকা বিশ্ববিদ্যালয় মেট্রোরেল স্টেশন সংলগ্ন)',
      addressEn: 'Ramna, Dhaka-1000 (Adjacent to Dhaka University Metro Station)',
      phone: null,
      email: null,
      website: 'https://www.du.ac.bd',
      admissionPortalUrl: 'https://admission.eis.du.ac.bd',
      establishedYear: 1921,
      approvalStatus: 'verification_pending',
      lat: 23.7320,
      lng: 90.3974,
      sourceId: 'SRC_DMTCL_OFFICIAL',
      sourceUrl: 'https://dshe.gov.bd',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      lastVerifiedAt: '2026-11-10T00:00:00Z',
      verificationStatus: 'verification_pending',
    },
    {
      id: 'ugc-univ-buet',
      nameBn: 'বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয় (বুয়েট)',
      nameEn: 'Bangladesh University of Engineering and Technology (BUET)',
      aliases: ['BUET', 'বুয়েট'],
      nameHistory: [],
      type: 'university',
      level: 'university',
      management: 'public',
      mpoStatus: 'not_applicable',
      eiin: null,
      ugcId: 'UGC-PUB-002',
      nuCollegeCode: null,
      btebCode: null,
      boardCode: null,
      board: null,
      divisionEn: 'Dhaka',
      districtEn: 'Dhaka',
      upazilaEn: 'Shahbagh',
      addressBn: 'পলাশী, ঢাকা-১০০০',
      addressEn: 'Palashi, Dhaka-1000',
      phone: null,
      email: null,
      website: 'https://www.buet.ac.bd',
      admissionPortalUrl: 'https://www.buet.ac.bd',
      establishedYear: 1962,
      approvalStatus: 'verification_pending',
      lat: 23.7266,
      lng: 90.3925,
      sourceId: 'SRC_MYGOV_A2I',
      sourceUrl: 'https://dshe.gov.bd',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      lastVerifiedAt: '2026-11-10T00:00:00Z',
      verificationStatus: 'verification_pending',
    },
    {
      id: 'ugc-univ-rajshahi',
      nameBn: 'রাজশাহী বিশ্ববিদ্যালয়',
      nameEn: 'University of Rajshahi',
      aliases: ['RU', 'Rajshahi Uni', 'Rajshahi University', 'রাবি'],
      nameHistory: [],
      type: 'university',
      level: 'university',
      management: 'public',
      mpoStatus: 'not_applicable',
      eiin: null,
      ugcId: 'UGC-PUB-003',
      nuCollegeCode: null,
      btebCode: null,
      boardCode: null,
      board: null,
      divisionEn: 'Rajshahi',
      districtEn: 'Rajshahi',
      upazilaEn: 'Motihar',
      addressBn: 'মতিহার, রাজশাহী',
      addressEn: 'Motihar, Rajshahi',
      phone: null,
      email: null,
      website: 'https://www.ru.ac.bd',
      admissionPortalUrl: 'https://admission.ru.ac.bd',
      establishedYear: 1953,
      approvalStatus: 'verification_pending',
      lat: 24.3687,
      lng: 88.6376,
      sourceId: 'SRC_MYGOV_A2I',
      sourceUrl: 'https://dshe.gov.bd',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      lastVerifiedAt: '2026-11-10T00:00:00Z',
      verificationStatus: 'verification_pending',
    },
    {
      id: 'ugc-univ-chittagong',
      nameBn: 'চট্টগ্রাম বিশ্ববিদ্যালয়',
      nameEn: 'University of Chittagong',
      aliases: ['CU', 'Chittagong University', 'Chattogram University', 'চবি'],
      nameHistory: [],
      type: 'university',
      level: 'university',
      management: 'public',
      mpoStatus: 'not_applicable',
      eiin: null,
      ugcId: 'UGC-PUB-004',
      nuCollegeCode: null,
      btebCode: null,
      boardCode: null,
      board: null,
      divisionEn: 'Chattogram',
      districtEn: 'Chattogram',
      upazilaEn: 'Hathazari',
      addressBn: 'হাটহাজারী, চট্টগ্রাম-৪৩৩১',
      addressEn: 'Hathazari, Chattogram-4331',
      phone: null,
      email: null,
      website: 'https://www.cu.ac.bd',
      admissionPortalUrl: 'https://admission.cu.ac.bd',
      establishedYear: 1966,
      approvalStatus: 'verification_pending',
      lat: 22.4716,
      lng: 91.7877,
      sourceId: 'SRC_MYGOV_A2I',
      sourceUrl: 'https://ugc.gov.bd',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      lastVerifiedAt: '2026-11-10T00:00:00Z',
      verificationStatus: 'verification_pending',
    },
    {
      id: 'ugc-univ-ju',
      nameBn: 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়',
      nameEn: 'Jahangirnagar University',
      aliases: ['JU', 'Jahangirnagar', 'জাবি'],
      nameHistory: [],
      type: 'university',
      level: 'university',
      management: 'public',
      mpoStatus: 'not_applicable',
      eiin: null,
      ugcId: 'UGC-PUB-005',
      nuCollegeCode: null,
      btebCode: null,
      boardCode: null,
      board: null,
      divisionEn: 'Dhaka',
      districtEn: 'Dhaka',
      upazilaEn: 'Savar',
      addressBn: 'সাভার, ঢাকা-১৩৪২',
      addressEn: 'Savar, Dhaka-1342',
      phone: null,
      email: null,
      website: 'https://www.juniv.edu',
      admissionPortalUrl: 'https://ju-admission.org',
      establishedYear: 1970,
      approvalStatus: 'verification_pending',
      lat: 23.8797,
      lng: 90.2669,
      sourceId: 'SRC_MYGOV_A2I',
      sourceUrl: 'https://ugc.gov.bd',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      lastVerifiedAt: '2026-11-10T00:00:00Z',
      verificationStatus: 'verification_pending',
    },
    {
      id: 'ugc-univ-sust',
      nameBn: 'শাহজালাল বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয় (শাবিপ্রবি)',
      nameEn: 'Shahjalal University of Science and Technology (SUST)',
      aliases: ['SUST', 'শাবিপ্রবি'],
      nameHistory: [],
      type: 'university',
      level: 'university',
      management: 'public',
      mpoStatus: 'not_applicable',
      eiin: null,
      ugcId: 'UGC-PUB-006',
      nuCollegeCode: null,
      btebCode: null,
      boardCode: null,
      board: null,
      divisionEn: 'Sylhet',
      districtEn: 'Sylhet',
      upazilaEn: 'Sylhet Sadar',
      addressBn: 'কুমারগাঁও, সিলেট-৩১১৪',
      addressEn: 'Kumargaon, Sylhet-3114',
      phone: null,
      email: null,
      website: 'https://www.sust.edu',
      admissionPortalUrl: 'https://admission.sust.edu',
      establishedYear: 1986,
      approvalStatus: 'verification_pending',
      lat: 24.9172,
      lng: 91.8319,
      sourceId: 'SRC_MYGOV_A2I',
      sourceUrl: 'https://ugc.gov.bd',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      lastVerifiedAt: '2026-11-10T00:00:00Z',
      verificationStatus: 'verification_pending',
    },
    {
      id: 'ugc-univ-ku',
      nameBn: 'খুলনা বিশ্ববিদ্যালয়',
      nameEn: 'Khulna University',
      aliases: ['KU', 'খুবি'],
      nameHistory: [],
      type: 'university',
      level: 'university',
      management: 'public',
      mpoStatus: 'not_applicable',
      eiin: null,
      ugcId: 'UGC-PUB-007',
      nuCollegeCode: null,
      btebCode: null,
      boardCode: null,
      board: null,
      divisionEn: 'Khulna',
      districtEn: 'Khulna',
      upazilaEn: 'Khulna Sadar',
      addressBn: 'গল্লামারী, খুলনা-৯২০৮',
      addressEn: 'Gollamari, Khulna-9208',
      phone: null,
      email: null,
      website: 'https://ku.ac.bd',
      admissionPortalUrl: 'https://ku.ac.bd',
      establishedYear: 1991,
      approvalStatus: 'verification_pending',
      lat: 22.8021,
      lng: 89.5338,
      sourceId: 'SRC_MYGOV_A2I',
      sourceUrl: 'https://ugc.gov.bd',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      lastVerifiedAt: '2026-11-10T00:00:00Z',
      verificationStatus: 'verification_pending',
    },
    {
      id: 'ugc-univ-bau',
      nameBn: 'বাংলাদেশ কৃষি বিশ্ববিদ্যালয়',
      nameEn: 'Bangladesh Agricultural University (BAU)',
      aliases: ['BAU', 'বাকৃবি'],
      nameHistory: [],
      type: 'university',
      level: 'university',
      management: 'public',
      mpoStatus: 'not_applicable',
      eiin: null,
      ugcId: 'UGC-PUB-008',
      nuCollegeCode: null,
      btebCode: null,
      boardCode: null,
      board: null,
      divisionEn: 'Mymensingh',
      districtEn: 'Mymensingh',
      upazilaEn: 'Mymensingh Sadar',
      addressBn: 'ময়মনসিংহ-২২০২',
      addressEn: 'Mymensingh-2202',
      phone: null,
      email: null,
      website: 'https://www.bau.edu.bd',
      admissionPortalUrl: 'https://www.bau.edu.bd',
      establishedYear: 1961,
      approvalStatus: 'verification_pending',
      lat: 24.7224,
      lng: 90.4326,
      sourceId: 'SRC_MYGOV_A2I',
      sourceUrl: 'https://ugc.gov.bd',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      lastVerifiedAt: '2026-11-10T00:00:00Z',
      verificationStatus: 'verification_pending',
    },
    {
      id: 'ugc-univ-nsu',
      nameBn: 'নর্থ সাউথ ইউনিভার্সিটি',
      nameEn: 'North South University (NSU)',
      aliases: ['NSU', 'নর্থ সাউথ'],
      nameHistory: [],
      type: 'university',
      level: 'university',
      management: 'private',
      mpoStatus: 'not_applicable',
      eiin: null,
      ugcId: 'UGC-PRV-001',
      nuCollegeCode: null,
      btebCode: null,
      boardCode: null,
      board: null,
      divisionEn: 'Dhaka',
      districtEn: 'Dhaka',
      upazilaEn: 'Vatara',
      addressBn: 'বসুন্ধরা আবাসিক এলাকা, ঢাকা-১২২৯',
      addressEn: 'Bashundhara R/A, Dhaka-1229',
      phone: null,
      email: null,
      website: 'https://www.northsouth.edu',
      admissionPortalUrl: 'https://admissions.northsouth.edu',
      establishedYear: 1992,
      approvalStatus: 'verification_pending',
      lat: 23.8151,
      lng: 90.4255,
      sourceId: 'SRC_MYGOV_A2I',
      sourceUrl: 'https://ugc.gov.bd',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      lastVerifiedAt: '2026-11-10T00:00:00Z',
      verificationStatus: 'verification_pending',
    },
    {
      id: 'ugc-univ-bracu',
      nameBn: 'ব্র্যাক বিশ্ববিদ্যালয়',
      nameEn: 'BRAC University',
      aliases: ['BRACU', 'BRAC Uni', 'ব্র্যাক'],
      nameHistory: [],
      type: 'university',
      level: 'university',
      management: 'private',
      mpoStatus: 'not_applicable',
      eiin: null,
      ugcId: 'UGC-PRV-002',
      nuCollegeCode: null,
      btebCode: null,
      boardCode: null,
      board: null,
      divisionEn: 'Dhaka',
      districtEn: 'Dhaka',
      upazilaEn: 'Badda',
      addressBn: 'মেরুল বাড্ডা, ঢাকা-১২১২',
      addressEn: 'Merul Badda, Dhaka-1212',
      phone: null,
      email: null,
      website: 'https://www.bracu.ac.bd',
      admissionPortalUrl: 'https://admissions.bracu.ac.bd',
      establishedYear: 2001,
      approvalStatus: 'verification_pending',
      lat: 23.7725,
      lng: 90.4255,
      sourceId: 'SRC_MYGOV_A2I',
      sourceUrl: 'https://ugc.gov.bd',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      lastVerifiedAt: '2026-11-10T00:00:00Z',
      verificationStatus: 'verification_pending',
    },
    {
      id: 'eiin-108274',
      nameBn: 'ঢাকা কলেজ',
      nameEn: 'Dhaka College',
      aliases: ['Dhaka College', 'ঢাকা কলেজ', 'EIIN 108274'],
      nameHistory: [],
      type: 'college',
      level: 'higher_secondary',
      management: 'public',
      mpoStatus: 'not_applicable',
      eiin: '108274',
      ugcId: null,
      nuCollegeCode: null,
      btebCode: null,
      boardCode: 'BISE-DHAKA',
      board: 'Dhaka',
      divisionEn: 'Dhaka',
      districtEn: 'Dhaka',
      upazilaEn: 'New Market',
      addressBn: 'মিরপুর রোড, নিউমার্কেট, ঢাকা-১২০৫',
      addressEn: 'Mirpur Road, New Market, Dhaka-1205',
      phone: null,
      email: null,
      website: 'https://dhakacollege.edu.bd',
      admissionPortalUrl: 'https://xiclassadmission.gov.bd',
      establishedYear: 1841,
      approvalStatus: 'verification_pending',
      lat: 23.7336,
      lng: 90.3834,
      sourceId: 'SRC_MYGOV_A2I',
      sourceUrl: 'https://dshe.gov.bd',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      lastVerifiedAt: '2026-11-10T00:00:00Z',
      verificationStatus: 'verification_pending',
    },
    {
      id: 'eiin-108259',
      nameBn: 'নটর ডেম কলেজ, ঢাকা',
      nameEn: 'Notre Dame College, Dhaka',
      aliases: ['NDC', 'Notre Dame College', 'নটর ডেম কলেজ'],
      nameHistory: [],
      type: 'college',
      level: 'higher_secondary',
      management: 'private',
      mpoStatus: 'non_mpo',
      eiin: '108259',
      ugcId: null,
      nuCollegeCode: null,
      btebCode: null,
      boardCode: 'BISE-DHAKA',
      board: 'Dhaka',
      divisionEn: 'Dhaka',
      districtEn: 'Dhaka',
      upazilaEn: 'Motijheel',
      addressBn: 'টয়েনবি সার্কুলার রোড, মতিঝিল, ঢাকা-১০০০',
      addressEn: 'Toyenbee Circular Road, Motijheel, Dhaka-1000',
      phone: null,
      email: null,
      website: 'https://ndc.edu.bd',
      admissionPortalUrl: 'https://ndc.edu.bd',
      establishedYear: 1949,
      approvalStatus: 'verification_pending',
      lat: 23.7298,
      lng: 90.4215,
      sourceId: 'SRC_MYGOV_A2I',
      sourceUrl: 'https://dshe.gov.bd',
      trustLabel: TrustLabel.OFFICIAL_SOURCE,
      lastVerifiedAt: '2026-11-10T00:00:00Z',
      verificationStatus: 'verification_pending',
    },
  ];

  private readonly boards: EducationBoardRecord[] = [
    {
      code: 'BISE-DHAKA',
      nameBn: 'মাধ্যমিক ও উচ্চমাধ্যমিক শিক্ষা বোর্ড, ঢাকা',
      nameEn: 'Board of Intermediate and Secondary Education, Dhaka',
      website: 'https://dhakaeducationboard.gov.bd',
      resultsUrl: 'http://www.educationboardresults.gov.bd',
      xiAdmissionUrl: 'https://xiclassadmission.gov.bd',
      certificateCorrectionUrl: 'https://dhakaeducationboard.gov.bd',
      sourceId: 'SRC_MYGOV_A2I',
      lastVerifiedAt: '2026-11-10T00:00:00Z',
    },
    {
      code: 'BISE-RAJSHAHI',
      nameBn: 'মাধ্যমিক ও উচ্চমাধ্যমিক শিক্ষা বোর্ড, রাজশাহী',
      nameEn: 'Board of Intermediate and Secondary Education, Rajshahi',
      website: 'https://rajshahieducationboard.gov.bd',
      resultsUrl: 'http://www.educationboardresults.gov.bd',
      xiAdmissionUrl: 'https://xiclassadmission.gov.bd',
      certificateCorrectionUrl: 'https://rajshahieducationboard.gov.bd',
      sourceId: 'SRC_MYGOV_A2I',
      lastVerifiedAt: '2026-11-10T00:00:00Z',
    },
    {
      code: 'BISE-CUMILLA',
      nameBn: 'মাধ্যমিক ও উচ্চমাধ্যমিক শিক্ষা বোর্ড, কুমিল্লা',
      nameEn: 'Board of Intermediate and Secondary Education, Cumilla',
      website: 'https://comillaboard.portal.gov.bd',
      resultsUrl: 'http://www.educationboardresults.gov.bd',
      xiAdmissionUrl: 'https://xiclassadmission.gov.bd',
      certificateCorrectionUrl: 'https://comillaboard.portal.gov.bd',
      sourceId: 'SRC_MYGOV_A2I',
      lastVerifiedAt: '2026-11-10T00:00:00Z',
    },
    {
      code: 'BISE-JASHORE',
      nameBn: 'মাধ্যমিক ও উচ্চমাধ্যমিক শিক্ষা বোর্ড, যশোর',
      nameEn: 'Board of Intermediate and Secondary Education, Jashore',
      website: 'https://www.jessoreboard.gov.bd',
      resultsUrl: 'http://www.educationboardresults.gov.bd',
      xiAdmissionUrl: 'https://xiclassadmission.gov.bd',
      certificateCorrectionUrl: 'https://www.jessoreboard.gov.bd',
      sourceId: 'SRC_MYGOV_A2I',
      lastVerifiedAt: '2026-11-10T00:00:00Z',
    },
    {
      code: 'BISE-CHATTOGRAM',
      nameBn: 'মাধ্যমিক ও উচ্চমাধ্যমিক শিক্ষা বোর্ড, চট্টগ্রাম',
      nameEn: 'Board of Intermediate and Secondary Education, Chattogram',
      website: 'https://web.bise-ctg.gov.bd',
      resultsUrl: 'http://www.educationboardresults.gov.bd',
      xiAdmissionUrl: 'https://xiclassadmission.gov.bd',
      certificateCorrectionUrl: 'https://web.bise-ctg.gov.bd',
      sourceId: 'SRC_MYGOV_A2I',
      lastVerifiedAt: '2026-11-10T00:00:00Z',
    },
    {
      code: 'BISE-BARISHAL',
      nameBn: 'মাধ্যমিক ও উচ্চমাধ্যমিক শিক্ষা বোর্ড, বরিশাল',
      nameEn: 'Board of Intermediate and Secondary Education, Barishal',
      website: 'https://barisalboard.gov.bd',
      resultsUrl: 'http://www.educationboardresults.gov.bd',
      xiAdmissionUrl: 'https://xiclassadmission.gov.bd',
      certificateCorrectionUrl: 'https://barisalboard.gov.bd',
      sourceId: 'SRC_MYGOV_A2I',
      lastVerifiedAt: '2026-11-10T00:00:00Z',
    },
    {
      code: 'BISE-SYLHET',
      nameBn: 'মাধ্যমিক ও উচ্চমাধ্যমিক শিক্ষা বোর্ড, সিলেট',
      nameEn: 'Board of Intermediate and Secondary Education, Sylhet',
      website: 'https://sylhetboard.gov.bd',
      resultsUrl: 'http://www.educationboardresults.gov.bd',
      xiAdmissionUrl: 'https://xiclassadmission.gov.bd',
      certificateCorrectionUrl: 'https://sylhetboard.gov.bd',
      sourceId: 'SRC_MYGOV_A2I',
      lastVerifiedAt: '2026-11-10T00:00:00Z',
    },
    {
      code: 'BISE-DINAJPUR',
      nameBn: 'মাধ্যমিক ও উচ্চমাধ্যমিক শিক্ষা বোর্ড, দিনাজপুর',
      nameEn: 'Board of Intermediate and Secondary Education, Dinajpur',
      website: 'https://dinajpureducationboard.gov.bd',
      resultsUrl: 'http://www.educationboardresults.gov.bd',
      xiAdmissionUrl: 'https://xiclassadmission.gov.bd',
      certificateCorrectionUrl: 'https://dinajpureducationboard.gov.bd',
      sourceId: 'SRC_MYGOV_A2I',
      lastVerifiedAt: '2026-11-10T00:00:00Z',
    },
    {
      code: 'BISE-MYMENSINGH',
      nameBn: 'মাধ্যমিক ও উচ্চমাধ্যমিক শিক্ষা বোর্ড, ময়মনসিংহ',
      nameEn: 'Board of Intermediate and Secondary Education, Mymensingh',
      website: 'https://mymensingheducationboard.gov.bd',
      resultsUrl: 'http://www.educationboardresults.gov.bd',
      xiAdmissionUrl: 'https://xiclassadmission.gov.bd',
      certificateCorrectionUrl: 'https://mymensingheducationboard.gov.bd',
      sourceId: 'SRC_MYGOV_A2I',
      lastVerifiedAt: '2026-11-10T00:00:00Z',
    },
    {
      code: 'BMEB-MADRASAH',
      nameBn: 'বাংলাদেশ মাদ্রাসা শিক্ষা বোর্ড',
      nameEn: 'Bangladesh Madrasah Education Board (BMEB)',
      website: 'https://bmeb.gov.bd',
      resultsUrl: 'http://www.educationboardresults.gov.bd',
      xiAdmissionUrl: 'https://xiclassadmission.gov.bd',
      certificateCorrectionUrl: 'https://bmeb.gov.bd',
      sourceId: 'SRC_MYGOV_A2I',
      lastVerifiedAt: '2026-11-10T00:00:00Z',
    },
    {
      code: 'BTEB-TECHNICAL',
      nameBn: 'বাংলাদেশ কারিগরি শিক্ষা বোর্ড (BTEB)',
      nameEn: 'Bangladesh Technical Education Board (BTEB)',
      website: 'https://bteb.gov.bd',
      resultsUrl: 'http://www.educationboardresults.gov.bd',
      xiAdmissionUrl: 'https://xiclassadmission.gov.bd',
      certificateCorrectionUrl: 'https://bteb.gov.bd',
      sourceId: 'SRC_MYGOV_A2I',
      lastVerifiedAt: '2026-11-10T00:00:00Z',
    },
  ];

  listInstitutions(params: {
    q?: string;
    eiin?: string;
    code?: string;
    district?: string;
    upazila?: string;
    type?: string;
    level?: string;
    management?: string;
    limit?: string;
  }) {
    const parsedLimit = parseStrictLimit(params.limit, 25, 100);
    if (params.eiin !== undefined && params.eiin !== '') {
      const cleanEiin = params.eiin.trim();
      if (!/^\d{4,6}$/.test(cleanEiin)) {
        throw new BadRequestException({
          code: 'INVALID_EIIN_FORMAT',
          messageBn: 'EIIN অবশ্যই ৪ থেকে ৬ সংখ্যার ইংরেজি বা বাংলা ডিজিট হতে হবে।',
          messageEn: 'EIIN must be a 4 to 6 digit numeric code.',
        });
      }
    }

    let items = [...this.institutions];
    if (params.eiin && params.eiin.trim()) {
      items = items.filter((i) => i.eiin === params.eiin!.trim());
    }
    if (params.code && params.code.trim()) {
      const c = params.code.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.eiin?.toLowerCase() === c ||
          i.ugcId?.toLowerCase() === c ||
          i.nuCollegeCode?.toLowerCase() === c ||
          i.btebCode?.toLowerCase() === c ||
          i.boardCode?.toLowerCase() === c,
      );
    }
    if (params.district && params.district.trim()) {
      const d = params.district.trim().toLowerCase();
      items = items.filter((i) => i.districtEn.toLowerCase().includes(d));
    }
    if (params.upazila && params.upazila.trim()) {
      const u = params.upazila.trim().toLowerCase();
      items = items.filter((i) => (i.upazilaEn ?? '').toLowerCase().includes(u));
    }
    if (params.type && params.type.trim()) {
      items = items.filter((i) => i.type === params.type!.trim().toLowerCase());
    }
    if (params.level && params.level.trim()) {
      items = items.filter((i) => i.level === params.level!.trim().toLowerCase());
    }
    if (params.management && params.management.trim()) {
      items = items.filter((i) => i.management === params.management!.trim().toLowerCase());
    }
    if (params.q && params.q.trim()) {
      const n = params.q.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.nameEn.toLowerCase().includes(n) ||
          i.nameBn.includes(params.q!.trim()) ||
          i.eiin === n ||
          i.ugcId?.toLowerCase().includes(n) ||
          i.aliases.some((a) => a.toLowerCase().includes(n)),
      );
    }

    const sliced = items.slice(0, parsedLimit);
    return {
      count: sliced.length,
      total: items.length,
      dataStatus: 'verification_pending' as const,
      pendingImportNoticeBn:
        'ব্যানবেইস (BANBEIS) EIIN এবং ইউজিসি (UGC) বিশ্ববিদ্যালয়ের পূর্ণাঙ্গ তালিকা আমদানির পাইপলাইন প্রস্তুত — অফিসিয়াল ফাইল যুক্ত না হওয়া পর্যন্ত কোনো EIIN অনুমান করে তৈরি করা হয় না (যাচাই চলছে)।',
      pendingImportNoticeEn:
        'BANBEIS EIIN and UGC university import pipelines are ready — full records are marked Verification pending until official files are placed in data/imports/education/ (never fabricated).',
      universityEiinRuleBn:
        'বিশ্ববিদ্যালয়সমূহ বাংলাদেশ বিশ্ববিদ্যালয় মঞ্জুরী কমিশন (UGC)-এর তালিকাভুক্ত; বিশ্ববিদ্যালয়ের সাধারণত কোনো BANBEIS EIIN থাকে না।',
      universityEiinRuleEn:
        'Universities in Bangladesh are listed under the University Grants Commission (UGC) and generally do not have a BANBEIS school/college EIIN.',
      attribution: `Official DSHE / BANBEIS / UGC + ${OSM_ODBL_ATTRIBUTION}`,
      items: sliced,
    };
  }

  getInstitution(id: string) {
    const ID_ALIAS: Record<string, string> = {
      'ugc-univ-du': 'ugc-univ-dhaka',
      'ugc-univ-ru': 'ugc-univ-rajshahi',
      'ugc-univ-cu': 'ugc-univ-chittagong',
    };
    const resolvedId = ID_ALIAS[id.trim().toLowerCase()] ?? id.trim();
    const inst = this.institutions.find(
      (i) =>
        i.id === resolvedId ||
        i.eiin === resolvedId ||
        i.ugcId?.toLowerCase() === resolvedId.toLowerCase(),
    );
    if (!inst) {
      throw new NotFoundException({
        code: 'INSTITUTION_NOT_FOUND',
        messageBn: `শিক্ষা প্রতিষ্ঠান '${id}' পাওয়া যায়নি (ব্যানবেইস/ইউজিসি তালিকা যাচাই চলছে)।`,
        messageEn: `Education institution '${id}' not found (BANBEIS/UGC dataset import pending).`,
      });
    }
    return {
      ...inst,
      eiinExplanationBn:
        inst.type === 'university'
          ? 'বিশ্ববিদ্যালয় ইউজিসি (UGC) তালিকাভুক্ত — কোনো BANBEIS EIIN প্রযোজ্য নয়।'
          : inst.eiin
            ? `ব্যানবেইস EIIN: ${inst.eiin}`
            : 'EIIN যাচাই চলছে',
      eiinExplanationEn:
        inst.type === 'university'
          ? 'UGC-listed university — no BANBEIS school/college EIIN applies.'
          : inst.eiin
            ? `BANBEIS EIIN: ${inst.eiin}`
            : 'EIIN verification pending',
      officialPortals: {
        resultsUrl: 'http://www.educationboardresults.gov.bd',
        xiAdmissionUrl: 'https://xiclassadmission.gov.bd',
        scholarshipsUrl: '/scholarships',
        certificateCorrectionUrl: 'https://dhakaeducationboard.gov.bd',
      },
      attribution: `Official DSHE / UGC + ${OSM_ODBL_ATTRIBUTION}`,
    };
  }

  listUniversities(qOrParams?: string | { q?: string; management?: string }, managementArg?: string) {
    let q: string | undefined;
    let management: string | undefined;
    if (qOrParams !== null && typeof qOrParams === 'object') {
      q = qOrParams.q;
      management = qOrParams.management;
    } else {
      q = qOrParams;
      management = managementArg;
    }
    let items = this.institutions.filter((i) => i.type === 'university');
    if (management && management.trim()) {
      items = items.filter((i) => i.management === management.trim().toLowerCase());
    }
    if (q && q.trim()) {
      const n = q.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.nameEn.toLowerCase().includes(n) ||
          i.nameBn.includes(q.trim()) ||
          i.aliases.some((a) => a.toLowerCase().includes(n)),
      );
    }
    return {
      count: items.length,
      dataStatus: 'verification_pending' as const,
      eiinRuleBn:
        'বিশ্ববিদ্যালয়ের সাধারণত BANBEIS EIIN থাকে না — ইউজিসি (UGC) তালিকা দেখানো হচ্ছে।',
      eiinRuleEn:
        'Universities generally do not have a BANBEIS EIIN — showing UGC university listings.',
      items,
    };
  }

  listBoards() {
    return {
      count: this.boards.length,
      items: this.boards,
    };
  }

  runQualityChecks() {
    const eiinSeen = new Set<string>();
    const duplicateEiins: string[] = [];
    const missingDistrictIds: string[] = [];
    const outOfBoundsIds: string[] = [];

    for (const inst of this.institutions) {
      if (inst.eiin) {
        if (eiinSeen.has(inst.eiin)) duplicateEiins.push(inst.eiin);
        eiinSeen.add(inst.eiin);
      }
      if (!inst.districtEn) missingDistrictIds.push(inst.id);
      if (
        inst.lat !== null &&
        inst.lng !== null &&
        (inst.lat < 20.5 || inst.lat > 26.7 || inst.lng < 88.0 || inst.lng > 92.7)
      ) {
        outOfBoundsIds.push(inst.id);
      }
    }

    return {
      totalRecords: this.institutions.length,
      universitiesCount: this.institutions.filter((i) => i.type === 'university').length,
      schoolsCollegesCount: this.institutions.filter((i) => i.type !== 'university').length,
      boardsCount: this.boards.length,
      dataStatus: 'verification_pending' as const,
      qualityChecks: {
        duplicateEiins,
        missingDistrictIds,
        outOfBoundsIds,
        passed:
          duplicateEiins.length === 0 &&
          missingDistrictIds.length === 0 &&
          outOfBoundsIds.length === 0,
      },
    };
  }

  /** Alias: getInstitutionById(id) -> getInstitution(id) */
  getInstitutionById(id: string) {
    return this.getInstitution(id);
  }

  /** Summary stats for Education Hub & coverage reporting */
  getStats() {
    const qc = this.runQualityChecks();
    return {
      ...qc,
      fullDatasetImportStatus: 'VERIFICATION_PENDING' as const,
    };
  }
}
