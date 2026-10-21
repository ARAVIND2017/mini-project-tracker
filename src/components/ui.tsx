import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-blue-700 text-white hover:bg-blue-800 focus-visible:outline-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500',
  secondary:
    'bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800',
  danger: 'bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-700',
};

export function Button({
  variant = 'primary',
  busy = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
    >
      {busy && (
        <span
          aria-hidden="true"
          className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

const inputClasses =
  'block w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 aria-[invalid=true]:ring-red-500 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({
  label,
  hint,
  error,
  className = '',
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <input
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-desc` : undefined}
        className={`mt-1 ${inputClasses}`}
      />
      {(error || hint) && (
        <p
          id={`${id}-desc`}
          className={`mt-1 text-xs ${error ? 'text-red-700 dark:text-red-300' : 'text-slate-500 dark:text-slate-400'}`}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className = '',
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <select
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-desc` : undefined}
        className={`mt-1 ${inputClasses}`}
      >
        {children}
      </select>
      {(error || hint) && (
        <p
          id={`${id}-desc`}
          className={`mt-1 text-xs ${error ? 'text-red-700 dark:text-red-300' : 'text-slate-500 dark:text-slate-400'}`}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  className = '',
  rows = 3,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-desc` : undefined}
        className={`mt-1 ${inputClasses}`}
      />
      {(error || hint) && (
        <p
          id={`${id}-desc`}
          className={`mt-1 text-xs ${error ? 'text-red-700 dark:text-red-300' : 'text-slate-500 dark:text-slate-400'}`}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** An editable list of short texts (keywords, objectives, corrections …). */
export function ListField({
  label,
  hint,
  values,
  onChange,
  addLabel = 'Add another',
  placeholder,
  disabled,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  addLabel?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const items = values.length ? values : [''];
  return (
    <fieldset aria-describedby={hint ? `${id}-desc` : undefined}>
      <legend className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </legend>
      <div className="mt-1 space-y-2">
        {items.map((value, i) => (
          <div key={i} className="flex gap-2">
            <input
              aria-label={`${label} ${i + 1}`}
              className={inputClasses}
              value={value}
              placeholder={placeholder}
              disabled={disabled}
              onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
            />
            {items.length > 1 && !disabled && (
              <button
                type="button"
                aria-label={`Remove entry ${i + 1} from ${label.toLowerCase()}`}
                className="rounded-md px-2 text-sm text-slate-500 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <button
          type="button"
          className="mt-2 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
          onClick={() => onChange([...items, ''])}
        >
          + {addLabel}
        </button>
      )}
      {hint && (
        <p id={`${id}-desc`} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
    </fieldset>
  );
}

const alertClasses = {
  error: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-950 dark:text-red-200 dark:ring-red-900',
  success:
    'bg-green-50 text-green-800 ring-green-200 dark:bg-green-950 dark:text-green-200 dark:ring-green-900',
  info: 'bg-blue-50 text-blue-900 ring-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-900',
} as const;

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: keyof typeof alertClasses;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-md p-3 text-sm ring-1 ring-inset ${alertClasses[tone]}`}
    >
      {children}
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && (
            <h2 id={id} className="text-base font-semibold">
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
        )}
      </div>
      {actions}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
      {label}
    </p>
  );
}
