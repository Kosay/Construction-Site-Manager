import React, { useState } from 'react';
import { X, Calendar, User, Eye, Trash2, Image as ImageIcon, Save, Loader2, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Mark, EvidencePhoto } from '../types';
import { EvidencePhotoUpload } from './EvidencePhotoUpload';
import { updateMark, deleteMark } from '../lib/firestore';
import { updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';

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

  const [category, setCategory] = useState<'safety' | 'measurement' | 'defect' | 'general' | 'progress' | 'quality' | 'other'>(mark.category || 'general');

  const handleUpdateCategory = async (newCategory: 'safety' | 'measurement' | 'defect' | 'general' | 'progress' | 'quality' | 'other') => {
    setCategory(newCategory);
    try {
      await updateMark(projectId, drawingId, mark.id, { category: newCategory }, shareToken);
      onUpdate();
    } catch (error) {
      console.error('Failed to update category:', error);
      alert('Error updating category.');
    }
  };

  const [tempName, setTempName] = useState(() => {
    return localStorage.getItem('custom_display_name') || auth.currentUser?.displayName || '';
  });
  const [updatingName, setUpdatingName] = useState(false);

  const handleUpdateMyName = async () => {
    if (!tempName.trim()) return;
    setUpdatingName(true);
    try {
      localStorage.setItem('custom_display_name', tempName.trim());
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: tempName.trim() });
      }
      await updateMark(projectId, drawingId, mark.id, { createdByName: tempName.trim() }, shareToken);
      onUpdate();
    } catch (error) {
      console.error('Failed to update name:', error);
      alert('Error updating display name.');
    } finally {
      setUpdatingName(false);
    }
  };

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

              {/* Classification Category Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Classification Category
                </label>
                {canEdit ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'safety', label: '⚠️ Safety', bg: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400' },
                      { id: 'measurement', label: '📐 Measurement', bg: 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/20 dark:border-sky-900/50 dark:text-sky-400' },
                      { id: 'defect', label: '❌ Defect/Issue', bg: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400' },
                      { id: 'progress', label: '🚧 Progress', bg: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400' },
                      { id: 'quality', label: '🔍 Quality Ctrl', bg: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/20 dark:border-purple-900/50 dark:text-purple-400' },
                      { id: 'general', label: '📋 General Slate', bg: 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400' },
                      { id: 'other', label: '📌 Other Note', bg: 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900/50 dark:text-indigo-400' }
                    ].map((cat) => {
                      const isSelected = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => handleUpdateCategory(cat.id as any)}
                          className={`px-2 py-1.5 text-[11px] font-medium rounded-lg border transition text-left flex items-center justify-between cursor-pointer ${
                            isSelected 
                              ? `${cat.bg} border-2 ring-1 ring-blue-500/30 font-bold` 
                              : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span>{cat.label}</span>
                          {isSelected && <Check className="h-3 w-3 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                    category === 'safety' ? 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900' :
                    category === 'measurement' ? 'bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900' :
                    category === 'defect' ? 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900' :
                    category === 'progress' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900' :
                    category === 'quality' ? 'bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-900' :
                    category === 'other' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900' :
                    'bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}>
                    {category === 'safety' ? '⚠️ Safety Observation' :
                     category === 'measurement' ? '📐 Measurement' :
                     category === 'defect' ? '❌ Defect / Issue' :
                     category === 'progress' ? '🚧 Progress Tracking' :
                     category === 'quality' ? '🔍 Quality Control' :
                     category === 'other' ? '📌 Other Note' :
                     '📋 General Slate'}
                  </span>
                )}
              </div>

              {/* Creator Metadata */}
              <div className="space-y-3 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 shadow-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" />
                  <span className="truncate">
                    Reported By:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {mark.createdByName || (mark.createdBy === 'admin' ? 'Project Owner' : `${mark.createdBy.substring(0, 10)}...`)}
                    </strong>
                  </span>
                </div>

                {/* Text box to update/set displayName */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Change Your Display Name
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      placeholder="Enter username..."
                      maxLength={50}
                      className="flex-1 px-2 py-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100 font-normal"
                    />
                    <button
                      onClick={handleUpdateMyName}
                      disabled={updatingName || !tempName.trim()}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-semibold text-[10px] cursor-pointer transition shrink-0"
                    >
                      {updatingName ? '...' : 'Save'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
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
