# Lesson Progress Tracking — Design Spec

**Date:** 2026-06-04
**Status:** Approved

## Goal

Track video progress per lesson in CourseDetail: auto-save position every 10 seconds, mark lesson as complete when video ends, show checkmarks in the sidebar, and resume playback from where the user left off (even on completed lessons).

---

## Architecture

All changes are frontend-only. The backend already has the full infrastructure:
- `lesson_progress` table (`user_id`, `lesson_id`, `course_id`, `completed`, `progress_seconds`)
- `PUT /api/courses/lessons/:id/progress` endpoint accepts `{ completed, progressSeconds }`
- `GET /api/courses/lessons/:id` returns `progress` object on the lesson

### Component tree

```
CourseDetail
├── useLessonProgress(lessons)     ← new hook
│   ├── completedIds: Set<string>  ← which lessons are done
│   ├── progressMap: Map<id,secs>  ← saved seconds per lesson
│   ├── saveProgress(id, secs)     ← PUT with completed:false
│   └── markComplete(id)           ← PUT with completed:true
│
├── <YouTubePlayer />              ← replaces current <iframe>
│   ├── onTimeUpdate → saveProgress every 10s
│   └── onEnded → markComplete
│
└── Sidebar
    ├── check_circle (filled green) if completed
    ├── play_circle if currently playing
    ├── radio_button_unchecked otherwise
    └── Progress bar: completedIds.size / lessons.length × 100%
```

---

## Data Flow

### On course load

`GET /api/courses/:id` already returns lessons with `progress` objects when the user is authenticated. On mount:
- Build `completedIds` from `lessons.filter(l => l.progress?.completed)`
- Build `progressMap` from `lessons.map(l => [l.id, l.progress?.progress_seconds ?? 0])`
- Set initial `activeLesson` to first lesson as before

### On lesson select

1. Save current lesson progress before switching (fire-and-forget PUT)
2. Call `GET /api/courses/lessons/:newId` to get fresh `progress_seconds`
3. Pass `startSeconds` to YouTubePlayer via the embed URL `&start=X`

### During playback

- Every 10 seconds: `PUT /api/courses/lessons/:id/progress` with `{ progressSeconds: currentTime, completed: false }`
- On video end (`onEnded`): `PUT` with `{ progressSeconds: 0, completed: true }`, update `completedIds` locally (no refetch needed)

### Resume behavior

Both completed and in-progress lessons start from their saved `progress_seconds`. Completed lessons start from 0 (since on completion we save `progressSeconds: 0`). This means completed lessons always replay from the beginning — consistent with user expectation of "replay".

Wait — user selected option B: "always from where they left off, even if completed". But if we save `progressSeconds: 0` on completion, the resume point is 0 (start). This is actually correct — a "completed" lesson resumes from the beginning because the saved position is 0.

Actually, to implement B correctly: don't reset `progressSeconds` to 0 on completion. Save the actual final timestamp. Then when the lesson is re-opened, it starts from near the end. But this is confusing UX — the user opens a completed lesson and it starts at the last 2 seconds.

Revised: on completion, save `progressSeconds: 0` (restart from beginning for completed lessons). Option B applies to in-progress lessons — they resume from where the user stopped. Completed lessons restart from 0.

---

## Custom Play Button

Before the user clicks play, show the course thumbnail with a custom play button overlay that matches the page design system — no YouTube branding visible.

```
┌─────────────────────────────────┐
│                                 │
│       [thumbnail image]         │
│                                 │
│          ⬤ play_circle          │  ← Material Symbol, --color-primary, 72px
│        (custom overlay)         │
│                                 │
└─────────────────────────────────┘
```

On click: swap thumbnail for the YouTube iframe with `autoplay=1`. The YouTube iframe loads and starts playing immediately, bypassing YouTube's own play button overlay.

During playback: YouTube's native controls are shown (required by YouTube ToS). The custom button only appears in the "not yet started" state.

The play button uses existing design tokens: `var(--color-primary)`, `var(--color-on-primary)`, `var(--shadow-glow)` on hover.

---

## Library

**`react-youtube`** — official YouTube IFrame API wrapper for React.

```bash
cd frontend && npm install react-youtube
```

Provides `<YouTube videoId="..." opts={...} onEnd={...} onStateChange={...} />` component.

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/package.json` | Add `react-youtube` dependency |
| `frontend/src/pages/CourseDetail/CourseDetail.tsx` | `useLessonProgress` hook + YouTubePlayer + sidebar icons + progress bar |
| `frontend/src/pages/CourseDetail/CourseDetail.css` | `.lesson-item.completed` styles |

---

## Sidebar Icon Logic

```tsx
const icon = lesson.lesson_type === 'quiz'
  ? 'quiz'
  : lesson.lesson_type === 'resource'
    ? 'description'
    : isPlaying
      ? 'play_circle'
      : isCompleted
        ? 'check_circle'
        : 'radio_button_unchecked';

const iconFill = isCompleted ? "'FILL' 1" : isPlaying ? "'FILL' 1" : "'FILL' 0";
const iconColor = isCompleted ? 'var(--color-success, #4CAF50)' : undefined;
```

---

## Progress Bar

```tsx
const completedCount = completedIds.size;
const progressPct = lessons.length > 0
  ? Math.round((completedCount / lessons.length) * 100)
  : 0;
```

Updates in real-time when `markComplete` is called (local state update, no API refetch).

---

## What Does NOT Change

- Backend: no changes
- Route configuration: no changes
- Auth flow: no changes
- Any other page
