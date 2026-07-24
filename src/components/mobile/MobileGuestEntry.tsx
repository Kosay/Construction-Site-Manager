import React, { useState } from 'react';
import { KeyRound, LogIn, ChevronLeft, Loader2, ArrowRight, Eye, Edit3, Folder } from 'lucide-react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { validateShareLink } from '../../lib/firestore';
import { listJoinedProjects } from '../../lib/joinedProjects';
import { AuthPage } from '../AuthPage';

interface MobileGuestEntryProps {
  // Hands the validated code up to the router so MobileApp can auto-open it
  // once anonymous sign-in completes.
  onGuestCode: (code: string) => void;
}

export const MobileGuestEntry: React.FC<MobileGuestEntryProps> = ({ onGuestCode }) => {
  const [mode, setMode] = useState<'menu' | 'code' | 'signin'>('menu');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = listJoinedProjects();

  const startGuestSession = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) {
      setError('Please enter a code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Validate the code first (share links are publicly readable), so we only
      // start an anonymous session for a real code.
      const link = await validateShareLink(trimmed);
      if (!link) {
        setError('This code is invalid, expired, or revoked.');
        setBusy(false);
        return;
      }
      onGuestCode(trimmed);
      await signInAnonymously(auth);
      // AppRouter now re-renders into MobileApp with this code and opens it.
    } catch (err) {
      console.error('Guest session failed:', err);
      setError('Could not start a guest session. Check your connection and try again.');
      setBusy(false);
    }
  };

  if (mode === 'signin') {
    return (
      <div className="fixed inset-0 bg-white dark:bg-slate-900 flex flex-col overflow-y-auto">
        <div className="p-3">
          <button
            onClick={() => setMode('menu')}
            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm font-semibold"
          >
            <ChevronLeft className="h-5 w-5" /> Back
          </button>
        </div>
        <div className="flex-1">
          <AuthPage />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-900 flex flex-col overflow-y-auto">
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 max-w-md mx-auto w-full">
        <div className="text-center">
          <img src="/app-icon.png" alt="" className="h-20 w-20 mx-auto mb-3 rounded-2xl" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Construction Site Manager</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Upload site photos with a project code — no account needed.
          </p>
        </div>

        {error && (
          <div className="w-full p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-lg text-sm border border-rose-200 dark:border-rose-900/30">
            {error}
          </div>
        )}

        {mode === 'code' ? (
          <div className="w-full space-y-3">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Enter your project code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && code.trim() && !busy) startGuestSession(code);
                }}
                placeholder="Paste the shared code"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="flex-1 px-3 py-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100 font-mono"
              />
              <button
                onClick={() => startGuestSession(code)}
                disabled={busy || !code.trim()}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center gap-1.5 active:scale-95 transition"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              </button>
            </div>
            <button
              onClick={() => { setMode('menu'); setError(null); }}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              ← Back
            </button>
          </div>
        ) : (
          <div className="w-full space-y-3">
            <button
              onClick={() => { setMode('code'); setError(null); }}
              className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg active:scale-95 transition"
            >
              <KeyRound className="h-5 w-5" /> I have a project code
            </button>
            <button
              onClick={() => { setMode('signin'); setError(null); }}
              className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-lg active:scale-95 transition border border-slate-200 dark:border-slate-700"
            >
              <LogIn className="h-5 w-5" /> Sign in / Create account
            </button>
          </div>
        )}

        {/* Previously joined projects (one tap to reopen) */}
        {mode === 'menu' && saved.length > 0 && (
          <div className="w-full">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Recent projects
            </h3>
            <div className="space-y-2">
              {saved.map((jp) => (
                <button
                  key={jp.projectId}
                  onClick={() => startGuestSession(jp.code)}
                  disabled={busy}
                  className="w-full text-left p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-2 active:scale-[0.99] transition disabled:opacity-50"
                >
                  <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {jp.projectName}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      jp.accessLevel === 'edit'
                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {jp.accessLevel === 'edit' ? <Edit3 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {jp.accessLevel === 'edit' ? 'Upload' : 'View'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
