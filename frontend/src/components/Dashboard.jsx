import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function Dashboard({ setActiveTab, setSelectedDocId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await api.getAnalytics();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load dashboard analytics.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p style={{ color: 'var(--text-secondary)' }}>Analyzing your study metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>{error}</p>
        <button className="btn btn-primary" onClick={fetchStats}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s' }}>
      <div className="section-header">
        <div>
          <h1 className="section-title">Study AI Dashboard</h1>
          <p className="section-subtitle">Your personalized learning metrics and performance insights</p>
        </div>
        <button className="btn btn-primary" onClick={() => setActiveTab('materials')}>
          + Add Study Material
        </button>
      </div>

      {/* Stats Cards */}
      <div className="dashboard-grid">
        <div className="card stat-card">
          <span className="stat-title">Study Materials</span>
          <span className="stat-value">{stats?.total_documents || 0}</span>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Notes & chapters uploaded</p>
        </div>

        <div className="card stat-card success">
          <span className="stat-title">Quiz Mastery</span>
          <span className="stat-value">{stats?.avg_score || 0}%</span>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Average test accuracy</p>
        </div>

        <div className="card stat-card warning">
          <span className="stat-title">Concept Mastery</span>
          <span className="stat-value">{stats?.mastery_percentage || 0}%</span>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mastered flashcard terms</p>
        </div>

        <div className="card stat-card danger">
          <span className="stat-title">Quizzes Completed</span>
          <span className="stat-value">{stats?.total_quizzes || 0}</span>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Practice sessions finished</p>
        </div>
      </div>

      <div className="dashboard-sections">
        {/* Recent attempts */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📝</span> Recent Quiz Activities
          </h2>
          
          {stats?.recent_attempts?.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p>No quizzes taken yet. Select a document under "Materials" to test your knowledge!</p>
              <button 
                className="btn" 
                style={{ marginTop: '1rem', fontSize: '0.85rem' }} 
                onClick={() => setActiveTab('materials')}
              >
                Go to Materials
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Topic Material</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Type</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Score</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.recent_attempts?.map((attempt) => (
                    <tr 
                      key={attempt.id} 
                      style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.04)', 
                        fontSize: '0.9rem',
                        transition: 'background var(--transition-fast)'
                      }}
                    >
                      <td style={{ padding: '1rem 0.5rem', fontWeight: '600' }}>
                        {attempt.doc_title}
                      </td>
                      <td style={{ padding: '1rem 0.5rem', textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {attempt.quiz_type}
                      </td>
                      <td style={{ padding: '1rem 0.5rem', color: attempt.score / attempt.total >= 0.7 ? 'var(--color-success)' : 'var(--color-warning)', fontWeight: 'bold' }}>
                        {attempt.score} / {attempt.total} ({Math.round((attempt.score / attempt.total) * 100)}%)
                      </td>
                      <td style={{ padding: '1rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {attempt.timestamp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Weak Topics analysis */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⚠️</span> Weak Topic Tracker
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.2rem', lineHeight: '1.4' }}>
              These topics represent categories where you made errors in quizzes. Focus study sessions here to improve retention.
            </p>

            {stats?.weak_topics?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-success)', background: 'var(--color-success-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>✨ Perfect Record!</p>
                <p style={{ fontSize: '0.8rem', opacity: '0.8' }}>No weak topics identified yet. Keep it up!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '1rem 0' }}>
                {stats?.weak_topics?.map((topic, i) => (
                  <span key={i} className="weak-topic-tag">
                    • {topic}
                  </span>
                ))}
              </div>
            )}
          </div>

          {stats?.weak_topics?.length > 0 && (
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '1.5rem', fontSize: '0.85rem' }}
              onClick={() => setActiveTab('schedule')}
            >
              Generate Remedial Study Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
