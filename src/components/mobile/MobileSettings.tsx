import React, { useState } from 'react';
import { useAuth } from '../../lib/authContext';
import { updateProfile } from 'firebase/auth';
import { User as UserIcon, LogOut, Check, Loader2, Info, Mail } from 'lucide-react';

interface MobileSettingsProps {
  onSignOut: () => void;
}

const APP_VERSION = '1.0.0';

export const MobileSettings: React.FC<MobileSettingsProps> = ({ onSignOut }) => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem('custom_display_name') || user?.displayName || ''
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveName = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      localStorage.setItem('custom_display_name', displayName.trim());
      if (user) {
        await updateProfile(user, { displayName: displayName.trim() });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update display name:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Settings</h2>
      </div>

      <div className="flex-1 p-4 pb-24 space-y-6">
        {/* Account section */}
        <div>
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Account</h3>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                {(displayName || user?.email || '?').substring(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{user?.email || 'Guest user'}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Signed in</p>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                <UserIcon className="h-3.5 w-3.5" /> Display Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="flex-1 px-3 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                />
                <button
                  onClick={handleSaveName}
                  disabled={saving || !displayName.trim()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition active:scale-95"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : saved ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* About section */}
        <div>
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">About</h3>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <Info className="h-4 w-4 text-slate-400" /> App Version
              </div>
              <span className="text-sm text-slate-500 font-mono">{APP_VERSION}</span>
            </div>
            <div className="p-4">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Construction Site Manager — manage projects, blueprints, 3D models and
                geo-tagged site observations with photo evidence.
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                Developed by Eng. Kosay Hatem
              </p>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={onSignOut}
          className="w-full py-3.5 px-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-semibold rounded-lg flex items-center justify-center gap-2 border border-red-200 dark:border-red-900/40 active:scale-95 transition"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </div>
  );
};
