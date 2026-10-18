import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Button, Card, TextField } from '@/components/ui';
import { STAGES } from '@/domain/constants';
import {
  listMyProjects,
  listMyRosterEntries,
  setMyDriveFolder,
  setProjectTitle,
  type ProjectRow,
} from '@/lib/api';

/** The student's own project: domain, guide, current stage, title and Drive folder. */
export function MyProjectCard({ userId }: { userId: string }) {
  const projects = useQuery({
    queryKey: ['my-projects', userId],
    queryFn: () => listMyProjects(userId),
  });
  const roster = useQuery({
    queryKey: ['my-roster', userId],
    queryFn: () => listMyRosterEntries(userId),
  });

  if (projects.isPending || roster.isPending) return null;
  if (projects.error) return <Alert tone="error">{projects.error.message}</Alert>;
  if (projects.data.length === 0) return null;

  return (
    <div className="space-y-4">
      {projects.data.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          userId={userId}
          driveUrl={roster.data?.find((r) => r.id === p.student_id)?.drive_folder_url ?? ''}
        />
      ))}
    </div>
  );
}

function ProjectCard({
  project: p,
  userId,
  driveUrl,
}: {
  project: ProjectRow;
  userId: string;
  driveUrl: string;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(p.title ?? '');
  const [drive, setDrive] = useState(driveUrl);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const stage = STAGES.find((s) => s.key === p.current_stage);

  const save = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-projects', userId] }),
        queryClient.invalidateQueries({ queryKey: ['my-roster', userId] }),
      ]),
    onError: (err) => setMessage({ tone: 'error', text: err.message }),
  });
  const run = (fn: () => Promise<unknown>, success: string) => {
    setMessage(null);
    save.mutate(fn, { onSuccess: () => setMessage({ tone: 'success', text: success }) });
  };

  return (
    <Card title="My project">
      {message && (
        <div className="mb-3">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Domain</dt>
          <dd className="font-medium">{p.domain_name ?? 'Not set yet'}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Guide</dt>
          <dd className="font-medium">{p.guide_name ?? 'Not assigned yet'}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Co-reviewers</dt>
          <dd>{p.co_reviewer_names?.length ? p.co_reviewer_names.join(', ') : '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Current stage</dt>
          <dd>{stage ? `${stage.no}. ${stage.name}` : 'All stages complete'}</dd>
        </div>
      </dl>

      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => setProjectTitle(p.id as string, title), 'Working title saved.');
        }}
      >
        <TextField
          className="min-w-64 flex-1"
          label="Working title"
          placeholder="You can refine this until your objectives are approved"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button
          type="submit"
          variant="secondary"
          busy={save.isPending}
          disabled={title === (p.title ?? '')}
        >
          Save title
        </Button>
      </form>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => setMyDriveFolder(p.student_id as string, drive), 'Drive folder link saved.');
        }}
      >
        <TextField
          className="min-w-64 flex-1"
          label="My Google Drive folder"
          placeholder="https://drive.google.com/drive/folders/…"
          hint="Share the folder with your guide. The app stores only the link."
          value={drive}
          onChange={(e) => setDrive(e.target.value)}
        />
        <Button
          type="submit"
          variant="secondary"
          busy={save.isPending}
          disabled={drive === driveUrl}
        >
          Save link
        </Button>
        {driveUrl && (
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pb-2 text-sm text-blue-700 underline dark:text-blue-300"
          >
            Open folder
          </a>
        )}
      </form>
    </Card>
  );
}
