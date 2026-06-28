import React, { useState, useEffect } from 'react';
import { Share2, Copy, Trash2, Calendar, ShieldCheck, ShieldAlert, Check, Loader2 } from 'lucide-react';
import { createShareLink, getProjectShareLinks, revokeShareLink } from '../lib/firestore';
import { ShareLink } from '../types';

interface ShareLinkGeneratorProps {
  projectId: string;
  adminUid: string;
}

export const ShareLinkGenerator: React.FC<ShareLinkGeneratorProps> = ({ projectId, adminUid }) => {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [accessLevel, setAccessLevel] = useState<'view' | 'edit'>('view');
  const [expiresInDays, setExpiresInDays] = useState<number | null>(7); // default 7 days

  useEffect(() => {
    fetchLinks();
  }, [projectId]);

  const fetchLinks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectShareLinks(projectId);
      setLinks(data || []);
    } catch (err: any) {
      console.error('Failed to load share links:', err);
      let errMsg = 'Failed to load active share links.';
      try {
        const parseErr = JSON.parse(err.message);
        if (parseErr.error) errMsg = parseErr.error;
      } catch (e) {}
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async () => {
    setGenerating(true);
    setError(null);
    try {
      const newLink = await createShareLink(projectId, accessLevel, expiresInDays, adminUid);
      if (newLink) {
        // Create local optimistic friendly representation to avoid transient rendering of unpopulated ServerTimestamp
        const clientFriendlyLink: ShareLink = {
          ...newLink,
          createdAt: new Date(),
          expiresAt: expiresInDays 
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            : null
        };
        setLinks(prevLinks => [clientFriendlyLink, ...prevLinks.filter(l => l.token !== newLink.token)]);
      }
      await fetchLinks();
    } catch (err: any) {
      console.error('Failed to create share link:', err);
      let errMsg = 'Failed to create share link. Check security rules.';
      try {
        const parseErr = JSON.parse(err.message);
        if (parseErr.error) errMsg = parseErr.error;
      } catch (e) {}
      setError(errMsg);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeLink = async (token: string) => {
    if (!window.confirm('Are you sure you want to revoke this share link? Anyone using it will immediately lose access.')) {
      return;
    }
    try {
      await revokeShareLink(token);
      setLinks(links.filter(l => l.token !== token));
    } catch (error) {
      console.error('Failed to revoke share link:', error);
    }
  };

  const handleCopyLink = (token: string) => {
    const origin = window.location.origin + window.location.pathname;
    const fullLink = `${origin}?share=${token}`;
    
    navigator.clipboard.writeText(fullLink);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 bg-white dark:bg-slate-900 p-6 rounded border border-slate-200 dark:border-slate-800 shadow">
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
        <Share2 className="h-5 w-5 text-blue-600 animate-pulse" />
        <div>
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Generate Shareable Guest Access Link</h3>
          <p className="text-[11px] text-slate-500">Generate temporary links for construction clients or site partners.</p>
        </div>
      </div>

      {/* Generator controls */}
      <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Permission Level
          </label>
          <select
            value={accessLevel}
            onChange={(e) => setAccessLevel(e.target.value as 'view' | 'edit')}
            className="w-full p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            <option value="view">Read-Only (View drawings & models)</option>
            <option value="edit">Read-Write (Add marks & evidence)</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Link Expiration
          </label>
          <select
            value={expiresInDays === null ? 'never' : expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value === 'never' ? null : Number(e.target.value))}
            className="w-full p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            <option value={1}>Expires in 1 Day</option>
            <option value={7}>Expires in 7 Days</option>
            <option value={30}>Expires in 30 Days</option>
            <option value="never">Never Expires (Permanent)</option>
          </select>
        </div>

        <button
          onClick={handleCreateLink}
          disabled={generating}
          className="w-full p-2 bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" />
              <span>Generate Access Link</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded text-xs flex items-start gap-2.5 border border-rose-200 dark:border-rose-900/30">
          <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-rose-500 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block mb-0.5">Authorization / Execution Warning</span>
            <span className="leading-relaxed">{error}</span>
          </div>
        </div>
      )}

      {/* Generated Links List */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Guest Links</h4>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-4">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span>Loading active links...</span>
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded">
            No active share links. Generate one above to invite guest engineers.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded overflow-hidden bg-white dark:bg-slate-950">
            {links.map((link) => {
              const fullUrl = `${window.location.origin}${window.location.pathname}?share=${link.token}`;
              
              return (
                <div key={link.token} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1.5 max-w-md truncate">
                    <div className="flex items-center gap-2">
                      {link.accessLevel === 'edit' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30">
                          <ShieldCheck className="h-3 w-3" />
                          <span>Read-Write</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <ShieldAlert className="h-3 w-3" />
                          <span>Read-Only</span>
                        </span>
                      )}
                      
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Expires: {formatDate(link.expiresAt)}</span>
                      </span>
                    </div>

                    <div className="text-[11px] font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-900 text-slate-600 dark:text-slate-400 truncate select-all flex items-center justify-between">
                      <span className="truncate pr-4">{fullUrl}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCopyLink(link.token)}
                      className="p-1.5 border border-slate-200 dark:border-slate-800 rounded hover:bg-slate-50 hover:text-blue-600 cursor-pointer text-slate-500 transition"
                      title="Copy link to clipboard"
                    >
                      {copiedToken === link.token ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRevokeLink(link.token)}
                      className="p-1.5 border border-red-100 dark:border-red-900/40 text-red-500 hover:bg-red-50 hover:text-red-600 rounded cursor-pointer transition"
                      title="Revoke access immediately"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
