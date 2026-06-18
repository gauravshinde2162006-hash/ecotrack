/**
 * Transport route — distance lookup + CO2e calculation
 * POST /api/transport/distance
 * GET  /api/transport/modes — all factors
 */

const express = require('express');
const router = express.Router();
const { getTransportData } = require('../services/orsService');
const { emissionHashMap } = require('../data-structures/EmissionHashMap');

// GET /api/transport/modes — all transport emission factors (O(1) serialize)
router.get('/modes', (req, res) => {
  const modes = ['car_petrol', 'car_diesel', 'bus', 'train', 'bike', 'walk', 'flight_short', 'motorcycle'];
  const result = modes.map(mode => ({
    mode,
    factor: emissionHashMap.getFactor('transport', mode), // O(1) per lookup
    label: MODE_LABELS[mode],
    icon: MODE_ICONS[mode],
  }));
  res.json({ modes: result });
});

// POST /api/transport/distance — O(1) cache hit or network fetch + O(modes) comparison
router.post('/distance', async (req, res) => {
  const { origin, destination, mode = 'car_petrol' } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin and destination required' });
  }

  if (!process.env.ORS_API_KEY) {
    // No ORS key — use free Nominatim (OpenStreetMap) geocoding + haversine
    try {
      const { getFallbackDistance } = require('../services/orsService');
      const result = await getFallbackDistance(origin, destination, mode);
      return res.json({
        origin, destination, mode,
        distanceKm: result.distanceKm,
        originCoords: result.originCoords,
        destinationCoords: result.destinationCoords,
        primaryCO2e: emissionHashMap.computeCO2e('transport', mode, result.distanceKm),
        allModes: emissionHashMap.allTransportComparison(result.distanceKm),
        cached: false,
        nominatim: true,   // estimated via OpenStreetMap + 1.3x road factor
      });
    } catch (err) {
      console.error('[Transport] Nominatim fallback error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  try {
    const data = await getTransportData(origin, destination, mode);
    res.json({ origin, destination, mode, ...data });
  } catch (err) {
    console.error('[Transport] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// POST /api/transport/compare — compute CO2e for user-provided distance across all modes
router.post('/compare', (req, res) => {
  const { distanceKm } = req.body;
  if (!distanceKm || isNaN(distanceKm)) {
    return res.status(400).json({ error: 'distanceKm required' });
  }
  // O(modes) single pass — all comparison in one call
  const allModes = emissionHashMap.allTransportComparison(parseFloat(distanceKm));
  res.json({ distanceKm: parseFloat(distanceKm), allModes });
});

const MODE_LABELS = {
  car_petrol:   'Car (Petrol)',
  car_diesel:   'Car (Diesel)',
  bus:          'Bus',
  train:        'Train',
  bike:         'Bicycle',
  walk:         'Walking',
  flight_short: 'Short-haul Flight',
  motorcycle:   'Motorcycle',
};

const MODE_ICONS = {
  car_petrol:   '🚗',
  car_diesel:   '🚗',
  bus:          '🚌',
  train:        '🚆',
  bike:         '🚲',
  walk:         '🚶',
  flight_short: '✈️',
  motorcycle:   '🏍️',
};

// GET /api/transport/aqi — proxy OpenAQ air quality data (avoids CORS)
// Query: ?lat=18.9&lng=72.8&radius=50
router.get('/aqi', async (req, res) => {
  const { lat, lng, radius = 50 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
  try {
    const axios = require('axios');
    const url = 'https://api.openaq.org/v2/measurements';
    const response = await axios.get(url, {
      params: {
        coordinates: `${lat},${lng}`,
        radius: +radius * 1000, // OpenAQ uses metres
        parameter: 'pm25',
        limit: 20,
        order_by: 'lastUpdated',
        sort: 'desc',
      },
      headers: { 'X-API-Key': process.env.OPENAQ_API_KEY || '' },
      timeout: 8000,
    });
    const results = (response.data?.results || []).map(r => ({
      location: r.location,
      city: r.city,
      country: r.country,
      lat: r.coordinates?.latitude,
      lng: r.coordinates?.longitude,
      pm25: r.value,
      unit: r.unit,
      lastUpdated: r.date?.utc,
    })).filter(r => r.lat && r.lng);
    res.json({ count: results.length, stations: results });
  } catch (err) {
    console.error('[AQI] Error:', err.message);
    res.status(500).json({ error: err.message, stations: [] });
  }
});

module.exports = router;
