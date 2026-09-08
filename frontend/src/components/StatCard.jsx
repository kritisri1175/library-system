export default function StatCard({ label, value, accent = 'brand', sub }) {
  const colors = {
    brand: 'text-brand-600 bg-brand-50',
    red: 'text-red-600 bg-red-50',
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    gray: 'text-gray-700 bg-gray-100',
  };
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colors[accent].split(' ')[0]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
