import React from 'react';
import { Home, Map, List, Settings } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'projects' | 'drawing' | 'marks' | 'settings';
  onTabChange: (tab: 'projects' | 'drawing' | 'marks' | 'settings') => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onTabChange }) => {
  const navItems = [
    { id: 'projects', label: 'Projects', icon: Home },
    { id: 'drawing', label: 'Drawing', icon: Map },
    { id: 'marks', label: 'Marks', icon: List },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-around h-16 z-50 safe-area-inset-bottom">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={`flex flex-col items-center justify-center gap-1 flex-1 transition-colors ${
            activeTab === id
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Icon className="h-5 w-5" />
          <span className="text-[10px] font-semibold">{label}</span>
        </button>
      ))}
    </div>
  );
};
