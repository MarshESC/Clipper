import React, { useState } from 'react';

export default function ClipSelector({ 
  clips, 
  selectedClip, 
  onSelectClip, 
  onSemanticSearch, 
  searchLoading 
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchLoading) return;
    onSemanticSearch(searchQuery);
  };

  const formatDuration = (start, end) => {
    const diff = parseFloat(end) - parseFloat(start);
    return `${start.toFixed(1)}s - ${end.toFixed(1)}s (${diff.toFixed(1)}s)`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Semantic AI Search bar */}
      <div className="glass-panel">
        <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: 'var(--text-primary)' }}>
          🔍 Semantic Video Search
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Type what you want to extract, and Gemini AI will pinpoint the exact moments.
        </p>

        <form onSubmit={handleSearchSubmit} className="input-group">
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Find where they laugh, or Clip the part about budget"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={searchLoading}
              style={{ fontSize: '0.88rem' }}
            />
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={searchLoading || !searchQuery.trim()}
              style={{ padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {searchLoading ? (
                <div className="spinner"></div>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Suggested Highlights List */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '4px', color: 'var(--text-primary)' }}>
            🔥 Proposed Viral Highlights
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Gemini analyzed the audio hooks. Select a clip to preview and crop.
          </p>
        </div>

        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '14px', 
          maxHeight: '400px', 
          overflowY: 'auto',
          paddingRight: '4px' 
        }}>
          {clips.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              border: '1px dashed var(--border-glass)',
              borderRadius: '12px'
            }}>
              No highlights loaded yet. Run video analysis to discover clips!
            </div>
          ) : (
            clips.map((clip, idx) => {
              const isSelected = selectedClip && selectedClip.start_time === clip.start_time;
              return (
                <div
                  key={idx}
                  className={`highlight-card ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectClip(clip)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="highlight-score">
                      ⏱️ {formatDuration(clip.start_time, clip.end_time)}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      CLIP #{idx + 1}
                    </span>
                  </div>

                  <h4 style={{ 
                    fontSize: '0.96rem', 
                    color: isSelected ? '#fff' : 'var(--text-primary)',
                    fontWeight: 600,
                    lineHeight: '1.4'
                  }}>
                    {clip.title}
                  </h4>

                  <p style={{ 
                    fontSize: '0.8rem', 
                    color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)',
                    lineHeight: '1.5'
                  }}>
                    {clip.hook_description}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
