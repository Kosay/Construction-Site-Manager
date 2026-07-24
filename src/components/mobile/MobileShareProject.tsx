import React, { useEffect, useState } from 'react';
import {
  Share2, Copy, Check, Trash2, Loader2, Eye, Edit3, X, ShieldAlert,
} from 'lucide-react';
import { Share } from '@capacitor/share';
import { createShareLink, getProjectShareLinks, revokeShareLink } from '../../lib/firestore';
import { ShareLink } from '../../types';

interface MobileShareProjectProps {
  projectId: string;
  adminUid: string;
  projectName?: string;
  onClose: () => void;
}

const EXPIRY_OPTIONS: { label: string; value: number | null }[] = [
  { label: '1 day', value: 1 },
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: 'Never', value: null },
];

export const MobileShareProject: React.FC<MobileShareProjectProps> = ({
  projectId,
  adminUid,
  projectName,
  onClose,
}) => {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<'view' | 'edit' | null>(null);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(7);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchLinks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectShareLinks(projectId);
      setLinks(data || []);
    } catch (err: any) {
      console.error('Failed to load share links:', err);
      setError('Failed to load existing codes.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (level: 'view' | 'edit') => {
    setGenerating(level);
    setError(null);
    try {
      await createShareLink(projectId, level, expiresInDays, adminUid);
      await fetchLinks();
    } catch (err: any) {
      console.error('Failed to create share code:', err);
      setError('Failed to create code. Check your connection and permissions.');
    } finally {
      setGenerating(null);
    }
  };

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // clipboard may be unavailable; ignore
    }
  };

  const handleShare = async (link: ShareLink) => {
    const access = link.accessLevel === 'edit' ? 'view & edit' : 'view-only';
    const text =
      `You're invited to ${projectName || 'a project'} on Construction Site Manager.\n\n` +
      `Open the app, tap "Join with code", and enter this ${access} code:\n\n${link.token}`;
    // Prefer the native share sheet (WhatsApp/SMS/etc.) via Capacitor; fall back to
    // the Web Share API, then to copying the code.
    try {
      await Share.share({ title: 'Construction Site Manager', text, dialogTitle: 'Share project code' });
      return;
    } catch (err: any) {
      // A thrown "canceled"/"Share canceled" just means the user dismissed the sheet.
      if (/cancel/i.test(err?.message || '')) return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Construction Site Manager', text });
        return;
      }
    } catch {
      // ignore and fall through to copy
    }
    await handleCopy(link.token);
  };

  const handleRevoke = async (token: string) => {
    if (!window.confirm('Revoke this code? Anyone using it will lose access immediately.')) return;
    try {
      await revokeShareLink(token);
      setLinks((prev) => prev.filter((l) => l.token !== token));
    } catch (err) {
      console.error('Failed to revoke code:', err);
    }
  };

  const sorted = [...links].sort((a, b) => {
    const t = (x: any) => (x?.toDate ? x.toDate().getTime() : x ? new Date(x).getTime() : 0);
    return t(b.createdAt) - t(a.createdAt);
  });

  return (
    <div className="fixed inset-0 z-[70] bg-white dark:bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Share Project</h2>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24">
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Generate a code and send it to your team. They open the app, tap
          <span className="font-semibold"> "Join with code"</span>, and enter it to get access.
        </p>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-lg text-xs flex items-start gap-2 border border-rose-200 dark:border-rose-900/30">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Expiry selector */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Code expires after</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {EXPIRY_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setExpiresInDays(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  expiresInDays === opt.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleCreate('view')}
            disabled={generating !== null}
            className="flex flex-col items-center gap-1.5 py-4 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg active:scale-95 transition disabled:opacity-50"
          >
            {generating === 'view' ? (
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
            ) : (
              <Eye className="h-5 w-5 text-blue-500" />
            )}
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">View only</span>
            <span className="text-[10px] text-slate-500">Can look, not edit</span>
          </button>
          <button
            onClick={() => handleCreate('edit')}
            disabled={generating !== null}
            className="flex flex-col items-center gap-1.5 py-4 px-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-lg active:scale-95 transition disabled:opacity-50"
          >
            {generating === 'edit' ? (
              <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />
            ) : (
              <Edit3 className="h-5 w-5 text-emerald-500" />
            )}
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">View &amp; edit</span>
            <span className="text-[10px] text-slate-500">Can add marks/photos</span>
          </button>
        </div>

        {/* Existing codes */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active codes</h3>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs py-4">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> Loading…
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
              No codes yet. Generate one above.
            </div>
          ) : (
            sorted.map((link) => (
              <div
                key={link.token}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      link.accessLevel === 'edit'
                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {link.accessLevel === 'edit' ? <Edit3 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {link.accessLevel === 'edit' ? 'View & edit' : 'View only'}
                  </span>
                  <button
                    onClick={() => handleRevoke(link.token)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded"
                    title="Revoke"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="font-mono text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 break-all select-all">
                  {link.token}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(link.token)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg active:scale-95 transition"
                  >
                    {copiedToken === link.token ? (
                      <><Check className="h-4 w-4 text-emerald-600" /> Copied</>
                    ) : (
                      <><Copy className="h-4 w-4" /> Copy code</>
                    )}
                  </button>
                  <button
                    onClick={() => handleShare(link)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg active:scale-95 transition"
                  >
                    <Share2 className="h-4 w-4" /> Share
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
