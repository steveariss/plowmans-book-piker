import { Environment, Float } from '@react-three/drei';
import Book3D from './Book3D.jsx';

const LIGHT_POSITION = [2, 8, 2];
const PLANE_ARGS = [100, 100];
const PAGE_HEIGHT = 1.71;

export default function Book3DScene({ book, currentPage, onTurn, centered = false }) {
  // When showing a cover-only book, the spine sits at x=0 and the cover
  // extends to the right — shift the group left by half the cover width to
  // center it visually.
  const coverAspect = book.coverWidth && book.coverHeight ? book.coverWidth / book.coverHeight : 0.75;
  const centerOffset = centered ? -(PAGE_HEIGHT * coverAspect) / 2 : 0;

  return (
    <>
      <Float rotation-x={-Math.PI / 4} floatIntensity={0.3} speed={1} rotationIntensity={0}>
        <group position-x={centerOffset}>
          <Book3D book={book} currentPage={currentPage} onTurn={onTurn} />
        </group>
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
