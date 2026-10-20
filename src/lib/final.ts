import type { Enums, Json, Tables, Views } from './database.types';
import { run } from './api';
import { requireSupabase } from './supabase';

// Phase 6: S6–S9 records, the final checklist, panels and sign-off.

export type ImplementationItem = Tables<'implementation_items'>;
export type EvaluationResult = Tables<'evaluation_results'>;
export type PaperDraft = Tables<'paper_drafts'>;
export type Deliverable = Tables<'final_deliverables'>;
export type Signoff = Tables<'final_signoffs'>;
export type Panel = Tables<'panels'>;
export type Timeliness = Views<'v_timeliness'>;
export type DuplicateWarning = Views<'v_duplicate_warnings'>;
export type DraftSection = Enums<'draft_section'>;
export type DeliverableItem = Enums<'deliverable_item'>;

export interface PanelInfo {
  panel: Panel;
  memberIds: string[];
}

export interface FinalData {
  items: ImplementationItem[];
  results: EvaluationResult[];
  drafts: PaperDraft[];
  deliverables: Deliverable[];
  signoffs: Signoff[];
  panel: PanelInfo | null;
  timeliness: Timeliness | null;
  duplicates: DuplicateWarning[];
}

const db = () => requireSupabase();

export async function getFinalData(projectId: string, semesterId: string): Promise<FinalData> {
  const [items, results, drafts, deliverables, signoffs, assignment, timeliness, duplicates] =
    await Promise.all([
      run(
        db()
          .from('implementation_items')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at'),
      ),
      run(
        db().from('evaluation_results').select('*').eq('project_id', projectId).order('created_at'),
      ),
      run(db().from('paper_drafts').select('*').eq('project_id', projectId).order('version')),
      run(db().from('final_deliverables').select('*').eq('project_id', projectId)),
      run(db().from('final_signoffs').select('*').eq('project_id', projectId).order('updated_at')),
      run(
        db()
          .from('panel_projects')
          .select('panel_id')
          .eq('project_id', projectId)
          .eq('is_active', true)
          .maybeSingle(),
      ),
      run(db().from('v_timeliness').select('*').eq('project_id', projectId).maybeSingle()),
      run(
        db()
          .from('v_duplicate_warnings')
          .select('*')
          .eq('semester_id', semesterId)
          .contains('project_ids', [projectId]),
      ),
    ]);
  let panel: PanelInfo | null = null;
  if (assignment?.panel_id) {
    const [panelRow, members] = await Promise.all([
      run(db().from('panels').select('*').eq('id', assignment.panel_id).maybeSingle()),
      run(
        db()
          .from('panel_members')
          .select('user_id')
          .eq('panel_id', assignment.panel_id)
          .eq('is_active', true),
      ),
    ]);
    if (panelRow) panel = { panel: panelRow, memberIds: (members ?? []).map((m) => m.user_id) };
  }
  return {
    items: items ?? [],
    results: results ?? [],
    drafts: drafts ?? [],
    deliverables: deliverables ?? [],
    signoffs: signoffs ?? [],
    panel,
    timeliness: timeliness ?? null,
    duplicates: duplicates ?? [],
  };
}

// ---------------------------------------------------------------- student ----------
export const saveImplementationItem = (
  projectId: string,
  data: Record<string, unknown>,
  itemId?: string,
) =>
  run(
    db().rpc('app_save_implementation_item', {
      p_project_id: projectId,
      p_data: data as Json,
      p_item_id: itemId ?? undefined,
    }),
  );

export const saveEvaluationResult = (
  projectId: string,
  data: Record<string, unknown>,
  resultId?: string,
) =>
  run(
    db().rpc('app_save_evaluation_result', {
      p_project_id: projectId,
      p_data: data as Json,
      p_result_id: resultId ?? undefined,
    }),
  );

export const saveDraft = (
  projectId: string,
  section: DraftSection,
  data: Record<string, unknown>,
) =>
  run(
    db().rpc('app_save_draft', {
      p_project_id: projectId,
      p_section: section,
      p_data: data as Json,
    }),
  );

export const newDraftVersion = (projectId: string, section: DraftSection) =>
  run(db().rpc('app_new_draft_version', { p_project_id: projectId, p_section: section }));

export const setDeliverable = (
  projectId: string,
  item: DeliverableItem,
  url: string,
  description: string,
  notes?: string,
) =>
  run(
    db().rpc('app_set_deliverable', {
      p_project_id: projectId,
      p_item: item,
      p_url: url,
      p_description: description,
      p_notes: notes || undefined,
    }),
  );

// ---------------------------------------------------------------- faculty ----------
export const verifyDeliverable = (
  deliverableId: string,
  verification: Exclude<Enums<'evidence_verification'>, 'unverified'>,
  note?: string,
) =>
  run(
    db().rpc('app_verify_deliverable', {
      p_deliverable_id: deliverableId,
      p_verification: verification,
      p_note: note || undefined,
    }),
  );

export const recordSignoff = (input: {
  projectId: string;
  decision: Enums<'signoff_decision'>;
  originalityRemark: string;
  comments?: string;
  corrections?: string[];
}) =>
  run(
    db().rpc('app_record_signoff', {
      p_project_id: input.projectId,
      p_decision: input.decision,
      p_originality_remark: input.originalityRemark,
      p_comments: input.comments || undefined,
      p_corrections: input.corrections ?? [],
    }),
  );

// ---------------------------------------------------------------- panels -----------
export interface PanelRow {
  panel: Panel;
  memberIds: string[];
  projectIds: string[];
}

export async function listPanels(semesterId: string): Promise<PanelRow[]> {
  const panels = await run(
    db()
      .from('panels')
      .select('*')
      .eq('semester_id', semesterId)
      .eq('is_active', true)
      .order('name'),
  );
  const ids = (panels ?? []).map((p) => p.id);
  if (ids.length === 0) return [];
  const [members, projects] = await Promise.all([
    run(
      db()
        .from('panel_members')
        .select('panel_id, user_id')
        .in('panel_id', ids)
        .eq('is_active', true),
    ),
    run(
      db()
        .from('panel_projects')
        .select('panel_id, project_id')
        .in('panel_id', ids)
        .eq('is_active', true),
    ),
  ]);
  return (panels ?? []).map((panel) => ({
    panel,
    memberIds: (members ?? []).filter((m) => m.panel_id === panel.id).map((m) => m.user_id),
    projectIds: (projects ?? []).filter((p) => p.panel_id === panel.id).map((p) => p.project_id),
  }));
}

export const setPanel = (input: {
  semesterId: string;
  name: string;
  memberIds: string[];
  projectIds: string[];
  panelId?: string;
}) =>
  run(
    db().rpc('app_set_panel', {
      p_semester_id: input.semesterId,
      p_name: input.name,
      p_member_ids: input.memberIds,
      p_project_ids: input.projectIds,
      p_panel_id: input.panelId ?? undefined,
    }),
  );
