/**
 * Frontend Geolocation Utilities
 * Handles distance calculations and location-based doctor discovery
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
  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)}km`;
  }
  return `${Math.round(distanceKm)}km`;
}

/**
 * Get user's geolocation from browser
 */
export async function getUserLocation(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        resolve(null);
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  });
}

/**
 * Common Indian city coordinates
 */
export const CITY_COORDINATES: { [key: string]: { lat: number; lon: number } } = {
  bangalore: { lat: 12.9716, lon: 77.5946 },
  bengaluru: { lat: 12.9716, lon: 77.5946 },
  delhi: { lat: 28.7041, lon: 77.1025 },
  mumbai: { lat: 19.0760, lon: 72.8777 },
  hyderabad: { lat: 17.3850, lon: 78.4867 },
  pune: { lat: 18.5204, lon: 73.8567 },
  chennai: { lat: 13.0827, lon: 80.2707 },
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
 * Add distance info to doctors based on user location
 */
export function addDistanceToDoctors(
  doctors: any[],
  userLat: number | null,
  userLon: number | null
): any[] {
  if (!userLat || !userLon) return doctors;

  return doctors.map((doctor) => {
    if (doctor.latitude && doctor.longitude) {
      const distance = calculateDistance(
        userLat,
        userLon,
        doctor.latitude,
        doctor.longitude
      );
      return {
        ...doctor,
        distance,
        distanceText: formatDistance(distance),
      };
    }
    return doctor;
  });
}

/**
 * Filter and sort doctors by distance from user
 */
export function sortDoctorsByDistance(doctors: any[]): any[] {
  return [...doctors].sort((a, b) => {
    const distanceA = a.distance ?? Infinity;
    const distanceB = b.distance ?? Infinity;
    return distanceA - distanceB;
  });
}
