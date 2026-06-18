/**
 * OpenRouteService integration with Redis caching
 * Cache key: "ors:{origin}|{destination}|{mode}"
 * Cache TTL: 7 days (routes don't change)
 *
 * Time Complexity:
 *   - Cache hit:  O(1) Redis lookup
 *   - Cache miss: O(network) → O(1) store
 *
 * Fallback (no ORS key): Uses Nominatim (OpenStreetMap, free) for
 * geocoding + haversine formula. Road modes apply a 1.3x correction factor.
 */

const axios = require('axios');
const { getOrSet } = require('./redisService');
const { emissionHashMap } = require('../data-structures/EmissionHashMap');

const ORS_BASE = 'https://api.openrouteservice.org/v2';

// ORS profile mapping for transport modes
const ORS_PROFILES = {
  car_petrol:    'driving-car',
  car_diesel:    'driving-car',
  bus:           'driving-car',   // Approximate bus route using road network
  train:         'driving-car',   // Train — straight line approximation
  bike:          'cycling-regular',
  walk:          'foot-walking',
  flight_short:  null,            // Haversine formula for flights
  motorcycle:    'driving-car',
};

// Road modes get a correction factor since roads aren't straight lines
const ROAD_MODES = new Set(['car_petrol', 'car_diesel', 'bus', 'train', 'motorcycle', 'bike', 'walk']);
const ROAD_FACTOR = 1.3;

/**
 * Haversine formula — great-circle distance between two lat/lng points.
 * Used for flight distance calculation.
 * @param {number[]} coord1 [lng, lat]
 * @param {number[]} coord2 [lng, lat]
 * @returns {number} distance in km
 */
function haversineKm(coord1, coord2) {
  const R = 6371;
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
}

/**
 * Geocode a place name to [lng, lat] using ORS geocoding (requires API key).
 */
async function geocode(place) {
  const key = process.env.ORS_API_KEY;
  const url = `https://api.openrouteservice.org/geocode/search`;
  const res = await axios.get(url, {
    params: { api_key: key, text: place, size: 1 },
    timeout: 8000,
  });
  const features = res.data?.features;
  if (!features || features.length === 0) throw new Error(`Location not found: ${place}`);
  return features[0].geometry.coordinates; // [lng, lat]
}

/**
 * Geocode using Nominatim (OpenStreetMap) — free, no API key required.
 * Returns [lng, lat]
 */
async function geocodeNominatim(place) {
  const url = 'https://nominatim.openstreetmap.org/search';
  const res = await axios.get(url, {
    params: { q: place, format: 'json', limit: 1 },
    headers: { 'User-Agent': 'EcoTrack-CarbonApp/1.0' },
    timeout: 8000,
  });
  if (!res.data || res.data.length === 0) throw new Error(`Location not found: "${place}". Try a more specific name.`);
  const { lon, lat } = res.data[0];
  return [parseFloat(lon), parseFloat(lat)]; // [lng, lat]
}

/**
 * Fallback distance calculator using Nominatim + Haversine.
 * Road modes get a 1.3x correction factor (roads aren't straight lines).
 * Flight mode uses pure haversine (great-circle is correct for flights).
 */
async function getFallbackDistance(origin, destination, mode) {
  const [fromCoord, toCoord] = await Promise.all([
    geocodeNominatim(origin),
    geocodeNominatim(destination),
  ]);
  const straight = haversineKm(fromCoord, toCoord);
  const distanceKm = ROAD_MODES.has(mode)
    ? +(straight * ROAD_FACTOR).toFixed(2)
    : straight;
  // Return coords as [lat, lng] for Leaflet (Nominatim returns [lng, lat])
  return {
    distanceKm,
    originCoords: [parseFloat(fromCoord[1]), parseFloat(fromCoord[0])],
    destinationCoords: [parseFloat(toCoord[1]), parseFloat(toCoord[0])],
  };
}

/**
 * Get route distance for a single mode. Redis-cached.
 * @param {string} origin   Place name or "lat,lng"
 * @param {string} destination
 * @param {string} mode     Transport mode key
 * @returns {Promise<number>} Distance in km
 */
async function getRouteDistance(origin, destination, mode) {
  const cacheKey = `ors:${origin.toLowerCase()}|${destination.toLowerCase()}|${mode}`;

  return getOrSet(cacheKey, async () => {
    const [fromCoord, toCoord] = await Promise.all([
      geocode(origin),
      geocode(destination),
    ]);

    // Flights use straight-line distance (haversine)
    if (mode === 'flight_short') {
      return haversineKm(fromCoord, toCoord);
    }

    const profile = ORS_PROFILES[mode] || 'driving-car';
    const url = `${ORS_BASE}/directions/${profile}`;

    const res = await axios.post(url, {
      coordinates: [fromCoord, toCoord],
    }, {
      headers: {
        Authorization: process.env.ORS_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const meters = res.data?.routes?.[0]?.summary?.distance;
    if (!meters) throw new Error('No route found');
    return +(meters / 1000).toFixed(2);
  }, 60 * 60 * 24 * 7); // Cache for 7 days
}

/**
 * Main export — get distance + all-modes CO2e comparison in one call.
 * O(modes) single pass over transport factors after distance is resolved.
 *
 * @param {string} origin
 * @param {string} destination
 * @param {string} primaryMode  The mode user selected
 * @returns {Promise<{ distanceKm, primaryCO2e, allModes: [] }>}
 */
async function getTransportData(origin, destination, primaryMode) {
  // Geocode both places (needed for coords even with ORS)
  const [fromCoord, toCoord] = await Promise.all([
    geocode(origin),
    geocode(destination),
  ]);

  // Fetch distance for primary mode (Redis-cached)
  const distanceKm = await getRouteDistance(origin, destination, primaryMode);

  // Compute primary CO2e
  const primaryCO2e = emissionHashMap.computeCO2e('transport', primaryMode, distanceKm);

  // All-modes comparison — O(modes) single pass, no extra API calls
  const allModes = emissionHashMap.allTransportComparison(distanceKm);

  // Return coords as [lat, lng] for Leaflet (ORS returns [lng, lat])
  return {
    distanceKm,
    primaryCO2e,
    allModes,
    originCoords: [fromCoord[1], fromCoord[0]],
    destinationCoords: [toCoord[1], toCoord[0]],
  };
}

module.exports = { getTransportData, getRouteDistance, geocode, geocodeNominatim, getFallbackDistance };
