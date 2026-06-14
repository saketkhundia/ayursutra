import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShieldCheck, Clock, BookOpen, Phone, Users, Filter, UserCircle, MapPin, Navigation } from 'lucide-react';
import { api, userAuth } from '../api';
import { getUserLocation, addDistanceToDoctors } from '../utils/geolocation';

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

function DoctorCard({ doctor, onViewProfile }: { doctor: any; onViewProfile: (id: string) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E3DA] hover:border-[#4E9A6F] hover:shadow-lg transition-all duration-200 overflow-hidden group">
      {/* Top accent bar */}
      <div className="h-1.5 bg-[#4E9A6F]" />

      <div className="p-6">
        {/* Avatar + Name */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-[#EDF4EF] flex items-center justify-center flex-shrink-0 text-2xl font-bold text-[#4E9A6F]">
            {doctor.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-[#1C1C1C] truncate">Dr. {doctor.name.replace(/^Dr\.?\s*/i, '')}</h3>
              {doctor.verified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4E9A6F] bg-[#EDF4EF] border border-[#C5DDD0] rounded-full px-2 py-0.5">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            <span className="inline-block mt-1 text-xs font-medium text-[#4E9A6F] bg-[#EDF4EF] rounded-full px-2.5 py-0.5 border border-[#C5DDD0]">
              {doctor.specialization}
            </span>
            <span className="inline-block mt-1 ml-1 text-[10px] font-semibold text-[#7A7570] bg-[#F7F5F0] rounded-full px-2 py-0.5 border border-[#E8E3DA]">
              {doctor.doctor_type || 'Ayurveda'}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-[#7A7570] mb-4">
          {doctor.experience_years > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#7A7570]" />
              {doctor.experience_years} yr{doctor.experience_years !== 1 ? 's' : ''} exp
            </span>
          )}
          {doctor.license_number && (
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-[#7A7570]" />
              {doctor.license_number}
            </span>
          )}
          {doctor.distanceText && (
            <span className="flex items-center gap-1 text-[#4E9A6F] font-medium">
              <Navigation className="w-3.5 h-3.5" />
              {doctor.distanceText}
            </span>
          )}
        </div>

        {/* Location info */}
        {(doctor.address || doctor.city) && (
          <div className="mb-4 p-3 bg-[#EDF4EF] rounded-lg border border-[#C5DDD0]">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#4E9A6F] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-[#1C1C1C] min-w-0">
                {doctor.address && <p className="font-medium truncate">{doctor.address}</p>}
                {doctor.city && (
                  <p className="text-[#5A5550]">
                    {doctor.city}
                    {doctor.state ? `, ${doctor.state}` : ''}
                    {doctor.zipcode ? ` - ${doctor.zipcode}` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bio */}
        {doctor.bio ? (
          <p className="text-sm text-[#5A5550] leading-relaxed mb-4 line-clamp-3">
            {doctor.bio}
          </p>
        ) : (
          <p className="text-sm text-[#7A7570] italic mb-4">
            No bio provided yet.
          </p>
        )}

        {/* Qualifications */}
        {doctor.qualifications && (
          <p className="text-xs text-[#7A7570] mb-4 bg-[#F7F5F0] rounded-lg px-3 py-2 line-clamp-2">
            <span className="font-medium text-[#5A5550]">Qualifications: </span>
            {doctor.qualifications}
          </p>
        )}

        {/* Contact + Action */}
        <div className="flex items-center justify-between pt-4 border-t border-[#E8E3DA]">
          {doctor.phone ? (
            <span className="flex items-center gap-1.5 text-xs text-[#7A7570]">
              <Phone className="w-3.5 h-3.5" />
              {doctor.phone}
            </span>
          ) : (
            <span />
          )}
          <button 
            onClick={() => onViewProfile(doctor.id)}
            className="bg-[#4E9A6F] hover:bg-[#4E9A6F]/90 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors group-hover:shadow-md"
          >
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FindDoctors() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterSpec, setFilterSpec] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'experience' | 'distance'>('relevance');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const currentUser = userAuth.getUser();

  // Load doctors and user location on mount
  useEffect(() => {
    Promise.all([
      api.getPublicDoctors(),
      getUserLocation(),
    ])
      .then(([doctors, location]) => {
        let doctorList = Array.isArray(doctors) ? doctors : [];
        
        // Add distance data if user location is available
        if (location) {
          setUserLocation(location);
          doctorList = addDistanceToDoctors(doctorList, location.latitude, location.longitude);
        }
        
        setDoctors(doctorList);
      })
      .catch(() => {
        setDoctors([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Filter doctors
  const filtered = doctors.filter(d => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.specialization.toLowerCase().includes(q) ||
      (d.doctor_type || '').toLowerCase().includes(q) ||
      (d.bio || '').toLowerCase().includes(q) ||
      (d.qualifications || '').toLowerCase().includes(q) ||
      (d.city || '').toLowerCase().includes(q);
    const matchSpec = !filterSpec || d.specialization === filterSpec;
    const matchType = !filterType || (d.doctor_type || 'Ayurveda') === filterType;
    const matchCity = !filterCity || (d.city || '').toLowerCase().includes(filterCity.toLowerCase());
    return matchSearch && matchSpec && matchType && matchCity;
  });

  // Sort doctors
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'distance') {
      const distA = a.distance ?? Infinity;
      const distB = b.distance ?? Infinity;
      return distA - distB;
    } else if (sortBy === 'experience') {
      return (b.experience_years || 0) - (a.experience_years || 0);
    } else {
      // relevance: verified first, then experience, then name
      if (b.verified !== a.verified) return b.verified ? 1 : -1;
      if ((b.experience_years || 0) !== (a.experience_years || 0)) {
        return (b.experience_years || 0) - (a.experience_years || 0);
      }
      return a.name.localeCompare(b.name);
    }
  });

  return (
    <div className="space-y-6">
      {/* Patient identity banner */}
      <div className="flex items-center gap-3 bg-[#EDF4EF] border border-[#C5DDD0] rounded-xl px-4 py-3">
        <div className="w-9 h-9 rounded-xl bg-[#EDF4EF] flex items-center justify-center flex-shrink-0">
          <UserCircle className="w-5 h-5 text-[#4E9A6F]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#4E9A6F]">Patient Portal</p>
          <p className="text-xs text-[#7A7570]">Logged in as {currentUser?.name || 'Patient'} &mdash; find nearby doctors</p>
        </div>
        {userLocation && (
          <div className="flex items-center gap-1.5 text-xs bg-[#EDF4EF] text-[#4E9A6F] px-3 py-1.5 rounded-lg border border-[#C5DDD0]">
            <Navigation className="w-3 h-3" />
            Location detected
          </div>
        )}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1C1C1C]">Find Doctors near you</h1>
        <p className="text-[#7A7570] text-sm mt-1">
          Browse certified practitioners by specialization and location
        </p>
      </div>

      {/* Search + Filter bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4.5 h-4.5 text-[#7A7570]" />
            <input
              type="text"
              placeholder="Search by name, specialization, or expertise…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-[#E8E3DA] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] focus:border-transparent bg-white"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3.5 top-3 w-4 h-4 text-[#7A7570]" />
            <select
              value={filterType}
              onChange={e => { setFilterType(e.target.value); setFilterSpec(''); }}
              className="border border-[#E8E3DA] rounded-xl pl-10 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] focus:border-transparent bg-white appearance-none min-w-[180px]"
            >
              <option value="">All Doctor Types</option>
              {DOCTOR_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Second row: Specialization, City, and Sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <select
              value={filterSpec}
              onChange={e => setFilterSpec(e.target.value)}
              className="border border-[#E8E3DA] rounded-xl px-4 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] focus:border-transparent bg-white appearance-none w-full"
            >
              <option value="">All Specializations</option>
              {[...new Set(doctors.filter(d => !filterType || (d.doctor_type || 'Ayurveda') === filterType).map(d => d.specialization).filter(Boolean))].sort().map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-[#7A7570]" />
            <input
              type="text"
              placeholder="Filter by city..."
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              className="border border-[#E8E3DA] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] focus:border-transparent bg-white w-full"
            />
          </div>

          <div className="relative min-w-[150px]">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="border border-[#E8E3DA] rounded-xl px-4 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E9A6F] focus:border-transparent bg-white appearance-none w-full"
            >
              <option value="relevance">Sort by Relevance</option>
              {userLocation && <option value="distance">Sort by Distance</option>}
              <option value="experience">Sort by Experience</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results count */}
      {!loading && !error && (
        <div className="flex items-center gap-2 text-sm text-[#7A7570]">
          <Users className="w-4 h-4" />
          <span>
            {sorted.length === 0
              ? 'No doctors found'
              : `${sorted.length} doctor${sorted.length !== 1 ? 's' : ''} available`}
            {(search || filterSpec || filterType || filterCity) && ' matching your search'}
          </span>
        </div>
      )}

      {/* States */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E8E3DA] p-6 animate-pulse">
              <div className="flex gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-[#F7F5F0]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#F7F5F0] rounded w-3/4" />
                  <div className="h-3 bg-[#F7F5F0] rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-[#F7F5F0] rounded" />
                <div className="h-3 bg-[#F7F5F0] rounded w-5/6" />
                <div className="h-3 bg-[#F7F5F0] rounded w-4/6" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-16">
          <p className="text-red-600 font-medium mb-3">{error}</p>
          <button
            onClick={() => { setError(''); setLoading(true); api.getPublicDoctors().then(setDoctors).catch(() => setError('Failed to load.')).finally(() => setLoading(false)); }}
            className="text-sm text-[#4E9A6F] hover:text-[#4E9A6F]/80 underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[#F7F5F0] flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-[#7A7570]" />
          </div>
          {doctors.length === 0 ? (
            <>
              <h3 className="text-[#1C1C1C] font-semibold mb-2">No doctors available yet</h3>
              <p className="text-[#7A7570] text-sm max-w-sm mx-auto">Verified practitioners will appear here once they join the platform.</p>
            </>
          ) : (
            <>
              <h3 className="text-[#1C1C1C] font-semibold mb-2">No doctors match your search</h3>
              <p className="text-[#7A7570] text-sm">Try a different specialization or clear your search.</p>
              <button
                onClick={() => { setSearch(''); setFilterSpec(''); setFilterType(''); }}
                className="mt-3 text-sm text-[#4E9A6F] hover:text-[#4E9A6F]/80 underline"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(doc => (
            <DoctorCard 
              key={doc.id} 
              doctor={doc}
              onViewProfile={(id) => navigate(`/doctor/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
