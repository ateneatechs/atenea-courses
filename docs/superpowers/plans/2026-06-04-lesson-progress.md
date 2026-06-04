# Lesson Progress Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track YouTube video progress per lesson — auto-save position every 10s, mark complete on video end, show checkmarks in sidebar, resume from last position.

**Architecture:** Small backend change to JOIN lesson_progress in the course detail query; frontend hook `useLessonProgress` manages state; new `YouTubePlayer` component wraps `react-youtube` with custom play button poster and progress callbacks; `CourseDetail.tsx` sidebar updated with real checkmarks and progress bar.

**Tech Stack:** React 18 + TypeScript + `react-youtube` (YouTube IFrame API wrapper), existing Express backend.

---

## File Map

### New files
| Path | Purpose |
|------|---------|
| `frontend/src/pages/CourseDetail/useLessonProgress.ts` | Hook: manages `completedIds`, `progressMap`, `saveProgress`, `markComplete` |
| `frontend/src/pages/CourseDetail/YouTubePlayer.tsx` | Component: custom poster → YouTube iframe, progress callbacks |

### Modified files
| Path | Change |
|------|--------|
| `backend/src/controllers/courseController.ts` | JOIN `lesson_progress` in `getCourseById` when user is authenticated |
| `frontend/package.json` | Add `react-youtube` |
| `frontend/src/pages/CourseDetail/CourseDetail.tsx` | Use hook + YouTubePlayer + sidebar icons + live progress bar |
| `frontend/src/pages/CourseDetail/CourseDetail.css` | `.yt-poster` custom play button styles + `.lesson-item.completed` |

---

## Task 1: Backend — include lesson progress in course detail

**Files:**
- Modify: `backend/src/controllers/courseController.ts`

The current `getCourseById` fetches lessons but ignores `lesson_progress`. We need to LEFT JOIN when the user is authenticated so the frontend gets `progress.completed` and `progress.progress_seconds` on each lesson.

- [ ] **Step 1: Read the current `getCourseById` in courseController.ts**

The lessons query is currently:
```ts
const lessonsResult = await query(
  'SELECT * FROM lessons WHERE course_id = $1 ORDER BY section_number, order_index',
  [id]
);
```

And the map is:
```ts
const lessons = lessonsResult.rows.map(l => ({
  ...l,
  video_url: hasAccess ? l.video_url : null,
}));
```

- [ ] **Step 2: Replace the lessons query and map**

Replace those two blocks with:

```ts
const lessonsQuery = req.user
  ? `SELECT l.*,
       lp.completed    AS lp_completed,
       lp.progress_seconds AS lp_seconds
     FROM lessons l
     LEFT JOIN lesson_progress lp
       ON lp.lesson_id = l.id AND lp.user_id = $2
     WHERE l.course_id = $1
     ORDER BY l.section_number, l.order_index`
  : 'SELECT * FROM lessons WHERE course_id = $1 ORDER BY section_number, order_index';

const lessonsParams = req.user ? [id, req.user.userId] : [id];
const lessonsResult = await query(lessonsQuery, lessonsParams);

const lessons = lessonsResult.rows.map(l => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lp_completed, lp_seconds, ...lessonFields } = l;
  return {
    ...lessonFields,
    video_url: hasAccess ? l.video_url : null,
    progress: req.user
      ? { completed: lp_completed ?? false, progress_seconds: lp_seconds ?? 0 }
      : null,
  };
});
```

- [ ] **Step 3: TypeScript check (backend)**

```bash
cd backend && node_modules/.bin/tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/courseController.ts
git commit -m "feat(backend): include lesson_progress in course detail response"
```

---

## Task 2: Install react-youtube

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install the package**

```bash
cd frontend && npm install react-youtube
```

Expected output includes: `added 1 package` (or similar).

- [ ] **Step 2: Verify TypeScript types are available**

```bash
cd frontend && node -e "require('./node_modules/react-youtube')" && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): add react-youtube dependency"
```

---

## Task 3: Create `useLessonProgress` hook

**Files:**
- Create: `frontend/src/pages/CourseDetail/useLessonProgress.ts`

- [ ] **Step 1: Create the hook**

```ts
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
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && node_modules/.bin/tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/CourseDetail/useLessonProgress.ts
git commit -m "feat(frontend): useLessonProgress hook"
```

---

## Task 4: Create `YouTubePlayer` component

**Files:**
- Create: `frontend/src/pages/CourseDetail/YouTubePlayer.tsx`
- Modify: `frontend/src/pages/CourseDetail/CourseDetail.css`

- [ ] **Step 1: Create `YouTubePlayer.tsx`**

```tsx
import React, { useState, useRef, useEffect } from 'react';
import YouTube, { YouTubeEvent } from 'react-youtube';

interface Props {
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  startSeconds: number;
  lessonId: string;
  onProgress: (seconds: number) => void;
  onComplete: () => void;
}

function getVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

const YouTubePlayer: React.FC<Props> = ({
  videoUrl,
  thumbnailUrl,
  title,
  startSeconds,
  lessonId,
  onProgress,
  onComplete,
}) => {
  const [started, setStarted] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const videoId = getVideoId(videoUrl);

  // Reset poster when lesson changes
  useEffect(() => {
    setStarted(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [lessonId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!videoId) return null;

  const handleReady = (e: YouTubeEvent) => {
    playerRef.current = e.target;
    if (startSeconds > 0) {
      e.target.seekTo(startSeconds, true);
    }
    e.target.playVideo();
    intervalRef.current = setInterval(() => {
      const current = playerRef.current?.getCurrentTime?.() as number | undefined;
      if (current) onProgress(current);
    }, 10_000);
  };

  const handleEnd = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    onComplete();
  };

  if (!started) {
    return (
      <div className="yt-poster" onClick={() => setStarted(true)}>
        <img src={thumbnailUrl} alt={title} className="yt-poster-img" />
        <div className="yt-play-btn">
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            play_circle
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="yt-embed-wrap">
      <YouTube
        videoId={videoId}
        className="yt-iframe"
        opts={{
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
          },
        }}
        onReady={handleReady}
        onEnd={handleEnd}
      />
    </div>
  );
};

export default YouTubePlayer;
```

- [ ] **Step 2: Add poster + completed styles to `CourseDetail.css`**

Read the end of `CourseDetail.css` and append the following CSS:

```css
/* ── Custom YouTube poster (before play) ── */
.yt-poster {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  cursor: pointer;
  background: #000;
  overflow: hidden;
  border-radius: var(--radius-lg, 16px);
}

.yt-poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.75;
  transition: opacity var(--transition-normal, 200ms);
}

.yt-poster:hover .yt-poster-img {
  opacity: 0.55;
}

.yt-play-btn {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  font-size: 80px;
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.5));
  transition: transform var(--transition-normal, 200ms);
  pointer-events: none;
}

.yt-poster:hover .yt-play-btn {
  transform: scale(1.1);
  filter: drop-shadow(0 4px 24px rgba(0, 0, 0, 0.7));
}

/* ── Completed lesson in sidebar ── */
.lesson-item.completed .lesson-icon {
  color: var(--color-success);
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && node_modules/.bin/tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/CourseDetail/YouTubePlayer.tsx
git add frontend/src/pages/CourseDetail/CourseDetail.css
git commit -m "feat(frontend): YouTubePlayer with custom poster and progress tracking"
```

---

## Task 5: Update `CourseDetail.tsx`

**Files:**
- Modify: `frontend/src/pages/CourseDetail/CourseDetail.tsx`

Three targeted changes:
1. Import hook + component, call hook
2. Replace video section with `<YouTubePlayer />`
3. Update sidebar icons + progress bar

- [ ] **Step 1: Add imports at the top of `CourseDetail.tsx`**

Find the existing import block (first 6 lines):
```tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Course, Lesson, CourseTab } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import './CourseDetail.css';
```

Replace with:
```tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Course, Lesson, CourseTab } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useLessonProgress } from './useLessonProgress';
import YouTubePlayer from './YouTubePlayer';
import './CourseDetail.css';
```

Also remove the now-unused `getYouTubeEmbedUrl` function (lines 8-13):
```tsx
const getYouTubeEmbedUrl = (url: string): string => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (!match) return '';
  const id = match[1];
  return `https://www.youtube-nocookie.com/embed/${id}?modestbranding=1&rel=0&iv_load_policy=3&color=white`;
};
```

- [ ] **Step 2: Call the hook and fix progress bar**

Find these two lines (currently after the `sections` reduce):
```tsx
const completedCount = 0;
const progressPct = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
```

Replace with:
```tsx
const { completedIds, progressMap, saveProgress, markComplete } = useLessonProgress(lessons);
const completedCount = completedIds.size;
const progressPct = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
```

- [ ] **Step 3: Replace the video player section**

Find the entire `{/* Video Player */}` block (the `<div className="video-player-wrap">` and its contents, lines 80-115):

```tsx
          {/* Video Player */}
          <div className="video-player-wrap">
            {hasAccess && activeLesson?.video_url ? (
              <div className="yt-embed-wrap">
                <iframe
                  key={activeLesson.id}
                  src={getYouTubeEmbedUrl(activeLesson.video_url)}
                  className="yt-iframe"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={activeLesson.title}
                />
                <div className="yt-overlay-title" />
                <div className="yt-overlay-logo" />
              </div>
            ) : hasAccess ? (
              <>
                {course.thumbnail_url && (
                  <img className="video-thumbnail" src={course.thumbnail_url} alt={course.title} style={{ opacity: 0.4 }} />
                )}
                <div className="video-coming-soon">
                  <span className="material-symbols-outlined" style={{ fontSize: 48 }}>schedule</span>
                  <p>Video próximamente</p>
                </div>
              </>
            ) : (
              <>
                {course.thumbnail_url && (
                  <img className="video-thumbnail" src={course.thumbnail_url} alt={course.title} />
                )}
                <div className="video-lock-overlay">
                  <span className="material-symbols-outlined" style={{ fontSize: 48 }}>lock</span>
                  <p>Suscríbete o compra este curso para acceder</p>
                </div>
              </>
            )}
          </div>
```

Replace with:

```tsx
          {/* Video Player */}
          <div className="video-player-wrap">
            {hasAccess && activeLesson?.video_url ? (
              <YouTubePlayer
                key={activeLesson.id}
                videoUrl={activeLesson.video_url}
                thumbnailUrl={course.thumbnail_url}
                title={activeLesson.title}
                startSeconds={progressMap.get(activeLesson.id) ?? 0}
                lessonId={activeLesson.id}
                onProgress={(secs) => saveProgress(activeLesson.id, secs)}
                onComplete={() => markComplete(activeLesson.id)}
              />
            ) : hasAccess ? (
              <>
                {course.thumbnail_url && (
                  <img className="video-thumbnail" src={course.thumbnail_url} alt={course.title} style={{ opacity: 0.4 }} />
                )}
                <div className="video-coming-soon">
                  <span className="material-symbols-outlined" style={{ fontSize: 48 }}>schedule</span>
                  <p>Video próximamente</p>
                </div>
              </>
            ) : (
              <>
                {course.thumbnail_url && (
                  <img className="video-thumbnail" src={course.thumbnail_url} alt={course.title} />
                )}
                <div className="video-lock-overlay">
                  <span className="material-symbols-outlined" style={{ fontSize: 48 }}>lock</span>
                  <p>Suscríbete o compra este curso para acceder</p>
                </div>
              </>
            )}
          </div>
```

- [ ] **Step 4: Update sidebar lesson icons**

Find the sidebar lessons map block:
```tsx
              {sec.lessons.map(lesson => {
                const isPlaying = activeLesson?.id === lesson.id;
                const lessonTypeIcon = lesson.lesson_type === 'quiz'
                  ? 'quiz'
                  : lesson.lesson_type === 'resource'
                    ? 'description'
                    : isPlaying ? 'play_circle' : 'check_circle';

                return (
                  <div
                    key={lesson.id}
                    className={`lesson-item${isPlaying ? ' playing' : ''}`}
                    onClick={() => setActiveLesson(lesson)}
                  >
                    <span className={`material-symbols-outlined lesson-icon${isPlaying ? '' : ' done'}`}
                      style={{ fontSize: 18, fontVariationSettings: isPlaying ? "'FILL' 0" : "'FILL' 1" }}>
                      {lessonTypeIcon}
                    </span>
```

Replace with:
```tsx
              {sec.lessons.map(lesson => {
                const isPlaying = activeLesson?.id === lesson.id;
                const isCompleted = completedIds.has(lesson.id);
                const lessonTypeIcon = lesson.lesson_type === 'quiz'
                  ? 'quiz'
                  : lesson.lesson_type === 'resource'
                    ? 'description'
                    : isPlaying
                      ? 'play_circle'
                      : isCompleted
                        ? 'check_circle'
                        : 'radio_button_unchecked';

                return (
                  <div
                    key={lesson.id}
                    className={`lesson-item${isPlaying ? ' playing' : ''}${isCompleted ? ' completed' : ''}`}
                    onClick={() => setActiveLesson(lesson)}
                  >
                    <span
                      className="material-symbols-outlined lesson-icon"
                      style={{
                        fontSize: 18,
                        fontVariationSettings: (isPlaying || isCompleted) ? "'FILL' 1" : "'FILL' 0",
                        color: isCompleted && !isPlaying ? 'var(--color-success)' : undefined,
                      }}
                    >
                      {lessonTypeIcon}
                    </span>
```

- [ ] **Step 5: TypeScript check**

```bash
cd frontend && node_modules/.bin/tsc --noEmit
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/CourseDetail/CourseDetail.tsx
git commit -m "feat(frontend): lesson progress — YouTubePlayer, checkmarks, progress bar"
```

---

## Task 6: Final verification

- [ ] **Step 1: Restart backend** (it was running against old code)

Stop and restart:
```bash
cd backend && npm run dev
```

Expected: `Database connected` + `Atenea Courses API running on http://localhost:3000`

- [ ] **Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

Expected: `VITE ready`

- [ ] **Step 3: Test progress flow**

1. Open `http://localhost:5173/courses/<id>` (use the test course "Técnicas de Fade Avanzado")
2. Log in as `admin@atenea.com / Admin123!`
3. Expected: thumbnail poster with custom play button (no YouTube branding)
4. Click play → video starts from beginning (or from saved position if visited before)
5. Wait 10 seconds → check backend logs for progress PUT request
6. Let the video play to end (or seek to end) → sidebar shows green checkmark on that lesson
7. Click a different lesson → poster resets, video starts from saved position
8. Refresh page → completed lesson still shows checkmark (persisted in DB)
9. Progress bar shows correct percentage

- [ ] **Step 4: Final commit**

```bash
git add -A
git status  # should be clean
git commit -m "feat: lesson progress tracking complete" --allow-empty
```

If working tree is already clean (all committed in previous tasks), skip this step.
