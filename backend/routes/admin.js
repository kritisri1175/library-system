const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');
const { refreshOverdueStatuses, getSetting } = require('../utils/fines');

const router = express.Router();
router.use(authRequired, adminOnly);

router.get('/stats', (req, res) => {
  refreshOverdueStatuses();

  const totalBooks = db.prepare('SELECT COUNT(*) c FROM book_copies').get().c;
  const availableBooks = db.prepare(`SELECT COUNT(*) c FROM book_copies WHERE status = 'Available'`).get().c;
  const issuedBooks = db.prepare(`SELECT COUNT(*) c FROM book_copies WHERE status = 'Issued'`).get().c;
  const overdueBooks = db.prepare(`SELECT COUNT(*) c FROM transactions WHERE status = 'Overdue'`).get().c;
  const totalMembers = db.prepare(`SELECT COUNT(*) c FROM users WHERE role = 'student'`).get().c;
  const totalTitles = db.prepare('SELECT COUNT(*) c FROM books').get().c;

  const fineStats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN fine_paid = 1 THEN fine_amount ELSE 0 END), 0) as collected,
      COALESCE(SUM(CASE WHEN fine_paid = 0 THEN fine_amount ELSE 0 END), 0) as pending
    FROM transactions
  `).get();

  const mostBorrowed = db.prepare(`
    SELECT b.id, b.title, b.author, COUNT(*) as times_borrowed
    FROM transactions t JOIN books b ON t.book_id = b.id
    GROUP BY b.id ORDER BY times_borrowed DESC LIMIT 5
  `).all();

  const mostActiveBorrowers = db.prepare(`
    SELECT u.id, u.name, u.student_code, COUNT(*) as total_borrows
    FROM transactions t JOIN users u ON t.student_id = u.id
    GROUP BY u.id ORDER BY total_borrows DESC LIMIT 5
  `).all();

  const categoryStats = db.prepare(`
    SELECT b.category, COUNT(DISTINCT b.id) as titles, COUNT(bc.id) as copies,
           SUM(CASE WHEN bc.status = 'Available' THEN 1 ELSE 0 END) as available
    FROM books b LEFT JOIN book_copies bc ON bc.book_id = b.id
    GROUP BY b.category
  `).all();

  const issuedPerDay = db.prepare(`
    SELECT date(issued_at) as day, COUNT(*) as count
    FROM transactions
    WHERE issued_at >= date('now', '-30 days')
    GROUP BY day ORDER BY day
  `).all();

  const returnedPerDay = db.prepare(`
    SELECT date(returned_at) as day, COUNT(*) as count
    FROM transactions
    WHERE returned_at IS NOT NULL AND returned_at >= date('now', '-30 days')
    GROUP BY day ORDER BY day
  `).all();

  const recentTransactions = db.prepare(`
    SELECT t.*, b.title, u.name as student_name, bc.copy_code
    FROM transactions t
    JOIN books b ON t.book_id = b.id
    JOIN users u ON t.student_id = u.id
    JOIN book_copies bc ON t.copy_id = bc.id
    ORDER BY t.issued_at DESC LIMIT 10
  `).all();

  res.json({
    totals: {
      total_titles: totalTitles,
      total_books: totalBooks,
      available_books: availableBooks,
      issued_books: issuedBooks,
      overdue_books: overdueBooks,
      total_members: totalMembers,
      fine_collected: fineStats.collected,
      fine_pending: fineStats.pending,
    },
    most_borrowed: mostBorrowed,
    most_active_borrowers: mostActiveBorrowers,
    category_stats: categoryStats,
    issued_per_day: issuedPerDay,
    returned_per_day: returnedPerDay,
    recent_transactions: recentTransactions,
  });
});

// Settings: borrow period & fine rate
router.get('/settings', (req, res) => {
  res.json({
    borrow_period_days: getSetting('borrow_period_days', '14'),
    fine_per_day: getSetting('fine_per_day', '5'),
  });
});
router.put('/settings', (req, res) => {
  const { borrow_period_days, fine_per_day } = req.body;
  const upsert = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  if (borrow_period_days) upsert.run('borrow_period_days', String(borrow_period_days));
  if (fine_per_day) upsert.run('fine_per_day', String(fine_per_day));
  res.json({ success: true });
});

// List students (for admin lookups / filters)
router.get('/students', (req, res) => {
  const rows = db.prepare(`SELECT id, name, email, student_code, phone, created_at FROM users WHERE role = 'student' ORDER BY created_at DESC`).all();
  res.json({ students: rows });
});

// Overdue list (for alerts panel)
router.get('/overdue', (req, res) => {
  refreshOverdueStatuses();
  const rows = db.prepare(`
    SELECT t.*, b.title, u.name as student_name, u.email as student_email, bc.copy_code
    FROM transactions t
    JOIN books b ON t.book_id = b.id
    JOIN users u ON t.student_id = u.id
    JOIN book_copies bc ON t.copy_id = bc.id
    WHERE t.status = 'Overdue'
    ORDER BY t.due_at ASC
  `).all();
  res.json({ overdue: rows });
});

module.exports = router;
