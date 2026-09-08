import { useState } from 'react';
import QRScanner from '../components/QRScanner';
import api from '../api';

export default function ScanIssueReturn() {
  const [mode, setMode] = useState('issue'); // issue | return
  const [step, setStep] = useState(1); // for issue: 1 = scan student, 2 = scan book
  const [studentQr, setStudentQr] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [scannerKey, setScannerKey] = useState(0);

  function reset() {
    setStep(1);
    setStudentQr(null);
    setStudentInfo(null);
    setResult(null);
    setError('');
    setScannerKey((k) => k + 1);
  }

  function switchMode(m) {
    setMode(m);
    reset();
  }

  async function handleStudentScan(text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.type !== 'student') {
        setError('That QR is not a student ID. Scan a student card.');
        return;
      }
      setStudentQr(text);
      setStudentInfo(parsed);
      setError('');
      setStep(2);
    } catch {
      setError('Unrecognized QR code.');
    }
  }

  async function handleBookScan(text) {
    setError('');
    try {
      if (mode === 'issue') {
        const res = await api.post('/transactions/issue', { student_qr: studentQr, book_qr: text });
        setResult(res.data.message);
      } else {
        const res = await api.post('/transactions/return', { book_qr: text });
        setResult(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-1">Scan Station</h1>
      <p className="text-gray-500 text-sm mb-5">Issue or return books using QR scans.</p>

      <div className="flex gap-2 mb-5">
        <button className={`btn-secondary flex-1 ${mode === 'issue' ? '!bg-brand-500 !text-white' : ''}`} onClick={() => switchMode('issue')}>
          Issue Book
        </button>
        <button className={`btn-secondary flex-1 ${mode === 'return' ? '!bg-brand-500 !text-white' : ''}`} onClick={() => switchMode('return')}>
          Return Book
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-2 mb-3">{error}</div>}

      {result ? (
        <div className="card text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-semibold">{result}</p>
          <button className="btn-primary mt-4" onClick={reset}>Scan next</button>
        </div>
      ) : mode === 'issue' ? (
        <div className="card">
          <p className="text-sm font-medium mb-3">
            {step === 1 ? 'Step 1: Scan the student ID card' : `Step 2: Scan the book copy QR (student: ${studentInfo?.student_code})`}
          </p>
          <QRScanner key={scannerKey + '-' + step} onScan={step === 1 ? handleStudentScan : handleBookScan} />
          {step === 2 && (
            <button className="btn-secondary w-full mt-3" onClick={reset}>Cancel / rescan student</button>
          )}
        </div>
      ) : (
        <div className="card">
          <p className="text-sm font-medium mb-3">Scan the book copy QR to return it</p>
          <QRScanner key={scannerKey} onScan={handleBookScan} />
        </div>
      )}
    </div>
  );
}
