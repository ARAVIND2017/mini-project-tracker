import { createContext, useContext } from 'react';
import type { Viewer } from '@/domain/workspace';
import type { ProjectWorkspace } from '@/lib/research';

export interface WorkspaceValue {
  ws: ProjectWorkspace;
  viewer: Viewer;
  /** The semester is closed: everything is read-only. */
  readOnly: boolean;
  busy: boolean;
  /** Runs a workflow action, shows its result and reloads the project. Resolves to true on success. */
  act: (fn: () => Promise<unknown>, success: string) => Promise<boolean>;
}

export const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside the project page');
  return value;
}
