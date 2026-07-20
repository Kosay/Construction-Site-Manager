import React, { useEffect, useState } from 'react';
import { Project } from '../../types';
import { getProjects } from '../../lib/firestore';
import { useAuth } from '../../lib/authContext';
import { Loader2, AlertCircle, Folder, Plus } from 'lucide-react';

interface MobileProjectsListProps {
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
}

export const MobileProjectsList: React.FC<MobileProjectsListProps> = ({
  onSelectProject,
  onNewProject,
}) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsTablet(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
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
  }, [user?.uid]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Header with New Project button */}
      <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Projects</h2>
        <button
          onClick={onNewProject}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg active:scale-95 transition"
        >
          <Plus className="h-4 w-4" /> New
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading projects...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full p-4">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex items-center justify-center h-full p-6">
            <div className="text-center">
              <Folder className="h-14 w-14 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No projects yet</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">
                Create your first construction project to get started.
              </p>
              <button
                onClick={onNewProject}
                className="inline-flex items-center gap-1.5 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg active:scale-95 transition"
              >
                <Plus className="h-4 w-4" /> New Project
              </button>
            </div>
          </div>
        ) : (
          <div className={`p-3 md:p-4 pb-24 ${isTablet ? 'grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4' : 'space-y-2'}`}>
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className="text-left p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg active:bg-slate-100 dark:active:bg-slate-700 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all"
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
        )}

        {/* Floating action button (when list has items) */}
        {!loading && !error && projects.length > 0 && (
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
