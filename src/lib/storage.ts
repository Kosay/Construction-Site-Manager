import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Uploads a file to Firebase Storage and returns its public download URL.
 * Supports files up to 50MB (as requested).
 * @param path The path in the storage bucket (e.g., "projects/123/drawings/floorplan.png")
 * @param file The HTML5 File object
 */
export async function uploadFile(path: string, file: File): Promise<string> {
  const maxSize = 50 * 1024 * 1024; // 50 MB
  if (file.size > maxSize) {
    throw new Error(`File is too large. Maximum allowed size is 50MB. (File is ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  }

  try {
    const storageRef = ref(storage, path);
    // Perform the upload
    const snapshot = await uploadBytes(storageRef, file);
    // Get and return the download URL
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error: any) {
    console.error('Storage Upload Error:', error);
    
    // Catch authorization/setup issues and provide clear step-by-step instructions
    const isUnauthorized = error && (
      error.code === 'storage/unauthorized' || 
      (error.message && error.message.includes('permission')) ||
      (error.message && error.message.includes('unauthorized'))
    );
    
    if (isUnauthorized) {
      const projectId = firebaseConfig.projectId || 'your-project-id';
      throw new Error(
        `Firebase Storage is not enabled or write permission is denied.\n\n` +
        `To enable file uploading, please perform the following quick setup steps:\n\n` +
        `1. Open Firebase Storage Console:\n` +
        `   https://console.firebase.google.com/project/${projectId}/storage\n\n` +
        `2. Click "Get Started" to initialize the default Storage bucket.\n\n` +
        `3. Go to the "Rules" tab and paste the following ruleset to allow writes for authenticated engineers:\n\n` +
        `rules_version = '2';\n` +
        `service firebase.storage {\n` +
        `  match /b/{bucket}/o {\n` +
        `    match /{allPaths=**} {\n` +
        `      allow read, write: if request.auth != null;\n` +
        `    }\n` +
        `  }\n` +
        `}`
      );
    }
    
    throw new Error(error instanceof Error ? error.message : 'Failed to upload file to storage.');
  }
}

/**
 * Deletes an object from Firebase Storage if it exists.
 * @param fileUrl The full download URL of the file to delete
 */
export async function deleteFileByUrl(fileUrl: string): Promise<void> {
  try {
    // Extract the storage path from the download URL if possible
    const decodedUrl = decodeURIComponent(fileUrl);
    const pathStart = decodedUrl.indexOf('/o/') + 3;
    const pathEnd = decodedUrl.indexOf('?alt=media');
    
    if (pathStart > 2 && pathEnd > pathStart) {
      const storagePath = decodedUrl.substring(pathStart, pathEnd);
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    }
  } catch (error) {
    console.warn('Storage deletion failed or file did not exist:', error);
  }
}
