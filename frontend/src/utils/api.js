const API_BASE = 'http://127.0.0.1:5000/api';

/**
 * Handles all requests to the backend server.
 */
async function fetchJson(url, options = {}) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Request to ${url} failed:`, error);
    throw error;
  }
}

export const api = {
  // Upload document (expects FormData)
  async uploadDocument(formData) {
    return fetchJson(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData, // Do NOT set Content-Type header when using FormData
    });
  },

  // Get list of uploaded materials
  async getDocuments() {
    return fetchJson(`${API_BASE}/documents`);
  },

  // Get specific document metadata
  async getDocument(docId) {
    return fetchJson(`${API_BASE}/documents/${docId}`);
  },

  // Generate or retrieve summary
  async getSummary(docId) {
    return fetchJson(`${API_BASE}/documents/${docId}/summary`, {
      method: 'POST',
    });
  },

  // Generate or retrieve flashcards
  async getFlashcards(docId) {
    return fetchJson(`${API_BASE}/documents/${docId}/flashcards`, {
      method: 'POST',
    });
  },

  // Update specific flashcard mastery status
  async updateFlashcard(docId, cardId, mastered) {
    return fetchJson(`${API_BASE}/documents/${docId}/flashcards/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cardId, mastered }),
    });
  },

  // Generate a quiz
  async createQuiz(docId, quizType, numQuestions) {
    return fetchJson(`${API_BASE}/documents/${docId}/quiz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quiz_type: quizType, num_questions: numQuestions }),
    });
  },

  // Submit quiz answers & score
  async submitQuiz(docId, score, total, answers) {
    return fetchJson(`${API_BASE}/quiz/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doc_id: docId,
        score,
        total,
        answers,
        timestamp: new Date().toLocaleString(),
      }),
    });
  },

  // Get analytics metrics
  async getAnalytics() {
    return fetchJson(`${API_BASE}/analytics`);
  },

  // Generate Study Schedule
  async generateSchedule(docId = null) {
    const body = docId ? { doc_id: docId } : {};
    return fetchJson(`${API_BASE}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  },
};
