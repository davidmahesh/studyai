import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function ScheduleView({ selectedDocId, setSelectedDocId, showToast }) {
  const [documents, setDocuments] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [docTitle, setDocTitle] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDocList();
    if (selectedDocId) {
      loadSchedule(selectedDocId);
    }
  }, [selectedDocId]);

  const fetchDocList = async () => {
    try {
      const list = await api.getDocuments();
      setDocuments(list);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSchedule = async (docId) => {
    try {
      setLoading(true);
      const res = await api.generateSchedule(docId);
      setSchedule(res.schedule || []);
      setDocTitle(res.doc_title || 'Selected Notes');
    } catch (err) {
      console.error(err);
      showToast("Failed to compile study schedule.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChange = (e) => {
    const docId = e.target.value;
    setSelectedDocId(docId || null);
    if (!docId) {
      setSchedule([]);
      setDocTitle('');
    }
  };

  const handleExportText = () => {
    if (schedule.length === 0) return;
    
    let txt = `=========================================\n`;
    txt += `STUDYAI PERSONALIZED WEEKLY PLAN\n`;
    txt += `Material: ${docTitle}\n`;
    txt += `Generated: ${new Date().toLocaleDateString()}\n`;
    txt += `=========================================\n\n`;

    schedule.forEach(day => {
      txt += `${day.day.toUpperCase()} - Focus: ${day.topic} ${day.isWeakTopic ? '[PRIORITY WEAK TOPIC]' : ''}\n`;
      txt += `Suggested Slot: ${day.timeSlot}\n`;
      txt += `Daily Objectives:\n`;
      day.tasks.forEach((t, i) => {
        txt += `  [ ] ${i + 1}. ${t}\n`;
      });
      txt += `Study Tip: ${day.tip}\n`;
      txt += `-----------------------------------------\n\n`;
    });

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'studyai_weekly_schedule.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Schedule text file downloaded!", "success");
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s' }}>
      <div className="section-header">
        <div>
          <h1 className="section-title">AI Study Planner</h1>
          <p className="section-subtitle">Adaptive 7-day study calendar integrating identified weak topics</p>
        </div>

        {/* Action Dropdown */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select 
            className="form-select" 
            style={{ width: '220px', padding: '0.5rem' }}
            value={selectedDocId || ''} 
            onChange={handleSelectChange}
          >
            <option value="">-- Select Material --</option>
            {documents.map(doc => (
              <option key={doc.id} value={doc.id}>{doc.title}</option>
            ))}
          </select>
          
          {schedule.length > 0 && (
            <button className="btn btn-primary" onClick={handleExportText} style={{ fontSize: '0.85rem' }}>
              💾 Export Calendar
            </button>
          )}
        </div>
      </div>

      {!selectedDocId ? (
        <div className="card empty-state">
          <div className="empty-state-icon">📅</div>
          <p className="empty-state-title">No Study Material Selected</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Please select an uploaded document from the menu to compile an adaptive study timetable.
          </p>
          <button className="btn" onClick={() => fetchDocList()}>Refresh Library List</button>
        </div>
      ) : loading ? (
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <div className="spinner"></div>
          <h3 style={{ marginTop: '1rem', fontSize: '1.1rem' }}>Composing Study Schedule...</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Llama 3.3 is checking quiz weak areas and distributing revision load across 7 days...
          </p>
        </div>
      ) : schedule.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">📭</div>
          <p className="empty-state-title">No Schedule Created</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            We could not construct a schedule for this document. Verify that the document text is parsed.
          </p>
          <button className="btn btn-primary" onClick={() => loadSchedule(selectedDocId)}>Generate Now</button>
        </div>
      ) : (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.2)' }}>
            <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📅</span> Weekly Roadmap: {docTitle}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: '1.4' }}>
              This schedule distributes concepts evenly. Days with <strong style={{ color: 'var(--color-danger)' }}>Focus Topic (Weak Area)</strong> 
              indicate topics where you faced challenges during quizzes. Extra quiz practice tasks have been injected into those days.
            </p>
          </div>

          {/* Calendar Day Grid */}
          <div className="schedule-grid">
            {schedule.map((day, idx) => (
              <div 
                key={idx} 
                className={`card schedule-day-card ${day.isWeakTopic ? 'weak-focus' : ''}`}
                style={{
                  borderTopColor: day.isWeakTopic ? 'var(--color-danger)' : 'var(--color-primary)'
                }}
              >
                <div className="schedule-day-header">
                  <span className="schedule-day-name">{day.day}</span>
                  <span className="schedule-time-badge">{day.timeSlot.split(' ')[0]} {day.timeSlot.split(' ')[1]}</span>
                </div>

                <div className="schedule-day-topic">
                  {day.isWeakTopic ? (
                    <span 
                      style={{ 
                        color: 'var(--color-danger)', 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold', 
                        display: 'block', 
                        marginBottom: '0.15rem' 
                      }}
                    >
                      🚨 FOCUS TOPIC (WEAK AREA)
                    </span>
                  ) : (
                    <span 
                      style={{ 
                        color: 'var(--color-accent)', 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold', 
                        display: 'block', 
                        marginBottom: '0.15rem' 
                      }}
                    >
                      ✓ Regular Review
                    </span>
                  )}
                  <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fff' }}>{day.topic}</span>
                </div>

                <ul className="schedule-tasks-list">
                  {day.tasks.map((task, tIdx) => (
                    <li key={tIdx} className="schedule-task-item">
                      <span style={{ color: day.isWeakTopic ? 'var(--color-danger)' : 'var(--color-primary)' }}>•</span>
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>

                <div className="schedule-tip">
                  💡 {day.tip}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
