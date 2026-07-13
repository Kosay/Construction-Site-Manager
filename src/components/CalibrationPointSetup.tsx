import React, { useState, useRef } from 'react';
import { MapPin, Plus, Trash2, AlertCircle, Check, Loader2 } from 'lucide-react';
import { CalibrationPoint } from '../types';
import { validateCalibrationPoints, estimateRequiredAccuracy } from '../lib/coordinateTransform';

interface CalibrationPointSetupProps {
  drawingUrl: string;
  onCalibrationComplete: (points: CalibrationPoint[]) => void;
  onCancel: () => void;
  initialPoints?: CalibrationPoint[];
}

export const CalibrationPointSetup: React.FC<CalibrationPointSetupProps> = ({
  drawingUrl,
  onCalibrationComplete,
  onCancel,
  initialPoints = []
}) => {
  const [points, setPoints] = useState<CalibrationPoint[]>(initialPoints);
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [useDeviceGps, setUseDeviceGps] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const validation = validateCalibrationPoints(points);
  const requiredAccuracy = points.length > 0 ? estimateRequiredAccuracy(points) : 10;

  // Handle drawing click to set drawing coordinates
  const handleDrawingClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activePointIndex === null || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const updatedPoints = [...points];
    updatedPoints[activePointIndex] = {
      ...updatedPoints[activePointIndex],
      drawingX: Math.max(0, Math.min(100, x)),
      drawingY: Math.max(0, Math.min(100, y))
    };
    setPoints(updatedPoints);
  };

  // Request device GPS location
  const handleRequestGps = async (index: number) => {
    setGpsLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const updatedPoints = [...points];
      updatedPoints[index] = {
        ...updatedPoints[index],
        gpsLat: position.coords.latitude,
        gpsLng: position.coords.longitude
      };
      setPoints(updatedPoints);
      setActivePointIndex(index);
    } catch (err) {
      alert(`GPS Error: ${err instanceof Error ? err.message : 'Unable to get location'}`);
    } finally {
      setGpsLoading(false);
    }
  };

  // Add new calibration point
  const handleAddPoint = () => {
    const newPoint: CalibrationPoint = {
      id: `point_${Date.now()}`,
      name: `Point ${points.length + 1}`,
      gpsLat: 0,
      gpsLng: 0,
      drawingX: 50,
      drawingY: 50
    };
    setPoints([...points, newPoint]);
    setActivePointIndex(points.length);
  };

  // Remove calibration point
  const handleRemovePoint = (index: number) => {
    const updatedPoints = points.filter((_, i) => i !== index);
    setPoints(updatedPoints);
    if (activePointIndex === index) setActivePointIndex(null);
  };

  // Update point name
  const handlePointNameChange = (index: number, name: string) => {
    const updatedPoints = [...points];
    updatedPoints[index].name = name;
    setPoints(updatedPoints);
  };

  // Update GPS coordinates manually
  const handleGpsChange = (index: number, field: 'gpsLat' | 'gpsLng', value: string) => {
    const num = parseFloat(value) || 0;
    const updatedPoints = [...points];
    updatedPoints[index][field] = num;
    setPoints(updatedPoints);
  };

  // Update drawing coordinates manually
  const handleDrawingChange = (index: number, field: 'drawingX' | 'drawingY', value: string) => {
    const num = Math.max(0, Math.min(100, parseFloat(value) || 0));
    const updatedPoints = [...points];
    updatedPoints[index][field] = num;
    setPoints(updatedPoints);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">GPS Calibration Setup</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Set 3 points: GPS coordinates → Drawing location
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 p-6 min-h-0">

            {/* Drawing Preview - Left Side */}
            <div className="flex flex-col gap-3 min-w-0">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Click on drawing to set coordinates
              </h3>
              <div
                ref={containerRef}
                className="flex-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 overflow-auto relative"
              >
                <img
                  ref={imageRef}
                  src={drawingUrl}
                  alt="Drawing"
                  className="w-auto h-auto object-contain cursor-crosshair"
                  onClick={handleDrawingClick}
                />

                {/* Overlay points on drawing */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {points.map((point, idx) => (
                    <g key={idx}>
                      <circle
                        cx={`${point.drawingX}%`}
                        cy={`${point.drawingY}%`}
                        r="8"
                        fill={activePointIndex === idx ? '#3b82f6' : '#ef4444'}
                        opacity="0.8"
                      />
                      <circle
                        cx={`${point.drawingX}%`}
                        cy={`${point.drawingY}%`}
                        r="8"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                      />
                      <text
                        x={`${point.drawingX}%`}
                        y={`${point.drawingY}%`}
                        dy="0.3em"
                        textAnchor="middle"
                        fill="white"
                        fontSize="10"
                        fontWeight="bold"
                        pointerEvents="none"
                      >
                        {idx + 1}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Configuration Panel - Right Side */}
            <div className="flex flex-col gap-3 overflow-y-auto">
              <div className="space-y-3">
                {/* Validation Status */}
                {!validation.valid && points.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-amber-700 dark:text-amber-300">{validation.error}</span>
                  </div>
                )}

                {validation.valid && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-lg flex items-start gap-2">
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-emerald-700 dark:text-emerald-300">
                      Calibration valid • Required GPS accuracy: ±{requiredAccuracy.toFixed(0)}m
                    </span>
                  </div>
                )}

                {/* Calibration Points */}
                <div className="space-y-2">
                  {points.map((point, idx) => (
                    <div
                      key={point.id}
                      onClick={() => setActivePointIndex(idx)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        activePointIndex === idx
                          ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <input
                          type="text"
                          value={point.name}
                          onChange={(e) => handlePointNameChange(idx, e.target.value)}
                          className="text-xs font-bold bg-transparent text-slate-900 dark:text-slate-100 w-full"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePoint(idx);
                          }}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        {/* GPS Coordinates */}
                        <div>
                          <label className="text-slate-500 dark:text-slate-400 font-bold">GPS Lat</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={point.gpsLat}
                            onChange={(e) => handleGpsChange(idx, 'gpsLat', e.target.value)}
                            className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 dark:text-slate-400 font-bold">GPS Lng</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={point.gpsLng}
                            onChange={(e) => handleGpsChange(idx, 'gpsLng', e.target.value)}
                            className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        {/* Drawing Coordinates */}
                        <div>
                          <label className="text-slate-500 dark:text-slate-400 font-bold">Draw X %</label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={point.drawingX.toFixed(1)}
                            onChange={(e) => handleDrawingChange(idx, 'drawingX', e.target.value)}
                            className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 dark:text-slate-400 font-bold">Draw Y %</label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={point.drawingY.toFixed(1)}
                            onChange={(e) => handleDrawingChange(idx, 'drawingY', e.target.value)}
                            className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-900 dark:text-slate-100"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      {/* GPS Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestGps(idx);
                        }}
                        disabled={gpsLoading}
                        className="w-full mt-2 px-2 py-1 text-[10px] font-bold bg-blue-500 hover:bg-blue-600 text-white rounded transition flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {gpsLoading ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Getting GPS...
                          </>
                        ) : (
                          <>
                            <MapPin className="h-3 w-3" />
                            Get GPS Location
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Point Button */}
                {points.length < 3 && (
                  <button
                    onClick={handleAddPoint}
                    className="w-full px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Calibration Point ({points.length}/3)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onCalibrationComplete(points)}
            disabled={!validation.valid}
            className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Save Calibration
          </button>
        </div>
      </div>
    </div>
  );
};
