import React, { useState, useRef, useEffect } from 'react';

interface Props {
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  startSeconds: number;
  lessonId: string;
  onProgress: (seconds: number) => void;
  onComplete: () => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Sibling of YouTubePlayer.tsx — same markup/CSS classes, but backs a self-hosted
// file via GET /api/courses/lessons/:id/stream instead of the YouTube iframe API.
const LocalVideoPlayer: React.FC<Props> = ({
  thumbnailUrl,
  title,
  startSeconds,
  lessonId,
  onProgress,
  onComplete,
}) => {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // <video src> can't send an Authorization header, so the token travels as a
  // query param (see middleware/auth.ts authenticateStream on the backend).
  const token = localStorage.getItem('atenea-token') || '';
  const src = `/api/courses/lessons/${lessonId}/stream?token=${encodeURIComponent(token)}`;

  useEffect(() => {
    setStarted(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
  }, [lessonId]);

  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
    };
  }, []);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    if (startSeconds > 0) video.currentTime = startSeconds;
    video.play();

    saveIntervalRef.current = setInterval(() => {
      if (videoRef.current) onProgress(videoRef.current.currentTime);
    }, 10_000);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleEnded = () => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    setPlaying(false);
    onComplete();
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    playing ? video.pause() : video.play();
  };

  const seekToClientX = (clientX: number) => {
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    video.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
  };

  if (!started) {
    return (
      <div className="yt-poster" onClick={() => setStarted(true)}>
        <img src={thumbnailUrl} alt={title} className="yt-poster-img" />
        <div className="yt-play-btn">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            play_circle
          </span>
        </div>
      </div>
    );
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="yt-embed-wrap" ref={wrapRef} onContextMenu={(e) => e.preventDefault()}>
      <video
        ref={videoRef}
        className="yt-iframe"
        src={src}
        autoPlay
        controlsList="nodownload"
        disablePictureInPicture
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={handleEnded}
      />
      <div className="yt-click-overlay" onClick={togglePlay} />
      <div className="video-controls">
        <div className="video-progress-bar" ref={progressBarRef} onClick={(e) => seekToClientX(e.clientX)}>
          <div className="video-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="video-controls-row">
          <div className="video-controls-left">
            <button className="video-ctrl-btn" onClick={togglePlay}>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                {playing ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <span className="video-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          <div className="video-controls-right">
            <button className="video-ctrl-btn" onClick={toggleFullscreen}>
              <span className="material-symbols-outlined">fullscreen</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocalVideoPlayer;
