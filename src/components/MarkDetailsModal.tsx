import React, { useState } from 'react';
import { X, Calendar, User, Eye, Trash2, Image as ImageIcon, Save, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { Mark, EvidencePhoto } from '../types';
import { EvidencePhotoUpload } from './EvidencePhotoUpload';
import { updateMark, deleteMark } from '../lib/firestore';

interface MarkDetailsModalProps {
  projectId: string;
  drawingId: string;
  mark: Mark;
  onClose: () => void;
  onUpdate: () => void;
  canEdit: boolean;
  shareToken?: string;
}

export const MarkDetailsModal: React.FC<MarkDetailsModalProps> = ({
  projectId,
  drawingId,
  mark,
  onClose,
  onUpdate,
  canEdit,
  shareToken
}) => {
  const [label, setLabel] = useState(mark.label);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activePhoto, setActivePhoto] = useState<string | null>(
    mark.evidencePhotos.length > 0 ? mark.evidencePhotos[0].url : null
  );
  const [photoIndex, setPhotoIndex] = useState<number>(0);

  const handleSaveLabel = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try {
      await updateMark(projectId, drawingId, mark.id, { label: label.trim() }, shareToken);
      onUpdate();
    } catch (error) {
      console.error('Failed to update mark:', error);
      alert('Error saving changes. Check permissions.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMark = async () => {
    if (!window.confirm('Are you sure you want to delete this observation mark? All associated evidence photos will be unlinked.')) {
      return;
    }
    setDeleting(true);
    try {
      await deleteMark(projectId, drawingId, mark.id);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Failed to delete mark:', error);
      alert('Error deleting mark. Check permissions.');
    } finally {
      setDeleting(false);
    }
  };

  const handlePhotoUploadComplete = async (newPhotos: EvidencePhoto[]) => {
    setSaving(true);
    try {
      const updatedPhotos = [...mark.evidencePhotos, ...newPhotos];
      await updateMark(projectId, drawingId, mark.id, { evidencePhotos: updatedPhotos }, shareToken);
      onUpdate();
      if (!activePhoto && updatedPhotos.length > 0) {
        setActivePhoto(updatedPhotos[updatedPhotos.length - 1].url);
        setPhotoIndex(updatedPhotos.length - 1);
      }
    } catch (error) {
      console.error('Failed to update evidence photos:', error);
      alert('Failed to save uploaded photos.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePhoto = async (photoId: string, indexToDelete: number) => {
    if (!window.confirm('Delete this evidence photo?')) return;
    setSaving(true);
    try {
      const updatedPhotos = mark.evidencePhotos.filter(p => p.photoId !== photoId);
      await updateMark(projectId, drawingId, mark.id, { evidencePhotos: updatedPhotos }, shareToken);
      onUpdate();
      
      // Update active photo focus
      if (updatedPhotos.length === 0) {
        setActivePhoto(null);
        setPhotoIndex(0);
      } else {
        const nextIndex = Math.max(0, indexToDelete - 1);
        setActivePhoto(updatedPhotos[nextIndex].url);
        setPhotoIndex(nextIndex);
      }
    } catch (error) {
      console.error('Failed to delete evidence photo:', error);
    } finally {
      setSaving(false);
    }
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (mark.evidencePhotos.length <= 1) return;
    let newIndex = photoIndex;
    if (direction === 'prev') {
      newIndex = photoIndex === 0 ? mark.evidencePhotos.length - 1 : photoIndex - 1;
    } else {
      newIndex = photoIndex === mark.evidencePhotos.length - 1 ? 0 : photoIndex + 1;
    }
    setPhotoIndex(newIndex);
    setActivePhoto(mark.evidencePhotos[newIndex].url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh] md:h-[75vh] max-h-[750px]">
        
        {/* Left Side: Floating Photo Lightbox / Gallery Viewer */}
        <div className="flex-1 bg-slate-950 flex flex-col justify-between relative p-4 border-r border-slate-100 dark:border-slate-900">
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-white">
            <ImageIcon className="h-4 w-4 text-sky-400" />
            <span>Evidence Visualizer ({mark.evidencePhotos.length} Attached)</span>
          </div>

          <div className="flex-1 flex items-center justify-center relative min-h-[220px]">
            {activePhoto ? (
              <>
                <img
                  src={activePhoto}
                  alt="Observation Evidence"
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[450px] object-contain rounded-lg shadow-lg"
                />
                
                {/* Image Navigation */}
                {mark.evidencePhotos.length > 1 && (
                  <>
                    <button
                      onClick={() => navigatePhoto('prev')}
                      className="absolute left-2 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white cursor-pointer transition"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => navigatePhoto('next')}
                      className="absolute right-2 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white cursor-pointer transition"
                    >
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </>
                )}

                {/* Delete current photo */}
                {canEdit && (
                  <button
                    onClick={() => handleDeletePhoto(mark.evidencePhotos[photoIndex].photoId, photoIndex)}
                    disabled={saving}
                    className="absolute bottom-2 right-2 p-2 rounded-lg bg-red-600 hover:bg-red-700 border border-red-500 text-white transition hover:scale-105 cursor-pointer flex items-center gap-1.5 text-xs shadow-md"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Photo
                  </button>
                )}
              </>
            ) : (
              <div className="text-center text-slate-500">
                <ImageIcon className="h-14 w-14 mx-auto text-slate-700 stroke-1 mb-2 animate-pulse" />
                <p className="text-sm font-medium">No Evidence Photos Uploaded</p>
                <p className="text-xs text-slate-600 mt-1">Upload a photo to support this observation</p>
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {mark.evidencePhotos.length > 0 && (
            <div className="flex gap-2 py-2 overflow-x-auto shrink-0 max-w-full border-t border-slate-900 mt-2">
              {mark.evidencePhotos.map((photo, index) => (
                <button
                  key={photo.photoId}
                  onClick={() => {
                    setActivePhoto(photo.url);
                    setPhotoIndex(index);
                  }}
                  className={`relative w-16 h-16 rounded overflow-hidden shrink-0 border-2 cursor-pointer transition ${
                    activePhoto === photo.url ? 'border-sky-500 scale-105' : 'border-slate-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={photo.url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Details / Controls / Metadata */}
        <div className="w-full md:w-[360px] p-6 flex flex-col justify-between bg-slate-50 dark:bg-slate-950 overflow-y-auto">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 capitalize mb-1">
                  {mark.type} Mark
                </span>
                <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Observation Details
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Editable Label Form */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Observation Notes & Title
                </label>
                {canEdit ? (
                  <div className="flex gap-2">
                    <textarea
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      className="flex-1 min-h-[80px] p-2.5 border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100"
                      placeholder="Describe what is observed here..."
                    />
                    <button
                      onClick={handleSaveLabel}
                      disabled={saving || !label.trim() || label === mark.label}
                      className="p-2.5 self-end rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                      title="Save description"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 min-h-[80px] whitespace-pre-wrap">
                    {mark.label}
                  </div>
                )}
              </div>

              {/* Creator Metadata */}
              <div className="space-y-2.5 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 shadow-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" />
                  <span className="truncate">
                    Reported By:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {mark.createdBy.substring(0, 10)}... (Contributor)
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>
                    Logged On:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {mark.createdAt?.toDate 
                        ? mark.createdAt.toDate().toLocaleString() 
                        : new Date(mark.createdAt).toLocaleString()}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Photo Uploader for supporting evidence */}
            {canEdit && (
              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Attach More Evidence
                </label>
                <EvidencePhotoUpload
                  projectId={projectId}
                  drawingId={drawingId}
                  markId={mark.id}
                  onUploadComplete={handlePhotoUploadComplete}
                />
              </div>
            )}
          </div>

          {/* Delete observation mark entirely */}
          {canEdit && (
            <button
              onClick={handleDeleteMark}
              disabled={deleting}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg font-medium text-sm cursor-pointer transition disabled:opacity-45"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Mark Entirely
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
