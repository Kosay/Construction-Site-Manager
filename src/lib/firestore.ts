import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { Project, Drawing, Model, Mark, ShareLink, EvidencePhoto, MapPoint, CalibrationPoint } from '../types';

// Helper to generate a unique token
export function generateToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Creates a new project in Firestore
 */
export async function createProject(
  projectName: string,
  description: string,
  userId: string,
  kml?: { url: string; fileName: string } | null,
  calibrationPoints?: CalibrationPoint[] | null
): Promise<string> {
  const path = 'projects';
  try {
    const projectRef = doc(collection(db, path));
    const payload: any = {
      projectName,
      description,
      createdBy: userId,
      createdAt: serverTimestamp(),
    };
    if (kml) {
      payload.kmlUrl = kml.url;
      payload.kmlFileName = kml.fileName;
    }
    if (calibrationPoints && calibrationPoints.length > 0) {
      payload.calibrationPoints = calibrationPoints;
    }
    await setDoc(projectRef, payload);
    return projectRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Deletes a project from Firestore along with all associated drawings, marks, models, members, and share links.
 */
export async function deleteProject(projectId: string): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    // 1. Delete all shareLinks associated with this project
    const shareLinksSnap = await getDocs(
      query(collection(db, 'shareLinks'), where('projectId', '==', projectId))
    );
    const deleteShareLinkPromises = shareLinksSnap.docs.map((docSnap) => 
      deleteDoc(doc(db, 'shareLinks', docSnap.id))
    );
    await Promise.all(deleteShareLinkPromises);

    // 2. Delete all drawings and their subcollection of marks
    const drawingsSnap = await getDocs(collection(db, 'projects', projectId, 'drawings'));
    for (const drawingDoc of drawingsSnap.docs) {
      const drawingId = drawingDoc.id;
      
      // Delete all marks inside this drawing
      const marksSnap = await getDocs(collection(db, 'projects', projectId, 'drawings', drawingId, 'marks'));
      const deleteMarkPromises = marksSnap.docs.map((markDoc) => 
        deleteDoc(doc(db, 'projects', projectId, 'drawings', drawingId, 'marks', markDoc.id))
      );
      await Promise.all(deleteMarkPromises);

      // Delete the drawing document
      await deleteDoc(doc(db, 'projects', projectId, 'drawings', drawingId));
    }

    // 3. Delete all models under projects/${projectId}/models
    const modelsSnap = await getDocs(collection(db, 'projects', projectId, 'models'));
    const deleteModelPromises = modelsSnap.docs.map((modelDoc) => 
      deleteDoc(doc(db, 'projects', projectId, 'models', modelDoc.id))
    );
    await Promise.all(deleteModelPromises);

    // 4. Delete all members under projects/${projectId}/members
    const membersSnap = await getDocs(collection(db, 'projects', projectId, 'members'));
    const deleteMemberPromises = membersSnap.docs.map((memberDoc) =>
      deleteDoc(doc(db, 'projects', projectId, 'members', memberDoc.id))
    );
    await Promise.all(deleteMemberPromises);

    // 5. Delete all map points under projects/${projectId}/mapPoints
    const mapPointsSnap = await getDocs(collection(db, 'projects', projectId, 'mapPoints'));
    const deleteMapPointPromises = mapPointsSnap.docs.map((pointDoc) =>
      deleteDoc(doc(db, 'projects', projectId, 'mapPoints', pointDoc.id))
    );
    await Promise.all(deleteMapPointPromises);

    // 6. Finally, delete the parent project document itself
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Fetches a single project's details
 */
export async function getProject(projectId: string): Promise<Project | null> {
  const path = `projects/${projectId}`;
  try {
    const docSnap = await getDoc(doc(db, 'projects', projectId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Project;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Fetches all projects for the logged-in user (created or member)
 */
export async function getProjects(userId: string): Promise<Project[]> {
  const path = 'projects';
  try {
    const q = query(collection(db, path), where('createdBy', '==', userId));
    const querySnapshot = await getDocs(q);
    const projects: Project[] = [];
    querySnapshot.forEach((doc) => {
      projects.push({ id: doc.id, ...doc.data() } as Project);
    });
    return projects;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Adds a drawing reference to a project
 */
export async function addDrawing(projectId: string, fileName: string, url: string): Promise<string> {
  const path = `projects/${projectId}/drawings`;
  try {
    const docRef = await addDoc(collection(db, 'projects', projectId, 'drawings'), {
      fileName,
      url,
      uploadedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Fetches all drawings for a project
 */
export async function getDrawings(projectId: string): Promise<Drawing[]> {
  const path = `projects/${projectId}/drawings`;
  try {
    const querySnapshot = await getDocs(collection(db, 'projects', projectId, 'drawings'));
    const drawings: Drawing[] = [];
    querySnapshot.forEach((doc) => {
      drawings.push({ id: doc.id, ...doc.data() } as Drawing);
    });
    return drawings;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Adds a 3D GLB model reference to a project
 */
export async function addModel(projectId: string, fileName: string, url: string): Promise<string> {
  const path = `projects/${projectId}/models`;
  try {
    const docRef = await addDoc(collection(db, 'projects', projectId, 'models'), {
      fileName,
      url,
      uploadedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Fetches all models for a project
 */
export async function getModels(projectId: string): Promise<Model[]> {
  const path = `projects/${projectId}/models`;
  try {
    const querySnapshot = await getDocs(collection(db, 'projects', projectId, 'models'));
    const models: Model[] = [];
    querySnapshot.forEach((doc) => {
      models.push({ id: doc.id, ...doc.data() } as Model);
    });
    return models;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Adds a geometric mark to a drawing
 */
export async function addMark(
  projectId: string,
  drawingId: string,
  markData: Omit<Mark, 'id' | 'createdAt'>,
  shareToken?: string
): Promise<string> {
  const path = `projects/${projectId}/drawings/${drawingId}/marks`;
  try {
    const markRef = doc(collection(db, 'projects', projectId, 'drawings', drawingId, 'marks'));

    // Construct payload. If shareToken is provided, store it so security rules can validate it
    const payload: any = {
      type: markData.type,
      coordinates: markData.coordinates,
      label: markData.label,
      createdBy: markData.createdBy,
      createdAt: serverTimestamp(),
      evidencePhotos: markData.evidencePhotos,
    };

    if (markData.category) {
      payload.category = markData.category;
    }

    if (markData.createdByName) {
      payload.createdByName = markData.createdByName;
    }

    if (markData.metadata) {
      payload.metadata = markData.metadata;
    }

    if (shareToken) {
      payload.shareToken = shareToken;
    }

    await setDoc(markRef, payload);
    return markRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Updates a mark's details or evidence photos on a drawing
 */
export async function updateMark(
  projectId: string, 
  drawingId: string, 
  markId: string, 
  updates: Partial<Mark>, 
  shareToken?: string
): Promise<void> {
  const path = `projects/${projectId}/drawings/${drawingId}/marks/${markId}`;
  try {
    const markRef = doc(db, 'projects', projectId, 'drawings', drawingId, 'marks', markId);
    
    const payload: any = { ...updates };
    if (shareToken) {
      payload.shareToken = shareToken;
    }

    await updateDoc(markRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Deletes a mark from a drawing
 */
export async function deleteMark(projectId: string, drawingId: string, markId: string): Promise<void> {
  const path = `projects/${projectId}/drawings/${drawingId}/marks/${markId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'drawings', drawingId, 'marks', markId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Fetches all marks for a drawing
 */
export async function getMarks(projectId: string, drawingId: string): Promise<Mark[]> {
  const path = `projects/${projectId}/drawings/${drawingId}/marks`;
  try {
    const querySnapshot = await getDocs(collection(db, 'projects', projectId, 'drawings', drawingId, 'marks'));
    const marks: Mark[] = [];
    querySnapshot.forEach((docSnap) => {
      marks.push({ id: docSnap.id, ...docSnap.data() } as Mark);
    });
    return marks;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ------------------------------------------------------------------
// MAP POINTS (KML site-map annotations)
// ------------------------------------------------------------------

/**
 * Adds a geolocated point to a project's site map
 */
export async function addMapPoint(
  projectId: string,
  pointData: Omit<MapPoint, 'id' | 'createdAt'>,
  shareToken?: string
): Promise<string> {
  const path = `projects/${projectId}/mapPoints`;
  try {
    const pointRef = doc(collection(db, 'projects', projectId, 'mapPoints'));

    const payload: any = {
      lat: pointData.lat,
      lng: pointData.lng,
      label: pointData.label,
      createdBy: pointData.createdBy,
      createdAt: serverTimestamp(),
      evidencePhotos: pointData.evidencePhotos,
    };

    if (pointData.category) payload.category = pointData.category;
    if (pointData.createdByName) payload.createdByName = pointData.createdByName;
    if (pointData.metadata) payload.metadata = pointData.metadata;
    if (shareToken) payload.shareToken = shareToken;

    await setDoc(pointRef, payload);
    return pointRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Fetches all map points for a project
 */
export async function getMapPoints(projectId: string): Promise<MapPoint[]> {
  const path = `projects/${projectId}/mapPoints`;
  try {
    const querySnapshot = await getDocs(collection(db, 'projects', projectId, 'mapPoints'));
    const points: MapPoint[] = [];
    querySnapshot.forEach((docSnap) => {
      points.push({ id: docSnap.id, ...docSnap.data() } as MapPoint);
    });
    return points;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Updates a map point's details or evidence photos
 */
export async function updateMapPoint(
  projectId: string,
  pointId: string,
  updates: Partial<MapPoint>,
  shareToken?: string
): Promise<void> {
  const path = `projects/${projectId}/mapPoints/${pointId}`;
  try {
    const pointRef = doc(db, 'projects', projectId, 'mapPoints', pointId);
    const payload: any = { ...updates };
    if (shareToken) payload.shareToken = shareToken;
    await updateDoc(pointRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Deletes a map point from a project
 */
export async function deleteMapPoint(projectId: string, pointId: string): Promise<void> {
  const path = `projects/${projectId}/mapPoints/${pointId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'mapPoints', pointId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Generates a public shareable link for a project
 */
export async function createShareLink(
  projectId: string, 
  accessLevel: 'view' | 'edit', 
  expiresInDays: number | null, 
  adminUid: string
): Promise<ShareLink> {
  const path = 'shareLinks';
  try {
    const token = generateToken();
    const expiresAt = expiresInDays 
      ? Timestamp.fromDate(new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000))
      : null;

    const linkRef = doc(db, 'shareLinks', token); // Use token as ID so it can be verified with exists()
    const linkDoc = {
      token,
      projectId,
      accessLevel,
      createdAt: serverTimestamp(),
      expiresAt,
      createdBy: auth.currentUser?.uid || adminUid
    };

    await setDoc(linkRef, linkDoc);
    return { id: token, ...linkDoc } as ShareLink;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Fetches all active share links of a project
 */
export async function getProjectShareLinks(projectId: string): Promise<ShareLink[]> {
  const path = 'shareLinks';
  try {
    const currentUserUid = auth.currentUser?.uid;
    if (!currentUserUid) return [];
    
    const q = query(
      collection(db, path), 
      where('projectId', '==', projectId),
      where('createdBy', '==', currentUserUid)
    );
    const querySnapshot = await getDocs(q);
    const links: ShareLink[] = [];
    querySnapshot.forEach((docSnap) => {
      links.push({ id: docSnap.id, ...docSnap.data() } as ShareLink);
    });
    return links;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Revokes a shareable link
 */
export async function revokeShareLink(token: string): Promise<void> {
  const path = `shareLinks/${token}`;
  try {
    await deleteDoc(doc(db, 'shareLinks', token));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Validates a share link token and returns its metadata + access status
 */
export async function validateShareLink(token: string): Promise<ShareLink | null> {
  const path = `shareLinks/${token}`;
  try {
    const docSnap = await getDoc(doc(db, 'shareLinks', token));
    if (!docSnap.exists()) return null;
    
    const data = docSnap.data() as Omit<ShareLink, 'id'>;
    
    // Check expiration
    if (data.expiresAt) {
      const expiry = data.expiresAt instanceof Timestamp 
        ? data.expiresAt.toDate() 
        : new Date(data.expiresAt);
        
      if (expiry < new Date()) {
        console.warn('Share link has expired:', expiry);
        return null;
      }
    }
    
    return { id: docSnap.id, ...data } as ShareLink;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}