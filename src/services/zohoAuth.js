const axios = require('axios');
require('dotenv').config();

let cachedAccessToken = null;
let tokenExpiresAt = 0;

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;
const ZOHO_ACCOUNTS_URL = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';
const ZOHO_BOOKS_API_URL = process.env.ZOHO_BOOKS_API_URL || 'https://www.zohoapis.com/books/v3';

/**
 * Obtain a valid Zoho OAuth2 Access Token
 */
async function getAccessToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedAccessToken && now < tokenExpiresAt) {
    return cachedAccessToken;
  }

  if (!ZOHO_REFRESH_TOKEN || !ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET) {
    throw new Error('Zoho OAuth credentials (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN) are missing in .env');
  }

  try {
    const res = await axios.post(
      `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`,
      null,
      {
        params: {
          refresh_token: ZOHO_REFRESH_TOKEN.trim(),
          client_id: ZOHO_CLIENT_ID.trim(),
          client_secret: ZOHO_CLIENT_SECRET.trim(),
          grant_type: 'refresh_token',
        },
      }
    );

    if (res.data.error) {
      throw new Error(`Zoho OAuth Error: ${res.data.error}`);
    }

    cachedAccessToken = res.data.access_token;
    // Set expiry 5 minutes ahead of actual expiration
    tokenExpiresAt = now + ((res.data.expires_in || 3600) * 1000) - 5 * 60 * 1000;
    console.log('🔑 [ZohoAuth] New Access Token obtained successfully.');
    return cachedAccessToken;
  } catch (error) {
    const errDetail = error.response?.data || error.message;
    console.error('❌ [ZohoAuth] Failed to refresh access token:', errDetail);
    throw new Error(`Failed to refresh Zoho token: ${JSON.stringify(errDetail)}`);
  }
}

/**
 * Universal Zoho Books API Request wrapper with automatic token retry
 */
async function apiRequest(method, endpoint, data = null, customParams = {}, isRetry = false) {
  const token = await getAccessToken(isRetry);
  const params = {
    organization_id: ZOHO_ORG_ID,
    ...customParams,
  };

  const url = `${ZOHO_BOOKS_API_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  try {
    const config = {
      method: method.toLowerCase(),
      url,
      params,
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
    };

    if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
      config.data = data;
    }

    const res = await axios(config);
    return res.data;
  } catch (error) {
    const status = error.response?.status;
    const responseData = error.response?.data;

    // Auto-retry on 401 Unauthorized or token invalid code (code 57 / 14)
    if ((status === 401 || (responseData && (responseData.code === 57 || responseData.code === 14))) && !isRetry) {
      console.warn('⚠️ [ZohoAuth] Access token expired or rejected. Refreshing and retrying request...');
      return apiRequest(method, endpoint, data, customParams, true);
    }

    console.error(`❌ [ZohoAuth] API Request Failed [${method.toUpperCase()} ${endpoint}]:`, responseData || error.message);
    throw error;
  }
}

/**
 * Test Zoho connection and fetch Organization details
 */
async function getOrganizationDetails() {
  try {
    const data = await apiRequest('GET', '/organizations');
    const orgs = data.organizations || [];
    const currentOrg = orgs.find((o) => String(o.organization_id) === String(ZOHO_ORG_ID)) || orgs[0];
    return {
      connected: true,
      orgId: ZOHO_ORG_ID,
      orgName: currentOrg?.name || 'Wycherley International School',
      currency: currentOrg?.currency_code || 'LKR',
      email: currentOrg?.email || '',
    };
  } catch (err) {
    return {
      connected: false,
      orgId: ZOHO_ORG_ID,
      error: err.response?.data?.message || err.message,
    };
  }
}

/**
 * Download Invoice PDF from Zoho Books as a binary Buffer
 */
async function downloadInvoicePdf(invoiceId) {
  const token = await getAccessToken();
  const url = `${ZOHO_BOOKS_API_URL}/invoices/${invoiceId}`;
  
  const res = await axios({
    method: 'get',
    url,
    params: {
      organization_id: ZOHO_ORG_ID,
      accept: 'pdf',
    },
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
    responseType: 'arraybuffer',
  });

  return Buffer.from(res.data);
}

module.exports = {
  getAccessToken,
  apiRequest,
  getOrganizationDetails,
  downloadInvoicePdf,
  ZOHO_ORG_ID,
  ZOHO_BOOKS_API_URL,
};
