/**
 * Geolocation Utilities
 * Provides distance calculation and location-based queries
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}

/**
 * Check if coordinates are valid
 */
export function isValidCoordinates(
  latitude: number | null,
  longitude: number | null
): boolean {
  if (!latitude || !longitude) return false;
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/**
 * Get city from address (simple extraction - in production, use geocoding API)
 */
export function extractCity(address: string): string {
  const parts = address.split(',');
  return parts.length > 0 ? parts[parts.length - 1].trim() : '';
}

/**
 * Common Indian city coordinates (for distance-based discovery)
 * In production, use actual geocoding API (Google Maps, etc.)
 */
export const CITY_COORDINATES: { [key: string]: { lat: number; lon: number } } = {
  bangalore: { lat: 12.9716, lon: 77.5946 },
  bengaluru: { lat: 12.9716, lon: 77.5946 },
  delhi: { lat: 28.7041, lon: 77.1025 },
  mumbai: { lat: 19.0760, lon: 72.8777 },
  hyderabad: { lat: 17.3850, lon: 78.4867 },
  pune: { lat: 18.5204, lon: 73.8567 },
  Chennai: { lat: 13.0827, lon: 80.2707 },
  kolkata: { lat: 22.5726, lon: 88.3639 },
  jaipur: { lat: 26.912, lon: 75.7873 },
  kochi: { lat: 9.9312, lon: 76.2673 },
  lucknow: { lat: 26.8467, lon: 80.9462 },
  ahmedabad: { lat: 23.0225, lon: 72.5714 },
  indore: { lat: 22.7196, lon: 75.8577 },
  nagpur: { lat: 21.1458, lon: 79.0882 },
  surat: { lat: 21.1702, lon: 72.8311 },
};

/**
 * Find doctors near a city with optional radius
 */
export function filterDoctorsByDistance(
  doctors: any[],
  userCity: string,
  radiusKm: number = 50
): any[] {
  const userCoords = CITY_COORDINATES[userCity.toLowerCase()];
  if (!userCoords) return doctors; // Fallback: return all if city not found

  return doctors
    .filter(doctor => {
      if (!isValidCoordinates(doctor.latitude, doctor.longitude)) {
        // If doctor has no coordinates but city matches, include them
        return doctor.city.toLowerCase().includes(userCity.toLowerCase());
      }
      const distance = calculateDistance(
        userCoords.lat,
        userCoords.lon,
        doctor.latitude,
        doctor.longitude
      );
      return distance <= radiusKm;
    })
    .map(doctor => {
      if (!isValidCoordinates(doctor.latitude, doctor.longitude)) {
        return doctor;
      }
      const distance = calculateDistance(
        userCoords.lat,
        userCoords.lon,
        doctor.latitude,
        doctor.longitude
      );
      return {
        ...doctor,
        distance,
        distanceText: formatDistance(distance),
      };
    })
    .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
}
