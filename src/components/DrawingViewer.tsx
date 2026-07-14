import React, { useState, useRef, useEffect } from 'react';
import { MousePointer, Circle, Square, Minus, MessageSquare, Plus, Check, X, ShieldAlert, Loader2, Search, Filter, User, Layers, Eye, EyeOff, ZoomIn, ZoomOut, Maximize2, Expand, Shrink, MapPin, Camera, Trash2 } from 'lucide-react';
import { Mark, MarkCoordinates, CalibrationPoint, Project } from '../types';
import { addMark, getProject } from '../lib/firestore';
import { uploadFile } from '../lib/storage';
import { MarkDetailsModal } from './MarkDetailsModal';
import { useAuth } from '../lib/authContext';
import { calculateTransformMatrix, gpsToDrawingCoordinates } from '../lib/coordinateTransform';

interface DrawingViewerProps {
  projectId: string;
  drawingId: string;
  drawingUrl: string;
  drawingName: string;
  marks: Mark[];
  onUpdate: () => void;
  canEdit: boolean;
  shareToken?: string;
}

type ToolType = 'select' | 'circle' | 'rectangle' | 'line';

export const DrawingViewer: React.FC<DrawingViewerProps> = ({
  projectId,
  drawingId,
  drawingUrl,
  drawingName,
  marks,
  onUpdate,
  canEdit,
  shareToken
}) => {
  const { user } = useAuth();
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [selectedMark, setSelectedMark] = useState<Mark | null>(null);
  const [firstPoint, setFirstPoint] = useState<{ x: number; y: number } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Dialog state for new mark creation
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newMarkCoords, setNewMarkCoords] = useState<MarkCoordinates | null>(null);
  const [newMarkType, setNewMarkType] = useState<'circle' | 'rectangle' | 'line'>('circle');
  const [newMarkLabel, setNewMarkLabel] = useState('');
  const [newMarkCategory, setNewMarkCategory] = useState<'safety' | 'measurement' | 'defect' | 'general' | 'progress' | 'quality' | 'other'>('general');
  const [creating, setCreating] = useState(false);

  // GPS Camera capture workflow states
  const [showGpsCameraModal, setShowGpsCameraModal] = useState(false);
  const [gpsLoadingMessage, setGpsLoadingMessage] = useState<string | null>(null);
  const [gpsCalculatedCoords, setGpsCalculatedCoords] = useState<{ x: number; y: number; lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsPhotoFile, setGpsPhotoFile] = useState<File | null>(null);
  const [gpsPhotoPreviewUrl, setGpsPhotoPreviewUrl] = useState<string | null>(null);
  const [gpsPhotoLabel, setGpsPhotoLabel] = useState('');
  const [gpsPhotoCategory, setGpsPhotoCategory] = useState<'safety' | 'measurement' | 'defect' | 'general' | 'progress' | 'quality' | 'other'>('safety');
  const [gpsUploading, setGpsUploading] = useState(false);

  // Sidebar, search, and filtering states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCreator, setFilterCreator] = useState<string>('all');
  const [filterCategories, setFilterCategories] = useState<string[]>(['safety', 'measurement', 'defect', 'general', 'progress', 'quality', 'other']);
  const [hideFilteredOnCanvas, setHideFilteredOnCanvas] = useState(false);

  // Zoom State
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  // Full-page display mode state
  const [isFullPage, setIsFullPage] = useState(false);

  // Project and GPS state
  const [project, setProject] = useState<Project | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  // Load project data on mount
  useEffect(() => {
    const loadProject = async () => {
      try {
        const proj = await getProject(projectId);
        setProject(proj);
      } catch (err) {
        console.error('Failed to load project:', err);
      }
    };
    loadProject();
  }, [projectId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullPage) {
        setIsFullPage(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullPage]);

  // Extract unique creators for filtering options, mapping IDs to names
  const uniqueCreatorsMap = new Map<string, string>();
  marks.forEach(m => {
    if (m.createdBy) {
      const name = m.createdByName || (m.createdBy === 'admin' ? 'Project Owner' : m.createdBy);
      uniqueCreatorsMap.set(m.createdBy, name);
    }
  });
  const uniqueCreators = Array.from(uniqueCreatorsMap.entries()).map(([id, name]) => ({ id, name }));

  // Filter marks based on searchQuery, filterType, filterCreator, and filterCategories
  const filteredMarks = marks.filter(mark => {
    const labelMatch = mark.label.toLowerCase().includes(searchQuery.toLowerCase());
    const typeMatch = filterType === 'all' || mark.type === filterType;
    const creatorMatch = filterCreator === 'all' || mark.createdBy === filterCreator;
    const markCategory = mark.category || 'general';
    const categoryMatch = filterCategories.includes(markCategory);
    return labelMatch && typeMatch && creatorMatch && categoryMatch;
  });

  const getCategoryTheme = (category?: string) => {
    const cat = category || 'general';
    switch (cat) {
      case 'safety':
        return {
          bg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/20',
          dot: 'bg-rose-500',
          label: 'Safety Observation',
          pill: 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/20'
        };
      case 'measurement':
        return {
          bg: 'bg-sky-50 text-sky-600 dark:bg-sky-950/20 dark:text-sky-400 border border-sky-100 dark:border-sky-900/20',
          dot: 'bg-sky-500',
          label: 'Measurement',
          pill: 'bg-sky-50 text-sky-600 border border-sky-100 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/20'
        };
      case 'defect':
        return {
          bg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/20',
          dot: 'bg-amber-500',
          label: 'Defect / Issue',
          pill: 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/20'
        };
      case 'progress':
        return {
          bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20',
          dot: 'bg-emerald-500',
          label: 'Progress Tracking',
          pill: 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/20'
        };
      case 'quality':
        return {
          bg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-100 dark:border-purple-900/20',
          dot: 'bg-purple-500',
          label: 'Quality Control',
          pill: 'bg-purple-50 text-purple-600 border border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/20'
        };
      case 'other':
        return {
          bg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/20',
          dot: 'bg-indigo-500',
          label: 'Other / Note',
          pill: 'bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/20'
        };
      case 'general':
      default:
        return {
          bg: 'bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400 border border-slate-200 dark:border-slate-800',
          dot: 'bg-slate-400',
          label: 'General Note',
          pill: 'bg-slate-50 text-slate-600 border border-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
        };
    }
  };

  const getCategoryCanvasColor = (category?: string) => {
    const cat = category || 'general';
    switch (cat) {
      case 'safety':
        return {
          fill: 'fill-rose-500/15',
          hoverFill: 'group-hover:fill-rose-500/25',
          stroke: 'stroke-rose-500',
          dot: 'fill-rose-600',
          lineFg: 'stroke-rose-600',
          lineBg: 'stroke-rose-500/20'
        };
      case 'measurement':
        return {
          fill: 'fill-sky-500/15',
          hoverFill: 'group-hover:fill-sky-500/25',
          stroke: 'stroke-sky-500',
          dot: 'fill-sky-600',
          lineFg: 'stroke-sky-600',
          lineBg: 'stroke-sky-500/20'
        };
      case 'defect':
        return {
          fill: 'fill-amber-500/15',
          hoverFill: 'group-hover:fill-amber-500/25',
          stroke: 'stroke-amber-500',
          dot: 'fill-amber-600',
          lineFg: 'stroke-amber-600',
          lineBg: 'stroke-amber-500/20'
        };
      case 'progress':
        return {
          fill: 'fill-emerald-500/15',
          hoverFill: 'group-hover:fill-emerald-500/25',
          stroke: 'stroke-emerald-500',
          dot: 'fill-emerald-600',
          lineFg: 'stroke-emerald-600',
          lineBg: 'stroke-emerald-500/20'
        };
      case 'quality':
        return {
          fill: 'fill-purple-500/15',
          hoverFill: 'group-hover:fill-purple-500/25',
          stroke: 'stroke-purple-500',
          dot: 'fill-purple-600',
          lineFg: 'stroke-purple-600',
          lineBg: 'stroke-purple-500/20'
        };
      case 'other':
        return {
          fill: 'fill-indigo-500/15',
          hoverFill: 'group-hover:fill-indigo-500/25',
          stroke: 'stroke-indigo-500',
          dot: 'fill-indigo-600',
          lineFg: 'stroke-indigo-600',
          lineBg: 'stroke-indigo-500/20'
        };
      case 'general':
      default:
        return {
          fill: 'fill-slate-500/15',
          hoverFill: 'group-hover:fill-slate-500/25',
          stroke: 'stroke-slate-500',
          dot: 'fill-slate-600',
          lineFg: 'stroke-slate-600',
          lineBg: 'stroke-slate-500/20'
        };
    }
  };

  const getShapeIcon = (type: string, className = "h-4 w-4") => {
    switch (type) {
      case 'circle': return <Circle className={className} />;
      case 'rectangle': return <Square className={className} />;
      case 'line': return <Minus className={`${className} rotate-45`} />;
      default: return <MessageSquare className={className} />;
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // PDF Rendering Refs and States
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfRenderLoading, setPdfRenderLoading] = useState(false);
  const [pdfRenderError, setPdfRenderError] = useState<string | null>(null);

  const isPdf = drawingUrl.toLowerCase().includes('.pdf') || drawingName.toLowerCase().endsWith('.pdf') || drawingUrl.startsWith('data:application/pdf');

  useEffect(() => {
    if (!isPdf || !drawingUrl) return;

    let active = true;
    setPdfRenderLoading(true);
    setPdfRenderError(null);

    const renderPdf = async () => {
      try {
        let pdfjs = (window as any).pdfjsLib;
        if (!pdfjs) {
          // If library is still loading, wait a bit and retry
          for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 200));
            pdfjs = (window as any).pdfjsLib;
            if (pdfjs) break;
          }
        }

        if (!pdfjs) {
          throw new Error("PDF.js library failed to load. Please check your internet connection.");
        }

        // Load document with a highly robust strategy to bypass CORS and range request errors
        let loadingTask;
        try {
          const isExternalUrl = drawingUrl.startsWith('http://') || drawingUrl.startsWith('https://');
          const targetUrl = isExternalUrl 
            ? `/api/proxy-pdf?url=${encodeURIComponent(drawingUrl)}` 
            : drawingUrl;

          console.log("Attempting PDF fetch via proxy/CORS bypass:", targetUrl);
          const response = await fetch(targetUrl);
          if (!response.ok) {
            throw new Error(`HTTP fetch failed with status: ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        } catch (fetchErr: any) {
          console.warn("Direct PDF fetch failed, falling back to simple URL loading without range requests:", fetchErr);
          // Fall back to simple URL loading with range requests and streaming disabled
          loadingTask = pdfjs.getDocument({
            url: drawingUrl,
            disableRange: true,
            disableStream: true
          });
        }
        
        const pdf = await loadingTask.promise;
        
        if (!active) return;

        // Get first page
        const page = await pdf.getPage(1);
        if (!active) return;

        // Render to canvas
        const canvas = pdfCanvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Scale viewport to high quality for details
        const viewport = page.getViewport({ scale: 2.0 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        await page.render(renderContext).promise;
        
        if (active) {
          setPdfRenderLoading(false);
          // Trigger the onUpdate logic to handle marks coordinates
          onUpdate();
        }
      } catch (err: any) {
        console.error("Error rendering PDF blueprint:", err);
        if (active) {
          setPdfRenderError(err?.message || "Failed to render PDF page. Make sure the file is a valid PDF.");
          setPdfRenderLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      active = false;
    };
  }, [drawingUrl, isPdf]);

  // Reset drawing states when active tool changes
  useEffect(() => {
    setFirstPoint(null);
    setHoverPoint(null);
    setIsDrawing(false);
  }, [activeTool]);

  // Global mouse move and mouse up handlers to support drag drawing beautifully
  useEffect(() => {
    if (!isDrawing || !firstPoint || !containerRef.current) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Clamp coordinates to percentage [0, 100] so drawing doesn't leak out of the image bounds
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      setHoverPoint({ x, y });
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (!containerRef.current || !firstPoint) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      const startX = firstPoint.x;
      const startY = firstPoint.y;
      const endX = x;
      const endY = y;

      const dx = endX - startX;
      const dy = endY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      let coords: MarkCoordinates | null = null;

      if (activeTool === 'circle') {
        // Drag distance from center defines radius
        const radius = distance > 0.5 ? distance : 4;
        coords = { x: startX, y: startY, radius };
        setNewMarkType('circle');
      } else if (activeTool === 'rectangle') {
        // Simple click vs. Drag size
        if (distance <= 0.5) {
          coords = {
            x: Math.max(0, startX - 5),
            y: Math.max(0, startY - 5),
            width: 10,
            height: 10
          };
        } else {
          coords = {
            x: Math.min(startX, endX),
            y: Math.min(startY, endY),
            width: Math.abs(dx),
            height: Math.abs(dy)
          };
        }
        setNewMarkType('rectangle');
      } else if (activeTool === 'line') {
        if (distance <= 0.5) {
          coords = {
            x: Math.max(0, startX - 5),
            y: startY,
            x2: Math.min(100, startX + 5),
            y2: startY
          };
        } else {
          coords = {
            x: startX,
            y: startY,
            x2: endX,
            y2: endY
          };
        }
        setNewMarkType('line');
      }

      if (coords) {
        setNewMarkCoords(coords);
        setNewMarkLabel('');
        setShowCreateDialog(true);
      }

      setIsDrawing(false);
      setFirstPoint(null);
      setHoverPoint(null);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDrawing, firstPoint, activeTool]);

  // Handle mousedown on drawing image / overlay area to begin drag-and-draw
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canEdit || activeTool === 'select') return;
    if (!containerRef.current) return;

    // Only allow left mouse button clicks
    if (e.button !== 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setIsDrawing(true);
    setFirstPoint({ x, y });
    setHoverPoint({ x, y });
  };

  const handleCancelDrawing = () => {
    setFirstPoint(null);
    setHoverPoint(null);
    setActiveTool('select');
  };

  const handleSaveNewMark = async () => {
    if (!newMarkCoords || !newMarkLabel.trim()) return;
    setCreating(true);
    setGpsLoading(true);

    try {
      const authorUid = shareToken ? `anonymous_${shareToken.substring(0, 5)}` : (user?.uid || 'admin');
      const authorName = localStorage.getItem('custom_display_name') || user?.displayName || user?.email || (authorUid === 'admin' ? 'Project Owner' : authorUid);

      // Try to capture GPS coordinates on mobile
      let finalCoords = newMarkCoords;
      let metadata: any = {
        timestamp: new Date().toISOString(),
        deviceInfo: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      };

      try {
        if ('geolocation' in navigator) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0
            });
          });

          const { latitude, longitude, accuracy } = position.coords;
          metadata.gpsLat = latitude;
          metadata.gpsLng = longitude;
          metadata.gpsAccuracy = accuracy;
        }
      } catch (gpsErr) {
        // GPS capture failed, continue with manual coordinates
        console.debug('GPS capture failed:', gpsErr);
      }

      setGpsLoading(false);

      await addMark(projectId, drawingId, {
        type: newMarkType,
        coordinates: finalCoords,
        label: newMarkLabel.trim(),
        createdBy: authorUid,
        createdByName: authorName,
        category: newMarkCategory,
        metadata,
        evidencePhotos: []
      }, shareToken);

      onUpdate();
      setShowCreateDialog(false);
      setNewMarkCoords(null);
      setNewMarkLabel('');
      setNewMarkCategory('general');
      setGpsCoords(null);
      setActiveTool('select');
    } catch (error) {
      console.error('Failed to create mark:', error);
      alert('Error creating mark. Make sure link is valid.');
    } finally {
      setCreating(false);
      setGpsLoading(false);
    }
  };

  const handleGpsPhotoClick = () => {
    if (!project || !project.calibrationPoints || project.calibrationPoints.length < 3) {
      alert("This project has not been calibrated with 3 reference points. Please contact the project manager to set up 3-point calibration first.");
      return;
    }

    if (!('geolocation' in navigator)) {
      alert("Your browser/device does not support GPS Geolocation.");
      return;
    }

    setGpsLoadingMessage("Acquiring high-accuracy GPS coordinates...");
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log("GPS Location:", latitude, longitude, "Accuracy:", accuracy);

        try {
          const matrix = calculateTransformMatrix(project.calibrationPoints!);
          const drawingCoords = gpsToDrawingCoordinates(latitude, longitude, matrix);
          console.log("Mapped drawing coords:", drawingCoords);

          // Allow some margin, say [-20, 120]%, but notify if completely off site
          if (drawingCoords.x < -20 || drawingCoords.x > 120 || drawingCoords.y < -20 || drawingCoords.y > 120) {
            setGpsLoadingMessage(null);
            alert(`Your current GPS position (Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}) translates to coordinates (${drawingCoords.x.toFixed(1)}%, ${drawingCoords.y.toFixed(1)}%) which is far outside this blueprint. Please make sure you are standing on-site.`);
            return;
          }

          // Clamp to [0, 100] for safety
          const clampedX = Math.max(0, Math.min(100, drawingCoords.x));
          const clampedY = Math.max(0, Math.min(100, drawingCoords.y));

          setGpsCalculatedCoords({
            x: clampedX,
            y: clampedY,
            lat: latitude,
            lng: longitude,
            accuracy: accuracy
          });
          setGpsPhotoFile(null);
          setGpsPhotoPreviewUrl(null);
          setGpsPhotoLabel('');
          setGpsPhotoCategory('safety');
          setGpsLoadingMessage(null);
          setShowGpsCameraModal(true);
        } catch (err) {
          console.error("Coordinate mapping error:", err);
          setGpsLoadingMessage(null);
          alert("Error calculating location on blueprint. Please verify that calibration points are correct.");
        }
      },
      (error) => {
        setGpsLoadingMessage(null);
        let errorMsg = "Unable to fetch GPS position.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "GPS permission denied. Please allow location access in your device settings.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "GPS position unavailable. Make sure your location services are enabled.";
        } else if (error.code === error.TIMEOUT) {
          errorMsg = "GPS acquisition timed out. Try again in an open-sky area.";
        }
        alert(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleSaveGpsPhoto = async () => {
    if (!gpsCalculatedCoords || !gpsPhotoLabel.trim()) return;
    setGpsUploading(true);

    try {
      const authorUid = shareToken ? `anonymous_${shareToken.substring(0, 5)}` : (user?.uid || 'admin');
      const authorName = localStorage.getItem('custom_display_name') || user?.displayName || user?.email || (authorUid === 'admin' ? 'Project Owner' : authorUid);

      const tempMarkId = Math.random().toString(36).substring(2, 11);

      // 1. Upload photo if selected
      const evidencePhotos = [];
      if (gpsPhotoFile) {
        const fileExtension = gpsPhotoFile.name.split('.').pop() || 'jpg';
        const photoPath = `projects/${projectId}/drawings/${drawingId}/marks/${tempMarkId}/evidence/${Date.now()}.${fileExtension}`;
        const downloadUrl = await uploadFile(photoPath, gpsPhotoFile);
        evidencePhotos.push({
          photoId: Math.random().toString(36).substring(2, 11),
          url: downloadUrl,
          uploadedAt: new Date().toISOString()
        });
      }

      // 2. Prepare metadata with exact current time
      const metadata = {
        timestamp: new Date().toISOString(),
        gpsLat: gpsCalculatedCoords.lat,
        gpsLng: gpsCalculatedCoords.lng,
        gpsAccuracy: gpsCalculatedCoords.accuracy,
        deviceInfo: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'Android/Mobile' : 'Desktop'
      };

      // 3. Save mark to Firestore
      await addMark(projectId, drawingId, {
        type: 'circle',
        coordinates: {
          x: gpsCalculatedCoords.x,
          y: gpsCalculatedCoords.y,
          radius: 4
        },
        label: gpsPhotoLabel.trim(),
        createdBy: authorUid,
        createdByName: authorName,
        category: gpsPhotoCategory,
        metadata,
        evidencePhotos
      }, shareToken);

      // Refresh
      onUpdate();
      setShowGpsCameraModal(false);
      setGpsCalculatedCoords(null);
      setGpsPhotoFile(null);
      if (gpsPhotoPreviewUrl) URL.revokeObjectURL(gpsPhotoPreviewUrl);
      setGpsPhotoPreviewUrl(null);
    } catch (err) {
      console.error("Failed to save GPS photo mark:", err);
      alert("Failed to save GPS photo mark: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setGpsUploading(false);
    }
  };

  return (
    <div className={`flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden ${
      isFullPage 
        ? 'fixed inset-0 z-40 w-screen h-screen' 
        : 'w-full h-full min-h-[400px] rounded border border-slate-200 dark:border-slate-800 shadow-sm relative'
    }`}>
      
      {/* Drawings Toolbar */}
      <div className="bg-white dark:bg-slate-950 p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 flex-wrap gap-2 z-10">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
              isSidebarOpen 
                ? 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400'
            }`}
            title={isSidebarOpen ? "Hide Blueprint Annotations" : "Show Blueprint Annotations"}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{isSidebarOpen ? "Hide Blueprint Annotations" : "Show Blueprint Annotations"}</span>
          </button>

          <span className="text-slate-200 dark:text-slate-800 mx-1 font-light">|</span>

          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1.5 py-1">
            Viewer Mode:
          </span>
          
          {/* Select / Inspect Tool */}
          <button
            onClick={() => setActiveTool('select')}
            className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded border transition cursor-pointer ${
              activeTool === 'select'
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
            }`}
            title="Inspect marks on drawing"
          >
            <MousePointer className="h-3.5 w-3.5" />
            <span>Inspect / Select</span>
          </button>

          {/* Creation Toolbelt (only show if canEdit is true) */}
          {canEdit && (
            <>
              <span className="text-slate-200 dark:text-slate-800 mx-1 font-light">|</span>

              {/* GPS Camera Photo Button */}
              <button
                onClick={handleGpsPhotoClick}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border transition cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow border-blue-600"
                title="Use Android GPS and Camera to capture a photo at your current site location"
              >
                <Camera className="h-3.5 w-3.5 animate-pulse" />
                <span>Take GPS Photo</span>
              </button>

              <span className="text-slate-200 dark:text-slate-800 mx-1 font-light">|</span>
              
              {/* Circle Mark Tool */}
              <button
                onClick={() => setActiveTool('circle')}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded border transition cursor-pointer ${
                  activeTool === 'circle'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                }`}
              >
                <Circle className="h-3.5 w-3.5" />
                <span>Circle Mark</span>
              </button>

              {/* Rectangle Mark Tool */}
              <button
                onClick={() => setActiveTool('rectangle')}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded border transition cursor-pointer ${
                  activeTool === 'rectangle'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                }`}
              >
                <Square className="h-3.5 w-3.5" />
                <span>Box Mark</span>
              </button>

              {/* Line Mark Tool */}
              <button
                onClick={() => setActiveTool('line')}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded border transition cursor-pointer ${
                  activeTool === 'line'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                }`}
              >
                <Minus className="h-3.5 w-3.5 rotate-45" />
                <span>Line Mark</span>
              </button>
            </>
          )}

          {/* Zoom Controls */}
          <span className="text-slate-200 dark:text-slate-800 mx-1 font-light">|</span>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1.5 py-1">
            Zoom:
          </span>
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5">
            <button
              onClick={() => setZoomScale(prev => Math.max(0.5, prev - 0.25))}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-700 transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 min-w-[36px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale(prev => Math.min(4.0, prev + 0.25))}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-700 transition cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setZoomScale(1.0)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer border-l border-slate-200 dark:border-slate-700 ml-1 pl-1.5"
              title="Reset Zoom to 100%"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <span className="text-slate-200 dark:text-slate-800 mx-1 font-light">|</span>
          
          <button
            onClick={() => setIsFullPage(!isFullPage)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded border transition cursor-pointer ${
              isFullPage
                ? 'bg-amber-600 border-amber-600 hover:bg-amber-700 text-white shadow-sm'
                : 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700 dark:bg-slate-900 dark:border-slate-800 dark:text-blue-400'
            }`}
            title={isFullPage ? "Exit Full Screen Mode (Esc)" : "Fill Page (Toggle Full Screen View)"}
          >
            {isFullPage ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
            <span>{isFullPage ? "Exit Full Screen" : "Fill Page"}</span>
          </button>
        </div>

        {/* Informational Status or Active drawing step */}
        <div className="text-[10px] font-semibold text-slate-500">
          {firstPoint ? (
            <span className="text-emerald-600 dark:text-emerald-400 animate-pulse flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              Complete shape placement
              <button 
                onClick={handleCancelDrawing}
                className="ml-2 px-1.5 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-50 cursor-pointer"
              >
                Cancel
              </button>
            </span>
          ) : activeTool !== 'select' ? (
            <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Click blueprint to begin annotation
              <button 
                onClick={handleCancelDrawing}
                className="ml-2 px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
            </span>
          ) : (
            <span className="truncate max-w-[200px] text-slate-400">{drawingName}</span>
          )}
        </div>
      </div>

      {/* Main Layout Area: Sidebar & Canvas Side-by-Side */}
      <div className="flex flex-1 overflow-hidden h-full min-h-0 relative">
        
        {/* Collapsible Filter & Navigation Sidebar */}
        {isSidebarOpen && (
          <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col h-full shrink-0 z-10 animate-fade-in">
            {/* Sidebar Header */}
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/50">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-blue-500" />
                Blueprint Annotations ({filteredMarks.length} / {marks.length})
              </h3>
            </div>

            {/* Search Box */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-900">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by label..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-900 bg-slate-50/20 dark:bg-slate-950/20 space-y-3.5">
              {/* Filter by Type */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                  Annotation Type
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {['all', 'circle', 'rectangle', 'line'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={`px-1 py-1 text-[10px] font-semibold rounded border transition text-center capitalize cursor-pointer ${
                        filterType === t
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {t === 'all' ? 'All' : t === 'circle' ? 'Circle' : t === 'rectangle' ? 'Box' : 'Line'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter by Creator */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                  Placed By
                </label>
                <select
                  value={filterCreator}
                  onChange={(e) => setFilterCreator(e.target.value)}
                  className="w-full p-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Contributors</option>
                  <option value="admin">Project Owner (Admin)</option>
                  {uniqueCreators
                    .filter((c) => c.id !== 'admin')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Filter by Category Checklist */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Observation Categories
                </label>
                <div className="space-y-1.5 bg-slate-50/50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                  {[
                    { id: 'safety', label: '⚠️ Safety Observations', colorClass: 'bg-rose-500 text-rose-500' },
                    { id: 'measurement', label: '📐 Measurements', colorClass: 'bg-sky-500 text-sky-500' },
                    { id: 'defect', label: '❌ Defects / Issues', colorClass: 'bg-amber-500 text-amber-500' },
                    { id: 'progress', label: '🚧 Progress Tracking', colorClass: 'bg-emerald-500 text-emerald-500' },
                    { id: 'quality', label: '🔍 Quality Control', colorClass: 'bg-purple-500 text-purple-500' },
                    { id: 'general', label: '📋 General Slate Notes', colorClass: 'bg-slate-400 text-slate-400' },
                    { id: 'other', label: '📌 Other / Notes', colorClass: 'bg-indigo-500 text-indigo-500' }
                  ].map((cat) => {
                    const isChecked = filterCategories.includes(cat.id);
                    return (
                      <label key={cat.id} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setFilterCategories(prev => prev.filter(c => c !== cat.id));
                            } else {
                              setFilterCategories(prev => [...prev, cat.id]);
                            }
                          }}
                          className="rounded text-blue-600 border-slate-300 dark:border-slate-800 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                        />
                        <span className={`w-2 h-2 rounded-full ${cat.colorClass.split(' ')[0]}`} />
                        <span>{cat.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Canvas visibility toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  {hideFilteredOnCanvas ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  Unmatched Marks
                </span>
                <button
                  onClick={() => setHideFilteredOnCanvas(!hideFilteredOnCanvas)}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                    hideFilteredOnCanvas
                      ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}
                >
                  {hideFilteredOnCanvas ? 'Hidden' : 'Dimmed'}
                </button>
              </div>
            </div>

            {/* List of matched marks */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/50 dark:bg-slate-900/10">
              {filteredMarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <Search className="h-8 w-8 text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">No matching marks</p>
                  <p className="text-[10px] text-slate-400 mt-1">Try adjusting your filters or search query.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredMarks.map((mark) => {
                    const isSelected = selectedMark?.id === mark.id;
                    return (
                      <button
                        key={mark.id}
                        onClick={() => {
                          setSelectedMark(mark);
                        }}
                        className={`w-full text-left p-2 rounded-lg transition-all flex items-start gap-2 border cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/40 shadow-sm'
                            : 'bg-white dark:bg-slate-950 border-slate-100 hover:border-slate-200 hover:bg-slate-100/50 dark:border-slate-900 dark:hover:border-slate-800/50'
                        }`}
                      >
                        <div className={`p-1 rounded shrink-0 mt-0.5 ${getCategoryTheme(mark.category).bg}`}>
                          {getShapeIcon(mark.type, "h-3.5 w-3.5")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                            {mark.label}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-0.5 truncate max-w-[110px]">
                              <User className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {mark.createdByName || (mark.createdBy === 'admin' ? 'Project Owner' : mark.createdBy)}
                              </span>
                            </span>
                            {mark.evidencePhotos.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="bg-sky-50 dark:bg-sky-950/30 px-1 py-0.2 rounded text-sky-600 dark:text-sky-400 font-bold">
                                  {mark.evidencePhotos.length} {mark.evidencePhotos.length === 1 ? 'photo' : 'photos'}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-wider uppercase border ${getCategoryTheme(mark.category).pill}`}>
                              {getCategoryTheme(mark.category).label}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Drawing Image Container */}
        <div className="flex-1 h-full relative overflow-auto flex items-center justify-center p-4">

          {isPdf && pdfRenderLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-100/60 dark:bg-slate-950/60 backdrop-blur-xs">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider animate-pulse">
                Rendering PDF Blueprint...
              </p>
            </div>
          )}

          {isPdf && pdfRenderError && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-100/90 dark:bg-slate-950/90 backdrop-blur-xs p-4 text-center">
              <ShieldAlert className="h-10 w-10 text-rose-500 mb-2" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">PDF Render Failure</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">{pdfRenderError}</p>
            </div>
          )}

          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onDragStart={(e) => e.preventDefault()}
            className={`relative max-w-full shadow-md rounded overflow-hidden border border-slate-300 dark:border-slate-800 select-none transition-transform duration-200 ${
              activeTool !== 'select' && canEdit ? 'cursor-crosshair border-emerald-500 ring-2 ring-emerald-500/20' : ''
            }`}
            style={{
              width: 'fit-content',
              height: 'fit-content',
              transform: `scale(${zoomScale})`,
              transformOrigin: 'center center'
            }}
          >
            {/* Main Construction Photo / Canvas */}
            {isPdf ? (
              <canvas
                ref={pdfCanvasRef}
                className="w-auto block object-contain pointer-events-none"
              />
            ) : (
              <img
                ref={imageRef}
                src={drawingUrl}
                alt={drawingName}
                referrerPolicy="no-referrer"
                className="w-auto block object-contain pointer-events-none"
                onLoad={() => onUpdate()} // trigger update on load to handle coordinates
              />
            )}

            {/* Interactive SVG Mark Overlay */}
            <svg
              className="absolute inset-0 w-full h-full"
              style={{ pointerEvents: activeTool === 'select' ? 'auto' : 'none' }}
              preserveAspectRatio="none"
            >
              {marks.map((mark) => {
                const isMatched = filteredMarks.some(m => m.id === mark.id);
                if (hideFilteredOnCanvas && !isMatched) return null;

                const { x, y, width = 10, height = 10, x2 = 0, y2 = 0 } = mark.coordinates;
                const isSelected = selectedMark?.id === mark.id;

                return (
                  <g 
                    key={mark.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isMatched) return;
                      if (activeTool === 'select') {
                        setSelectedMark(mark);
                      }
                    }}
                    className={`group cursor-pointer transition-opacity duration-200 ${
                      isMatched ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-15'
                    }`}
                  >
                    {/* Mark: Circle */}
                    {mark.type === 'circle' && (
                      <>
                        {/* Interactive Hover Area */}
                        <circle
                          cx={`${x}%`}
                          cy={`${y}%`}
                          r={mark.coordinates.radius ? `${mark.coordinates.radius}%` : (isSelected ? "18" : "12")}
                          className={`${getCategoryCanvasColor(mark.category).fill} ${getCategoryCanvasColor(mark.category).hoverFill} ${getCategoryCanvasColor(mark.category).stroke} stroke-[1.5] group-hover:stroke-2 transition-all duration-200`}
                        />
                        {/* Center handle point */}
                        <circle
                          cx={`${x}%`}
                          cy={`${y}%`}
                          r="5"
                          className={`${getCategoryCanvasColor(mark.category).dot} stroke-white stroke-2 shadow`}
                        />
                      </>
                    )}

                    {/* Mark: Rectangle */}
                    {mark.type === 'rectangle' && (
                      <rect
                        x={`${x}%`}
                        y={`${y}%`}
                        width={`${width}%`}
                        height={`${height}%`}
                        className={`${getCategoryCanvasColor(mark.category).fill} ${getCategoryCanvasColor(mark.category).hoverFill} ${getCategoryCanvasColor(mark.category).stroke} transition-all duration-200 ${
                          isSelected ? 'stroke-2 ring-2 ring-blue-500/50' : 'stroke-[1.5]'
                        }`}
                      />
                    )}

                    {/* Mark: Line */}
                    {mark.type === 'line' && (
                      <>
                        {/* Thick interactive backdrop line for easy hover */}
                        <line
                          x1={`${x}%`}
                          y1={`${y}%`}
                          x2={`${x2}%`}
                          y2={`${y2}%`}
                          className={`${getCategoryCanvasColor(mark.category).lineBg} hover:stroke-[24] stroke-[16] transition-all duration-200 cursor-pointer`}
                        />
                        <line
                          x1={`${x}%`}
                          y1={`${y}%`}
                          x2={`${x2}%`}
                          y2={`${y2}%`}
                          className={`${getCategoryCanvasColor(mark.category).lineFg} transition-all duration-200 ${
                            isSelected ? 'stroke-[4]' : 'stroke-2'
                          }`}
                        />
                        {/* End node dots */}
                        <circle cx={`${x}%`} cy={`${y}%`} r="4" className={getCategoryCanvasColor(mark.category).dot} />
                        <circle cx={`${x2}%`} cy={`${y2}%`} r="4" className={getCategoryCanvasColor(mark.category).dot} />
                      </>
                    )}

                    {/* Floating HTML Label inside SVG */}
                    <foreignObject
                      x={`${mark.type === 'line' ? (x + x2) / 2 : x}%`}
                      y={`${mark.type === 'line' ? (y + y2) / 2 : y}%`}
                      width="140"
                      height="40"
                      transform="translate(-70, -28)"
                      className="pointer-events-none select-none"
                    >
                      <div className="flex justify-center">
                        <div className="bg-slate-900/90 text-[10px] text-white px-1.5 py-0.5 rounded shadow border border-slate-700 truncate max-w-full flex items-center gap-1">
                          <MessageSquare className="h-2.5 w-2.5 text-sky-400" />
                          <span className="truncate">{mark.label}</span>
                          {mark.evidencePhotos.length > 0 && (
                            <span className="bg-blue-600 text-white rounded-full px-1 py-0 text-[8px] scale-90">
                              {mark.evidencePhotos.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}

              {/* Render CAD-style preview shape during active drawing */}
              {firstPoint && hoverPoint && (
                <g className="pointer-events-none">
                  {activeTool === 'circle' && (
                    <>
                      <circle
                        cx={`${firstPoint.x}%`}
                        cy={`${firstPoint.y}%`}
                        r={`${Math.sqrt(Math.pow(hoverPoint.x - firstPoint.x, 2) + Math.pow(hoverPoint.y - firstPoint.y, 2))}%`}
                        className="fill-emerald-500/10 stroke-emerald-500 stroke-2"
                        strokeDasharray="4 4"
                      />
                      <circle cx={`${firstPoint.x}%`} cy={`${firstPoint.y}%`} r="4" className="fill-emerald-600" />
                      <line
                        x1={`${firstPoint.x}%`}
                        y1={`${firstPoint.y}%`}
                        x2={`${hoverPoint.x}%`}
                        y2={`${hoverPoint.y}%`}
                        className="stroke-emerald-400/60 stroke-1"
                        strokeDasharray="2 2"
                      />
                    </>
                  )}

                  {activeTool === 'rectangle' && (
                    <rect
                      x={`${Math.min(firstPoint.x, hoverPoint.x)}%`}
                      y={`${Math.min(firstPoint.y, hoverPoint.y)}%`}
                      width={`${Math.abs(hoverPoint.x - firstPoint.x)}%`}
                      height={`${Math.abs(hoverPoint.y - firstPoint.y)}%`}
                      className="fill-emerald-500/10 stroke-emerald-500 stroke-2 stroke-dasharray-[4]"
                    />
                  )}

                  {activeTool === 'line' && (
                    <>
                      <line
                        x1={`${firstPoint.x}%`}
                        y1={`${firstPoint.y}%`}
                        x2={`${hoverPoint.x}%`}
                        y2={`${hoverPoint.y}%`}
                        className="stroke-emerald-500 stroke-2 stroke-dasharray-[4]"
                      />
                      <circle cx={`${firstPoint.x}%`} cy={`${firstPoint.y}%`} r="4" className="fill-emerald-600" />
                      <circle cx={`${hoverPoint.x}%`} cy={`${hoverPoint.y}%`} r="4" className="fill-emerald-600" />
                    </>
                  )}
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* Dialog Backdrop for Entering a Label on a newly drawn mark */}
      {showCreateDialog && newMarkCoords && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1.5">
              <MessageSquare className="h-4 w-4 text-emerald-500" />
              Add Observation Label
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              Give a brief label description to identify this construction observation.
            </p>

            <input
              type="text"
              value={newMarkLabel}
              onChange={(e) => setNewMarkLabel(e.target.value)}
              className="w-full p-2.5 border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100"
              placeholder="e.g. Safety barrier missing, Floor cracking, Pipe conduit block"
              autoFocus
              maxLength={150}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newMarkLabel.trim()) {
                  handleSaveNewMark();
                }
              }}
            />

            {/* Category selection inside new mark dialog */}
            <div className="mt-4">
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Classification Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'safety', label: '⚠️ Safety Obs.', bg: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400' },
                  { id: 'measurement', label: '📐 Measurement', bg: 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/50 text-sky-700 dark:text-sky-400' },
                  { id: 'defect', label: '❌ Defect/Issue', bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400' },
                  { id: 'progress', label: '🚧 Progress', bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400' },
                  { id: 'quality', label: '🔍 Quality Ctrl', bg: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50 text-purple-700 dark:text-purple-400' },
                  { id: 'general', label: '📋 General Slate', bg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400' },
                  { id: 'other', label: '📌 Other / Note', bg: 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400' }
                ].map((cat) => {
                  const isSelected = newMarkCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNewMarkCategory(cat.id as any)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border transition text-left flex items-center justify-between cursor-pointer ${
                        isSelected 
                          ? `${cat.bg} border-2 ring-1 ring-blue-500/50` 
                          : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span>{cat.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 text-sm font-medium">
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewMarkCoords(null);
                }}
                disabled={creating}
                className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer text-slate-600"
              >
                Discard
              </button>
              <button
                onClick={handleSaveNewMark}
                disabled={creating || !newMarkLabel.trim()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Mark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating details modal when click on a mark */}
      {selectedMark && (
        <MarkDetailsModal
          projectId={projectId}
          drawingId={drawingId}
          mark={selectedMark}
          onClose={() => setSelectedMark(null)}
          onUpdate={() => {
            onUpdate();
            // Refresh local selectedMark with updated values
            const updated = marks.find(m => m.id === selectedMark.id);
            if (updated) setSelectedMark(updated);
            else setSelectedMark(null);
          }}
          canEdit={canEdit}
          shareToken={shareToken}
        />
      )}

      {/* Loading Overlay for GPS acquisition */}
      {gpsLoadingMessage && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md text-white p-4">
          <Loader2 className="h-10 w-10 text-blue-400 animate-spin mb-4" />
          <p className="text-sm font-bold font-mono tracking-wider animate-pulse uppercase text-center">
            {gpsLoadingMessage}
          </p>
          <p className="text-[10px] text-slate-400 mt-2 max-w-xs text-center">
            Make sure your device location / GPS services are turned on with high accuracy mode.
          </p>
        </div>
      )}

      {/* GPS Camera Photo Capture Modal */}
      {showGpsCameraModal && gpsCalculatedCoords && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md overflow-y-auto p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-950/40 text-blue-600 rounded-lg">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    GPS Photo Capture
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Auto-aligned to: X: {gpsCalculatedCoords.x.toFixed(1)}%, Y: {gpsCalculatedCoords.y.toFixed(1)}%
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowGpsCameraModal(false);
                  setGpsCalculatedCoords(null);
                  setGpsPhotoFile(null);
                  if (gpsPhotoPreviewUrl) URL.revokeObjectURL(gpsPhotoPreviewUrl);
                  setGpsPhotoPreviewUrl(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-full hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* GPS Info Stats Card */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800 flex items-start justify-between text-[10px] font-semibold text-slate-500">
                <div className="space-y-1">
                  <p className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-emerald-500" />
                    <span>GPS Coordinates:</span>
                  </p>
                  <p className="font-mono text-slate-700 dark:text-slate-300">
                    Lat: {gpsCalculatedCoords.lat.toFixed(6)}, Lng: {gpsCalculatedCoords.lng.toFixed(6)}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p>Accuracy: ±{gpsCalculatedCoords.accuracy.toFixed(1)}m</p>
                  <p>Time: {new Date().toLocaleTimeString()}</p>
                </div>
              </div>

              {/* Photo Input / Preview Area */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                  Observation Photo *
                </label>
                
                {gpsPhotoPreviewUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow bg-slate-50">
                    <img 
                      src={gpsPhotoPreviewUrl} 
                      alt="Captured site observation" 
                      className="w-full h-48 object-cover block"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setGpsPhotoFile(null);
                        URL.revokeObjectURL(gpsPhotoPreviewUrl);
                        setGpsPhotoPreviewUrl(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow cursor-pointer"
                      title="Discard Photo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          setGpsPhotoFile(file);
                          setGpsPhotoPreviewUrl(URL.createObjectURL(file));
                        }
                      }}
                      className="hidden"
                      id="gps-camera-file-input"
                    />
                    <label
                      htmlFor="gps-camera-file-input"
                      className="w-full h-36 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/20 dark:hover:bg-blue-950/10 rounded-2xl cursor-pointer transition text-center p-4 shadow-sm"
                    >
                      <Camera className="h-10 w-10 text-slate-400 mb-2" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        TAP TO CAPTURE PHOTO
                      </span>
                      <span className="text-[9px] text-slate-400 mt-1">
                        Launches Android Camera directly
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                  Observation Description *
                </label>
                <input
                  type="text"
                  value={gpsPhotoLabel}
                  onChange={(e) => setGpsPhotoLabel(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-xs font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100"
                  placeholder="e.g. Broken guardrail on slab edge, concrete cracks detected"
                  maxLength={150}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && gpsPhotoLabel.trim() && gpsPhotoFile) {
                      handleSaveGpsPhoto();
                    }
                  }}
                />
              </div>

              {/* Category Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Classification Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'safety', label: '⚠️ Safety Obs.', bg: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400' },
                    { id: 'measurement', label: '📐 Measurement', bg: 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/50 text-sky-700 dark:text-sky-400' },
                    { id: 'defect', label: '❌ Defect/Issue', bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400' },
                    { id: 'progress', label: '🚧 Progress', bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400' },
                    { id: 'quality', label: '🔍 Quality Ctrl', bg: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50 text-purple-700 dark:text-purple-400' },
                    { id: 'general', label: '📋 General Slate', bg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400' },
                    { id: 'other', label: '📌 Other / Note', bg: 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400' }
                  ].map((cat) => {
                    const isSelected = gpsPhotoCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setGpsPhotoCategory(cat.id as any)}
                        className={`px-3 py-2 text-xs font-semibold rounded-lg border transition text-left flex items-center justify-between cursor-pointer ${
                          isSelected 
                            ? `${cat.bg} border-2 ring-1 ring-blue-500/50` 
                            : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span>{cat.label}</span>
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 text-sm font-medium">
              <button
                type="button"
                onClick={() => {
                  setShowGpsCameraModal(false);
                  setGpsCalculatedCoords(null);
                  setGpsPhotoFile(null);
                  if (gpsPhotoPreviewUrl) URL.revokeObjectURL(gpsPhotoPreviewUrl);
                  setGpsPhotoPreviewUrl(null);
                }}
                disabled={gpsUploading}
                className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer text-slate-600 dark:border-slate-800 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveGpsPhoto}
                disabled={gpsUploading || !gpsPhotoLabel.trim() || !gpsPhotoFile}
                className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {gpsUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span>Save to Map</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
