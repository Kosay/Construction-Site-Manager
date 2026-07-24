import React, { useEffect, useState } from 'react';
import { Project } from '../../types';
import { getProjects } from '../../lib/firestore';
import { useAuth } from '../../lib/authContext';
import { Loader2, AlertCircle, Folder, Plus, KeyRound, ArrowRight, Trash2 } from 'lucide-react';

interface MobileProjectsListProps {
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
  onJoinWithCode: (code: string) => Promise<string | null>;
}

export const MobileProjectsList: React.FC<MobileProjectsListProps> = ({
  onSelectProject,
  onNewProject,
  onJoinWithCode,
}) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [savedProjects, setSavedProjects] = useState<{token: string, projectId: string, projectName: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768);

  // Join-with-code state
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('csm_saved_projects') || '[]');
      setSavedProjects(saved);
    } catch {
      setSavedProjects([]);
    }
  }, []);

  const handleJoin = async () => {
    setJoining(true);
    setJoinError(null);
    const err = await onJoinWithCode(joinCode);
    if (err) {
      setJoinError(err);
      setJoining(false);
    }
    // On success the parent navigates away; no need to reset state here.
  };

  useEffect(() => {
    const handleResize = () => {
      setIsTablet(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadProjects = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      try {
        const data = await getProjects(user.uid);
        setProjects(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load projects:', err);
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [user?.uid]);

  const handleRemoveSaved = (e: React.MouseEvent, token: string) => {
    e.stopPropagation();
    const updated = savedProjects.filter(p => p.token !== token);
    setSavedProjects(updated);
    localStorage.setItem('csm_saved_projects', JSON.stringify(updated));
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Header with New Project button */}
      <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Projects</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setJoinOpen((v) => !v);
                setJoinError(null);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg active:scale-95 transition"
              title="Join a shared project with a code"
            >
              <KeyRound className="h-4 w-4" /> Join
            </button>
            {user?.uid && (
              <button
                onClick={onNewProject}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg active:scale-95 transition"
              >
                <Plus className="h-4 w-4" /> New
              </button>
            )}
          </div>
        </div>

        {/* Join with code box */}
        {joinOpen && (
          <div className="mt-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Join with a code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && joinCode.trim() && !joining) handleJoin();
                }}
                placeholder="Paste the shared code"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="flex-1 px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100 font-mono"
              />
              <button
                onClick={handleJoin}
                disabled={joining || !joinCode.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 active:scale-95 transition"
              >
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
            {joinError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{joinError}</p>
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Ask the project owner to send you a code from the Share screen.
            </p>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto relative p-3 md:p-4 space-y-6 pb-24">
        {/* Saved Projects (Joined via code) */}
        {savedProjects.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Saved Projects</h3>
            <div className={`space-y-2 ${isTablet ? 'grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 space-y-0' : ''}`}>
              {savedProjects.map((p) => (
                <div key={p.token} className="relative group">
                  <button
                    onClick={() => onJoinWithCode(p.token)}
                    className="w-full text-left p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg active:bg-blue-100 dark:active:bg-blue-900/40 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <KeyRound className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                      <div className="font-semibold text-sm md:text-base text-slate-900 dark:text-slate-100 line-clamp-2">
                        {p.projectName}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 pl-6">
                      Shared code: {p.token}
                    </div>
                  </button>
                  <button
                    onClick={(e) => handleRemoveSaved(e, p.token)}
                    className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-500 bg-white/50 dark:bg-slate-800/50 rounded-md transition"
                    title="Remove saved project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Projects */}
        {user?.uid && (
          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">My Projects</h3>
            {loading ? (
              <div className="text-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Loading...</p>
              </div>
            ) : error ? (
              <div className="text-center py-6 text-red-500 text-sm">
                {error}
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                <p className="text-sm text-slate-500">No projects yet</p>
                <button onClick={onNewProject} className="text-sm text-blue-600 font-semibold mt-2">Create one</button>
              </div>
            ) : (
              <div className={`space-y-2 ${isTablet ? 'grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 space-y-0' : ''}`}>
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                    className="w-full text-left p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg active:bg-slate-100 dark:active:bg-slate-700 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <Folder className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                      <div className="font-semibold text-sm md:text-base text-slate-900 dark:text-slate-100 line-clamp-2">
                        {project.projectName}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 pl-6">
                      <p className="line-clamp-2">{project.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state if not logged in and no saved projects */}
        {!user?.uid && savedProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <KeyRound className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-medium px-8">
              Join a project using a code shared by your team to get started.
            </p>
          </div>
        )}

        {/* Floating action button */}
        {user?.uid && !loading && !error && projects.length > 0 && (
          <button
            onClick={onNewProject}
            className="fixed bottom-20 right-4 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center active:scale-95 transition z-40"
            aria-label="New project"
          >
            <Plus className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
};
