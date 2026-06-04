import { useState, useCallback, useEffect } from 'react';
import api from '../../services/api';
import { Lesson } from '../../types';

interface LessonProgressState {
  completedIds: Set<string>;
  progressMap: Map<string, number>;
  saveProgress: (lessonId: string, seconds: number) => void;
  markComplete: (lessonId: string) => void;
}

export function useLessonProgress(lessons: Lesson[]): LessonProgressState {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [progressMap, setProgressMap] = useState<Map<string, number>>(new Map());

  // Initialise from lessons data on mount (lessons include progress from backend)
  useEffect(() => {
    const completed = new Set(
      lessons.filter(l => l.progress?.completed).map(l => l.id)
    );
    const progress = new Map(
      lessons.map(l => [l.id, l.progress?.progress_seconds ?? 0])
    );
    setCompletedIds(completed);
    setProgressMap(progress);
  }, [lessons]);

  const saveProgress = useCallback((lessonId: string, seconds: number) => {
    // Fire and forget — non-blocking
    api.put(`/courses/lessons/${lessonId}/progress`, {
      completed: false,
      progressSeconds: Math.floor(seconds),
    }).catch(() => {});
    setProgressMap(prev => new Map(prev).set(lessonId, seconds));
  }, []);

  const markComplete = useCallback((lessonId: string) => {
    api.put(`/courses/lessons/${lessonId}/progress`, {
      completed: true,
      progressSeconds: 0,
    }).catch(() => {});
    setCompletedIds(prev => new Set([...prev, lessonId]));
    setProgressMap(prev => new Map(prev).set(lessonId, 0));
  }, []);

  return { completedIds, progressMap, saveProgress, markComplete };
}
