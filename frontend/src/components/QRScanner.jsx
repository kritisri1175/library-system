import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

/**
 * Renders a live camera QR scanner.
 * Calls onScan(decodedText) once per successful scan and pauses briefly to avoid duplicate fires.
 */
export default function QRScanner({ onScan, active = true, elementId = 'qr-reader' }) {
  const scannerRef = useRef(null);
  const lastScanRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const scanner = new Html5Qrcode(elementId);
    scannerRef.current = scanner;
    let stopped = false;

    Html5Qrcode.getCameras()
      .then((cameras) => {
        if (stopped || !cameras || cameras.length === 0) return;
        const cameraId = cameras[0].id;
        scanner
          .start(
            cameraId,
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              const now = Date.now();
              if (now - lastScanRef.current < 2000) return; // debounce
              lastScanRef.current = now;
              onScan(decodedText);
            },
            () => {} // ignore per-frame scan failures
          )
          .catch((err) => console.error('QR start error', err));
      })
      .catch((err) => console.error('Camera access error', err));

    return () => {
      stopped = true;
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current.clear())
          .catch(() => {});
      }
    };
  }, [active, elementId]);

  return (
    <div>
      <div id={elementId} className="w-full max-w-sm mx-auto rounded-lg overflow-hidden border border-gray-200" />
      <p className="text-xs text-gray-500 text-center mt-2">Point the camera at a QR code. Requires camera permission.</p>
    </div>
  );
}
