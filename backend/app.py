from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import pdfplumber
from gtts import gTTS
from openai import OpenAI
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph
import tempfile
from dotenv import load_dotenv
import time
import threading
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

app = Flask(__name__)
# Configure CORS to allow requests from frontend
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000"],  # Next.js default port
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Pomodoro timer state
pomodoro_state = {
    'is_active': False,
    'is_break': False,
    'start_time': None,
    'timer_thread': None
}

def reset_pomodoro_state():
    pomodoro_state['is_active'] = False
    pomodoro_state['is_break'] = False
    pomodoro_state['start_time'] = None
    pomodoro_state['timer_thread'] = None

def pomodoro_timer():
    while pomodoro_state['is_active']:
        if not pomodoro_state['is_break']:
            # Work period (25 minutes)
            time.sleep(25 * 60)
            if pomodoro_state['is_active']:
                pomodoro_state['is_break'] = True
                print("Time's up! Take a break.")
        else:
            # Break period (5 minutes)
            time.sleep(5 * 60)
            if pomodoro_state['is_active']:
                pomodoro_state['is_break'] = False
                print("Break's over! Back to work.")

@app.route('/pomodoro/start', methods=['POST'])
def start_pomodoro():
    if not pomodoro_state['is_active']:
        pomodoro_state['is_active'] = True
        pomodoro_state['start_time'] = datetime.now()
        pomodoro_state['timer_thread'] = threading.Thread(target=pomodoro_timer)
        pomodoro_state['timer_thread'].start()
        return jsonify({'message': 'Pomodoro timer started', 'status': 'running'})
    return jsonify({'message': 'Pomodoro timer is already running', 'status': 'running'})

@app.route('/pomodoro/stop', methods=['POST'])
def stop_pomodoro():
    if pomodoro_state['is_active']:
        reset_pomodoro_state()
        return jsonify({'message': 'Pomodoro timer stopped', 'status': 'stopped'})
    return jsonify({'message': 'Pomodoro timer is not running', 'status': 'stopped'})

@app.route('/pomodoro/status', methods=['GET'])
def get_pomodoro_status():
    status = {
        'is_active': pomodoro_state['is_active'],
        'is_break': pomodoro_state['is_break'],
        'start_time': pomodoro_state['start_time'].isoformat() if pomodoro_state['start_time'] else None
    }
    return jsonify(status)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Ensure upload directory exists
UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

def extract_text_from_pdf(file_path):
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text += page.extract_text() or ""
    return text

def generate_content_with_openai(text):
    # Generate summary
    summary_response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a helpful study assistant. Create a concise summary of the following text."},
            {"role": "user", "content": text}
        ]
    )
    summary = summary_response.choices[0].message.content

    # Generate flashcards
    flashcards_response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "Create 5 question-answer flashcards from the following text. Format as Q1: [question] A1: [answer]"},
            {"role": "user", "content": text}
        ]
    )
    flashcards = flashcards_response.choices[0].message.content

    return summary, flashcards

def create_pdf(summary, flashcards, output_path):
    doc = SimpleDocTemplate(output_path, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    # Add title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30
    )
    story.append(Paragraph("Study Guide", title_style))

    # Add summary section
    story.append(Paragraph("Summary", styles['Heading2']))
    story.append(Paragraph(summary, styles['Normal']))
    story.append(Paragraph("<br/><br/>", styles['Normal']))

    # Add flashcards section
    story.append(Paragraph("Flashcards", styles['Heading2']))
    story.append(Paragraph(flashcards.replace('\n', '<br/>'), styles['Normal']))

    doc.build(story)

def create_audio(text, output_path):
    tts = gTTS(text=text, lang='en')
    tts.save(output_path)

@app.route('/process', methods=['POST'])
def process_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Save uploaded file
    temp_dir = tempfile.mkdtemp()
    input_path = os.path.join(temp_dir, file.filename)
    file.save(input_path)

    try:
        # Extract text from PDF
        text = extract_text_from_pdf(input_path) if file.filename.endswith('.pdf') else file.read().decode('utf-8')

        # Generate content using OpenAI
        summary, flashcards = generate_content_with_openai(text)

        # Create output files
        pdf_output = os.path.join(OUTPUT_FOLDER, 'study_guide.pdf')
        audio_output = os.path.join(OUTPUT_FOLDER, 'summary_audio.mp3')

        create_pdf(summary, flashcards, pdf_output)
        create_audio(summary, audio_output)

        return jsonify({
            'message': 'Files processed successfully',
            'pdf_url': '/download/pdf',
            'audio_url': '/download/audio'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download/<file_type>')
def download_file(file_type):
    if file_type == 'pdf':
        return send_file(os.path.join(OUTPUT_FOLDER, 'study_guide.pdf'))
    elif file_type == 'audio':
        return send_file(os.path.join(OUTPUT_FOLDER, 'summary_audio.mp3'))
    return jsonify({'error': 'Invalid file type'}), 400

if __name__ == '__main__':
    print("Starting Flask server on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True) 


