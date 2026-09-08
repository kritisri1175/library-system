const express = require('express');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');
const { refreshOverdueStatuses } = require('../utils/fines');

const router = express.Router();
router.use(authRequired, adminOnly);

function buildTransactionQuery({ status, student_id, book_id, category, from, to }) {
  let sql = `
    SELECT t.id, b.title, b.author, b.category, u.name as student_name, u.email as student_email,
           bc.copy_code, t.issued_at, t.due_at, t.returned_at, t.status, t.fine_amount, t.fine_paid, t.condition_on_return
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
  return db.prepare(sql).all(...params);
}

function sendCsv(res, rows, filename) {
  if (rows.length === 0) rows = [{ note: 'No records found for the selected filters' }];
  const parser = new Parser();
  const csv = parser.parse(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

function pdfHeader(doc, title) {
  doc.fontSize(18).text(title, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('gray').text(`Generated ${new Date().toLocaleString()}`, { align: 'center' });
  doc.fillColor('black');
  doc.moveDown(1);
}

function pdfTable(doc, headers, rows, colWidths) {
  const startX = doc.x;
  let y = doc.y;
  doc.fontSize(9).font('Helvetica-Bold');
  headers.forEach((h, i) => {
    doc.text(h, startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i] });
  });
  y += 16;
  doc.moveTo(startX, y - 4).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y - 4).stroke();
  doc.font('Helvetica');
  rows.forEach((row) => {
    if (y > 740) {
      doc.addPage();
      y = doc.y;
    }
    row.forEach((cell, i) => {
      doc.text(String(cell ?? ''), startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i] });
    });
    y += 16;
  });
  doc.y = y + 10;
}

// GET /api/reports/transactions.csv?status=&student_id=&book_id=&category=&from=&to=
router.get('/transactions.csv', (req, res) => {
  refreshOverdueStatuses();
  const rows = buildTransactionQuery(req.query);
  sendCsv(res, rows, 'transactions.csv');
});

// GET /api/reports/transactions.pdf?... same filters
router.get('/transactions.pdf', (req, res) => {
  refreshOverdueStatuses();
  const rows = buildTransactionQuery(req.query);
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="transactions.pdf"');
  doc.pipe(res);
  pdfHeader(doc, 'Transactions Report');
  pdfTable(
    doc,
    ['Book', 'Student', 'Issued', 'Due', 'Returned', 'Status', 'Fine'],
    rows.map((r) => [
      r.title,
      r.student_name,
      r.issued_at?.slice(0, 10),
      r.due_at?.slice(0, 10),
      r.returned_at ? r.returned_at.slice(0, 10) : '-',
      r.status,
      r.fine_amount ? `${r.fine_amount}${r.fine_paid ? ' (paid)' : ' (due)'}` : '-',
    ]),
    [140, 110, 65, 65, 65, 55, 60]
  );
  doc.end();
});

// Overdue-book report
router.get('/overdue.csv', (req, res) => {
  refreshOverdueStatuses();
  const rows = buildTransactionQuery({ ...req.query, status: 'Overdue' });
  sendCsv(res, rows, 'overdue-books.csv');
});
router.get('/overdue.pdf', (req, res) => {
  refreshOverdueStatuses();
  const rows = buildTransactionQuery({ ...req.query, status: 'Overdue' });
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="overdue-books.pdf"');
  doc.pipe(res);
  pdfHeader(doc, 'Overdue Books Report');
  pdfTable(
    doc,
    ['Book', 'Student', 'Email', 'Due', 'Fine'],
    rows.map((r) => [r.title, r.student_name, r.student_email, r.due_at?.slice(0, 10), r.fine_amount]),
    [130, 110, 150, 70, 50]
  );
  doc.end();
});

// Currently-issued-books report
router.get('/issued.csv', (req, res) => {
  const rows = buildTransactionQuery({ ...req.query, status: req.query.status || 'Issued' });
  sendCsv(res, rows, 'currently-issued.csv');
});
router.get('/issued.pdf', (req, res) => {
  const rows = buildTransactionQuery({ ...req.query, status: req.query.status || 'Issued' });
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="currently-issued.pdf"');
  doc.pipe(res);
  pdfHeader(doc, 'Currently Issued Books');
  pdfTable(
    doc,
    ['Book', 'Copy', 'Student', 'Issued', 'Due'],
    rows.map((r) => [r.title, r.copy_code, r.student_name, r.issued_at?.slice(0, 10), r.due_at?.slice(0, 10)]),
    [140, 90, 110, 70, 70]
  );
  doc.end();
});

// Fine / penalty report
router.get('/fines.csv', (req, res) => {
  const rows = db.prepare(`
    SELECT t.id, b.title, u.name as student_name, u.email as student_email,
           t.fine_amount, t.fine_paid, t.due_at, t.returned_at
    FROM transactions t JOIN books b ON t.book_id = b.id JOIN users u ON t.student_id = u.id
    WHERE t.fine_amount > 0
    ORDER BY t.fine_paid ASC, t.fine_amount DESC
  `).all();
  sendCsv(res, rows, 'fines.csv');
});
router.get('/fines.pdf', (req, res) => {
  const rows = db.prepare(`
    SELECT t.id, b.title, u.name as student_name, t.fine_amount, t.fine_paid
    FROM transactions t JOIN books b ON t.book_id = b.id JOIN users u ON t.student_id = u.id
    WHERE t.fine_amount > 0
    ORDER BY t.fine_paid ASC, t.fine_amount DESC
  `).all();
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="fines-report.pdf"');
  doc.pipe(res);
  pdfHeader(doc, 'Fine / Penalty Report');
  const totalPending = rows.filter((r) => !r.fine_paid).reduce((s, r) => s + r.fine_amount, 0);
  const totalCollected = rows.filter((r) => r.fine_paid).reduce((s, r) => s + r.fine_amount, 0);
  doc.fontSize(10).text(`Total Collected: ₹${totalCollected}   |   Total Pending: ₹${totalPending}`);
  doc.moveDown(0.5);
  pdfTable(
    doc,
    ['Book', 'Student', 'Amount', 'Status'],
    rows.map((r) => [r.title, r.student_name, r.fine_amount, r.fine_paid ? 'Paid' : 'Pending']),
    [180, 150, 80, 80]
  );
  doc.end();
});

module.exports = router;
