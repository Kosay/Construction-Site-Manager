export interface CalibrationPoint {
  id: string;
  name: string;
  gpsLat: number;
  gpsLng: number;
  drawingX: number;  // percentage 0-100
  drawingY: number;  // percentage 0-100
}

export interface Project {
  id: string;
  projectName: string;
  createdBy: string;
  description: string;
  createdAt: any; // Firestore Timestamp or string
  kmlUrl?: string;
  kmlFileName?: string;
  calibrationPoints?: CalibrationPoint[];
}

export interface Drawing {
  id: string;
  fileName: string;
  url: string;
  uploadedAt: any;
}

export interface Model {
  id: string;
  fileName: string;
  url: string;
  uploadedAt: any;
}

export interface EvidencePhoto {
  photoId: string;
  url: string;
  uploadedAt: any;
}

export interface MarkCoordinates {
  x: number;      // percentage (0-100)
  y: number;      // percentage (0-100)
  radius?: number;// percentage radius for circles (optional)
  width?: number; // percentage width for rectangles
  height?: number;// percentage height for rectangles
  x2?: number;    // percentage end point x for lines
  y2?: number;    // percentage end point y for lines
}

export interface MarkMetadata {
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracy?: number;  // meters
  timestamp: string;     // ISO 8601 timestamp
  deviceInfo?: string;   // mobile/desktop identifier
}

export interface Mark {
  id: string;
  type: 'circle' | 'rectangle' | 'line';
  coordinates: MarkCoordinates;
  label: string;
  createdBy: string;
  createdByName?: string; // optional name of the user who created/edited the mark
  createdAt: any; // Firestore Timestamp
  evidencePhotos: EvidencePhoto[];
  shareToken?: string; // optional token included to authorize edits in public share views
  category?: 'safety' | 'measurement' | 'defect' | 'general' | 'progress' | 'quality' | 'other';
  metadata?: MarkMetadata;
}

export interface ShareLink {
  id: string;
  token: string;
  projectId: string;
  accessLevel: 'view' | 'edit';
  createdAt: any;
  expiresAt: any;
  createdBy: string;
}

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  category?: 'safety' | 'measurement' | 'defect' | 'general' | 'progress' | 'quality' | 'other';
  createdBy: string;
  createdByName?: string;
  createdAt: any;
  evidencePhotos: EvidencePhoto[];
  shareToken?: string;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        'camera-controls'?: boolean;
        autoplay?: boolean;
        ar?: boolean;
        'auto-rotate'?: boolean;
        style?: React.CSSProperties;
        id?: string;
      }, HTMLElement>;
    }
  }
}

