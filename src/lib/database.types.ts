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
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
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
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
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
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
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
            referencedRelation: 'v_projects';
            referencedColumns: ['id'];
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
      v_projects: {
        Row: {
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
    };
    Functions: {
      app_add_empty_slots: {
        Args: { p_semester_id: string; p_up_to_slot: number };
        Returns: number;
      };
      app_assign_guide: {
        Args: { p_faculty_id: string; p_note?: string; p_project_id: string };
        Returns: undefined;
      };
      app_cancel_assignment_request: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
      app_decide_assignment_request: {
        Args: { p_approve: boolean; p_note?: string; p_request_id: string };
        Returns: undefined;
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
      app_import_roster: {
        Args: { p_dry_run?: boolean; p_rows: Json; p_semester_id: string };
        Returns: Json;
      };
      app_link_student: {
        Args: { p_student_id: string; p_user_id: string };
        Returns: undefined;
      };
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
      app_revoke_review_authorization: {
        Args: { p_authorization_id: string };
        Returns: undefined;
      };
      app_set_expertise: {
        Args: { p_domain_ids: string[]; p_semester_id: string; p_user_id?: string };
        Returns: undefined;
      };
      app_set_my_drive_folder: {
        Args: { p_student_id: string; p_url: string };
        Returns: undefined;
      };
      app_set_project_domain: {
        Args: { p_domain_id: string | null; p_project_id: string };
        Returns: undefined;
      };
      app_set_project_title: {
        Args: { p_project_id: string; p_title: string };
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
      app_withdraw_student: {
        Args: { p_reason: string; p_student_id: string };
        Returns: undefined;
      };
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
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
export type RpcArgs<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Args'];
