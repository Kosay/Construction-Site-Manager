import React, { useState, useEffect } from 'react';
import { MapPin, ChevronLeft, Loader2, AlertCircle, Check } from 'lucide-react';

interface MobileGPSScreenProps {
  onLocationCapture: (lat: number, lng: number, accuracy: number) => void;
  onBack: () => void;
}

interface GPSCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

export const MobileGPSScreen: React.FC<MobileGPSScreenProps> = ({
  onLocationCapture,
  onBack,
}) => {
  const [coords, setCoords] = useState<GPSCoords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      setCoords({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    } catch (err) {
      console.error('Geolocation error:', err);
      if (err instanceof GeolocationPositionError) {
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setError('Location permission denied. Enable in settings.');
        } else if (err.code === GeolocationPositionError.TIMEOUT) {
          setError('Location request timed out. Try again.');
        } else {
          setError('Unable to get location. Try again.');
        }
      } else {
        setError('Failed to get location');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUseLocation = () => {
    if (coords) {
      onLocationCapture(coords.lat, coords.lng, coords.accuracy);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          <ChevronLeft className="h-5 w-5" />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-center">
          <MapPin className="h-16 w-16 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Get Location
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Capture GPS coordinates for this mark
          </p>
        </div>

        {error && (
          <div className="w-full p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg flex gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {coords ? (
          <div className="w-full space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="h-5 w-5" />
                <span className="font-semibold text-sm">Location Acquired</span>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Latitude</span>
                  <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 text-base">
                    {coords.lat.toFixed(6)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Longitude</span>
                  <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 text-base">
                    {coords.lng.toFixed(6)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Accuracy</span>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    ±{coords.accuracy.toFixed(1)}m
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleUseLocation}
              className="w-full py-4 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all active:scale-95"
            >
              Use This Location
            </button>
          </div>
        ) : (
          <button
            onClick={requestLocation}
            disabled={loading}
            className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Getting Location...
              </>
            ) : (
              <>
                <MapPin className="h-5 w-5" />
                Request Location
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
