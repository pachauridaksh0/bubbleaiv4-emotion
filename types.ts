
import { Session } from '@supabase/supabase-js';

export type WorkspaceMode = 'autonomous' | 'cocreator';
export type ChatMode = 'chat' | 'plan' | 'build' | 'thinker' | 'super_agent' | 'pro_max';
export type ProjectPlatform = 'Roblox Studio' | 'Web App';
export type ProjectType = 'roblox_game' | 'video' | 'story' | 'design' | 'website' | 'presentation' | 'document' | 'conversation';
export type ProjectStatus = 'In Progress' | 'Archived';
export type ChatMemoryLayer = 'inner_personal' | 'outer_personal' | 'interests' | 'preferences' | 'custom';
export type ProjectMemoryLayer = 'context' | 'technical' | 'decisions' | 'progress';
export type MemoryLayer = ChatMemoryLayer | ProjectMemoryLayer | 'personal' | 'project' | 'codebase' | 'aesthetic';


export type Membership = 'na' | 'pro' | 'max' | 'admin';
export type ImageModel = 'nano_banana' | 'imagen_2' | 'imagen_3' | 'imagen_4';
// ChatModel can be a known native string or any dynamic string from OpenRouter
export type ChatModel = 'gemini_1.5_flash' | 'gemini_2.5_flash' | 'gemini_1.5_pro' | string;

export interface ChatWithProjectData extends Chat {
  projects: Project | null;
}

export interface Profile {
  id: string;
  roblox_id: string;
  roblox_username: string;
  avatar_url: string;
  email?: string;
  role?: 'user' | 'admin';
  status?: 'active' | 'banned';
  banned_until?: string | null;
  gemini_api_key?: string | null;
  openrouter_api_key?: string | null;
  tavily_api_key?: string | null;       // NEW
  scrapingant_api_key?: string | null;  // NEW
  onboarding_preferences?: OnboardingPreferences | null;
  // Credits & Membership
  credits: number;
  membership: Membership;
  last_credit_award_date?: string | null;
  // Model Preferences
  preferred_image_model: ImageModel;
  preferred_chat_model: ChatModel;
  preferred_code_model?: ChatModel; // Separate model for coding tasks
  preferred_deep_model?: string; // Model for Deep Think mode
  preferred_openrouter_model?: string; // Legacy
  enabled_openrouter_models?: string[]; // Array of model IDs enabled by user
  // Personality & Style
  ai_tone?: 'personalized' | 'serious' | 'ambient';
  ai_length?: 'compact' | 'normal' | 'long';
  custom_instructions?: string | null;
  ui_theme?: 'light' | 'dark' | 'gray' | 'auto'; // Added 'gray'
  // Community
  bio?: string;
  follower_count?: number;
  following_count?: number;
}

export interface AppSettings {
    id: number;
    daily_credits_na: number;
    daily_credits_pro: number;
    daily_credits_max: number;
    daily_credits_admin: number;
    cost_per_100_credits: number;
    cost_image_nano_banana: number;
    cost_image_imagen_2: number;
    cost_image_imagen_3: number;
    cost_chat_gemini_1_5_flash: number;
    cost_chat_gemini_2_5_flash: number;
    updated_at: string;
}

export interface OnboardingPreferences {
  experience_level: 'beginner' | 'intermediate' | 'expert';
  ui_style: 'minimal' | 'standard' | 'advanced';
  ui_density: 'comfortable' | 'compact' | 'spacious';
  ui_theme: 'light' | 'dark' | 'gray' | 'auto'; // Added 'gray'
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  platform: ProjectPlatform;
  project_type: ProjectType;
  default_model: string;
  project_memory?: string;
  created_at: string;
  updated_at: string;
  files?: { [path: string]: { content: string } };
}

export interface Chat {
  id: string;
  project_id?: string | null;
  user_id: string;
  name: string;
  mode: ChatMode;
  is_group?: boolean; // New property for group chats
  created_at: string;
  updated_at: string;
}

export interface Task {
  text: string;
  status: 'pending' | 'in-progress' | 'complete';
  code?: string | null;
  explanation?: string;
}

export interface Plan {
  title: string;
  features: string[];
  mermaidGraph: string;
  tasks: Task[];
  isComplete: boolean;
}

export interface Clarification {
  prompt: string;
  questions: string[];
  answers?: string[];
}

export interface ThinkerResponse {
  thought: string;
  response: string;
}

export interface EmotionData {
    dominant: string;
    scores: Record<string, number>;
    reasoning?: string;
}

export interface Message {
  id: string;
  project_id?: string | null;
  chat_id: string;
  user_id?: string;
  sender: 'user' | 'ai';
  text: string;
  created_at?: string;
  plan?: Plan;
  clarification?: Clarification;
  standing_response?: ThinkerResponse;
  opposing_response?: ThinkerResponse;
  image_base64?: string;
  imageStatus?: 'generating' | 'complete' | 'error';
  code?: string | null;
  language?: string | null;
  raw_ai_response?: string | null;
  groundingMetadata?: any | null;
  model?: string; // The model used to generate this message
  emotionData?: EmotionData; // New field for detailed emotion analysis
}

export interface Memory {
    id: string;
    user_id: string;
    key: string;
    value: any; 
    timestamp?: string;
    layer: MemoryLayer;
    slot_name?: string; 
    privacy_level?: string;
    metadata?: any;
}

export interface MCPRequest {
  prompt: string;
  userId: string;
}

export interface StorageConfig {
  userId: string;
  githubToken: string;
  githubUsername: string;
  driveAccessToken: string;
  driveFolderId: string;
}
export interface ProjectFiles {
  code: CodeFile[];
  assets: Asset[];
  metadata: any;
}
export interface CodeFile { 
  path: string; 
  content: string; 
}
export interface Asset { 
  name: string; 
  type: string;
  source: string | File | Blob;
}

export type TemplateStatus = 'pending' | 'approved' | 'rejected';
export type CollaborationRole = 'owner' | 'editor' | 'viewer';

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  files: any;
  preview_image?: string;
  created_by: string;
  status: TemplateStatus;
  downloads: number;
  stars: number;
  created_at: string;
}

export interface PrivateMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  attachments?: any;
  read_at?: string;
  created_at: string;
}

export interface Collaboration {
  id: string;
  project_id: string;
  user_id: string;
  role: CollaborationRole;
  invited_by: string;
  accepted_at?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'friend_request' | 'system' | 'message';
  title: string;
  content: string;
  link?: string;
  read: boolean;
  read_at?: string;
  created_at: string;
  related_user_id?: string;
  related_user?: Profile;
  friendship_id?: string;
}

export interface Friendship {
    id: string;
    user_id: string;
    friend_id: string;
    status: 'pending' | 'accepted' | 'blocked';
    created_at: string;
    other_user: Profile; 
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}
