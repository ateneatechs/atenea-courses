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
