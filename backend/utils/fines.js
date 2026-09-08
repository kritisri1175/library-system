const db = require('../db');

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

/** Calculate fine (in currency units) for a transaction as of "now". */
function calculateFine(dueAt, returnedAt) {
  const finePerDay = parseFloat(getSetting('fine_per_day', '5'));
  const due = new Date(dueAt);
  const compareDate = returnedAt ? new Date(returnedAt) : new Date();
  const diffMs = compareDate - due;
  if (diffMs <= 0) return 0;
  const daysLate = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return +(daysLate * finePerDay).toFixed(2);
}

/** Sweep all active transactions: mark overdue + refresh live fine amounts. */
function refreshOverdueStatuses() {
  const active = db.prepare(`SELECT * FROM transactions WHERE status IN ('Issued','Overdue')`).all();
  const updateStmt = db.prepare(`UPDATE transactions SET status = ?, fine_amount = ? WHERE id = ?`);
  const now = new Date();
  let overdueCount = 0;
  for (const tx of active) {
    const due = new Date(tx.due_at);
    const isOverdue = now > due;
    const fine = calculateFine(tx.due_at, null);
    const newStatus = isOverdue ? 'Overdue' : 'Issued';
    if (isOverdue) overdueCount++;
    if (newStatus !== tx.status || fine !== tx.fine_amount) {
      updateStmt.run(newStatus, fine, tx.id);
    }
  }
  return overdueCount;
}

function borrowPeriodDays() {
  return parseInt(getSetting('borrow_period_days', '14'), 10);
}

module.exports = { calculateFine, refreshOverdueStatuses, getSetting, borrowPeriodDays };
