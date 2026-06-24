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

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
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
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const videoId = getVideoId(videoUrl);

  // Reset poster when lesson changes
  useEffect(() => {
    setStarted(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, [lessonId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, []);

  if (!videoId) return null;

  const handleReady = (e: YouTubeEvent) => {
    playerRef.current = e.target;
    if (startSeconds > 0) {
      e.target.seekTo(startSeconds, true);
    }
    e.target.playVideo();

    saveIntervalRef.current = setInterval(() => {
      const current = playerRef.current?.getCurrentTime?.() as number | undefined;
      if (current) onProgress(current);
    }, 10_000);

    tickIntervalRef.current = setInterval(() => {
      const current = playerRef.current?.getCurrentTime?.() as number | undefined;
      const total = playerRef.current?.getDuration?.() as number | undefined;
      if (current !== undefined) setCurrentTime(current);
      if (total) setDuration(total);
    }, 250);
  };

  const handleStateChange = (e: YouTubeEvent<number>) => {
    // YT.PlayerState: PLAYING = 1
    setPlaying(e.data === 1);
  };

  const handleEnd = () => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    setPlaying(false);
    onComplete();
  };

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  const seekToClientX = (clientX: number) => {
    const bar = progressBarRef.current;
    const player = playerRef.current;
    if (!bar || !player || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const target = ratio * duration;
    player.seekTo(target, true);
    setCurrentTime(target);
  };

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
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

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="yt-embed-wrap" ref={wrapRef} onContextMenu={(e) => e.preventDefault()}>
      <YouTube
        videoId={videoId}
        className="yt-iframe"
        opts={{
          width: '100%',
          height: '100%',
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            autoplay: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            disablekb: 1,
          },
        }}
        onReady={handleReady}
        onStateChange={handleStateChange}
        onEnd={handleEnd}
      />
      <div className="yt-click-overlay" onClick={togglePlay} />
      <div className="video-controls">
        <div
          className="video-progress-bar"
          ref={progressBarRef}
          onClick={(e) => seekToClientX(e.clientX)}
        >
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

export default YouTubePlayer;
