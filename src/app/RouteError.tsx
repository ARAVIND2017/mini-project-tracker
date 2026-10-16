import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

function ErrorMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">{body}</p>
      <Link to="/" className="mt-6 inline-block text-blue-700 underline dark:text-blue-300">
        Back to home
      </Link>
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
