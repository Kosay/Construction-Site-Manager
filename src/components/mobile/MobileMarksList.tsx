import React from 'react';
import { Mark } from '../types';
import { Camera, MapPin } from 'lucide-react';

interface MobileMarksListProps {
  projectId: string;
  marks: Mark[];
  onSelectMark: (mark: Mark) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  safety: '#f43f5e',
  measurement: '#0ea5e9',
  defect: '#f59e0b',
  progress: '#10b981',
  quality: '#a855f7',
  other: '#6366f1',
  general: '#64748b',
};

export const MobileMarksList: React.FC<MobileMarksListProps> = ({
  projectId,
  marks,
  onSelectMark,
}) => {
  if (marks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No marks yet</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Create marks from the drawing screen
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3 pb-20">
      {marks.map((mark) => (
        <button
          key={mark.id}
          onClick={() => onSelectMark(mark)}
          className="w-full text-left p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg active:bg-slate-100 dark:active:bg-slate-700 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-1">
                {mark.label}
              </div>
              <div className="flex gap-2 mb-2">
                <span
                  className="text-xs font-semibold px-2 py-0.5 text-white rounded capitalize"
                  style={{ backgroundColor: CATEGORY_COLORS[mark.category || 'general'] }}
                >
                  {mark.category || 'general'}
                </span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                {mark.metadata?.gpsLat && mark.metadata?.gpsLng && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {mark.metadata.gpsLat.toFixed(4)}, {mark.metadata.gpsLng.toFixed(4)}
                  </div>
                )}
                {mark.evidencePhotos && mark.evidencePhotos.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Camera className="h-3 w-3" />
                    {mark.evidencePhotos.length} photo{mark.evidencePhotos.length !== 1 ? 's' : ''}
                  </div>
                )}
                {mark.createdAt && (
                  <div>
                    {new Date(mark.createdAt).toLocaleDateString()} at{' '}
                    {new Date(mark.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
