import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, User, Phone, Mail, X } from 'lucide-react';
import { api } from '../api';

export default function Patients() {
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    name: '', age: '', gender: 'Male', phone: '', email: '',
    address: '', medical_history: '', prakriti: '', current_dosha_imbalance: '', allergies: ''
  });

  const loadPatients = () => {
    setLoading(true);
    setLoadError('');
    api.getPatients()
      .then(setPatients)
      .catch(err => setLoadError(err.message || 'Failed to connect to server'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPatients(); }, []);

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.prakriti?.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      await api.createPatient({ ...form, age: parseInt(form.age) });
      setForm({ name: '', age: '', gender: 'Male', phone: '', email: '', address: '', medical_history: '', prakriti: '', current_dosha_imbalance: '', allergies: '' });
      setShowForm(false);
      loadPatients();
    } catch (err: any) {
      setFormError(err.message || 'Failed to add patient. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const doshaColors: Record<string, string> = {
    Vata: 'bg-blue-100 text-blue-800',
    Pitta: 'bg-red-100 text-red-800',
    Kapha: 'bg-green-100 text-green-800',
    'Vata-Pitta': 'bg-purple-100 text-purple-800',
    'Kapha-Pitta': 'bg-amber-100 text-amber-800',
    'Kapha-Vata': 'bg-teal-100 text-teal-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Patients</h1>
          <p className="text-stone-500 mt-1">Manage patient records and profiles</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-saffron-500 text-white px-4 py-2.5 rounded-lg hover:bg-saffron-600 transition-colors font-medium text-sm">
          <Plus className="w-4 h-4" /> Add Patient
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
        <input
          type="text"
          placeholder="Search patients by name, prakriti, or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40 focus:border-saffron-500"
        />
      </div>

      {/* Patient Cards */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-saffron-500 border-t-transparent rounded-full" /></div>
      ) : loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium mb-1">Could not load patients</p>
          <p className="text-red-500 text-sm mb-3">{loadError}</p>
          <button onClick={loadPatients} className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium">Retry</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPatients.map(patient => (
            <Link key={patient.id} to={`/patients/${patient.id}`} className="bg-white rounded-xl border border-stone-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-saffron-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-saffron-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-stone-900 truncate">{patient.name}</h3>
                  <p className="text-sm text-stone-500">{patient.age} yrs &middot; {patient.gender}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {patient.prakriti && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${doshaColors[patient.prakriti] || 'bg-stone-100 text-stone-700'}`}>
                    {patient.prakriti}
                  </span>
                )}
                {patient.current_dosha_imbalance && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-saffron-100 text-saffron-700">
                    Imbalance: {patient.current_dosha_imbalance}
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-1 text-sm text-stone-500">
                {patient.phone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{patient.phone}</p>}
                {patient.email && <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{patient.email}</p>}
              </div>
            </Link>
          ))}
          {filteredPatients.length === 0 && (
            <div className="col-span-full py-12 text-center text-stone-400">No patients found</div>
          )}
        </div>
      )}

      {/* Add Patient Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Add New Patient</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-stone-100"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">{formError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Name *</label>
                  <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Age *</label>
                  <input required type="number" min="1" max="120" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Gender *</label>
                  <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40">
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Address</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Prakriti</label>
                  <select value={form.prakriti} onChange={e => setForm({ ...form, prakriti: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40">
                    <option value="">Select...</option>
                    <option>Vata</option><option>Pitta</option><option>Kapha</option>
                    <option>Vata-Pitta</option><option>Kapha-Pitta</option><option>Kapha-Vata</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Dosha Imbalance</label>
                  <select value={form.current_dosha_imbalance} onChange={e => setForm({ ...form, current_dosha_imbalance: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40">
                    <option value="">Select...</option>
                    <option>Vata</option><option>Pitta</option><option>Kapha</option>
                    <option>Vata-Pitta</option><option>Kapha-Pitta</option><option>Kapha-Vata</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Medical History</label>
                <textarea value={form.medical_history} onChange={e => setForm({ ...form, medical_history: e.target.value })} rows={2} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Allergies</label>
                <input value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron-500/40" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-stone-200 rounded-lg hover:bg-stone-50 font-medium text-sm">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-saffron-500 text-white rounded-lg hover:bg-saffron-600 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Adding...' : 'Add Patient'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
