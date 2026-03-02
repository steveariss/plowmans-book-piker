import {
  BoxGeometry,
  Float32BufferAttribute,
  Uint16BufferAttribute,
  Vector3,
} from 'three';

export const PAGE_DEPTH = 0.003;
export const PAGE_SEGMENTS = 30;

export function createPageGeometry(pageWidth, pageHeight) {
  const segmentWidth = pageWidth / PAGE_SEGMENTS;

  const geometry = new BoxGeometry(
    pageWidth,
    pageHeight,
    PAGE_DEPTH,
    PAGE_SEGMENTS,
    2
  );

  geometry.translate(pageWidth / 2, 0, 0);

  const position = geometry.attributes.position;
  const vertex = new Vector3();
  const skinIndexes = [];
  const skinWeights = [];

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const x = vertex.x;

    const skinIndex = Math.max(0, Math.floor(x / segmentWidth));
    const skinWeight = (x % segmentWidth) / segmentWidth;

    skinIndexes.push(skinIndex, skinIndex + 1, 0, 0);
    skinWeights.push(1 - skinWeight, skinWeight, 0, 0);
  }

  geometry.setAttribute(
    'skinIndex',
    new Uint16BufferAttribute(skinIndexes, 4)
  );
  geometry.setAttribute(
    'skinWeight',
    new Float32BufferAttribute(skinWeights, 4)
  );

  return geometry;
}
