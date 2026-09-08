import { useEffect, useState } from 'react';
import api from '../api';

const emptyForm = { title: '', author: '', isbn: '', category: '', cover_url: '', description: '', copies: 1, shelf: '', rack: '' };

export default function AdminBooks() {
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [expanded, setExpanded] = useState(null);
  const [qrModal, setQrModal] = useState(null);

  function load() {
    api.get('/books').then((r) => setBooks(r.data.books));
  }
  useEffect(load, []);

  async function handleAdd(e) {
    e.preventDefault();
    await api.post('/books', form);
    setForm(emptyForm);
    load();
  }

  async function addCopy(bookId) {
    await api.post(`/books/${bookId}/copies`, {});
    load();
  }

  async function updateCopy(copyId, patch) {
    await api.put(`/books/copies/${copyId}`, patch);
    load();
  }

  async function deleteBook(id) {
    if (!confirm('Delete this book and all its copies? Only allowed if none are issued.')) return;
    try {
      await api.delete(`/books/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  }

  async function showQr(copyId) {
    const res = await api.get(`/books/copies/${copyId}/qr`);
    setQrModal(res.data);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Manage Books</h1>

      <form onSubmit={handleAdd} className="card grid md:grid-cols-3 gap-3">
        <input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input className="input" placeholder="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} required />
        <input className="input" placeholder="ISBN" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} required />
        <input className="input" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <input className="input" placeholder="Cover image URL" value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} />
        <input className="input" type="number" min="1" placeholder="Number of copies" value={form.copies} onChange={(e) => setForm({ ...form, copies: e.target.value })} />
        <input className="input" placeholder="Shelf (e.g. S1)" value={form.shelf} onChange={(e) => setForm({ ...form, shelf: e.target.value })} />
        <input className="input" placeholder="Rack (e.g. R2)" value={form.rack} onChange={(e) => setForm({ ...form, rack: e.target.value })} />
        <textarea className="input md:col-span-3" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button className="btn-primary md:col-span-3">Add Book</button>
      </form>

      <div className="space-y-3">
        {books.map((b) => (
          <div key={b.id} className="card">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{b.title} <span className="text-gray-400 text-sm">by {b.author}</span></p>
                <p className="text-xs text-gray-500">{b.category} · ISBN {b.isbn} · {b.available_copies}/{b.total_copies} available</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary !px-3 !py-1" onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
                  {expanded === b.id ? 'Hide copies' : 'Manage copies'}
                </button>
                <button className="btn-danger !px-3 !py-1" onClick={() => deleteBook(b.id)}>Delete</button>
              </div>
            </div>

            {expanded === b.id && (
              <div className="mt-4 border-t pt-3 space-y-2">
                {b.copies.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm bg-gray-50 rounded-lg p-2">
                    <span className="font-mono text-xs">{c.copy_code}</span>
                    <select className="input !py-1 !w-auto" value={c.status} onChange={(e) => updateCopy(c.id, { status: e.target.value })}>
                      <option>Available</option>
                      <option>Issued</option>
                      <option>Lost</option>
                      <option>Damaged</option>
                    </select>
                    <select className="input !py-1 !w-auto" value={c.condition} onChange={(e) => updateCopy(c.id, { condition: e.target.value })}>
                      <option>Good</option>
                      <option>Damaged</option>
                      <option>Lost</option>
                    </select>
                    <input
                      className="input !py-1 !w-20"
                      placeholder="Shelf"
                      defaultValue={c.shelf || ''}
                      onBlur={(e) => updateCopy(c.id, { shelf: e.target.value })}
                    />
                    <input
                      className="input !py-1 !w-20"
                      placeholder="Rack"
                      defaultValue={c.rack || ''}
                      onBlur={(e) => updateCopy(c.id, { rack: e.target.value })}
                    />
                    <button className="btn-secondary !px-2 !py-1" onClick={() => showQr(c.id)}>QR</button>
                  </div>
                ))}
                <button className="btn-secondary !px-3 !py-1" onClick={() => addCopy(b.id)}>+ Add another copy</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {qrModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setQrModal(null)}>
          <div className="bg-white rounded-xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="font-mono text-sm mb-2">{qrModal.copy_code}</p>
            <img src={qrModal.qr_code} className="w-56 h-56 mx-auto" alt="Copy QR" />
            <div className="flex gap-2 mt-4">
              <a href={qrModal.qr_code} download={`${qrModal.copy_code}.png`} className="btn-primary flex-1">Download</a>
              <button className="btn-secondary flex-1" onClick={() => window.print()}>Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
