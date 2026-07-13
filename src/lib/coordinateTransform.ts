import { CalibrationPoint } from '../types';

/**
 * Affine transformation using 3 calibration points
 * Maps GPS coordinates (lat, lng) to drawing coordinates (x%, y%)
 */
export interface TransformMatrix {
  a: number; // scale + rotation X component
  b: number; // rotation Y component for X
  c: number; // rotation X component for Y
  d: number; // scale + rotation Y component
  e: number; // translation X
  f: number; // translation Y
}

/**
 * Calculate affine transformation matrix from 3 calibration points
 * Each point: GPS (lat, lng) → Drawing (x%, y%)
 */
export function calculateTransformMatrix(
  points: CalibrationPoint[]
): TransformMatrix | null {
  if (points.length < 3) return null;

  const p1 = points[0];
  const p2 = points[1];
  const p3 = points[2];

  // Source points (GPS coordinates - normalized for calculation)
  const x1 = p1.gpsLng; // use lng as x
  const y1 = p1.gpsLat; // use lat as y
  const x2 = p2.gpsLng;
  const y2 = p2.gpsLat;
  const x3 = p3.gpsLng;
  const y3 = p3.gpsLat;

  // Target points (drawing coordinates)
  const u1 = p1.drawingX;
  const v1 = p1.drawingY;
  const u2 = p2.drawingX;
  const v2 = p2.drawingY;
  const u3 = p3.drawingX;
  const v3 = p3.drawingY;

  // Solve the system of equations for affine transformation
  // u = ax + by + e
  // v = cx + dy + f

  const denom = x1 * (y2 - y3) - x2 * (y1 - y3) + x3 * (y1 - y2);

  // Check if points are collinear
  if (Math.abs(denom) < 1e-10) {
    console.warn('Calibration points are collinear - cannot calculate transformation');
    return null;
  }

  // Calculate transformation coefficients
  const a =
    ((u1 * (y2 - y3) + u2 * (y3 - y1) + u3 * (y1 - y2)) / denom);
  const b =
    ((u1 * (x3 - x2) + u2 * (x1 - x3) + u3 * (x2 - x1)) / denom);
  const c =
    ((v1 * (y2 - y3) + v2 * (y3 - y1) + v3 * (y1 - y2)) / denom);
  const d =
    ((v1 * (x3 - x2) + v2 * (x1 - x3) + v3 * (x2 - x1)) / denom);

  const e = u1 - a * x1 - b * y1;
  const f = v1 - c * x1 - d * y1;

  return { a, b, c, d, e, f };
}

/**
 * Transform GPS coordinates (lat, lng) to drawing coordinates (x%, y%)
 */
export function gpsToDrawingCoordinates(
  gpsLat: number,
  gpsLng: number,
  matrix: TransformMatrix
): { x: number; y: number } | null {
  if (!matrix) return null;

  const x = gpsLng;
  const y = gpsLat;

  // Apply affine transformation
  const drawingX = matrix.a * x + matrix.b * y + matrix.e;
  const drawingY = matrix.c * x + matrix.d * y + matrix.f;

  // Clamp to valid drawing bounds (0-100%)
  return {
    x: Math.max(0, Math.min(100, drawingX)),
    y: Math.max(0, Math.min(100, drawingY))
  };
}

/**
 * Inverse transformation: drawing coordinates → GPS coordinates
 * Useful for verification and debugging
 */
export function drawingToGpsCoordinates(
  drawingX: number,
  drawingY: number,
  matrix: TransformMatrix
): { lat: number; lng: number } | null {
  if (!matrix) return null;

  // Calculate determinant
  const det = matrix.a * matrix.d - matrix.b * matrix.c;

  if (Math.abs(det) < 1e-10) {
    console.warn('Transformation matrix is singular - cannot invert');
    return null;
  }

  // Inverse matrix coefficients
  const invA = matrix.d / det;
  const invB = -matrix.b / det;
  const invC = -matrix.c / det;
  const invD = matrix.a / det;

  // Apply inverse transformation (translate first)
  const x_trans = drawingX - matrix.e;
  const y_trans = drawingY - matrix.f;

  const gpsLng = invA * x_trans + invB * y_trans;
  const gpsLat = invC * x_trans + invD * y_trans;

  return { lat: gpsLat, lng: gpsLng };
}

/**
 * Validate calibration points
 */
export function validateCalibrationPoints(
  points: CalibrationPoint[]
): { valid: boolean; error?: string } {
  if (!points || points.length < 3) {
    return { valid: false, error: 'Need at least 3 calibration points' };
  }

  // Check for uninitialized GPS coordinates (0, 0)
  for (let i = 0; i < points.length; i++) {
    if (points[i].gpsLat === 0 && points[i].gpsLng === 0) {
      return { valid: false, error: `Point ${i + 1} has uninitialized GPS coordinates. Please set GPS location for all points.` };
    }
  }

  // Check for duplicates
  const uniquePoints = new Set(points.map(p => `${p.gpsLat},${p.gpsLng}`));
  if (uniquePoints.size < 3) {
    return { valid: false, error: 'Calibration points must be unique' };
  }

  // Check if transformation matrix can be calculated
  const matrix = calculateTransformMatrix(points);
  if (!matrix) {
    return { valid: false, error: 'Calibration points are collinear - spread them out' };
  }

  return { valid: true };
}

/**
 * Calculate distance between two GPS points in meters (Haversine formula)
 */
export function gpsDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Estimate GPS accuracy requirement based on drawing scale
 * Returns recommended calibration point spacing in meters
 */
export function estimateRequiredAccuracy(
  calibrationPoints: CalibrationPoint[]
): number {
  if (calibrationPoints.length < 2) return 10; // default 10m

  // Find average distance between calibration points
  let totalDistance = 0;
  let count = 0;

  for (let i = 0; i < calibrationPoints.length - 1; i++) {
    for (let j = i + 1; j < calibrationPoints.length; j++) {
      const p1 = calibrationPoints[i];
      const p2 = calibrationPoints[j];
      const dist = gpsDistance(p1.gpsLat, p1.gpsLng, p2.gpsLat, p2.gpsLng);
      totalDistance += dist;
      count++;
    }
  }

  if (count === 0 || totalDistance === 0) {
    return 10; // default fallback
  }

  const avgDistance = totalDistance / count;

  // Required accuracy should be ~5% of point spacing
  return Math.max(5, Math.min(50, avgDistance * 0.05));
}
