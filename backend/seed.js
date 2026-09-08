require('dotenv').config();
const db = require('./db');
const { nanoid } = require('nanoid');

const sampleBooks = [
  { title: 'Clean Code', author: 'Robert C. Martin', isbn: '9780132350884', category: 'Technology', copies: 2, cover_url: 'https://covers.openlibrary.org/b/isbn/9780132350884-M.jpg' },
  { title: 'The Pragmatic Programmer', author: 'Andrew Hunt', isbn: '9780201616224', category: 'Technology', copies: 2, cover_url: 'https://covers.openlibrary.org/b/isbn/9780201616224-M.jpg' },
  { title: 'To Kill a Mockingbird', author: 'Harper Lee', isbn: '9780061120084', category: 'Fiction', copies: 3, cover_url: 'https://covers.openlibrary.org/b/isbn/9780061120084-M.jpg' },
  { title: '1984', author: 'George Orwell', isbn: '9780451524935', category: 'Fiction', copies: 3, cover_url: 'https://covers.openlibrary.org/b/isbn/9780451524935-M.jpg' },
  { title: 'Sapiens', author: 'Yuval Noah Harari', isbn: '9780062316097', category: 'Non-fiction', copies: 2, cover_url: 'https://covers.openlibrary.org/b/isbn/9780062316097-M.jpg' },
  { title: 'A Brief History of Time', author: 'Stephen Hawking', isbn: '9780553380163', category: 'Science', copies: 2, cover_url: 'https://covers.openlibrary.org/b/isbn/9780553380163-M.jpg' },
];

const insertBook = db.prepare(`INSERT INTO books (title, author, isbn, category, cover_url) VALUES (?, ?, ?, ?, ?)`);
const insertCopy = db.prepare(`INSERT INTO book_copies (book_id, copy_code, shelf, rack, qr_payload) VALUES (?, ?, ?, ?, ?)`);

const existingCount = db.prepare('SELECT COUNT(*) c FROM books').get().c;
if (existingCount > 0) {
  console.log('Books already exist, skipping seed. Delete data/library.db to reseed.');
  process.exit(0);
}

for (const b of sampleBooks) {
  const info = insertBook.run(b.title, b.author, b.isbn, b.category, b.cover_url);
  const bookId = info.lastInsertRowid;
  for (let i = 0; i < b.copies; i++) {
    const copyCode = 'BK-' + nanoid(10).toUpperCase();
    const qrPayload = JSON.stringify({ type: 'book_copy', copy_code: copyCode, book_id: bookId });
    insertCopy.run(bookId, copyCode, `S${(i % 3) + 1}`, `R${(i % 5) + 1}`, qrPayload);
  }
}

console.log(`Seeded ${sampleBooks.length} titles with copies.`);
