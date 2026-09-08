const QRCode = require('qrcode');

/**
 * Generates a QR code as a base64 data URL for the given payload object.
 * Payload is JSON-stringified so the scanner can parse type + id reliably.
 */
async function generateQR(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 300 });
}

module.exports = { generateQR };
