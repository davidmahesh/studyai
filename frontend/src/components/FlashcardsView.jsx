import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function FlashcardsView({ selectedDocId, setSelectedDocId, showToast }) {
  const [documents, setDocuments] = useState([]);
  const [docTitle, setDocTitle] = useState('');
  const [flashcards, setFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDocList();
    if (selectedDocId) {
      loadFlashcards(selectedDocId);
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

  const loadFlashcards = async (docId) => {
    try {
      setLoading(true);
      setCurrentIndex(0);
      setIsFlipped(false);
      
      const doc = documents.find(d => d.id === docId);
      if (doc) setDocTitle(doc.title);
      
      const res = await api.getFlashcards(docId);
      setFlashcards(res.flashcards || []);
    } catch (err) {
      console.error(err);
      showToast("Failed to load flashcards for this material.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChange = (e) => {
    const docId = e.target.value;
    setSelectedDocId(docId || null);
    if (!docId) {
      setFlashcards([]);
      setDocTitle('');
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
      }, 150); // wait for flip reset
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => {
        setCurrentIndex(currentIndex - 1);
      }, 150);
    }
  };

  const handleShuffle = () => {
    if (flashcards.length === 0) return;
    setIsFlipped(false);
    
    // Shuffle array
    setTimeout(() => {
      const shuffled = [...flashcards];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      setFlashcards(shuffled);
      setCurrentIndex(0);
      showToast("Deck shuffled!", "success");
    }, 150);
  };

  const toggleMastery = async (cardId, currentMasteredVal) => {
    try {
      const newVal = !currentMasteredVal;
      // Optimistic update
      const updatedCards = flashcards.map(c => 
        c.id === cardId ? { ...c, mastered: newVal } : c
      );
      setFlashcards(updatedCards);
      
      // Update backend database
      await api.updateFlashcard(selectedDocId, cardId, newVal);
      
      if (newVal) {
        showToast("Concept mastered! Added to metrics.", "success");
      } else {
        showToast("Concept returned to review deck.", "info");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to update mastery status on server.", "error");
      // Rollback
      const rollbackedCards = flashcards.map(c => 
        c.id === cardId ? { ...c, mastered: currentMasteredVal } : c
      );
      setFlashcards(rollbackedCards);
    }
  };

  const masteredCount = flashcards.filter(c => c.mastered).length;
  const currentCard = flashcards[currentIndex];

  return (
    <div style={{ animation: 'fadeIn 0.4s' }}>
      <div className="section-header">
        <div>
          <h1 className="section-title">AI Flashcards</h1>
          <p className="section-subtitle">Use active recall to flip through questions and track concept mastery</p>
        </div>

        {/* Dropdown */}
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
      </div>

      {!selectedDocId ? (
        <div className="card empty-state">
          <div className="empty-state-icon">🎴</div>
          <p className="empty-state-title">No Study Material Selected</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Please select an uploaded document from the menu to generate a customized card deck.
          </p>
          <button className="btn" onClick={() => fetchDocList()}>Refresh Library List</button>
        </div>
      ) : loading ? (
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <div className="spinner"></div>
          <h3 style={{ marginTop: '1rem', fontSize: '1.1rem' }}>Crafting AI Flashcards...</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            StudyAI is compiling definition terms and sentence queries into card questions...
          </p>
        </div>
      ) : flashcards.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">📭</div>
          <p className="empty-state-title">No Flashcards Generated</p>
          <p style={{ color: 'var(--text-muted)' }}>
            We couldn't generate cards for this document. Verify that the document text is not empty.
          </p>
        </div>
      ) : (
        <div className="flashcards-container">
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              width: '100%', 
              maxWidth: '480px', 
              alignItems: 'center',
              fontSize: '0.9rem'
            }}
          >
            <div style={{ color: 'var(--text-secondary)' }}>
              Deck: <strong style={{ color: '#fff' }}>{docTitle}</strong>
            </div>
            <div className="progress-pill" style={{ borderColor: 'var(--color-success)', color: '#10b981' }}>
              Mastery: {masteredCount} / {flashcards.length} ({Math.round((masteredCount / flashcards.length) * 100)}%)
            </div>
          </div>

          {/* Interactive flipping card */}
          <div 
            className={`flashcard-wrapper ${isFlipped ? 'flipped' : ''}`}
            onClick={handleFlip}
          >
            <div className="flashcard-inner">
              {/* Front side */}
              <div className="flashcard-front">
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span className="flashcard-tag" style={{ border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8' }}>
                    Q: {currentIndex + 1} of {flashcards.length}
                  </span>
                  <span className="flashcard-tag" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {currentCard?.topic || 'Concept'}
                  </span>
                </div>
                
                <div className="flashcard-content">
                  {currentCard?.question}
                </div>
                
                <div className="flashcard-footer">
                  💡 Click card to flip and reveal answer
                </div>
              </div>

              {/* Back side */}
              <div className="flashcard-back">
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span className="flashcard-tag" style={{ border: '1px solid rgba(168,85,247,0.4)', color: '#c084fc' }}>
                    A: {currentIndex + 1} of {flashcards.length}
                  </span>
                  <span className={`flashcard-tag`} style={{ 
                    color: currentCard?.difficulty === 'Easy' ? '#10b981' : currentCard?.difficulty === 'Hard' ? '#ef4444' : '#f59e0b',
                    background: 'rgba(0,0,0,0.2)' 
                  }}>
                    {currentCard?.difficulty || 'Medium'}
                  </span>
                </div>
                
                <div className="flashcard-content" style={{ fontSize: '1.05rem', fontWeight: '500' }}>
                  {currentCard?.answer}
                </div>
                
                <div className="flashcard-footer" style={{ color: 'var(--color-secondary)' }}>
                  ✨ Mastery status can be toggled below
                </div>
              </div>
            </div>
          </div>

          {/* Mastery toggler & Deck controls */}
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem', 
              width: '100%', 
              maxWidth: '480px' 
            }}
          >
            {/* Mastered checkbox button */}
            <button 
              className={`btn ${currentCard?.mastered ? 'btn-success' : ''}`}
              onClick={(e) => {
                e.stopPropagation(); // prevent card flip when clicking button
                toggleMastery(currentCard.id, currentCard.mastered);
              }}
              style={{ width: '100%', gap: '0.5rem' }}
            >
              {currentCard?.mastered ? '✓ Mastered (Click to Reset)' : '⬜ Mark Concept as Mastered'}
            </button>

            {/* Pagination and Shuffle */}
            <div className="flashcard-controls" style={{ width: '100%', justifyContent: 'space-between' }}>
              <button 
                className={`btn ${currentIndex === 0 ? 'btn-disabled' : ''}`}
                onClick={handlePrev}
                disabled={currentIndex === 0}
              >
                ◀ Prev
              </button>
              
              <button className="btn" onClick={handleShuffle} style={{ padding: '0.65rem 1rem' }}>
                🔀 Shuffle Deck
              </button>
              
              <button 
                className={`btn ${currentIndex === flashcards.length - 1 ? 'btn-disabled' : ''}`}
                onClick={handleNext}
                disabled={currentIndex === flashcards.length - 1}
              >
                Next ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
