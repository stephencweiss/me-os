/**
 * Database types for Supabase
 *
 * This is a placeholder file. Once you have a Supabase project set up,
 * regenerate this file with:
 *
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > webapp/lib/database.types.ts
 *
 * For now, we define minimal types to get the app compiling.
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
        Insert: Omit<Database["public"]["Tables"]["events"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Row"]>;
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
        Insert: Omit<
          Database["public"]["Tables"]["daily_summaries"]["Row"],
          "id"
        > & { id?: number };
        Update: Partial<
          Database["public"]["Tables"]["daily_summaries"]["Row"]
        >;
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
        };
        Insert: Omit<
          Database["public"]["Tables"]["weekly_goals"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_goals"]["Row"]>;
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
        Insert: Omit<
          Database["public"]["Tables"]["non_goals"]["Row"],
          "id" | "created_at"
        > & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["non_goals"]["Row"]>;
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
        Insert: Omit<
          Database["public"]["Tables"]["goal_progress"]["Row"],
          "id" | "matched_at"
        > & {
          id?: number;
          matched_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["goal_progress"]["Row"]>;
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
        Insert: Omit<
          Database["public"]["Tables"]["non_goal_alerts"]["Row"],
          "id" | "detected_at"
        > & {
          id?: number;
          detected_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["non_goal_alerts"]["Row"]
        >;
      };
      user_preferences: {
        Row: {
          id: number;
          user_id: string;
          key: string;
          value: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["user_preferences"]["Row"],
          "id"
        > & { id?: number };
        Update: Partial<
          Database["public"]["Tables"]["user_preferences"]["Row"]
        >;
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
        Insert: Omit<
          Database["public"]["Tables"]["linked_google_accounts"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["linked_google_accounts"]["Row"]
        >;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
