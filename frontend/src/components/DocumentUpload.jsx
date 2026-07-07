import React, { useState, useRef, useEffect } from 'react';
import { api } from '../utils/api';

export default function DocumentUpload({ 
  setSelectedDocId, 
  setActiveTab, 
  showToast 
}) {
  const [documents, setDocuments] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoadingList(true);
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error(err);
      showToast("Failed to load documents list.", "error");
    } finally {
      setLoadingList(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    const validExtensions = ['.pdf', '.docx', '.txt'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValid) {
      showToast("Invalid file type. Only PDF, DOCX, and TXT are supported.", "error");
      return;
    }
    
    setSelectedFile(file);
    if (!title) {
      // Auto-populate title without extension
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setTitle(baseName);
    }
    showToast(`Loaded file: ${file.name}`, "success");
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!pasteMode && !selectedFile) {
      showToast("Please choose a file or drag it to the upload box.", "error");
      return;
    }
    if (pasteMode && !textContent.trim()) {
      showToast("Please enter or paste your notes.", "error");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('title', title || 'Untitled Study Material');
      formData.append('timestamp', new Date().toLocaleString());
      
      if (pasteMode) {
        formData.append('textContent', textContent);
      } else if (selectedFile) {
        formData.append('file', selectedFile);
      }

      await api.uploadDocument(formData);
      showToast("Material uploaded and parsed successfully!", "success");
      
      // Reset form
      setTitle('');
      setTextContent('');
      setSelectedFile(null);
      setPasteMode(false);
      
      // Refresh list
      fetchDocuments();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to process document.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleQuickAction = (docId, tab) => {
    setSelectedDocId(docId);
    setActiveTab(tab);
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s' }}>
      <div className="section-header">
        <div>
          <h1 className="section-title">Study Materials</h1>
          <p className="section-subtitle">Manage notes, textbooks, and past summaries in one place</p>
        </div>
      </div>

      <div className="dashboard-sections">
        {/* Upload Container */}
        <div>
          <div className="card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.25rem' }}>
              📥 {pasteMode ? "Paste Raw Text Notes" : "Upload Documents"}
            </h2>
            
            {isUploading ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <h3 style={{ marginTop: '1rem', fontSize: '1.1rem' }}>Extracting Study Materials</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem', textAlign: 'center' }}>
                  StudyAI is analyzing layout text structure and indexing semantics for generation...
                </p>
              </div>
            ) : (
              <form onSubmit={handleUploadSubmit}>
                <div className="form-group">
                  <label className="form-label">Material Title (optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Biology Lecture 4 - Mitochondria"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {!pasteMode ? (
                  <div className="form-group">
                    <label className="form-label">Select File (PDF, DOCX, TXT)</label>
                    <div 
                      className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={onButtonClick}
                      style={{ borderColor: dragActive ? 'var(--color-primary)' : '' }}
                    >
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        style={{ display: 'none' }} 
                        accept=".pdf,.docx,.txt"
                        onChange={handleFileChange}
                      />
                      <div className="upload-icon">📄</div>
                      {selectedFile ? (
                        <div>
                          <p style={{ fontWeight: 'bold' }}>{selectedFile.name}</p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {(selectedFile.size / 1024).toFixed(1)} KB • Click to change file
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p style={{ fontWeight: '600' }}>Drag & Drop file here, or click to browse</p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Supports PDF, DOCX, or Text up to 10MB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Paste Study Material</label>
                    <textarea 
                      className="form-textarea" 
                      placeholder="Paste your study guide, book excerpts, or raw notes here..."
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      required
                    ></textarea>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                  <button 
                    type="button" 
                    className="btn" 
                    onClick={() => setPasteMode(!pasteMode)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    {pasteMode ? "🔄 Upload File Instead" : "✍️ Paste Text Instead"}
                  </button>
                  
                  <button type="submit" className="btn btn-primary">
                    Start AI Processing
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Uploaded Materials Side List */}
        <div className="card" style={{ maxHeight: '600px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
            📚 Indexed Library ({documents.length})
          </h2>
          
          {loadingList ? (
            <div className="loading-container" style={{ flexGrow: 1 }}>
              <div className="spinner"></div>
            </div>
          ) : documents.length === 0 ? (
            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 1rem' }}>
              <div>
                <span style={{ fontSize: '2.5rem' }}>📭</span>
                <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>Your document shelf is empty.</p>
                <p style={{ fontSize: '0.8rem', opacity: '0.8' }}>Upload notes to begin studying.</p>
              </div>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '0.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {documents.map((doc) => (
                  <div 
                    key={doc.id} 
                    className="card card-glowing"
                    style={{ 
                      padding: '1rem', 
                      background: 'rgba(255,255,255,0.02)', 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: '0.5rem' 
                    }}
                  >
                    <div>
                      <h4 
                        style={{ fontSize: '0.95rem', fontWeight: '700', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                        title={doc.title}
                      >
                        {doc.title}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {doc.filename || "Pasted notes"} • {(doc.content_length / 1024).toFixed(1)}k chars
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.5rem' }}>
                      <button 
                        className="btn" 
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleQuickAction(doc.id, 'summary')}
                      >
                        📝 Summary
                      </button>
                      <button 
                        className="btn" 
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleQuickAction(doc.id, 'flashcards')}
                      >
                        🎴 Flashcards
                      </button>
                      <button 
                        className="btn" 
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleQuickAction(doc.id, 'quiz')}
                      >
                        ❓ Quiz
                      </button>
                      <button 
                        className="btn" 
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleQuickAction(doc.id, 'schedule')}
                      >
                        📅 Schedule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
