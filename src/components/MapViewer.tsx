import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, KmlLayer, InfoWindow } from '@react-google-maps/api';
import { MapPin, Plus, MousePointer, Loader2, AlertTriangle, Crosshair, X, Check, Layers } from 'lucide-react';
import { MapPoint } from '../types';
import { addMapPoint, getMapPoints } from '../lib/firestore';
import { MapPointModal } from './MapPointModal';
import { useAuth } from '../lib/authContext';

interface MapViewerProps {
  projectId: string;
  kmlUrl?: string;
  kmlFileName?: string;
  canEdit: boolean;
  shareToken?: string;
}

const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  process.env.VITE_GOOGLE_MAPS_API_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const CATEGORY_COLORS: Record<string, string> = {
  safety: '#f43f5e',
  measurement: '#0ea5e9',
  defect: '#f59e0b',
  progress: '#10b981',
  quality: '#a855f7',
  other: '#6366f1',
  general: '#64748b',
};

type CategoryType = NonNullable<MapPoint['category']>;
const CATEGORIES: CategoryType[] = ['safety', 'measurement', 'defect', 'general', 'progress', 'quality', 'other'];

export const MapViewer: React.FC<MapViewerProps> = ({ projectId, kmlUrl, kmlFileName, canEdit, shareToken }) => {
  const { user } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);

  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MapPoint | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Pending new-point placement
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState<CategoryType>('general');
  const [creating, setCreating] = useState(false);

  const loadPoints = useCallback(async () => {
    try {
      const data = await getMapPoints(projectId);
      setPoints(data);
    } catch (err) {
      console.error('Failed to load map points:', err);
    }
  }, [projectId]);

  // Initialize map and load points
  useEffect(() => {
    setLoading(true);
    loadPoints();
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Map click handler for adding points
  useEffect(() => {
    if (!map || !addMode || !canEdit) return;

    const handleClick = (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      setPendingLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      setNewLabel('');
      setNewCategory('general');
    };

    map.addListener('click', handleClick);
    if (mapContainerRef.current) {
      mapContainerRef.current.style.cursor = 'crosshair';
    }

    return () => {
      google.maps.event.removeListener;
    };
  }, [map, addMode, canEdit]);


  const handleCreatePoint = async () => {
    if (!pendingLatLng) return;
    setCreating(true);
    try {
      const name = localStorage.getItem('custom_display_name') || user?.displayName || undefined;
      await addMapPoint(
        projectId,
        {
          lat: pendingLatLng.lat,
          lng: pendingLatLng.lng,
          label: newLabel.trim() || 'New Observation',
          category: newCategory,
          createdBy: user?.uid || 'guest',
          ...(name ? { createdByName: name } : {}),
          evidencePhotos: [],
        },
        shareToken
      );
      setPendingLatLng(null);
      setAddMode(false);
      await loadPoints();
    } catch (err) {
      console.error(err);
      alert('Failed to create point. Check permissions.');
    } finally {
      setCreating(false);
    }
  };

  const mapStyles = [
    {
      featureType: 'all',
      stylers: [{ saturation: -100 }, { lightness: 15 }],
    },
  ];

  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_API_KEY' || GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key_here') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-6">
        <div className="text-center max-w-md bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
            <Layers className="h-6 w-6 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Google Maps API Key Required</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            A Google Maps API Key is required to visualize the site map, KML layers, and coordinate mark points on Google Maps.
          </p>
          
          <div className="text-left space-y-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850 text-xs">
            <p className="font-semibold text-slate-800 dark:text-slate-200">Easy Setup Steps:</p>
            <ol className="list-decimal list-inside space-y-2 text-slate-600 dark:text-slate-400">
              <li>
                <a 
                  href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  Get an API Key from Google Cloud
                </a>
              </li>
              <li>
                When the <span className="font-semibold text-slate-800 dark:text-slate-200">"Enter your environment variable"</span> popup appears, paste your API key and press <kbd className="bg-slate-200 dark:bg-slate-800 px-1 border border-slate-300 dark:border-slate-750 rounded text-[10px]">Enter</kbd>.
              </li>
              <li>
                Or manually: Open <span className="font-semibold text-slate-800 dark:text-slate-200">Settings</span> (⚙️ gear icon, top-right) → <span className="font-semibold text-slate-800 dark:text-slate-200">Secrets</span> → add <code className="bg-slate-200 dark:bg-slate-850 px-1 py-0.5 rounded text-red-500 font-mono">GOOGLE_MAPS_PLATFORM_KEY</code> → paste value.
              </li>
            </ol>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            The app automatically rebuilds and loads when the key is added. No manual reload needed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <div className="w-full h-full flex flex-col relative bg-slate-100 dark:bg-slate-950">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-[500]">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Layers className="h-3.5 w-3.5 text-blue-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
              {kmlFileName || 'Site Map'}
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>{points.length} point{points.length !== 1 ? 's' : ''}</span>
          </div>

          {canEdit && (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setAddMode(false)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  !addMode ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <MousePointer className="h-3.5 w-3.5" /> Select
              </button>
              <button
                onClick={() => setAddMode(true)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  addMode ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Plus className="h-3.5 w-3.5" /> Add Point
              </button>
            </div>
          )}
        </div>

        {addMode && canEdit && !pendingLatLng && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[500] bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg flex items-center gap-2 animate-pulse">
            <Crosshair className="h-3.5 w-3.5" /> Click anywhere on the map to drop a point
          </div>
        )}

        {/* Map */}
        <div className="flex-1 relative min-h-[300px]">
          <GoogleMap
            mapContainerClassName="absolute inset-0"
            center={{ lat: 25.2048, lng: 55.2708 }}
            zoom={12}
            onLoad={setMap}
            options={{
              styles: mapStyles,
              fullscreenControl: false,
            }}
          >
            {/* KML Layer */}
            {kmlUrl && <KmlLayer url={kmlUrl} />}

            {/* Markers */}
            {points.map((point) => {
              const color = CATEGORY_COLORS[point.category || 'general'] || CATEGORY_COLORS.general;
              const hasPhotos = (point.evidencePhotos?.length || 0) > 0;
              return (
                <Marker
                  key={point.id}
                  position={{ lat: point.lat, lng: point.lng }}
                  onClick={() => setSelectedMarker(point)}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: color,
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                  }}
                >
                  {selectedMarker?.id === point.id && (
                    <InfoWindow onCloseClick={() => setSelectedMarker(null)}>
                      <div className="p-2 text-xs">
                        <p className="font-semibold text-slate-900">{point.label}</p>
                        <p className="text-slate-600 text-[10px] mt-1">
                          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                        </p>
                      </div>
                    </InfoWindow>
                  )}
                </Marker>
              );
            })}
          </GoogleMap>

          {loading && (
            <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center bg-slate-100/80 dark:bg-slate-950/80">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Loading site map...</span>
            </div>
          )}

          {error && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] max-w-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 px-3 py-2 rounded-lg text-[11px] flex items-start gap-2 shadow-lg">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-1 text-amber-500 hover:text-amber-700 cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* New point creation dialog */}
        {pendingLatLng && (
          <div className="absolute inset-0 z-[600] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPendingLatLng(null)}>
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">New Map Point</h3>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {pendingLatLng.lat.toFixed(5)}, {pendingLatLng.lng.toFixed(5)}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Label</label>
                <input
                  autoFocus
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Cracked column at Gridline C4"
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Category</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setNewCategory(cat)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize transition cursor-pointer border ${
                        newCategory === cat
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setPendingLatLng(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePoint}
                  disabled={creating}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Create Point
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedMarker && (
          <MapPointModal
            projectId={projectId}
            point={selectedMarker}
            canEdit={canEdit}
            shareToken={shareToken}
            onClose={() => {
              setSelectedMarker(null);
              setSelectedPoint(null);
            }}
            onUpdate={loadPoints}
          />
        )}
      </div>
    </LoadScript>
  );
};