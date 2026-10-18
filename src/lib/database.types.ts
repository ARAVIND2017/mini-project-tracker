// Generated from the live Supabase schema (project utkekzbkdtcbmupbxmpp) — do not edit by hand.
// Regenerate after each migration: Supabase MCP `generate_typescript_types` or
// `supabase gen types typescript --project-id utkekzbkdtcbmupbxmpp`.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: number;
          new_data: Json | null;
          old_data: Json | null;
          project_id: string | null;
          row_id: string | null;
          semester_id: string | null;
          table_name: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          new_data?: Json | null;
          old_data?: Json | null;
          project_id?: string | null;
          row_id?: string | null;
          semester_id?: string | null;
          table_name: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          new_data?: Json | null;
          old_data?: Json | null;
          project_id?: string | null;
          row_id?: string | null;
          semester_id?: string | null;
          table_name?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          reports_to: string | null;
          role: Database['public']['Enums']['semester_role'];
          semester_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          reports_to?: string | null;
          role: Database['public']['Enums']['semester_role'];
          semester_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          reports_to?: string | null;
          role?: Database['public']['Enums']['semester_role'];
          semester_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'memberships_reports_to_fkey';
            columns: ['reports_to'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'memberships_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          designation: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          designation?: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          designation?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      semesters: {
        Row: {
          academic_year: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          lab_end: string;
          lab_start: string;
          lab_weekday: number;
          max_students: number;
          name: string;
          panel_quorum: number | null;
          paper_change_cutoff_week: number;
          require_source_zip: boolean;
          review_time: string;
          review_weekday: number;
          stage_weights: Json;
          start_date: string | null;
          status: Database['public']['Enums']['semester_status'];
          submission_time: string;
          submission_weekday: number;
          target_paper_year: number;
          timezone: string;
          updated_at: string;
          week_count: number;
        };
        Insert: {
          academic_year?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          lab_end?: string;
          lab_start?: string;
          lab_weekday?: number;
          max_students?: number;
          name: string;
          panel_quorum?: number | null;
          paper_change_cutoff_week?: number;
          require_source_zip?: boolean;
          review_time?: string;
          review_weekday?: number;
          stage_weights?: Json;
          start_date?: string | null;
          status?: Database['public']['Enums']['semester_status'];
          submission_time?: string;
          submission_weekday?: number;
          target_paper_year?: number;
          timezone?: string;
          updated_at?: string;
          week_count?: number;
        };
        Update: {
          academic_year?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          lab_end?: string;
          lab_start?: string;
          lab_weekday?: number;
          max_students?: number;
          name?: string;
          panel_quorum?: number | null;
          paper_change_cutoff_week?: number;
          require_source_zip?: boolean;
          review_time?: string;
          review_weekday?: number;
          stage_weights?: Json;
          start_date?: string | null;
          status?: Database['public']['Enums']['semester_status'];
          submission_time?: string;
          submission_weekday?: number;
          target_paper_year?: number;
          timezone?: string;
          updated_at?: string;
          week_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'semesters_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      system_roles: {
        Row: {
          admin_permissions: string[];
          granted_at: string;
          granted_by: string | null;
          id: string;
          revoked_at: string | null;
          revoked_by: string | null;
          role: Database['public']['Enums']['system_role'];
          user_id: string;
        };
        Insert: {
          admin_permissions?: string[];
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role: Database['public']['Enums']['system_role'];
          user_id: string;
        };
        Update: {
          admin_permissions?: string[];
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role?: Database['public']['Enums']['system_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'system_roles_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'system_roles_revoked_by_fkey';
            columns: ['revoked_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'system_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      app_activate_semester: {
        Args: { p_semester_id: string };
        Returns: undefined;
      };
      app_close_semester: {
        Args: { p_semester_id: string };
        Returns: undefined;
      };
      app_create_semester: {
        Args: { p_academic_year?: string; p_name: string; p_settings?: Json };
        Returns: string;
      };
      app_grant_system_role: {
        Args: {
          p_admin_permissions?: string[];
          p_role: Database['public']['Enums']['system_role'];
          p_user_id: string;
        };
        Returns: undefined;
      };
      app_my_context: { Args: never; Returns: Json };
      app_revoke_system_role: {
        Args: {
          p_role: Database['public']['Enums']['system_role'];
          p_user_id: string;
        };
        Returns: undefined;
      };
      app_set_lead: {
        Args: { p_semester_id: string; p_user_id: string };
        Returns: string;
      };
      app_set_membership: {
        Args: {
          p_is_active?: boolean;
          p_role: Database['public']['Enums']['semester_role'];
          p_semester_id: string;
          p_user_id: string;
        };
        Returns: string;
      };
      app_set_user_active: {
        Args: { p_is_active: boolean; p_reason: string; p_user_id: string };
        Returns: undefined;
      };
      app_update_semester: {
        Args: { p_semester_id: string; p_settings: Json };
        Returns: undefined;
      };
    };
    Enums: {
      assignment_type: 'guide' | 'co_reviewer';
      attempt_outcome: 'success' | 'failed' | 'blocked';
      code_availability: 'unknown' | 'available' | 'not_available';
      correction_status: 'open' | 'addressed' | 'verified' | 'waived';
      deliverable_item:
        | 'final_paper'
        | 'project_report'
        | 'source_repository'
        | 'source_zip'
        | 'readme'
        | 'dataset_references'
        | 'presentation'
        | 'demo_evidence';
      draft_section:
        | 'title_abstract'
        | 'introduction'
        | 'literature_review'
        | 'problem_objectives'
        | 'methodology'
        | 'proposed_approach'
        | 'implementation'
        | 'results_discussion'
        | 'conclusion_future_work'
        | 'references';
      evaluation_kind: 'baseline' | 'proposed';
      evidence_category:
        | 'research_paper_pdf'
        | 'paper_analysis'
        | 'github_repository'
        | 'execution_screenshot'
        | 'execution_log'
        | 'result_file'
        | 'objective_document'
        | 'implementation_evidence'
        | 'test_results'
        | 'paper_draft'
        | 'final_report'
        | 'presentation'
        | 'final_zip'
        | 'demo_evidence'
        | 'other';
      evidence_verification: 'unverified' | 'verified' | 'rejected' | 'inaccessible';
      execution_status:
        | 'not_started'
        | 'repository_identified'
        | 'environment_setup'
        | 'execution_successful'
        | 'execution_failed'
        | 'blocked_dependency_dataset'
        | 'verification_pending'
        | 'verified';
      implementation_type:
        'feature' | 'dataset' | 'model_change' | 'frontend' | 'backend' | 'integration' | 'bug';
      item_status: 'planned' | 'in_progress' | 'done' | 'blocked' | 'dropped';
      paper_status: 'candidate' | 'submitted' | 'approved' | 'rejected' | 'withdrawn';
      record_status: 'draft' | 'submitted' | 'changes_requested' | 'approved' | 'superseded';
      request_status: 'pending' | 'approved' | 'rejected' | 'cancelled';
      review_outcome: 'accepted' | 'changes_requested' | 'rejected' | 'comment_only';
      review_target:
        | 'exploration'
        | 'paper'
        | 'paper_analysis'
        | 'repository'
        | 'objective'
        | 'task_submission'
        | 'draft_section'
        | 'evaluation'
        | 'final';
      roster_status: 'empty' | 'pending_invite' | 'active' | 'withdrawn';
      semester_role: 'lead_faculty' | 'faculty' | 'student';
      semester_status: 'draft' | 'active' | 'closed';
      signoff_decision: 'approve' | 'changes_required';
      stage_key:
        | 'exploration'
        | 'paper_selection'
        | 'paper_analysis'
        | 'code_execution'
        | 'objectives'
        | 'implementation'
        | 'evaluation'
        | 'paper_writing'
        | 'final';
      stage_status:
        | 'not_started'
        | 'in_progress'
        | 'awaiting_approval'
        | 'changes_requested'
        | 'approved'
        | 'exception_approved';
      system_role: 'hod' | 'admin';
      task_status:
        | 'not_started'
        | 'in_progress'
        | 'submitted'
        | 'under_review'
        | 'changes_requested'
        | 'resubmitted'
        | 'verified';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
export type RpcArgs<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Args'];
