import os
import re
import string
from collections import Counter
import nltk

# Ensure NLTK resources are available locally, download if needed
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
    nltk.download('averaged_perceptron_tagger', quiet=True)
except Exception as e:
    print(f"NLTK Download failed: {e}. Falling back to custom dictionary filters.")

# Fallback Stopwords list to ensure offline reliability
STOPWORDS = set([
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're", "you've", "you'll", "you'd",
    'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', "she's", 'her', 'hers',
    'herself', 'it', "it's", 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
    'who', 'whom', 'this', 'that', "that'll", 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
    'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
    'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
    'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', "don't", 'should',
    "should've", 'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', "aren't", 'couldn', "couldn't",
    'didn', "didn't", 'doesn', "doesn't", 'hadn', "hadn't", 'hasn', "hasn't", 'haven', "haven't", 'isn', "isn't",
    'ma', 'mightn', "mightn't", 'mustn', "mustn't", 'needn', "needn't", 'shan', "shan't", 'shouldn', "shouldn't",
    'wasn', "wasn't", 'weren', "weren't", 'won', "won't", 'wouldn', "wouldn't", 'teacher', 'student', 'professor',
    'feedback', 'class', 'course', 'subject', 'highly'
])

# Toxic/profane words lists for auto-moderation flagging
TOXIC_KEYWORDS = [
    "useless", "worst", "garbage", "trash", "idiot", "stupid", "dumb", "hate", "sucks",
    "terrible", "crap", "bastard", "shit", "fuck", "asshole", "bitch"
]

# Keyword dictionary for Topic Categorization fallback
TOPIC_KEYWORDS = {
    "Teaching quality": ['teach', 'teacher', 'explains', 'professor', 'faculty', 'lectures', 'pedagogy', 'explanation', 'teaching', 'knowledgeable', 'doubts', 'concept', 'clarity', 'explaining', 'notes', 'help', 'doubt'],
    "Lab facilities": ['computer', 'pc', 'laboratory', 'lab', 'software', 'hardware', 'programming lab', 'machines', 'slow desktop', 'systems', 'python installed', 'linux', 'keyboards', 'mouse'],
    "Assignments": ['assignment', 'homework', 'project', 'submission', 'practical', 'deadline', 'task', 'record', 'lab record', 'viva', 'report'],
    "Exams": ['exam', 'test', 'midterm', 'final', 'grading', 'quiz', 'grade', 'marks', 'paper', 'questions', 'evaluation', 'results'],
    "Infrastructure": ['classroom', 'projector', 'wifi', 'wi-fi', 'internet', 'ac', 'air conditioning', 'canteen', 'bench', 'chair', 'building', 'room', 'toilet', 'washroom', 'fan', 'hostel', 'library', 'water', 'hygiene']
}

# Lazy loading variables for models
_sentiment_pipeline = None
_sentence_transformer_model = None
# Support disabling heavy transformers on low-memory servers (e.g. Render Free Tier 512MB RAM)
_use_transformers = os.environ.get("DISABLE_AI_TRANSFORMERS", "false").lower() != "true"

def load_ai_models():
    """Lazy load Hugging Face models to keep startup fast."""
    global _sentiment_pipeline, _sentence_transformer_model, _use_transformers
    if not _use_transformers:
        return
        
    try:
        from transformers import pipeline
        from sentence_transformers import SentenceTransformer
        
        # Load Sentiment Pipeline (DistilBERT SST-2)
        if _sentiment_pipeline is None:
            print("Loading sentiment analysis model...")
            _sentiment_pipeline = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english", device=-1)
            
        # Load Sentence Transformer Model (all-MiniLM-L6-v2)
        if _sentence_transformer_model is None:
            print("Loading sentence similarity model...")
            _sentence_transformer_model = SentenceTransformer("all-MiniLM-L6-v2")
            
        print("Hugging Face AI models loaded successfully!")
    except Exception as e:
        print(f"Could not load Hugging Face models: {e}. Falling back to Rule-Based and Keyword analysis.")
        _use_transformers = False

# Fallback Rule-Based Sentiment Analysis using VADER-like rules
def fallback_sentiment(text: str):
    """
    Very fast, local, completely offline rule-based sentiment calculation.
    """
    text_lower = text.lower()
    positive_words = ['good', 'great', 'excellent', 'love', 'helpful', 'well', 'amazing', 'satisfied', 'clears', 'clear', 'nice', 'supportive', 'best', 'appreciate', 'perfect', 'glad', 'happy']
    negative_words = ['bad', 'slow', 'poor', 'worst', 'useless', 'terrible', 'difficult', 'hard', 'stiff', 'hate', 'frustrated', 'crashes', 'crash', 'broken', 'issue', 'problem', 'delay', 'boring', 'unhelpful', 'not working']
    
    pos_count = sum(1 for w in positive_words if w in text_lower)
    neg_count = sum(1 for w in negative_words if w in text_lower)
    
    if pos_count > neg_count:
        score = 0.5 + (0.5 * (pos_count - neg_count) / (pos_count + neg_count + 1))
        return "Positive", score
    elif neg_count > pos_count:
        score = 0.5 + (0.5 * (neg_count - pos_count) / (pos_count + neg_count + 1))
        return "Negative", score
    else:
        return "Neutral", 0.5

def analyze_sentiment(text: str):
    """
    Performs sentiment analysis, using DistilBERT if available, falling back to rule-based.
    """
    if _use_transformers:
        try:
            if _sentiment_pipeline is None:
                load_ai_models()
            
            if _sentiment_pipeline:
                result = _sentiment_pipeline(text[:512])[0]
                label = result['label']  # 'POSITIVE' or 'NEGATIVE'
                score = result['score']
                
                # Format to our system standard
                sentiment = "Positive" if label == "POSITIVE" else "Negative"
                # If score is very low confidence (e.g. near 0.5), classify as Neutral
                if score < 0.55:
                    sentiment = "Neutral"
                return sentiment, score
        except Exception as e:
            print(f"Transformer sentiment analysis failed: {e}. Falling back...")
            
    return fallback_sentiment(text)

def detect_topics(text: str):
    """
    Categorizes the feedback text into: Teaching quality, Lab facilities, Assignments, Exams, Infrastructure.
    Uses semantic embedding mapping if SentenceTransformers is available, else keyword matches.
    """
    detected = []
    text_lower = text.lower()
    
    # 1. First, check keyword hits (extremely reliable for direct mentions)
    for topic, kw_list in TOPIC_KEYWORDS.items():
        for kw in kw_list:
            # Match whole words or prefixes
            if re.search(r'\b' + re.escape(kw), text_lower):
                detected.append(topic)
                break
                
    # 2. Try Semantic similarity if transformers are available
    if _use_transformers:
        try:
            if _sentence_transformer_model is None:
                load_ai_models()
                
            if _sentence_transformer_model:
                import numpy as np
                categories = list(TOPIC_KEYWORDS.keys())
                # Encode text and category names
                text_emb = _sentence_transformer_model.encode(text)
                cat_embs = _sentence_transformer_model.encode(categories)
                
                # Calculate cosine similarity
                for idx, cat_emb in enumerate(cat_embs):
                    dot_product = np.dot(text_emb, cat_emb)
                    norm_text = np.linalg.norm(text_emb)
                    norm_cat = np.linalg.norm(cat_emb)
                    similarity = dot_product / (norm_text * norm_cat)
                    
                    # If similarity is high, add category
                    if similarity > 0.42:
                        detected.append(categories[idx])
        except Exception as e:
            print(f"SentenceTransformer classification failed: {e}")
            
    # Remove duplicates
    detected = list(set(detected))
    
    # Fallback default category
    if not detected:
        # Check if the word "teacher", "lecture", or "explain" is present
        if any(w in text_lower for w in ['teacher', 'lecture', 'teaching', 'explain', 'class']):
            detected.append("Teaching quality")
        else:
            detected.append("Infrastructure") # Default fallback general environment
            
    return detected

def extract_keywords(text: str, max_count: int = 5):
    """
    Extracts the most significant nouns and adjectives for the word cloud.
    Uses NLTK pos_tag if available, falling back to simple word filtering.
    """
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    
    # Remove standard stopwords
    filtered_words = [w for w in words if w not in STOPWORDS]
    
    try:
        # Use POS tagging to extract nouns and adjectives (more meaningful words)
        tagged = nltk.pos_tag(filtered_words)
        # NN (Noun), NNS (Noun plural), JJ (Adjective)
        meaningful_words = [word for word, tag in tagged if tag in ('NN', 'NNS', 'JJ', 'JJR', 'JJS')]
        if meaningful_words:
            filtered_words = meaningful_words
    except Exception:
        # NLTK pos tagger fallback
        pass
        
    counts = Counter(filtered_words)
    return [word for word, count in counts.most_common(max_count)]

def generate_summary(text: str, sentiment: str, topics: list):
    """
    Generates a concise one-sentence summary of the student feedback.
    """
    text = text.strip()
    # If text is already short, return it
    if len(text) < 80:
        return text
        
    # Heuristics based summary
    topic_str = ", ".join(topics)
    if sentiment == "Positive":
        return f"Student expressed positive feedback regarding {topic_str}."
    elif sentiment == "Negative":
        return f"Student raised concerns and reported issues regarding {topic_str}."
    else:
        return f"Student submitted general neutral observations regarding {topic_str}."

def determine_priority_and_moderation(text: str, sentiment: str):
    """
    Flags toxic language and sets the priority level (Low, Medium, High).
    """
    text_lower = text.lower()
    
    # 1. Toxicity check
    toxic_hits = [w for w in TOXIC_KEYWORDS if re.search(r'\b' + re.escape(w) + r'\b', text_lower)]
    if len(toxic_hits) >= 2 or any(w in text_lower for w in ["shit", "fuck", "bastard", "bitch", "asshole"]):
        return "Flagged Toxic"
        
    # 2. Priority assignment
    if sentiment == "Negative":
        critical_indicators = ["broken", "crashes", "worst", "impossible", "unable", "failing", "broken", "wifi down", "no connection", "never works"]
        if any(ind in text_lower for ind in critical_indicators):
            return "High"
        return "Medium"
        
    return "Low"

def generate_recommendation(sentiment: str, topics: list):
    """
    Generates action items and faculty recommendations.
    """
    if sentiment == "Positive":
        return "Continue with the current pedagogy and resource standards. Acknowledge and motivate the faculty member."
        
    recomms = []
    for topic in topics:
        if topic == "Teaching quality":
            recomms.append("Organize a teaching mentorship review; recommend adjusting explanation pacing or scheduling extra doubt-clearing sessions.")
        elif topic == "Lab facilities":
            recomms.append("Initiate a technical review of lab hardware. Upgrade computer memory, storage drives, and resolve slow booting issues.")
        elif topic == "Assignments":
            recomms.append("Establish cross-subject alignment for assignment deadlines to reduce student workload stress. Standardize submission rubrics.")
        elif topic == "Exams":
            recomms.append("Host diagnostic reviews of assessment difficulty levels; provide clearer evaluation guidelines and preparatory question banks.")
        elif topic == "Infrastructure":
            recomms.append("Coordinate with campus maintenance to service physical amenities (classroom projectors, HVAC units, internet access points).")
            
    if recomms:
        return " | ".join(recomms)
    return "Monitor future feedback cycles for specific details."

def analyze_feedback(text: str):
    """
    Master pipeline execution.
    Takes a feedback text and returns all extracted analytics metadata.
    """
    sentiment, score = analyze_sentiment(text)
    topics = detect_topics(text)
    keywords = extract_keywords(text)
    summary = generate_summary(text, sentiment, topics)
    priority = determine_priority_and_moderation(text, sentiment)
    recommendation = generate_recommendation(sentiment, topics)
    
    return {
        "sentiment": sentiment,
        "sentiment_score": float(score),
        "categories": ", ".join(topics),
        "keywords": ", ".join(keywords),
        "summary": summary,
        "priority": priority,
        "recommendation": recommendation
    }

# Try pre-loading on module import
try:
    load_ai_models()
except Exception:
    pass

def generate_teacher_recommendations(section_ratings: dict, section_texts: dict) -> str:
    """
    Generates detailed, targeted teacher recommendations based on rating thresholds (average < 3.5)
    and negative sentiments in the section-wise text feedback.
    """
    recomms = []
    
    recommendation_map = {
        "Teaching Quality": "Improve explanation clarity, adjust teaching pace, and provide more real-world examples during lectures.",
        "Course Content": "Align syllabus topics with current industry relevance, simplify complex topics, and clarify course learning objectives.",
        "Laboratory / Practical Sessions": "Audit laboratory computers for slowness, verify sufficient lab equipment availability, and align practicals with theory.",
        "Assignments & Evaluation": "Clarify assignment requirements, ensure fairer evaluations, and provide reasonable deadlines.",
        "Infrastructure": "Resolve classroom projectors/smart board issues, coordinate Wi-Fi network fixes, and ensure cleanliness.",
        "Student Support": "Increase faculty availability for academic guidance outside of classes and coordinate technical/admin support.",
        "Overall Satisfaction": "Review overall pedagogy and course structures to meet student expectations."
    }

    for section, q_ratings in section_ratings.items():
        avg_rating = 5.0
        if q_ratings:
            # Handle float conversions safely
            avg_rating = sum(float(val) for val in q_ratings.values()) / len(q_ratings)
            
        comment = section_texts.get(section, "").strip()
        
        sentiment = "Neutral"
        if comment:
            sentiment, _ = analyze_sentiment(comment)
            
        if avg_rating < 3.5 or sentiment == "Negative":
            rec_action = recommendation_map.get(section)
            if rec_action and rec_action not in recomms:
                recomms.append(rec_action)
                
    if recomms:
        return " | ".join(recomms)
    return "Maintain current standards and continue sharing positive practices."
