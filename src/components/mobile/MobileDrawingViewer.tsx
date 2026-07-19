import React, { useState, useEffect } from 'react';
import { Circle, Square, Minus, Camera, MapPin, ChevronLeft, Loader2 } from 'lucide-react';
import { Drawing, Mark, Project } from '../../types';
import { getMarks, getProject } from '../../lib/firestore';

interface MobileDrawingViewerProps {
  projectId: string;
  drawingId: string;
  drawing: Drawing;
  onBack: () => void;
  onPhotoCapture: () => void;
  onGPSCapture: () => void;
  onCreateMark: (type: 'circle' | 'rectangle' | 'line') => void;
  onShowMarksList: () => void;
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
}) => {
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);

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
        <button
          onClick={onShowMarksList}
          className="text-xs font-semibold px-3 py-1.5 bg-slate-800 text-slate-300 rounded"
        >
          {marks.length} marks
        </button>
      </div>

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

          <div className="w-px bg-white/10"></div>

          <button
            onClick={onPhotoCapture}
            className="p-3 rounded bg-white/10 text-white hover:bg-white/20 transition-all"
            title="Take Photo"
          >
            <Camera className="h-5 w-5" />
          </button>
          <button
            onClick={onGPSCapture}
            className="p-3 rounded bg-white/10 text-white hover:bg-white/20 transition-all"
            title="Get Location"
          >
            <MapPin className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
