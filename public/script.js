const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const btnProcess = document.getElementById('btnProcess');
const imgOriginal = document.getElementById('imgOriginal');
const imgResult = document.getElementById('imgResult');
const loader = document.getElementById('loader');
const metricsZone = document.getElementById('metricsZone');
const faceCount = document.getElementById('faceCount');

let selectedFile = null;

// Manejo del Arrastrar y Soltar (Drag & Drop)
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    }, false);
});

dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if(files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if(e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen válido.');
        return;
    }
    selectedFile = file;
    btnProcess.disabled = false;
    
    // Mostrar preview original
    const reader = new FileReader();
    reader.onload = (e) => {
        imgOriginal.src = e.target.result;
        imgOriginal.hidden = false;
        
        // Limpiar ejecuciones previas
        imgResult.hidden = true;
        metricsZone.hidden = true;
    };
    reader.readAsDataURL(file);
}

// Envío AJAX al Servidor Flask en Vercel
btnProcess.addEventListener('click', async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('image', selectedFile);

    // Actualizar UI para el estado "Cargando..."
    loader.hidden = false;
    imgResult.hidden = true;
    btnProcess.disabled = true;

    try {
        const response = await fetch('/api/detect', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.success) {
            imgResult.src = data.image;
            imgResult.hidden = false;
            faceCount.textContent = data.faces_detected;
            metricsZone.hidden = false;
        } else {
            alert('Error en el análisis: ' + (data.error || 'Desconocido'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('No se pudo conectar con el servidor de análisis.');
    } finally {
        loader.hidden = true;
        btnProcess.disabled = false;
    }
});