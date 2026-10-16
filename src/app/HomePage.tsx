import { STAGES } from '@/domain/constants';

export function HomePage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Research-Based Mini-Project Tracker</h1>
      <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
        Foundation build (Phase 1). Sign-in, roles and project workspaces arrive in the next phases.
      </p>
      <h2 className="mt-8 text-lg font-medium">Project lifecycle</h2>
      <ol className="mt-3 grid gap-2 sm:grid-cols-3">
        {STAGES.map((stage) => (
          <li
            key={stage.key}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <span className="text-slate-500 dark:text-slate-400">Stage {stage.no}</span>
            <div className="font-medium">{stage.name}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
