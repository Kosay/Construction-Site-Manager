import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Plus, Trash2, AlertCircle, Check, Loader2, ZoomIn, ZoomOut, Maximize2, Hand, MousePointer } from 'lucide-react';
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

  // Zoom and Pan States
  const [zoomScale, setZoomScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [toolMode, setToolMode] = useState<'select' | 'pan'>('select');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  const validation = validateCalibrationPoints(points);
  const requiredAccuracy = points.length > 0 ? estimateRequiredAccuracy(points) : 10;

  const activeToolMode = spacePressed ? 'pan' : toolMode;

  // Spacebar mode toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Handle drawing click to set drawing coordinates
  const handleDrawingClick = (e: React.MouseEvent<HTMLDivElement>) => {
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

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeToolMode === 'pan' || e.button === 1 || e.button === 2) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Touch pan handlers (for mobile/tablet)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      if (activeToolMode === 'pan') {
        setIsDragging(true);
        const touch = e.touches[0];
        setDragStart({ x: touch.clientX - panOffset.x, y: touch.clientY - panOffset.y });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setPanOffset({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.15 : 0.85;
      setZoomScale(prev => Math.max(0.5, Math.min(4.0, prev * factor)));
    }
  };

  // Request device GPS location
  const handleRequestGps = async (index: number) => {
    setGpsLoading(true);
    const pointId = points[index]?.id;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      setPoints(currentPoints => {
        const updatedPoints = [...currentPoints];
        const pointIndex = updatedPoints.findIndex(p => p.id === pointId);
        if (pointIndex !== -1) {
          updatedPoints[pointIndex] = {
            ...updatedPoints[pointIndex],
            gpsLat: position.coords.latitude,
            gpsLng: position.coords.longitude
          };
          setActivePointIndex(pointIndex);
        }
        return updatedPoints;
      });
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
    if (activePointIndex === index) {
      setActivePointIndex(null);
    } else if (activePointIndex !== null && activePointIndex > index) {
      setActivePointIndex(activePointIndex - 1);
    } else if (activePointIndex !== null && activePointIndex >= updatedPoints.length) {
      setActivePointIndex(null);
    }
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
            <div className="flex flex-col gap-3 min-w-0 h-full">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Click on drawing to set coordinates
              </h3>
              <div className="flex-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden relative flex flex-col min-h-[350px]">
                {/* Floating Toolbar inside Drawing Panel */}
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-1.5 rounded-xl shadow-lg">
                  {/* Tool Mode Selectors */}
                  <button
                    type="button"
                    onClick={() => setToolMode('select')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeToolMode === 'select'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title="Select Point Tool (Crosshair)"
                  >
                    <MousePointer className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setToolMode('pan')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeToolMode === 'pan'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title="Pan/Drag Tool (Hand) [Hold Spacebar]"
                  >
                    <Hand className="h-4 w-4" />
                  </button>

                  <span className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

                  {/* Zoom Buttons */}
                  <button
                    type="button"
                    onClick={() => setZoomScale(prev => Math.max(0.5, prev - 0.25))}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 min-w-[36px] text-center">
                    {Math.round(zoomScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomScale(prev => Math.min(4.0, prev + 0.25))}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>

                  <span className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setZoomScale(1.0);
                      setPanOffset({ x: 0, y: 0 });
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Reset View"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Micro Help Text Overlay */}
                <div className="absolute bottom-3 left-3 z-10 text-[9px] bg-slate-900/85 backdrop-blur-md text-slate-300 px-2 py-1 rounded-lg border border-slate-800 pointer-events-none select-none font-medium flex items-center gap-1.5 shadow-md max-w-[85%]">
                  <span>💡</span>
                  <span className="truncate">
                    {activeToolMode === 'select' 
                      ? 'Click on blueprint to place active point. Hold SPACEBAR to drag.' 
                      : 'Click and drag to pan blueprint. Release SPACEBAR to select points.'}
                  </span>
                </div>

                {/* Drawing Viewport */}
                <div
                  ref={containerRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onWheel={handleWheel}
                  className={`flex-1 overflow-hidden flex items-center justify-center relative bg-slate-50 dark:bg-slate-950 ${
                    activeToolMode === 'pan' 
                      ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') 
                      : 'cursor-crosshair'
                  }`}
                >
                  <div
                    className="relative transition-transform duration-100 ease-out select-none"
                    style={{
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                      transformOrigin: 'center center',
                    }}
                    onClick={(e) => {
                      if (activeToolMode === 'select') {
                        handleDrawingClick(e);
                      }
                    }}
                  >
                    <img
                      ref={imageRef}
                      src={drawingUrl}
                      alt="Drawing"
                      className="max-h-[50vh] w-auto block object-contain pointer-events-none"
                    />

                    {/* Overlay points on drawing */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none select-none">
                      {points.map((point, idx) => (
                        <g key={idx}>
                          <circle
                            cx={`${point.drawingX}%`}
                            cy={`${point.drawingY}%`}
                            r={activePointIndex === idx ? '8' : '6'}
                            className={`transition-all duration-200 ${
                              activePointIndex === idx 
                                ? 'fill-blue-500 stroke-white stroke-[2]' 
                                : 'fill-red-500 stroke-white stroke-[1.5]'
                            }`}
                            opacity="0.9"
                          />
                          <text
                            x={`${point.drawingX}%`}
                            y={`${point.drawingY}%`}
                            dy="0.3em"
                            textAnchor="middle"
                            fill="white"
                            fontSize="9"
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
