export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  next_auth: {
    Tables: {
      accounts: {
        Row: {
          access_token: string | null
          expires_at: number | null
          id: string
          id_token: string | null
          oauth_token: string | null
          oauth_token_secret: string | null
          provider: string
          providerAccountId: string
          refresh_token: string | null
          scope: string | null
          session_state: string | null
          token_type: string | null
          type: string
          userId: string | null
        }
        Insert: {
          access_token?: string | null
          expires_at?: number | null
          id?: string
          id_token?: string | null
          oauth_token?: string | null
          oauth_token_secret?: string | null
          provider: string
          providerAccountId: string
          refresh_token?: string | null
          scope?: string | null
          session_state?: string | null
          token_type?: string | null
          type: string
          userId?: string | null
        }
        Update: {
          access_token?: string | null
          expires_at?: number | null
          id?: string
          id_token?: string | null
          oauth_token?: string | null
          oauth_token_secret?: string | null
          provider?: string
          providerAccountId?: string
          refresh_token?: string | null
          scope?: string | null
          session_state?: string | null
          token_type?: string | null
          type?: string
          userId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          expires: string
          id: string
          sessionToken: string
          userId: string | null
        }
        Insert: {
          expires: string
          id?: string
          sessionToken: string
          userId?: string | null
        }
        Update: {
          expires?: string
          id?: string
          sessionToken?: string
          userId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          email: string | null
          emailVerified: string | null
          id: string
          image: string | null
          name: string | null
        }
        Insert: {
          email?: string | null
          emailVerified?: string | null
          id?: string
          image?: string | null
          name?: string | null
        }
        Update: {
          email?: string | null
          emailVerified?: string | null
          id?: string
          image?: string | null
          name?: string | null
        }
        Relationships: []
      }
      verification_tokens: {
        Row: {
          expires: string
          identifier: string | null
          token: string
        }
        Insert: {
          expires: string
          identifier?: string | null
          token: string
        }
        Update: {
          expires?: string
          identifier?: string | null
          token?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      uid: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      daily_summaries: {
        Row: {
          analysis_hours_end: number
          analysis_hours_start: number
          categories_json: Json
          date: string
          id: number
          is_work_day: boolean
          snapshot_time: string
          total_gap_minutes: number
          total_scheduled_minutes: number
          user_id: string
        }
        Insert: {
          analysis_hours_end?: number
          analysis_hours_start?: number
          categories_json?: Json
          date: string
          id?: number
          is_work_day?: boolean
          snapshot_time?: string
          total_gap_minutes: number
          total_scheduled_minutes: number
          user_id: string
        }
        Update: {
          analysis_hours_end?: number
          analysis_hours_start?: number
          categories_json?: Json
          date?: string
          id?: number
          is_work_day?: boolean
          snapshot_time?: string
          total_gap_minutes?: number
          total_scheduled_minutes?: number
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          account: string
          attended: string
          auto_categorized: boolean
          calendar_name: string
          calendar_type: string
          color_id: string
          color_meaning: string
          color_name: string
          date: string
          description: string | null
          duration_minutes: number
          end_time: string
          first_seen: string
          google_event_id: string
          id: string
          is_all_day: boolean
          is_recurring: boolean
          last_seen: string
          recurring_event_id: string | null
          removed_at: string | null
          start_time: string
          summary: string
          user_id: string
        }
        Insert: {
          account: string
          attended?: string
          auto_categorized?: boolean
          calendar_name: string
          calendar_type: string
          color_id: string
          color_meaning: string
          color_name: string
          date: string
          description?: string | null
          duration_minutes: number
          end_time: string
          first_seen?: string
          google_event_id: string
          id: string
          is_all_day?: boolean
          is_recurring?: boolean
          last_seen?: string
          recurring_event_id?: string | null
          removed_at?: string | null
          start_time: string
          summary: string
          user_id: string
        }
        Update: {
          account?: string
          attended?: string
          auto_categorized?: boolean
          calendar_name?: string
          calendar_type?: string
          color_id?: string
          color_meaning?: string
          color_name?: string
          date?: string
          description?: string | null
          duration_minutes?: number
          end_time?: string
          first_seen?: string
          google_event_id?: string
          id?: string
          is_all_day?: boolean
          is_recurring?: boolean
          last_seen?: string
          recurring_event_id?: string | null
          removed_at?: string | null
          start_time?: string
          summary?: string
          user_id?: string
        }
        Relationships: []
      }
      goal_progress: {
        Row: {
          event_id: string
          goal_id: string
          id: number
          match_confidence: number | null
          match_type: string
          matched_at: string
          minutes_contributed: number
          user_id: string
        }
        Insert: {
          event_id: string
          goal_id: string
          id?: number
          match_confidence?: number | null
          match_type: string
          matched_at?: string
          minutes_contributed: number
          user_id: string
        }
        Update: {
          event_id?: string
          goal_id?: string
          id?: number
          match_confidence?: number | null
          match_type?: string
          matched_at?: string
          minutes_contributed?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_progress_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_progress_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "weekly_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      linked_google_accounts: {
        Row: {
          access_token: string
          account_label: string
          created_at: string
          display_name: string | null
          google_email: string
          google_user_id: string
          id: string
          refresh_token: string | null
          scopes: string
          token_expiry: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_label: string
          created_at?: string
          display_name?: string | null
          google_email: string
          google_user_id: string
          id: string
          refresh_token?: string | null
          scopes: string
          token_expiry?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_label?: string
          created_at?: string
          display_name?: string | null
          google_email?: string
          google_user_id?: string
          id?: string
          refresh_token?: string | null
          scopes?: string
          token_expiry?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      non_goal_alerts: {
        Row: {
          acknowledged: boolean
          detected_at: string
          event_id: string
          id: number
          non_goal_id: string
          user_id: string
        }
        Insert: {
          acknowledged?: boolean
          detected_at?: string
          event_id: string
          id?: number
          non_goal_id: string
          user_id: string
        }
        Update: {
          acknowledged?: boolean
          detected_at?: string
          event_id?: string
          id?: number
          non_goal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "non_goal_alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_goal_alerts_non_goal_id_fkey"
            columns: ["non_goal_id"]
            isOneToOne: false
            referencedRelation: "non_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      non_goals: {
        Row: {
          active: boolean
          color_id: string | null
          created_at: string
          id: string
          pattern: string
          reason: string | null
          title: string
          user_id: string
          week_id: string
        }
        Insert: {
          active?: boolean
          color_id?: string | null
          created_at?: string
          id: string
          pattern: string
          reason?: string | null
          title: string
          user_id: string
          week_id: string
        }
        Update: {
          active?: boolean
          color_id?: string | null
          created_at?: string
          id?: string
          pattern?: string
          reason?: string | null
          title?: string
          user_id?: string
          week_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          id: number
          key: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          id?: number
          key: string
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          id?: number
          key?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      weekly_audit_state: {
        Row: {
          dismissed_at: string | null
          id: string
          last_prompt_at: string | null
          prompt_count: number
          snoozed_until: string | null
          updated_at: string
          user_id: string
          week_id: string
        }
        Insert: {
          dismissed_at?: string | null
          id?: string
          last_prompt_at?: string | null
          prompt_count?: number
          snoozed_until?: string | null
          updated_at?: string
          user_id: string
          week_id: string
        }
        Update: {
          dismissed_at?: string | null
          id?: string
          last_prompt_at?: string | null
          prompt_count?: number
          snoozed_until?: string | null
          updated_at?: string
          user_id?: string
          week_id?: string
        }
        Relationships: []
      }
      weekly_goals: {
        Row: {
          color_id: string | null
          completed_at: string | null
          constraints_json: Json | null
          created_at: string
          estimated_minutes: number | null
          goal_type: string
          id: string
          notes: string | null
          progress_percent: number
          status: string
          title: string
          updated_at: string
          user_id: string
          week_id: string
        }
        Insert: {
          color_id?: string | null
          completed_at?: string | null
          constraints_json?: Json | null
          created_at?: string
          estimated_minutes?: number | null
          goal_type: string
          id: string
          notes?: string | null
          progress_percent?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
          week_id: string
        }
        Update: {
          color_id?: string | null
          completed_at?: string | null
          constraints_json?: Json | null
          created_at?: string
          estimated_minutes?: number | null
          goal_type?: string
          id?: string
          notes?: string | null
          progress_percent?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          week_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  next_auth: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
