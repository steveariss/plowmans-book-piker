import { Environment, Float } from '@react-three/drei';
import Book3D from './Book3D.jsx';

const LIGHT_POSITION = [2, 8, 2];
const PLANE_ARGS = [100, 100];

export default function Book3DScene({ book, currentPage, onTurn }) {
  return (
    <>
      <Float rotation-x={-Math.PI / 4} floatIntensity={0.3} speed={1} rotationIntensity={0}>
        <Book3D book={book} currentPage={currentPage} onTurn={onTurn} />
      </Float>
      <Environment preset="studio" background={false} />
      <directionalLight
        position={LIGHT_POSITION}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
        shadow-radius={8}
      />
      <mesh position-y={-1.5} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={PLANE_ARGS} />
        <shadowMaterial transparent opacity={0.1} />
      </mesh>
    </>
  );
}
