import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function SummaryView({ selectedDocId, setSelectedDocId, showToast }) {
  const [documents, setDocuments] = useState([]);
  const [docMeta, setDocMeta] = useState(null);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDocList();
    if (selectedDocId) {
      loadSummary(selectedDocId);
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

  const loadSummary = async (docId) => {
    try {
      setLoading(true);
      // Fetch metadata first
      const meta = await api.getDocument(docId);
      setDocMeta(meta);
      
      // Fetch summary
      const res = await api.getSummary(docId);
      setSummary(res.summary);
    } catch (err) {
      console.error(err);
      showToast("Failed to generate or retrieve summary.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChange = (e) => {
    const docId = e.target.value;
    if (docId) {
      setSelectedDocId(docId);
    } else {
      setSelectedDocId(null);
      setSummary('');
      setDocMeta(null);
    }
  };

  // Simple, robust Markdown-to-HTML parser to avoid external dependencies
  const renderMarkdown = (mdText) => {
    if (!mdText) return null;

    const lines = mdText.split('\n');
    let inList = false;
    let listItems = [];
    const htmlElements = [];

    const flushList = (key) => {
      if (listItems.length > 0) {
        htmlElements.push(
          <ul key={`list-${key}`} style={{ marginBottom: '1.25rem', paddingLeft: '1.5rem' }}>
            {listItems.map((item, idx) => (
              <li key={`li-${idx}`} style={{ marginBottom: '0.4rem', color: '#e2e8f0' }}>{item}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Check lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        inList = true;
        const listText = trimmed.replace(/^[-*]\s+/, '');
        listItems.push(parseInlineMarkdown(listText));
        return;
      } else {
        if (inList) {
          flushList(index);
        }
      }

      // Headers
      if (trimmed.startsWith('# ')) {
        htmlElements.push(<h1 key={index} className="summary-title" style={{ fontSize: '1.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', margin: '1.5rem 0 1rem 0' }}>{parseInlineMarkdown(trimmed.substring(2))}</h1>);
      } else if (trimmed.startsWith('## ')) {
        htmlElements.push(<h2 key={index} style={{ fontSize: '1.35rem', color: '#c084fc', margin: '1.75rem 0 0.75rem 0' }}>{parseInlineMarkdown(trimmed.substring(3))}</h2>);
      } else if (trimmed.startsWith('### ')) {
        htmlElements.push(<h3 key={index} style={{ fontSize: '1.15rem', margin: '1.5rem 0 0.5rem 0' }}>{parseInlineMarkdown(trimmed.substring(4))}</h3>);
      } else if (trimmed === '') {
        // Empty line
      } else {
        // Normal paragraph
        htmlElements.push(
          <p key={index} style={{ marginBottom: '1rem', lineHeight: '1.7', color: '#cbd5e1' }}>
            {parseInlineMarkdown(trimmed)}
          </p>
        );
      }
    });

    if (inList) {
      flushList('final');
    }

    return <div className="summary-markdown">{htmlElements}</div>;
  };

  // Helper to parse bold (**text**) and code (`code`) inline
  const parseInlineMarkdown = (text) => {
    // Regex for bold text
    const parts = [];
    let currentIdx = 0;
    
    // Pattern to capture **bold** or `code`
    const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const matchIdx = match.index;
      
      // Add text before match
      if (matchIdx > currentIdx) {
        parts.push(text.substring(currentIdx, matchIdx));
      }

      if (match[2]) {
        // Bold match
        parts.push(<strong key={matchIdx} style={{ color: '#fff', fontWeight: '700' }}>{match[2]}</strong>);
      } else if (match[3]) {
        // Code match
        parts.push(
          <code key={matchIdx} style={{ background: 'rgba(0,0,0,0.3)', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.85em', color: '#fda4af' }}>
            {match[3]}
          </code>
        );
      }

      currentIdx = pattern.lastIndex;
    }

    if (currentIdx < text.length) {
      parts.push(text.substring(currentIdx));
    }

    return parts.length > 0 ? parts : text;
  };

  const handleDownload = () => {
    if (!summary) return;
    
    const blob = new Blob([summary], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Clean filename
    const cleanTitle = (docMeta?.title || 'study_summary').toLowerCase().replace(/\s+/g, '_');
    link.setAttribute('download', `${cleanTitle}_summary.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Summary downloaded successfully!", "success");
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s' }}>
      <div className="section-header">
        <div>
          <h1 className="section-title">AI Summary Companion</h1>
          <p className="section-subtitle">Generate and read concise structured notes from your library</p>
        </div>
        
        {/* Selector dropdown */}
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
          {summary && (
            <button className="btn btn-primary" onClick={handleDownload} style={{ fontSize: '0.85rem' }}>
              ⬇️ Export .md
            </button>
          )}
        </div>
      </div>

      {!selectedDocId ? (
        <div className="card empty-state">
          <div className="empty-state-icon">📖</div>
          <p className="empty-state-title">No Study Material Selected</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Please select an uploaded document from the top-right menu to view or generate its summary outline.
          </p>
          <button className="btn" onClick={() => fetchDocList()}>Refresh Library List</button>
        </div>
      ) : loading ? (
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <div className="spinner"></div>
          <h3 style={{ marginTop: '1rem', fontSize: '1.1rem' }}>Writing AI Summary...</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Llama 3.3 is compiling topic overview, key definitions, and core principles...
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <span className="flashcard-tag" style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                Active Summary Mode
              </span>
              <h2 style={{ fontSize: '1.5rem', marginTop: '0.25rem' }}>{docMeta?.title}</h2>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <p>Uploaded: {docMeta?.uploaded_at}</p>
              <p>Length: {(docMeta?.content_length / 1024).toFixed(1)}k characters</p>
            </div>
          </div>
          
          <div style={{ maxWidth: '850px', margin: '0 auto' }}>
            {renderMarkdown(summary)}
          </div>
        </div>
      )}
    </div>
  );
}
