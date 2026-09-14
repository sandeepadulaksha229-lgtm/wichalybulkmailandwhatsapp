const { apiRequest, downloadInvoicePdf } = require('./zohoAuth');
const { sendInvoicePdf, getWhatsAppStatus } = require('./whatsappService');

// Active and past batch execution store
const batchStore = new Map();

/**
 * Sleep helper for rate-limiting Zoho API requests
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create a single Invoice in Zoho Books and dispatch Email / WhatsApp
 */
async function createAndSendStudentInvoice(student, config) {
  const { date, dueDate, termName, lineItems, referencePrefix, sendEmail, sendWhatsApp, customNotes } = config;

  // 1. Prepare Line Items for Zoho Books
  const formattedLineItems = lineItems.map((item) => {
    const line = {
      name: item.name || 'School Fee',
      description: item.description || '',
      rate: parseFloat(item.rate) || 0,
      quantity: parseFloat(item.quantity) || 1,
    };
    if (item.item_id && !String(item.item_id).startsWith('temp-')) {
      line.item_id = item.item_id;
    }
    return line;
  });

  const notesText =
    customNotes ||
    `Wycherley International School — ${termName || 'Term Fee'}\nStudent: ${student.name} | Grade: ${student.grade || 'N/A'}${student.admission_no ? ' | Adm No: ' + student.admission_no : ''}`;

  const invoicePayload = {
    customer_id: student.id,
    date: date || new Date().toISOString().split('T')[0],
    due_date: dueDate || date || new Date().toISOString().split('T')[0],
    line_items: formattedLineItems,
    notes: notesText,
    terms: 'Payment is due on or before the due date. Please quote Student Name & Admission Number on bank transfers.',
    is_inclusive_tax: false,
  };

  if (referencePrefix) {
    invoicePayload.reference_number = `${referencePrefix}-${student.admission_no || student.id.slice(-5)}`;
  }

  // 2. Call Zoho Books Invoices API
  console.log(`📄 [BulkEngine] Creating Invoice in Zoho Books for: ${student.name} (ID: ${student.id})...`);
  const invoiceRes = await apiRequest('POST', '/invoices?ignore_auto_number_generation=false', invoicePayload);

  if (!invoiceRes || (!invoiceRes.invoice && invoiceRes.code !== 0)) {
    throw new Error(invoiceRes?.message || 'Zoho Books returned an error creating the invoice.');
  }

  const createdInvoice = invoiceRes.invoice;
  const invoiceId = createdInvoice.invoice_id;
  const invoiceNumber = createdInvoice.invoice_number;
  const totalAmount = createdInvoice.total || 0;

  let emailResult = { sent: false, message: 'Email dispatch skipped' };
  let whatsappResult = { sent: false, message: 'WhatsApp dispatch skipped' };

  // 3. Dispatch Email via Zoho Books Email API
  if (sendEmail && student.email && student.has_email) {
    try {
      console.log(`✉️ [BulkEngine] Dispatching Zoho Books Invoice Email to ${student.email} for Invoice #${invoiceNumber}...`);
      
      const emailPayload = {
        to_mail_ids: [student.email],
        subject: `Wycherley International School - Invoice ${invoiceNumber} (${termName || 'School Fee'})`,
        body: `Dear Parent/Guardian,\n\nPlease find attached the school fee invoice (${invoiceNumber}) for ${student.name} (${termName || 'Term Fee'}).\n\nTotal Amount: ${student.currency_symbol || 'LKR'} ${totalAmount.toLocaleString()}\nDue Date: ${invoicePayload.due_date}\n\nThank you.\nAccounts Department\nWycherley International School`,
        send_attachment: true,
      };

      // Zoho Books API endpoint to send invoice email
      await apiRequest('POST', `/invoices/${invoiceId}/email?send_customer_email=true`, emailPayload);
      emailResult = { sent: true, recipient: student.email, message: 'Dispatched via Zoho Books' };
      console.log(`✅ [BulkEngine] Email successfully sent to ${student.email} for Invoice #${invoiceNumber}`);
    } catch (mailErr) {
      console.warn(`⚠️ [BulkEngine] Could not send email via Zoho for Invoice #${invoiceNumber}:`, mailErr.response?.data?.message || mailErr.message);
      emailResult = { sent: false, recipient: student.email, error: mailErr.response?.data?.message || mailErr.message };
    }
  } else if (sendEmail && (!student.email || !student.has_email)) {
    emailResult = { sent: false, error: 'No parent email address found on contact' };
  }

  // 4. Dispatch WhatsApp Invoice PDF Document
  if (sendWhatsApp) {
    const waStatus = getWhatsAppStatus();
    if (!waStatus.connected) {
      whatsappResult = { sent: false, error: 'WhatsApp is not connected' };
    } else if (!student.phone) {
      whatsappResult = { sent: false, error: 'No phone number for student contact' };
    } else {
      try {
        console.log(`📱 [BulkEngine] Fetching PDF & sending WhatsApp message to ${student.phone} for Invoice #${invoiceNumber}...`);
        const pdfBuffer = await downloadInvoicePdf(invoiceId);
        const caption = `🎓 *Wycherley International School*\n\nDear Parent/Guardian,\n\nPlease find attached the official School Fee Invoice (*#${invoiceNumber}*) for *${student.name}* (${termName || 'Term Fee'}).\n\n📌 *Admission No:* ${student.admission_no || 'N/A'}\n📌 *Grade:* ${student.grade || 'N/A'}\n💰 *Amount Due:* ${student.currency_symbol || 'LKR'} ${totalAmount.toLocaleString()}\n📅 *Due Date:* ${invoicePayload.due_date}\n\nThank you,\nAccounts Department\nWycherley International School`;

        await sendInvoicePdf(student.phone, pdfBuffer, `Invoice-${invoiceNumber}.pdf`, caption);
        whatsappResult = { sent: true, recipient: student.phone, message: 'Dispatched via WhatsApp' };
        console.log(`✅ [BulkEngine] WhatsApp message & PDF sent successfully to ${student.phone} for Invoice #${invoiceNumber}`);
      } catch (waErr) {
        console.error(`⚠️ [BulkEngine] WhatsApp dispatch error for Invoice #${invoiceNumber}:`, waErr.message);
        whatsappResult = { sent: false, recipient: student.phone, error: waErr.message };
      }
    }
  }

  return {
    success: true,
    studentId: student.id,
    studentName: student.name,
    admissionNo: student.admission_no,
    grade: student.grade,
    parentEmail: student.email,
    parentPhone: student.phone,
    invoiceId: invoiceId,
    invoiceNumber: invoiceNumber,
    totalAmount: totalAmount,
    emailStatus: emailResult,
    whatsappStatus: whatsappResult,
  };
}

/**
 * Start a Bulk Invoicing Batch in the background with controlled rate-limiting
 */
function startBulkBatch(batchId, students, config) {
  const batch = {
    batchId,
    startTime: new Date().toISOString(),
    endTime: null,
    status: 'running', // running | completed | failed
    total: students.length,
    processed: 0,
    successful: 0,
    failed: 0,
    grade: config.grade || 'All',
    termName: config.termName || 'Term Fee',
    totalBilledAmount: 0,
    config,
    results: [],
    logs: [],
  };

  batchStore.set(batchId, batch);

  // Execute in background
  (async () => {
    addBatchLog(batchId, `🚀 Starting bulk invoice process for ${students.length} students (${config.termName})...`);

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const index = i + 1;

      try {
        addBatchLog(batchId, `[${index}/${students.length}] Processing ${student.name} (Adm: ${student.admission_no || 'N/A'})...`);

        const result = await createAndSendStudentInvoice(student, config);
        
        batch.processed++;
        batch.successful++;
        batch.totalBilledAmount += (result.totalAmount || 0);
        batch.results.push(result);

        const emailMsg = result.emailStatus.sent ? `✉️ Email sent` : '';
        const waMsg = result.whatsappStatus.sent ? `📱 WhatsApp PDF sent` : (result.whatsappStatus.error ? `⚠️ WA: ${result.whatsappStatus.error}` : '');
        const dispatchInfo = [emailMsg, waMsg].filter(Boolean).join(' | ');
        addBatchLog(
          batchId,
          `✅ [${index}/${students.length}] Invoice #${result.invoiceNumber} created (LKR ${result.totalAmount.toLocaleString()}) ${dispatchInfo ? `[${dispatchInfo}]` : ''}`
        );

      } catch (err) {
        batch.processed++;
        batch.failed++;
        const errorMsg = err.response?.data?.message || err.message;
        
        batch.results.push({
          success: false,
          studentId: student.id,
          studentName: student.name,
          admissionNo: student.admission_no,
          grade: student.grade,
          error: errorMsg,
        });

        addBatchLog(batchId, `❌ [${index}/${students.length}] Failed for ${student.name}: ${errorMsg}`, 'error');
      }

      // Rate limit delay: wait 700ms between calls to stay comfortably within Zoho API limits
      if (i < students.length - 1) {
        await sleep(700);
      }
    }

    batch.status = 'completed';
    batch.endTime = new Date().toISOString();
    addBatchLog(
      batchId,
      `🎉 Batch completed! Successfully created ${batch.successful} of ${batch.total} invoices. Total: LKR ${batch.totalBilledAmount.toLocaleString()}`
    );
  })().catch((fatalErr) => {
    console.error('Fatal batch error:', fatalErr);
    batch.status = 'failed';
    batch.error = fatalErr.message;
    addBatchLog(batchId, `💥 Fatal Batch Error: ${fatalErr.message}`, 'error');
  });

  return batch;
}

function addBatchLog(batchId, message, type = 'info') {
  const batch = batchStore.get(batchId);
  if (batch) {
    const timestamp = new Date().toLocaleTimeString();
    batch.logs.push({ timestamp, message, type });
  }
}

function getBatchProgress(batchId) {
  return batchStore.get(batchId) || null;
}

function getAllBatches() {
  return Array.from(batchStore.values()).reverse();
}

module.exports = {
  createAndSendStudentInvoice,
  startBulkBatch,
  getBatchProgress,
  getAllBatches,
};
