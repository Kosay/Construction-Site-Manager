import React, { useState, useRef } from 'react';
import { LayoutGrid, FileText, UploadCloud, Check, AlertCircle, Loader2 } from 'lucide-react';
import { uploadFile } from '../lib/storage';
import { createProject, addDrawing } from '../lib/firestore';
import { CalibrationPointSetup } from './CalibrationPointSetup';
import { CalibrationPoint } from '../types';

interface ProjectFormProps {
  userId: string;
  onSuccess: (projectId: string) => void;
  onCancel: () => void;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({ userId, onSuccess, onCancel }) => {
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');

  // Files state
  const [drawingFile, setDrawingFile] = useState<File | null>(null);
  const [kmlFile, setKmlFile] = useState<File | null>(null);

  // Status state
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Calibration state
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [calibrationDrawingUrl, setCalibrationDrawingUrl] = useState<string>('');
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([]);
  const [kmlData, setKmlData] = useState<{ url: string; fileName: string } | null>(null);

  const drawingInputRef = useRef<HTMLInputElement>(null);
  const kmlInputRef = useRef<HTMLInputElement>(null);

  const handleDrawingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isImage && !isPdf) {
        setError('Drawings must be a .png, .jpg, .jpeg or .pdf file.');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError('Drawing blueprint exceeds the 50MB limit.');
        return;
      }
      setDrawingFile(file);
      setError(null);
    }
  };

  const handleKmlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.kml')) {
        setError('Site map must be a .kml file.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('KML file exceeds the 10MB limit.');
        return;
      }
      setKmlFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setError('Project name is required.');
      return;
    }
    if (!drawingFile) {
      setError('At least one initial 2D drawing (blueprint photo) is required to start.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Prepare KML data if file exists
      let preparedKmlData = null;
      if (kmlFile) {
        setUploadStatus('Uploading site map (KML)...');
        const kmlPath = `projects/${Date.now()}_${kmlFile.name}`;
        const kmlUrl = await uploadFile(kmlPath, kmlFile);
        preparedKmlData = { url: kmlUrl, fileName: kmlFile.name };
      }

      // 2. Create a temporary URL for the drawing for calibration
      setUploadStatus('Preparing drawing for calibration...');
      const drawingUrl = URL.createObjectURL(drawingFile);

      // 3. Store KML data and show calibration modal
      setKmlData(preparedKmlData);
      setCalibrationDrawingUrl(drawingUrl);
      setShowCalibrationModal(true);
      setSubmitting(false);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An error occurred during project setup.');
      setSubmitting(false);
    }
  };

  const handleCalibrationComplete = async (points: CalibrationPoint[]) => {
    setShowCalibrationModal(false);
    setCalibrationPoints(points);
    setSubmitting(true);
    setError(null);

    try {
      // 1. Create project metadata document with calibration points
      setUploadStatus('Creating project with calibration points...');
      const projectId = await createProject(
        projectName.trim(),
        description.trim(),
        userId,
        kmlData,
        points
      );

      // 2. Upload and register initial drawing
      setUploadStatus('Uploading drawing blueprint (PNG/JPG/PDF)...');
      const drawingPath = `projects/${projectId}/drawings/${Date.now()}_${drawingFile?.name}`;
      const drawingUrl = await uploadFile(drawingPath, drawingFile!);
      await addDrawing(projectId, drawingFile!.name, drawingUrl);

      setUploadStatus('Project created successfully!');
      setTimeout(() => {
        onSuccess(projectId);
      }, 800);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An error occurred during project creation.');
      setShowCalibrationModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCalibrationCancel = () => {
    setShowCalibrationModal(false);
    setCalibrationDrawingUrl('');
    setCalibrationPoints([]);
    setKmlData(null);
  };

  return (
    <>
      {showCalibrationModal && (
        <CalibrationPointSetup
          drawingUrl={calibrationDrawingUrl}
          onCalibrationComplete={handleCalibrationComplete}
          onCancel={handleCalibrationCancel}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto bg-white dark:bg-slate-900 p-6 rounded border border-slate-200 dark:border-slate-800 shadow">
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
        <LayoutGrid className="h-5 w-5 text-blue-600" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Deploy Construction Workspace</h3>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded text-xs flex items-start gap-2 border border-red-200 dark:border-red-900/30">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="whitespace-pre-wrap">{error}</span>
        </div>
      )}

      {/* Project Details */}
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Project Name *
          </label>
          <input
            type="text"
            required
            disabled={submitting}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full p-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-800 dark:text-slate-100"
            placeholder="e.g. London Heathrow Terminal 5 Upgrade"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Description / Mission Outline
          </label>
          <textarea
            disabled={submitting}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full min-h-[70px] p-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-800 dark:text-slate-100"
            placeholder="Infrastructure, utilities, and safety observation dashboard."
          />
        </div>
      </div>

      {/* File Upload Section */}
      <div className="space-y-4">
        <div className="p-4 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-950/40 relative">
          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-2">
            2D Drawing Blueprint (PNG / JPG / PDF) *
          </label>
          <input
            ref={drawingInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleDrawingChange}
            className="hidden"
            disabled={submitting}
          />
          {drawingFile ? (
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded border border-emerald-200 dark:border-emerald-900/30">
              <div className="flex items-center gap-2 truncate">
                <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate font-medium">
                  {drawingFile.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawingFile(null)}
                disabled={submitting}
                className="text-slate-400 hover:text-red-500 text-xs font-semibold px-1 py-0.5 cursor-pointer"
              >
                Clear
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => drawingInputRef.current?.click()}
              disabled={submitting}
              className="w-full h-24 flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-800 rounded hover:border-blue-400 hover:bg-white dark:hover:bg-slate-900 hover:text-blue-500 text-slate-400 transition cursor-pointer"
            >
              <UploadCloud className="h-6 w-6 mb-1 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Select Site Drawing</span>
              <span className="text-[9px] text-slate-400">Max size 50MB</span>
            </button>
          )}
        </div>

        <div className="p-4 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-950/40 relative">
          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-2">
            Site Map Overlay (KML) - Optional
          </label>
          <input
            ref={kmlInputRef}
            type="file"
            accept=".kml"
            onChange={handleKmlChange}
            className="hidden"
            disabled={submitting}
          />
          {kmlFile ? (
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded border border-emerald-200 dark:border-emerald-900/30">
              <div className="flex items-center gap-2 truncate">
                <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate font-medium">
                  {kmlFile.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setKmlFile(null)}
                disabled={submitting}
                className="text-slate-400 hover:text-red-500 text-xs font-semibold px-1 py-0.5 cursor-pointer"
              >
                Clear
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => kmlInputRef.current?.click()}
              disabled={submitting}
              className="w-full h-20 flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-800 rounded hover:border-amber-400 hover:bg-white dark:hover:bg-slate-900 hover:text-amber-500 text-slate-400 transition cursor-pointer"
            >
              <UploadCloud className="h-5 w-5 mb-1 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Select KML Map File</span>
              <span className="text-[9px] text-slate-400">Max size 10MB</span>
            </button>
          )}
        </div>
      </div>

      {/* Submission Status */}
      {submitting && (
        <div className="flex items-center gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded justify-center text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
          <span className="font-mono tracking-wide uppercase animate-pulse">{uploadStatus}</span>
        </div>
      )}

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-1.5 border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 rounded cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !projectName.trim() || !drawingFile}
          className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer font-semibold text-xs transition disabled:opacity-45 disabled:cursor-not-allowed shadow-sm flex items-center gap-1.5"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Deploying...</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Deploy Workspace</span>
            </>
          )}
        </button>
      </div>
    </form>
    </>
  );
};
