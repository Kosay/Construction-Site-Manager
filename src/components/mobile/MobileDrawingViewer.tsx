import React, { useState, useEffect } from 'react';
import { Circle, Square, Minus, Camera, MapPin, ChevronLeft, Loader2, Check, Share2 } from 'lucide-react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Drawing, Mark, Project } from '../../types';
import { getMarks, getProject } from '../../lib/firestore';
import { useAuth } from '../../lib/authContext';
import { saveGeoPhoto } from '../../lib/geoPhoto';
import { MobileShareProject } from './MobileShareProject';

interface MobileDrawingViewerProps {
  projectId: string;
  drawingId: string;
  drawing: Drawing;
  onBack: () => void;
  onPhotoCapture: () => void;
  onGPSCapture: () => void;
  onCreateMark: (type: 'circle' | 'rectangle' | 'line') => void;
  onShowMarksList: () => void;
  canEdit?: boolean;
  shareToken?: string;
}

type ToolType = 'select' | 'circle' | 'rectangle' | 'line';

export const MobileDrawingViewer: React.FC<MobileDrawingViewerProps> = ({
  projectId,
  drawingId,
  drawing,
  onBack,
  onPhotoCapture,
  onGPSCapture,
  onCreateMark,
  onShowMarksList,
  canEdit = true,
  shareToken,
}) => {
  const { user } = useAuth();
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [marksData, projectData] = await Promise.all([
          getMarks(projectId, drawingId),
          getProject(projectId),
        ]);
        setMarks(marksData);
        setProject(projectData);
      } catch (err) {
        console.error('Failed to load drawing data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, drawingId]);

  const handleToolClick = (tool: ToolType) => {
    if (tool === 'circle' || tool === 'rectangle' || tool === 'line') {
      setActiveTool(tool);
      onCreateMark(tool);
    } else {
      setActiveTool(tool);
    }
  };

  // Camera button: open native camera, capture photo + GPS, save to the project.
  const handleGeoPhoto = async () => {
    let image;
    try {
      image = await CapCamera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        // Prompt lets the user choose: take a new photo OR pick from the gallery.
        source: CameraSource.Prompt,
        promptLabelHeader: 'Add Photo',
        promptLabelPhoto: 'Choose from gallery',
        promptLabelPicture: 'Take a photo',
      });
    } catch (err: any) {
      // User cancelled the camera — do nothing.
      if (!/cancel/i.test(err?.message || '')) {
        setToast('Could not open the camera.');
        setTimeout(() => setToast(null), 4000);
      }
      return;
    }

    if (!image?.webPath) return;

    setBusy(true);
    try {
      setStatus('Reading photo…');
      const blob = await fetch(image.webPath).then((r) => r.blob());

      // GPS is best-effort: don't block the upload if location is unavailable.
      setStatus('Getting location…');
      let coords: { lat: number; lng: number; accuracy?: number } | null = null;
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0,
          })
        );
        coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
      } catch {
        coords = null; // proceed without location
      }

      setStatus('Uploading photo…');
      const file = new File([blob], `photo_${Date.now()}.jpg`, {
        type: blob.type || 'image/jpeg',
      });

      const result = await saveGeoPhoto({
        projectId,
        project,
        drawingId,
        photo: file,
        lat: coords?.lat,
        lng: coords?.lng,
        accuracy: coords?.accuracy,
        createdBy: user?.uid || 'guest',
        createdByName:
          localStorage.getItem('custom_display_name') || user?.displayName || undefined,
        shareToken,
      });

      setMarks(await getMarks(projectId, drawingId));
      setToast(
        result.savedAs === 'mapPoint'
          ? 'Photo saved to the site map.'
          : coords
          ? 'Photo added to the drawing.'
          : 'Photo uploaded (no GPS available).'
      );
    } catch (err: any) {
      console.error('Photo upload failed:', err);
      setToast(err?.message || 'Failed to save photo. Please try again.');
    } finally {
      setBusy(false);
      setStatus('');
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
        >
          <ChevronLeft className="h-5 w-5" />
          <div>
            <div className="text-xs text-slate-400">Back</div>
            <div className="text-sm font-semibold text-white">{drawing.fileName}</div>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {!shareToken && (
            <button
              onClick={() => setShowShare(true)}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
              title="Share project"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
          )}
          <button
            onClick={onShowMarksList}
            className="text-xs font-semibold px-3 py-1.5 bg-slate-800 text-slate-300 rounded"
          >
            {marks.length} marks
          </button>
        </div>
      </div>

      {showShare && (
        <MobileShareProject
          projectId={projectId}
          adminUid={user?.uid || ''}
          projectName={project?.projectName}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Drawing Canvas */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-800 to-black relative overflow-hidden">
        {loading ? (
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        ) : (
          <>
            <img
              src={drawing.url}
              alt={drawing.fileName}
              className="w-full h-full object-contain"
            />
            {/* Mark overlays would go here */}
          </>
        )}

        {/* Floating Toolbar */}
        {canEdit && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/40 backdrop-blur-md rounded-lg p-2 flex gap-2 border border-white/10">
            <button
              onClick={() => handleToolClick('circle')}
              className={`p-3 rounded transition-all ${
                activeTool === 'circle'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title="Circle"
            >
              <Circle className="h-5 w-5" />
            </button>
            <button
              onClick={() => handleToolClick('rectangle')}
              className={`p-3 rounded transition-all ${
                activeTool === 'rectangle'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title="Rectangle"
            >
              <Square className="h-5 w-5" />
            </button>
            <button
              onClick={() => handleToolClick('line')}
              className={`p-3 rounded transition-all ${
                activeTool === 'line'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title="Line"
            >
              <Minus className="h-5 w-5" />
            </button>

            <button
              onClick={onGPSCapture}
              className="p-3 rounded bg-white/10 text-white hover:bg-white/20 transition-all"
              title="Get Location"
            >
              <MapPin className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Prominent Add Photo button (primary action) */}
        {canEdit && (
          <button
            onClick={handleGeoPhoto}
            disabled={busy}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-full shadow-lg active:scale-95 transition-all"
          >
            <Camera className="h-5 w-5" />
            Add Photo
          </button>
        )}

        {/* Busy overlay while capturing/saving a geo-photo */}
        {busy && (
          <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
            <span className="text-sm font-semibold text-white">{status || 'Working…'}</span>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 max-w-[85%] bg-slate-900/95 border border-white/10 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{toast}</span>
          </div>
        )}
      </div>
    </div>
  );
};
