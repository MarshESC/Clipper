"use client";

import React from 'react';

// Redesigned Clip Card Component for individual clip highlights
function ClipCard({ job, clip, idx, onDownloadClip, downloadingClipId }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [thumbError, setThumbError] = React.useState(false);
  const [thumbLoading, setThumbLoading] = React.useState(true);
  
  const clipId = `${job.id}-clip-${idx}`;
  const isDownloading = downloadingClipId === clipId;

  const getYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    return match ? match[1] : null;
  };

  const formatClipTime = (start, end) => {
    const diff = (parseFloat(end) - parseFloat(start)).toFixed(1);
    return `${parseFloat(start).toFixed(1)}s – ${parseFloat(end).toFixed(1)}s (${diff}s)`;
  };

  // Truncate description if long
  const desc = clip.hook_description || '';
  const isLongDesc = desc.length > 100;
  const displayDesc = isExpanded ? desc : (isLongDesc ? desc.substring(0, 100) + '...' : desc);

  const thumbUrl = `/api/thumbnail?videoPath=${encodeURIComponent(job.videoPath || job.url)}&time=${clip.start_time}`;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid var(--border-glass)',
      borderRadius: '12px',
      padding: '16px',
      gap: '16px',
      marginBottom: '16px',
      transition: 'all 0.3s ease',
    }} className="clip-card-container">
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }} className="clip-card-body">
        {/* Dynamic Vertical Thumbnail from specific start timestamp */}
        <div 
          onClick={() => setPreviewOpen(true)}
          style={{
            position: 'relative',
            width: '90px',
            height: '140px',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#0d0d11',
            cursor: 'pointer',
            flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="clip-card-thumb"
        >
          {thumbError ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>🎬</div>
          ) : (
            <>
              {thumbLoading && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(255,255,255,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                </div>
              )}
              <img 
                src={thumbUrl} 
                alt="Clip Start Frame" 
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: thumbLoading ? 'none' : 'block' }}
                onLoad={() => setThumbLoading(false)}
                onError={() => {
                  setThumbError(true);
                  setThumbLoading(false);
                }}
              />
            </>
          )}
          {/* Hover Play Overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.25)',
            transition: 'background 0.2s',
          }}
          className="thumb-overlay"
          >
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              fontSize: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}>
              ▶
            </div>
          </div>
        </div>

        {/* Clip Content Details */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '140px', justifyContent: 'space-between' }} className="clip-card-details">
          <div style={{ minWidth: 0 }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {clip.title}
            </h4>
            
            <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4', overflow: 'hidden' }}>
              {displayDesc}
              {isLongDesc && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-cyan)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    padding: '0 4px',
                    display: 'inline-block',
                    textDecoration: 'underline'
                  }}
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }} className="clip-card-footer">
            <span style={{ 
              fontSize: '0.75rem', 
              background: 'rgba(255,255,255,0.04)', 
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '3px 8px', 
              borderRadius: '20px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ⏱️ {formatClipTime(clip.start_time, clip.end_time)}
            </span>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`clip-download-btn ${isDownloading ? 'downloading' : ''}`}
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                disabled={isDownloading}
                onClick={() => onDownloadClip(job, clip, clipId)}
              >
                {isDownloading ? (
                  <>
                    <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', marginRight: '6px' }} />
                    Rendering...
                  </>
                ) : (
                  <>
                    <svg style={{ width: '12px', height: '12px', fill: 'none', stroke: 'currentColor', marginRight: '6px' }} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Clip
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pop-up Video Modal (Replaces Inline Preview) */}
      {previewOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            padding: '24px',
          }}
          onClick={() => setPreviewOpen(false)}
        >
          <div 
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '420px', // Perfectly sized for vertical mobile highlights
              background: 'rgba(20, 20, 25, 0.95)',
              borderRadius: '16px',
              border: '1px solid var(--border-glass)',
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'modalFadeIn 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-glass)',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%' }}>
                {clip.title}
              </div>
              <button 
                onClick={() => setPreviewOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Video Box */}
            <div style={{ width: '100%', background: '#000', display: 'flex', justifyContent: 'center', aspectRatio: '9/16' }}>
              {getYouTubeId(job.url) ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${getYouTubeId(job.url)}?start=${Math.floor(clip.start_time)}&end=${Math.ceil(clip.end_time)}&autoplay=1`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ border: 'none' }}
                ></iframe>
              ) : (
                <video
                  width="100%"
                  height="100%"
                  controls
                  autoPlay
                  src={`${job.url || ''}#t=${clip.start_time},${clip.end_time}`}
                  style={{ objectFit: 'contain' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobCard({ job, expanded, onToggleExpand, onDownloadClip, downloadingClipId }) {

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    switch (job.status) {
      case 'fetching_meta':
        return <span className="status-badge fetching pulse">⏳ Fetching info</span>;
      case 'analyzing':
        return <span className="status-badge analyzing pulse">🔮 Analyzing</span>;
      case 'done':
        return <span className="status-badge done">✅ {job.clips?.length || 0} clips found</span>;
      case 'error':
        return <span className="status-badge error">❌ Failed</span>;
      default:
        return <span className="status-badge fetching">⏳ Queued</span>;
    }
  };

  const isProcessing = job.status === 'fetching_meta' || job.status === 'analyzing';
  const isDone = job.status === 'done';
  const isError = job.status === 'error';

  return (
    <div
      className={`job-card ${expanded ? 'expanded' : ''}`}
      onClick={() => {
        if (isDone && !expanded) onToggleExpand(job.id);
      }}
    >
      {/* Header: Thumbnail + Info + Status */}
      <div className="job-card-header">
        {job.thumbnail ? (
          <img
            className="job-thumbnail"
            src={job.thumbnail}
            alt={job.title || 'Video thumbnail'}
          />
        ) : (
          <div className="job-thumbnail" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '1.5rem'
          }}>
            🎬
          </div>
        )}

        <div className="job-info">
          <div className="job-title">
            {job.title || 'Loading video info...'}
          </div>
          <div className="job-meta">
            {job.channel && <span>{job.channel}</span>}
            {job.duration > 0 && <span>{formatDuration(job.duration)}</span>}
            {getStatusBadge()}
          </div>
        </div>

        {/* Collapse/Expand arrow for done jobs */}
        {isDone && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(job.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '8px',
              transition: 'transform 0.2s ease',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          >
            ▼
          </button>
        )}
      </div>

      {/* Progress bar for processing states */}
      {isProcessing && (
        <div>
          <div className="progress-container">
            <div className="progress-fill" style={{ width: `${job.progress || 0}%` }} />
          </div>
          {job.progressMessage && (
            <div className="progress-message">{job.progressMessage}</div>
          )}
        </div>
      )}

      {/* Error message */}
      {isError && job.error && (
        <div className="error-message">
          <strong>Error:</strong> {job.error}
        </div>
      )}

      {/* Expanded clips list */}
      {expanded && isDone && job.clips && job.clips.length > 0 && (
        <div className="clips-section" onClick={(e) => e.stopPropagation()}>
          <div className="clips-section-header" style={{ marginBottom: '16px' }}>
            <span className="clips-count">🔥 {job.clips.length} Viral Highlights</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              (Note: Downloading renders vertical crop & subtitles, which may take time)
            </span>
          </div>

          {job.clips.map((clip, idx) => (
            <ClipCard 
              key={idx}
              job={job}
              clip={clip}
              idx={idx}
              onDownloadClip={onDownloadClip}
              downloadingClipId={downloadingClipId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
