# StudyAI – Smart AI Study Companion & Quiz Generator

StudyAI is a web-based, AI-powered study dashboard designed to help students transform notes, textbooks, and documents into structured summaries, interactive flashcards, practice quizzes (MCQs, True/False, and Short Answer), and adaptive 7-day study plans.

It is built using **React.js** (frontend), **Python Flask** (backend), and integrates the **Groq API (Llama 3.3 70B Versatile)** with a smart local NLP fallback for offline or keyless operation.

---

## Getting Started

Follow these steps to run the application on your local machine.

### Prerequisites
- **Node.js** (v18+)
- **Python** (v3.9+)

---

### Step 1: Set Up & Run the Flask Backend
1. Open your terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```
3. Activate the virtual environment:
   - **On Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\activate
     ```
   - **On macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. *(Optional)* Add your Groq API key:
   - Create a file named `.env` in the `backend/` directory.
   - Insert: `GROQ_API_KEY=your_key_here`
   - *If no key is provided, the backend will automatically generate smart mock learning guides using local text analysis.*
6. Start the server:
   ```bash
   python app.py
   ```
   The backend API will run on **`http://127.0.0.1:5000`**.

---

### Step 2: Set Up & Run the React Frontend
1. Open a **new, separate** terminal window.
2. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
3. Install package dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   The user interface will run on **`http://localhost:5173`**.

---

### Step 3: Open in Browser
Open your browser and navigate to:
👉 **[http://localhost:5173](http://localhost:5173)**
