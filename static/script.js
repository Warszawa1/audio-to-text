document.addEventListener('DOMContentLoaded', function() {
    const startButton = document.getElementById('start-recording');
    const stopButton = document.getElementById('stop-recording');
    const recognizeButton = document.getElementById('recognize-audio');
    const toggleTranscriptionsButton = document.getElementById('toggle-transcriptions');
    const audioPlayer = document.getElementById('audio-player');
    const transcriptionsDiv = document.getElementById('transcriptions');
    const languageSelect = document.getElementById('language-select');

    let mediaRecorder;
    let audioChunks = [];
    let audioFilename;
    let transcriptions = [];

    startButton.addEventListener('click', () => {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                mediaRecorder.start();

                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = () => {
                        const base64AudioMessage = reader.result;

                        fetch('/upload', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                            },
                            body: `audio_data=${encodeURIComponent(base64AudioMessage)}`,
                        })
                        .then(response => response.json())
                        .then(data => {
                            audioFilename = data.filename;
                            audioPlayer.src = `/uploads/${audioFilename}`;
                            audioPlayer.load();
                            recognizeButton.disabled = false;
                            audioChunks = []; // Clear audioChunks after upload
                        })
                        .catch(error => {
                            console.error('Error uploading audio:', error);
                        });
                    };
                };

                startButton.disabled = true;
                stopButton.disabled = false;
            })
            .catch(error => {
                console.error('Error accessing microphone:', error);
            });
    });

    stopButton.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
        startButton.disabled = false;
        stopButton.disabled = true;
    });

    recognizeButton.addEventListener('click', () => {
        const selectedLanguage = languageSelect.value;
        fetch(`/recognize/${audioFilename}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ language: selectedLanguage })
        })
        .then(response => response.json())
        .then(data => {
            const transcription = document.createElement('p');
            if (data.transcription) {
                transcription.innerText = `Transcription: ${data.transcription}`;
                transcriptions.push(data.transcription);
            } else if (data.error) {
                transcription.innerText = `Error: ${data.error}`;
            }
            transcriptionsDiv.appendChild(transcription);
            transcriptionsDiv.style.display = 'block';  // Show the transcriptions div
        })
        .catch(error => {
            console.error('Error recognizing audio:', error);
        });
    });

    toggleTranscriptionsButton.addEventListener('click', () => {
        if (transcriptionsDiv.style.display === 'none') {
            fetch('/transcriptions')
                .then(response => response.json())
                .then(data => {
                    transcriptionsDiv.innerHTML = '';  // Clear current transcriptions
                    data.forEach(transcription => {
                        const transcriptionElement = document.createElement('p');
                        transcriptionElement.innerText = transcription;
                        transcriptionsDiv.appendChild(transcriptionElement);
                    });
                    transcriptionsDiv.style.display = 'block';
                    toggleTranscriptionsButton.innerText = 'Hide Previous Transcriptions';
                })
                .catch(error => {
                    console.error('Error fetching transcriptions:', error);
                });
        } else {
            transcriptionsDiv.style.display = 'none';
            toggleTranscriptionsButton.innerText = 'Show Previous Transcriptions';
        }
    });
});




