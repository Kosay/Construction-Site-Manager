import React, { useState, useRef, useEffect } from 'react';
import { MousePointer, Circle, Square, Minus, MessageSquare, Plus, Check, X, ShieldAlert, Loader2, Search, Filter, User, Layers, Eye, EyeOff } from 'lucide-react';
import { Mark, MarkCoordinates } from '../types';
import { addMark } from '../lib/firestore';
import { MarkDetailsModal } from './MarkDetailsModal';
import { useAuth } from '../lib/authContext';

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
  const [creating, setCreating] = useState(false);

  // Sidebar, search, and filtering states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCreator, setFilterCreator] = useState<string>('all');
  const [hideFilteredOnCanvas, setHideFilteredOnCanvas] = useState(false);

  // Extract unique creators for filtering options
  const uniqueCreators = Array.from(new Set(marks.map(m => m.createdBy || 'Unknown')));

  // Filter marks based on searchQuery, filterType, and filterCreator
  const filteredMarks = marks.filter(mark => {
    const labelMatch = mark.label.toLowerCase().includes(searchQuery.toLowerCase());
    const typeMatch = filterType === 'all' || mark.type === filterType;
    const creatorMatch = filterCreator === 'all' || mark.createdBy === filterCreator;
    return labelMatch && typeMatch && creatorMatch;
  });

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

    try {
      const authorUid = shareToken ? `anonymous_${shareToken.substring(0, 5)}` : (user?.uid || 'admin');
      
      await addMark(projectId, drawingId, {
        type: newMarkType,
        coordinates: newMarkCoords,
        label: newMarkLabel.trim(),
        createdBy: authorUid,
        evidencePhotos: []
      }, shareToken);

      onUpdate();
      setShowCreateDialog(false);
      setNewMarkCoords(null);
      setNewMarkLabel('');
      setActiveTool('select'); // drop tool back to select
    } catch (error) {
      console.error('Failed to create mark:', error);
      alert('Error creating mark. Make sure link is valid.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full min-h-[400px] bg-slate-50 dark:bg-slate-900 rounded overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative">
      
      {/* Drawings Toolbar */}
      <div className="bg-white dark:bg-slate-950 p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 flex-wrap gap-2 z-10">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 text-xs font-semibold ${
              isSidebarOpen 
                ? 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400'
            }`}
            title={isSidebarOpen ? "Collapse Filter Sidebar" : "Expand Filter Sidebar"}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>{isSidebarOpen ? "Hide Filters" : "Show Filters"}</span>
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
                    .filter((creator) => creator !== 'admin')
                    .map((creator) => (
                      <option key={creator} value={creator}>
                        {creator}
                      </option>
                    ))}
                </select>
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
                        <div className={`p-1 rounded shrink-0 mt-0.5 ${
                          mark.type === 'circle' 
                            ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' 
                            : mark.type === 'rectangle'
                              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                              : 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400'
                        }`}>
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
                                {mark.createdBy === 'admin' ? 'Project Owner' : mark.createdBy}
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
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onDragStart={(e) => e.preventDefault()}
            className={`relative max-w-full shadow-md rounded overflow-hidden border border-slate-300 dark:border-slate-800 select-none ${
              activeTool !== 'select' && canEdit ? 'cursor-crosshair border-emerald-500 ring-2 ring-emerald-500/20' : ''
            }`}
            style={{ width: 'fit-content', height: 'fit-content' }}
          >
            {/* Main Construction Photo */}
            <img
              ref={imageRef}
              src={drawingUrl}
              alt={drawingName}
              referrerPolicy="no-referrer"
              className="max-h-[70vh] w-auto block object-contain pointer-events-none"
              onLoad={() => onUpdate()} // trigger update on load to handle coordinates
            />

            {/* Interactive SVG Mark Overlay */}
            <svg
              className="absolute inset-0 w-full h-full"
              style={{ pointerEvents: activeTool === 'select' ? 'auto' : 'none' }}
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
                          className="fill-red-500/15 group-hover:fill-red-500/25 stroke-red-500 stroke-[1.5] group-hover:stroke-2 transition-all duration-200"
                        />
                        {/* Center handle point */}
                        <circle
                          cx={`${x}%`}
                          cy={`${y}%`}
                          r="5"
                          className="fill-red-600 stroke-white stroke-2 shadow"
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
                        className={`fill-amber-500/10 stroke-amber-500 group-hover:fill-amber-500/20 transition-all duration-200 ${
                          isSelected ? 'stroke-2 ring-2 ring-amber-500' : 'stroke-1'
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
                          className="stroke-blue-500/20 hover:stroke-blue-500/30 stroke-[16] transition-all duration-200"
                        />
                        <line
                          x1={`${x}%`}
                          y1={`${y}%`}
                          x2={`${x2}%`}
                          y2={`${y2}%`}
                          className={`stroke-blue-600 transition-all duration-200 ${
                            isSelected ? 'stroke-[4]' : 'stroke-2'
                          }`}
                        />
                        {/* End node dots */}
                        <circle cx={`${x}%`} cy={`${y}%`} r="4" className="fill-blue-700" />
                        <circle cx={`${x2}%`} cy={`${y2}%`} r="4" className="fill-blue-700" />
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
    </div>
  );
};
