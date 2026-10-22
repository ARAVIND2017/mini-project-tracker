import type { ComponentType, SVGProps } from 'react';
import {
  CalendarIcon,
  ChatIcon,
  FolderIcon,
  GaugeIcon,
  HandshakeIcon,
  InboxIcon,
  ListIcon,
  PanelIcon,
  ShieldIcon,
  TagIcon,
  UsersIcon,
} from '@/components/icons';
import {
  hasAdminPermission,
  isFacultyLevel,
  isHod,
  membershipFor,
  type ActiveContext,
} from '@/domain/context';

export interface SemesterSection {
  to: string;
  label: string;
  end: boolean;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * The sections of a semester the signed-in person can open (UI only: the database
 * decides what data they actually get). Used by the sidebar and the mobile tabs.
 */
export function semesterSections(ctx: ActiveContext, semesterId: string): SemesterSection[] {
  const admin = ctx.system_roles.some((r) => r.role === 'admin');
  const faculty = isFacultyLevel(ctx, semesterId);
  const staff = faculty || admin;
  const canSeeAudit =
    isHod(ctx) || admin || membershipFor(ctx, semesterId)?.role === 'lead_faculty';
  const base = `/semesters/${semesterId}`;
  const all: (SemesterSection & { show: boolean })[] = [
    { to: base, label: 'Overview', end: true, icon: GaugeIcon, show: true },
    { to: `${base}/projects`, label: 'Projects', end: false, icon: FolderIcon, show: staff },
    {
      to: `${base}/review-queue`,
      label: 'Review queue',
      end: false,
      icon: InboxIcon,
      show: faculty,
    },
    {
      to: `${base}/assignments`,
      label: 'Assignments',
      end: false,
      icon: HandshakeIcon,
      show: faculty,
    },
    { to: `${base}/roster`, label: 'Roster', end: false, icon: ListIcon, show: staff },
    { to: `${base}/plan`, label: 'Plan', end: false, icon: CalendarIcon, show: staff },
    { to: `${base}/panels`, label: 'Panels', end: false, icon: PanelIcon, show: staff },
    { to: `${base}/meetings`, label: 'Meetings', end: false, icon: ChatIcon, show: faculty },
    { to: `${base}/domains`, label: 'Domains', end: false, icon: TagIcon, show: true },
    {
      to: `${base}/people`,
      label: 'People & roles',
      end: false,
      icon: UsersIcon,
      show: staff || hasAdminPermission(ctx, 'manage_users'),
    },
    { to: `${base}/audit`, label: 'Audit log', end: false, icon: ShieldIcon, show: canSeeAudit },
  ];
  return all.filter((s) => s.show).map(({ show: _show, ...s }) => s);
}
