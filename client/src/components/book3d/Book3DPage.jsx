import { useCursor, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { useMemo, useRef, useState } from 'react';
import {
  Bone,
  Color,
  MathUtils,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
} from 'three';
import { degToRad } from 'three/src/math/MathUtils.js';
import { PAGE_DEPTH, PAGE_SEGMENTS } from './pageGeometry.js';

const easingFactor = 0.5;
const easingFactorFold = 0.3;
const insideCurveStrength = 0.18;
const outsideCurveStrength = 0.05;
const turningCurveStrength = 0.09;

const whiteColor = new Color('white');
const emissiveColor = new Color('orange');

const pageMaterials = [
  new MeshStandardMaterial({ color: whiteColor }),
  new MeshStandardMaterial({ color: '#111' }),
  new MeshStandardMaterial({ color: whiteColor }),
  new MeshStandardMaterial({ color: whiteColor }),
];

function applyHalf(texture, half) {
  if (!texture) return texture;
  const tex = texture.clone();
  tex.colorSpace = SRGBColorSpace;
  if (half === 'left') {
    tex.offset.set(0, 0);
    tex.repeat.set(0.5, 1);
  } else if (half === 'right') {
    tex.offset.set(0.5, 0);
    tex.repeat.set(0.5, 1);
  }
  tex.needsUpdate = true;
  return tex;
}

export default function Book3DPage({
  number,
  front,
  frontHalf,
  back,
  backHalf,
  page,
  opened,
  bookClosed,
  totalPages,
  geometry,
  pageWidth,
  onTurn,
  ...props
}) {
  const segmentWidth = pageWidth / PAGE_SEGMENTS;

  // Load textures — collect unique URLs to load
  const urlsToLoad = useMemo(() => {
    const urls = [];
    if (front) urls.push(front);
    if (back && back !== front) urls.push(back);
    return urls;
  }, [front, back]);

  // front is always set (cover or spread), so urlsToLoad always has at least one entry
  const loadedTextures = useTexture(urlsToLoad);

  // Map loaded textures back to front/back with UV splitting
  const { frontTexture, backTexture } = useMemo(() => {
    if (urlsToLoad.length === 0) return { frontTexture: null, backTexture: null };

    const texArray = Array.isArray(loadedTextures) ? loadedTextures : [loadedTextures];

    let rawFront = null;
    let rawBack = null;

    if (front && back && front === back) {
      // Same spread image for both faces
      rawFront = texArray[0];
      rawBack = texArray[0];
    } else {
      if (front) rawFront = texArray[0];
      if (back) rawBack = texArray[front ? 1 : 0];
    }

    return {
      frontTexture: rawFront ? applyHalf(rawFront, frontHalf) : null,
      backTexture: rawBack ? applyHalf(rawBack, backHalf) : null,
    };
  }, [loadedTextures, front, back, frontHalf, backHalf, urlsToLoad.length]);

  const group = useRef();
  const turnedAt = useRef(0);
  const lastOpened = useRef(opened);
  const skinnedMeshRef = useRef();

  const manualSkinnedMesh = useMemo(() => {
    const bones = [];
    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      const bone = new Bone();
      bones.push(bone);
      bone.position.x = i === 0 ? 0 : segmentWidth;
      if (i > 0) bones[i - 1].add(bone);
    }
    const skeleton = new Skeleton(bones);

    const isCover = number === 0;
    const isBackCover = number === totalPages - 1;

    const materials = [
      ...pageMaterials,
      new MeshStandardMaterial({
        color: whiteColor,
        map: frontTexture || undefined,
        roughness: isCover ? 0.4 : 0.1,
        emissive: emissiveColor,
        emissiveIntensity: 0,
      }),
      new MeshStandardMaterial({
        color: whiteColor,
        map: backTexture || undefined,
        roughness: isBackCover ? 0.4 : 0.1,
        emissive: emissiveColor,
        emissiveIntensity: 0,
      }),
    ];

    const mesh = new SkinnedMesh(geometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.add(skeleton.bones[0]);
    mesh.bind(skeleton);
    return mesh;
  }, [geometry, frontTexture, backTexture, number, totalPages, segmentWidth]);

  useFrame((_, delta) => {
    if (!skinnedMeshRef.current) return;

    const emissiveIntensity = highlighted ? 0.22 : 0;
    skinnedMeshRef.current.material[4].emissiveIntensity =
      skinnedMeshRef.current.material[5].emissiveIntensity = MathUtils.lerp(
        skinnedMeshRef.current.material[4].emissiveIntensity,
        emissiveIntensity,
        0.1
      );

    if (lastOpened.current !== opened) {
      turnedAt.current = +new Date();
      lastOpened.current = opened;
    }
    let turningTime = Math.min(400, new Date() - turnedAt.current) / 400;
    turningTime = Math.sin(turningTime * Math.PI);

    let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2;
    if (!bookClosed) {
      targetRotation += degToRad(number * 0.8);
    }

    const bones = skinnedMeshRef.current.skeleton.bones;
    for (let i = 0; i < bones.length; i++) {
      const target = i === 0 ? group.current : bones[i];

      const insideCurveIntensity = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0;
      const outsideCurveIntensity = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0;
      const turningIntensity =
        Math.sin(i * Math.PI * (1 / bones.length)) * turningTime;

      let rotationAngle =
        insideCurveStrength * insideCurveIntensity * targetRotation -
        outsideCurveStrength * outsideCurveIntensity * targetRotation +
        turningCurveStrength * turningIntensity * targetRotation;

      let foldRotationAngle = degToRad(Math.sign(targetRotation) * 2);

      if (bookClosed) {
        if (i === 0) {
          rotationAngle = targetRotation;
          foldRotationAngle = 0;
        } else {
          rotationAngle = 0;
          foldRotationAngle = 0;
        }
      }

      easing.dampAngle(
        target.rotation,
        'y',
        rotationAngle,
        easingFactor,
        delta
      );

      const foldIntensity =
        i > 8
          ? Math.sin(i * Math.PI * (1 / bones.length) - 0.5) * turningTime
          : 0;
      easing.dampAngle(
        target.rotation,
        'x',
        foldRotationAngle * foldIntensity,
        easingFactorFold,
        delta
      );
    }
  });

  const [highlighted, setHighlighted] = useState(false);
  useCursor(highlighted);

  return (
    <group
      {...props}
      ref={group}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHighlighted(true);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHighlighted(false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onTurn(opened ? number : number + 1);
        setHighlighted(false);
      }}
    >
      <primitive
        object={manualSkinnedMesh}
        ref={skinnedMeshRef}
        position-z={-number * PAGE_DEPTH + page * PAGE_DEPTH}
      />
    </group>
  );
}
