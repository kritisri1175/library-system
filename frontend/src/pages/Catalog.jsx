import { useEffect, useState } from 'react';
import api from '../api';

export default function Catalog() {
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (category) params.category = category;
    if (availability) params.availability = availability;
    const res = await api.get('/books', { params });
    setBooks(res.data.books);
    setLoading(false);
  }

  useEffect(() => {
    api.get('/books/categories').then((res) => setCategories(res.data.categories));
    load();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q, category, availability]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Book Catalog</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          className="input max-w-xs"
          placeholder="Search title, author, ISBN..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input max-w-[180px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className="input max-w-[180px]" value={availability} onChange={(e) => setAvailability(e.target.value)}>
          <option value="">Any availability</option>
          <option value="available">Available only</option>
          <option value="unavailable">Unavailable only</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : books.length === 0 ? (
        <p className="text-gray-500">No books match your filters.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {books.map((b) => (
            <div key={b.id} className="card flex flex-col">
              <div className="aspect-[2/3] bg-gray-100 rounded-lg overflow-hidden mb-2 flex items-center justify-center">
                {b.cover_url ? (
                  <img src={b.cover_url} alt={b.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">📖</span>
                )}
              </div>
              <p className="font-semibold text-sm leading-tight line-clamp-2">{b.title}</p>
              <p className="text-xs text-gray-500">{b.author}</p>
              <p className="text-xs text-gray-400 mt-1">{b.category}</p>
              <div className="mt-auto pt-2">
                <span className={`badge ${b.available_copies > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {b.available_copies}/{b.total_copies} available
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
