// Elementos comunes de la interfaz
const loader = document.getElementById('loader');
const imgResult = document.getElementById('imgResult');
const metricsZone = document.getElementById('metricsZone');
const faceCount = document.getElementById('faceCount');

// Elementos Modo Archivo
const sectionUpload = document.getElementById('sectionUpload');
const btnModeUpload = document.getElementById('btnModeUpload');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const btnProcess = document.getElementById('btnProcess');
const imgOriginal = document.getElementById('imgOriginal');
const boxOriginal = document.getElementById('boxOriginal');

// Elementos Modo Cámara
const sectionCamera = document.getElementById('sectionCamera');
const btnModeCamera = document.getElementById('btnModeCamera');
const video = document.getElementById('webcam');
const canvas = document.getElementById('canvasFrame');
const btnStartCamera = document.getElementById('btnStartCamera');
const btnStopCamera = document.getElementById('btnStopCamera');

let selectedFile = null;
let streamInstance = null;
let streamInterval = null;
let isStreaming = false;

// --- CONTROL DE INTERFAZ (CONMUTACIÓN DE MODOS) ---
btnModeUpload.addEventListener('click', () => {
    switchMode('upload');
});

btnModeCamera.addEventListener('click', () => {
    switchMode('camera');
});

function switchMode(mode) {
    if (mode === 'upload') {
        btnModeUpload.classList.add('active');
        btnModeCamera.classList.remove('active');
        sectionUpload.hidden = false;
        sectionCamera.hidden = true;
        boxOriginal.hidden = false;
        stopCameraFlow();
    } else {
        btnModeCamera.classList.add('active');
        btnModeUpload.classList.remove('active');
        sectionCamera.hidden = false;
        sectionUpload.hidden = true;
        boxOriginal.hidden = true; // Ocultamos el box original para dar espacio al streaming del server
        imgResult.hidden = true;
        metricsZone.hidden = true;
    }
}

// --- LÓGICA MODO 1: SUBIR ARCHIVO (PROCESAMIENTO INDIVIDUAL) ---
// (Mantiene la misma lógica que ya tenías implementada)
['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
});
['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
});
dropZone.addEventListener('drop', (e) => { handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', (e) => { handleFile(e.target.files[0]); });

function handleFile(file) {
    if (file && file.type.startsWith('image/')) {
        selectedFile = file;
        btnProcess.disabled = false;
        const reader = new FileReader();
        reader.onload = (e) => {
            imgOriginal.src = e.target.result;
            imgOriginal.hidden = false;
            imgResult.hidden = true;
            metricsZone.hidden = true;
        };
        reader.readAsDataURL(file);
    }
}

btnProcess.addEventListener('click', async () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('image', selectedFile);
    
    loader.hidden = false;
    imgResult.hidden = true;
    
    await sendFrameToBackend(formData);
    loader.hidden = true;
});


// --- LÓGICA MODO 2: TRANSMISIÓN DE CÁMARA (TIEMPO REAL) ---
btnStartCamera.addEventListener('click', async () => {
    try {
        // Solicitar acceso a la webcam del dispositivo
        streamInstance = await navigator.mediaDevices.getUserMedia({
            video: { width: 400, height: 300, facingMode: "user" },
            audio: false
        });
        
        video.srcObject = streamInstance;
        btnStartCamera.disabled = true;
        btnStopCamera.disabled = false;
        isStreaming = true;
        imgResult.hidden = false;

        // Iniciar bucle de procesamiento: Capturar y enviar frame cada 600ms
        // Se define este tiempo para mitigar la latencia de red y no saturar las Serverless Functions
        streamInterval = setInterval(processCameraFrame, 600);

    } catch (err) {
        console.error("Error al acceder a la cámara: ", err);
        alert("No se pudo acceder a la cámara. Asegúrate de otorgar los permisos en tu navegador.");
    }
});

btnStopCamera.addEventListener('click', stopCameraFlow);

function stopCameraFlow() {
    clearInterval(streamInterval);
    isStreaming = false;
    
    if (streamInstance) {
        streamInstance.getTracks().forEach(track => track.stop());
    }
    
    video.srcObject = null;
    btnStartCamera.disabled = false;
    btnStopCamera.disabled = true;
    loader.hidden = true;
}

async function processCameraFrame() {
    if (!isStreaming) return;

    const ctx = canvas.getContext('2d');
    // Pintar el frame de video actual en el canvas oculto
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convertir el canvas a un Blob de tipo JPEG
    canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        const formData = new FormData();
        formData.append('image', blob, 'frame.jpg');
        
        await sendFrameToBackend(formData);
    }, 'image/jpeg', 0.7); // Compresión al 70% para optimizar transferencia de red
}


// --- CENTRALIZACIÓN DEL ENVÍO AL BACKEND (CONEXIÓN CON API VERCEL) ---
async function sendFrameToBackend(formData) {
    try {
        const response = await fetch('/api/detect', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) return;

        const data = await response.json();

        if (data.success) {
            // Renderizar la imagen procesada devuelta por OpenCV en Base64
            imgResult.src = data.image;
            faceCount.textContent = data.faces_detected;
            metricsZone.hidden = false;
        }
    } catch (error) {
        console.error("Error en el envío de datos analíticos:", error);
    }
}