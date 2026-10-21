// Generated from the live Supabase schema (project utkekzbkdtcbmupbxmpp) — do not edit by hand.
// Regenerate after each migration (Supabase MCP `generate_typescript_types` or
// `supabase gen types typescript --project-id utkekzbkdtcbmupbxmpp`), then run
// `node scripts/install-db-types.mjs <file>`, which re-applies the local edits below.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      assignment_requests: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_note: string | null;
          faculty_id: string;
          id: string;
          project_id: string;
          reason: string;
          requested_by: string;
          status: Database['public']['Enums']['request_status'];
          type: Database['public']['Enums']['assignment_type'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          faculty_id: string;
          id?: string;
          project_id: string;
          reason: string;
          requested_by: string;
          status?: Database['public']['Enums']['request_status'];
          type: Database['public']['Enums']['assignment_type'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          faculty_id?: string;
          id?: string;
          project_id?: string;
          reason?: string;
          requested_by?: string;
          status?: Database['public']['Enums']['request_status'];
          type?: Database['public']['Enums']['assignment_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assignment_requests_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignment_requests_faculty_id_fkey';
            columns: ['faculty_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignment_requests_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignment_requests_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignment_requests_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignment_requests_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
          {
            foreignKeyName: 'assignment_requests_requested_by_fkey';
            columns: ['requested_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
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
      code_repositories: {
        Row: {
          commit_ref: string | null;
          created_at: string;
          dataset_requirements: string | null;
          decided_at: string | null;
          decided_by: string | null;
          environment: string | null;
          framework: string | null;
          id: string;
          is_current: boolean;
          language: string | null;
          name: string | null;
          owner: string | null;
          paper_id: string;
          project_id: string;
          repo_url: string;
          setup_instructions: string | null;
          status: Database['public']['Enums']['execution_status'];
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: {
          commit_ref?: string | null;
          created_at?: string;
          dataset_requirements?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          environment?: string | null;
          framework?: string | null;
          id?: string;
          is_current?: boolean;
          language?: string | null;
          name?: string | null;
          owner?: string | null;
          paper_id: string;
          project_id: string;
          repo_url: string;
          setup_instructions?: string | null;
          status?: Database['public']['Enums']['execution_status'];
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          commit_ref?: string | null;
          created_at?: string;
          dataset_requirements?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          environment?: string | null;
          framework?: string | null;
          id?: string;
          is_current?: boolean;
          language?: string | null;
          name?: string | null;
          owner?: string | null;
          paper_id?: string;
          project_id?: string;
          repo_url?: string;
          setup_instructions?: string | null;
          status?: Database['public']['Enums']['execution_status'];
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'code_repositories_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'code_repositories_paper_id_fkey';
            columns: ['paper_id'];
            isOneToOne: false;
            referencedRelation: 'papers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'code_repositories_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'code_repositories_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'code_repositories_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'code_repositories_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
        ];
      };
      corrections: {
        Row: {
          addressed_at: string | null;
          created_at: string;
          description: string;
          id: string;
          project_id: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          response_evidence: string[];
          review_id: string;
          status: Database['public']['Enums']['correction_status'];
          student_response: string | null;
          target_id: string;
          target_type: Database['public']['Enums']['review_target'];
          updated_at: string;
        };
        Insert: {
          addressed_at?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          project_id: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          response_evidence?: string[];
          review_id: string;
          status?: Database['public']['Enums']['correction_status'];
          student_response?: string | null;
          target_id: string;
          target_type: Database['public']['Enums']['review_target'];
          updated_at?: string;
        };
        Update: {
          addressed_at?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          project_id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          response_evidence?: string[];
          review_id?: string;
          status?: Database['public']['Enums']['correction_status'];
          student_response?: string | null;
          target_id?: string;
          target_type?: Database['public']['Enums']['review_target'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'corrections_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'corrections_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'corrections_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'corrections_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
          {
            foreignKeyName: 'corrections_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'corrections_review_id_fkey';
            columns: ['review_id'];
            isOneToOne: false;
            referencedRelation: 'reviews';
            referencedColumns: ['id'];
          },
        ];
      };
      domains: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          semester_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          semester_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          semester_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'domains_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
        ];
      };
      evaluation_criteria: {
        Row: {
          created_at: string;
          description: string | null;
          domain_id: string;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          domain_id: string;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          domain_id?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'evaluation_criteria_domain_id_fkey';
            columns: ['domain_id'];
            isOneToOne: false;
            referencedRelation: 'domains';
            referencedColumns: ['id'];
          },
        ];
      };
      evaluation_results: {
        Row: {
          actual: string;
          corrective_action: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          evidence_id: string;
          expected: string;
          id: string;
          kind: Database['public']['Enums']['evaluation_kind'];
          metric_name: string | null;
          metric_value: number | null;
          passed: boolean;
          project_id: string;
          status: Database['public']['Enums']['record_status'];
          submitted_at: string | null;
          test_case: string;
          updated_at: string;
        };
        Insert: {
          actual: string;
          corrective_action?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          evidence_id: string;
          expected: string;
          id?: string;
          kind: Database['public']['Enums']['evaluation_kind'];
          metric_name?: string | null;
          metric_value?: number | null;
          passed: boolean;
          project_id: string;
          status?: Database['public']['Enums']['record_status'];
          submitted_at?: string | null;
          test_case: string;
          updated_at?: string;
        };
        Update: {
          actual?: string;
          corrective_action?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          evidence_id?: string;
          expected?: string;
          id?: string;
          kind?: Database['public']['Enums']['evaluation_kind'];
          metric_name?: string | null;
          metric_value?: number | null;
          passed?: boolean;
          project_id?: string;
          status?: Database['public']['Enums']['record_status'];
          submitted_at?: string | null;
          test_case?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'evaluation_results_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evaluation_results_evidence_id_fkey';
            columns: ['evidence_id'];
            isOneToOne: false;
            referencedRelation: 'evidence';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evaluation_results_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evaluation_results_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evaluation_results_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evaluation_results_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
        ];
      };
      evidence: {
        Row: {
          category: Database['public']['Enums']['evidence_category'];
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          linked_id: string | null;
          linked_type: string | null;
          project_id: string;
          stage_key: Database['public']['Enums']['stage_key'];
          task_id: string | null;
          updated_at: string;
          url: string;
          verification: Database['public']['Enums']['evidence_verification'];
          verification_note: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          category: Database['public']['Enums']['evidence_category'];
          created_at?: string;
          created_by: string;
          description: string;
          id?: string;
          linked_id?: string | null;
          linked_type?: string | null;
          project_id: string;
          stage_key: Database['public']['Enums']['stage_key'];
          task_id?: string | null;
          updated_at?: string;
          url: string;
          verification?: Database['public']['Enums']['evidence_verification'];
          verification_note?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          category?: Database['public']['Enums']['evidence_category'];
          created_at?: string;
          created_by?: string;
          description?: string;
          id?: string;
          linked_id?: string | null;
          linked_type?: string | null;
          project_id?: string;
          stage_key?: Database['public']['Enums']['stage_key'];
          task_id?: string | null;
          updated_at?: string;
          url?: string;
          verification?: Database['public']['Enums']['evidence_verification'];
          verification_note?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'evidence_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evidence_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evidence_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evidence_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evidence_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
          {
            foreignKeyName: 'evidence_task_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evidence_task_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_flags';
            referencedColumns: ['task_id'];
          },
          {
            foreignKeyName: 'evidence_task_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'v_tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evidence_verified_by_fkey';
            columns: ['verified_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      execution_attempts: {
        Row: {
          attempted_at: string;
          created_at: string;
          debugging_notes: string | null;
          errors: string | null;
          id: string;
          notes: string | null;
          outcome: Database['public']['Enums']['attempt_outcome'];
          project_id: string;
          recorded_by: string;
          repository_id: string;
        };
        Insert: {
          attempted_at: string;
          created_at?: string;
          debugging_notes?: string | null;
          errors?: string | null;
          id?: string;
          notes?: string | null;
          outcome: Database['public']['Enums']['attempt_outcome'];
          project_id: string;
          recorded_by: string;
          repository_id: string;
        };
        Update: {
          attempted_at?: string;
          created_at?: string;
          debugging_notes?: string | null;
          errors?: string | null;
          id?: string;
          notes?: string | null;
          outcome?: Database['public']['Enums']['attempt_outcome'];
          project_id?: string;
          recorded_by?: string;
          repository_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'execution_attempts_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'execution_attempts_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'execution_attempts_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'execution_attempts_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
          {
            foreignKeyName: 'execution_attempts_recorded_by_fkey';
            columns: ['recorded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'execution_attempts_repository_id_fkey';
            columns: ['repository_id'];
            isOneToOne: false;
            referencedRelation: 'code_repositories';
            referencedColumns: ['id'];
          },
        ];
      };
      faculty_expertise: {
        Row: {
          created_at: string;
          domain_id: string;
          id: string;
          is_active: boolean;
          semester_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          domain_id: string;
          id?: string;
          is_active?: boolean;
          semester_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          domain_id?: string;
          id?: string;
          is_active?: boolean;
          semester_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'faculty_expertise_domain_id_fkey';
            columns: ['domain_id'];
            isOneToOne: false;
            referencedRelation: 'domains';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'faculty_expertise_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'faculty_expertise_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      final_deliverables: {
        Row: {
          created_at: string;
          evidence_id: string | null;
          id: string;
          item: Database['public']['Enums']['deliverable_item'];
          notes: string | null;
          project_id: string;
          updated_at: string;
          verification: Database['public']['Enums']['evidence_verification'];
          verification_note: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          created_at?: string;
          evidence_id?: string | null;
          id?: string;
          item: Database['public']['Enums']['deliverable_item'];
          notes?: string | null;
          project_id: string;
          updated_at?: string;
          verification?: Database['public']['Enums']['evidence_verification'];
          verification_note?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          created_at?: string;
          evidence_id?: string | null;
          id?: string;
          item?: Database['public']['Enums']['deliverable_item'];
          notes?: string | null;
          project_id?: string;
          updated_at?: string;
          verification?: Database['public']['Enums']['evidence_verification'];
          verification_note?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'final_deliverables_evidence_id_fkey';
            columns: ['evidence_id'];
            isOneToOne: false;
            referencedRelation: 'evidence';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'final_deliverables_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'final_deliverables_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'final_deliverables_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'final_deliverables_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
          {
            foreignKeyName: 'final_deliverables_verified_by_fkey';
            columns: ['verified_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      final_signoffs: {
        Row: {
          comments: string | null;
          created_at: string;
          decision: Database['public']['Enums']['signoff_decision'];
          id: string;
          originality_remark: string;
          panel_member_id: string;
          project_id: string;
          updated_at: string;
        };
        Insert: {
          comments?: string | null;
          created_at?: string;
          decision: Database['public']['Enums']['signoff_decision'];
          id?: string;
          originality_remark: string;
          panel_member_id: string;
          project_id: string;
          updated_at?: string;
        };
        Update: {
          comments?: string | null;
          created_at?: string;
          decision?: Database['public']['Enums']['signoff_decision'];
          id?: string;
          originality_remark?: string;
          panel_member_id?: string;
          project_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'final_signoffs_panel_member_id_fkey';
            columns: ['panel_member_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'final_signoffs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'final_signoffs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'final_signoffs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'final_signoffs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
        ];
      };
      implementation_items: {
        Row: {
          commit_links: string[];
          created_at: string;
          id: string;
          is_planned: boolean;
          notes: string | null;
          project_id: string;
          status: Database['public']['Enums']['item_status'];
          title: string;
          type: Database['public']['Enums']['implementation_type'];
          updated_at: string;
        };
        Insert: {
          commit_links?: string[];
          created_at?: string;
          id?: string;
          is_planned?: boolean;
          notes?: string | null;
          project_id: string;
          status?: Database['public']['Enums']['item_status'];
          title: string;
          type: Database['public']['Enums']['implementation_type'];
          updated_at?: string;
        };
        Update: {
          commit_links?: string[];
          created_at?: string;
          id?: string;
          is_planned?: boolean;
          notes?: string | null;
          project_id?: string;
          status?: Database['public']['Enums']['item_status'];
          title?: string;
          type?: Database['public']['Enums']['implementation_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'implementation_items_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'implementation_items_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'implementation_items_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'implementation_items_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
        ];
      };
      meeting_attendees: {
        Row: {
          meeting_id: string;
          user_id: string;
        };
        Insert: {
          meeting_id: string;
          user_id: string;
        };
        Update: {
          meeting_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_attendees_meeting_id_fkey';
            columns: ['meeting_id'];
            isOneToOne: false;
            referencedRelation: 'review_meetings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_attendees_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_outcomes: {
        Row: {
          action_items: string[];
          id: string;
          meeting_id: string;
          outcome: string;
          project_id: string;
        };
        Insert: {
          action_items?: string[];
          id?: string;
          meeting_id: string;
          outcome: string;
          project_id: string;
        };
        Update: {
          action_items?: string[];
          id?: string;
          meeting_id?: string;
          outcome?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meeting_outcomes_meeting_id_fkey';
            columns: ['meeting_id'];
            isOneToOne: false;
            referencedRelation: 'review_meetings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_outcomes_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_outcomes_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_outcomes_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meeting_outcomes_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
        ];
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
      milestones: {
        Row: {
          checkpoint: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_gate: boolean;
          semester_id: string;
          stage_key: Database['public']['Enums']['stage_key'];
          start_date_override: string | null;
          title: string;
          updated_at: string;
          week_no: number;
        };
        Insert: {
          checkpoint?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_gate?: boolean;
          semester_id: string;
          stage_key: Database['public']['Enums']['stage_key'];
          start_date_override?: string | null;
          title: string;
          updated_at?: string;
          week_no: number;
        };
        Update: {
          checkpoint?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_gate?: boolean;
          semester_id?: string;
          stage_key?: Database['public']['Enums']['stage_key'];
          start_date_override?: string | null;
          title?: string;
          updated_at?: string;
          week_no?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'milestones_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          dedupe_key: string | null;
          id: string;
          link: string | null;
          project_id: string | null;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          link?: string | null;
          project_id?: string | null;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          link?: string | null;
          project_id?: string | null;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      objective_versions: {
        Row: {
          contribution: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          evaluation_criteria: string[];
          exclusions: string | null;
          id: string;
          main_objective: string | null;
          original_limitations: string | null;
          problem_statement: string | null;
          project_id: string;
          research_gap: string | null;
          scope: string | null;
          specific_objectives: string[];
          status: Database['public']['Enums']['record_status'];
          submitted_at: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          contribution?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          evaluation_criteria?: string[];
          exclusions?: string | null;
          id?: string;
          main_objective?: string | null;
          original_limitations?: string | null;
          problem_statement?: string | null;
          project_id: string;
          research_gap?: string | null;
          scope?: string | null;
          specific_objectives?: string[];
          status?: Database['public']['Enums']['record_status'];
          submitted_at?: string | null;
          updated_at?: string;
          version: number;
        };
        Update: {
          contribution?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          evaluation_criteria?: string[];
          exclusions?: string | null;
          id?: string;
          main_objective?: string | null;
          original_limitations?: string | null;
          problem_statement?: string | null;
          project_id?: string;
          research_gap?: string | null;
          scope?: string | null;
          specific_objectives?: string[];
          status?: Database['public']['Enums']['record_status'];
          submitted_at?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'objective_versions_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'objective_versions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'objective_versions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'objective_versions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'objective_versions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
        ];
      };
      panel_members: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          panel_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          panel_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          panel_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'panel_members_panel_id_fkey';
            columns: ['panel_id'];
            isOneToOne: false;
            referencedRelation: 'panels';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'panel_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      panel_projects: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          panel_id: string;
          project_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          panel_id: string;
          project_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          panel_id?: string;
          project_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'panel_projects_panel_id_fkey';
            columns: ['panel_id'];
            isOneToOne: false;
            referencedRelation: 'panels';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'panel_projects_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'panel_projects_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'panel_projects_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'panel_projects_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
        ];
      };
      panels: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          semester_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          semester_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          semester_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'panels_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
        ];
      };
      paper_analyses: {
        Row: {
          algorithms: string | null;
          created_at: string;
          datasets: string | null;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          limitations: string | null;
          methodology: string | null;
          own_understanding: string | null;
          paper_id: string;
          problem_addressed: string | null;
          project_id: string;
          reported_results: string | null;
          research_gaps: string | null;
          research_objectives: string | null;
          status: Database['public']['Enums']['record_status'];
          submitted_at: string | null;
          tools: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          algorithms?: string | null;
          created_at?: string;
          datasets?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          limitations?: string | null;
          methodology?: string | null;
          own_understanding?: string | null;
          paper_id: string;
          problem_addressed?: string | null;
          project_id: string;
          reported_results?: string | null;
          research_gaps?: string | null;
          research_objectives?: string | null;
          status?: Database['public']['Enums']['record_status'];
          submitted_at?: string | null;
          tools?: string | null;
          updated_at?: string;
          version: number;
        };
        Update: {
          algorithms?: string | null;
          created_at?: string;
          datasets?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          limitations?: string | null;
          methodology?: string | null;
          own_understanding?: string | null;
          paper_id?: string;
          problem_addressed?: string | null;
          project_id?: string;
          reported_results?: string | null;
          research_gaps?: string | null;
          research_objectives?: string | null;
          status?: Database['public']['Enums']['record_status'];
          submitted_at?: string | null;
          tools?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'paper_analyses_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'paper_analyses_paper_id_fkey';
            columns: ['paper_id'];
            isOneToOne: false;
            referencedRelation: 'papers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'paper_analyses_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'paper_analyses_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'paper_analyses_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'paper_analyses_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
        ];
      };
      paper_drafts: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          doc_url: string | null;
          id: string;
          notes: string | null;
          project_id: string;
          section: Database['public']['Enums']['draft_section'];
          status: Database['public']['Enums']['record_status'];
          submitted_at: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          doc_url?: string | null;
          id?: string;
          notes?: string | null;
          project_id: string;
          section: Database['public']['Enums']['draft_section'];
          status?: Database['public']['Enums']['record_status'];
          submitted_at?: string | null;
          updated_at?: string;
          version: number;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          doc_url?: string | null;
          id?: string;
          notes?: string | null;
          project_id?: string;
          section?: Database['public']['Enums']['draft_section'];
          status?: Database['public']['Enums']['record_status'];
          submitted_at?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'paper_drafts_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'paper_drafts_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'paper_drafts_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'paper_drafts_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'paper_drafts_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
        ];
      };
      papers: {
        Row: {
          abstract: string | null;
          authors: string[];
          code_availability: Database['public']['Enums']['code_availability'];
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          doi: string | null;
          duplicate_override_at: string | null;
          duplicate_override_by: string | null;
          duplicate_override_reason: string | null;
          foundational_justification: string | null;
          id: string;
          is_selected: boolean;
          pdf_drive_url: string | null;
          project_id: string;
          pub_year: number | null;
          relevance_note: string | null;
          research_problem: string | null;
          selected_at: string | null;
          status: Database['public']['Enums']['paper_status'];
          submitted_at: string | null;
          title: string;
          title_normalized: string | null;
          updated_at: string;
          url: string | null;
          venue: string | null;
          withdrawn_reason: string | null;
        };
        Insert: {
          abstract?: string | null;
          authors?: string[];
          code_availability?: Database['public']['Enums']['code_availability'];
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          doi?: string | null;
          duplicate_override_at?: string | null;
          duplicate_override_by?: string | null;
          duplicate_override_reason?: string | null;
          foundational_justification?: string | null;
          id?: string;
          is_selected?: boolean;
          pdf_drive_url?: string | null;
          project_id: string;
          pub_year?: number | null;
          relevance_note?: string | null;
          research_problem?: string | null;
          selected_at?: string | null;
          status?: Database['public']['Enums']['paper_status'];
          submitted_at?: string | null;
          title: string;
          title_normalized?: string | null;
          updated_at?: string;
          url?: string | null;
          venue?: string | null;
          withdrawn_reason?: string | null;
        };
        Update: {
          abstract?: string | null;
          authors?: string[];
          code_availability?: Database['public']['Enums']['code_availability'];
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          doi?: string | null;
          duplicate_override_at?: string | null;
          duplicate_override_by?: string | null;
          duplicate_override_reason?: string | null;
          foundational_justification?: string | null;
          id?: string;
          is_selected?: boolean;
          pdf_drive_url?: string | null;
          project_id?: string;
          pub_year?: number | null;
          relevance_note?: string | null;
          research_problem?: string | null;
          selected_at?: string | null;
          status?: Database['public']['Enums']['paper_status'];
          submitted_at?: string | null;
          title?: string;
          title_normalized?: string | null;
          updated_at?: string;
          url?: string | null;
          venue?: string | null;
          withdrawn_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'papers_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'papers_duplicate_override_by_fkey';
            columns: ['duplicate_override_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'papers_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'papers_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'papers_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'papers_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
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
      project_reviewers: {
        Row: {
          added_by: string | null;
          added_via_request: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          project_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          added_by?: string | null;
          added_via_request?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          project_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          added_by?: string | null;
          added_via_request?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          project_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_reviewers_added_by_fkey';
            columns: ['added_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_reviewers_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_reviewers_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_reviewers_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_reviewers_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
          {
            foreignKeyName: 'project_reviewers_request_fkey';
            columns: ['added_via_request'];
            isOneToOne: false;
            referencedRelation: 'assignment_requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_reviewers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      project_stages: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          exception_reason: string | null;
          project_id: string;
          stage_key: Database['public']['Enums']['stage_key'];
          status: Database['public']['Enums']['stage_status'];
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          exception_reason?: string | null;
          project_id: string;
          stage_key: Database['public']['Enums']['stage_key'];
          status?: Database['public']['Enums']['stage_status'];
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          exception_reason?: string | null;
          project_id?: string;
          stage_key?: Database['public']['Enums']['stage_key'];
          status?: Database['public']['Enums']['stage_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_stages_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_stages_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_stages_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_stages_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_stages_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
        ];
      };
      projects: {
        Row: {
          blocked: boolean;
          blocked_at: string | null;
          blocked_by: string | null;
          blocked_reason: string | null;
          completed_at: string | null;
          created_at: string;
          domain_id: string | null;
          guide_id: string | null;
          id: string;
          is_completed: boolean;
          objective_gate_override_at: string | null;
          objective_gate_override_by: string | null;
          objective_gate_override_reason: string | null;
          semester_id: string;
          student_id: string;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          blocked?: boolean;
          blocked_at?: string | null;
          blocked_by?: string | null;
          blocked_reason?: string | null;
          completed_at?: string | null;
          created_at?: string;
          domain_id?: string | null;
          guide_id?: string | null;
          id?: string;
          is_completed?: boolean;
          objective_gate_override_at?: string | null;
          objective_gate_override_by?: string | null;
          objective_gate_override_reason?: string | null;
          semester_id: string;
          student_id: string;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          blocked?: boolean;
          blocked_at?: string | null;
          blocked_by?: string | null;
          blocked_reason?: string | null;
          completed_at?: string | null;
          created_at?: string;
          domain_id?: string | null;
          guide_id?: string | null;
          id?: string;
          is_completed?: boolean;
          objective_gate_override_at?: string | null;
          objective_gate_override_by?: string | null;
          objective_gate_override_reason?: string | null;
          semester_id?: string;
          student_id?: string;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_blocked_by_fkey';
            columns: ['blocked_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_domain_id_fkey';
            columns: ['domain_id'];
            isOneToOne: false;
            referencedRelation: 'domains';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_guide_id_fkey';
            columns: ['guide_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_objective_gate_override_by_fkey';
            columns: ['objective_gate_override_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: true;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
        ];
      };
      research_explorations: {
        Row: {
          candidate_topics: string[];
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          keywords: string[];
          project_id: string;
          proposed_problem: string | null;
          sources: Json;
          status: Database['public']['Enums']['record_status'];
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: {
          candidate_topics?: string[];
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          keywords?: string[];
          project_id: string;
          proposed_problem?: string | null;
          sources?: Json;
          status?: Database['public']['Enums']['record_status'];
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          candidate_topics?: string[];
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          keywords?: string[];
          project_id?: string;
          proposed_problem?: string | null;
          sources?: Json;
          status?: Database['public']['Enums']['record_status'];
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'research_explorations_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'research_explorations_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: true;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'research_explorations_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: true;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'research_explorations_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: true;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'research_explorations_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: true;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
        ];
      };
      review_authorizations: {
        Row: {
          created_at: string;
          faculty_id: string;
          granted_by: string;
          id: string;
          note: string | null;
          project_id: string;
          revoked_at: string | null;
          revoked_by: string | null;
          valid_until: string | null;
        };
        Insert: {
          created_at?: string;
          faculty_id: string;
          granted_by: string;
          id?: string;
          note?: string | null;
          project_id: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          valid_until?: string | null;
        };
        Update: {
          created_at?: string;
          faculty_id?: string;
          granted_by?: string;
          id?: string;
          note?: string | null;
          project_id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'review_authorizations_faculty_id_fkey';
            columns: ['faculty_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'review_authorizations_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'review_authorizations_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'review_authorizations_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'review_authorizations_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'review_authorizations_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
          {
            foreignKeyName: 'review_authorizations_revoked_by_fkey';
            columns: ['revoked_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      review_meetings: {
        Row: {
          created_at: string;
          held_on: string;
          id: string;
          notes: string | null;
          recorded_by: string;
          semester_id: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          held_on: string;
          id?: string;
          notes?: string | null;
          recorded_by: string;
          semester_id: string;
          title: string;
        };
        Update: {
          created_at?: string;
          held_on?: string;
          id?: string;
          notes?: string | null;
          recorded_by?: string;
          semester_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'review_meetings_recorded_by_fkey';
            columns: ['recorded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'review_meetings_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
        ];
      };
      reviews: {
        Row: {
          comments: string | null;
          created_at: string;
          id: string;
          observations: string | null;
          outcome: Database['public']['Enums']['review_outcome'];
          project_id: string;
          reviewer_id: string;
          target_id: string;
          target_type: Database['public']['Enums']['review_target'];
        };
        Insert: {
          comments?: string | null;
          created_at?: string;
          id?: string;
          observations?: string | null;
          outcome: Database['public']['Enums']['review_outcome'];
          project_id: string;
          reviewer_id: string;
          target_id: string;
          target_type: Database['public']['Enums']['review_target'];
        };
        Update: {
          comments?: string | null;
          created_at?: string;
          id?: string;
          observations?: string | null;
          outcome?: Database['public']['Enums']['review_outcome'];
          project_id?: string;
          reviewer_id?: string;
          target_id?: string;
          target_type?: Database['public']['Enums']['review_target'];
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
          {
            foreignKeyName: 'reviews_reviewer_id_fkey';
            columns: ['reviewer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
      student_drive_folders: {
        Row: {
          created_at: string;
          id: string;
          student_id: string;
          updated_at: string;
          url: string;
          week_no: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          student_id: string;
          updated_at?: string;
          url: string;
          week_no: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          student_id?: string;
          updated_at?: string;
          url?: string;
          week_no?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'student_drive_folders_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
        ];
      };
      students: {
        Row: {
          created_at: string;
          drive_folder_url: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          institution_id: string | null;
          semester_id: string;
          slot_no: number;
          status: Database['public']['Enums']['roster_status'];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          drive_folder_url?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          institution_id?: string | null;
          semester_id: string;
          slot_no: number;
          status?: Database['public']['Enums']['roster_status'];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          drive_folder_url?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          institution_id?: string | null;
          semester_id?: string;
          slot_no?: number;
          status?: Database['public']['Enums']['roster_status'];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'students_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'students_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      submission_evidence: {
        Row: {
          evidence_id: string;
          submission_id: string;
        };
        Insert: {
          evidence_id: string;
          submission_id: string;
        };
        Update: {
          evidence_id?: string;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'submission_evidence_evidence_id_fkey';
            columns: ['evidence_id'];
            isOneToOne: false;
            referencedRelation: 'evidence';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'submission_evidence_submission_id_fkey';
            columns: ['submission_id'];
            isOneToOne: false;
            referencedRelation: 'submissions';
            referencedColumns: ['id'];
          },
        ];
      };
      submissions: {
        Row: {
          due_at_snapshot: string;
          id: string;
          is_late: boolean;
          progress_report: string;
          project_id: string;
          submitted_at: string;
          submitted_by: string;
          task_id: string;
          version: number;
        };
        Insert: {
          due_at_snapshot: string;
          id?: string;
          is_late: boolean;
          progress_report: string;
          project_id: string;
          submitted_at?: string;
          submitted_by: string;
          task_id: string;
          version: number;
        };
        Update: {
          due_at_snapshot?: string;
          id?: string;
          is_late?: boolean;
          progress_report?: string;
          project_id?: string;
          submitted_at?: string;
          submitted_by?: string;
          task_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'submissions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'submissions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'submissions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'submissions_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
          {
            foreignKeyName: 'submissions_submitted_by_fkey';
            columns: ['submitted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'submissions_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'submissions_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'v_task_flags';
            referencedColumns: ['task_id'];
          },
          {
            foreignKeyName: 'submissions_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'v_tasks';
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
      task_templates: {
        Row: {
          acceptance_criteria: string[];
          created_at: string;
          description: string | null;
          domain_id: string | null;
          id: string;
          is_active: boolean;
          replaces_template_id: string | null;
          required_evidence: Database['public']['Enums']['evidence_category'][];
          semester_id: string;
          sort_order: number;
          stage_key: Database['public']['Enums']['stage_key'];
          title: string;
          updated_at: string;
          week_no: number;
        };
        Insert: {
          acceptance_criteria: string[];
          created_at?: string;
          description?: string | null;
          domain_id?: string | null;
          id?: string;
          is_active?: boolean;
          replaces_template_id?: string | null;
          required_evidence?: Database['public']['Enums']['evidence_category'][];
          semester_id: string;
          sort_order?: number;
          stage_key: Database['public']['Enums']['stage_key'];
          title: string;
          updated_at?: string;
          week_no: number;
        };
        Update: {
          acceptance_criteria?: string[];
          created_at?: string;
          description?: string | null;
          domain_id?: string | null;
          id?: string;
          is_active?: boolean;
          replaces_template_id?: string | null;
          required_evidence?: Database['public']['Enums']['evidence_category'][];
          semester_id?: string;
          sort_order?: number;
          stage_key?: Database['public']['Enums']['stage_key'];
          title?: string;
          updated_at?: string;
          week_no?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'task_templates_domain_id_fkey';
            columns: ['domain_id'];
            isOneToOne: false;
            referencedRelation: 'domains';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_templates_replaces_template_id_fkey';
            columns: ['replaces_template_id'];
            isOneToOne: false;
            referencedRelation: 'task_templates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_templates_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          acceptance_criteria: string[];
          blocked: boolean;
          blocked_at: string | null;
          blocked_by: string | null;
          blocked_reason: string | null;
          created_at: string;
          description: string | null;
          due_at: string;
          id: string;
          is_active: boolean;
          project_id: string;
          required_evidence: Database['public']['Enums']['evidence_category'][];
          stage_key: Database['public']['Enums']['stage_key'];
          status: Database['public']['Enums']['task_status'];
          template_id: string | null;
          title: string;
          updated_at: string;
          week_no: number;
        };
        Insert: {
          acceptance_criteria?: string[];
          blocked?: boolean;
          blocked_at?: string | null;
          blocked_by?: string | null;
          blocked_reason?: string | null;
          created_at?: string;
          description?: string | null;
          due_at: string;
          id?: string;
          is_active?: boolean;
          project_id: string;
          required_evidence?: Database['public']['Enums']['evidence_category'][];
          stage_key: Database['public']['Enums']['stage_key'];
          status?: Database['public']['Enums']['task_status'];
          template_id?: string | null;
          title: string;
          updated_at?: string;
          week_no: number;
        };
        Update: {
          acceptance_criteria?: string[];
          blocked?: boolean;
          blocked_at?: string | null;
          blocked_by?: string | null;
          blocked_reason?: string | null;
          created_at?: string;
          description?: string | null;
          due_at?: string;
          id?: string;
          is_active?: boolean;
          project_id?: string;
          required_evidence?: Database['public']['Enums']['evidence_category'][];
          stage_key?: Database['public']['Enums']['stage_key'];
          status?: Database['public']['Enums']['task_status'];
          template_id?: string | null;
          title?: string;
          updated_at?: string;
          week_no?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_blocked_by_fkey';
            columns: ['blocked_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
          {
            foreignKeyName: 'tasks_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'task_templates';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      v_duplicate_warnings: {
        Row: {
          kind: string | null;
          project_ids: string[] | null;
          semester_id: string | null;
          value: string | null;
        };
        Relationships: [];
      };
      v_faculty_workload: {
        Row: {
          avg_turnaround_hours: number | null;
          co_reviewed_projects: number | null;
          corrections_to_verify: number | null;
          full_name: string | null;
          guided_projects: number | null;
          oldest_waiting_since: string | null;
          pending_reviews: number | null;
          reviews_last_7_days: number | null;
          role: string | null;
          semester_id: string | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      v_project_overview: {
        Row: {
          addressed_corrections: number | null;
          awaiting_review: number | null;
          blocked: boolean | null;
          blocked_tasks: number | null;
          co_reviewer_names: string[] | null;
          current_stage: Database['public']['Enums']['stage_key'] | null;
          domain_id: string | null;
          domain_name: string | null;
          execution_status: Database['public']['Enums']['execution_status'] | null;
          guide_id: string | null;
          guide_name: string | null;
          id: string | null;
          institution_id: string | null;
          is_completed: boolean | null;
          last_activity: string | null;
          objective_status: Database['public']['Enums']['record_status'] | null;
          oldest_open_correction: string | null;
          open_corrections: number | null;
          overdue_tasks: number | null;
          pending_requests: number | null;
          progress: number | null;
          progress_breakdown: Json | null;
          roster_status: Database['public']['Enums']['roster_status'] | null;
          selected_paper_title: string | null;
          semester_id: string | null;
          slot_no: number | null;
          stage_statuses: Json | null;
          student_email: string | null;
          student_id: string | null;
          student_name: string | null;
          student_user_id: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_domain_id_fkey';
            columns: ['domain_id'];
            isOneToOne: false;
            referencedRelation: 'domains';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_guide_id_fkey';
            columns: ['guide_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: true;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'students_user_id_fkey';
            columns: ['student_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      v_projects: {
        Row: {
          awaiting_review: number | null;
          blocked: boolean | null;
          co_reviewer_names: string[] | null;
          current_stage: Database['public']['Enums']['stage_key'] | null;
          domain_id: string | null;
          domain_name: string | null;
          guide_id: string | null;
          guide_name: string | null;
          id: string | null;
          institution_id: string | null;
          is_completed: boolean | null;
          pending_requests: number | null;
          roster_status: Database['public']['Enums']['roster_status'] | null;
          semester_id: string | null;
          slot_no: number | null;
          student_email: string | null;
          student_id: string | null;
          student_name: string | null;
          student_user_id: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_domain_id_fkey';
            columns: ['domain_id'];
            isOneToOne: false;
            referencedRelation: 'domains';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_guide_id_fkey';
            columns: ['guide_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: true;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'students_user_id_fkey';
            columns: ['student_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      v_review_queue: {
        Row: {
          guide_id: string | null;
          guide_name: string | null;
          is_late: boolean | null;
          item_id: string | null;
          item_status: string | null;
          item_type: string | null;
          project_id: string | null;
          reviewer_ids: string[] | null;
          semester_id: string | null;
          slot_no: number | null;
          stage_key: Database['public']['Enums']['stage_key'] | null;
          student_name: string | null;
          target_id: string | null;
          target_type: Database['public']['Enums']['review_target'] | null;
          title: string | null;
          version: number | null;
          waiting_since: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_guide_id_fkey';
            columns: ['guide_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
        ];
      };
      v_task_flags: {
        Row: {
          blocked: boolean | null;
          blocked_reason: string | null;
          days_overdue: number | null;
          due_at: string | null;
          guide_id: string | null;
          is_overdue: boolean | null;
          project_id: string | null;
          semester_id: string | null;
          slot_no: number | null;
          stage_key: Database['public']['Enums']['stage_key'] | null;
          status: Database['public']['Enums']['task_status'] | null;
          student_name: string | null;
          task_id: string | null;
          title: string | null;
          week_no: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_guide_id_fkey';
            columns: ['guide_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
        ];
      };
      v_tasks: {
        Row: {
          acceptance_criteria: string[] | null;
          blocked: boolean | null;
          blocked_at: string | null;
          blocked_by: string | null;
          blocked_reason: string | null;
          description: string | null;
          due_at: string | null;
          id: string | null;
          is_overdue: boolean | null;
          latest_is_late: boolean | null;
          latest_submitted_at: string | null;
          latest_version: number | null;
          outstanding_corrections: number | null;
          project_id: string | null;
          required_evidence: Database['public']['Enums']['evidence_category'][] | null;
          semester_id: string | null;
          stage_key: Database['public']['Enums']['stage_key'] | null;
          status: Database['public']['Enums']['task_status'] | null;
          submission_count: number | null;
          template_id: string | null;
          title: string | null;
          updated_at: string | null;
          week_no: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_blocked_by_fkey';
            columns: ['blocked_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_project_overview';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'v_timeliness';
            referencedColumns: ['project_id'];
          },
          {
            foreignKeyName: 'tasks_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'task_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      v_timeliness: {
        Row: {
          avg_days_late: number | null;
          avg_review_cycles: number | null;
          overdue_without_submission: number | null;
          project_id: string | null;
          semester_id: string | null;
          submitted_late: number | null;
          submitted_on_time: number | null;
          tasks_due: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_semester_id_fkey';
            columns: ['semester_id'];
            isOneToOne: false;
            referencedRelation: 'semesters';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      app_activate_semester: {
        Args: { p_semester_id: string };
        Returns: undefined;
      };
      app_add_empty_slots: {
        Args: { p_semester_id: string; p_up_to_slot: number };
        Returns: number;
      };
      app_add_evidence: {
        Args: {
          p_category: Database['public']['Enums']['evidence_category'];
          p_description: string;
          p_project_id: string;
          p_stage_key: Database['public']['Enums']['stage_key'];
          p_url: string;
        };
        Returns: string;
      };
      app_address_correction: {
        Args: {
          p_correction_id: string;
          p_evidence_ids?: string[];
          p_response: string;
        };
        Returns: undefined;
      };
      app_approve_stage_exception: {
        Args: {
          p_project_id: string;
          p_reason: string;
          p_stage_key: Database['public']['Enums']['stage_key'];
        };
        Returns: undefined;
      };
      app_assign_guide: {
        Args: { p_faculty_id: string; p_note?: string; p_project_id: string };
        Returns: undefined;
      };
      app_cancel_assignment_request: {
        Args: { p_request_id: string };
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
      app_decide_assignment_request: {
        Args: { p_approve: boolean; p_note?: string; p_request_id: string };
        Returns: undefined;
      };
      app_escalate_to_hod: {
        Args: { p_note: string; p_project_id: string };
        Returns: undefined;
      };
      app_generate_tasks: {
        Args: {
          p_project_id?: string;
          p_regenerate?: boolean;
          p_semester_id: string;
        };
        Returns: number;
      };
      app_grant_review_authorization: {
        Args: {
          p_faculty_id: string;
          p_note?: string;
          p_project_id: string;
          p_valid_until?: string;
        };
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
      app_import_roster: {
        Args: { p_dry_run?: boolean; p_rows: Json; p_semester_id: string };
        Returns: Json;
      };
      app_link_student: {
        Args: { p_student_id: string; p_user_id: string };
        Returns: undefined;
      };
      app_mark_notifications_read: {
        Args: { p_ids?: string[] };
        Returns: number;
      };
      app_my_context: { Args: never; Returns: Json };
      app_new_analysis_version: {
        Args: { p_paper_id: string };
        Returns: string;
      };
      app_new_draft_version: {
        Args: {
          p_project_id: string;
          p_section: Database['public']['Enums']['draft_section'];
        };
        Returns: string;
      };
      app_new_objective_version: {
        Args: { p_project_id: string };
        Returns: string;
      };
      app_override: {
        Args: { p_kind: string; p_project_id: string; p_reason: string };
        Returns: undefined;
      };
      app_record_execution_attempt: {
        Args: {
          p_attempted_at: string;
          p_debugging_notes?: string;
          p_errors?: string;
          p_evidence?: Json;
          p_notes?: string;
          p_outcome: Database['public']['Enums']['attempt_outcome'];
          p_repository_id: string;
        };
        Returns: string;
      };
      app_record_meeting: {
        Args: {
          p_attendee_ids: string[];
          p_held_on: string;
          p_notes: string;
          p_outcomes?: Json;
          p_semester_id: string;
          p_title: string;
        };
        Returns: string;
      };
      app_record_review: {
        Args: {
          p_comments?: string;
          p_corrections?: string[];
          p_observations?: string;
          p_outcome: Database['public']['Enums']['review_outcome'];
          p_target_id: string;
          p_target_type: Database['public']['Enums']['review_target'];
        };
        Returns: string;
      };
      app_record_signoff: {
        Args: {
          p_comments?: string;
          p_corrections?: string[];
          p_decision: Database['public']['Enums']['signoff_decision'];
          p_originality_remark: string;
          p_project_id: string;
        };
        Returns: string;
      };
      app_refresh_my_reminders: { Args: never; Returns: number };
      app_remove_co_reviewer: {
        Args: { p_faculty_id: string; p_note?: string; p_project_id: string };
        Returns: undefined;
      };
      app_request_assignment: {
        Args: {
          p_faculty_id: string;
          p_project_id: string;
          p_reason: string;
          p_type: Database['public']['Enums']['assignment_type'];
        };
        Returns: string;
      };
      app_resolve_correction: {
        Args: { p_action: string; p_correction_id: string; p_note?: string };
        Returns: undefined;
      };
      app_revoke_review_authorization: {
        Args: { p_authorization_id: string };
        Returns: undefined;
      };
      app_revoke_system_role: {
        Args: {
          p_role: Database['public']['Enums']['system_role'];
          p_user_id: string;
        };
        Returns: undefined;
      };
      app_save_analysis: {
        Args: { p_data: Json; p_paper_id: string };
        Returns: string;
      };
      app_save_draft: {
        Args: {
          p_data: Json;
          p_project_id: string;
          p_section: Database['public']['Enums']['draft_section'];
        };
        Returns: string;
      };
      app_save_evaluation_result: {
        Args: { p_data: Json; p_project_id: string; p_result_id?: string };
        Returns: string;
      };
      app_save_exploration: {
        Args: { p_data: Json; p_project_id: string };
        Returns: string;
      };
      app_save_implementation_item: {
        Args: { p_data: Json; p_item_id?: string; p_project_id: string };
        Returns: string;
      };
      app_save_objective: {
        Args: { p_data: Json; p_project_id: string };
        Returns: string;
      };
      app_save_paper: {
        Args: { p_data: Json; p_paper_id?: string; p_project_id: string };
        Returns: string;
      };
      app_save_repository: {
        Args: { p_data: Json; p_project_id: string };
        Returns: string;
      };
      app_select_paper: { Args: { p_paper_id: string }; Returns: undefined };
      app_set_blocked: {
        Args: {
          p_blocked: boolean;
          p_id: string;
          p_reason?: string;
          p_target: string;
        };
        Returns: undefined;
      };
      app_set_deliverable: {
        Args: {
          p_description: string;
          p_item: Database['public']['Enums']['deliverable_item'];
          p_notes?: string;
          p_project_id: string;
          p_url: string;
        };
        Returns: string;
      };
      app_set_expertise: {
        Args: {
          p_domain_ids: string[];
          p_semester_id: string;
          p_user_id?: string;
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
      app_set_my_drive_folder: {
        Args: { p_student_id: string; p_url: string };
        Returns: undefined;
      };
      app_set_panel: {
        Args: {
          p_member_ids: string[];
          p_name: string;
          p_panel_id?: string;
          p_project_ids: string[];
          p_semester_id: string;
        };
        Returns: string;
      };
      app_set_project_domain: {
        Args: { p_domain_id: string | null; p_project_id: string };
        Returns: undefined;
      };
      app_set_project_title: {
        Args: { p_project_id: string; p_title: string };
        Returns: undefined;
      };
      app_set_user_active: {
        Args: { p_is_active: boolean; p_reason: string; p_user_id: string };
        Returns: undefined;
      };
      app_start_review: {
        Args: { p_submission_id: string };
        Returns: undefined;
      };
      app_start_task: { Args: { p_task_id: string }; Returns: undefined };
      app_submit_record: {
        Args: {
          p_target_id: string;
          p_target_type: Database['public']['Enums']['review_target'];
        };
        Returns: undefined;
      };
      app_submit_task: {
        Args: {
          p_evidence?: Json;
          p_evidence_ids?: string[];
          p_progress_report: string;
          p_task_id: string;
        };
        Returns: string;
      };
      app_update_semester: {
        Args: { p_semester_id: string; p_settings: Json };
        Returns: undefined;
      };
      app_update_student: {
        Args: { p_patch: Json; p_student_id: string };
        Returns: undefined;
      };
      app_upsert_criterion: {
        Args: {
          p_criterion_id?: string;
          p_description?: string;
          p_domain_id: string;
          p_is_active?: boolean;
          p_name: string;
          p_sort_order?: number;
        };
        Returns: string;
      };
      app_upsert_domain: {
        Args: {
          p_description?: string;
          p_domain_id?: string;
          p_is_active?: boolean;
          p_name: string;
          p_semester_id: string;
        };
        Returns: string;
      };
      app_upsert_milestone: {
        Args: { p_data: Json; p_semester_id: string; p_week_no: number };
        Returns: string;
      };
      app_upsert_task_template: {
        Args: { p_data: Json; p_semester_id: string; p_template_id?: string };
        Returns: string;
      };
      app_verify_deliverable: {
        Args: {
          p_deliverable_id: string;
          p_note?: string;
          p_verification: Database['public']['Enums']['evidence_verification'];
        };
        Returns: undefined;
      };
      app_verify_evidence: {
        Args: {
          p_evidence_id: string;
          p_note?: string;
          p_verification: Database['public']['Enums']['evidence_verification'];
        };
        Returns: undefined;
      };
      app_withdraw_paper: {
        Args: { p_paper_id: string; p_reason?: string };
        Returns: undefined;
      };
      app_withdraw_student: {
        Args: { p_reason: string; p_student_id: string };
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      assignment_type: ['guide', 'co_reviewer'],
      attempt_outcome: ['success', 'failed', 'blocked'],
      code_availability: ['unknown', 'available', 'not_available'],
      correction_status: ['open', 'addressed', 'verified', 'waived'],
      deliverable_item: [
        'final_paper',
        'project_report',
        'source_repository',
        'source_zip',
        'readme',
        'dataset_references',
        'presentation',
        'demo_evidence',
      ],
      draft_section: [
        'title_abstract',
        'introduction',
        'literature_review',
        'problem_objectives',
        'methodology',
        'proposed_approach',
        'implementation',
        'results_discussion',
        'conclusion_future_work',
        'references',
      ],
      evaluation_kind: ['baseline', 'proposed'],
      evidence_category: [
        'research_paper_pdf',
        'paper_analysis',
        'github_repository',
        'execution_screenshot',
        'execution_log',
        'result_file',
        'objective_document',
        'implementation_evidence',
        'test_results',
        'paper_draft',
        'final_report',
        'presentation',
        'final_zip',
        'demo_evidence',
        'other',
      ],
      evidence_verification: ['unverified', 'verified', 'rejected', 'inaccessible'],
      execution_status: [
        'not_started',
        'repository_identified',
        'environment_setup',
        'execution_successful',
        'execution_failed',
        'blocked_dependency_dataset',
        'verification_pending',
        'verified',
      ],
      implementation_type: [
        'feature',
        'dataset',
        'model_change',
        'frontend',
        'backend',
        'integration',
        'bug',
      ],
      item_status: ['planned', 'in_progress', 'done', 'blocked', 'dropped'],
      paper_status: ['candidate', 'submitted', 'approved', 'rejected', 'withdrawn'],
      record_status: ['draft', 'submitted', 'changes_requested', 'approved', 'superseded'],
      request_status: ['pending', 'approved', 'rejected', 'cancelled'],
      review_outcome: ['accepted', 'changes_requested', 'rejected', 'comment_only'],
      review_target: [
        'exploration',
        'paper',
        'paper_analysis',
        'repository',
        'objective',
        'task_submission',
        'draft_section',
        'evaluation',
        'final',
      ],
      roster_status: ['empty', 'pending_invite', 'active', 'withdrawn'],
      semester_role: ['lead_faculty', 'faculty', 'student'],
      semester_status: ['draft', 'active', 'closed'],
      signoff_decision: ['approve', 'changes_required'],
      stage_key: [
        'exploration',
        'paper_selection',
        'paper_analysis',
        'code_execution',
        'objectives',
        'implementation',
        'evaluation',
        'paper_writing',
        'final',
      ],
      stage_status: [
        'not_started',
        'in_progress',
        'awaiting_approval',
        'changes_requested',
        'approved',
        'exception_approved',
      ],
      system_role: ['hod', 'admin'],
      task_status: [
        'not_started',
        'in_progress',
        'submitted',
        'under_review',
        'changes_requested',
        'resubmitted',
        'verified',
      ],
    },
  },
} as const;

// Local helpers (kept when regenerating).
type PublicSchema = Database['public'];
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row'];
export type RpcArgs<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Args'];
