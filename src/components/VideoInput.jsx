"use client";

import React, { useState, useRef } from 'react';

export default function VideoInput({ onSubmitUrl, onSubmitFile, disabled }) {
  const [ytUrl, setYtUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [maxDuration, setMaxDuration] = useState('30');
  const [orientation, setOrientation] = useState('portrait');
  const fileInputRef = useRef(null);

  const handleYtSubmit = (e) => {
    e.preventDefault();
    if (!ytUrl.trim()) return;
    setError('');

    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (!ytRegex.test(ytUrl)) {
      setError('Please enter a valid YouTube video link.');
      return;
    }

    onSubmitUrl(ytUrl.trim(), { maxDuration: parseInt(maxDuration, 10), orientation });
    setYtUrl(''); // Clear input immediately for next URL
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
      e.target.value = ''; // Reset so same file can be re-selected
    }
  };

  const handleFile = (file) => {
    if (!file.type.startsWith('video/')) {
      setError('Unsupported file type. Please upload a video file (MP4, WebM, etc).');
      return;
    }
    setError('');
    onSubmitFile(file, { maxDuration: parseInt(maxDuration, 10), orientation });
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '4px' }}>⚡ AI Clipper Studio</h2>
        <p style={{ fontSize: '0.85rem' }}>
          Paste YouTube links or drop video files. You can add multiple — they&apos;ll be processed in the background.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <label className="input-label">Max Duration</label>
          <select
            className="input-field"
            value={maxDuration}
            onChange={(e) => setMaxDuration(e.target.value)}
            disabled={disabled}
            style={{ appearance: 'auto', background: 'rgba(0, 0, 0, 0.4)' }}
          >
            <option value="15">15 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">60 seconds</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <label className="input-label">Orientation</label>
          <select
            className="input-field"
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
            disabled={disabled}
            style={{ appearance: 'auto', background: 'rgba(0, 0, 0, 0.4)' }}
          >
            <option value="portrait">Portrait (9:16)</option>
            <option value="landscape">Landscape (16:9)</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#ef4444',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '0.82rem'
        }}>
          {error}
        </div>
      )}

      {/* YouTube URL input */}
      <form onSubmit={handleYtSubmit} className="input-group">
        <label className="input-label">YouTube Link</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. https://www.youtube.com/watch?v=..."
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            disabled={disabled}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={disabled || !ytUrl.trim()}
            style={{ padding: '0 20px', whiteSpace: 'nowrap' }}
          >
            + Add Video
          </button>
        </div>
      </form>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        color: 'var(--text-muted)',
        fontSize: '0.72rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }} />
        <span>or upload file</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }} />
      </div>

      {/* File drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragActive ? 'var(--color-violet)' : 'var(--border-glass)'}`,
          background: dragActive ? 'rgba(139, 92, 246, 0.05)' : 'rgba(0, 0, 0, 0.2)',
          borderRadius: '12px',
          padding: '28px 20px',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
          accept="video/*"
          disabled={disabled}
        />
        <svg style={{ width: '28px', height: '28px', stroke: 'var(--text-secondary)', fill: 'none' }} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5h10.5a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0017.25 4.5H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            Drag and drop a video file
          </span>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            MP4, WebM (Max 200MB)
          </p>
        </div>
      </div>
    </div>
  );
}
