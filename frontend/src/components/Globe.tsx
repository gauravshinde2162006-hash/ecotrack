import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, useTexture } from '@react-three/drei';
import * as THREE from 'three';

export default function Globe({ users }: { users: any[] }) {
  const globeRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  // Load realistic earth textures from three.js examples repository
  const [colorMap, specularMap, cloudsMap] = useTexture([
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png'
  ]);

  useFrame(() => {
    if (globeRef.current) {
      globeRef.current.rotation.y += 0.001; // Slow rotation for the earth
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += 0.0015; // Clouds rotate slightly faster
    }
  });

  return (
    <group ref={globeRef}>
      {/* Main realistic earth sphere */}
      <Sphere args={[1, 64, 64]} position={[0, 0, 0]}>
        <meshPhongMaterial
          map={colorMap}
          specularMap={specularMap}
          specular={new THREE.Color('grey')}
          shininess={35}
        />
      </Sphere>
      
      {/* Cloud layer */}
      <Sphere ref={cloudsRef} args={[1.006, 64, 64]}>
        <meshPhongMaterial
          map={cloudsMap}
          transparent={true}
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </Sphere>

      {/* Plot random glowing points for users on the leaderboard */}
      {users.slice(0, 50).map((user, i) => {
        const phi = Math.acos(-1 + (2 * i) / 50);
        const theta = Math.sqrt(50 * Math.PI) * phi;
        // Place points slightly above the earth surface
        const x = 1.02 * Math.cos(theta) * Math.sin(phi);
        const y = 1.02 * Math.sin(theta) * Math.sin(phi);
        const z = 1.02 * Math.cos(phi);
        
        return (
          <mesh key={user.id} position={[x, y, z]}>
            <sphereGeometry args={[0.015, 16, 16]} />
            <meshBasicMaterial color={i < 3 ? "#f59e0b" : "#22c55e"} />
            {/* Tiny glow halo around the point */}
            <mesh scale={[1.5, 1.5, 1.5]}>
               <sphereGeometry args={[0.015, 16, 16]} />
               <meshBasicMaterial color={i < 3 ? "#f59e0b" : "#22c55e"} transparent opacity={0.4} />
            </mesh>
          </mesh>
        );
      })}
    </group>
  );
}
