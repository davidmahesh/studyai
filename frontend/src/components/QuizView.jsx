import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function QuizView({ selectedDocId, setSelectedDocId, showToast }) {
  const [documents, setDocuments] = useState([]);
  const [docTitle, setDocTitle] = useState('');
  
  // State machine: 'setup' | 'loading' | 'active' | 'results'
  const [quizState, setQuizState] = useState('setup');
  
  // Setup config
  const [quizType, setQuizType] = useState('mcq'); // mcq, tf, short
  const [numQuestions, setNumQuestions] = useState(5);
  
  // Active quiz state
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // questionId -> selectedChoice/text
  
  // Results state
  const [results, setResults] = useState(null);

  useEffect(() => {
    fetchDocList();
    if (selectedDocId) {
      const doc = documents.find(d => d.id === selectedDocId);
      if (doc) setDocTitle(doc.title);
    }
  }, [selectedDocId, documents]);

  const fetchDocList = async () => {
    try {
      const list = await api.getDocuments();
      setDocuments(list);
    } catch (err) {
      console.error(err);
    }
  };

  const startQuizGeneration = async () => {
    if (!selectedDocId) {
      showToast("Please select a study document.", "error");
      return;
    }
    
    try {
      setQuizState('loading');
      setUserAnswers({});
      setCurrentQIndex(0);
      
      const res = await api.createQuiz(selectedDocId, quizType, numQuestions);
      setQuestions(res.questions || []);
      setQuizState('active');
    } catch (err) {
      console.error(err);
      showToast("Failed to generate quiz. Try again.", "error");
      setQuizState('setup');
    }
  };

  const handleSelectChange = (e) => {
    const docId = e.target.value;
    setSelectedDocId(docId || null);
    setQuizState('setup');
    setResults(null);
  };

  const selectOption = (qId, option) => {
    setUserAnswers({
      ...userAnswers,
      [qId]: option
    });
  };

  const handleShortAnswerChange = (qId, val) => {
    setUserAnswers({
      ...userAnswers,
      [qId]: val
    });
  };

  const handleNext = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentQIndex > 0) {
      setCurrentQIndex(currentQIndex - 1);
    }
  };

  const submitQuizAnswers = async () => {
    // Validate that all questions are answered
    const unansweredCount = questions.filter(q => !userAnswers[q.id]).length;
    if (unansweredCount > 0 && quizType !== 'short') {
      const confirmSubmit = window.confirm(`You have ${unansweredCount} unanswered questions. Submit anyway?`);
      if (!confirmSubmit) return;
    }

    try {
      setQuizState('loading');
      
      // Calculate score locally
      let score = 0;
      questions.forEach(q => {
        const uAns = userAnswers[q.id];
        if (quizType === 'mcq' || quizType === 'tf') {
          if (uAns && uAns.trim().toLowerCase() === q.answer.trim().toLowerCase()) {
            score++;
          }
        } else {
          // Short answer: give completion credit if they typed something substantial
          if (uAns && uAns.trim().length > 10) {
            score++;
          }
        }
      });

      const submissionRes = await api.submitQuiz(
        selectedDocId,
        score,
        questions.length,
        userAnswers
      );
      
      setResults({
        score,
        total: questions.length,
        weakTopics: submissionRes.weak_topics || []
      });
      setQuizState('results');
      showToast("Quiz submitted successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to submit quiz results.", "error");
      setQuizState('active');
    }
  };

  const activeQuestion = questions[currentQIndex];

  return (
    <div style={{ animation: 'fadeIn 0.4s' }}>
      <div className="section-header">
        <div>
          <h1 className="section-title">AI Quizzes</h1>
          <p className="section-subtitle">Generate practice tests on demand to identify weak topics</p>
        </div>

        <select 
          className="form-select" 
          style={{ width: '220px', padding: '0.5rem' }}
          value={selectedDocId || ''} 
          disabled={quizState === 'active' || quizState === 'loading'}
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
          <div className="empty-state-icon">❓</div>
          <p className="empty-state-title">No Study Material Selected</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Please select an uploaded document from the menu to build a customized quiz.
          </p>
          <button className="btn" onClick={() => fetchDocList()}>Refresh Library List</button>
        </div>
      ) : quizState === 'loading' ? (
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <div className="spinner"></div>
          <h3 style={{ marginTop: '1rem', fontSize: '1.1rem' }}>Compiling Test Questions...</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Llama 3.3 is analyzing core vocabulary, concepts, and phrasing distractors...
          </p>
        </div>
      ) : quizState === 'setup' ? (
        <div className="card quiz-setup" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', textAlign: 'center' }}>
            Configure Practice Quiz
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            Material: <strong style={{ color: '#fff' }}>{docTitle}</strong>
          </p>

          <div className="form-group">
            <label className="form-label">Question Format</label>
            <div 
              className={`quiz-setup-option ${quizType === 'mcq' ? 'selected' : ''}`}
              onClick={() => setQuizType('mcq')}
            >
              <span style={{ fontSize: '1.5rem' }}>🔘</span>
              <div>
                <p style={{ fontWeight: 'bold' }}>Multiple Choice (MCQ)</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Identify the single correct definition option</p>
              </div>
            </div>

            <div 
              className={`quiz-setup-option ${quizType === 'tf' ? 'selected' : ''}`}
              onClick={() => setQuizType('tf')}
            >
              <span style={{ fontSize: '1.5rem' }}>🌓</span>
              <div>
                <p style={{ fontWeight: 'bold' }}>True / False</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Evaluate factual correctness of key sentences</p>
              </div>
            </div>

            <div 
              className={`quiz-setup-option ${quizType === 'short' ? 'selected' : ''}`}
              onClick={() => setQuizType('short')}
            >
              <span style={{ fontSize: '1.5rem' }}>✍️</span>
              <div>
                <p style={{ fontWeight: 'bold' }}>Short Answer</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Write active descriptions and compare definitions</p>
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label">Number of Questions</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[5, 10, 15].map(num => (
                <button 
                  key={num}
                  type="button" 
                  className={`btn ${numQuestions === num ? 'btn-primary' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setNumQuestions(num)}
                >
                  {num} Questions
                </button>
              ))}
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '2rem', padding: '0.8rem' }}
            onClick={startQuizGeneration}
          >
            🔥 Generate Practice Exam
          </button>
        </div>
      ) : quizState === 'active' ? (
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          {/* Progress bar and counter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <span className="flashcard-tag" style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                Question {currentQIndex + 1} of {questions.length}
              </span>
            </div>
            
            {/* Quick dot indicators */}
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {questions.map((q, idx) => (
                <div 
                  key={q.id}
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: currentQIndex === idx ? 'var(--color-primary)' : userAnswers[q.id] ? 'var(--color-success)' : 'rgba(255,255,255,0.1)'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Active Question Card */}
          <div className="card quiz-question-card" style={{ padding: '2rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Topic Focus: {activeQuestion?.topic || 'General Material'}
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              {activeQuestion?.question}
            </h3>

            {/* Render Multiple Choice */}
            {quizType === 'mcq' && (
              <div className="quiz-options-list">
                {activeQuestion?.options?.map((option, i) => (
                  <button 
                    key={i} 
                    className={`quiz-option ${userAnswers[activeQuestion.id] === option ? 'selected' : ''}`}
                    onClick={() => selectOption(activeQuestion.id, option)}
                  >
                    <span>{option}</span>
                    <span>{userAnswers[activeQuestion.id] === option ? '🔘' : '⚪'}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Render True / False */}
            {quizType === 'tf' && (
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                {['True', 'False'].map(opt => (
                  <button
                    key={opt}
                    className={`btn ${userAnswers[activeQuestion.id] === opt ? 'btn-primary' : ''}`}
                    style={{ flex: 1, padding: '1rem' }}
                    onClick={() => selectOption(activeQuestion.id, opt)}
                  >
                    {opt === 'True' ? '🌕 True' : '🌑 False'}
                  </button>
                ))}
              </div>
            )}

            {/* Render Short Answer */}
            {quizType === 'short' && (
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <textarea
                  className="form-textarea"
                  placeholder="Type your explanation or summary definition here..."
                  value={userAnswers[activeQuestion.id] || ''}
                  onChange={(e) => handleShortAnswerChange(activeQuestion.id, e.target.value)}
                ></textarea>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Write a comprehensive answer. AI comparison keys will help verify correctness.
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
            <button 
              className={`btn ${currentQIndex === 0 ? 'btn-disabled' : ''}`} 
              onClick={handlePrev}
              disabled={currentQIndex === 0}
            >
              ◀ Previous
            </button>
            
            {currentQIndex === questions.length - 1 ? (
              <button className="btn btn-primary" onClick={submitQuizAnswers} style={{ padding: '0.65rem 2rem' }}>
                🚀 Submit Exam
              </button>
            ) : (
              <button className="btn" onClick={handleNext}>
                Next ▶
              </button>
            )}
          </div>
        </div>
      ) : quizState === 'results' ? (
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Big Score Card */}
          <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
            <div className="result-score-circle" style={{ 
              borderColor: results.score / results.total >= 0.7 ? 'var(--color-success)' : results.score / results.total >= 0.4 ? 'var(--color-warning)' : 'var(--color-danger)',
              boxShadow: results.score / results.total >= 0.7 ? '0 0 20px var(--color-success-glow)' : results.score / results.total >= 0.4 ? '0 0 20px var(--color-warning-glow)' : '0 0 20px var(--color-danger-glow)'
            }}>
              <span style={{ fontSize: '2.5rem', fontWeight: '800' }}>
                {Math.round((results.score / results.total) * 100)}%
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {results.score} / {results.total} Right
              </span>
            </div>

            <h2 style={{ marginTop: '1.5rem', fontSize: '1.4rem' }}>
              {results.score / results.total >= 0.8 ? '🎉 Outstanding Work!' : results.score / results.total >= 0.5 ? '👍 Good Effort!' : '📚 Time to hit the books!'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Review the corrections and explanations below to improve.
            </p>

            {results.weakTopics.length > 0 && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--color-danger-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <p style={{ color: '#fda4af', fontWeight: 'bold', fontSize: '0.85rem' }}>⚠️ Identified Weak Topics:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                  {results.weakTopics.map((topic, idx) => (
                    <span key={idx} className="weak-topic-tag">{topic}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={() => setQuizState('setup')}>
                🔄 Take Another Quiz
              </button>
              <button className="btn" onClick={() => { setSelectedDocId(null); setQuizState('setup'); }}>
                📚 Back to Library
              </button>
            </div>
          </div>

          {/* Question Breakdown List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', margin: '0.5rem 0' }}>Review Correction Keys</h2>
            {questions.map((q, idx) => {
              const uAns = userAnswers[q.id];
              const isCorrect = (quizType === 'mcq' || quizType === 'tf') 
                ? (uAns && uAns.trim().toLowerCase() === q.answer.trim().toLowerCase())
                : (uAns && uAns.trim().length > 10);
              
              return (
                <div 
                  key={q.id} 
                  className="card" 
                  style={{ 
                    borderLeft: `4px solid ${isCorrect ? 'var(--color-success)' : 'var(--color-danger)'}`,
                    padding: '1.25rem' 
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    <span>Topic: {q.topic || 'General'}</span>
                    <span style={{ 
                      color: isCorrect ? 'var(--color-success)' : 'var(--color-danger)', 
                      fontWeight: 'bold' 
                    }}>
                      {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                    {idx + 1}. {q.question}
                  </h4>

                  {quizType !== 'short' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
                      <p>
                        <strong style={{ color: 'var(--text-secondary)' }}>Your Answer:</strong>{' '}
                        <span style={{ color: isCorrect ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {uAns || '(No Answer Selected)'}
                        </span>
                      </p>
                      {!isCorrect && (
                        <p>
                          <strong style={{ color: 'var(--text-secondary)' }}>Correct Answer:</strong>{' '}
                          <span style={{ color: 'var(--color-success)' }}>{q.answer}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <p>
                        <strong style={{ color: 'var(--text-secondary)' }}>Your Submission:</strong>{' '}
                        <span style={{ color: 'var(--text-primary)' }}>{uAns || '(Empty response)'}</span>
                      </p>
                      <p>
                        <strong style={{ color: 'var(--text-secondary)' }}>AI Reference Correction:</strong>{' '}
                        <span style={{ color: '#fff' }}>{q.answer}</span>
                      </p>
                    </div>
                  )}

                  <div className="result-explanation">
                    <strong>Explanation:</strong> {q.explanation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
