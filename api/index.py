from flask import Flask, request, jsonify, send_from_directory
import cv2
import numpy as np
import base64
import os

app = Flask(__name__, static_folder='../public')

# Cargar el clasificador de rostros (Haar Cascade)
# Asegúrate de tener el archivo .xml en la raíz de tu proyecto
CASCADE_PATH = os.path.join(os.path.dirname(__file__), '..', 'haarcascade_frontalface_default.xml')
face_classifier = cv2.CascadeClassifier(CASCADE_PATH)

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

@app.route('/api/detect', methods=['POST'])
def detect_faces():
    if 'image' not in request.files:
        return jsonify({'error': 'No se proporcionó ninguna imagen'}), 400
    
    file = request.files['image']
    
    try:
        # Leer el archivo de imagen directamente en memoria (Numpy Array)
        filestr = file.read()
        npimg = np.frombuffer(filestr, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'error': 'Formato de imagen inválido'}), 400

        # Convertir a escala de grises para la detección computacional
        gray_image = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Detectar rostros
        faces = face_classifier.detectMultiScale(
            gray_image, 
            scaleFactor=1.1, 
            minNeighbors=5, 
            minSize=(40, 40)
        )
        
        # Dibujar rectángulos sobre los rostros detectados
        for (x, y, w, h) in faces:
            cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 3)
            
        # Codificar la imagen resultante a formato JPEG
        _, buffer = cv2.imencode('.jpg', img)
        
        # Convertir a base64 para enviarlo de forma limpia al frontend
        encoded_image = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            'success': True,
            'faces_detected': len(faces),
            'image': f"data:image/jpeg;base64,{encoded_image}"
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Requerido para Vercel Serverless
app.debug = False