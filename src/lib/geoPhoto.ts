import { Project, Mark, EvidencePhoto } from '../types';
import { uploadFile } from './storage';
import { addMark, addMapPoint } from './firestore';
import { calculateTransformMatrix, gpsToDrawingCoordinates } from './coordinateTransform';

export interface GeoPhotoInput {
  projectId: string;
  project: Project | null;
  drawingId: string;
  photo: File;
  // GPS is optional — a photo can still be uploaded without a location fix.
  lat?: number;
  lng?: number;
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

  const hasGps = typeof input.lat === 'number' && typeof input.lng === 'number';
  const metadata = {
    timestamp: new Date().toISOString(),
    deviceInfo: 'mobile',
    ...(hasGps ? { gpsLat: input.lat, gpsLng: input.lng } : {}),
    ...(input.accuracy !== undefined ? { gpsAccuracy: input.accuracy } : {}),
  };

  const label = input.label?.trim() || 'Photo observation';
  const category = input.category || 'general';

  const createMarkAt = (x: number, y: number) =>
    addMark(
      input.projectId,
      input.drawingId,
      {
        type: 'circle',
        coordinates: { x, y, radius: 2 },
        label,
        category,
        createdBy: input.createdBy,
        ...(input.createdByName ? { createdByName: input.createdByName } : {}),
        metadata,
        evidencePhotos: [photo],
      },
      input.shareToken
    );

  // 2. If we have GPS and the project is calibrated, place the mark at the
  //    matching spot on the drawing.
  const matrix =
    hasGps && input.project?.calibrationPoints
      ? calculateTransformMatrix(input.project.calibrationPoints)
      : null;
  const drawingCoords = matrix ? gpsToDrawingCoordinates(input.lat!, input.lng!, matrix) : null;

  if (drawingCoords) {
    const id = await createMarkAt(drawingCoords.x, drawingCoords.y);
    return { savedAs: 'mark', id };
  }

  // 3. Owner with GPS but no calibration → geolocated site-map point.
  //    (Guests can't write mapPoints under the current rules, so they skip this.)
  if (hasGps && !input.shareToken) {
    const id = await addMapPoint(
      input.projectId,
      {
        lat: input.lat!,
        lng: input.lng!,
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

  // 4. No calibration match (or no GPS): attach the photo as a mark at the
  //    center of the drawing so it is always saved and rules-covered.
  const id = await createMarkAt(50, 50);
  return { savedAs: 'mark', id };
}
