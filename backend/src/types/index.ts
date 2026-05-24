export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  avatar_url?: string;
  created_at: Date;
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
  created_at: Date;
  updated_at: Date;
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
  created_at: Date;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  status: 'active' | 'cancelled' | 'expired';
  starts_at: Date;
  ends_at: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
