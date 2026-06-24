export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'super_admin';
  avatar_url?: string;
  created_at: string;
  subscription?: Subscription | null;
  has_active_subscription?: boolean;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructor_name: string;
  thumbnail_url: string;
  preview_url?: string;
  price: number | null;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  badge?: string;
  total_lessons: number;
  total_duration: string;
  is_membership_exclusive: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  lessons?: Lesson[];
  hasAccess?: boolean;
  completed_lesson_ids?: string[];
  purchased_at?: string;
  access_type?: 'purchase' | 'membership';
  completed?: boolean;
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  video_url?: string;
  duration: string;
  order_index: number;
  section_number: number;
  section_title: string;
  lesson_type: 'video' | 'quiz' | 'resource';
  created_at: string;
  progress?: LessonProgress | null;
}

export interface LessonProgress {
  completed: boolean;
  progress_seconds: number;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  status: 'active' | 'cancelled' | 'expired';
  starts_at: string;
  ends_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface AdminStats {
  totalUsers: number;
  totalCourses: number;
  activeSubscriptions: number;
  totalRevenue: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type SortOption = 'newest' | 'popular' | 'price-desc';
export type AdminTab = 'overview' | 'courses' | 'users' | 'branding' | 'membership' | 'payments';
export type CourseTab = 'overview' | 'resources' | 'discussion';
