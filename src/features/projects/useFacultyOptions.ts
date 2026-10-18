import { useQuery } from '@tanstack/react-query';
import { isHod, type ActiveContext } from '@/domain/context';
import { listMembers } from '@/lib/api';

export interface FacultyOption {
  id: string;
  name: string;
}

/** Faculty who can guide or review in a semester: active lead/faculty, plus the HOD (D7). */
export function useFacultyOptions(semesterId: string, ctx: ActiveContext) {
  const members = useQuery({
    queryKey: ['members', semesterId],
    queryFn: () => listMembers(semesterId),
  });
  const options: FacultyOption[] = (members.data ?? [])
    .filter((m) => m.is_active && m.role !== 'student' && (m.profile?.is_active ?? true))
    .map((m) => ({ id: m.user_id, name: m.profile?.full_name ?? 'Unknown' }));
  if (isHod(ctx) && !options.some((o) => o.id === ctx.user_id)) {
    options.push({ id: ctx.user_id, name: `${ctx.profile.full_name} (HOD)` });
  }
  options.sort((a, b) => a.name.localeCompare(b.name));
  return { options, isPending: members.isPending };
}
