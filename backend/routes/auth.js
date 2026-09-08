const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const db = require('../db');
const { generateQR } = require('../utils/qrcode');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, student_code: user.student_code },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// Register a new student
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = bcrypt.hashSync(password, 10);
    const studentCode = 'STU-' + nanoid(8).toUpperCase();

    const info = db.prepare(
      `INSERT INTO users (name, email, password, role, student_code, phone) VALUES (?, ?, ?, 'student', ?, ?)`
    ).run(name, email, hash, studentCode, phone || null);

    const qrPayload = JSON.stringify({ type: 'student', student_code: studentCode, id: info.lastInsertRowid });
    const qrDataUrl = await generateQR(qrPayload);
    db.prepare('UPDATE users SET qr_payload = ? WHERE id = ?').run(qrPayload, info.lastInsertRowid);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, student_code: user.student_code },
      qr_code: qrDataUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login (student or admin, by email)
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, student_code: user.student_code },
  });
});

// Get own profile + QR card
router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, student_code, qr_payload, phone, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// Re-fetch the student's ID QR as an image (useful if lost/cleared)
router.get('/my-qr', authRequired, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || !user.qr_payload) return res.status(404).json({ error: 'No QR on file' });
  const qrDataUrl = await generateQR(user.qr_payload);
  res.json({ qr_code: qrDataUrl });
});

module.exports = router;
