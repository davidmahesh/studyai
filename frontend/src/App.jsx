import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import DocumentUpload from './components/DocumentUpload';
import SummaryView from './components/SummaryView';
import FlashcardsView from './components/FlashcardsView';
import QuizView from './components/QuizView';
import ScheduleView from './components/ScheduleView';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDocId, setSelectedDocId] = useState(null);
  
  // Toast notifications state
  const [toast, setToast] = useState({ message: '', type: '', visible: false });

  const showToast = (message, type = 'success') => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 4000);
  };

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            setActiveTab={setActiveTab} 
            setSelectedDocId={setSelectedDocId} 
          />
        );
      case 'materials':
        return (
          <DocumentUpload 
            setSelectedDocId={setSelectedDocId} 
            setActiveTab={setActiveTab} 
            showToast={showToast} 
          />
        );
      case 'summary':
        return (
          <SummaryView 
            selectedDocId={selectedDocId} 
            setSelectedDocId={setSelectedDocId} 
            showToast={showToast} 
          />
        );
      case 'flashcards':
        return (
          <FlashcardsView 
            selectedDocId={selectedDocId} 
            setSelectedDocId={setSelectedDocId} 
            showToast={showToast} 
          />
        );
      case 'quiz':
        return (
          <QuizView 
            selectedDocId={selectedDocId} 
            setSelectedDocId={setSelectedDocId} 
            showToast={showToast} 
          />
        );
      case 'schedule':
        return (
          <ScheduleView 
            selectedDocId={selectedDocId} 
            setSelectedDocId={setSelectedDocId} 
            showToast={showToast} 
          />
        );
      default:
        return <Dashboard setActiveTab={setActiveTab} setSelectedDocId={setSelectedDocId} />;
    }
  };

  return (
    <div className="app-container">
      {/* Navigation bar */}
      <header className="navbar">
        <div className="logo" onClick={() => setActiveTab('dashboard')}>
          <div className="logo-icon">S</div>
          <span>StudyAI</span>
        </div>
        
        <nav className="nav-links">
          <button 
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button 
            className={`nav-link ${activeTab === 'materials' ? 'active' : ''}`}
            onClick={() => setActiveTab('materials')}
          >
            📚 Library
          </button>
          <button 
            className={`nav-link ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            📝 Summary
          </button>
          <button 
            className={`nav-link ${activeTab === 'flashcards' ? 'active' : ''}`}
            onClick={() => setActiveTab('flashcards')}
          >
            🎴 Flashcards
          </button>
          <button 
            className={`nav-link ${activeTab === 'quiz' ? 'active' : ''}`}
            onClick={() => setActiveTab('quiz')}
          >
            ❓ Quiz
          </button>
          <button 
            className={`nav-link ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            📅 Schedule
          </button>
        </nav>
      </header>

      {/* Main Viewport */}
      <main className="main-content">
        {renderActiveComponent()}
      </main>

      {/* Dynamic Toast Popups */}
      {toast.visible && (
        <div className={`toast ${toast.type}`}>
          <span>
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '⚠️' : 'ℹ'}
          </span>
          <div>{toast.message}</div>
        </div>
      )}
    </div>
  );
}
