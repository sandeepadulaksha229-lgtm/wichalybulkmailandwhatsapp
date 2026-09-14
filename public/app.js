/**
 * ============================================================================
 * WYCHERLEY INTERNATIONAL SCHOOL — BULK STUDENT INVOICING CLIENT LOGIC
 * ============================================================================
 */

// Application State
const state = {
  grades: [],
  selectedGrade: 'ALL',
  students: [],
  filteredStudents: [],
  selectedStudentIds: new Set(),
  zohoItems: [],
  feeTemplates: {},
  currentLineItems: [],
  activeBatchId: null,
  progressInterval: null,
  organization: null,
  whatsapp: {
    connected: false,
    status: 'disconnected',
    user: null,
    qrCode: null,
  },
  waPollInterval: null,
};

// DOM Elements
const elements = {
  zohoStatusBadge: document.getElementById('zohoStatusBadge'),
  zohoStatusText: document.getElementById('zohoStatusText'),
  btnRefreshData: document.getElementById('btnRefreshData'),
  btnViewHistory: document.getElementById('btnViewHistory'),

  // WhatsApp Elements
  btnOpenWhatsAppModal: document.getElementById('btnOpenWhatsAppModal'),
  waPulseDot: document.getElementById('waPulseDot'),
  whatsappStatusText: document.getElementById('whatsappStatusText'),
  metricWhatsAppReady: document.getElementById('metricWhatsAppReady'),
  chkSendWhatsApp: document.getElementById('chkSendWhatsApp'),
  confirmWhatsAppStatus: document.getElementById('confirmWhatsAppStatus'),
  whatsappModal: document.getElementById('whatsappModal'),
  btnCloseWhatsAppModal: document.getElementById('btnCloseWhatsAppModal'),
  btnDismissWhatsAppModal: document.getElementById('btnDismissWhatsAppModal'),
  waQrSection: document.getElementById('waQrSection'),
  waQrWrapper: document.getElementById('waQrWrapper'),
  waQrImage: document.getElementById('waQrImage'),
  waQrLoading: document.getElementById('waQrLoading'),
  waQrLoadingText: document.getElementById('waQrLoadingText'),
  btnRefreshQr: document.getElementById('btnRefreshQr'),
  waConnectedSection: document.getElementById('waConnectedSection'),
  waConnectedUserNumber: document.getElementById('waConnectedUserNumber'),
  waTestPhone: document.getElementById('waTestPhone'),
  btnSendTestWa: document.getElementById('btnSendTestWa'),
  btnDisconnectWa: document.getElementById('btnDisconnectWa'),

  // Metrics
  metricTotalStudents: document.getElementById('metricTotalStudents'),
  metricSelectedCount: document.getElementById('metricSelectedCount'),
  metricEmailReady: document.getElementById('metricEmailReady'),
  metricBatchTotal: document.getElementById('metricBatchTotal'),

  // Filter & Search
  gradesContainer: document.getElementById('gradesContainer'),
  chipAllCount: document.getElementById('chipAllCount'),
  searchInput: document.getElementById('searchInput'),
  btnClearSearch: document.getElementById('btnClearSearch'),

  // Students Table
  studentsCountLabel: document.getElementById('studentsCountLabel'),
  studentsTableBody: document.getElementById('studentsTableBody'),
  selectAllCheckbox: document.getElementById('selectAllCheckbox'),
  btnSelectAll: document.getElementById('btnSelectAll'),
  btnSelectWithEmail: document.getElementById('btnSelectWithEmail'),
  btnDeselectAll: document.getElementById('btnDeselectAll'),
  selectionSummary: document.getElementById('selectionSummary'),

  // Configuration Panel
  currentGradeBadge: document.getElementById('currentGradeBadge'),
  termNameInput: document.getElementById('termNameInput'),
  refPrefixInput: document.getElementById('refPrefixInput'),
  invoiceDateInput: document.getElementById('invoiceDateInput'),
  dueDateInput: document.getElementById('dueDateInput'),
  btnLoadGradeTemplate: document.getElementById('btnLoadGradeTemplate'),
  lineItemsContainer: document.getElementById('lineItemsContainer'),
  btnAddLineItem: document.getElementById('btnAddLineItem'),
  chkSendEmail: document.getElementById('chkSendEmail'),
  customNotesInput: document.getElementById('customNotesInput'),

  // Calculations
  calcFeePerStudent: document.getElementById('calcFeePerStudent'),
  calcSelectedCount: document.getElementById('calcSelectedCount'),
  calcGrandTotal: document.getElementById('calcGrandTotal'),
  btnStartBulkSend: document.getElementById('btnStartBulkSend'),
  btnDispatchSubtitle: document.getElementById('btnDispatchSubtitle'),

  // Confirmation Modal
  confirmModal: document.getElementById('confirmModal'),
  btnCloseConfirmModal: document.getElementById('btnCloseConfirmModal'),
  btnCancelConfirm: document.getElementById('btnCancelConfirm'),
  btnProceedSend: document.getElementById('btnProceedSend'),
  confirmGrade: document.getElementById('confirmGrade'),
  confirmTerm: document.getElementById('confirmTerm'),
  confirmCount: document.getElementById('confirmCount'),
  confirmTotal: document.getElementById('confirmTotal'),
  confirmEmailStatus: document.getElementById('confirmEmailStatus'),

  // Progress Modal
  progressModal: document.getElementById('progressModal'),
  btnCloseProgressModal: document.getElementById('btnCloseProgressModal'),
  progressStatusText: document.getElementById('progressStatusText'),
  progressPercentage: document.getElementById('progressPercentage'),
  progressBarFill: document.getElementById('progressBarFill'),
  progTotal: document.getElementById('progTotal'),
  progSuccess: document.getElementById('progSuccess'),
  progFailed: document.getElementById('progFailed'),
  progAmount: document.getElementById('progAmount'),
  terminalBody: document.getElementById('terminalBody'),
  terminalLiveBadge: document.getElementById('terminalLiveBadge'),
  btnExportCSV: document.getElementById('btnExportCSV'),
  btnDoneProgress: document.getElementById('btnDoneProgress'),

  // History Modal
  historyModal: document.getElementById('historyModal'),
  btnCloseHistoryModal: document.getElementById('btnCloseHistoryModal'),
  btnDismissHistory: document.getElementById('btnDismissHistory'),
  historyTableBody: document.getElementById('historyTableBody'),

  // Theme Toggle
  btnThemeToggle: document.getElementById('btnThemeToggle'),
  themeToggleIcon: document.getElementById('themeToggleIcon'),
  themeToggleText: document.getElementById('themeToggleText'),

  // Toast
  toastContainer: document.getElementById('toastContainer'),
};

// ── Initial Setup ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initDatePickers();
  bindEvents();
  initWhatsAppMonitoring();
  await loadInitialData();
});

// ── Theme Management ─────────────────────────────────────────────────────────
function initTheme() {
  const currentTheme = localStorage.getItem('wycherley_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeButtonUI(currentTheme);
}

function updateThemeButtonUI(theme) {
  if (!elements.btnThemeToggle || !elements.themeToggleIcon || !elements.themeToggleText) return;
  
  if (theme === 'light') {
    elements.themeToggleIcon.className = 'fa-solid fa-moon';
    elements.themeToggleText.textContent = 'Dark';
    elements.btnThemeToggle.title = 'Switch to Dark Mode';
  } else {
    elements.themeToggleIcon.className = 'fa-solid fa-sun';
    elements.themeToggleText.textContent = 'Light';
    elements.btnThemeToggle.title = 'Switch to Light Mode';
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('wycherley_theme', newTheme);
  updateThemeButtonUI(newTheme);
  
  const modeLabel = newTheme === 'light' ? 'Light Mode' : 'Dark Mode';
  showToast(`Switched to ${modeLabel}`, 'info');
}

function initDatePickers() {
  const today = new Date();
  const due = new Date();
  due.setDate(today.getDate() + 14); // 14 days payment period

  elements.invoiceDateInput.value = today.toISOString().split('T')[0];
  elements.dueDateInput.value = due.toISOString().split('T')[0];
}

function bindEvents() {
  // Theme Toggle
  if (elements.btnThemeToggle) {
    elements.btnThemeToggle.addEventListener('click', toggleTheme);
  }

  // WhatsApp Gateway
  if (elements.btnOpenWhatsAppModal) {
    elements.btnOpenWhatsAppModal.addEventListener('click', openWhatsAppModal);
    elements.btnCloseWhatsAppModal.addEventListener('click', closeWhatsAppModal);
    elements.btnDismissWhatsAppModal.addEventListener('click', closeWhatsAppModal);
    elements.btnRefreshQr.addEventListener('click', refreshWhatsAppQr);
    elements.btnDisconnectWa.addEventListener('click', disconnectWhatsApp);
    elements.btnSendTestWa.addEventListener('click', sendTestWhatsAppMessage);
  }

  // Refresh & History
  elements.btnRefreshData.addEventListener('click', () => loadInitialData(true));
  elements.btnViewHistory.addEventListener('click', openHistoryModal);
  elements.btnCloseHistoryModal.addEventListener('click', closeHistoryModal);
  elements.btnDismissHistory.addEventListener('click', closeHistoryModal);

  // Search
  elements.searchInput.addEventListener('input', handleSearch);
  elements.btnClearSearch.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.btnClearSearch.classList.add('hidden');
    filterAndRenderStudents();
  });

  // Selection
  elements.selectAllCheckbox.addEventListener('change', (e) => toggleSelectAll(e.target.checked));
  elements.btnSelectAll.addEventListener('click', () => toggleSelectAll(true));
  elements.btnSelectWithEmail.addEventListener('click', selectOnlyWithEmail);
  elements.btnDeselectAll.addEventListener('click', () => toggleSelectAll(false));

  // Fee Line Items
  elements.btnAddLineItem.addEventListener('click', () => addLineItem());
  elements.btnLoadGradeTemplate.addEventListener('click', () => loadPresetFeeTemplate(state.selectedGrade));

  // Send Actions
  elements.btnStartBulkSend.addEventListener('click', openConfirmModal);
  elements.btnCloseConfirmModal.addEventListener('click', closeConfirmModal);
  elements.btnCancelConfirm.addEventListener('click', closeConfirmModal);
  elements.btnProceedSend.addEventListener('click', startBulkDispatch);

  // Progress modal
  elements.btnDoneProgress.addEventListener('click', closeProgressModal);
  elements.btnCloseProgressModal.addEventListener('click', closeProgressModal);
  elements.btnExportCSV.addEventListener('click', exportResultsCSV);
}

// ── WhatsApp Gateway Management ─────────────────────────────────────────────
function initWhatsAppMonitoring() {
  checkWhatsAppStatus();
  // Check every 10 seconds in background
  setInterval(checkWhatsAppStatus, 10000);
}

async function checkWhatsAppStatus() {
  try {
    const res = await fetch('/api/whatsapp/status');
    const data = await res.json();
    state.whatsapp = data;
    updateWhatsAppUI();
  } catch (err) {
    console.warn('Failed to check WhatsApp status:', err);
  }
}

function updateWhatsAppUI() {
  const wa = state.whatsapp;
  if (!elements.btnOpenWhatsAppModal || !elements.whatsappStatusText) return;

  if (wa.connected) {
    elements.whatsappStatusText.textContent = `WhatsApp: Online (${wa.user?.number || 'Linked'})`;
    elements.waPulseDot.style.background = '#25d366';
    elements.btnOpenWhatsAppModal.style.borderColor = 'rgba(37, 211, 102, 0.5)';
    
    // In Modal
    if (elements.waQrSection && elements.waConnectedSection) {
      elements.waQrSection.classList.add('hidden');
      elements.waConnectedSection.classList.remove('hidden');
      elements.waConnectedUserNumber.textContent = `+${wa.user?.number || 'Linked'}`;
    }
  } else {
    elements.whatsappStatusText.textContent = 'WhatsApp: Disconnected';
    elements.waPulseDot.style.background = '#f59e0b';
    elements.btnOpenWhatsAppModal.style.borderColor = 'rgba(245, 158, 11, 0.4)';

    // In Modal
    if (elements.waQrSection && elements.waConnectedSection) {
      elements.waConnectedSection.classList.add('hidden');
      elements.waQrSection.classList.remove('hidden');

      if (wa.qrCode) {
        elements.waQrImage.src = wa.qrCode;
        elements.waQrImage.classList.remove('hidden');
        elements.waQrLoading.classList.add('hidden');
      } else {
        elements.waQrImage.classList.add('hidden');
        elements.waQrLoading.classList.remove('hidden');
        if (elements.waQrLoadingText) {
          elements.waQrLoadingText.textContent = wa.status === 'connecting' ? 'Initializing WhatsApp Engine...' : 'Click Refresh QR to connect...';
        }
      }
    }
  }
}

async function openWhatsAppModal() {
  elements.whatsappModal.classList.remove('hidden');
  await checkWhatsAppStatus();

  // If not connected and no QR code yet, request connect
  if (!state.whatsapp.connected && !state.whatsapp.qrCode) {
    await refreshWhatsAppQr();
  }

  // Fast poll while modal is open
  if (state.waPollInterval) clearInterval(state.waPollInterval);
  state.waPollInterval = setInterval(checkWhatsAppStatus, 2500);
}

function closeWhatsAppModal() {
  elements.whatsappModal.classList.add('hidden');
  if (state.waPollInterval) {
    clearInterval(state.waPollInterval);
    state.waPollInterval = null;
  }
}

async function refreshWhatsAppQr() {
  try {
    elements.waQrImage.classList.add('hidden');
    elements.waQrLoading.classList.remove('hidden');
    if (elements.waQrLoadingText) elements.waQrLoadingText.textContent = 'Generating fresh QR code...';

    const res = await fetch('/api/whatsapp/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true }),
    });
    const data = await res.json();
    state.whatsapp = data;
    updateWhatsAppUI();
  } catch (err) {
    showToast(`Failed to generate QR: ${err.message}`, 'error');
  }
}

async function disconnectWhatsApp() {
  if (!confirm('Are you sure you want to disconnect WhatsApp and remove this linked device?')) return;

  try {
    const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('WhatsApp unlinked successfully.', 'info');
      state.whatsapp = { connected: false, status: 'disconnected', user: null, qrCode: null };
      updateWhatsAppUI();
      refreshWhatsAppQr();
    } else {
      showToast(`Error: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Failed to disconnect: ${err.message}`, 'error');
  }
}

async function sendTestWhatsAppMessage() {
  const phone = elements.waTestPhone.value.trim();
  if (!phone) {
    showToast('Please enter a mobile phone number for testing.', 'error');
    return;
  }

  elements.btnSendTestWa.disabled = true;
  elements.btnSendTestWa.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

  try {
    const res = await fetch('/api/whatsapp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    const data = await res.json();
    if (data.success) {
      showToast(`Test message dispatched to ${phone}!`, 'success');
      elements.waTestPhone.value = '';
    } else {
      showToast(`Error sending test: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    elements.btnSendTestWa.disabled = false;
    elements.btnSendTestWa.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Test';
  }
}

// ── Data Fetching ────────────────────────────────────────────────────────────
async function loadInitialData(forceRefresh = false) {
  showToast('Connecting to Zoho Books...', 'info');

  try {
    // 1. Fetch Zoho Connection Status
    const statusRes = await fetch('/api/status');
    const statusData = await statusRes.json();
    if (statusData.organization && statusData.organization.connected) {
      state.organization = statusData.organization;
      elements.zohoStatusBadge.innerHTML = `<span class="pulse-dot"></span><span>Zoho: ${state.organization.orgName} (ID: ${state.organization.orgId})</span>`;
      elements.zohoStatusBadge.className = 'status-badge';
    } else {
      elements.zohoStatusBadge.innerHTML = `<span class="pulse-dot" style="background: var(--rose-danger)"></span><span>Zoho: Disconnected</span>`;
      elements.zohoStatusBadge.style.borderColor = 'rgba(255, 77, 109, 0.4)';
    }

    // 2. Fetch Fee Items & Templates
    const itemsRes = await fetch(`/api/items?refresh=${forceRefresh}`);
    const itemsData = await itemsRes.json();
    state.zohoItems = itemsData.items || [];
    state.feeTemplates = itemsData.templates || {};

    // 3. Fetch Grades Summary
    await loadGrades(forceRefresh);

    // 4. Fetch Students
    await loadStudents(forceRefresh);

    // 5. Initialize Default Fee Items
    loadPresetFeeTemplate(state.selectedGrade);

    showToast('Student and fee data loaded successfully!', 'success');
  } catch (err) {
    console.error('Error loading initial data:', err);
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function loadGrades(forceRefresh = false) {
  try {
    const res = await fetch(`/api/grades?refresh=${forceRefresh}`);
    const data = await res.json();
    state.grades = data.grades || [];
    renderGradePills();
  } catch (err) {
    console.error('Failed to load grades:', err);
  }
}

function renderGradePills() {
  const totalStudents = state.grades.reduce((sum, g) => sum + g.student_count, 0);
  elements.chipAllCount.textContent = totalStudents;

  let html = `
    <button class="grade-pill ${state.selectedGrade === 'ALL' ? 'active' : ''}" data-grade="ALL">
      <span>All Grades</span>
      <span class="count-chip">${totalStudents}</span>
    </button>
  `;

  state.grades.forEach((g) => {
    const isActive = state.selectedGrade === g.grade;
    html += `
      <button class="grade-pill ${isActive ? 'active' : ''}" data-grade="${g.grade}">
        <span>${g.display_name}</span>
        <span class="count-chip">${g.student_count}</span>
      </button>
    `;
  });

  elements.gradesContainer.innerHTML = html;

  // Bind click events on grade pills
  document.querySelectorAll('.grade-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const grade = btn.getAttribute('data-grade');
      selectGrade(grade);
    });
  });
}

function selectGrade(grade) {
  state.selectedGrade = grade;
  elements.currentGradeBadge.textContent = grade === 'ALL' ? 'Grade: All' : `Grade: ${grade}`;

  // Update active class on pills
  document.querySelectorAll('.grade-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-grade') === grade);
  });

  // Auto-fill Ref Prefix and load template
  if (grade !== 'ALL') {
    elements.refPrefixInput.value = `WIS-T1-G${grade}`;
    loadPresetFeeTemplate(grade);
  } else {
    elements.refPrefixInput.value = `WIS-T1`;
  }

  loadStudents();
}

async function loadStudents(forceRefresh = false) {
  elements.studentsTableBody.innerHTML = `
    <tr>
      <td colspan="7" class="state-cell">
        <div class="loading-state">
          <i class="fa-solid fa-circle-notch fa-spin"></i>
          <span>Loading students for ${state.selectedGrade === 'ALL' ? 'All Grades' : 'Grade ' + state.selectedGrade}...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    const url = `/api/students?grade=${encodeURIComponent(state.selectedGrade)}&refresh=${forceRefresh}`;
    const res = await fetch(url);
    const data = await res.json();
    state.students = data.students || [];

    // By default, keep all students unselected (0 selected)
    state.selectedStudentIds.clear();

    filterAndRenderStudents();
  } catch (err) {
    console.error('Failed to load students:', err);
    elements.studentsTableBody.innerHTML = `<tr><td colspan="7" class="state-cell text-rose">Failed to load student data.</td></tr>`;
  }
}

// ── Search & Table Rendering ─────────────────────────────────────────────────
function handleSearch(e) {
  const q = e.target.value.trim();
  elements.btnClearSearch.classList.toggle('hidden', q.length === 0);
  filterAndRenderStudents();
}

function filterAndRenderStudents() {
  const query = elements.searchInput.value.toLowerCase().trim();

  if (!query) {
    state.filteredStudents = state.students;
  } else {
    state.filteredStudents = state.students.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.admission_no.toLowerCase().includes(query) ||
        s.phone.includes(query) ||
        s.grade.toLowerCase().includes(query)
    );
  }

  renderStudentsTable();
  updateMetricsAndTotals();
}

function renderStudentsTable() {
  const students = state.filteredStudents;
  elements.studentsCountLabel.textContent = students.length;

  if (students.length === 0) {
    elements.studentsTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="state-cell">
          <i class="fa-solid fa-user-slash" style="font-size: 24px; margin-bottom: 8px;"></i>
          <p>No students found matching your filter.</p>
        </td>
      </tr>
    `;
    elements.selectAllCheckbox.checked = false;
    return;
  }

  const allFilteredSelected = students.every((s) => state.selectedStudentIds.has(s.id));
  elements.selectAllCheckbox.checked = allFilteredSelected && students.length > 0;

  let html = '';
  students.forEach((s) => {
    const isChecked = state.selectedStudentIds.has(s.id);
    const emailBadge = s.has_email
      ? `<span class="email-pill"><i class="fa-solid fa-envelope text-emerald"></i> ${s.email}</span>`
      : `<span class="email-pill missing"><i class="fa-solid fa-triangle-exclamation"></i> Missing Email</span>`;

    html += `
      <tr class="${isChecked ? 'selected' : ''}" data-id="${s.id}">
        <td>
          <input type="checkbox" class="student-checkbox" data-id="${s.id}" ${isChecked ? 'checked' : ''}>
        </td>
        <td class="student-adm">${s.admission_no || '—'}</td>
        <td>
          <div class="student-name-cell">
            <span>${s.name}</span>
          </div>
        </td>
        <td><span class="grade-badge-sm">${s.grade}</span></td>
        <td>${emailBadge}</td>
        <td class="text-secondary" style="font-size: 12px;">${s.phone || '—'}</td>
        <td class="text-right ${s.outstanding_balance > 0 ? 'text-amber' : 'text-secondary'}">
          ${s.currency_symbol || 'Rs.'} ${parseFloat(s.outstanding_balance || 0).toLocaleString()}
        </td>
      </tr>
    `;
  });

  elements.studentsTableBody.innerHTML = html;

  // Bind row & checkbox click events
  document.querySelectorAll('.student-checkbox').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      if (e.target.checked) {
        state.selectedStudentIds.add(id);
      } else {
        state.selectedStudentIds.delete(id);
      }
      e.target.closest('tr').classList.toggle('selected', e.target.checked);
      updateSelectionUI();
    });
  });
}

function toggleSelectAll(select) {
  state.filteredStudents.forEach((s) => {
    if (select) {
      state.selectedStudentIds.add(s.id);
    } else {
      state.selectedStudentIds.delete(s.id);
    }
  });
  renderStudentsTable();
  updateMetricsAndTotals();
}

function selectOnlyWithEmail() {
  state.selectedStudentIds.clear();
  state.filteredStudents.forEach((s) => {
    if (s.has_email) state.selectedStudentIds.add(s.id);
  });
  renderStudentsTable();
  updateMetricsAndTotals();
}

function updateSelectionUI() {
  const allFilteredSelected = state.filteredStudents.every((s) => state.selectedStudentIds.has(s.id));
  elements.selectAllCheckbox.checked = allFilteredSelected && state.filteredStudents.length > 0;
  updateMetricsAndTotals();
}

// ── Fee Line Items Manager ───────────────────────────────────────────────────
function loadPresetFeeTemplate(grade) {
  let template = state.feeTemplates[grade] || state.feeTemplates['DEFAULT'] || [
    { name: 'Term Fee', description: 'Tuition Fee', rate: 75000, quantity: 1 },
    { name: 'Facility & Lab Fee', description: 'IT and Library', rate: 10000, quantity: 1 },
  ];

  state.currentLineItems = JSON.parse(JSON.stringify(template));
  renderLineItems();
}

function addLineItem(name = 'New Fee Item', description = '', rate = 0, quantity = 1) {
  state.currentLineItems.push({
    item_id: `temp-${Date.now()}`,
    name,
    description,
    rate,
    quantity,
  });
  renderLineItems();
}

function removeLineItem(index) {
  if (state.currentLineItems.length <= 1) {
    showToast('At least one fee line item is required.', 'error');
    return;
  }
  state.currentLineItems.splice(index, 1);
  renderLineItems();
}

function renderLineItems() {
  let html = '';
  state.currentLineItems.forEach((item, index) => {
    html += `
      <div class="line-item-row" data-index="${index}">
        <input type="text" class="item-name-input" value="${item.name}" placeholder="Fee Title (e.g. Tuition Fee)" data-index="${index}" data-field="name">
        <input type="number" class="item-rate-input" value="${item.rate}" placeholder="Amount (LKR)" data-index="${index}" data-field="rate" min="0" step="100">
        <input type="number" class="item-qty-input" value="${item.quantity || 1}" placeholder="Qty" data-index="${index}" data-field="quantity" min="1">
        <button class="btn-remove-item" title="Remove Item" onclick="removeLineItem(${index})">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
  });

  elements.lineItemsContainer.innerHTML = html;

  // Bind input changes to state
  document.querySelectorAll('.item-name-input, .item-rate-input, .item-qty-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      const field = e.target.getAttribute('data-field');
      let val = e.target.value;
      if (field === 'rate' || field === 'quantity') val = parseFloat(val) || 0;
      state.currentLineItems[idx][field] = val;
      updateMetricsAndTotals();
    });
  });

  updateMetricsAndTotals();
}

// ── Metrics & Calculation ────────────────────────────────────────────────────
function updateMetricsAndTotals() {
  const totalInGrade = state.students.length;
  const selectedCount = state.selectedStudentIds.size;
  const emailReadyCount = state.students.filter((s) => state.selectedStudentIds.has(s.id) && s.has_email).length;
  const waReadyCount = state.students.filter((s) => state.selectedStudentIds.has(s.id) && s.has_phone).length;

  const feePerStudent = state.currentLineItems.reduce((sum, item) => {
    return sum + (parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 1);
  }, 0);

  const grandTotal = feePerStudent * selectedCount;

  // Metrics
  elements.metricTotalStudents.textContent = totalInGrade;
  elements.metricSelectedCount.textContent = selectedCount;
  elements.metricEmailReady.textContent = `${emailReadyCount} / ${selectedCount}`;
  if (elements.metricWhatsAppReady) {
    elements.metricWhatsAppReady.textContent = `${waReadyCount} / ${selectedCount}`;
  }
  elements.metricBatchTotal.textContent = `LKR ${grandTotal.toLocaleString()}`;

  // Config Box
  elements.calcFeePerStudent.textContent = `LKR ${feePerStudent.toLocaleString()}`;
  elements.calcSelectedCount.textContent = selectedCount;
  elements.calcGrandTotal.textContent = `LKR ${grandTotal.toLocaleString()}`;

  // Footer & Button
  elements.selectionSummary.textContent = `${selectedCount} of ${totalInGrade} students selected`;
  elements.btnDispatchSubtitle.textContent = `Create Invoices in Zoho Books for ${selectedCount} Students`;
  elements.btnStartBulkSend.disabled = selectedCount === 0 || feePerStudent === 0;
}

// ── Bulk Dispatch & Modal Logic ──────────────────────────────────────────────
function openConfirmModal() {
  const selectedCount = state.selectedStudentIds.size;
  if (selectedCount === 0) {
    showToast('Please select at least one student.', 'error');
    return;
  }

  const feePerStudent = state.currentLineItems.reduce((sum, item) => {
    return sum + (parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 1);
  }, 0);

  const grandTotal = feePerStudent * selectedCount;
  const willSendEmail = elements.chkSendEmail.checked;
  const willSendWhatsApp = elements.chkSendWhatsApp ? elements.chkSendWhatsApp.checked : false;

  elements.confirmGrade.textContent = state.selectedGrade === 'ALL' ? 'All Grades' : `Grade ${state.selectedGrade}`;
  elements.confirmTerm.textContent = elements.termNameInput.value || 'Term Fee';
  elements.confirmCount.textContent = `${selectedCount} Students`;
  elements.confirmTotal.textContent = `LKR ${grandTotal.toLocaleString()}`;
  elements.confirmEmailStatus.textContent = willSendEmail ? 'Enabled (Zoho PDF Email to Parents)' : 'Disabled (Create Invoice Only)';
  if (elements.confirmWhatsAppStatus) {
    elements.confirmWhatsAppStatus.textContent = willSendWhatsApp ? 'Enabled (PDF Invoice attached via WhatsApp)' : 'Disabled';
  }

  elements.confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
  elements.confirmModal.classList.add('hidden');
}

async function startBulkDispatch() {
  closeConfirmModal();

  const selectedIds = Array.from(state.selectedStudentIds);
  const config = {
    grade: state.selectedGrade,
    termName: elements.termNameInput.value.trim(),
    referencePrefix: elements.refPrefixInput.value.trim(),
    date: elements.invoiceDateInput.value,
    dueDate: elements.dueDateInput.value,
    lineItems: state.currentLineItems,
    sendEmail: elements.chkSendEmail.checked,
    sendWhatsApp: elements.chkSendWhatsApp ? elements.chkSendWhatsApp.checked : false,
    customNotes: elements.customNotesInput.value.trim(),
  };

  // Open Progress Modal
  openProgressModal();

  try {
    const res = await fetch('/api/invoices/bulk-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentIds: selectedIds,
        config: config,
      }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to start bulk dispatch');
    }

    state.activeBatchId = data.batchId;
    pollBatchProgress();
  } catch (err) {
    console.error('Failed to initiate batch:', err);
    showToast(err.message, 'error');
    addTerminalLog(`[ERROR] ${err.message}`, 'error');
  }
}

function openProgressModal() {
  elements.progressModal.classList.remove('hidden');
  elements.progressBarFill.style.width = '0%';
  elements.progressPercentage.textContent = '0%';
  elements.progressStatusText.textContent = 'Initiating batch with Zoho Books...';
  elements.progTotal.textContent = state.selectedStudentIds.size;
  elements.progSuccess.textContent = '0';
  elements.progFailed.textContent = '0';
  elements.progAmount.textContent = 'LKR 0';
  elements.terminalBody.innerHTML = '<div class="log-line log-info">[System] Connecting to Zoho Books Invoices API...</div>';
  elements.btnExportCSV.classList.add('hidden');
  elements.btnDoneProgress.classList.add('hidden');
  elements.btnCloseProgressModal.classList.add('hidden');
  elements.terminalLiveBadge.classList.remove('hidden');
}

function pollBatchProgress() {
  if (state.progressInterval) clearInterval(state.progressInterval);

  state.progressInterval = setInterval(async () => {
    if (!state.activeBatchId) return;

    try {
      const res = await fetch(`/api/invoices/progress/${state.activeBatchId}`);
      const data = await res.json();

      if (data.success && data.batch) {
        const b = data.batch;
        const percent = b.total > 0 ? Math.round((b.processed / b.total) * 100) : 0;

        elements.progressBarFill.style.width = `${percent}%`;
        elements.progressPercentage.textContent = `${percent}%`;
        elements.progTotal.textContent = b.total;
        elements.progSuccess.textContent = b.successful;
        elements.progFailed.textContent = b.failed;
        elements.progAmount.textContent = `LKR ${(b.totalBilledAmount || 0).toLocaleString()}`;

        if (b.status === 'running') {
          elements.progressStatusText.textContent = `Processing student ${b.processed} of ${b.total}...`;
        }

        // Render Terminal Logs
        if (b.logs && b.logs.length > 0) {
          elements.terminalBody.innerHTML = b.logs
            .map((l) => `<div class="log-line ${l.type === 'error' ? 'log-error' : ''}">[${l.timestamp}] ${l.message}</div>`)
            .join('');
          elements.terminalBody.scrollTop = elements.terminalBody.scrollHeight;
        }

        // Batch Completed or Failed
        if (b.status === 'completed' || b.status === 'failed') {
          clearInterval(state.progressInterval);
          elements.progressStatusText.textContent = b.status === 'completed' ? '🎉 Batch Completed Successfully!' : '⚠️ Batch Failed';
          elements.btnExportCSV.classList.remove('hidden');
          elements.btnDoneProgress.classList.remove('hidden');
          elements.btnCloseProgressModal.classList.remove('hidden');
          elements.terminalLiveBadge.classList.add('hidden');
          showToast(`Bulk Invoicing finished: ${b.successful} created!`, 'success');
        }
      }
    } catch (err) {
      console.warn('Polling error:', err);
    }
  }, 1000);
}

function closeProgressModal() {
  if (state.progressInterval) clearInterval(state.progressInterval);
  elements.progressModal.classList.add('hidden');
  // Refresh students to update balances
  loadStudents();
}

// ── Export CSV Report ────────────────────────────────────────────────────────
async function exportResultsCSV() {
  if (!state.activeBatchId) return;

  try {
    const res = await fetch(`/api/invoices/progress/${state.activeBatchId}`);
    const data = await res.json();
    if (!data.batch || !data.batch.results) return;

    const results = data.batch.results;
    let csv = 'Student ID,Student Name,Admission No,Grade,Parent Email,Phone,Invoice Number,Amount (LKR),Status,Email Status,WhatsApp Status\n';

    results.forEach((r) => {
      const emailStatus = r.emailStatus?.sent ? 'Sent' : (r.emailStatus?.error || 'Skipped');
      const waStatus = r.whatsappStatus?.sent ? 'Sent' : (r.whatsappStatus?.error || 'Skipped');
      csv += `"${r.studentId}","${r.studentName}","${r.admissionNo || ''}","${r.grade}","${r.parentEmail || ''}","${r.parentPhone || ''}","${r.invoiceNumber || ''}","${r.totalAmount || 0}","${r.success ? 'Success' : 'Failed'}","${emailStatus}","${waStatus}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Wycherley_Invoices_${state.activeBatchId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    showToast('Failed to export CSV report.', 'error');
  }
}

// ── History Modal ────────────────────────────────────────────────────────────
async function openHistoryModal() {
  elements.historyModal.classList.remove('hidden');
  elements.historyTableBody.innerHTML = `<tr><td colspan="8" class="state-cell"><i class="fa-solid fa-spinner fa-spin"></i> Loading batch history...</td></tr>`;

  try {
    const res = await fetch('/api/invoices/history');
    const data = await res.json();
    const batches = data.batches || [];

    if (batches.length === 0) {
      elements.historyTableBody.innerHTML = `<tr><td colspan="8" class="state-cell">No past bulk invoice batches found.</td></tr>`;
      return;
    }

    let html = '';
    batches.forEach((b) => {
      const dateStr = new Date(b.startTime).toLocaleString();
      const statusBadge = b.status === 'completed'
        ? '<span class="status-badge" style="display:inline-flex; padding:2px 8px; font-size:11px;">Completed</span>'
        : `<span class="email-pill missing">${b.status}</span>`;

      html += `
        <tr>
          <td style="font-family: var(--font-mono); font-size:11px;">${b.batchId}</td>
          <td style="font-size: 12px;">${dateStr}</td>
          <td><span class="grade-badge-sm">${b.grade}</span></td>
          <td>${b.termName}</td>
          <td>${b.processed} / ${b.total}</td>
          <td class="text-emerald font-weight-600">${b.successful}</td>
          <td class="text-amber">LKR ${(b.totalBilledAmount || 0).toLocaleString()}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    });

    elements.historyTableBody.innerHTML = html;
  } catch (err) {
    elements.historyTableBody.innerHTML = `<tr><td colspan="8" class="state-cell text-rose">Failed to load history.</td></tr>`;
  }
}

function closeHistoryModal() {
  elements.historyModal.classList.add('hidden');
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? 'circle-check text-emerald' : type === 'error' ? 'circle-exclamation text-rose' : 'circle-info text-blue';
  toast.innerHTML = `<i class="fa-solid fa-${icon}"></i><span>${message}</span>`;

  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function addTerminalLog(msg, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line log-${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  elements.terminalBody.appendChild(line);
  elements.terminalBody.scrollTop = elements.terminalBody.scrollHeight;
}
