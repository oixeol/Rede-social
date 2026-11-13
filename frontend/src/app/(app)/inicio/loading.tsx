import { InicioSkeleton } from './loading-skeleton';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1240px]" role="status" aria-live="polite" aria-busy="true">
      <InicioSkeleton />
    </div>
  );
}