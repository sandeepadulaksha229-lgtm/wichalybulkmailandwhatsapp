const { apiRequest } = require('./zohoAuth');

let cachedItems = null;
let itemsFetchedAt = 0;
const ITEMS_CACHE_TTL = 5 * 60 * 1000;

/**
 * Fetch Fee Items from Zoho Books
 */
async function getZohoItems(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedItems && now - itemsFetchedAt < ITEMS_CACHE_TTL) {
    return cachedItems;
  }

  try {
    const data = await apiRequest('GET', '/items', null, {
      status: 'active',
      per_page: 200,
    });

    const items = (data.items || []).map((item) => ({
      item_id: item.item_id,
      name: item.name || item.item_name,
      description: item.description || '',
      rate: item.rate || 0,
      sku: item.sku || '',
      item_type: item.item_type || 'service',
      unit: item.unit || '',
    }));

    cachedItems = items;
    itemsFetchedAt = now;
    console.log(`📦 [FeeService] Loaded ${items.length} items from Zoho Books.`);
    return cachedItems;
  } catch (err) {
    console.error('⚠️ [FeeService] Could not fetch Zoho items:', err.message);
    return cachedItems || [];
  }
}

/**
 * Default fee structure templates for grades (can be modified in UI)
 */
function getDefaultFeeTemplates() {
  return {
    'DEFAULT': [
      { name: 'Term Fee', description: 'Tuition and academic fees for the term', rate: 75000, quantity: 1 },
      { name: 'Facility & IT Fee', description: 'Digital campus, computer lab & library fee', rate: 10000, quantity: 1 },
      { name: 'Sports & Activities', description: 'Co-curricular and sports club fees', rate: 5000, quantity: 1 },
    ],
    '6': [
      { name: 'Term Fee (Grade 6)', description: 'Junior School Tuition Fee', rate: 85000, quantity: 1 },
      { name: 'IT & Science Lab Fee', description: 'Practical labs and multimedia', rate: 12000, quantity: 1 },
      { name: 'Library & Activities', description: 'Library access and sports', rate: 6000, quantity: 1 },
    ],
    '10': [
      { name: 'Term Fee (Grade 10 - O/L)', description: 'Senior School O/L Tuition Fee', rate: 110000, quantity: 1 },
      { name: 'Science Laboratory Fee', description: 'Physics, Chemistry & Biology Lab', rate: 18000, quantity: 1 },
      { name: 'Cambridge O/L Assessment Fee', description: 'Mock exams and assessments', rate: 15000, quantity: 1 },
    ],
    '11': [
      { name: 'Term Fee (Grade 11 - O/L)', description: 'Senior School O/L Tuition Fee', rate: 120000, quantity: 1 },
      { name: 'Science Laboratory Fee', description: 'Physics, Chemistry & Biology Lab', rate: 18000, quantity: 1 },
      { name: 'Cambridge O/L Assessment Fee', description: 'Mock exams and assessments', rate: 15000, quantity: 1 },
    ],
    '12': [
      { name: 'Term Fee (Grade 12 - A/L)', description: 'Advanced Level Tuition Fee', rate: 140000, quantity: 1 },
      { name: 'A/L Advanced Practical & Lab', description: 'Advanced Level Lab and Resources', rate: 25000, quantity: 1 },
    ],
  };
}

module.exports = {
  getZohoItems,
  getDefaultFeeTemplates,
};
