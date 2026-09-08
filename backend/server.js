require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const db = require('./db');
const { refreshOverdueStatuses, borrowPeriodDays } = require('./utils/fines');

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const transactionRoutes = require('./routes/transactions');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/reports');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// --- Notifications: due-date reminders + overdue detection ---
function runDueDateSweep() {
  refreshOverdueStatuses();

  // Reminders for books due within 2 days
  const dueSoon = db.prepare(`
    SELECT t.*, b.title FROM transactions t JOIN books b ON t.book_id = b.id
    WHERE t.status = 'Issued' AND date(t.due_at) <= date('now', '+2 days')
  `).all();
  const insertNotif = db.prepare(`INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'due_soon')`);
  for (const tx of dueSoon) {
    const already = db.prepare(
      `SELECT id FROM notifications WHERE user_id = ? AND type = 'due_soon' AND message LIKE ? AND date(created_at) = date('now')`
    ).get(tx.student_id, `%${tx.title}%`);
    if (!already) insertNotif.run(tx.student_id, `Reminder: "${tx.title}" is due on ${new Date(tx.due_at).toDateString()}.`);
  }

  // Overdue alerts
  const overdue = db.prepare(`SELECT t.*, b.title FROM transactions t JOIN books b ON t.book_id = b.id WHERE t.status = 'Overdue'`).all();
  const insertOverdueNotif = db.prepare(`INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'overdue')`);
  for (const tx of overdue) {
    const already = db.prepare(
      `SELECT id FROM notifications WHERE user_id = ? AND type = 'overdue' AND message LIKE ? AND date(created_at) = date('now')`
    ).get(tx.student_id, `%${tx.title}%`);
    if (!already) insertOverdueNotif.run(tx.student_id, `Overdue: "${tx.title}" was due on ${new Date(tx.due_at).toDateString()}. Fine is accruing.`);
  }
  console.log(`[cron] Sweep complete. due_soon=${dueSoon.length} overdue=${overdue.length}`);
}

// Run once at boot, then daily at 8am server time
runDueDateSweep();
cron.schedule('0 8 * * *', runDueDateSweep);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Library backend running on http://localhost:${PORT}`);
  console.log(`Borrow period: ${borrowPeriodDays()} days`);
});
