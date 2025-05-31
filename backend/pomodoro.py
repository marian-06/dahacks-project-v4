from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import threading
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Initialize OpenAI client only if API key is available
client = None
if os.getenv('OPENAI_API_KEY'):
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Pomodoro timer state
pomodoro_state = {
    "is_active": False,
    "is_break": False,
    "start_time": None,
    "timer_thread": None
}

def reset_pomodoro_state():
    pomodoro_state["is_active"] = False
    pomodoro_state["is_break"] = False
    pomodoro_state["start_time"] = None
    pomodoro_state["timer_thread"] = None

def pomodoro_timer():
    while pomodoro_state["is_active"]:
        if not pomodoro_state["is_break"]:
            # Work period (25 minutes)
            time.sleep(25 * 60)
            if pomodoro_state["is_active"]:
                pomodoro_state["is_break"] = True
                print("Time's up! Take a break.")
        else:
            # Break period (5 minutes)
            time.sleep(5 * 60)
            if pomodoro_state["is_active"]:
                pomodoro_state["is_break"] = False
                print("Break's over! Back to work.")

@app.route("/pomodoro/start", methods=["POST"])
def start_pomodoro():
    if not pomodoro_state["is_active"]:
        pomodoro_state["is_active"] = True
        pomodoro_state["start_time"] = datetime.now()
        pomodoro_state["timer_thread"] = threading.Thread(target=pomodoro_timer)
        pomodoro_state["timer_thread"].start()
        return jsonify({"message": "Pomodoro timer started", "status": "running"})
    return jsonify({"message": "Pomodoro timer is already running", "status": "running"})

@app.route("/pomodoro/stop", methods=["POST"])
def stop_pomodoro():
    if pomodoro_state["is_active"]:
        reset_pomodoro_state()
        return jsonify({"message": "Pomodoro timer stopped", "status": "stopped"})
    return jsonify({"message": "Pomodoro timer is not running", "status": "stopped"})

@app.route("/pomodoro/status", methods=["GET"])
def get_pomodoro_status():
    status = {
        "is_active": pomodoro_state["is_active"],
        "is_break": pomodoro_state["is_break"],
        "start_time": pomodoro_state["start_time"].isoformat() if pomodoro_state["start_time"] else None
    }
    return jsonify(status)

@app.route("/analyze-explanation", methods=["POST"])
def analyze_explanation():
    if not client:
        return jsonify({
            "error": "OpenAI API key not configured. Please add OPENAI_API_KEY to .env file for full functionality."
        }), 503
        
    data = request.json
    topic = data.get("topic")
    explanation = data.get("explanation")

    if not topic or not explanation:
        return jsonify({"error": "Missing topic or explanation"}), 400

    try:
        # First, analyze the explanation for accuracy and understanding
        analysis_response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": """You are an expert tutor using the Feynman Technique to help students learn. 
                Analyze the student's explanation of a topic and identify:
                1. Any misconceptions or errors
                2. Gaps in understanding
                3. Areas where the explanation could be clearer
                4. Whether they truly understand the concept
                
                Provide specific, constructive feedback that will help them improve their understanding."""},
                {"role": "user", "content": f"Topic: {topic}\n\nStudent's Explanation: {explanation}"}
            ]
        )
        
        analysis = analysis_response.choices[0].message.content

        # Generate flashcards based on the gaps identified
        flashcards_response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": """Based on the student's explanation and the gaps in their understanding,
                create targeted flashcards that will help them better understand the concept.
                Format each flashcard as a question and answer pair."""},
                {"role": "user", "content": f"Topic: {topic}\n\nStudent's Explanation: {explanation}\n\nAnalysis: {analysis}"}
            ]
        )

        # Generate specific suggestions for improvement
        suggestions_response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": """Based on the analysis, provide specific suggestions for how the student
                can improve their explanation next time. Focus on actionable steps they can take."""},
                {"role": "user", "content": f"Analysis: {analysis}"}
            ]
        )

        # Process the responses
        corrections = [line.strip() for line in analysis.split('\n') if line.strip()]
        
        # Parse flashcards from the response
        flashcards_text = flashcards_response.choices[0].message.content
        flashcards = []
        current_q = None
        
        for line in flashcards_text.split('\n'):
            if line.startswith('Q:'):
                current_q = line[2:].strip()
            elif line.startswith('A:') and current_q:
                flashcards.append({
                    'question': current_q,
                    'answer': line[2:].strip()
                })
                current_q = None

        # Process suggestions
        suggestions = [
            s.strip() for s in suggestions_response.choices[0].message.content.split('\n')
            if s.strip() and not s.strip().startswith(('Q:', 'A:'))
        ]

        # Determine if the student has understood the concept
        understood = 'good understanding' in analysis.lower() or 'well explained' in analysis.lower()

        return jsonify({
            'corrections': corrections,
            'flashcards': flashcards,
            'understood': understood,
            'suggestions': suggestions
        })

    except Exception as e:
        print(f"Error analyzing explanation: {str(e)}")
        return jsonify({"error": "Failed to analyze explanation"}), 500

if __name__ == "__main__":
    print("Starting Flask server on http://localhost:5001")
    app.run(host="0.0.0.0", port=5001, debug=True) 