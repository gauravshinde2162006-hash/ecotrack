const { getTransportData, getRouteDistance, geocode, geocodeNominatim, getFallbackDistance } = require('./orsService');
const axios = require('axios');
const { getOrSet } = require('./redisService');

jest.mock('axios');
jest.mock('./redisService', () => ({
  getOrSet: jest.fn((key, fn) => fn()),
}));

describe('orsService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('module exports', () => {
    it('should export getTransportData as a function', () => {
      expect(typeof getTransportData).toBe('function');
    });

    it('should export getRouteDistance as a function', () => {
      expect(typeof getRouteDistance).toBe('function');
    });

    it('should export geocode as a function', () => {
      expect(typeof geocode).toBe('function');
    });

    it('should export geocodeNominatim as a function', () => {
      expect(typeof geocodeNominatim).toBe('function');
    });

    it('should export getFallbackDistance as a function', () => {
      expect(typeof getFallbackDistance).toBe('function');
    });
  });

  describe('geocode', () => {
    it('should return coordinates', async () => {
      axios.get.mockResolvedValueOnce({
        data: { features: [{ geometry: { coordinates: [72.8, 19.0] } }] }
      });
      const coords = await geocode('Mumbai');
      expect(coords).toEqual([72.8, 19.0]);
    });

    it('should throw error if location not found', async () => {
      axios.get.mockResolvedValueOnce({ data: { features: [] } });
      await expect(geocode('UnknownPlace')).rejects.toThrow();
    });
  });

  describe('geocodeNominatim', () => {
    it('should return coordinates', async () => {
      axios.get.mockResolvedValueOnce({
        data: [{ lon: '72.8', lat: '19.0' }]
      });
      const coords = await geocodeNominatim('Mumbai');
      expect(coords).toEqual([72.8, 19.0]);
    });

    it('should throw error if location not found', async () => {
      axios.get.mockResolvedValueOnce({ data: [] });
      await expect(geocodeNominatim('UnknownPlace')).rejects.toThrow();
    });
  });

  describe('getRouteDistance', () => {
    it('should calculate flight distance using haversine', async () => {
      axios.get.mockResolvedValueOnce({ data: { features: [{ geometry: { coordinates: [72.8, 19.0] } }] } });
      axios.get.mockResolvedValueOnce({ data: { features: [{ geometry: { coordinates: [73.8, 18.5] } }] } });
      
      const dist = await getRouteDistance('Mumbai', 'Pune', 'flight_short');
      expect(dist).toBeGreaterThan(0);
    });

    it('should calculate driving distance using ORS API', async () => {
      // Mock geocode
      axios.get.mockResolvedValueOnce({ data: { features: [{ geometry: { coordinates: [72.8, 19.0] } }] } });
      axios.get.mockResolvedValueOnce({ data: { features: [{ geometry: { coordinates: [73.8, 18.5] } }] } });
      
      // Mock ORS routing
      axios.post.mockResolvedValueOnce({
        data: { routes: [{ summary: { distance: 150000 } }] }
      });
      
      const dist = await getRouteDistance('Mumbai', 'Pune', 'car_petrol');
      expect(dist).toBe(150.0);
    });

    it('should throw if no route found', async () => {
      axios.get.mockResolvedValueOnce({ data: { features: [{ geometry: { coordinates: [72.8, 19.0] } }] } });
      axios.get.mockResolvedValueOnce({ data: { features: [{ geometry: { coordinates: [73.8, 18.5] } }] } });
      
      axios.post.mockResolvedValueOnce({ data: {} });
      
      await expect(getRouteDistance('A', 'B', 'car_petrol')).rejects.toThrow('No route found');
    });
  });

  describe('getFallbackDistance', () => {
    it('should calculate straight line + factor for roads', async () => {
      // Mock geocodeNominatim
      axios.get.mockResolvedValueOnce({ data: [{ lon: '72.8', lat: '19.0' }] });
      axios.get.mockResolvedValueOnce({ data: [{ lon: '73.8', lat: '18.5' }] });
      
      const result = await getFallbackDistance('Mumbai', 'Pune', 'car_petrol');
      expect(result.distanceKm).toBeGreaterThan(0);
      expect(result.originCoords).toEqual([19.0, 72.8]);
    });
  });

  describe('getTransportData', () => {
    it('should return complete transport data', async () => {
      // Mock geocode
      axios.get.mockResolvedValueOnce({ data: { features: [{ geometry: { coordinates: [72.8, 19.0] } }] } });
      axios.get.mockResolvedValueOnce({ data: { features: [{ geometry: { coordinates: [73.8, 18.5] } }] } });
      
      // Mock inner geocode for distance cache
      axios.get.mockResolvedValueOnce({ data: { features: [{ geometry: { coordinates: [72.8, 19.0] } }] } });
      axios.get.mockResolvedValueOnce({ data: { features: [{ geometry: { coordinates: [73.8, 18.5] } }] } });
      
      // Mock routing
      axios.post.mockResolvedValueOnce({
        data: { routes: [{ summary: { distance: 150000 } }] }
      });
      
      const result = await getTransportData('Mumbai', 'Pune', 'car_petrol');
      expect(result.distanceKm).toBe(150.0);
      expect(result.primaryCO2e).toBeDefined();
      expect(result.allModes).toBeDefined();
    });
  });
});