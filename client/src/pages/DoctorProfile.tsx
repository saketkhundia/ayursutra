import { useState, useEffect } from 'react';
import { ShieldCheck, Edit2, Save, X, User2, Phone, BookOpen, Clock, Award, FileText, MapPin } from 'lucide-react';
import { api, userAuth } from '../api';

const DOCTOR_TYPES = [
  'Ayurveda',
  'Allopathy',
  'Homeopathy',
  'Unani',
  'Siddha',
  'Physiotherapy',
  'Dentistry',
  'Yoga & Naturopathy',
  'Other',
] as const;

const SPECIALIZATIONS_BY_TYPE: Record<string, string[]> = {
  Ayurveda: [
    'General Ayurveda',
    'Panchakarma Therapy',
    'Kayachikitsa (Internal Medicine)',
    'Shalya Tantra (Surgery)',
    'Shalakya Tantra (ENT & Ophthalmology)',
    'Prasuti & Stri Roga (Gynecology)',
    'Kaumarabhritya (Pediatrics)',
    'Rasayana Chikitsa (Rejuvenation)',
    'Manas Roga (Psychiatry)',
  ],
  Allopathy: [
    'General Medicine',
    'Cardiology',
    'Dermatology',
    'Neurology',
    'Orthopedics',
    'Pediatrics',
    'Psychiatry',
    'Gynecology & Obstetrics',
    'Ophthalmology',
    'ENT',
    'General Surgery',
    'Oncology',
    'Pulmonology',
    'Endocrinology',
    'Nephrology',
    'Gastroenterology',
  ],
  Homeopathy: [
    'General Homeopathy',
    'Pediatric Homeopathy',
    'Dermatological Homeopathy',
    'Constitutional Prescribing',
    'Clinical Homeopathy',
  ],
  Unani: [
    'General Unani',
    'Moalijat (Medicine)',
    'Jarahiyat (Surgery)',
    'Ilmul Qabalat (Gynecology)',
    'Ilmul Atfal (Pediatrics)',
    'Mahiyatul Amraz (Pathology)',
  ],
  Siddha: [
    'General Siddha',
    'Noi Naadal (Pathology)',
    'Sirappu Maruthuvam (Special Medicine)',
    'Gunapadam (Pharmacology)',
    'Nanju Noolum Maruthuva Neethi Noolum (Toxicology)',
  ],
  Physiotherapy: [
    'Orthopedic Physiotherapy',
    'Neurological Physiotherapy',
    'Sports Physiotherapy',
    'Cardiopulmonary Physiotherapy',
    'Pediatric Physiotherapy',
    'Geriatric Physiotherapy',
  ],
  Dentistry: [
    'General Dentistry',
    'Orthodontics',
    'Periodontics',
    'Endodontics',
    'Prosthodontics',
    'Oral Surgery',
    'Pediatric Dentistry',
  ],
  'Yoga & Naturopathy': [
    'Yoga Therapy',
    'Naturopathy',
    'Diet & Nutrition Therapy',
    'Acupuncture',
    'Hydrotherapy',
  ],
  Other: [
    'General Practice',
    'Other',
  ],
};

export default function DoctorProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    name: '',
    doctor_type: 'Ayurveda',
    specialization: '',
    bio: '',
    qualifications: '',
    experience_years: '',
    phone: '',
    license_number: '',
    // Location fields
    address: '',
    city: '',
    state: '',
    zipcode: '',
  });

  useEffect(() => {
    api.getDoctorMe()
      .then(p => {
        setProfile(p);
        setForm({
          name: p.name || '',
          doctor_type: p.doctor_type || 'Ayurveda',
          specialization: p.specialization || '',
          bio: p.bio || '',
          qualifications: p.qualifications || '',
          experience_years: String(p.experience_years || ''),
          phone: p.phone || '',
          license_number: p.license_number || '',
          address: p.address || '',
          city: p.city || '',
          state: p.state || '',
          zipcode: p.zipcode || '',
        });
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const updated = await api.updateDoctorProfile({
        name: form.name,
        doctor_type: form.doctor_type,
        specialization: form.specialization,
        bio: form.bio,
        qualifications: form.qualifications,
        experience_years: Number(form.experience_years) || 0,
        phone: form.phone,
        license_number: form.license_number,
        // Location fields
        address: form.address,
        city: form.city,
        state: form.state,
        zipcode: form.zipcode,
      });
      setProfile(updated);
      // refresh userAuth stored data
      const current = userAuth.getUser();
      userAuth.save(userAuth.getToken()!, { ...current, name: updated.name, specialization: updated.specialization }, 'doctor');
      setEditing(false);
      setSuccess('Profile updated successfully! Patients can now find you in the directory with your location.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-7 bg-stone-200 rounded w-48" />
        <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 bg-stone-200 rounded" style={{ width: `${60 + i * 8}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">My Profile</h1>
          <p className="text-stone-500 text-sm mt-1">
            Your public profile is visible to patients searching for doctors
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => { setEditing(true); setError(''); setSuccess(''); }}
            className="inline-flex items-center gap-2 bg-saffron-500 hover:bg-saffron-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <Edit2 className="w-4 h-4" /> Edit Profile
          </button>
        )}
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {editing ? (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-700">Editing Profile</h2>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(''); }}
              className="p-1.5 rounded-lg hover:bg-stone-200 text-stone-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Doctor Type</label>
                <select
                  required
                  value={form.doctor_type}
                  onChange={e => setForm(f => ({ ...f, doctor_type: e.target.value, specialization: '' }))}
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent bg-white"
                >
                  {DOCTOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Specialization</label>
              <select
                required
                value={form.specialization}
                onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))}
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent bg-white"
              >
                <option value="">Select…</option>
                {(SPECIALIZATIONS_BY_TYPE[form.doctor_type] || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">License Number</label>
                <input
                  type="text"
                  value={form.license_number}
                  onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                  placeholder="MCI-XXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Experience (years)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={form.experience_years}
                  onChange={e => setForm(f => ({ ...f, experience_years: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                  placeholder="+91…"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Qualifications</label>
              <input
                type="text"
                value={form.qualifications}
                onChange={e => setForm(f => ({ ...f, qualifications: e.target.value }))}
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                placeholder="e.g. BAMS, MD (Ayurveda), PhD"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Bio <span className="text-stone-400 font-normal">(shown to patients)</span>
              </label>
              <textarea
                rows={4}
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent resize-none"
                placeholder="Describe your practice, approach, and areas of expertise…"
              />
            </div>

            {/* Location Section */}
            <div className="border-t border-stone-200 pt-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-saffron-600" />
                <h3 className="text-base font-semibold text-stone-800">Clinic Location</h3>
                <span className="text-xs font-medium text-stone-400">(helps patients find you)</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Clinic Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                  placeholder="e.g. 123 MG Road, Building Name"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                    placeholder="e.g. Bangalore"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">State</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                    className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                    placeholder="e.g. Karnataka"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Zip Code</label>
                <input
                  type="text"
                  value={form.zipcode}
                  onChange={e => setForm(f => ({ ...f, zipcode: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-400 focus:border-transparent"
                  placeholder="e.g. 560001"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 bg-saffron-500 hover:bg-saffron-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-60 transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setError(''); }}
                className="text-sm font-medium text-stone-500 hover:text-stone-700 px-4 py-2.5 rounded-xl border border-stone-300 hover:border-stone-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {/* Profile card — how patients see you */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-saffron-400 to-saffron-600" />
            <div className="p-6">
              <div className="flex items-start gap-5 mb-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-saffron-100 to-saffron-200 flex items-center justify-center flex-shrink-0 text-3xl font-bold text-saffron-700">
                  {profile?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-xl font-bold text-stone-800">Dr. {profile?.name?.replace(/^Dr\.?\s*/i, '')}</h2>
                    {profile?.verified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        Pending Verification
                      </span>
                    )}
                  </div>
                  {profile?.specialization && (
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <span className="inline-block text-xs font-semibold text-stone-600 bg-stone-100 rounded-full px-2.5 py-0.5 border border-stone-200">
                        {profile.doctor_type || 'Ayurveda'}
                      </span>
                      <span className="inline-block text-sm font-medium text-saffron-700 bg-saffron-50 rounded-full px-3 py-0.5 border border-saffron-200">
                        {profile.specialization}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                {profile?.experience_years > 0 && (
                  <div className="flex items-center gap-2.5 text-sm text-stone-600">
                    <Clock className="w-4 h-4 text-stone-400 flex-shrink-0" />
                    <span><strong>{profile.experience_years}</strong> year{profile.experience_years !== 1 ? 's' : ''} of experience</span>
                  </div>
                )}
                {profile?.license_number && (
                  <div className="flex items-center gap-2.5 text-sm text-stone-600">
                    <BookOpen className="w-4 h-4 text-stone-400 flex-shrink-0" />
                    <span>License: <strong>{profile.license_number}</strong></span>
                  </div>
                )}
                {profile?.phone && (
                  <div className="flex items-center gap-2.5 text-sm text-stone-600">
                    <Phone className="w-4 h-4 text-stone-400 flex-shrink-0" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {profile?.email && (
                  <div className="flex items-center gap-2.5 text-sm text-stone-600">
                    <User2 className="w-4 h-4 text-stone-400 flex-shrink-0" />
                    <span>{profile.email}</span>
                  </div>
                )}
              </div>

              {profile?.qualifications && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Award className="w-4 h-4 text-stone-400" />
                    <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Qualifications</span>
                  </div>
                  <p className="text-sm text-stone-700 bg-stone-50 rounded-xl px-4 py-2.5">{profile.qualifications}</p>
                </div>
              )}

              {profile?.bio ? (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <FileText className="w-4 h-4 text-stone-400" />
                    <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">About</span>
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed">{profile.bio}</p>
                </div>
              ) : (
                <div className="text-center py-6 bg-stone-50 rounded-xl border border-dashed border-stone-300">
                  <FileText className="w-6 h-6 text-stone-300 mx-auto mb-2" />
                  <p className="text-sm text-stone-400">No bio added yet.</p>
                  <p className="text-xs text-stone-400 mt-1">Add a bio so patients can learn about you.</p>
                </div>
              )}

              {(profile?.address || profile?.city) && (
                <div className="mt-5 pt-5 border-t border-stone-200">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Clinic Location</span>
                  </div>
                  <div className="bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
                    {profile?.address && <p className="text-sm font-medium text-blue-900">{profile.address}</p>}
                    {profile?.city && (
                      <p className="text-sm text-blue-800 mt-1">
                        {profile.city}
                        {profile?.state ? `, ${profile.state}` : ''}
                        {profile?.zipcode ? ` - ${profile.zipcode}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Visibility notice */}
          <div className="bg-saffron-50 border border-saffron-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-saffron-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-saffron-800">Your profile is visible to patients</p>
              <p className="text-xs text-saffron-600 mt-0.5">
                Patients searching for "{profile?.specialization || 'your specialization'}" will see your profile in the directory.
                {!profile?.verified && ' Verification badge will appear after admin review.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
