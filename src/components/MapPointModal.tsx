import React, { useState } from 'react';
import { X, MapPin, Trash2, Save, Loader2, Image as ImageIcon, ArrowLeft, ArrowRight } from 'lucide-react';
import { MapPoint, EvidencePhoto } from '../types';
import { EvidencePhotoUpload } from './EvidencePhotoUpload';
import { updateMapPoint, deleteMapPoint } from '../lib/firestore';
import { auth } from '../lib/firebase';

interface MapPointModalProps {
  projectId: string;
  point: MapPoint;
  onClose: () => void;
  onUpdate: () => void;
  canEdit: boolean;
  shareToken?: string;
}

const CATEGORIES: MapPoint['category'][] = [
  'safety', 'measurement', 'defect', 'general', 'progress', 'quality', 'other'
];

export const MapPointModal: React.FC<MapPointModalProps> = ({
  projectId,
  point,
  onClose,
  onUpdate,
  canEdit,
  shareToken
}) => {
  const [label, setLabel] = useState(point.label);
  const [category, setCategory] = useState<MapPoint['category']>(point.category || 'general');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = point.evidencePhotos || [];

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const name = localStorage.getItem('custom_display_name') || auth.currentUser?.displayName || undefined;
      await updateMapPoint(
        projectId,
        point.id,
        { label: label.trim(), category, ...(name ? { createdByName: name } : {}) },
        shareToken
      );
      onUpdate();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save point.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    setDeleting(true);
    try {
      await deleteMapPoint(projectId, point.id);
      onUpdate();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to delete point.');
    } finally {
      setDeleting(false);
    }
  };

  const handlePhotosUploaded = async (uploaded: EvidencePhoto[]) => {
    try {
      const merged = [...photos, ...uploaded];
      await updateMapPoint(projectId, point.id, { evidencePhotos: merged }, shareToken);
      onUpdate();
    } catch (err) {
      console.error(err);
      alert('Failed to attach photos.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Map Observation Point</h3>
              <p className="text-[10px] text-slate-500 font-mono">
                {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Label */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Label</label>
            <input
              type="text"
              value={label}
              disabled={!canEdit}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Describe this location..."
              className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100 disabled:opacity-60"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Category</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  disabled={!canEdit}
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize transition cursor-pointer border ${
                    category === cat
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Evidence photos */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" /> Evidence Photos ({photos.length})
            </label>

            {photos.length > 0 && (
              <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                <img src={photos[photoIndex]?.url} alt="Evidence" className="w-full h-52 object-contain" />
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-900/70 text-white hover:bg-slate-900 cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-900/70 text-white hover:bg-slate-900 cursor-pointer"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-900/70 text-white text-[10px] font-mono">
                      {photoIndex + 1} / {photos.length}
                    </div>
                  </>
                )}
              </div>
            )}

            {canEdit && (
              <div className="mt-2">
                <EvidencePhotoUpload
                  projectId={projectId}
                  markId={point.id}
                  storagePathPrefix={`projects/${projectId}/mapPoints/${point.id}/evidence`}
                  onUploadComplete={handlePhotosUploaded}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        {canEdit && (
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-rose-600 font-bold">Delete this point?</span>
                <button onClick={handleDelete} disabled={deleting} className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer">
                  {deleting ? '...' : 'Yes'}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer">
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer transition"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};