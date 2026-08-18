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
        Relationships: [
          {
            foreignKeyName: 'assignments_group_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['group_id'];
          },
        ];
      };
      musicians: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          birth_date: string | null;
          phone: string | null;
          email: string | null;
          user_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          full_name: string;
          birth_date?: string | null;
          phone?: string | null;
          email?: string | null;
          user_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          full_name?: string;
          birth_date?: string | null;
          phone?: string | null;
          email?: string | null;
          user_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      parts: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          kind: 'instrument' | 'voice';
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          kind: 'instrument' | 'voice';
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          kind?: 'instrument' | 'voice';
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      part_divisions: {
        Row: {
          id: string;
          organization_id: string;
          part_id: string;
          name: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          part_id: string;
          name: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          part_id?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sections: {
        Row: {
          id: string;
          organization_id: string;
          group_id: string;
          name: string;
          sort_order: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          group_id: string;
          name: string;
          sort_order?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          group_id?: string;
          name?: string;
          sort_order?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      section_parts: {
        Row: {
          section_id: string;
          part_id: string;
          organization_id: string;
          created_at: string;
        };
        Insert: {
          section_id: string;
          part_id: string;
          organization_id: string;
          created_at?: string;
        };
        Update: {
          section_id?: string;
          part_id?: string;
          organization_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'section_parts_section_id_fkey';
            columns: ['section_id'];
            isOneToOne: false;
            referencedRelation: 'sections';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'section_parts_part_id_fkey';
            columns: ['part_id'];
            isOneToOne: false;
            referencedRelation: 'parts';
            referencedColumns: ['id'];
          },
        ];
      };
      event_types: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          kind: 'rehearsal' | 'service' | 'class' | 'special';
          sort_order: number;
          color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          kind: 'rehearsal' | 'service' | 'class' | 'special';
          sort_order?: number;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          kind?: 'rehearsal' | 'service' | 'class' | 'special';
          sort_order?: number;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          organization_id: string;
          type_id: string;
          title: string | null;
          starts_at: string;
          ends_at: string | null;
          location: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          type_id: string;
          title?: string | null;
          starts_at: string;
          ends_at?: string | null;
          location?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          type_id?: string;
          title?: string | null;
          starts_at?: string;
          ends_at?: string | null;
          location?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      program_items: {
        Row: {
          id: string;
          organization_id: string;
          event_id: string;
          piece_id: string;
          sort_order: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          event_id: string;
          piece_id: string;
          sort_order?: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          event_id?: string;
          piece_id?: string;
          sort_order?: number;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      assignments: {
        Row: {
          id: string;
          organization_id: string;
          musician_id: string;
          group_id: string;
          section_id: string | null;
          part_id: string | null;
          ensemble_role: 'member' | 'teacher' | 'section_lead';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          musician_id: string;
          group_id: string;
          section_id?: string | null;
          part_id?: string | null;
          ensemble_role: 'member' | 'teacher' | 'section_lead';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          musician_id?: string;
          group_id?: string;
          section_id?: string | null;
          part_id?: string | null;
          ensemble_role?: 'member' | 'teacher' | 'section_lead';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assignments_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_section_id_fkey';
            columns: ['section_id'];
            isOneToOne: false;
            referencedRelation: 'sections';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_part_id_fkey';
            columns: ['part_id'];
            isOneToOne: false;
            referencedRelation: 'parts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_musician_id_fkey';
            columns: ['musician_id'];
            isOneToOne: false;
            referencedRelation: 'musicians';
            referencedColumns: ['id'];
          },
        ];
      };
      piece_file_annotations: {
        Row: {
          id: string;
          organization_id: string;
          piece_file_id: string;
          page_number: number;
          layer: 'personal' | 'section';
          type: 'stroke' | 'highlight';
          geometry: Json;
          color: string;
          author_user_id: string;
          section_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          piece_file_id: string;
          page_number: number;
          layer: 'personal' | 'section';
          type: 'stroke' | 'highlight';
          geometry: Json;
          color: string;
          author_user_id: string;
          section_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          piece_file_id?: string;
          page_number?: number;
          layer?: 'personal' | 'section';
          type?: 'stroke' | 'highlight';
          geometry?: Json;
          color?: string;
          author_user_id?: string;
          section_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'piece_file_annotations_piece_file_id_fkey';
            columns: ['piece_file_id'];
            isOneToOne: false;
            referencedRelation: 'piece_files';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'piece_file_annotations_section_id_fkey';
            columns: ['section_id'];
            isOneToOne: false;
            referencedRelation: 'sections';
            referencedColumns: ['id'];
          },
        ];
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
        Args: { p_token: string; p_phone?: string | null; p_birth_date?: string | null };
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
      current_musician_id: {
        Args: { p_org_id: string };
        Returns: string;
      };
      is_in_section: {
        Args: { p_org_id: string; p_section_id: string };
        Returns: boolean;
      };
      is_section_lead_for: {
        Args: { p_org_id: string; p_section_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      access_role: 'owner' | 'admin' | 'member';
      theme_preference: 'light' | 'dark';
      ensemble_role: 'member' | 'teacher' | 'section_lead';
      group_kind: 'ensemble' | 'choir' | 'class' | 'other';
      part_kind: 'instrument' | 'voice';
      event_kind: 'rehearsal' | 'service' | 'class' | 'special';
      annotation_layer: 'personal' | 'section';
      annotation_type: 'stroke' | 'highlight';
    };
    CompositeTypes: Record<string, never>;
  };
};
