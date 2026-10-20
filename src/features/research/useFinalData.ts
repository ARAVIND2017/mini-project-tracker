import { useQuery } from '@tanstack/react-query';
import { getFinalData } from '@/lib/final';
import { useWorkspace } from './workspaceContext';

/** S6–S9 records of the current project (reloaded after every workflow action). */
export function useFinalData() {
  const { ws } = useWorkspace();
  const projectId = ws.project.id as string;
  return useQuery({
    queryKey: ['final', projectId],
    queryFn: () => getFinalData(projectId, ws.project.semester_id as string),
  });
}
