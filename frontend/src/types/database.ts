/**
 * Tipo database para TypeScript (gerado via Supabase CLI: supabase gen types typescript)
 * Baseado no schema de migração 20261103000000_initial_schema.sql
 */

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: number;
          username: string;
          name: string;
          bio: string;
          avatar: string | null;
          password_hash: string;
          created_at: number;
          birth_date: string | null;
          interests: string;
          message_policy: string;
          is_private: number;
          last_active_at: number | null;
          banner: string | null;
          subscription_status: string;
          subscription_ends_at: number | null;
          theme_palette: string;
        };
        Insert: {
          username: string;
          name: string;
          bio?: string;
          avatar?: string | null;
          password_hash: string;
          birth_date?: string | null;
          interests?: string;
          message_policy?: string;
          is_private?: number;
          last_active_at?: number | null;
          banner?: string | null;
          subscription_status?: string;
          subscription_ends_at?: number | null;
          theme_palette?: string;
        };
        Update: Partial<{
          id: number;
          username: string;
          name: string;
          bio: string;
          avatar: string | null;
          password_hash: string;
          created_at: number;
          birth_date: string | null;
          interests: string;
          message_policy: string;
          is_private: number;
          last_active_at: number | null;
          banner: string | null;
          subscription_status: string;
          subscription_ends_at: number | null;
          theme_palette: string;
        }>;
      };
      sessions: {
        Row: {
          token: string;
          user_id: number;
          created_at: number;
          user_agent: string | null;
        };
        Insert: {
          token: string;
          user_id: number;
          created_at: number;
          user_agent?: string | null;
        };
        Update: Partial<{
          token: string;
          user_id: number;
          created_at: number;
          user_agent: string | null;
        }>;
        Delete: {};
      };
      posts: {
        Row: {
          id: number;
          user_id: number;
          image: string;
          caption: string;
          created_at: number;
          media_type: string;
          topic: string;
        };
        Insert: {
          user_id: number;
          image: string;
          caption?: string;
          created_at: number;
          media_type?: string;
          topic?: string;
        };
        Update: Partial<{
          id: number;
          user_id: number;
          image: string;
          caption: string;
          created_at: number;
          media_type: string;
          topic: string;
        }>;
        Delete: {};
      };
      post_media: {
        Row: {
          id: number;
          post_id: number;
          url: string;
          media_type: string;
          position: number;
        };
        Insert: {
          post_id: number;
          url: string;
          media_type?: string;
          position?: number;
        };
        Update: Partial<{
          id: number;
          post_id: number;
          url: string;
          media_type: string;
          position: number;
        }>;
        Delete: {};
      };
      likes: {
        Row: {
          user_id: number;
          post_id: number;
          created_at: number;
        };
        Insert: {
          user_id: number;
          post_id: number;
          created_at: number;
        };
        Update: Partial<{
          user_id: number;
          post_id: number;
          created_at: number;
        }>;
        Delete: {};
      };
      comments: {
        Row: {
          id: number;
          post_id: number;
          user_id: number;
          text: string;
          created_at: number;
        };
        Insert: {
          post_id: number;
          user_id: number;
          text: string;
          created_at: number;
        };
        Update: Partial<{
          id: number;
          post_id: number;
          user_id: number;
          text: string;
          created_at: number;
        }>;
        Delete: {};
      };
      follows: {
        Row: {
          follower_id: number;
          following_id: number;
          created_at: number;
        };
        Insert: {
          follower_id: number;
          following_id: number;
          created_at: number;
        };
        Update: Partial<{
          follower_id: number;
          following_id: number;
          created_at: number;
        }>;
        Delete: {};
      };
      follow_requests: {
        Row: {
          id: number;
          requester_id: number;
          target_id: number;
          created_at: number;
        };
        Insert: {
          requester_id: number;
          target_id: number;
          created_at: number;
        };
        Update: Partial<{
          id: number;
          requester_id: number;
          target_id: number;
          created_at: number;
        }>;
        Delete: {};
      };
      close_friends: {
        Row: {
          owner_id: number;
          friend_id: number;
          created_at: number;
        };
        Insert: {
          owner_id: number;
          friend_id: number;
          created_at: number;
        };
        Update: Partial<{
          owner_id: number;
          friend_id: number;
          created_at: number;
        }>;
        Delete: {};
      };
      stories: {
        Row: {
          id: number;
          user_id: number;
          image: string;
          created_at: number;
          expires_at: number;
          media_type: string;
          audience: string;
          caption: string;
          mentions: string;
        };
        Insert: {
          user_id: number;
          image: string;
          created_at: number;
          expires_at: number;
          media_type?: string;
          audience?: string;
          caption?: string;
          mentions?: string;
        };
        Update: Partial<{
          id: number;
          user_id: number;
          image: string;
          created_at: number;
          expires_at: number;
          media_type: string;
          audience: string;
          caption: string;
          mentions: string;
        }>;
        Delete: {};
      };
      story_views: {
        Row: {
          story_id: number;
          user_id: number;
          viewed_at: number;
        };
        Insert: {
          story_id: number;
          user_id: number;
          viewed_at: number;
        };
        Update: Partial<{
          story_id: number;
          user_id: number;
          viewed_at: number;
        }>;
        Delete: {};
      };
      shares: {
        Row: {
          user_id: number;
          post_id: number;
          created_at: number;
        };
        Insert: {
          user_id: number;
          post_id: number;
          created_at: number;
        };
        Update: Partial<{
          user_id: number;
          post_id: number;
          created_at: number;
        }>;
        Delete: {};
      };
      blocks: {
        Row: {
          blocker_id: number;
          blocked_id: number;
          created_at: number;
        };
        Insert: {
          blocker_id: number;
          blocked_id: number;
          created_at: number;
        };
        Update: Partial<{
          blocker_id: number;
          blocked_id: number;
          created_at: number;
        }>;
        Delete: {};
      };
      reports: {
        Row: {
          id: number;
          reporter_id: number;
          target_type: 'user' | 'post' | 'story' | 'message';
          target_id: number;
          reason: string;
          details: string;
          status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
          created_at: number;
          reviewed_at: number | null;
        };
        Insert: {
          reporter_id: number;
          target_type: 'user' | 'post' | 'story' | 'message';
          target_id: number;
          reason: string;
          details?: string;
          status?: 'open' | 'reviewing' | 'resolved' | 'dismissed';
          created_at: number;
          reviewed_at?: number | null;
        };
        Update: Partial<{
          id: number;
          reporter_id: number;
          target_type: 'user' | 'post' | 'story' | 'message';
          target_id: number;
          reason: string;
          details: string;
          status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
          created_at: number;
          reviewed_at: number | null;
        }>;
        Delete: {};
      };
      problem_reports: {
        Row: {
          id: number;
          reporter_id: number;
          category: 'bug' | 'layout' | 'login' | 'performance' | 'moderation' | 'other';
          title: string;
          details: string;
          context: string;
          status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
          created_at: number;
          reviewed_at: number | null;
        };
        Insert: {
          reporter_id: number;
          category: 'bug' | 'layout' | 'login' | 'performance' | 'moderation' | 'other';
          title: string;
          details?: string;
          context?: string;
          status?: 'open' | 'reviewing' | 'resolved' | 'dismissed';
          created_at: number;
          reviewed_at?: number | null;
        };
        Update: Partial<{
          id: number;
          reporter_id: number;
          category: 'bug' | 'layout' | 'login' | 'performance' | 'moderation' | 'other';
          title: string;
          details: string;
          context: string;
          status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
          created_at: number;
          reviewed_at: number | null;
        }>;
        Delete: {};
      };
      notifications: {
        Row: {
          id: number;
          user_id: number;
          kind: string;
          text: string;
          link: string | null;
          created_at: number;
          read_at: number | null;
        };
        Insert: {
          user_id: number;
          kind: string;
          text: string;
          link?: string | null;
          created_at: number;
          read_at?: number | null;
        };
        Update: Partial<{
          id: number;
          user_id: number;
          kind: string;
          text: string;
          link: string | null;
          created_at: number;
          read_at: number | null;
        }>;
        Delete: {};
      };
      identity_verifications: {
        Row: {
          id: number;
          user_id: number;
          provider: string;
          status: 'in_review' | 'approved' | 'rejected' | 'needs_review' | 'expired';
          is_simulation: number;
          provider_ref: string | null;
          submitted_at: number | null;
          reviewed_at: number | null;
          expires_at: number | null;
          reason: string | null;
        };
        Insert: {
          user_id: number;
          provider: string;
          status: 'in_review' | 'approved' | 'rejected' | 'needs_review' | 'expired';
          is_simulation?: number;
          provider_ref?: string | null;
          submitted_at?: number | null;
          reviewed_at?: number | null;
          expires_at?: number | null;
          reason?: string | null;
        };
        Update: Partial<{
          id: number;
          user_id: number;
          provider: string;
          status: 'in_review' | 'approved' | 'rejected' | 'needs_review' | 'expired';
          is_simulation: number;
          provider_ref: string | null;
          submitted_at: number | null;
          reviewed_at: number | null;
          expires_at: number | null;
          reason: string | null;
        }>;
        Delete: {};
      };
      dating_profiles: {
        Row: {
          user_id: number;
          bio: string;
          photos: string;
          interests: string;
          goals: string;
          age_min: number;
          age_max: number;
          distance_km: number;
          active: number;
          paused: number;
          radar_enabled: number;
          created_at: number;
          updated_at: number;
        };
        Insert: {
          user_id: number;
          bio?: string;
          photos?: string;
          interests?: string;
          goals?: string;
          age_min?: number;
          age_max?: number;
          distance_km?: number;
          active?: number;
          paused?: number;
          radar_enabled?: number;
          created_at: number;
          updated_at: number;
        };
        Update: Partial<{
          user_id: number;
          bio: string;
          photos: string;
          interests: string;
          goals: string;
          age_min: number;
          age_max: number;
          distance_km: number;
          active: number;
          paused: number;
          radar_enabled: number;
          created_at: number;
          updated_at: number;
        }>;
        Delete: {};
      };
      compatibility_answers: {
        Row: {
          user_id: number;
          question_id: string;
          answer: string;
          updated_at: number;
        };
        Insert: {
          user_id: number;
          question_id: string;
          answer: string;
          updated_at: number;
        };
        Update: Partial<{
          user_id: number;
          question_id: string;
          answer: string;
          updated_at: number;
        }>;
        Delete: {};
      };
      dating_likes: {
        Row: {
          from_user_id: number;
          to_user_id: number;
          action: 'like' | 'pass';
          created_at: number;
        };
        Insert: {
          from_user_id: number;
          to_user_id: number;
          action: 'like' | 'pass';
          created_at: number;
        };
        Update: Partial<{
          from_user_id: number;
          to_user_id: number;
          action: 'like' | 'pass';
          created_at: number;
        }>;
        Delete: {};
      };
      matches: {
        Row: {
          id: number;
          user_a: number;
          user_b: number;
          created_at: number;
          ended_at: number | null;
          ended_by: number | null;
        };
        Insert: {
          user_a: number;
          user_b: number;
          created_at: number;
          ended_at?: number | null;
          ended_by?: number | null;
        };
        Update: Partial<{
          id: number;
          user_a: number;
          user_b: number;
          created_at: number;
          ended_at: number | null;
          ended_by: number | null;
        }>;
        Delete: {};
      };
      conversations: {
        Row: {
          id: number;
          kind: 'social' | 'dating';
          match_id: number | null;
          created_at: number;
          updated_at: number;
        };
        Insert: {
          kind: 'social' | 'dating';
          match_id?: number | null;
          created_at: number;
          updated_at: number;
        };
        Update: Partial<{
          id: number;
          kind: 'social' | 'dating';
          match_id: number | null;
          created_at: number;
          updated_at: number;
        }>;
        Delete: {};
      };
      conversation_members: {
        Row: {
          conversation_id: number;
          user_id: number;
          last_read_at: number;
          created_at: number;
        };
        Insert: {
          conversation_id: number;
          user_id: number;
          last_read_at?: number;
          created_at: number;
        };
        Update: Partial<{
          conversation_id: number;
          user_id: number;
          last_read_at: number;
          created_at: number;
        }>;
        Delete: {};
      };
      messages: {
        Row: {
          id: number;
          conversation_id: number;
          sender_id: number;
          body: string;
          shared_post_id: number | null;
          created_at: number;
          deleted_at: number | null;
        };
        Insert: {
          conversation_id: number;
          sender_id: number;
          body?: string;
          shared_post_id?: number | null;
          created_at: number;
          deleted_at?: number | null;
        };
        Update: Partial<{
          id: number;
          conversation_id: number;
          sender_id: number;
          body: string;
          shared_post_id: number | null;
          created_at: number;
          deleted_at: number | null;
        }>;
        Delete: {};
      };
      location_consents: {
        Row: {
          match_id: number;
          user_id: number;
          enabled: number;
          updated_at: number;
        };
        Insert: {
          match_id: number;
          user_id: number;
          enabled?: number;
          updated_at: number;
        };
        Update: Partial<{
          match_id: number;
          user_id: number;
          enabled: number;
          updated_at: number;
        }>;
        Delete: {};
      };
      location_snapshots: {
        Row: {
          user_id: number;
          lat: number;
          lng: number;
          accuracy: number;
          updated_at: number;
        };
        Insert: {
          user_id: number;
          lat: number;
          lng: number;
          accuracy?: number;
          updated_at: number;
        };
        Update: Partial<{
          user_id: number;
          lat: number;
          lng: number;
          accuracy: number;
          updated_at: number;
        }>;
        Delete: {};
      };
      radar_prefs: {
        Row: {
          user_id: number;
          alerts_enabled: number;
          threshold_m: number;
          updated_at: number;
        };
        Insert: {
          user_id: number;
          alerts_enabled?: number;
          threshold_m?: number;
          updated_at: number;
        };
        Update: Partial<{
          user_id: number;
          alerts_enabled: number;
          threshold_m: number;
          updated_at: number;
        }>;
        Delete: {};
      };
      radar_alerts: {
        Row: {
          match_id: number;
          user_id: number;
          last_notified_at: number;
          distance_m: number;
        };
        Insert: {
          match_id: number;
          user_id: number;
          last_notified_at: number;
          distance_m: number;
        };
        Update: Partial<{
          match_id: number;
          user_id: number;
          last_notified_at: number;
          distance_m: number;
        }>;
        Delete: {};
      };
      story_reactions: {
        Row: {
          story_id: number;
          user_id: number;
          emoji: string;
          created_at: number;
        };
        Insert: {
          story_id: number;
          user_id: number;
          emoji: string;
          created_at: number;
        };
        Update: Partial<{
          story_id: number;
          user_id: number;
          emoji: string;
          created_at: number;
        }>;
        Delete: {};
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      report_target_type: 'user' | 'post' | 'story' | 'message';
      report_status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
      problem_category: 'bug' | 'layout' | 'login' | 'performance' | 'moderation' | 'other';
      problem_status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
      identity_status: 'in_review' | 'approved' | 'rejected' | 'needs_review' | 'expired';
      conversation_kind: 'social' | 'dating';
    };
  };
};