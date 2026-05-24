import React, { useState, useEffect, useRef } from 'react';

export default function VideoPlayer({ 
  videoPath, 
  activeClip, 
  cropXPercent, 
  onCropXChange, 
  burnSubtitles, 
  onBurnSubtitlesToggle, 
  onExport, 
  isExporting 
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);
  const playTimerRef = useRef(null);

  // Parse YouTube video ID if it's a YouTube link
  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const ytId = getYoutubeId(videoPath);
  const isYoutube = !!ytId;

  // Handles time tracking for subtitles
  useEffect(() => {
    if (isYoutube && activeClip && isPlaying) {
      // For YouTube, simulate time ticks inside the clip boundaries
      const interval = setInterval(() => {
        setCurrentTime((prev) => {
          // Initialize if it's the very start or out of bounds
          if (prev < activeClip.start_time || prev >= activeClip.end_time) {
            return parseFloat(activeClip.start_time);
          }
          const next = prev + 0.1;
          if (next >= parseFloat(activeClip.end_time)) {
            return parseFloat(activeClip.start_time);
          }
          return next;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isYoutube, activeClip, isPlaying]);

  // Sync HTML5 video boundaries if local video
  useEffect(() => {
    const video = videoRef.current;
    if (video && activeClip) {
      video.currentTime = parseFloat(activeClip.start_time);
      setCurrentTime(parseFloat(activeClip.start_time));
      setIsPlaying(false);
    }
  }, [activeClip]);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (isYoutube) {
      setIsPlaying(!isPlaying);
    } else if (video && activeClip) {
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        // Enforce boundaries
        if (video.currentTime >= parseFloat(activeClip.end_time) || video.currentTime < parseFloat(activeClip.start_time)) {
          video.currentTime = parseFloat(activeClip.start_time);
        }
        video.play();
        setIsPlaying(true);
      }
    }
  };

  const handleTimeUpdate = (e) => {
    const video = e.target;
    if (!activeClip) return;
    
    const time = video.currentTime;
    setCurrentTime(time);

    // Loop within clip boundaries
    if (time >= parseFloat(activeClip.end_time)) {
      video.pause();
      video.currentTime = parseFloat(activeClip.start_time);
      setIsPlaying(false);
    }
  };

  // Find active subtitle word
  const activeWordIndex = activeClip?.subtitles?.findIndex(
    (sub) => currentTime >= parseFloat(sub.start) && currentTime <= parseFloat(sub.end)
  ) ?? -1;

  // Format subtitles into small groupings for the card preview
  const getActiveSubtitleGroup = () => {
    if (!activeClip?.subtitles || activeClip.subtitles.length === 0) return [];
    
    // If we have an active word, show a window of words around it (e.g. 2 before, 2 after)
    if (activeWordIndex !== -1) {
      const startIdx = Math.max(0, activeWordIndex - 2);
      const endIdx = Math.min(activeClip.subtitles.length, activeWordIndex + 3);
      return activeClip.subtitles.slice(startIdx, endIdx);
    }

    // Default to first few words
    return activeClip.subtitles.slice(0, 4);
  };

  const subtitleGroup = getActiveSubtitleGroup();

  // CSS Translate factor for width scaling: 316.05% of width
  // Max translation shift is ~108.02% of parent viewport width
  // Binds the transform: translateX(calc(-50% + cropXPercent/100 * 108.02%))
  const translateXFactor = (parseFloat(cropXPercent) / 100) * 108.02;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
      
      {/* 9:16 mobile mock container */}
      <div className="phone-mockup">
        <div className="phone-screen">
          <div className="crop-viewport">
            
            {isYoutube ? (
              // Renders YouTube iframe scaled and cropped
              <iframe
                className="crop-video-source"
                src={`https://www.youtube.com/embed/${ytId}?start=${Math.floor(activeClip?.start_time || 0)}&end=${Math.ceil(activeClip?.end_time || 15)}&autoplay=${isPlaying ? 1 : 0}&mute=1&controls=0&modestbranding=1&loop=1&playlist=${ytId}`}
                style={{
                  height: '100%',
                  width: '316.05%',
                  left: '50%',
                  transform: `translateX(calc(-50% + ${translateXFactor}%))`,
                  border: 'none',
                  pointerEvents: 'none' // Block YouTube overlay controls to keep crop preview clean
                }}
                title="YouTube clip crop preview"
              />
            ) : videoPath ? (
              // Renders local HTML5 video
              <video
                ref={videoRef}
                src={videoPath}
                className="crop-video-source"
                onTimeUpdate={handleTimeUpdate}
                style={{
                  height: '100%',
                  width: '316.05%',
                  left: '50%',
                  transform: `translateX(calc(-50% + ${translateXFactor}%))`,
                  objectFit: 'cover'
                }}
                muted
                playsInline
              />
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.88rem',
                textAlign: 'center',
                padding: '20px'
              }}>
                No video loaded yet. Upload or paste a link to preview.
              </div>
            )}

            {/* Play overlay button */}
            {videoPath && (
              <div 
                onClick={handlePlayPause}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: isPlaying ? 'transparent' : 'rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 4,
                  transition: 'background var(--transition-fast)'
                }}
              >
                {!isPlaying && (
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 15px rgba(0,0,0,0.3)',
                    transform: 'scale(1)',
                    transition: 'all 0.2s ease'
                  }}>
                    <svg style={{ width: '24px', height: '24px', fill: '#fff', transform: 'translateX(2px)' }} viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                )}
              </div>
            )}

            {/* Dynamic CSS subtitles overlay */}
            {activeClip && subtitleGroup.length > 0 && (
              <div className="caption-overlay">
                <div className="caption-card">
                  {subtitleGroup.map((sub, idx) => {
                    const isWordActive = activeClip.subtitles.indexOf(sub) === activeWordIndex;
                    return (
                      <span 
                        key={idx} 
                        className={`caption-word ${isWordActive ? 'active' : ''}`}
                      >
                        {sub.word}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>

      {/* Adjuster Console below mockup */}
      {activeClip && (
        <div className="glass-panel" style={{ width: '100%', maxWidth: '380px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              🎯 POSITION CROP
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-cyan)', fontWeight: 700 }}>
              {cropXPercent > 0 ? `+${cropXPercent}% Right` : cropXPercent < 0 ? `${cropXPercent}% Left` : 'Centered'}
            </span>
          </div>

          <input
            type="range"
            min="-100"
            max="100"
            className="crop-range-slider"
            value={cropXPercent}
            onChange={(e) => onCropXChange(parseInt(e.target.value))}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>← Slide Left</span>
            <span>Slide Right →</span>
          </div>

          <div style={{ height: '1px', background: 'var(--border-glass)', margin: '16px 0' }}></div>

          {/* Export Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={burnSubtitles}
                onChange={onBurnSubtitlesToggle}
                style={{
                  accentColor: 'var(--color-violet)',
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer'
                }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>Burn dynamic subtitles into video</span>
            </label>

            <button
              onClick={onExport}
              className="btn btn-primary"
              disabled={isExporting}
              style={{ width: '100%', marginTop: '4px' }}
            >
              {isExporting ? (
                <>
                  <div className="spinner"></div>
                  Rendering clip...
                </>
              ) : (
                <>
                  <svg style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor' }} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export & Download Short
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
