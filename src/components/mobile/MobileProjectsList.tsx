import React, { useEffect, useState } from 'react';
import { Project } from '../../types';
import { getProjects } from '../../lib/firestore';
import { useAuth } from '../../lib/authContext';
import { Loader2, AlertCircle, Folder } from 'lucide-react';

interface MobileProjectsListProps {
  onSelectProject: (projectId: string) => void;
}

export const MobileProjectsList: React.FC<MobileProjectsListProps> = ({ onSelectProject }) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No projects yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 md:p-4 pb-20 ${isTablet ? 'grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4' : 'space-y-2'}`}>
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
  );
};
