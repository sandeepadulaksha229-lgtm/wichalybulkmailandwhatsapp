const express = require('express');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const { getOrganizationDetails, apiRequest } = require('./src/services/zohoAuth');
const { getGradesSummary, getStudentsByGrade, fetchAllStudents } = require('./src/services/studentService');
const { getZohoItems, getDefaultFeeTemplates } = require('./src/services/feeService');
const { startBulkBatch, getBatchProgress, getAllBatches } = require('./src/services/bulkInvoiceEngine');
const { initWhatsApp, getWhatsAppStatus, disconnectWhatsApp, sendTextMessage } = require('./src/services/whatsappService');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// ── 1. System & Zoho Status ──────────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
  try {
    const orgDetails = await getOrganizationDetails();
    res.json({
      status: 'online',
      system: 'Wycherley International School - Bulk Invoicing Portal',
      organization: orgDetails,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── 2. Grades & Summary ─────────────────────────────────────────────────────
app.get('/api/grades', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const grades = await getGradesSummary(forceRefresh);
    res.json({ success: true, grades });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 3. Students by Grade ────────────────────────────────────────────────────
app.get('/api/students', async (req, res) => {
  try {
    const { grade, search, refresh } = req.query;
    const forceRefresh = refresh === 'true';
    const students = await getStudentsByGrade(grade, search, forceRefresh);
    res.json({
      success: true,
      grade: grade || 'ALL',
      total: students.length,
      withEmail: students.filter((s) => s.has_email).length,
      withoutEmail: students.filter((s) => !s.has_email).length,
      students,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 4. Fee Items & Templates ────────────────────────────────────────────────
app.get('/api/items', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const items = await getZohoItems(forceRefresh);
    const templates = getDefaultFeeTemplates();
    res.json({ success: true, items, templates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 5. Invoice Preview Calculation ──────────────────────────────────────────
app.post('/api/invoices/preview', (req, res) => {
  try {
    const { students = [], lineItems = [], discount = 0 } = req.body;

    const subtotalPerStudent = lineItems.reduce((sum, item) => {
      return sum + (parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 1);
    }, 0);

    const totalPerStudent = Math.max(0, subtotalPerStudent - (parseFloat(discount) || 0));
    const batchGrandTotal = totalPerStudent * students.length;

    res.json({
      success: true,
      studentCount: students.length,
      subtotalPerStudent,
      discountPerStudent: parseFloat(discount) || 0,
      totalPerStudent,
      batchGrandTotal,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── 6. Bulk Send Invoices ───────────────────────────────────────────────────
app.post('/api/invoices/bulk-send', async (req, res) => {
  try {
    const { studentIds = [], config } = req.body;

    if (!studentIds || studentIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No students selected for invoice generation.' });
    }

    if (!config || !config.lineItems || config.lineItems.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one fee line item is required.' });
    }

    // Fetch all students to resolve full student objects
    const allStudents = await fetchAllStudents(false);
    const selectedStudents = allStudents.filter((s) => studentIds.includes(s.id));

    if (selectedStudents.length === 0) {
      return res.status(400).json({ success: false, error: 'None of the selected student IDs were found.' });
    }

    const batchId = `WIS-BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const batch = startBulkBatch(batchId, selectedStudents, config);

    res.json({
      success: true,
      message: `Bulk invoice dispatch initiated for ${selectedStudents.length} students.`,
      batchId,
      batch,
    });
  } catch (err) {
    console.error('Error initiating bulk invoices:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 7. Batch Progress ───────────────────────────────────────────────────────
app.get('/api/invoices/progress/:batchId', (req, res) => {
  const batch = getBatchProgress(req.params.batchId);
  if (!batch) {
    return res.status(404).json({ success: false, error: 'Batch not found' });
  }
  res.json({ success: true, batch });
});

// ── 8. Batch History ────────────────────────────────────────────────────────
app.get('/api/invoices/history', (req, res) => {
  const batches = getAllBatches();
  res.json({ success: true, batches });
});

// ── 9. WhatsApp Status & QR Code ─────────────────────────────────────────────
app.get('/api/whatsapp/status', (req, res) => {
  const status = getWhatsAppStatus();
  res.json({ success: true, ...status });
});

app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    const force = req.body?.force === true;
    const result = await initWhatsApp(force);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    const result = await disconnectWhatsApp();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whatsapp/test', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }
    const testMsg = message || '🎓 *Wycherley International School*\nThis is a test notification from the Bulk Invoicing System.';
    const result = await sendTextMessage(phone, testMsg);
    res.json({ success: true, message: `Test message sent to ${phone}`, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 10. Legacy Vendor Payment Webhook (Retained for continuity) ──────────────
app.post('/webhook/vendor-payment', async (req, res) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`📩 [${timestamp}] Webhook received for Vendor Payment!`);
  // Simple acknowledgement for compatibility
  res.json({ status: 'OK', message: 'Vendor payment webhook endpoint active' });
});

// ── Catch-all route to serve UI ─────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let currentPort = parseInt(process.env.PORT || 5000, 10);

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`
🎓 ========================================================
   Wycherley International School — Bulk Invoicing Portal
   Port:    ${port}
   URL:     http://localhost:${port}
   Zoho:    Wycherley International School (Org: ${process.env.ZOHO_ORG_ID})
========================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${port} is already in use. Trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  // Attempt to restore or initialize WhatsApp session in background
  initWhatsApp().catch((err) => {
    console.warn('📱 [WhatsApp] Initial connection check:', err.message);
  });
}

if (!process.env.VERCEL) {
  startServer(currentPort);
}

module.exports = app;

