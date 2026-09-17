import type { Point2 } from "../../types/profile.types.js";

const getPerpendicularDistance = (point: Point2, lineStart: Point2, lineEnd: Point2): number => {
  const deltaX = lineEnd.x - lineStart.x;
  const deltaY = lineEnd.y - lineStart.y;
  const lineLength = Math.hypot(deltaX, deltaY);

  if (lineLength === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);

  return (
    Math.abs(
      deltaY * point.x - deltaX * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x,
    ) / lineLength
  );
};

// Ramer-Douglas-Peucker: keeps the corners that define a machined outline and discards the pixel
// staircase between them.
export const simplifyPolyline = (
  points: readonly Point2[],
  tolerance: number,
): readonly Point2[] => {
  if (points.length < 3) return points;

  let furthestIndex = 0;
  let furthestDistance = 0;

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = getPerpendicularDistance(points[index], points[0], points[points.length - 1]);
    if (distance > furthestDistance) {
      furthestDistance = distance;
      furthestIndex = index;
    }
  }

  if (furthestDistance <= tolerance) {
    return Object.freeze([points[0], points[points.length - 1]]);
  }

  const head = simplifyPolyline(points.slice(0, furthestIndex + 1), tolerance);
  const tail = simplifyPolyline(points.slice(furthestIndex), tolerance);

  return Object.freeze([...head.slice(0, head.length - 1), ...tail]);
};

export const simplifyClosedPolygon = (
  points: readonly Point2[],
  tolerance: number,
): readonly Point2[] => {
  if (points.length < 4) return points;

  const simplified = simplifyPolyline([...points, points[0]], tolerance);
  return Object.freeze(simplified.slice(0, simplified.length - 1));
};

// Boundary tracing walks pixel centres, so a region n pixels across traces only n-1 across. Growing
// each polygon by one pixel on each axis restores the true edge; for the axis-aligned slots and
// plates this pipeline targets, the correction is exact.
export const expandPolygonByOnePixel = (points: readonly Point2[]): readonly Point2[] => {
  if (points.length < 3) return points;

  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const minimumX = Math.min(...xValues);
  const maximumX = Math.max(...xValues);
  const minimumY = Math.min(...yValues);
  const maximumY = Math.max(...yValues);

  const spanX = maximumX - minimumX;
  const spanY = maximumY - minimumY;
  const centreX = (minimumX + maximumX) / 2;
  const centreY = (minimumY + maximumY) / 2;

  const scaleX = spanX > 0 ? (spanX + 1) / spanX : 1;
  const scaleY = spanY > 0 ? (spanY + 1) / spanY : 1;

  return Object.freeze(
    points.map((point) =>
      Object.freeze({
        x: centreX + (point.x - centreX) * scaleX,
        y: centreY + (point.y - centreY) * scaleY,
      }),
    ),
  );
};
