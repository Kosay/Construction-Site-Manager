import React, { useEffect, useState } from 'react';
import { Project } from '../../types';
import { getProjects } from '../../lib/firestore';
import { useAuth } from '../../lib/authContext';
import { JoinedProject } from '../../lib/joinedProjects';
import { Loader2, AlertCircle, Folder, KeyRound, ArrowRight, Eye, Edit3, X } from 'lucide-react';

interface MobileProjectsListProps {
  onSelectProject: (projectId: string) => void;
  onJoinWithCode: (code: string) => Promise<string | null>;
  joinedProjects: JoinedProject[];
  onRemoveJoined: (projectId: string) => void;
  showOwnProjects: boolean;
}

export const MobileProjectsList: React.FC<MobileProjectsListProps> = ({
  onSelectProject,
  onJoinWithCode,
  joinedProjects,
  onRemoveJoined,
  showOwnProjects,
}) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(showOwnProjects);
  const [error, setError] = useState<string | null>(null);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768);

  // Join-with-code state
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => setIsTablet(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!showOwnProjects) {
      setLoading(false);
      return;
    }
    const loadProjects = async () => {
      if (!user?.uid) return;
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
  }, [user?.uid, showOwnProjects]);

  const handleJoin = async () => {
    setJoining(true);
    setJoinError(null);
    const err = await onJoinWithCode(joinCode);
    if (err) {
      setJoinError(err);
      setJoining(false);
    }
    // On success the parent navigates away; no reset needed.
  };

  const handleOpenJoined = async (entry: JoinedProject) => {
    setOpeningId(entry.projectId);
    const err = await onJoinWithCode(entry.code);
    if (err) {
      setJoinError(`${entry.projectName}: ${err}`);
      setOpeningId(null);
    }
  };

  const hasContent = joinedProjects.length > 0 || (showOwnProjects && projects.length > 0);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Projects</h2>
          <button
            onClick={() => {
              setJoinOpen((v) => !v);
              setJoinError(null);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg active:scale-95 transition"
            title="Join a project with a code"
          >
            <KeyRound className="h-4 w-4" /> Join with code
          </button>
        </div>

        {joinOpen && (
          <div className="mt-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Enter a project code
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
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Ask the project owner to send you a code from the Share screen.
            </p>
          </div>
        )}

        {joinError && !joinOpen && (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{joinError}</p>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading projects...</p>
            </div>
          </div>
        ) : !hasContent ? (
          <div className="flex items-center justify-center h-full p-6">
            <div className="text-center">
              <Folder className="h-14 w-14 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No projects yet</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tap <span className="font-semibold">Join with code</span> and enter the code your
                project owner shared with you.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Joined-by-code projects */}
            {joinedProjects.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Shared with me
                </h3>
                <div className={isTablet ? 'grid grid-cols-2 lg:grid-cols-3 gap-3' : 'space-y-2'}>
                  {joinedProjects.map((jp) => (
                    <div
                      key={jp.projectId}
                      className="relative p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <button
                        onClick={() => onRemoveJoined(jp.projectId)}
                        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-500"
                        title="Remove from this device"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenJoined(jp)}
                        disabled={openingId === jp.projectId}
                        className="w-full text-left"
                      >
                        <div className="flex items-start gap-2 mb-2 pr-5">
                          <Folder className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 line-clamp-2">
                            {jp.projectName}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              jp.accessLevel === 'edit'
                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {jp.accessLevel === 'edit' ? <Edit3 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {jp.accessLevel === 'edit' ? 'Can upload' : 'View only'}
                          </span>
                          {openingId === jp.projectId && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                          )}
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* The user's own projects */}
            {showOwnProjects && projects.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  My projects
                </h3>
                {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
                <div className={isTablet ? 'grid grid-cols-2 lg:grid-cols-3 gap-3' : 'space-y-2'}>
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => onSelectProject(project.id)}
                      className="text-left p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg active:bg-slate-100 dark:active:bg-slate-700 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <Folder className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <div className="font-semibold text-sm md:text-base text-slate-900 dark:text-slate-100 line-clamp-2">
                          {project.projectName}
                        </div>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                        <p className="line-clamp-2">{project.description}</p>
                        <p className="text-slate-500 dark:text-slate-500 text-[10px]">
                          {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'recently'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
