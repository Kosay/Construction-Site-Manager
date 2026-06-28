import React, { useState, useEffect, useRef } from 'react';
import { 
  AuthProvider, 
  useAuth 
} from './lib/authContext';
import { 
  getProject, 
  getProjects, 
  getDrawings, 
  getModels, 
  getMarks, 
  addDrawing, 
  addModel, 
  validateShareLink, 
  getProjectShareLinks 
} from './lib/firestore';
import { uploadFile } from './lib/storage';
import { Project, Drawing, Model, Mark } from './types';
import { DrawingViewer } from './components/DrawingViewer';
import { ProjectForm } from './components/ProjectForm';
import { ShareLinkGenerator } from './components/ShareLinkGenerator';
import { signInAnonymously } from 'firebase/auth';
import { auth } from './lib/firebase';
import { 
  LogOut, 
  ChevronLeft, 
  Plus, 
  UploadCloud, 
  Layers, 
  Box, 
  Image as ImageIcon, 
  Share2, 
  Settings, 
  Construction, 
  Globe, 
  User, 
  Check, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';

function MainAppContent() {
  const { user, loading: authLoading, loginWithGoogle, logout } = useAuth();
  
  // Routing / Path States
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isShareView, setIsShareView] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [guestCanEdit, setGuestCanEdit] = useState(false);

  // General App States
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [activeDrawing, setActiveDrawing] = useState<Drawing | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [activeModel, setActiveModel] = useState<Model | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);

  // Navigation states
  const [viewState, setViewState] = useState<'dashboard' | 'workspace' | 'create-project'>('dashboard');
  const [showShareManager, setShowShareManager] = useState(false);

  // File Upload states for active project workspace
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const drawingUploadInputRef = useRef<HTMLInputElement>(null);
  const modelUploadInputRef = useRef<HTMLInputElement>(null);

  // 1. Check for Share Link Token on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('share');
    if (token) {
      setShareToken(token);
      setIsShareView(true);
      handleLoadShareLink(token);
    } else {
      // If we are logged in, load projects
      if (user) {
        loadProjectsList();
      }
    }
  }, [user]);

  // Load guest view based on token
  const handleLoadShareLink = async (token: string) => {
    setShareLoading(true);
    setShareError(null);
    try {
      // A. Validate share link metadata and expiration
      const validatedLink = await validateShareLink(token);
      if (!validatedLink) {
        setShareError('This share link is invalid, expired, or has been revoked by the site administrator.');
        setShareLoading(false);
        return;
      }

      setGuestCanEdit(validatedLink.accessLevel === 'edit');

      // B. Authenticate visitor anonymously in the background for secure writes
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      // C. Retrieve Project & attachments
      const proj = await getProject(validatedLink.projectId);
      if (!proj) {
        setShareError('The shared project could not be found. It may have been deleted.');
        setShareLoading(false);
        return;
      }

      setActiveProject(proj);
      setViewState('workspace');
      
      // Load assets
      await loadProjectAssets(proj.id);
    } catch (err) {
      console.error(err);
      setShareError('An error occurred while validating the secure share token.');
    } finally {
      setShareLoading(false);
    }
  };

  const loadProjectsList = async () => {
    if (!user) return;
    try {
      const projs = await getProjects(user.uid);
      setProjects(projs);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadProjectAssets = async (projectId: string) => {
    try {
      const [allDrawings, allModels] = await Promise.all([
        getDrawings(projectId),
        getModels(projectId),
      ]);

      setDrawings(allDrawings);
      setModels(allModels);

      // Select first drawing as default
      if (allDrawings.length > 0) {
        setActiveDrawing(allDrawings[0]);
        await loadMarksForDrawing(projectId, allDrawings[0].id);
      } else {
        setActiveDrawing(null);
        setMarks([]);
      }

      // Select first model as default
      if (allModels.length > 0) {
        setActiveModel(allModels[0]);
      } else {
        setActiveModel(null);
      }
    } catch (error) {
      console.error('Failed to load project assets:', error);
    }
  };

  const loadMarksForDrawing = async (projectId: string, drawingId: string) => {
    try {
      const data = await getMarks(projectId, drawingId);
      setMarks(data);
    } catch (error) {
      console.error('Failed to load marks:', error);
    }
  };

  const handleSelectProject = async (project: Project) => {
    setActiveProject(project);
    setViewState('workspace');
    setShowShareManager(false);
    await loadProjectAssets(project.id);
  };

  const handleDrawingSelect = async (drawing: Drawing) => {
    if (!activeProject) return;
    setActiveDrawing(drawing);
    await loadMarksForDrawing(activeProject.id, drawing.id);
  };

  const handleModelSelect = (model: Model) => {
    setActiveModel(model);
  };

  // Add more Drawings to existing project (Admin only)
  const handleUploadDrawing = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeProject || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('Drawing file exceeds the 50MB size limit.');
      return;
    }

    setUploadingFile(true);
    setUploadProgress('Uploading Drawing to storage...');
    setUploadError(null);

    try {
      const storagePath = `projects/${activeProject.id}/drawings/${Date.now()}_${file.name}`;
      const downloadUrl = await uploadFile(storagePath, file);
      const newDrawingId = await addDrawing(activeProject.id, file.name, downloadUrl);
      
      const updatedDrawings = await getDrawings(activeProject.id);
      setDrawings(updatedDrawings);
      
      // Focus on the newly added drawing
      const added = updatedDrawings.find(d => d.id === newDrawingId);
      if (added) {
        handleDrawingSelect(added);
      }
    } catch (err) {
      console.error(err);
      setUploadError(err instanceof Error ? err.message : 'Failed to upload drawing. Check permissions.');
    } finally {
      setUploadingFile(false);
      setUploadProgress('');
    }
  };

  // Add more Models to existing project (Admin only)
  const handleUploadModel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeProject || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    if (!file.name.endsWith('.glb')) {
      setUploadError('Only .glb 3D files are supported.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('Model exceeds the 50MB size limit.');
      return;
    }

    setUploadingFile(true);
    setUploadProgress('Uploading 3D model to storage...');
    setUploadError(null);

    try {
      const storagePath = `projects/${activeProject.id}/models/${Date.now()}_${file.name}`;
      const downloadUrl = await uploadFile(storagePath, file);
      const newModelId = await addModel(activeProject.id, file.name, downloadUrl);
      
      const updatedModels = await getModels(activeProject.id);
      setModels(updatedModels);

      // Focus on the newly added model
      const added = updatedModels.find(m => m.id === newModelId);
      if (added) {
        setActiveModel(added);
      }
    } catch (err) {
      console.error(err);
      setUploadError(err instanceof Error ? err.message : 'Failed to upload GLB model.');
    } finally {
      setUploadingFile(false);
      setUploadProgress('');
    }
  };

  // Back to Project List Dashboard
  const handleExitWorkspace = () => {
    if (isShareView) {
      // If guests tries to exit, stay on view
      return;
    }
    setActiveProject(null);
    setViewState('dashboard');
    loadProjectsList();
  };

  // Return to non-share mode
  const handleResetToAdminMode = () => {
    window.history.pushState({}, '', window.location.pathname);
    setIsShareView(false);
    setShareToken(null);
    setViewState('dashboard');
    if (user) {
      loadProjectsList();
    }
  };

  // ------------------------------------------------------------------
  // RENDER: Loading Gate
  // ------------------------------------------------------------------
  if (authLoading || shareLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-100">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
        <h2 className="text-sm font-mono tracking-widest text-slate-400 uppercase animate-pulse">
          INITIALIZING SECURE DATA ENGINE...
        </h2>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // RENDER: Guest Share Link Errors
  // ------------------------------------------------------------------
  if (shareError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl text-center">
          <AlertCircle className="h-14 w-14 text-red-500 mx-auto mb-4 animate-bounce" />
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">Access Token Invalid</h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            {shareError}
          </p>
          <button
            onClick={handleResetToAdminMode}
            className="mt-6 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Go to Admin Workspace
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // RENDER: Auth Login Gate (Admins)
  // ------------------------------------------------------------------
  if (!user && !isShareView) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
        
        <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-8 rounded-2xl shadow-2xl relative">
          
          <div className="text-center space-y-3 mb-8">
            <div className="h-14 w-14 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Construction className="h-7 w-7 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Site Works Manager</h1>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Securely manage project plans, 3D assets, and interactive geometric annotations.
              </p>
            </div>
          </div>

          <button
            onClick={loginWithGoogle}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition hover:scale-[1.02] cursor-pointer shadow-lg flex items-center justify-center gap-2"
          >
            <Globe className="h-5 w-5" />
            Sign in with Google Account
          </button>

          <div className="mt-6 border-t border-slate-800 pt-4 text-center">
            <span className="text-[10px] font-mono text-slate-500">
              SECURE SECRETS AUTHENTICATION LAYER ACTIVE
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // RENDER: Admin Dashboard (Main Project List)
  // ------------------------------------------------------------------
  if (viewState === 'dashboard') {
    const initials = user?.displayName 
      ? user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() 
      : (user?.email ? user.email.substring(0, 2).toUpperCase() : 'JD');

    return (
      <div className="h-screen bg-slate-100 dark:bg-slate-950 flex flex-col overflow-hidden text-slate-700">
        {/* Header bar */}
        <header className="h-14 bg-white border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white shadow-sm">
              <Construction className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100">SkyBridge Site Works Manager</h1>
              <p className="text-[10px] text-slate-500">Portal • Status: System Ready</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 border border-white flex items-center justify-center text-[10px] text-white font-bold shadow-sm" title={user?.displayName || user?.email || 'User'}>
                {initials}
              </div>
              <span className="hidden md:inline text-xs font-semibold text-slate-600 dark:text-slate-400 max-w-[120px] truncate">
                {user?.displayName || user?.email}
              </span>
            </div>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
            <button
              onClick={logout}
              className="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 rounded text-slate-500 dark:text-slate-400 hover:text-red-500 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Dashboard Main View */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-5xl w-full mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Deployment Site Projects</h2>
              <p className="text-xs text-slate-500">Select an active construction zone, view blueprints, or configure client sharing.</p>
            </div>
            <button
              onClick={() => setViewState('create-project')}
              className="flex items-center gap-1.5 py-1.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New Project
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 flex flex-col items-center shadow-inner">
              <Construction className="h-10 w-10 text-slate-400 stroke-1 mb-3 animate-pulse" />
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">No Construction Projects Yet</h3>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                Deploy your first zone workspace by setting up the blueprints and the 3D BIM construct.
              </p>
              <button
                onClick={() => setViewState('create-project')}
                className="mt-4 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold cursor-pointer transition shadow-sm"
              >
                Get Started
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => handleSelectProject(project)}
                  className="bg-white dark:bg-slate-900 p-5 rounded border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md cursor-pointer hover:border-blue-500 dark:hover:border-blue-800 transition flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate pr-2">
                        {project.projectName}
                      </h4>
                      <span className="text-[9px] font-mono bg-blue-50 dark:bg-blue-950/40 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/30">
                        Active BIM
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {project.description || 'No project description provided.'}
                    </p>
                  </div>
                  
                  <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between items-center text-[10px] text-slate-500">
                    <span>Created: {project.createdAt?.toDate ? project.createdAt.toDate().toLocaleDateString() : 'Recent'}</span>
                    <span className="font-semibold text-blue-600 group-hover:underline">Open Workspace →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Elegant Status Footer */}
        <footer className="h-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-600"></div>
              <span className="text-[10px] font-medium text-slate-500">Firebase Connected</span>
            </div>
            <div className="text-[10px] text-slate-400">Database: Active</div>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-medium text-slate-500">
            <span>Role: <b>Admin (Full)</b></span>
            <span>Deployed Regions: Multi-Zone</span>
          </div>
        </footer>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // RENDER: Create Project Form View (Admins Only)
  // ------------------------------------------------------------------
  if (viewState === 'create-project') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 py-4 px-6 flex items-center shrink-0">
          <button
            onClick={() => setViewState('dashboard')}
            className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg text-slate-500 mr-3 cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">Deploy Workspace</h1>
            <p className="text-[9px] text-slate-400">Initial File Seeding</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
          <ProjectForm
            userId={user?.uid || 'unknown'}
            onSuccess={(newId) => {
              // Automatically navigate into the newly created project
              loadProjectsList().then(() => {
                const matched = projects.find(p => p.id === newId);
                if (matched) handleSelectProject(matched);
                else setViewState('dashboard');
              });
            }}
            onCancel={() => setViewState('dashboard')}
          />
        </main>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // RENDER: Main Split-Screen Project Workspace (Admin & Guest Views)
  // ------------------------------------------------------------------
  const activeProjectIdDisplay = activeProject ? `PROJ-${activeProject.id.substring(0, 8).toUpperCase()}` : 'PROJ-UNKNOWN';
  const simulatedStorageUsed = ((drawings.length + models.length || 1) * 3.4).toFixed(1);

  return (
    <div className="h-screen bg-slate-100 dark:bg-slate-950 flex flex-col overflow-hidden text-slate-700">
      {/* Header Panel */}
      <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          {!isShareView && (
            <button
              onClick={handleExitWorkspace}
              className="p-1.5 border border-slate-200 hover:bg-slate-50 dark:border-slate-800 rounded text-slate-500 cursor-pointer transition"
              title="Return to Dashboard"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white shadow-sm">
            <Construction className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100 truncate max-w-xs md:max-w-md">
                {activeProject?.projectName}
              </h1>
              {isShareView ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30">
                  <Globe className="h-2.5 w-2.5" />
                  {guestCanEdit ? 'Guest (Edit)' : 'Guest (Read-Only)'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                  Admin Full-Control
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 truncate max-w-lg">
              Project ID: {activeProjectIdDisplay} • Status: Active BIM Workspace
            </p>
          </div>
        </div>

        {/* Workspace controls */}
        <div className="flex items-center gap-3">
          {/* Admin tools */}
          {!isShareView && (
            <button
              onClick={() => setShowShareManager(!showShareManager)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded border transition cursor-pointer ${
                showShareManager
                  ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600 dark:bg-slate-900 dark:border-slate-800'
              }`}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share Portal</span>
            </button>
          )}

          {/* Reset back to normal view button for guest testing */}
          {isShareView && user && (
            <button
              onClick={handleResetToAdminMode}
              className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
            >
              Exit Guest View
            </button>
          )}
        </div>
      </header>

      {/* Main workspace layout */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Floating Uploading state */}
        {uploadingFile && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 backdrop-blur text-white px-4 py-2 rounded border border-slate-700 text-xs font-mono flex items-center gap-3 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            <span className="animate-pulse">{uploadProgress}</span>
          </div>
        )}

        {/* Global error panel */}
        {uploadError && (
          <div className="bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900/30 p-4 text-xs text-red-600 dark:text-red-400 font-semibold">
            <div className="max-w-4xl mx-auto flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="whitespace-pre-wrap font-sans text-left leading-relaxed">{uploadError}</span>
              </div>
              <button onClick={() => setUploadError(null)} className="text-red-500 hover:text-red-600 font-bold px-2 py-1 border border-red-200 dark:border-red-900/40 rounded bg-white dark:bg-slate-900 shrink-0 cursor-pointer transition">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Sliding Guest Link Panel (Admins Only) */}
        {!isShareView && showShareManager && activeProject && (
          <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 overflow-y-auto shrink-0 z-20 max-h-[50vh] animate-slide-down shadow-inner">
            <div className="max-w-4xl mx-auto">
              <ShareLinkGenerator projectId={activeProject.id} adminUid={user?.uid || ''} />
            </div>
          </div>
        )}

        {/* Workspace Full Width Layout */}
        <div className="flex-1 p-4 overflow-hidden h-full">

          {/* IMAGE DRAWING VIEWPORT & MARK OVERLAY */}
          <div className="flex flex-col overflow-hidden h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-sm">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-emerald-600" />
                <h3 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  2D Structural Drawing & Observations
                </h3>
              </div>

              {/* Drawing select tab */}
              <div className="flex items-center gap-2">
                {drawings.length > 0 && (
                  <select
                    value={activeDrawing?.id || ''}
                    onChange={(e) => {
                      const matched = drawings.find(d => d.id === e.target.value);
                      if (matched) handleDrawingSelect(matched);
                    }}
                    className="p-1 text-[10px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded cursor-pointer max-w-[150px] focus:outline-none"
                  >
                    {drawings.map(d => (
                      <option key={d.id} value={d.id}>{d.fileName}</option>
                    ))}
                  </select>
                )}

                {/* Sub-Uploader for more drawings (Admin only) */}
                {!isShareView && (
                  <>
                    <input
                      ref={drawingUploadInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUploadDrawing}
                      className="hidden"
                    />
                    <button
                      onClick={() => drawingUploadInputRef.current?.click()}
                      className="p-1 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-500 cursor-pointer transition"
                      title="Upload Drawing Image"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-[250px] overflow-hidden relative">
              {activeDrawing && activeProject ? (
                <DrawingViewer
                  projectId={activeProject.id}
                  drawingId={activeDrawing.id}
                  drawingUrl={activeDrawing.url}
                  drawingName={activeDrawing.fileName}
                  marks={marks}
                  onUpdate={() => loadMarksForDrawing(activeProject.id, activeDrawing.id)}
                  canEdit={!isShareView || guestCanEdit}
                  shareToken={shareToken || undefined}
                />
              ) : (
                <div className="w-full h-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
                  <ImageIcon className="h-10 w-10 text-slate-400 stroke-1 mb-2 animate-pulse" />
                  <p className="text-xs font-semibold text-slate-700">No Drawings Uploaded</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Please upload an image blueprint to place marks.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Elegant Status Footer */}
      <footer className="h-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-600"></div>
            <span className="text-[10px] font-medium text-slate-500">Firebase Synchronization Enabled</span>
          </div>
          <div className="text-[10px] text-slate-400">Drawings: {drawings.length}</div>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-medium text-slate-500">
          <span>Role: <b>{isShareView ? (guestCanEdit ? 'Guest Editor' : 'Guest Read-Only') : 'Admin (Full)'}</b></span>
          <span>Storage: {simulatedStorageUsed} MB / 50 MB</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
