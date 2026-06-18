/**
 * CarbonTwin — Interactive 3D "Digital Twin" of your carbon lifestyle
 * Built with React Three Fiber + Drei (Three.js in React)
 *
 * The 3D scene reacts in real-time to slider values:
 *  - Low CO₂ → lush green trees, clean blue sky, birds
 *  - High CO₂ → bare trees, smoggy orange sky, smoke particles
 *
 * No API key required. All rendering is client-side WebGL.
 */

import { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, Text, OrbitControls, Stars, Cloud, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { TreePine, Car, Zap, Beef, Flame, Wind } from 'lucide-react';

// ── Emission factors (mirrors emissionFactors.ts) ────────────────────────────
const FACTORS = {
  transport: { car: 0.192, train: 0.041, bike: 0 },
  diet:      { non_vegetarian: 7.2, vegetarian: 3.8, vegan: 2.5 },
  electricity: { india_grid: 0.82, solar: 0.041 },
  lpg:       { cylinder: 42.5 },
};

type DietType = 'non_vegetarian' | 'vegetarian' | 'vegan';
type TransportType = 'car' | 'train' | 'bike';
type ElectricType = 'india_grid' | 'solar';

interface ScenarioState {
  kmPerDay: number;
  transport: TransportType;
  diet: DietType;
  kwh: number;
  electric: ElectricType;
  lpgFraction: number;
}

// ── 3D Tree component — Realistic Low-Poly ────────────────────────────────────
function Tree({ position, health, scale = 1 }: { position: [number, number, number]; health: number; scale?: number }) {
  const meshRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (meshRef.current) {
      // Gentle wind sway
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5 + position[0]) * 0.02;
      meshRef.current.rotation.x = Math.cos(state.clock.elapsedTime * 0.4 + position[2]) * 0.02;
    }
  });

  const trunkColor = health > 0.5 ? '#5c4033' : '#3d2b1f';
  // Transition from lush green to dry autumn brown
  const leafColor  = health > 0.8 ? '#2e8b57' : health > 0.5 ? '#6b8e23' : health > 0.3 ? '#b8860b' : '#8b4513';
  const leafOpacity = health > 0.2 ? 1 : 0.6; // Thin out leaves when dead

  return (
    <group position={position} scale={scale} ref={meshRef}>
      {/* Trunk */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.08, 0.15, 1, 6]} />
        <meshStandardMaterial color={trunkColor} roughness={0.9} />
      </mesh>
      
      {/* Foliage - multiple intersecting shapes for realism */}
      <group position={[0, 1.2, 0]} visible={health > 0.1}>
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <icosahedronGeometry args={[0.6, 1]} />
          <meshStandardMaterial color={leafColor} roughness={0.8} transparent opacity={leafOpacity} />
        </mesh>
        <mesh position={[-0.3, -0.2, 0.3]} castShadow receiveShadow>
          <icosahedronGeometry args={[0.5, 1]} />
          <meshStandardMaterial color={leafColor} roughness={0.8} transparent opacity={leafOpacity} />
        </mesh>
        <mesh position={[0.3, -0.1, -0.2]} castShadow receiveShadow>
          <icosahedronGeometry args={[0.55, 1]} />
          <meshStandardMaterial color={leafColor} roughness={0.8} transparent opacity={leafOpacity} />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <icosahedronGeometry args={[0.4, 1]} />
          <meshStandardMaterial color={leafColor} roughness={0.8} transparent opacity={leafOpacity} />
        </mesh>
      </group>
    </group>
  );
}

// ── Smoke particle (for high CO₂) ───────────────────────────────────────────
function SmokeParticle({ position, speed }: { position: [number, number, number]; speed: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.position.y += delta * speed;
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity -= delta * 0.08;
      if (mat.opacity <= 0) {
        meshRef.current.position.set(position[0], position[1], position[2]);
        mat.opacity = 0.4;
      }
    }
  });
  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.15, 6, 6]} />
      <meshStandardMaterial color="#6b7280" transparent opacity={0.4} />
    </mesh>
  );
}

// ── Ground floating island ───────────────────────────────────────────────────
function Ground({ health }: { health: number }) {
  const color = health > 0.7 ? '#1b5e20' : health > 0.4 ? '#33691e' : health > 0.2 ? '#5d4037' : '#3e2723';
  return (
    <mesh position={[0, -0.2, 0]} receiveShadow>
      <cylinderGeometry args={[10, 8, 0.4, 32]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

// ── Main 3D Scene ────────────────────────────────────────────────────────────
function CarbonScene({ co2Daily, health }: { co2Daily: number; health: number }) {
  const smokeCount = Math.floor((1 - health) * 8);
  const treePositions: [number, number, number][] = useMemo(() => [
    [-3, 0, -2], [-5, 0, 1], [-4, 0, 4], [3, 0, -3], [5, 0, 0],
    [4, 0, 3], [-2, 0, -5], [2, 0, -5], [-6, 0, -4], [6, 0, -4],
    [-1, 0, 5], [1, 0, 4],
  ], []);

  const skyColor = health > 0.7 ? '#1e3a5f' : health > 0.4 ? '#4a3728' : '#3d1a00';

  return (
    <>
      <color attach="background" args={[skyColor]} />
      {/* Realistic Environment Lighting */}
      <Environment preset={health > 0.5 ? "forest" : "sunset"} background={false} />

      {/* Lighting */}
      <ambientLight intensity={health * 0.3 + 0.1} />
      <directionalLight
        position={[10, 15, 10]} 
        intensity={health > 0.5 ? 1.5 : 0.8}
        color={health > 0.5 ? '#ffffff' : '#ffb74d'}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={30}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {/* Stars (visible when clean) */}
      {health > 0.6 && <Stars radius={50} depth={50} count={1000} factor={4} />}

      {/* Clouds (clean = white, polluted = grey/dark) */}
      {health > 0.5 && (
        <Cloud position={[-4, 6, -8]} speed={0.2} opacity={0.4} color={health > 0.7 ? 'white' : '#9ca3af'} />
      )}
      {health > 0.5 && (
        <Cloud position={[4, 7, -10]} speed={0.15} opacity={0.3} color={health > 0.7 ? 'white' : '#9ca3af'} />
      )}

      <Ground health={health} />

      {/* Trees */}
      {treePositions.map((pos, i) => (
        <Tree key={i} position={pos} health={Math.max(0.05, health - (i % 3) * 0.05)} scale={0.7 + (i % 4) * 0.15} />
      ))}

      {/* Smoke particles for high CO₂ */}
      {Array.from({ length: smokeCount }).map((_, i) => (
        <SmokeParticle
          key={i}
          position={[Math.sin(i * 2.5) * 2, 2, Math.cos(i * 2.5) * 2]}
          speed={0.5 + Math.random() * 0.5}
        />
      ))}

      {/* CO2 readout floating text (Removed subscript for font compatibility) */}
      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3}>
        <Text
          position={[0, 4.5, 0]}
          fontSize={0.6}
          color={health > 0.6 ? '#ffffff' : health > 0.3 ? '#ffedd5' : '#fee2e2'}
          outlineWidth={0.02}
          outlineColor={health > 0.6 ? '#15803d' : health > 0.3 ? '#b45309' : '#b91c1c'}
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          {co2Daily.toFixed(2)} kg CO2 / day
        </Text>
      </Float>

      <ContactShadows position={[0, -0.19, 0]} opacity={0.6} scale={20} blur={2} far={4.5} />
      <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.1} minDistance={5} maxDistance={20} />
    </>
  );
}

// ── Slider component ─────────────────────────────────────────────────────────
function SliderRow({ icon: Icon, label, value, min, max, step, onChange, unit, color }:
  { icon: any; label: string; value: number; min: number; max: number; step: number;
    onChange: (v: number) => void; unit: string; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={13} style={{ color }} />
          <span className="text-xs font-medium text-carbon-300">{label}</span>
        </div>
        <span className="text-xs font-mono text-carbon-400">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color }}
      />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CarbonTwin() {
  const [scenario, setScenario] = useState<ScenarioState>({
    kmPerDay: 30,
    transport: 'car',
    diet: 'non_vegetarian',
    kwh: 8,
    electric: 'india_grid',
    lpgFraction: 0.1,
  });

  // Compute daily CO₂e from sliders
  const co2Daily = useMemo(() => {
    const transport  = scenario.kmPerDay * FACTORS.transport[scenario.transport];
    const diet       = FACTORS.diet[scenario.diet];
    const electricity = scenario.kwh * FACTORS.electricity[scenario.electric];
    const lpg        = scenario.lpgFraction * FACTORS.lpg.cylinder;
    return +(transport + diet + electricity + lpg).toFixed(3);
  }, [scenario]);

  // Goal is 5 kg/day — health = 1 at 0 kg, 0 at 20 kg
  const health = Math.max(0, Math.min(1, 1 - co2Daily / 20));

  const impactLabel = co2Daily < 3 ? { t: '🌿 Excellent!', c: '#22c55e' }
    : co2Daily < 6  ? { t: '🟡 Moderate', c: '#f59e0b' }
    : co2Daily < 12 ? { t: '🟠 High', c: '#f97316' }
    :                 { t: '🔴 Critical', c: '#ef4444' };

  const set = (key: keyof ScenarioState) => (val: any) =>
    setScenario(s => ({ ...s, [key]: val }));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-black text-gradient mb-1">Carbon Digital Twin</h1>
        <p className="text-carbon-400">Drag the sliders — watch your world change in real time 🌍</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── 3D Canvas ── */}
        <div className="glass-card overflow-hidden animate-slide-up" style={{ minHeight: 500 }}>
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.07]">
            <div className="p-2 rounded-lg bg-eco-500/10"><Wind size={16} className="text-eco-400" /></div>
            <div>
              <h2 className="text-sm font-bold text-carbon-100">Live 3D Environment</h2>
              <p className="text-[11px] text-carbon-500">Drag to orbit · Scroll to zoom · Scene reacts to your footprint</p>
            </div>
            <div className="ml-auto">
              <span className="text-sm font-bold" style={{ color: impactLabel.c }}>{impactLabel.t}</span>
            </div>
          </div>
          <div style={{ height: 460 }}>
            <Canvas shadows camera={{ position: [0, 5, 12], fov: 55 }}>
              <Suspense fallback={null}>
                <CarbonScene co2Daily={co2Daily} health={health} />
              </Suspense>
            </Canvas>
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {/* Daily CO₂ summary card */}
          <div className="glass-card p-5">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-xs text-carbon-500 mb-1">Daily Carbon Footprint</p>
                <p className="text-5xl font-black" style={{ color: impactLabel.c }}>{co2Daily.toFixed(2)}</p>
                <p className="text-sm text-carbon-400">kg CO₂e per day</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-carbon-500 mb-1">Annual projection</p>
                <p className="text-2xl font-bold text-carbon-200">{(co2Daily * 365 / 1000).toFixed(2)} t</p>
                <p className="text-[11px] text-carbon-500">CO₂e per year</p>
              </div>
            </div>
            <div className="progress-bar mb-2">
              <div className="progress-fill" style={{
                width: `${Math.min(100, (co2Daily / 20) * 100)}%`,
                background: `linear-gradient(90deg, ${impactLabel.c}88, ${impactLabel.c})`,
              }} />
            </div>
            <div className="flex justify-between text-[10px] text-carbon-600 mb-1">
              <span>0 kg (ideal)</span><span>5 kg (goal)</span><span>20 kg (critical)</span>
            </div>
          </div>

          {/* Scenario sliders */}
          <div className="glass-card p-5 space-y-5">
            <h3 className="text-sm font-bold text-carbon-100">Scenario Controls</h3>

            {/* Transport */}
            <div>
              <p className="text-[11px] text-carbon-500 font-medium mb-2 uppercase tracking-wider">Transport</p>
              <div className="flex gap-2 mb-3">
                {(['car', 'train', 'bike'] as TransportType[]).map(t => (
                  <button key={t} onClick={() => set('transport')(t)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      scenario.transport === t
                        ? 'border-eco-500/60 bg-eco-500/10 text-eco-400'
                        : 'border-white/[0.07] text-carbon-500 hover:border-white/20'
                    }`}>
                    {t === 'car' ? '🚗' : t === 'train' ? '🚆' : '🚲'} {t}
                  </button>
                ))}
              </div>
              <SliderRow icon={Car} label="km per day" color="#f97316"
                value={scenario.kmPerDay} min={0} max={150} step={5} unit=" km"
                onChange={set('kmPerDay')} />
            </div>

            {/* Diet */}
            <div>
              <p className="text-[11px] text-carbon-500 font-medium mb-2 uppercase tracking-wider">Diet</p>
              <div className="flex gap-2">
                {(['vegan', 'vegetarian', 'non_vegetarian'] as DietType[]).map(d => (
                  <button key={d} onClick={() => set('diet')(d)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      scenario.diet === d
                        ? 'border-eco-500/60 bg-eco-500/10 text-eco-400'
                        : 'border-white/[0.07] text-carbon-500 hover:border-white/20'
                    }`}>
                    {d === 'vegan' ? '🌱' : d === 'vegetarian' ? '🥗' : '🥩'} {d === 'non_vegetarian' ? 'non-veg' : d}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-carbon-500 mt-1.5">
                {FACTORS.diet[scenario.diet]} kg CO₂e per day
              </p>
            </div>

            {/* Electricity */}
            <div>
              <p className="text-[11px] text-carbon-500 font-medium mb-2 uppercase tracking-wider">Electricity</p>
              <div className="flex gap-2 mb-3">
                {(['india_grid', 'solar'] as ElectricType[]).map(e => (
                  <button key={e} onClick={() => set('electric')(e)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      scenario.electric === e
                        ? 'border-eco-500/60 bg-eco-500/10 text-eco-400'
                        : 'border-white/[0.07] text-carbon-500 hover:border-white/20'
                    }`}>
                    {e === 'solar' ? '☀️ Solar' : '⚡ Grid'}
                  </button>
                ))}
              </div>
              <SliderRow icon={Zap} label="kWh per day" color="#3b82f6"
                value={scenario.kwh} min={0} max={30} step={0.5} unit=" kWh"
                onChange={set('kwh')} />
            </div>

            {/* LPG */}
            <div>
              <p className="text-[11px] text-carbon-500 font-medium mb-2 uppercase tracking-wider">LPG</p>
              <SliderRow icon={Flame} label="Cylinder fraction/day" color="#f59e0b"
                value={scenario.lpgFraction} min={0} max={0.5} step={0.01} unit=" cyl"
                onChange={set('lpgFraction')} />
            </div>
          </div>

          {/* Breakdown */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-carbon-100 mb-3">Daily Breakdown</h3>
            <div className="space-y-2">
              {[
                { label: 'Transport', icon: '🚗', val: scenario.kmPerDay * FACTORS.transport[scenario.transport], color: '#f97316' },
                { label: 'Diet',      icon: '🍽️', val: FACTORS.diet[scenario.diet], color: '#22c55e' },
                { label: 'Electricity', icon: '⚡', val: scenario.kwh * FACTORS.electricity[scenario.electric], color: '#3b82f6' },
                { label: 'LPG',       icon: '🔥', val: scenario.lpgFraction * FACTORS.lpg.cylinder, color: '#f59e0b' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{item.icon}</span>
                    <span className="text-xs text-carbon-400">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 rounded-full bg-white/[0.08]">
                      <div className="h-full rounded-full" style={{
                        width: `${Math.min(100, (item.val / co2Daily) * 100)}%`,
                        background: item.color,
                      }} />
                    </div>
                    <span className="text-xs font-mono text-carbon-300 w-16 text-right">
                      {item.val.toFixed(3)} kg
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between items-center">
              <span className="text-xs text-carbon-500">Total</span>
              <span className="text-sm font-bold" style={{ color: impactLabel.c }}>{co2Daily} kg CO₂e</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
