import type { ReactNode } from 'react';

/** Shared chrome for the console: panels, chips, skeletons, error notes. */

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = '',
  bodyClassName = 'p-4',
  id,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`flex flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/70 ${className}`}
    >
      {(title || right) && (
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-800/80 bg-zinc-900/30 px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-1 text-xs leading-relaxed text-zinc-500">{subtitle}</p>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Chip({
  children,
  className = '',
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${className}`}
    >
      {children}
    </span>
  );
}

export function Dot({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block size-1.5 rounded-full ${className}`} />;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden rounded bg-zinc-800/60 ${className}`}
    >
      <div className="animate-sweep absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />
    </div>
  );
}

export function ErrorNote({ title, message }: { title: string; message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 break-words font-mono text-xs leading-relaxed text-red-300/90">{message}</p>
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
      {children}
    </p>
  );
}

/** Small label above a value. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
      {children}
    </span>
  );
}
