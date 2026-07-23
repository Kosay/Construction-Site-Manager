import React, { useState, useEffect } from 'react';
import { Drawing, Mark } from '../../types';
import { getDrawings, getMarks, validateShareLink, getProject } from '../../lib/firestore';
import { useAuth } from '../../lib/authContext';
import { MobileProjectsList } from './MobileProjectsList';
import { MobileDrawingViewer } from './MobileDrawingViewer';
import { MobilePhotoCapture } from './MobilePhotoCapture';
import { MobileGPSScreen } from './MobileGPSScreen';
import { MobileMarksList } from './MobileMarksList';
import { MobileSettings } from './MobileSettings';
import { MobileBottomNav } from './MobileBottomNav';
import { ProjectForm } from '../ProjectForm';
import { ChevronLeft } from 'lucide-react';

type Screen = 'projects' | 'drawing' | 'marks' | 'photo' | 'gps' | 'settings' | 'new-project';

interface MobileAppProps {
  onSignOut: () => void;
}

export const MobileApp: React.FC<MobileAppProps> = ({ onSignOut }) => {
  const { user } = useAuth();
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768);
  const [activeTab, setActiveTab] = useState<'projects' | 'drawing' | 'marks' | 'settings'>(
    'projects'
  );
  const [currentScreen, setCurrentScreen] = useState<Screen>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(false);
  // Bumped to force MobileProjectsList to remount and refetch after changes
  const [projectsKey, setProjectsKey] = useState(0);
  // Shared-session state: set when the user opened a project via a share code
  const [sharedToken, setSharedToken] = useState<string | null>(null);
  const [sharedCanEdit, setSharedCanEdit] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsTablet(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleProjectSelect = async (projectId: string) => {
    // Selecting one of your own projects clears any shared-session context
    setSharedToken(null);
    setSharedCanEdit(false);
    setSelectedProjectId(projectId);
    setLoading(true);

    try {
      const drawingsData = await getDrawings(projectId);
      setDrawings(drawingsData);

      if (drawingsData.length > 0) {
        const firstDrawing = drawingsData[0];
        setSelectedDrawing(firstDrawing);
        setSelectedDrawingId(firstDrawing.id);

        const marksData = await getMarks(projectId, firstDrawing.id);
        setMarks(marksData);

        setCurrentScreen('drawing');
        setActiveTab('drawing');
      }
    } catch (err) {
      console.error('Failed to load project drawings:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open a project shared via a code. Returns an error message, or null on success.
  const handleJoinWithCode = async (code: string): Promise<string | null> => {
    const trimmed = code.trim();
    if (!trimmed) return 'Please enter a code.';

    try {
      const link = await validateShareLink(trimmed);
      if (!link) return 'This code is invalid, expired, or revoked.';

      const drawingsData = await getDrawings(link.projectId);
      if (drawingsData.length === 0) {
        return 'This shared project has no drawings to view yet.';
      }

      const firstDrawing = drawingsData[0];
      const marksData = await getMarks(link.projectId, firstDrawing.id);

      // Fetch project to get its name
      const project = await getProject(link.projectId);
      if (project) {
        try {
          const savedStr = localStorage.getItem('csm_saved_projects');
          let saved: {token: string, projectId: string, projectName: string}[] = [];
          if (savedStr) saved = JSON.parse(savedStr);
          
          // Remove if it exists
          saved = saved.filter(s => s.token !== trimmed);
          // Add to front
          saved.unshift({
            token: trimmed,
            projectId: link.projectId,
            projectName: project.projectName
          });
          localStorage.setItem('csm_saved_projects', JSON.stringify(saved));
        } catch (e) {
          console.error("Failed to save project to localStorage", e);
        }
      }

      setSharedToken(trimmed);
      setSharedCanEdit(link.accessLevel === 'edit');
      setSelectedProjectId(link.projectId);
      setDrawings(drawingsData);
      setSelectedDrawing(firstDrawing);
      setSelectedDrawingId(firstDrawing.id);
      setMarks(marksData);
      setCurrentScreen('drawing');
      setActiveTab('drawing');
      return null;
    } catch (err) {
      console.error('Join with code failed:', err);
      return 'Could not open the shared project. Check your connection and try again.';
    }
  };

  const handleDrawingChange = async (drawingId: string) => {
    if (!selectedProjectId) return;

    const drawing = drawings.find((d) => d.id === drawingId);
    if (drawing) {
      setSelectedDrawing(drawing);
      setSelectedDrawingId(drawing.id);

      try {
        const marksData = await getMarks(selectedProjectId, drawing.id);
        setMarks(marksData);
      } catch (err) {
        console.error('Failed to load marks:', err);
      }
    }
  };

  const handlePhotoCapture = (photoUrl: string) => {
    // Store photo for later attachment to mark
    sessionStorage.setItem('lastCapturedPhoto', photoUrl);
    setCurrentScreen('drawing');
  };

  const handleGPSCapture = (lat: number, lng: number, accuracy: number) => {
    // Store GPS for later attachment to mark
    sessionStorage.setItem(
      'lastCapturedGPS',
      JSON.stringify({ lat, lng, accuracy })
    );
    setCurrentScreen('drawing');
  };

  const handleTabChange = (tab: 'projects' | 'drawing' | 'marks' | 'settings') => {
    setActiveTab(tab);

    switch (tab) {
      case 'projects':
        // Leaving a shared session when going back to your own projects
        setSharedToken(null);
        setSharedCanEdit(false);
        setCurrentScreen('projects');
        break;
      case 'drawing':
        if (selectedProjectId && selectedDrawingId) {
          setCurrentScreen('drawing');
        }
        break;
      case 'marks':
        setCurrentScreen('marks');
        break;
      case 'settings':
        setCurrentScreen('settings');
        break;
    }
  };

  const handleNewProjectSuccess = (projectId: string) => {
    // Refresh the projects list, then open the newly created project
    setProjectsKey((k) => k + 1);
    handleProjectSelect(projectId);
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
      {/* Screens */}
      {currentScreen === 'projects' && (
        <MobileProjectsList
          key={projectsKey}
          onSelectProject={handleProjectSelect}
          onNewProject={() => setCurrentScreen('new-project')}
          onJoinWithCode={handleJoinWithCode}
        />
      )}

      {currentScreen === 'new-project' && user && (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900">
          <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 flex items-center gap-2">
            <button
              onClick={() => setCurrentScreen('projects')}
              className="flex items-center gap-1 text-blue-600 dark:text-blue-400"
            >
              <ChevronLeft className="h-5 w-5" /> Back
            </button>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">New Project</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-24">
            <ProjectForm
              userId={user.uid}
              onSuccess={handleNewProjectSuccess}
              onCancel={() => setCurrentScreen('projects')}
            />
          </div>
        </div>
      )}

      {currentScreen === 'settings' && (
        <MobileSettings onSignOut={onSignOut} />
      )}

      {currentScreen === 'drawing' && selectedDrawing && selectedProjectId && (
        <MobileDrawingViewer
          projectId={selectedProjectId}
          drawingId={selectedDrawingId!}
          drawing={selectedDrawing}
          onBack={() => setCurrentScreen('projects')}
          onPhotoCapture={() => setCurrentScreen('photo')}
          onGPSCapture={() => setCurrentScreen('gps')}
          onCreateMark={() => {
            // TODO: Open mark creation modal
          }}
          onShowMarksList={() => setCurrentScreen('marks')}
          canEdit={sharedToken ? sharedCanEdit : true}
          shareToken={sharedToken || undefined}
        />
      )}

      {currentScreen === 'photo' && (
        <MobilePhotoCapture
          onPhotoCapture={handlePhotoCapture}
          onBack={() => setCurrentScreen('drawing')}
        />
      )}

      {currentScreen === 'gps' && (
        <MobileGPSScreen
          onLocationCapture={handleGPSCapture}
          onBack={() => setCurrentScreen('drawing')}
        />
      )}

      {currentScreen === 'marks' && (
        <div className="flex flex-col h-full">
          <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 md:p-4">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-base md:text-lg">
              Marks ({marks.length})
            </h2>
          </div>
          <div className="flex-1 overflow-auto">
            {isTablet ? (
              <div className="p-3 md:p-4 grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 pb-20">
                {marks.map((mark) => (
                  <MobileMarksList
                    key={mark.id}
                    projectId={selectedProjectId!}
                    marks={[mark]}
                    onSelectMark={() => {
                      // TODO: Open mark details
                    }}
                  />
                ))}
                {marks.length === 0 && (
                  <div className="col-span-full flex items-center justify-center py-12">
                    <div className="text-center">
                      <p className="text-sm text-slate-500 dark:text-slate-400">No marks yet</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Create marks from the drawing screen</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <MobileMarksList
                projectId={selectedProjectId!}
                marks={marks}
                onSelectMark={() => {
                  // TODO: Open mark details
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <MobileBottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
};
