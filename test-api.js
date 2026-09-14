const { getOrganizationDetails } = require('./src/services/zohoAuth');
const { getGradesSummary, fetchAllStudents } = require('./src/services/studentService');
const { getZohoItems } = require('./src/services/feeService');

async function runTest() {
  console.log('🧪 =================== TESTING ZOHO INTEGRATION ===================');
  
  // 1. Test Organization Details
  try {
    const org = await getOrganizationDetails();
    console.log('🏢 Organization Test:', org);
  } catch (e) {
    console.error('❌ Org test failed:', e.message);
  }

  // 2. Test Students Fetching
  try {
    const students = await fetchAllStudents(true);
    console.log(`🎓 Students Fetched: ${students.length} students found.`);
    if (students.length > 0) {
      console.log('Sample Student:', {
        name: students[0].name,
        grade: students[0].grade,
        admission_no: students[0].admission_no,
        email: students[0].email,
      });
    }
  } catch (e) {
    console.error('❌ Students fetch failed:', e.message);
  }

  // 3. Test Grades Summary
  try {
    const grades = await getGradesSummary(false);
    console.log('📊 Grades Summary:', grades);
  } catch (e) {
    console.error('❌ Grades test failed:', e.message);
  }

  // 4. Test Items Fetching
  try {
    const items = await getZohoItems(true);
    console.log(`📦 Fee Items Fetched: ${items.length} items found.`);
  } catch (e) {
    console.error('❌ Items fetch failed:', e.message);
  }

  console.log('===================================================================');
}

runTest();
