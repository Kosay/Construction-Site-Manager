import React, { useState, useEffect } from 'react';
import { Drawing, Mark } from '../types';
import { getDrawings, getMarks } from '../lib/firestore';
import { MobileProjectsList } from './MobileProjectsList';
import { MobileDrawingViewer } from './MobileDrawingViewer';
import { MobilePhotoCapture } from './MobilePhotoCapture';
import { MobileGPSScreen } from './MobileGPSScreen';
import { MobileMarksList } from './MobileMarksList';
import { MobileBottomNav } from './MobileBottomNav';

type Screen = 'projects' | 'drawing' | 'marks' | 'photo' | 'gps';

interface MobileAppProps {
  onSignOut: () => void;
}

export const MobileApp: React.FC<MobileAppProps> = ({ onSignOut }) => {
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

  useEffect(() => {
    const handleResize = () => {
      setIsTablet(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleProjectSelect = async (projectId: string) => {
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
        onSignOut();
        break;
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
      {/* Screens */}
      {currentScreen === 'projects' && (
        <MobileProjectsList onSelectProject={handleProjectSelect} />
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
