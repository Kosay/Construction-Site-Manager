import React, { useEffect, useState } from 'react';
import { Project } from '../types';
import { getProjects } from '../lib/firestore';
import { useAuth } from '../lib/authContext';
import { Loader2, AlertCircle } from 'lucide-react';

interface MobileProjectsListProps {
  onSelectProject: (projectId: string) => void;
}

export const MobileProjectsList: React.FC<MobileProjectsListProps> = ({ onSelectProject }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-2 p-3 pb-20">
      {projects.map((project) => (
        <button
          key={project.id}
          onClick={() => onSelectProject(project.id)}
          className="w-full text-left p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg active:bg-slate-100 dark:active:bg-slate-700 transition-colors"
        >
          <div className="font-semibold text-base text-slate-900 dark:text-slate-100 mb-2">
            {project.projectName}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <p>{project.description}</p>
            <p className="text-slate-500 dark:text-slate-500">
              Created {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'recently'}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
};
