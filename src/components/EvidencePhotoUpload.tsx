import React, { useState, useRef } from 'react';
import { Image, UploadCloud, Loader2, X, Plus, Trash2 } from 'lucide-react';
import { uploadFile } from '../lib/storage';
import { EvidencePhoto } from '../types';

interface EvidencePhotoUploadProps {
  projectId: string;
  drawingId?: string;
  markId: string;
  storagePathPrefix?: string;
  onUploadComplete: (uploadedPhotos: EvidencePhoto[]) => void;
}

export const EvidencePhotoUpload: React.FC<EvidencePhotoUploadProps> = ({
  projectId,
  drawingId,
  markId,
  storagePathPrefix,
  onUploadComplete
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadFiles = async (files: FileList) => {
    setUploading(true);
    setError(null);
    const newPhotos: EvidencePhoto[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          continue; // skip non-images
        }

        const uniqueId = Math.random().toString(36).substring(2, 11);
        const fileExtension = file.name.split('.').pop() || 'jpg';
        // Unique path in storage to avoid name conflicts
        const storagePath = storagePathPrefix
          ? `${storagePathPrefix}/${uniqueId}_${Date.now()}.${fileExtension}`
          : `projects/${projectId}/drawings/${drawingId}/marks/${markId}/evidence/${uniqueId}_${Date.now()}.${fileExtension}`;
        
        const downloadUrl = await uploadFile(storagePath, file);
        newPhotos.push({
          photoId: uniqueId,
          url: downloadUrl,
          uploadedAt: new Date().toISOString()
        });
      }

      if (newPhotos.length > 0) {
        onUploadComplete(newPhotos);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to upload evidence photos.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleUploadFiles(e.target.files);
    }
  };

  const triggerInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerInput}
        className={`border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition ${
          dragActive
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
            : 'border-slate-300 dark:border-slate-800 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleChange}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center py-4">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
            <span className="text-xs text-slate-500 font-mono">UPLOADING EVIDENCE...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Drag & drop photos or click to browse
            </span>
            <span className="text-[10px] text-slate-400 mt-1">
              Supports PNG, JPG, JPEG up to 50MB
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-500 flex items-start gap-1.5 p-2 bg-red-50 dark:bg-red-950/20 rounded">
          <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
