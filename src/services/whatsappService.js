const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

// Session directory resolution:
// - Railway / local: use .whatsapp_session in project root (persistent filesystem)
// - Vercel serverless: use /tmp (only writable path, but ephemeral — WA won't persist across requests)
const SESSION_DIR = process.env.VERCEL === '1'
  ? '/tmp/.whatsapp_session'
  : path.join(process.cwd(), '.whatsapp_session');



let sock = null;
let currentQR = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | 'error'
let connectedUser = null;
let reconnectTimer = null;

// Ensure session directory exists
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

/**
 * Format phone number to WhatsApp JID (@s.whatsapp.net)
 * Handles Sri Lankan formats (0771234567, 771234567, +94771234567, etc.) and international numbers
 */
function formatToWhatsAppJid(phone) {
  if (!phone) return null;
  let clean = String(phone).replace(/\D/g, '');
  if (!clean) return null;

  // Sri Lanka: replace leading 0 with 94 (e.g. 0771234567 -> 94771234567)
  if (clean.startsWith('0')) {
    clean = '94' + clean.slice(1);
  } else if (!clean.startsWith('94') && clean.length === 9) {
    // 9 digits without leading 0 or country code (e.g. 771234567)
    clean = '94' + clean;
  }

  if (clean.length < 9) return null;
  return `${clean}@s.whatsapp.net`;
}

/**
 * Initialize WhatsApp Baileys Client
 */
async function initWhatsApp(forceNew = false) {
  if (sock && (connectionStatus === 'connected' || connectionStatus === 'connecting') && !forceNew) {
    return { status: connectionStatus, user: connectedUser, qr: currentQR };
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  try {
    connectionStatus = 'connecting';
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Wycherley School Invoicing', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          currentQR = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 320,
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          });
          connectionStatus = 'qr_ready';
          console.log('📱 [WhatsApp] New QR code generated. Scan via mobile WhatsApp -> Linked Devices.');
        } catch (qrErr) {
          console.error('❌ [WhatsApp] Failed to generate QR Code DataURL:', qrErr);
        }
      }

      if (connection === 'open') {
        connectionStatus = 'connected';
        currentQR = null;
        const userJid = sock.user?.id || '';
        const userNumber = userJid.split(':')[0] || userJid.split('@')[0];
        connectedUser = {
          id: userJid,
          number: userNumber,
          name: sock.user?.name || 'Wycherley School Admin',
        };
        console.log(`✅ [WhatsApp] Connected successfully as +${userNumber}`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.warn(`⚠️ [WhatsApp] Connection closed. Reason: ${statusCode || 'Unknown'} (Logged Out: ${isLoggedOut})`);

        currentQR = null;
        connectedUser = null;

        if (isLoggedOut) {
          connectionStatus = 'disconnected';
          try {
            if (fs.existsSync(SESSION_DIR)) {
              fs.rmSync(SESSION_DIR, { recursive: true, force: true });
              fs.mkdirSync(SESSION_DIR, { recursive: true });
            }
          } catch (cleanErr) {
            console.error('Error clearing session dir:', cleanErr);
          }
        } else {
          connectionStatus = 'disconnected';
          // Auto reconnect in 5 seconds
          reconnectTimer = setTimeout(() => {
            console.log('🔄 [WhatsApp] Attempting automatic reconnection...');
            initWhatsApp();
          }, 5000);
        }
      }
    });

    return { status: connectionStatus, user: connectedUser, qr: currentQR };
  } catch (err) {
    connectionStatus = 'error';
    console.error('❌ [WhatsApp] Initialization Error:', err);
    throw err;
  }
}

/**
 * Get current WhatsApp status
 */
function getWhatsAppStatus() {
  return {
    status: connectionStatus,
    connected: connectionStatus === 'connected',
    user: connectedUser,
    qrCode: currentQR,
  };
}

/**
 * Disconnect and log out
 */
async function disconnectWhatsApp() {
  try {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (sock) {
      await sock.logout().catch(() => {});
      sock.end();
      sock = null;
    }
    connectionStatus = 'disconnected';
    currentQR = null;
    connectedUser = null;

    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    return { success: true, message: 'WhatsApp disconnected and session removed.' };
  } catch (err) {
    console.error('Error disconnecting WhatsApp:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send WhatsApp text message
 */
async function sendTextMessage(phone, message) {
  if (connectionStatus !== 'connected' || !sock) {
    throw new Error('WhatsApp is not connected. Please scan the QR code first.');
  }

  const jid = formatToWhatsAppJid(phone);
  if (!jid) {
    throw new Error(`Invalid phone number format: ${phone}`);
  }

  return await sock.sendMessage(jid, { text: message });
}

/**
 * Send WhatsApp Invoice PDF Document with optional caption
 */
async function sendInvoicePdf(phone, pdfBuffer, fileName, caption) {
  if (connectionStatus !== 'connected' || !sock) {
    throw new Error('WhatsApp is not connected. Please scan the QR code first.');
  }

  const jid = formatToWhatsAppJid(phone);
  if (!jid) {
    throw new Error(`Invalid phone number format: ${phone}`);
  }

  return await sock.sendMessage(jid, {
    document: pdfBuffer,
    mimetype: 'application/pdf',
    fileName: fileName || 'Invoice.pdf',
    caption: caption || '',
  });
}

module.exports = {
  initWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsApp,
  sendTextMessage,
  sendInvoicePdf,
  formatToWhatsAppJid,
};
