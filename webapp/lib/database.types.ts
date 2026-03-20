/**
 * Database types for Supabase
 *
 * This file defines TypeScript types for all Supabase tables.
 * Once you have a Supabase project set up, you can regenerate this file with:
 *
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > webapp/lib/database.types.ts
 *
 * The generated file will replace these manual definitions with auto-generated types.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          user_id: string;
          google_event_id: string;
          date: string;
          account: string;
          calendar_name: string;
          calendar_type: string;
          summary: string;
          description: string | null;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          color_id: string;
          color_name: string;
          color_meaning: string;
          is_all_day: boolean;
          is_recurring: boolean;
          recurring_event_id: string | null;
          first_seen: string;
          last_seen: string;
          attended: string;
          auto_categorized: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          google_event_id: string;
          date: string;
          account: string;
          calendar_name: string;
          calendar_type: string;
          summary: string;
          description?: string | null;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          color_id: string;
          color_name: string;
          color_meaning: string;
          is_all_day?: boolean;
          is_recurring?: boolean;
          recurring_event_id?: string | null;
          first_seen?: string;
          last_seen?: string;
          attended?: string;
          auto_categorized?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          google_event_id?: string;
          date?: string;
          account?: string;
          calendar_name?: string;
          calendar_type?: string;
          summary?: string;
          description?: string | null;
          start_time?: string;
          end_time?: string;
          duration_minutes?: number;
          color_id?: string;
          color_name?: string;
          color_meaning?: string;
          is_all_day?: boolean;
          is_recurring?: boolean;
          recurring_event_id?: string | null;
          first_seen?: string;
          last_seen?: string;
          attended?: string;
          auto_categorized?: boolean;
        };
      };
      daily_summaries: {
        Row: {
          id: number;
          user_id: string;
          date: string;
          total_scheduled_minutes: number;
          total_gap_minutes: number;
          categories_json: Json;
          is_work_day: boolean;
          analysis_hours_start: number;
          analysis_hours_end: number;
          snapshot_time: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          date: string;
          total_scheduled_minutes: number;
          total_gap_minutes: number;
          categories_json?: Json;
          is_work_day?: boolean;
          analysis_hours_start?: number;
          analysis_hours_end?: number;
          snapshot_time?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          date?: string;
          total_scheduled_minutes?: number;
          total_gap_minutes?: number;
          categories_json?: Json;
          is_work_day?: boolean;
          analysis_hours_start?: number;
          analysis_hours_end?: number;
          snapshot_time?: string;
        };
      };
      weekly_goals: {
        Row: {
          id: string;
          user_id: string;
          week_id: string;
          title: string;
          notes: string | null;
          estimated_minutes: number | null;
          goal_type: "time" | "outcome" | "habit";
          color_id: string | null;
          status: "active" | "completed" | "cancelled";
          progress_percent: number;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
          constraints_json: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_id: string;
          title: string;
          notes?: string | null;
          estimated_minutes?: number | null;
          goal_type?: "time" | "outcome" | "habit";
          color_id?: string | null;
          status?: "active" | "completed" | "cancelled";
          progress_percent?: number;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          constraints_json?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_id?: string;
          title?: string;
          notes?: string | null;
          estimated_minutes?: number | null;
          goal_type?: "time" | "outcome" | "habit";
          color_id?: string | null;
          status?: "active" | "completed" | "cancelled";
          progress_percent?: number;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          constraints_json?: Json | null;
        };
      };
      weekly_audit_state: {
        Row: {
          id: string;
          user_id: string;
          week_id: string;
          dismissed_at: string | null;
          snoozed_until: string | null;
          prompt_count: number;
          last_prompt_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_id: string;
          dismissed_at?: string | null;
          snoozed_until?: string | null;
          prompt_count?: number;
          last_prompt_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_id?: string;
          dismissed_at?: string | null;
          snoozed_until?: string | null;
          prompt_count?: number;
          last_prompt_at?: string | null;
          updated_at?: string;
        };
      };
      non_goals: {
        Row: {
          id: string;
          user_id: string;
          week_id: string;
          title: string;
          pattern: string;
          color_id: string | null;
          reason: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_id: string;
          title: string;
          pattern?: string;
          color_id?: string | null;
          reason?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_id?: string;
          title?: string;
          pattern?: string;
          color_id?: string | null;
          reason?: string | null;
          active?: boolean;
          created_at?: string;
        };
      };
      goal_progress: {
        Row: {
          id: number;
          user_id: string;
          goal_id: string;
          event_id: string;
          matched_at: string;
          match_type: "auto" | "manual";
          match_confidence: number | null;
          minutes_contributed: number;
        };
        Insert: {
          id?: number;
          user_id: string;
          goal_id: string;
          event_id: string;
          matched_at?: string;
          match_type: "auto" | "manual";
          match_confidence?: number | null;
          minutes_contributed: number;
        };
        Update: {
          id?: number;
          user_id?: string;
          goal_id?: string;
          event_id?: string;
          matched_at?: string;
          match_type?: "auto" | "manual";
          match_confidence?: number | null;
          minutes_contributed?: number;
        };
      };
      non_goal_alerts: {
        Row: {
          id: number;
          user_id: string;
          non_goal_id: string;
          event_id: string;
          detected_at: string;
          acknowledged: boolean;
        };
        Insert: {
          id?: number;
          user_id: string;
          non_goal_id: string;
          event_id: string;
          detected_at?: string;
          acknowledged?: boolean;
        };
        Update: {
          id?: number;
          user_id?: string;
          non_goal_id?: string;
          event_id?: string;
          detected_at?: string;
          acknowledged?: boolean;
        };
      };
      user_preferences: {
        Row: {
          id: number;
          user_id: string;
          key: string;
          value: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          key: string;
          value: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          key?: string;
          value?: string;
        };
      };
      linked_google_accounts: {
        Row: {
          id: string;
          user_id: string;
          google_email: string;
          google_user_id: string;
          display_name: string | null;
          account_label: string;
          access_token: string;
          refresh_token: string | null;
          token_expiry: string | null;
          scopes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          google_email: string;
          google_user_id: string;
          display_name?: string | null;
          account_label: string;
          access_token: string;
          refresh_token?: string | null;
          token_expiry?: string | null;
          scopes: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          google_email?: string;
          google_user_id?: string;
          display_name?: string | null;
          account_label?: string;
          access_token?: string;
          refresh_token?: string | null;
          token_expiry?: string | null;
          scopes?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      goal_type: "time" | "outcome" | "habit";
      goal_status: "active" | "completed" | "cancelled";
      match_type: "auto" | "manual";
      attendance: "attended" | "skipped" | "unknown";
    };
  };
}

// ============================================================================
// Helper Types
// ============================================================================

// Table row types (for reading data)
export type Event = Database["public"]["Tables"]["events"]["Row"];
export type DailySummary = Database["public"]["Tables"]["daily_summaries"]["Row"];
export type WeeklyGoal = Database["public"]["Tables"]["weekly_goals"]["Row"];
export type WeeklyAuditState = Database["public"]["Tables"]["weekly_audit_state"]["Row"];
export type NonGoal = Database["public"]["Tables"]["non_goals"]["Row"];
export type GoalProgress = Database["public"]["Tables"]["goal_progress"]["Row"];
export type NonGoalAlert = Database["public"]["Tables"]["non_goal_alerts"]["Row"];
export type UserPreference = Database["public"]["Tables"]["user_preferences"]["Row"];
export type LinkedGoogleAccount = Database["public"]["Tables"]["linked_google_accounts"]["Row"];

// Insert types (for creating new records)
export type EventInsert = Database["public"]["Tables"]["events"]["Insert"];
export type DailySummaryInsert = Database["public"]["Tables"]["daily_summaries"]["Insert"];
export type WeeklyGoalInsert = Database["public"]["Tables"]["weekly_goals"]["Insert"];
export type WeeklyAuditStateInsert = Database["public"]["Tables"]["weekly_audit_state"]["Insert"];
export type NonGoalInsert = Database["public"]["Tables"]["non_goals"]["Insert"];
export type GoalProgressInsert = Database["public"]["Tables"]["goal_progress"]["Insert"];
export type NonGoalAlertInsert = Database["public"]["Tables"]["non_goal_alerts"]["Insert"];
export type UserPreferenceInsert = Database["public"]["Tables"]["user_preferences"]["Insert"];
export type LinkedGoogleAccountInsert = Database["public"]["Tables"]["linked_google_accounts"]["Insert"];

// Update types (for modifying records)
export type EventUpdate = Database["public"]["Tables"]["events"]["Update"];
export type DailySummaryUpdate = Database["public"]["Tables"]["daily_summaries"]["Update"];
export type WeeklyGoalUpdate = Database["public"]["Tables"]["weekly_goals"]["Update"];
export type WeeklyAuditStateUpdate = Database["public"]["Tables"]["weekly_audit_state"]["Update"];
export type NonGoalUpdate = Database["public"]["Tables"]["non_goals"]["Update"];
export type GoalProgressUpdate = Database["public"]["Tables"]["goal_progress"]["Update"];
export type NonGoalAlertUpdate = Database["public"]["Tables"]["non_goal_alerts"]["Update"];
export type UserPreferenceUpdate = Database["public"]["Tables"]["user_preferences"]["Update"];
export type LinkedGoogleAccountUpdate = Database["public"]["Tables"]["linked_google_accounts"]["Update"];

// Enum types
export type GoalType = Database["public"]["Enums"]["goal_type"];
export type GoalStatus = Database["public"]["Enums"]["goal_status"];
export type MatchType = Database["public"]["Enums"]["match_type"];
export type Attendance = Database["public"]["Enums"]["attendance"];

// Color summary type (stored as JSON in daily_summaries.categories_json)
export interface ColorSummary {
  colorId: string;
  colorName: string;
  colorMeaning: string;
  totalMinutes: number;
  eventCount: number;
}
