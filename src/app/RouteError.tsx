import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { LogoMark } from '@/components/icons';

function ErrorMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <LogoMark className="mx-auto h-10 w-10" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">{body}</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800 dark:bg-blue-600"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

/** Same wording for "missing" and "not yours", so access checks do not reveal that a record exists. */
export function NotFoundPage() {
  return (
    <ErrorMessage
      title="Page not found"
      body="The page does not exist, or you do not have access to it."
    />
  );
}

/** Friendly error screen; never shows stack traces or internal messages to users. */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  if (import.meta.env.DEV) console.error(error);
  return (
    <ErrorMessage
      title="Something went wrong"
      body="Please try again. If the problem continues, contact the administrator."
    />
  );
}
