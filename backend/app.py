import os
import uuid
import json
import re
import random
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load env variables (such as GROQ_API_KEY)
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configurations
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
STORAGE_FOLDER = os.path.join(os.path.dirname(__file__), 'storage')
DB_FILE = os.path.join(STORAGE_FOLDER, 'db.json')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(STORAGE_FOLDER, exist_ok=True)

# Database helper functions
def load_db():
    if not os.path.exists(DB_FILE):
        default_db = {
            "documents": {},
            "summaries": {},
            "flashcards": {},
            "quizzes": {},
            "quiz_attempts": [],
            "schedules": {}
        }
        with open(DB_FILE, 'w') as f:
            json.dump(default_db, f, indent=4)
        return default_db
    try:
        with open(DB_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return {
            "documents": {},
            "summaries": {},
            "flashcards": {},
            "quizzes": {},
            "quiz_attempts": [],
            "schedules": {}
        }

def save_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=4)

# File extraction helpers
def extract_text_from_pdf(filepath):
    try:
        import pypdf
        reader = pypdf.PdfReader(filepath)
        text = ""
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
        return text.strip()
    except Exception as e:
        print("PDF extraction failed, trying raw read:", e)
        # Fallback to simple bytes decoding if pypdf fails
        try:
            with open(filepath, 'rb') as f:
                return f.read().decode('utf-8', errors='ignore')
        except Exception:
            return ""

def extract_text_from_docx(filepath):
    try:
        import docx
        doc = docx.Document(filepath)
        text = []
        for para in doc.paragraphs:
            text.append(para.text)
        return "\n".join(text).strip()
    except Exception as e:
        print("DOCX extraction failed:", e)
        return ""

# Fallback smart generators (when Groq is not configured)
def parse_text_semantics(text):
    """Simple parser to extract sentences, key terms, definitions, and concepts from text."""
    if not text:
        return {
            "sentences": ["No text uploaded yet."],
            "definitions": {"StudyAI": "An AI study assistant for note-taking and quiz generation."},
            "concepts": ["Learning", "Recall", "Study Planning"]
        }
    
    # Split sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
    
    # Simple definition extraction: "[Term] is/are [definition]" or "[Term] refers to [definition]"
    definitions = {}
    concepts = []
    
    pattern = re.compile(r'\b([A-Z][a-zA-Z\s]{2,25})\b\s+(is|are|refers to|defined as|means)\s+([^.!?]{10,200})', re.IGNORECASE)
    
    for sentence in sentences:
        match = pattern.search(sentence)
        if match:
            term = match.group(1).strip().title()
            definition = match.group(3).strip()
            # clean definition
            if term not in definitions and len(term.split()) <= 4:
                definitions[term] = definition
                concepts.append(term)
    
    # Extract capitalized terms as concepts if definitions are dry
    if len(concepts) < 5:
        # Find capitalized words or bigrams
        capitalized = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b', text)
        for term in capitalized:
            if len(term) > 3 and term not in concepts and len(term.split()) <= 3:
                concepts.append(term)
                if len(concepts) >= 15:
                    break
                    
    # Basic fallbacks if parsing found nothing
    if not definitions:
        definitions = {
            "Core Material": "The primary concepts discussed in the uploaded notes.",
            "Active Recall": "A testing technique where you stimulate your memory during the learning process.",
            "Spaced Repetition": "An information review method done at increasing intervals to boost retention."
        }
        concepts = ["Core Material", "Active Recall", "Spaced Repetition"]
        
    return {
        "sentences": sentences,
        "definitions": definitions,
        "concepts": list(set(concepts))
    }

def fallback_generate_summary(doc_title, semantics):
    concepts = semantics["concepts"][:5]
    defs = semantics["definitions"]
    sentences = semantics["sentences"]
    
    summary_md = f"# Summary: {doc_title}\n\n"
    summary_md += "## Topic Overview\n"
    summary_md += "This document covers the fundamental principles of the uploaded study materials. "
    if len(sentences) > 0:
        summary_md += "It highlights key aspects such as: " + ", ".join(concepts) + ".\n\n"
    
    summary_md += "## Key Concepts\n"
    for idx, concept in enumerate(concepts):
        # find a sentence mentioning it
        matching_sentence = ""
        for s in sentences:
            if concept.lower() in s.lower():
                matching_sentence = s
                break
        if not matching_sentence and len(sentences) > idx:
            matching_sentence = sentences[idx]
        summary_md += f"- **{concept}**: {matching_sentence or 'An important foundation of the subject matter.'}\n"
    
    summary_md += "\n## Important Definitions\n"
    for term, val in list(defs.items())[:5]:
        summary_md += f"- **{term}**: {val}\n"
        
    summary_md += "\n## Core Principles\n"
    summary_md += "To master this study material, students should focus on the following core ideas:\n"
    principles = [s for s in sentences if any(x in s.lower() for x in ["must", "should", "important", "key", "principle", "rule"])]
    if not principles:
        principles = sentences[:3]
    for p in principles[:4]:
        summary_md += f"- {p}\n"
        
    summary_md += "\n## Last-Minute Revision Notes\n"
    summary_md += "Quick review checklist:\n"
    for idx, c in enumerate(concepts[:4]):
        summary_md += f"- [ ] Understand the mechanics and implementation of **{c}**.\n"
    summary_md += "- [ ] Connect how these concepts interlink to form the overall topic architecture.\n"
    summary_md += "- [ ] Re-test with the AI Study Companion Quiz to verify retention.\n"
    
    return summary_md

def fallback_generate_flashcards(semantics):
    defs = semantics["definitions"]
    concepts = semantics["concepts"]
    sentences = semantics["sentences"]
    
    flashcards = []
    
    # 1. Generate from definitions
    for term, definition in list(defs.items()):
        flashcards.append({
            "id": str(uuid.uuid4()),
            "question": f"Define or explain the concept of '{term}'.",
            "answer": definition[0].upper() + definition[1:],
            "topic": term,
            "difficulty": "Medium" if len(definition) > 60 else "Easy",
            "mastered": False
        })
        
    # 2. Generate from key concepts / sentences
    for idx, concept in enumerate(concepts):
        if idx >= len(flashcards):  # cap size or augment
            # find sentence containing concept
            matching = [s for s in sentences if concept.lower() in s.lower()]
            if matching:
                q_text = f"What is the significance of '{concept}' in this context?"
                ans_text = matching[0]
                flashcards.append({
                    "id": str(uuid.uuid4()),
                    "question": q_text,
                    "answer": ans_text,
                    "topic": concept,
                    "difficulty": "Hard" if len(ans_text) > 100 else "Medium",
                    "mastered": False
                })
                
    # Safeguard if list is too small
    if len(flashcards) < 5:
        flashcards.append({
            "id": str(uuid.uuid4()),
            "question": "What is the primary objective of studying these notes?",
            "answer": "To reinforce understanding of core terms, definitions, and related educational principles.",
            "topic": "General Study",
            "difficulty": "Easy",
            "mastered": False
        })
        
    return flashcards

def fallback_generate_quiz(semantics, quiz_type, num_questions):
    defs = semantics["definitions"]
    concepts = semantics["concepts"]
    sentences = semantics["sentences"]
    
    questions = []
    
    # Generate MCQ questions
    if quiz_type == "mcq":
        for i in range(num_questions):
            # pick a definition or concept
            if i < len(defs):
                term = list(defs.keys())[i]
                correct = defs[term]
                # Gather distractors from other definitions or sentences
                other_defs = [d for t, d in defs.items() if t != term]
                if len(other_defs) < 3:
                    other_defs += [s[:100] for s in sentences if len(s) > 30 and s[:100] != correct][:3]
                
                distractors = list(set(other_defs))
                if len(distractors) < 3:
                    distractors += ["Incorrect Concept Option A", "Incorrect Concept Option B", "Incorrect Concept Option C"]
                distractors = random.sample(distractors, min(len(distractors), 3))
                
                options = [correct] + distractors
                random.shuffle(options)
                
                questions.append({
                    "id": i + 1,
                    "question": f"Which of the following best describes the term '{term}'?",
                    "options": options,
                    "answer": correct,
                    "explanation": f"The term '{term}' is explicitly defined as: {correct}",
                    "topic": term
                })
            else:
                # pick a concept
                concept = concepts[i % len(concepts)]
                correct_sent = ""
                for s in sentences:
                    if concept.lower() in s.lower():
                        correct_sent = s
                        break
                if not correct_sent:
                    correct_sent = sentences[i % len(sentences)]
                
                # Make simple MCQ
                options = [
                    correct_sent,
                    f"Option A: Alternative interpretation focusing on basic {concept} functions.",
                    f"Option B: General study statement contradicting {concept} mechanics.",
                    f"Option C: Unrelated information regarding external parameters."
                ]
                random.shuffle(options)
                
                questions.append({
                    "id": i + 1,
                    "question": f"Based on the text, what is the core statement concerning '{concept}'?",
                    "options": options,
                    "answer": correct_sent,
                    "explanation": f"In the document, the author states: '{correct_sent}'",
                    "topic": concept
                })
                
    elif quiz_type == "tf":
        # Generate True/False questions
        for i in range(num_questions):
            if i % 2 == 0 and i < len(sentences):
                # True question
                sent = sentences[i]
                # truncate if too long
                if len(sent) > 150:
                    sent = sent[:150] + "..."
                questions.append({
                    "id": i + 1,
                    "question": f"Is the following statement True or False? \n\"{sent}\"",
                    "options": ["True", "False"],
                    "answer": "True",
                    "explanation": f"This statement matches the source notes directly.",
                    "topic": concepts[i % len(concepts)]
                })
            else:
                # False question
                term = list(defs.keys())[i % len(defs)]
                correct = defs[term]
                # scramble definition to make it false
                false_definition = "It represents the direct opposite of standard processes, rendering it completely irrelevant for modern learning systems."
                questions.append({
                    "id": i + 1,
                    "question": f"Is the following statement True or False? \n\"'{term}' refers to: {false_definition}\"",
                    "options": ["True", "False"],
                    "answer": "False",
                    "explanation": f"False. '{term}' actually refers to: {correct}",
                    "topic": term
                })
                
    else:  # Short Answer
        for i in range(num_questions):
            term = list(defs.keys())[i % len(defs)]
            correct = defs[term]
            questions.append({
                "id": i + 1,
                "question": f"Provide a brief description or define the concept: '{term}'.",
                "answer": correct,
                "explanation": f"Your response should contain key details like: {correct}",
                "topic": term
            })
            
    return questions

def fallback_generate_schedule(semantics, weak_topics):
    concepts = semantics["concepts"]
    plan = []
    
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    # Priority topics: weak topics first, then remaining concepts
    topics_pool = list(weak_topics) + [c for c in concepts if c not in weak_topics]
    if not topics_pool:
        topics_pool = ["Core Materials", "Summary Review", "Mock Exam Prep"]
        
    study_tips = [
        "Use the active recall method: hide details and try to explain them aloud.",
        "Take a 5-minute break after every 25 minutes of studying (Pomodoro Technique).",
        "Explain this topic to a friend or virtual assistant to lock in your understanding.",
        "Solve at least 5 AI-generated flashcards before moving on to the next section.",
        "Review your weak topic quiz questions first to fix gaps in understanding."
    ]
    
    for idx, day in enumerate(days):
        day_topic = topics_pool[idx % len(topics_pool)]
        is_weak = day_topic in weak_topics
        
        # Build tasks for this day
        tasks = [
            f"Review main summary notes for {day_topic}",
            f"Practice with {day_topic} Flashcards",
        ]
        
        if is_weak:
            tasks.append(f"RE-RUN QUIZ: Focus heavily on fixing errors in {day_topic}")
            time_slot = "10:00 AM - 11:30 AM (Focus Session)"
        else:
            tasks.append(f"Answer 5 short-answer questions about {day_topic}")
            time_slot = f"04:00 PM - 05:00 PM (Regular Study)"
            
        plan.append({
            "day": day,
            "topic": day_topic,
            "isWeakTopic": is_weak,
            "timeSlot": time_slot,
            "tasks": tasks,
            "tip": study_tips[idx % len(study_tips)]
        })
        
    return plan

# Groq API Helper using llama3-3-70b-versatile
def query_groq_llama(prompt, system_prompt="You are a helpful education AI companion."):
    groq_api_key = os.environ.get("GROQ_API_KEY")
    if not groq_api_key:
        print("Warning: GROQ_API_KEY environment variable not set. Falling back to rule-based generation.")
        return None
        
    try:
        from groq import Groq
        client = Groq(api_key=groq_api_key)
        
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=4000
        )
        return completion.choices[0].message.content
    except Exception as e:
        print(f"Error querying Groq API: {e}. Falling back.")
        return None

# Endpoints
@app.route('/api/upload', methods=['POST'])
def upload_document():
    # Load db
    db = load_db()
    
    title = request.form.get('title', '')
    text_content = request.form.get('textContent', '').strip()
    
    if not title:
        title = "Untitled Study Notes"
        
    doc_id = str(uuid.uuid4())
    
    extracted_text = ""
    filename = None
    
    if 'file' in request.files:
        file = request.files['file']
        if file.filename != '':
            filename = secure_filename(file.filename)
            filepath = os.path.join(UPLOAD_FOLDER, f"{doc_id}_{filename}")
            file.save(filepath)
            
            # Extract content
            if filename.lower().endswith('.pdf'):
                extracted_text = extract_text_from_pdf(filepath)
            elif filename.lower().endswith('.docx'):
                extracted_text = extract_text_from_docx(filepath)
            else:
                # Text files
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        extracted_text = f.read()
                except Exception:
                    extracted_text = ""
            
            if not title or title == "Untitled Study Notes":
                title = file.filename
                
    elif text_content:
        extracted_text = text_content
        filename = "pasted_text.txt"
        
    if not extracted_text:
        return jsonify({"error": "No readable content extracted. Please upload a valid text, DOCX, or PDF file."}), 400
        
    # Save document in DB
    db["documents"][doc_id] = {
        "id": doc_id,
        "title": title,
        "filename": filename,
        "content": extracted_text,
        "content_length": len(extracted_text),
        "uploaded_at": request.form.get('timestamp', '')
    }
    
    save_db(db)
    
    return jsonify({
        "id": doc_id,
        "title": title,
        "content_length": len(extracted_text),
        "message": "Document uploaded and parsed successfully!"
    })

@app.route('/api/documents', methods=['GET'])
def get_documents():
    db = load_db()
    docs = []
    for doc_id, doc in db["documents"].items():
        docs.append({
            "id": doc["id"],
            "title": doc["title"],
            "filename": doc["filename"],
            "content_length": doc["content_length"],
            "uploaded_at": doc.get("uploaded_at", "")
        })
    # Sort by uploaded date if available (or just reverse keys)
    docs.reverse()
    return jsonify(docs)

@app.route('/api/documents/<doc_id>', methods=['GET'])
def get_document(doc_id):
    db = load_db()
    if doc_id not in db["documents"]:
        return jsonify({"error": "Document not found"}), 404
        
    doc = db["documents"][doc_id]
    return jsonify({
        "id": doc["id"],
        "title": doc["title"],
        "content_length": doc["content_length"],
        "uploaded_at": doc.get("uploaded_at", "")
    })

@app.route('/api/documents/<doc_id>/summary', methods=['POST'])
def get_summary(doc_id):
    db = load_db()
    if doc_id not in db["documents"]:
        return jsonify({"error": "Document not found"}), 404
        
    # Check if cached
    if doc_id in db["summaries"]:
        return jsonify({"summary": db["summaries"][doc_id]})
        
    doc = db["documents"][doc_id]
    content = doc["content"]
    title = doc["title"]
    
    # 1. Try Groq Llama 3.3 70B
    groq_api_key = os.environ.get("GROQ_API_KEY")
    summary_md = None
    
    if groq_api_key:
        sys_prompt = "You are StudyAI, an expert study companion. Generate structured markdown summaries."
        prompt = (
            f"Generate a beautiful, structured study summary in markdown for the document titled '{title}'. "
            f"The summary must contain five sections: Topic Overview, Key Concepts, Important Definitions, "
            f"Core Principles, and Bullet-Point Revision Notes. Keep it concise, instructional, and structured. "
            f"Here is the content:\n\n{content[:8000]}"
        )
        summary_md = query_groq_llama(prompt, sys_prompt)
        
    # 2. Fall back to smart local NLP mock summary generator
    if not summary_md:
        semantics = parse_text_semantics(content)
        summary_md = fallback_generate_summary(title, semantics)
        
    # Cache and save
    db["summaries"][doc_id] = summary_md
    save_db(db)
    
    return jsonify({"summary": summary_md})

@app.route('/api/documents/<doc_id>/flashcards', methods=['POST'])
def get_flashcards(doc_id):
    db = load_db()
    if doc_id not in db["documents"]:
        return jsonify({"error": "Document not found"}), 404
        
    # Check if cached
    if doc_id in db["flashcards"]:
        return jsonify({"flashcards": db["flashcards"][doc_id]})
        
    doc = db["documents"][doc_id]
    content = doc["content"]
    
    # Try Groq
    groq_api_key = os.environ.get("GROQ_API_KEY")
    flashcards_list = None
    
    if groq_api_key:
        sys_prompt = "You are StudyAI. You output ONLY valid JSON arrays of flashcards, no conversational markdown wrapper."
        prompt = (
            f"Create a set of study flashcards as a JSON list from this text. Each card must be an object with fields: "
            f"'id' (unique uuid string), 'question' (string question), 'answer' (string explanation), "
            f"'topic' (brief label), 'difficulty' ('Easy', 'Medium', or 'Hard'), and 'mastered' (false).\n\n"
            f"Text:\n{content[:6000]}"
        )
        res = query_groq_llama(prompt, sys_prompt)
        if res:
            try:
                # find JSON list brackets
                json_start = res.find('[')
                json_end = res.rfind(']') + 1
                if json_start != -1 and json_end != -1:
                    flashcards_list = json.loads(res[json_start:json_end])
            except Exception as e:
                print("JSON Parsing flashcards failed:", e)
                
    # Fall back
    if not flashcards_list:
        semantics = parse_text_semantics(content)
        flashcards_list = fallback_generate_flashcards(semantics)
        
    # Cache and save
    db["flashcards"][doc_id] = flashcards_list
    save_db(db)
    
    return jsonify({"flashcards": flashcards_list})

@app.route('/api/documents/<doc_id>/flashcards/update', methods=['POST'])
def update_flashcard(doc_id):
    db = load_db()
    if doc_id not in db["flashcards"]:
        return jsonify({"error": "No flashcards found for this document"}), 404
        
    card_id = request.json.get('cardId')
    mastered = request.json.get('mastered', False)
    
    updated = False
    for card in db["flashcards"][doc_id]:
        if card["id"] == card_id:
            card["mastered"] = mastered
            updated = True
            break
            
    if not updated:
        return jsonify({"error": "Card not found"}), 404
        
    save_db(db)
    return jsonify({"success": True, "flashcards": db["flashcards"][doc_id]})

@app.route('/api/documents/<doc_id>/quiz', methods=['POST'])
def create_quiz(doc_id):
    db = load_db()
    if doc_id not in db["documents"]:
        return jsonify({"error": "Document not found"}), 404
        
    quiz_type = request.json.get('quiz_type', 'mcq')  # mcq, tf, short
    num_questions = int(request.json.get('num_questions', 5))
    
    doc = db["documents"][doc_id]
    content = doc["content"]
    
    groq_api_key = os.environ.get("GROQ_API_KEY")
    quiz_questions = None
    
    if groq_api_key:
        sys_prompt = "You are StudyAI. You generate quizzes and output ONLY a JSON array of question objects."
        prompt = (
            f"Generate a study quiz of type '{quiz_type}' with {num_questions} questions based on this text. "
            f"Output as a valid JSON list. Each object must have: "
            f"'id' (integer 1 to N), 'question' (string text), 'options' (array of strings, ONLY for mcq/tf, leave empty for short), "
            f"'answer' (correct option string or key definition for short), 'explanation' (why it is correct), and 'topic' (subject category).\n"
            f"For True/False, 'options' must be ['True', 'False'] and 'answer' must be 'True' or 'False'.\n\n"
            f"Text:\n{content[:6000]}"
        )
        res = query_groq_llama(prompt, sys_prompt)
        if res:
            try:
                json_start = res.find('[')
                json_end = res.rfind(']') + 1
                if json_start != -1 and json_end != -1:
                    quiz_questions = json.loads(res[json_start:json_end])
            except Exception as e:
                print("JSON Parsing quiz failed:", e)
                
    if not quiz_questions:
        semantics = parse_text_semantics(content)
        quiz_questions = fallback_generate_quiz(semantics, quiz_type, num_questions)
        
    # Store the active quiz configuration temporarily
    db["quizzes"][doc_id] = {
        "quiz_type": quiz_type,
        "questions": quiz_questions
    }
    save_db(db)
    
    return jsonify({"questions": quiz_questions})

@app.route('/api/quiz/submit', methods=['POST'])
def submit_quiz():
    db = load_db()
    
    doc_id = request.json.get('doc_id')
    score = int(request.json.get('score', 0))
    total = int(request.json.get('total', 1))
    answers = request.json.get('answers', {}) # questionId -> userChoice
    timestamp = request.json.get('timestamp', '')
    
    if doc_id not in db["documents"] or doc_id not in db["quizzes"]:
        return jsonify({"error": "Invalid quiz or document reference"}), 400
        
    doc_title = db["documents"][doc_id]["title"]
    quiz_data = db["quizzes"][doc_id]
    
    # Identify weak topics based on incorrect answers
    weak_topics = set()
    questions = quiz_data["questions"]
    
    for q in questions:
        q_id_str = str(q["id"])
        user_ans = answers.get(q_id_str)
        # Check matching answer
        if user_ans and str(user_ans).strip().lower() != str(q["answer"]).strip().lower():
            weak_topics.add(q.get("topic", "General Concept"))
            
    # Record the quiz attempt
    attempt = {
        "id": str(uuid.uuid4()),
        "doc_id": doc_id,
        "doc_title": doc_title,
        "score": score,
        "total": total,
        "quiz_type": quiz_data["quiz_type"],
        "weak_topics": list(weak_topics),
        "timestamp": timestamp
    }
    
    db["quiz_attempts"].append(attempt)
    save_db(db)
    
    return jsonify({
        "success": True,
        "attempt": attempt,
        "weak_topics": list(weak_topics)
    })

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    db = load_db()
    
    attempts = db["quiz_attempts"]
    total_quizzes = len(attempts)
    
    avg_score = 0
    if total_quizzes > 0:
        avg_score = sum((a["score"] / a["total"]) * 100 for a in attempts) / total_quizzes
        
    # Aggregate weak topics (topics with most errors)
    all_weak_topics = {}
    for a in attempts:
        for t in a["weak_topics"]:
            all_weak_topics[t] = all_weak_topics.get(t, 0) + 1
            
    # Sort weak topics by frequency of error
    sorted_weak = sorted(all_weak_topics.items(), key=lambda x: x[1], reverse=True)
    weak_list = [item[0] for item in sorted_weak[:5]]
    
    # Mastery tracker (flashcards marked mastered / total flashcards)
    total_cards = 0
    mastered_cards = 0
    for doc_id, cards in db["flashcards"].items():
        total_cards += len(cards)
        mastered_cards += sum(1 for c in cards if c.get("mastered", False))
        
    mastery_percentage = 0
    if total_cards > 0:
        mastery_percentage = (mastered_cards / total_cards) * 100
        
    return jsonify({
        "total_documents": len(db["documents"]),
        "total_quizzes": total_quizzes,
        "avg_score": round(avg_score, 1),
        "mastery_percentage": round(mastery_percentage, 1),
        "weak_topics": weak_list,
        "recent_attempts": attempts[-5:]
    })

@app.route('/api/schedule', methods=['POST'])
def generate_schedule():
    db = load_db()
    
    doc_id = request.json.get('doc_id')
    if not doc_id:
        # Get latest document if not specified
        if db["documents"]:
            doc_id = list(db["documents"].keys())[-1]
        else:
            return jsonify({"error": "Please upload a study material first before generating a schedule."}), 400
            
    doc = db["documents"][doc_id]
    content = doc["content"]
    
    # Gather weak topics from analytics
    analytics_data = json.loads(get_analytics().data.decode('utf-8'))
    weak_topics = analytics_data.get("weak_topics", [])
    
    groq_api_key = os.environ.get("GROQ_API_KEY")
    schedule_plan = None
    
    if groq_api_key:
        sys_prompt = "You are StudyAI. You generate personalized 7-day schedules. Output ONLY valid JSON array."
        prompt = (
            f"Generate a study schedule for 7 days based on the study document content and identified weak topics.\n"
            f"Weak Topics: {json.dumps(weak_topics)}\n"
            f"Document Title: '{doc['title']}'\n"
            f"Output as a valid JSON list. Each day must be an object with fields: "
            f"'day' (string day name), 'topic' (string focus subject), 'isWeakTopic' (boolean true/false if prioritizing a weak topic), "
            f"'timeSlot' (string suggested hour slot), 'tasks' (array of strings for daily study objectives), and 'tip' (string advice).\n\n"
            f"Text snippet:\n{content[:5000]}"
        )
        res = query_groq_llama(prompt, sys_prompt)
        if res:
            try:
                json_start = res.find('[')
                json_end = res.rfind(']') + 1
                if json_start != -1 and json_end != -1:
                    schedule_plan = json.loads(res[json_start:json_end])
            except Exception as e:
                print("JSON Parsing schedule failed:", e)
                
    if not schedule_plan:
        semantics = parse_text_semantics(content)
        schedule_plan = fallback_generate_schedule(semantics, weak_topics)
        
    db["schedules"][doc_id] = schedule_plan
    save_db(db)
    
    return jsonify({"schedule": schedule_plan, "doc_title": doc["title"]})

if __name__ == '__main__':
    # Running on local port 5000
    app.run(host='127.0.0.1', port=5000, debug=True)
