from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import re

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── BERT Model (optional — loads if available) ─────────
emotion_classifier = None

def try_load_bert():
    """Try to load BERT model in background. Falls back to keyword-based analysis."""
    global emotion_classifier
    try:
        from transformers import pipeline
        logger.info("🔄 Attempting to load BERT emotion model...")
        emotion_classifier = pipeline(
            "text-classification",
            model="bhadresh-savani/distilbert-base-uncased-emotion",
            top_k=None
        )
        logger.info("✅ BERT emotion model loaded successfully!")
    except Exception as e:
        logger.warning(f"⚠️ BERT model not available ({type(e).__name__}). Using keyword-based analysis.")
        emotion_classifier = None

# Map model emotions to mental health context labels
EMOTION_MAP = {
    "sadness": "depressed",
    "joy": "happy",
    "love": "happy",
    "anger": "angry",
    "fear": "anxious",
    "surprise": "neutral"
}

# ─── Keyword-Based Sentiment Analysis (always works) ────
MENTAL_HEALTH_KEYWORDS = {
    "depressed": {
        "keywords": ["depressed", "depression", "hopeless", "worthless", "empty", "numb", "sad", "miserable",
                      "crying", "cry", "tears", "grief", "mourning", "heartbroken", "devastated", "despair",
                      "gloomy", "unhappy", "sorrow", "melancholy", "down", "low", "dark place", "giving up"],
        "weight": 0.85
    },
    "anxious": {
        "keywords": ["anxious", "anxiety", "worry", "worried", "panic", "nervous", "fear", "scared", "dread",
                      "restless", "uneasy", "tense", "overthinking", "racing thoughts", "can't breathe",
                      "heart racing", "shaking", "trembling", "phobia", "terrified", "frightened"],
        "weight": 0.82
    },
    "stressed": {
        "keywords": ["stress", "stressed", "overwhelm", "overwhelmed", "burnout", "exhausted", "overwork",
                      "pressure", "deadline", "too much", "can't cope", "breaking point", "tired",
                      "worn out", "drained", "swamped", "struggling", "burden", "overloaded"],
        "weight": 0.80
    },
    "angry": {
        "keywords": ["angry", "furious", "rage", "frustrated", "irritated", "mad", "annoyed", "hate",
                      "resentment", "bitter", "hostile", "aggressive", "outraged", "livid", "fuming",
                      "pissed", "infuriated"],
        "weight": 0.78
    },
    "lonely": {
        "keywords": ["lonely", "alone", "isolated", "no friends", "nobody cares", "abandoned", "rejected",
                      "left out", "invisible", "ignored", "disconnected", "no one understands", "solitude",
                      "friendless", "unwanted", "excluded"],
        "weight": 0.80
    },
    "happy": {
        "keywords": ["happy", "joy", "grateful", "thankful", "excited", "wonderful", "amazing", "great",
                      "fantastic", "blessed", "cheerful", "delighted", "optimistic", "hopeful", "content",
                      "peaceful", "calm", "relaxed", "better", "improving", "good", "love", "loving"],
        "weight": 0.75
    }
}


def keyword_analyze(text):
    """Analyze sentiment purely based on keyword matching."""
    text_lower = text.lower()
    best_label = "neutral"
    best_score = 0
    best_match_count = 0

    for label, data in MENTAL_HEALTH_KEYWORDS.items():
        matches = sum(1 for kw in data["keywords"] if kw in text_lower)
        if matches > best_match_count:
            best_match_count = matches
            best_label = label
            # Scale confidence by number of keyword matches
            best_score = min(data["weight"] + (matches - 1) * 0.05, 0.95)

    if best_match_count == 0:
        # Check for question marks or neutral patterns
        if "?" in text:
            return {"sentiment": "neutral", "confidence": 0.6}
        return {"sentiment": "neutral", "confidence": 0.55}

    return {"sentiment": best_label, "confidence": round(best_score, 4)}


def analyze_sentiment(text):
    """Analyze text sentiment using BERT (if available) + keyword enhancement."""
    # Always get keyword result as baseline
    keyword_result = keyword_analyze(text)

    # If BERT is not available, return keyword result directly
    if not emotion_classifier:
        return keyword_result

    try:
        # Get BERT predictions
        results = emotion_classifier(text[:512])
        predictions = results[0] if results else []

        if predictions:
            top_pred = max(predictions, key=lambda x: x['score'])
            bert_label = EMOTION_MAP.get(top_pred['label'], "neutral")
            bert_score = top_pred['score']
        else:
            return keyword_result

        # Combine: keywords override BERT if strong match
        if keyword_result["sentiment"] != "neutral" and keyword_result["confidence"] > 0.8:
            return keyword_result
        elif keyword_result["sentiment"] != "neutral" and bert_score < 0.6:
            return keyword_result
        else:
            return {"sentiment": bert_label, "confidence": round(bert_score, 4)}

    except Exception as e:
        logger.error(f"BERT analysis error: {e}")
        return keyword_result


@app.route('/predict', methods=['POST'])
def predict():
    """Predict sentiment from text input."""
    data = request.get_json()

    if not data or 'text' not in data:
        return jsonify({"error": "Missing 'text' field in request body."}), 400

    text = data['text'].strip()
    if not text:
        return jsonify({"error": "Text cannot be empty."}), 400

    result = analyze_sentiment(text)
    logger.info(f"📊 Sentiment: {result['sentiment']} ({result['confidence']:.2%}) | Text: {text[:80]}...")

    return jsonify(result)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "model_loaded": emotion_classifier is not None,
        "service": "MindfulChat Sentiment Analysis (BERT)"
    })


if __name__ == '__main__':
    import threading
    logger.info("🧠 Starting MindfulChat Sentiment Service on port 5001...")
    logger.info("📝 Using keyword-based analysis (instant). BERT model loading in background...")

    # Try loading BERT in background (won't block server startup)
    bert_thread = threading.Thread(target=try_load_bert, daemon=True)
    bert_thread.start()

    app.run(host='0.0.0.0', port=5001, debug=False)

