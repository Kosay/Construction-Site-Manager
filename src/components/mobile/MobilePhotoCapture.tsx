import React, { useState } from 'react';
import { Camera as CameraIcon, ChevronLeft, Loader2 } from 'lucide-react';
import { Camera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';

interface MobilePhotoCaptureProps {
  onPhotoCapture: (photoUrl: string) => void;
  onBack: () => void;
}

export const MobilePhotoCapture: React.FC<MobilePhotoCaptureProps> = ({
  onPhotoCapture,
  onBack,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capturePhoto = async () => {
    try {
      setLoading(true);
      setError(null);

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      });

      if (image.webPath) {
        onPhotoCapture(image.webPath);
      }
    } catch (err) {
      console.error('Photo capture failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to capture photo');
    } finally {
      setLoading(false);
    }
  };

  const pickFromGallery = async () => {
    try {
      setLoading(true);
      setError(null);

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
      });

      if (image.webPath) {
        onPhotoCapture(image.webPath);
      }
    } catch (err) {
      console.error('Photo selection failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to select photo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
        <div className="text-center">
          <CameraIcon className="h-16 w-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Take Evidence Photo</h2>
          <p className="text-sm text-slate-400">Capture photo as evidence for your mark</p>
        </div>

        {error && (
          <div className="w-full p-3 bg-red-900/20 border border-red-700 text-red-300 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={capturePhoto}
            disabled={loading}
            className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Capturing...
              </>
            ) : (
              <>
                <CameraIcon className="h-5 w-5" />
                Open Camera
              </>
            )}
          </button>

          <button
            onClick={pickFromGallery}
            disabled={loading}
            className="w-full py-4 px-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading...
              </>
            ) : (
              <>Choose from Gallery</>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-500 text-center">
          Camera will open in full-screen mode. Take your photo and confirm to return.
        </p>
      </div>
    </div>
  );
};
