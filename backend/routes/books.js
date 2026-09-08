const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { generateQR } = require('../utils/qrcode');
const { authRequired, adminOnly } = require('../middleware/auth');

const router = express.Router();

function attachCopies(book) {
  const copies = db.prepare('SELECT * FROM book_copies WHERE book_id = ?').all(book.id);
  const available = copies.filter((c) => c.status === 'Available').length;
  return { ...book, copies, total_copies: copies.length, available_copies: available };
}

// Search / filter catalog
router.get('/', (req, res) => {
  const { q, category, availability } = req.query;
  let sql = 'SELECT * FROM books WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY created_at DESC';
  let books = db.prepare(sql).all(...params).map(attachCopies);

  if (availability === 'available') books = books.filter((b) => b.available_copies > 0);
  if (availability === 'unavailable') books = books.filter((b) => b.available_copies === 0);

  res.json({ books });
});

router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM books ORDER BY category').all();
  res.json({ categories: rows.map((r) => r.category) });
});

router.get('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json({ book: attachCopies(book) });
});

// Admin: create book (with N copies)
router.post('/', authRequired, adminOnly, async (req, res) => {
  const { title, author, isbn, category, cover_url, description, copies = 1, shelf, rack } = req.body;
  if (!title || !author || !isbn) return res.status(400).json({ error: 'title, author, isbn required' });

  const info = db.prepare(
    `INSERT INTO books (title, author, isbn, category, cover_url, description) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(title, author, isbn, category || 'General', cover_url || null, description || null);

  const bookId = info.lastInsertRowid;
  const createdCopies = [];
  for (let i = 0; i < Math.max(1, parseInt(copies, 10)); i++) {
    const copyCode = 'BK-' + nanoid(10).toUpperCase();
    const qrPayload = JSON.stringify({ type: 'book_copy', copy_code: copyCode, book_id: bookId });
    const cInfo = db.prepare(
      `INSERT INTO book_copies (book_id, copy_code, shelf, rack, qr_payload) VALUES (?, ?, ?, ?, ?)`
    ).run(bookId, copyCode, shelf || null, rack || null, qrPayload);
    createdCopies.push(cInfo.lastInsertRowid);
  }

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  res.status(201).json({ book: attachCopies(book) });
});

// Admin: update book
router.put('/:id', authRequired, adminOnly, (req, res) => {
  const { title, author, isbn, category, cover_url, description } = req.body;
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  db.prepare(
    `UPDATE books SET title = ?, author = ?, isbn = ?, category = ?, cover_url = ?, description = ? WHERE id = ?`
  ).run(
    title ?? book.title,
    author ?? book.author,
    isbn ?? book.isbn,
    category ?? book.category,
    cover_url ?? book.cover_url,
    description ?? book.description,
    req.params.id
  );
  res.json({ book: attachCopies(db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id)) });
});

// Admin: delete book
router.delete('/:id', authRequired, adminOnly, (req, res) => {
  const activeLoans = db.prepare(
    `SELECT COUNT(*) c FROM transactions t JOIN book_copies bc ON t.copy_id = bc.id WHERE bc.book_id = ? AND t.status IN ('Issued','Overdue')`
  ).get(req.params.id);
  if (activeLoans.c > 0) return res.status(400).json({ error: 'Cannot delete: copies are currently issued' });
  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Admin: add another copy to an existing book
router.post('/:id/copies', authRequired, adminOnly, (req, res) => {
  const { shelf, rack, location_note } = req.body;
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const copyCode = 'BK-' + nanoid(10).toUpperCase();
  const qrPayload = JSON.stringify({ type: 'book_copy', copy_code: copyCode, book_id: book.id });
  const info = db.prepare(
    `INSERT INTO book_copies (book_id, copy_code, shelf, rack, location_note, qr_payload) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(book.id, copyCode, shelf || null, rack || null, location_note || null, qrPayload);

  res.status(201).json({ copy: db.prepare('SELECT * FROM book_copies WHERE id = ?').get(info.lastInsertRowid) });
});

// Admin: update a copy's condition/status/location
router.put('/copies/:copyId', authRequired, adminOnly, (req, res) => {
  const copy = db.prepare('SELECT * FROM book_copies WHERE id = ?').get(req.params.copyId);
  if (!copy) return res.status(404).json({ error: 'Copy not found' });
  const { condition, status, shelf, rack, location_note } = req.body;

  db.prepare(
    `UPDATE book_copies SET condition = ?, status = ?, shelf = ?, rack = ?, location_note = ? WHERE id = ?`
  ).run(
    condition ?? copy.condition,
    status ?? copy.status,
    shelf ?? copy.shelf,
    rack ?? copy.rack,
    location_note ?? copy.location_note,
    req.params.copyId
  );
  res.json({ copy: db.prepare('SELECT * FROM book_copies WHERE id = ?').get(req.params.copyId) });
});

// Get QR image for a specific copy (for printing)
router.get('/copies/:copyId/qr', authRequired, adminOnly, async (req, res) => {
  const copy = db.prepare('SELECT * FROM book_copies WHERE id = ?').get(req.params.copyId);
  if (!copy) return res.status(404).json({ error: 'Copy not found' });
  const qr = await generateQR(copy.qr_payload);
  res.json({ qr_code: qr, copy_code: copy.copy_code });
});

module.exports = router;
