from flask import Flask, render_template, request, jsonify
import speech_recognition as sr
import os
import base64
import uuid
import json

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
TRANSCRIPTIONS_FILE = 'transcriptions.json'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Initialize the transcriptions file if it doesn't exist
if not os.path.exists(TRANSCRIPTIONS_FILE):
    with open(TRANSCRIPTIONS_FILE, 'w') as f:
        json.dump([], f)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload():
    if 'audio_data' not in request.form:
        return 'No audio data found', 400

    audio_data = request.form['audio_data']
    if ',' in audio_data:
        audio_data = audio_data.split(',')[1]  # Extract base64 part if it exists
    try:
        audio_data = base64.b64decode(audio_data)
    except base64.binascii.Error as e:
        return f'Error decoding audio data: {e}', 400

    unique_id = str(uuid.uuid4())
    webm_filename = f'{unique_id}.webm'
    wav_filename = f'{unique_id}.wav'
    webm_path = os.path.join(app.config['UPLOAD_FOLDER'], webm_filename)
    wav_path = os.path.join(app.config['UPLOAD_FOLDER'], wav_filename)

    with open(webm_path, 'wb') as f:
        f.write(audio_data)

    # Convert WebM to WAV using ffmpeg
    command = f'ffmpeg -y -i {webm_path} -ar 16000 -ac 1 {wav_path}'
    os.system(command)

    return jsonify({'filename': wav_filename}), 200

@app.route('/recognize/<filename>', methods=['POST'])
def recognize(filename):
    audio_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    recognizer = sr.Recognizer()
    data = request.get_json()
    language = data.get('language', 'en-US')  # Default to English if not provided
    try:
        with sr.AudioFile(audio_path) as source:
            audio = recognizer.record(source)
        try:
            transcription = recognizer.recognize_google(audio, language=language)
            save_transcription(transcription)
            return jsonify({'transcription': transcription}), 200
        except sr.UnknownValueError:
            return jsonify({'error': 'Google Speech Recognition could not understand the audio'}), 400
        except sr.RequestError as e:
            return jsonify({'error': f'Could not request results from Google Speech Recognition service; {e}'}), 500
    except ValueError as e:
        return jsonify({'error': f'Audio file could not be processed: {e}'}), 400

@app.route('/transcriptions', methods=['GET'])
def get_transcriptions():
    with open(TRANSCRIPTIONS_FILE, 'r') as f:
        transcriptions = json.load(f)
    return jsonify(transcriptions)

def save_transcription(transcription):
    with open(TRANSCRIPTIONS_FILE, 'r') as f:
        transcriptions = json.load(f)
    transcriptions.append(transcription)
    with open(TRANSCRIPTIONS_FILE, 'w') as f:
        json.dump(transcriptions, f)

if __name__ == '__main__':
    app.run(debug=True)


















