// Remembers projects the user has joined by share code, on this device, so they
// don't have to re-enter the code every time. Stored in localStorage.

export interface JoinedProject {
  code: string;
  projectId: string;
  projectName: string;
  accessLevel: 'view' | 'edit';
  joinedAt: string; // ISO timestamp of last open
}

const KEY = 'joinedProjects';

export function listJoinedProjects(): JoinedProject[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JoinedProject[]) : [];
  } catch {
    return [];
  }
}

export function saveJoinedProject(entry: Omit<JoinedProject, 'joinedAt'>): void {
  try {
    const existing = listJoinedProjects().filter((p) => p.projectId !== entry.projectId);
    const next: JoinedProject[] = [{ ...entry, joinedAt: new Date().toISOString() }, ...existing];
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, 50)));
  } catch {
    // storage unavailable — ignore
  }
}

export function removeJoinedProject(projectId: string): void {
  try {
    const next = listJoinedProjects().filter((p) => p.projectId !== projectId);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}
