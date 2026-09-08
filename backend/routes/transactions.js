const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');
const { calculateFine, borrowPeriodDays } = require('../utils/fines');

const router = express.Router();

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function parseQrPayload(raw) {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function notify(userId, message, type = 'info') {
  db.prepare('INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)').run(userId, message, type);
}

/**
 * ISSUE a book via two-scan flow.
 * Body: { student_qr, book_qr }  -- both are the raw scanned QR text/JSON
 * (Admin/librarian operates the scanner station.)
 */
router.post('/issue', authRequired, adminOnly, (req, res) => {
  const { student_qr, book_qr } = req.body;
  if (!student_qr || !book_qr) return res.status(400).json({ error: 'student_qr and book_qr are required' });

  const studentPayload = parseQrPayload(student_qr);
  const bookPayload = parseQrPayload(book_qr);
  if (!studentPayload || studentPayload.type !== 'student') {
    return res.status(400).json({ error: 'Invalid student QR code' });
  }
  if (!bookPayload || bookPayload.type !== 'book_copy') {
    return res.status(400).json({ error: 'Invalid book QR code' });
  }

  const student = db.prepare('SELECT * FROM users WHERE student_code = ? AND role = ?').get(studentPayload.student_code, 'student');
  if (!student) return res.status(404).json({ error: 'Student not recognized' });

  const copy = db.prepare('SELECT * FROM book_copies WHERE copy_code = ?').get(bookPayload.copy_code);
  if (!copy) return res.status(404).json({ error: 'Book copy not recognized' });

  if (copy.status !== 'Available') {
    return res.status(400).json({ error: `This copy is not available (status: ${copy.status})` });
  }

  // Optional: block issuing if student has unpaid fines above a threshold
  const outstanding = db.prepare(
    `SELECT COALESCE(SUM(fine_amount - CASE WHEN fine_paid=1 THEN fine_amount ELSE 0 END),0) as total
     FROM transactions WHERE student_id = ?`
  ).get(student.id).total;
  const FINE_BLOCK_THRESHOLD = 100;
  if (outstanding >= FINE_BLOCK_THRESHOLD) {
    return res.status(400).json({ error: `Student has unpaid fines of ₹${outstanding}. Clear dues before issuing.` });
  }

  const dueAt = addDays(new Date(), borrowPeriodDays());
  const info = db.prepare(
    `INSERT INTO transactions (copy_id, book_id, student_id, due_at) VALUES (?, ?, ?, ?)`
  ).run(copy.id, copy.book_id, student.id, dueAt);

  db.prepare(`UPDATE book_copies SET status = 'Issued' WHERE id = ?`).run(copy.id);

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(copy.book_id);
  notify(student.id, `"${book.title}" issued to you. Due back on ${new Date(dueAt).toDateString()}.`, 'info');

  res.status(201).json({
    success: true,
    message: `Issued "${book.title}" to ${student.name}`,
    transaction: db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid),
  });
});

/**
 * RETURN a book via scan.
 * Body: { book_qr, condition_on_return? }
 */
router.post('/return', authRequired, adminOnly, (req, res) => {
  const { book_qr, condition_on_return } = req.body;
  if (!book_qr) return res.status(400).json({ error: 'book_qr is required' });

  const bookPayload = parseQrPayload(book_qr);
  if (!bookPayload || bookPayload.type !== 'book_copy') {
    return res.status(400).json({ error: 'Invalid book QR code' });
  }

  const copy = db.prepare('SELECT * FROM book_copies WHERE copy_code = ?').get(bookPayload.copy_code);
  if (!copy) return res.status(404).json({ error: 'Book copy not recognized' });

  const tx = db.prepare(
    `SELECT * FROM transactions WHERE copy_id = ? AND status IN ('Issued','Overdue') ORDER BY issued_at DESC LIMIT 1`
  ).get(copy.id);
  if (!tx) return res.status(400).json({ error: 'This copy has no active loan to return' });

  const now = new Date().toISOString();
  const fine = calculateFine(tx.due_at, now);
  const finalCondition = condition_on_return || copy.condition;

  db.prepare(
    `UPDATE transactions SET returned_at = ?, status = 'Returned', fine_amount = ?, condition_on_return = ? WHERE id = ?`
  ).run(now, fine, finalCondition, tx.id);

  const newCopyStatus = finalCondition === 'Lost' ? 'Lost' : finalCondition === 'Damaged' ? 'Damaged' : 'Available';
  db.prepare(`UPDATE book_copies SET status = ?, condition = ? WHERE id = ?`).run(newCopyStatus, finalCondition, copy.id);

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(copy.book_id);
  const student = db.prepare('SELECT * FROM users WHERE id = ?').get(tx.student_id);
  const fineMsg = fine > 0 ? ` A fine of ₹${fine} applies for late return.` : '';
  notify(student.id, `You returned "${book.title}".${fineMsg}`, fine > 0 ? 'fine' : 'info');

  res.json({
    success: true,
    message: `Returned "${book.title}" by ${student.name}.${fineMsg}`,
    transaction: db.prepare('SELECT * FROM transactions WHERE id = ?').get(tx.id),
  });
});

// Student: my currently borrowed books
router.get('/my/current', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, b.title, b.author, b.cover_url, bc.copy_code
    FROM transactions t
    JOIN books b ON t.book_id = b.id
    JOIN book_copies bc ON t.copy_id = bc.id
    WHERE t.student_id = ? AND t.status IN ('Issued','Overdue')
    ORDER BY t.due_at ASC
  `).all(req.user.id);
  res.json({ transactions: rows });
});

// Student: full borrowing history
router.get('/my/history', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, b.title, b.author, bc.copy_code
    FROM transactions t
    JOIN books b ON t.book_id = b.id
    JOIN book_copies bc ON t.copy_id = bc.id
    WHERE t.student_id = ?
    ORDER BY t.issued_at DESC
  `).all(req.user.id);
  res.json({ transactions: rows });
});

// Student: download own borrowing history as CSV
router.get('/my/history.csv', authRequired, (req, res) => {
  const { Parser } = require('json2csv');
  const rows = db.prepare(`
    SELECT b.title, b.author, bc.copy_code, t.issued_at, t.due_at, t.returned_at, t.status, t.fine_amount
    FROM transactions t
    JOIN books b ON t.book_id = b.id
    JOIN book_copies bc ON t.copy_id = bc.id
    WHERE t.student_id = ?
    ORDER BY t.issued_at DESC
  `).all(req.user.id);
  const parser = new Parser();
  const csv = parser.parse(rows.length ? rows : [{ note: 'No history yet' }]);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="my-borrowing-history.csv"');
  res.send(csv);
});

// Student: fine summary
router.get('/my/fines', authRequired, (req, res) => {
  const rows = db.prepare(`SELECT * FROM transactions WHERE student_id = ? AND fine_amount > 0`).all(req.user.id);
  const pending = rows.filter((r) => !r.fine_paid).reduce((s, r) => s + r.fine_amount, 0);
  const paid = rows.filter((r) => r.fine_paid).reduce((s, r) => s + r.fine_amount, 0);
  res.json({ pending, paid, records: rows });
});

// Student: notifications
router.get('/my/notifications', authRequired, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  res.json({ notifications: rows });
});
router.post('/my/notifications/:id/read', authRequired, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// Admin: mark a fine as paid
router.post('/:id/pay-fine', authRequired, adminOnly, (req, res) => {
  db.prepare('UPDATE transactions SET fine_paid = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Admin: all transactions with filters
router.get('/', authRequired, adminOnly, (req, res) => {
  const { status, student_id, book_id, category, from, to } = req.query;
  let sql = `
    SELECT t.*, b.title, b.author, b.category, u.name as student_name, u.email as student_email, bc.copy_code
    FROM transactions t
    JOIN books b ON t.book_id = b.id
    JOIN users u ON t.student_id = u.id
    JOIN book_copies bc ON t.copy_id = bc.id
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += ' AND t.status = ?'; params.push(status); }
  if (student_id) { sql += ' AND t.student_id = ?'; params.push(student_id); }
  if (book_id) { sql += ' AND t.book_id = ?'; params.push(book_id); }
  if (category) { sql += ' AND b.category = ?'; params.push(category); }
  if (from) { sql += ' AND date(t.issued_at) >= date(?)'; params.push(from); }
  if (to) { sql += ' AND date(t.issued_at) <= date(?)'; params.push(to); }
  sql += ' ORDER BY t.issued_at DESC';

  const rows = db.prepare(sql).all(...params);
  res.json({ transactions: rows });
});

module.exports = router;
