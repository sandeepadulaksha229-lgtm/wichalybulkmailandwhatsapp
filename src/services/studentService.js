const { apiRequest } = require('./zohoAuth');

let cachedStudents = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache

/**
 * Extract Grade value from various possible custom field structures in Zoho Contacts
 */
function extractGrade(contact) {
  // 1. Direct custom_field_hash
  if (contact.custom_field_hash) {
    if (contact.custom_field_hash.cf_grade !== undefined) return String(contact.custom_field_hash.cf_grade);
    if (contact.custom_field_hash.cf_class !== undefined) return String(contact.custom_field_hash.cf_class);
    if (contact.custom_field_hash.grade !== undefined) return String(contact.custom_field_hash.grade);
  }

  // 2. Direct property cf_grade
  if (contact.cf_grade !== undefined && contact.cf_grade !== null) {
    return String(contact.cf_grade);
  }

  // 3. custom_fields array
  if (contact.custom_fields && Array.isArray(contact.custom_fields)) {
    const gradeField = contact.custom_fields.find(
      (cf) =>
        (cf.api_name && cf.api_name.toLowerCase().includes('grade')) ||
        (cf.label && cf.label.toLowerCase().includes('grade')) ||
        (cf.placeholder && cf.placeholder.toLowerCase().includes('grade'))
    );
    if (gradeField && (gradeField.value_formatted || gradeField.value)) {
      return String(gradeField.value_formatted || gradeField.value);
    }
  }

  // 4. Fallback: check contact name / company name if formatted like "Grade 5" or similar
  return 'Unassigned';
}

/**
 * Extract Admission No / Student ID from contact
 */
function extractAdmissionNo(contact) {
  if (contact.custom_field_hash) {
    if (contact.custom_field_hash.cf_admission_number) return String(contact.custom_field_hash.cf_admission_number);
    if (contact.custom_field_hash.cf_admission_no) return String(contact.custom_field_hash.cf_admission_no);
    if (contact.custom_field_hash.cf_student_id) return String(contact.custom_field_hash.cf_student_id);
    if (contact.custom_field_hash.cf_index_number) return String(contact.custom_field_hash.cf_index_number);
  }

  if (contact.custom_fields && Array.isArray(contact.custom_fields)) {
    const admField = contact.custom_fields.find(
      (cf) =>
        (cf.api_name && (cf.api_name.includes('admission') || cf.api_name.includes('index') || cf.api_name.includes('student_id'))) ||
        (cf.label && (cf.label.toLowerCase().includes('admission') || cf.label.toLowerCase().includes('student id')))
    );
    if (admField && (admField.value_formatted || admField.value)) {
      return String(admField.value_formatted || admField.value);
    }
  }

  // Check if company_name or notes holds student code
  if (contact.company_name && contact.company_name.trim() !== '') {
    return contact.company_name.trim();
  }

  return '';
}

/**
 * Fetch all active student contacts from Zoho Books with pagination
 */
async function fetchAllStudents(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedStudents && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedStudents;
  }

  console.log('🔄 [StudentService] Fetching all student contacts from Zoho Books...');
  let allContacts = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 10) { // Safety limit of 10 pages (2000 contacts)
    try {
      const data = await apiRequest('GET', '/contacts', null, {
        contact_type: 'customer',
        status: 'active',
        page: page,
        per_page: 200,
      });

      const contacts = data.contacts || [];
      allContacts = allContacts.concat(contacts);

      if (data.page_context && data.page_context.has_more_page) {
        page++;
      } else {
        hasMore = false;
      }
    } catch (err) {
      console.error(`❌ [StudentService] Error on page ${page}:`, err.message);
      hasMore = false;
      if (allContacts.length === 0 && cachedStudents) {
        return cachedStudents;
      }
      if (allContacts.length === 0) throw err;
    }
  }

  const students = allContacts.map((c) => {
    const grade = extractGrade(c);
    const admissionNo = extractAdmissionNo(c);
    const email = (c.email || c.primary_contact_email || '').trim();

    return {
      id: c.contact_id,
      name: c.contact_name || 'Unnamed Student',
      company_name: c.company_name || '',
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      email: email,
      phone: c.phone || c.mobile || '',
      grade: grade,
      admission_no: admissionNo,
      outstanding_balance: c.outstanding_receivable_amount || 0,
      currency_code: c.currency_code || 'LKR',
      currency_symbol: c.currency_symbol || 'Rs.',
      status: c.status,
      has_email: Boolean(email && email.includes('@')),
      has_phone: Boolean((c.phone || c.mobile || '').replace(/\D/g, '').length >= 9),
    };
  });

  cachedStudents = students;
  lastFetchedAt = now;
  console.log(`✅ [StudentService] Loaded ${students.length} students from Zoho Books.`);
  return cachedStudents;
}

/**
 * Get distinct grades and student counts
 */
async function getGradesSummary(forceRefresh = false) {
  const students = await fetchAllStudents(forceRefresh);

  const gradeCounts = {};
  students.forEach((s) => {
    const g = s.grade || 'Unassigned';
    gradeCounts[g] = (gradeCounts[g] || 0) + 1;
  });

  // Sort grades nicely (Numeric first e.g. 1..13, then special names)
  const sortedGrades = Object.keys(gradeCounts).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10);
    const numB = parseInt(b.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return a.localeCompare(b);
  });

  return sortedGrades.map((grade) => ({
    grade: grade,
    display_name: isNaN(parseInt(grade, 10)) ? grade : `Grade ${grade}`,
    student_count: gradeCounts[grade],
  }));
}

/**
 * Filter students by specific grade
 */
async function getStudentsByGrade(grade, search = '', forceRefresh = false) {
  const allStudents = await fetchAllStudents(forceRefresh);
  let filtered = allStudents;

  if (grade && grade !== 'ALL') {
    const cleanGrade = String(grade).toLowerCase().trim().replace(/^grade\s*/i, '');
    filtered = filtered.filter((s) => {
      const sGrade = String(s.grade).toLowerCase().trim().replace(/^grade\s*/i, '');
      return sGrade === cleanGrade || String(s.grade).toLowerCase().trim() === String(grade).toLowerCase().trim();
    });
  }

  if (search && search.trim() !== '') {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.admission_no.toLowerCase().includes(q) ||
        s.phone.includes(q)
    );
  }

  return filtered;
}

module.exports = {
  fetchAllStudents,
  getGradesSummary,
  getStudentsByGrade,
};
