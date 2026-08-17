export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          image_storage_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          image_storage_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          image_storage_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          email: string;
          theme: 'light' | 'dark';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          email: string;
          theme?: 'light' | 'dark';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          email?: string;
          theme?: 'light' | 'dark';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          access_role: 'owner' | 'admin' | 'member';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          access_role: 'owner' | 'admin' | 'member';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          access_role?: 'owner' | 'admin' | 'member';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          kind: 'ensemble' | 'choir' | 'class' | 'other';
          notes: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          kind: 'ensemble' | 'choir' | 'class' | 'other';
          notes?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          kind?: 'ensemble' | 'choir' | 'class' | 'other';
          notes?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_invite_preview: {
        Args: { p_token: string };
        Returns: {
          invite_id: string;
          organization_id: string;
          organization_name: string;
          organization_slug: string;
          organization_image_storage_key: string | null;
          group_id: string;
          group_name: string;
          expires_at: string;
        }[];
      };
      redeem_group_invite: {
        Args: { p_token: string };
        Returns: { organization_slug: string }[];
      };
      create_group_invite: {
        Args: { p_group_id: string; p_expires_at: string };
        Returns: { invite_id: string; token: string }[];
      };
      revoke_group_invite: {
        Args: { p_invite_id: string };
        Returns: undefined;
      };
      update_group_invite_expires: {
        Args: { p_invite_id: string; p_expires_at: string };
        Returns: undefined;
      };
      list_group_invites: {
        Args: { p_organization_id: string };
        Returns: {
          id: string;
          group_id: string;
          group_name: string;
          token: string | null;
          expires_at: string;
          revoked_at: string | null;
          redeemed_at: string | null;
          created_at: string;
        }[];
      };
    };
    Enums: {
      access_role: 'owner' | 'admin' | 'member';
      theme_preference: 'light' | 'dark';
      ensemble_role: 'member' | 'teacher' | 'section_lead';
      group_kind: 'ensemble' | 'choir' | 'class' | 'other';
    };
    CompositeTypes: Record<string, never>;
  };
};
