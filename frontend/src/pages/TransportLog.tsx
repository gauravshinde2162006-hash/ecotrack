import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Zap, RefreshCw, Navigation, Map as MapIcon, Wind } from 'lucide-react';
import { getTransportDistance, submitLog } from '../api';
import L from 'leaflet';

/* ── Leaflet marker asset fix (Vite doesn't bundle default icons correctly) ── */
delete (L.Icon.Default.prototype as any)._getIconUrl;

const MODE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  car_petrol:   { label: 'Car (Petrol)',  icon: '🚗', color: '#f97316' },
  car_diesel:   { label: 'Car (Diesel)',  icon: '🚕', color: '#fb923c' },
  bus:          { label: 'Bus',           icon: '🚌', color: '#3b82f6' },
  train:        { label: 'Train',         icon: '🚆', color: '#22c55e' },
  bike:         { label: 'Bicycle',       icon: '🚲', color: '#4ade80' },
  walk:         { label: 'Walking',       icon: '🚶', color: '#86efac' },
  flight_short: { label: 'Short Flight',  icon: '✈️', color: '#e11d48' },
  motorcycle:   { label: 'Motorcycle',    icon: '🏍️', color: '#f59e0b' },
};

/* ── Custom SVG icon factory ── */
function makeDotIcon(color: string, pulse = false) {
  return L.divIcon({
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `
      <div style="position:relative;width:20px;height:20px;">
        ${pulse ? `<div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.35;animation:pulse-ring 1.8s ease-out infinite;"></div>` : ''}
        <div style="position:absolute;inset:3px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color}88;border:2px solid rgba(255,255,255,0.8);"></div>
      </div>`,
  });
}

/* ── Inject keyframes for pulse animation ── */
const PULSE_CSS = `@keyframes pulse-ring{0%{transform:scale(1);opacity:0.35}80%{transform:scale(2.4);opacity:0}100%{transform:scale(2.4);opacity:0}}`;

export default function TransportLog() {
  const [origin, setOrigin]           = useState('');
  const [destination, setDestination] = useState('');
  const [mode, setMode]               = useState('car_petrol');
  const [result, setResult]           = useState<any>(null);
  const [loading, setLoading]         = useState(false);
  const [logged, setLogged]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [manualDist, setManualDist]   = useState('');
  const [useManual, setUseManual]     = useState(false);
  const [mapReady, setMapReady]       = useState(false);

  /* Leaflet refs */
  const mapDivRef    = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const originMarker = useRef<L.Marker | null>(null);
  const destMarker   = useRef<L.Marker | null>(null);
  const routeLine    = useRef<L.Polyline | null>(null);
  const aqiMarkers   = useRef<L.CircleMarker[]>([]);

  const [showAqi, setShowAqi] = useState(false);
  const [aqiLoading, setAqiLoading] = useState(false);

  /* Inject pulse CSS once */
  useEffect(() => {
    if (!document.getElementById('eco-pulse-css')) {
      const s = document.createElement('style');
      s.id = 'eco-pulse-css';
      s.textContent = PULSE_CSS;
      document.head.appendChild(s);
    }
  }, []);

  /* ── Initialise map ── */
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    const map = L.map(mapDivRef.current, {
      center: [20.5937, 78.9629], // India centre
      zoom: 5,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(map);

    /* Click-to-set-pin: first click = origin, second = destination */
    let clickCount = 0;
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const coordStr = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      if (clickCount % 2 === 0) {
        setOrigin(coordStr);
      } else {
        setDestination(coordStr);
      }
      clickCount++;
    });

    mapRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* ── OSRM profile map (free public routing, no API key) ── */
  const OSRM_PROFILE: Record<string, string> = {
    car_petrol: 'driving', car_diesel: 'driving', bus: 'driving',
    train: 'driving', motorcycle: 'driving',
    bike: 'cycling', walk: 'foot',
    flight_short: 'flight', // straight line for flights
  };

  /* ── Fetch real road route from OSRM, draw on map ── */
  const drawRoute = useCallback(async (
    originCoords: [number, number],
    destCoords: [number, number],
    modeColor: string,
    transportMode: string,
  ) => {
    const map = mapRef.current;
    if (!map) return;

    /* Clear previous */
    originMarker.current?.remove();
    destMarker.current?.remove();
    routeLine.current?.remove();

    originMarker.current = L.marker(originCoords, { icon: makeDotIcon('#22c55e', true) })
      .bindPopup('<b style="color:#22c55e">🟢 Origin</b>')
      .addTo(map);

    destMarker.current = L.marker(destCoords, { icon: makeDotIcon(modeColor, true) })
      .bindPopup(`<b style="color:${modeColor}">📍 Destination</b>`)
      .addTo(map);

    const profile = OSRM_PROFILE[transportMode] ?? 'driving';
    const isFlight = profile === 'flight';

    if (isFlight) {
      /* Straight dashed arc — semantically correct for flights */
      routeLine.current = L.polyline([originCoords, destCoords], {
        color: modeColor,
        weight: 2,
        opacity: 0.7,
        dashArray: '10, 8',
        lineCap: 'round',
      }).addTo(map);
    } else {
      /* Real road route from OSRM (free, no key needed) */
      try {
        // OSRM expects [lng, lat]
        const [lat1, lng1] = originCoords;
        const [lat2, lng2] = destCoords;
        const osrmProfile = profile === 'cycling' ? 'bike' : profile === 'foot' ? 'foot' : 'car';
        const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
          // GeoJSON coords are [lng, lat] — Leaflet needs [lat, lng]
          const latlngs: [number, number][] = data.routes[0].geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng]
          );
          routeLine.current = L.polyline(latlngs, {
            color: '#22c55e',
            weight: 4,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);
        } else {
          throw new Error('OSRM no route');
        }
      } catch {
        /* Fallback to straight line if OSRM fails */
        routeLine.current = L.polyline([originCoords, destCoords], {
          color: '#22c55e',
          weight: 3,
          opacity: 0.75,
          dashArray: '8, 6',
          lineCap: 'round',
        }).addTo(map);
      }
    }

    map.fitBounds(L.latLngBounds([originCoords, destCoords]), { padding: [60, 60] });
  }, []);

  useEffect(() => {
    if (result?.originCoords && result?.destinationCoords && mapReady) {
      drawRoute(result.originCoords, result.destinationCoords, MODE_LABELS[mode]?.color ?? '#22c55e', mode);
    }
  }, [result, mapReady, mode, drawRoute]);

  /* ── Handlers ── */
  const handleCalc = async () => {
    if (!origin || !destination) { setError('Enter both origin and destination'); return; }
    setLoading(true); setError(null); setLogged(false);
    try {
      const data = await getTransportDistance(origin, destination, mode);
      setResult(data);
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCompare = async () => {
    if (!manualDist || isNaN(+manualDist)) { setError('Enter a valid distance'); return; }
    setLoading(true); setError(null);
    try {
      const { api } = await import('../api');
      const res = await api.post('/transport/compare', { distanceKm: +manualDist });
      setResult({
        distanceKm: +manualDist,
        allModes: res.data.allModes,
        primaryCO2e: res.data.allModes.find((m: any) => m.mode === mode)?.co2e ?? 0,
        mock: true,
        // No coords for manual distance
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLog = async () => {
    if (!result) return;
    const today = new Date().toISOString().split('T')[0];
    await submitLog({ date: today, category: 'transport', subtype: mode, quantity: result.distanceKm });
    setLogged(true);
  };

  const clearMap = () => {
    originMarker.current?.remove(); originMarker.current = null;
    destMarker.current?.remove();   destMarker.current = null;
    routeLine.current?.remove();    routeLine.current = null;
    aqiMarkers.current.forEach(m => m.remove()); aqiMarkers.current = [];
    mapRef.current?.setView([20.5937, 78.9629], 5);
    setOrigin(''); setDestination(''); setResult(null); setError(null); setLogged(false);
    setShowAqi(false);
  };

  /* ── AQI fetch + toggle ── */
  const AQI_COLOR = (pm25: number) =>
    pm25 <= 12  ? '#22c55e' :  // Good
    pm25 <= 35  ? '#84cc16' :  // Moderate
    pm25 <= 55  ? '#f59e0b' :  // Unhealthy for sensitive
    pm25 <= 150 ? '#f97316' :  // Unhealthy
                  '#ef4444';   // Hazardous

  const toggleAqi = async () => {
    if (showAqi) {
      // Clear AQI markers
      aqiMarkers.current.forEach(m => m.remove());
      aqiMarkers.current = [];
      setShowAqi(false);
      return;
    }
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    setAqiLoading(true);
    try {
      const { api } = await import('../api');
      const res = await api.get('/transport/aqi', {
        params: { lat: center.lat.toFixed(4), lng: center.lng.toFixed(4), radius: 100 },
      });
      const stations: any[] = res.data.stations ?? [];
      aqiMarkers.current.forEach(m => m.remove());
      aqiMarkers.current = stations.map(s => {
        const color = AQI_COLOR(s.pm25);
        return L.circleMarker([s.lat, s.lng], {
          radius: 10, color, fillColor: color, fillOpacity: 0.75, weight: 2,
        })
          .bindPopup(`<div style="font-size:12px;color:#f4f4f5">
            <b style="color:${color}">${s.pm25?.toFixed(1)} µg/m³ PM2.5</b><br/>
            📍 ${s.location ?? s.city}<br/>
            <span style="color:#71717a;font-size:10px">Updated: ${s.lastUpdated ? new Date(s.lastUpdated).toLocaleTimeString() : 'N/A'}</span>
          </div>`)
          .addTo(mapRef.current!);
      });
      setShowAqi(true);
      if (stations.length === 0) alert('No AQI stations found near this area.');
    } catch (err: any) {
      console.error('[AQI]', err.message);
    } finally {
      setAqiLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-black text-gradient mb-1">Transport Tracker</h1>
        <p className="text-carbon-400">Calculate your journey's carbon footprint — type a place or click the map</p>
      </div>

      {/* Two-column layout: form left, map right */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── LEFT: Input + Results ── */}
        <div className="space-y-4">
          {/* Input card */}
          <div className="glass-card p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg bg-eco-500/10"><MapPin size={18} className="text-eco-400" /></div>
              <h2 className="section-header mb-0">Journey Details</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-carbon-400 font-medium mb-2 block flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-eco-500 inline-block" />
                  From
                </label>
                <input className="input-field" placeholder="e.g. Mumbai, Maharashtra"
                  value={origin} onChange={e => setOrigin(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-carbon-400 font-medium mb-2 block flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                  To
                </label>
                <input className="input-field" placeholder="e.g. Pune, Maharashtra"
                  value={destination} onChange={e => setDestination(e.target.value)} />
              </div>
            </div>

            {/* Mode selector */}
            <div className="mb-5">
              <label className="text-xs text-carbon-400 font-medium mb-3 block">Transport Mode</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(MODE_LABELS).map(([key, info]) => (
                  <button key={key} onClick={() => setMode(key)}
                    className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                      mode === key
                        ? 'border-eco-500/60 bg-eco-500/10 text-eco-400'
                        : 'border-white/[0.07] bg-white/[0.02] text-carbon-400 hover:border-white/20 hover:text-carbon-200'
                    }`}>
                    <span className="text-lg block mb-1">{info.icon}</span>
                    <span className="text-xs font-medium">{info.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Manual distance toggle */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-xs text-carbon-400 cursor-pointer">
                <input type="checkbox" checked={useManual} onChange={e => setUseManual(e.target.checked)} className="rounded" />
                Enter distance manually (if no ORS API key)
              </label>
              {useManual && (
                <div className="mt-2 flex gap-2">
                  <input className="input-field flex-1" placeholder="Distance in km" type="number"
                    value={manualDist} onChange={e => setManualDist(e.target.value)} />
                  <button onClick={handleManualCompare} disabled={loading} className="btn-eco whitespace-nowrap">
                    {loading ? <RefreshCw size={16} className="animate-spin" /> : 'Compare'}
                  </button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-rose-400 mb-3">⚠️ {error}</p>}

            <div className="flex gap-2">
              {!useManual && (
                <button onClick={handleCalc} disabled={loading} className="btn-eco flex-1 justify-center">
                  {loading ? <><RefreshCw size={16} className="animate-spin" /> Calculating...</> : <><Zap size={16} /> Calculate Carbon Footprint</>}
                </button>
              )}
              <button onClick={clearMap} className="btn-ghost" title="Reset map and inputs">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4 animate-slide-up">
              {/* Primary result */}
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{MODE_LABELS[mode]?.icon}</span>
                      <h3 className="text-lg font-bold text-carbon-100">{MODE_LABELS[mode]?.label}</h3>
                      {result.cached   && <span className="badge-eco text-[10px]">⚡ Cached</span>}
                      {result.nominatim && <span className="badge-warn text-[10px]" title="Estimated via OpenStreetMap + road factor">~ Estimated</span>}
                      {result.mock && !result.nominatim && <span className="badge-warn text-[10px]">Manual input</span>}
                    </div>
                    <p className="text-sm text-carbon-400">{result.distanceKm} km</p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-gradient">{result.primaryCO2e?.toFixed(3)}</p>
                    <p className="text-sm text-carbon-400">kg CO₂e</p>
                  </div>
                </div>

                <div className="progress-bar mb-2">
                  <div className="progress-fill" style={{
                    width: `${Math.min(100, (result.primaryCO2e / 10) * 100)}%`,
                    background: result.primaryCO2e < 2 ? '#22c55e' : result.primaryCO2e < 5 ? '#f59e0b' : '#ef4444',
                  }} />
                </div>
                <p className="text-xs text-carbon-500 mb-4">
                  {result.primaryCO2e < 2 ? '🟢 Low impact' : result.primaryCO2e < 5 ? '🟡 Moderate impact' : '🔴 High impact'}
                </p>

                <button onClick={handleLog} disabled={logged} className="btn-eco">
                  {logged ? '✅ Logged to today' : '+ Log this journey'}
                </button>
              </div>

              {/* All-modes comparison */}
              <div className="glass-card p-6">
                <h3 className="section-header mb-1">Mode Comparison — {result.distanceKm} km</h3>
                <p className="section-subtitle mb-4">All emissions computed in O(modes) single pass</p>
                <div className="space-y-3">
                  {result.allModes?.map((m: any) => {
                    const info = MODE_LABELS[m.mode];
                    const maxCO2 = result.allModes[result.allModes.length - 1]?.co2e ?? 1;
                    const pct = maxCO2 > 0 ? (m.co2e / maxCO2) * 100 : 0;
                    return (
                      <div key={m.mode} className={`p-3 rounded-xl transition-all ${m.mode === mode ? 'ring-1 ring-eco-500/40 bg-eco-500/5' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span>{info?.icon}</span>
                            <span className="text-sm font-medium text-carbon-200">{info?.label}</span>
                            {m.mode === mode && <span className="badge-eco text-[10px]">Selected</span>}
                          </div>
                          <span className="text-sm font-bold" style={{ color: m.co2e === 0 ? '#4ade80' : info?.color }}>
                            {m.co2e === 0 ? '0 🌱' : `${m.co2e.toFixed(3)} kg`}
                          </span>
                        </div>
                        <div className="progress-bar h-1.5">
                          <div className="progress-fill h-full" style={{
                            width: `${pct}%`,
                            background: m.co2e === 0 ? '#4ade80' : `linear-gradient(90deg, ${info?.color}, ${info?.color}aa)`,
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Map ── */}
        <div className="space-y-3">
          <div className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: '0.1s' }}>
            {/* Map header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-eco-500/10"><MapIcon size={16} className="text-eco-400" /></div>
                <div>
                  <h2 className="text-sm font-bold text-carbon-100">Journey Map</h2>
                  <p className="text-[11px] text-carbon-500">Click anywhere to drop pins · Green = origin · Colored = destination</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* AQI toggle */}
                <button
                  onClick={toggleAqi}
                  disabled={aqiLoading}
                  title={showAqi ? 'Hide air quality' : 'Show air quality (PM2.5)'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    showAqi
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'bg-white/[0.04] text-carbon-500 border border-white/[0.08] hover:text-carbon-300'
                  }`}
                >
                  {aqiLoading ? <RefreshCw size={11} className="animate-spin" /> : <Wind size={11} />}
                  AQI
                </button>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-eco-500 animate-pulse" />
                  <span className="text-[11px] text-carbon-500">Live</span>
                </div>
              </div>
            </div>

            {/* Leaflet container */}
            <div
              ref={mapDivRef}
              id="eco-leaflet-map"
              style={{ height: '480px', width: '100%', background: '#0a0a0b' }}
            />

            {/* AQI legend */}
            {showAqi && (
              <div className="flex items-center gap-3 px-5 py-2 border-t border-white/[0.07] flex-wrap">
                <span className="text-[10px] text-carbon-500 font-medium">PM2.5:</span>
                {[
                  { label: 'Good ≤12', color: '#22c55e' },
                  { label: 'Moderate ≤35', color: '#84cc16' },
                  { label: 'Sensitive ≤55', color: '#f59e0b' },
                  { label: 'Unhealthy ≤150', color: '#f97316' },
                  { label: 'Hazardous', color: '#ef4444' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                    <span className="text-[10px] text-carbon-500">{l.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Map tip card */}
          <div className="glass-card p-4 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
              <Navigation size={14} className="text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-carbon-200 mb-1">Pro tip: click-to-set mode</p>
              <p className="text-[11px] text-carbon-500 leading-relaxed">
                Click anywhere on the map — first click sets <span className="text-eco-400 font-medium">Origin</span>,
                second click sets <span className="text-orange-400 font-medium">Destination</span>.
                Alternating clicks swap between them. Then hit <strong className="text-carbon-300">Calculate</strong> to get the CO₂ estimate.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
