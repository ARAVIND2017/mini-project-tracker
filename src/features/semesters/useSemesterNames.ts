import { useQuery } from '@tanstack/react-query';
import { profileNames } from '@/lib/api';

/** Looks up display names for a set of profile ids (cached per id set). */
export function useProfileNames(ids: (string | null | undefined)[]) {
  const key = [...new Set(ids.filter((v): v is string => Boolean(v)))].sort();
  const query = useQuery({
    queryKey: ['profile-names', key],
    queryFn: () => profileNames(key),
    staleTime: 300_000,
  });
  return (id: string | null | undefined) => (id ? (query.data?.[id] ?? '…') : '—');
}
