import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, AlertTriangle, UploadCloud } from 'lucide-react';

interface BrowserCameraViewfinderProps {
  onCapture: (file: File, previewUrl: string) => void;
  onCancel?: () => void;
  idealFacingMode?: 'environment' | 'user';
}

export const BrowserCameraViewfinder: React.FC<BrowserCameraViewfinderProps> = ({
  onCapture,
  onCancel,
  idealFacingMode = 'environment'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(idealFacingMode);
  const [loading, setLoading] = useState<boolean>(true);

  const startCamera = async (mode: 'environment' | 'user') => {
    setLoading(true);
    setError(null);

    // Clean up previous stream if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Failed to start camera with facingMode constraints, retrying with default video constraints:', err);
      try {
        // Fallback to basic video stream
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (fallbackErr: any) {
        console.error('Camera access completely failed:', fallbackErr);
        setError(
          fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError'
            ? 'Camera access permission denied. Please enable camera permissions in your browser settings.'
            : `Could not access camera: ${fallbackErr.message || 'Unknown camera error'}`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startCamera(facingMode);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !stream) return;

    try {
      const canvas = document.createElement('canvas');
      // Use video element's natural width/height for maximum resolution
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Could not initialize canvas context for photo capture.');
        return;
      }

      // If user camera is front-facing, mirror the image snapshot for matching visual preview
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `site_observation_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const previewUrl = URL.createObjectURL(blob);
            onCapture(file, previewUrl);

            // Clean up the stream once photo is taken
            if (streamRef.current) {
              streamRef.current.getTracks().forEach((track) => track.stop());
              streamRef.current = null;
              setStream(null);
            }
          } else {
            setError('Failed to generate image file from camera feed.');
          }
        },
        'image/jpeg',
        0.9 // Quality setting
      );
    } catch (err: any) {
      console.error('Error snapping photo:', err);
      setError(`Failed to capture photo frame: ${err.message || err}`);
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex flex-col items-center justify-center">
      {error ? (
        <div className="p-6 text-center text-slate-300 flex flex-col items-center justify-center min-h-[220px]">
          <AlertTriangle className="h-10 w-10 text-amber-500 mb-3 animate-bounce" />
          <p className="text-xs font-semibold text-slate-200 mb-1">Camera Integration Unreachable</p>
          <p className="text-[10px] text-slate-400 max-w-xs mb-3">{error}</p>
          <span className="text-[10px] text-slate-500 font-mono">
            Fallback: Use the standard file chooser below instead.
          </span>
        </div>
      ) : (
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-10">
              <RefreshCw className="h-6 w-6 animate-spin mb-2 text-blue-500" />
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400">
                Initializing camera feed...
              </span>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />

          {/* Viewfinder Overlay Indicators */}
          <div className="absolute inset-4 border border-white/20 rounded pointer-events-none flex flex-col justify-between p-2">
            <div className="flex justify-between">
              <div className="w-4 h-4 border-t border-l border-white/60" />
              <div className="w-4 h-4 border-t border-r border-white/60" />
            </div>
            <div className="flex justify-between">
              <div className="w-4 h-4 border-b border-l border-white/60" />
              <div className="w-4 h-4 border-b border-r border-white/60" />
            </div>
          </div>

          {/* Camera Controls Bar */}
          {!loading && stream && (
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4 px-4 z-20">
              <button
                type="button"
                onClick={toggleFacingMode}
                className="p-2.5 bg-slate-900/80 hover:bg-slate-800 backdrop-blur text-white rounded-full border border-slate-700/60 shadow transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                title="Switch Camera"
              >
                <RefreshCw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={handleCapture}
                className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg ring-4 ring-white/30 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
                title="Snap Photo"
              >
                <Camera className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
