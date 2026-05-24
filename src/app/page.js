"use client";

import React, { useState, useCallback, useRef } from 'react';
import VideoInput from '../components/VideoInput';
import JobCard from '../components/JobCard';

export default function Home() {
  const [jobs, setJobs] = useState([]);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [downloadingClipId, setDownloadingClipId] = useState(null);
  
  // Use ref to access latest jobs in async closures
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const updateJob = useCallback((jobId, updates) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updates } : j));
  }, []);

  // Process a video job: fetch metadata then analyze
  const processUrlJob = useCallback(async (jobId, url) => {
    // Step 1: Fetch metadata
    try {
      updateJob(jobId, { status: 'fetching_meta', progress: 10, progressMessage: 'Fetching video info...' });

      const metaRes = await fetch('/api/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const metaData = await metaRes.json();

      if (!metaRes.ok || metaData.error) {
        updateJob(jobId, {
          status: 'error',
          error: metaData.error || 'Failed to fetch video metadata',
          progress: 100
        });
        return;
      }

      updateJob(jobId, {
        title: metaData.title,
        thumbnail: metaData.thumbnail,
        channel: metaData.channel,
        duration: metaData.duration,
        progress: 25,
        progressMessage: 'Video info loaded. Starting AI analysis...'
      });
    } catch (err) {
      updateJob(jobId, {
        status: 'error',
        error: 'Network error fetching metadata: ' + err.message,
        progress: 100
      });
      return;
    }

    // Step 2: Analyze with Gemini
    try {
      updateJob(jobId, { status: 'analyzing', progress: 35, progressMessage: 'Downloading audio stream...' });

      // Simulate progress updates
      const progressTimer = setTimeout(() => {
        updateJob(jobId, { progress: 55, progressMessage: 'Uploading audio to Gemini AI...' });
      }, 8000);

      const progressTimer2 = setTimeout(() => {
        updateJob(jobId, { progress: 75, progressMessage: 'AI is detecting viral hooks and timestamps...' });
      }, 20000);

      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: url })
      });

      clearTimeout(progressTimer);
      clearTimeout(progressTimer2);

      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok || analyzeData.error) {
        updateJob(jobId, {
          status: 'error',
          error: analyzeData.error || 'AI analysis failed',
          progress: 100
        });
        return;
      }

      updateJob(jobId, {
        status: 'done',
        clips: analyzeData.clips || [],
        progress: 100,
        progressMessage: ''
      });
    } catch (err) {
      updateJob(jobId, {
        status: 'error',
        error: 'Analysis error: ' + err.message,
        progress: 100
      });
    }
  }, [updateJob]);

  // Handle YouTube URL submission
  const handleAddUrl = useCallback((url) => {
    const jobId = `job-${Date.now()}`;
    const newJob = {
      id: jobId,
      url,
      title: null,
      thumbnail: null,
      channel: null,
      duration: 0,
      status: 'fetching_meta',
      progress: 0,
      progressMessage: 'Fetching video info...',
      clips: [],
      error: null,
      videoPath: url, // for clip export
    };

    setJobs(prev => [newJob, ...prev]);

    // Start processing (non-blocking)
    processUrlJob(jobId, url);
  }, [processUrlJob]);

  // Handle file upload submission
  const handleAddFile = useCallback(async (file) => {
    const jobId = `job-${Date.now()}`;
    const newJob = {
      id: jobId,
      url: null,
      title: file.name,
      thumbnail: null,
      channel: 'Local File',
      duration: 0,
      status: 'analyzing',
      progress: 10,
      progressMessage: 'Uploading file to server...',
      clips: [],
      error: null,
      videoPath: null,
    };

    setJobs(prev => [newJob, ...prev]);

    // Step 1: Upload file
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok || uploadData.error) {
        updateJob(jobId, {
          status: 'error',
          error: uploadData.error || 'File upload failed',
          progress: 100
        });
        return;
      }

      updateJob(jobId, {
        videoPath: uploadData.filePath,
        url: uploadData.url,
        progress: 30,
        progressMessage: 'File uploaded. Starting AI analysis...'
      });

      // Step 2: Analyze
      const progressTimer = setTimeout(() => {
        updateJob(jobId, { progress: 55, progressMessage: 'Extracting and uploading audio to Gemini...' });
      }, 5000);

      const progressTimer2 = setTimeout(() => {
        updateJob(jobId, { progress: 75, progressMessage: 'AI is detecting viral hooks...' });
      }, 15000);

      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: uploadData.filePath })
      });

      clearTimeout(progressTimer);
      clearTimeout(progressTimer2);

      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok || analyzeData.error) {
        updateJob(jobId, {
          status: 'error',
          error: analyzeData.error || 'AI analysis failed',
          progress: 100
        });
        return;
      }

      updateJob(jobId, {
        status: 'done',
        clips: analyzeData.clips || [],
        progress: 100,
        progressMessage: ''
      });
    } catch (err) {
      updateJob(jobId, {
        status: 'error',
        error: 'Error: ' + err.message,
        progress: 100
      });
    }
  }, [updateJob]);

  // Handle clip download
  const handleDownloadClip = useCallback(async (job, clip, clipId) => {
    setDownloadingClipId(clipId);

    try {
      const response = await fetch('/api/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoPath: job.videoPath || job.url,
          start: clip.start_time,
          end: clip.end_time,
          cropXPercent: 0,
          burnSubtitles: true,
          subtitles: clip.subtitles
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to export clip');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const cleanTitle = (clip.title || 'clip')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .substring(0, 30);

      const a = document.createElement('a');
      a.href = url;
      a.download = `clipper_${cleanTitle}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download failed: ' + err.message);
    } finally {
      setDownloadingClipId(null);
    }
  }, []);

  const handleToggleExpand = useCallback((jobId) => {
    setExpandedJobId(prev => prev === jobId ? null : jobId);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{
        background: 'rgba(10, 10, 12, 0.6)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-glass)',
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.4rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, var(--color-cyan) 0%, var(--color-violet) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            CLIPPER AI
          </span>
          <span style={{
            fontSize: '0.65rem',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border-glass)',
            padding: '2px 6px',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            fontWeight: 600
          }}>
            v2.0
          </span>
        </div>

        {jobs.length > 0 && (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {jobs.filter(j => j.status === 'done').length}/{jobs.length} completed
          </div>
        )}
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, maxWidth: '800px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* Hero text (only when no jobs) */}
          {jobs.length === 0 && (
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <h1 style={{
                fontSize: '2.4rem',
                fontWeight: 800,
                lineHeight: '1.1',
                background: 'linear-gradient(to right, #ffffff 30%, var(--text-secondary) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '12px'
              }}>
                Turn videos into viral vertical shorts.
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '480px', margin: '0 auto' }}>
                Powered by Gemini 2.5 Flash. Paste a YouTube link and let AI find the best clips automatically.
              </p>
            </div>
          )}

          {/* Always-visible input */}
          <VideoInput
            onSubmitUrl={handleAddUrl}
            onSubmitFile={handleAddFile}
          />

          {/* Job Queue */}
          {jobs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{
                fontSize: '0.82rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-muted)',
                fontWeight: 700
              }}>
                Processing Queue ({jobs.length})
              </h3>

              {jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  expanded={expandedJobId === job.id}
                  onToggleExpand={handleToggleExpand}
                  onDownloadClip={handleDownloadClip}
                  downloadingClipId={downloadingClipId}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
