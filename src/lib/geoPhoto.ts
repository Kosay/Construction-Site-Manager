import { Project, Mark, EvidencePhoto } from '../types';
import { uploadFile } from './storage';
import { addMark, addMapPoint } from './firestore';
import { calculateTransformMatrix, gpsToDrawingCoordinates } from './coordinateTransform';

export interface GeoPhotoInput {
  projectId: string;
  project: Project | null;
  drawingId: string;
  photo: File;
  lat: number;
  lng: number;
  accuracy?: number;
  createdBy: string;
  createdByName?: string;
  label?: string;
  category?: NonNullable<Mark['category']>;
  shareToken?: string;
}

export interface GeoPhotoResult {
  // 'mark' = placed on the drawing via GPS calibration.
  // 'mapPoint' = fallback: no calibration or GPS outside the drawing, saved to the site map.
  savedAs: 'mark' | 'mapPoint';
  id: string;
}

/**
 * Uploads a captured photo and saves it to the project pinned to the given GPS
 * coordinates. If the project has calibration points and the location maps onto
 * the drawing, it becomes a mark on the drawing; otherwise it is saved as a
 * geolocated site-map point so the evidence is never lost.
 */
export async function saveGeoPhoto(input: GeoPhotoInput): Promise<GeoPhotoResult> {
  // 1. Upload the photo to Storage
  const storagePath = `projects/${input.projectId}/evidence/${Date.now()}_${input.photo.name}`;
  const url = await uploadFile(storagePath, input.photo);
  const photo: EvidencePhoto = {
    photoId: `${Date.now()}`,
    url,
    uploadedAt: new Date().toISOString(),
  };

  const metadata = {
    gpsLat: input.lat,
    gpsLng: input.lng,
    timestamp: new Date().toISOString(),
    deviceInfo: 'mobile',
    ...(input.accuracy !== undefined ? { gpsAccuracy: input.accuracy } : {}),
  };

  const label = input.label?.trim() || 'Photo observation';
  const category = input.category || 'general';

  // 2. Try to place it on the drawing using the project's GPS calibration
  const matrix = input.project?.calibrationPoints
    ? calculateTransformMatrix(input.project.calibrationPoints)
    : null;
  const drawingCoords = matrix ? gpsToDrawingCoordinates(input.lat, input.lng, matrix) : null;

  if (drawingCoords) {
    const id = await addMark(
      input.projectId,
      input.drawingId,
      {
        type: 'circle',
        coordinates: { x: drawingCoords.x, y: drawingCoords.y, radius: 2 },
        label,
        category,
        createdBy: input.createdBy,
        ...(input.createdByName ? { createdByName: input.createdByName } : {}),
        metadata,
        evidencePhotos: [photo],
      },
      input.shareToken
    );
    return { savedAs: 'mark', id };
  }

  // 3. Fallback: save as a geolocated site-map point
  const id = await addMapPoint(
    input.projectId,
    {
      lat: input.lat,
      lng: input.lng,
      label,
      category,
      createdBy: input.createdBy,
      ...(input.createdByName ? { createdByName: input.createdByName } : {}),
      metadata,
      evidencePhotos: [photo],
    },
    input.shareToken
  );
  return { savedAs: 'mapPoint', id };
}
