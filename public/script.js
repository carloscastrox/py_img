// Elementos comunes de la interfaz
const loader = document.getElementById("loader");
const imgResult = document.getElementById("imgResult");
const metricsZone = document.getElementById("metricsZone");
const faceCount = document.getElementById("faceCount");

// Elementos Modo Archivo
const sectionUpload = document.getElementById("sectionUpload");
const btnModeUpload = document.getElementById("btnModeUpload");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const btnProcess = document.getElementById("btnProcess");
const imgOriginal = document.getElementById("imgOriginal");
const boxOriginal = document.getElementById("boxOriginal");

// Elementos Modo Cámara
const sectionCamera = document.getElementById("sectionCamera");
const btnModeCamera = document.getElementById("btnModeCamera");
const video = document.getElementById("webcam");
const canvas = document.getElementById("canvasFrame");

// Nuevas referencias y variables de estado para la cámara
const btnStartCamera = document.getElementById("btnStartCamera");
const btnStopCamera = document.getElementById("btnStopCamera");
const btnToggleCamera = document.getElementById("btnToggleCamera"); // Nuevo botón

let selectedFile = null;
let streamInstance = null;
let streamInterval = null;
let isStreaming = false;

// --- CONTROL DE INTERFAZ (CONMUTACIÓN DE MODOS) ---
btnModeUpload.addEventListener("click", () => {
  switchMode("upload");
});

btnModeCamera.addEventListener("click", () => {
  switchMode("camera");
});

function switchMode(mode) {
  if (mode === "upload") {
    btnModeUpload.classList.add("active");
    btnModeCamera.classList.remove("active");
    sectionUpload.hidden = false;
    sectionCamera.hidden = true;
    boxOriginal.hidden = false;
    stopCameraFlow();
  } else {
    btnModeCamera.classList.add("active");
    btnModeUpload.classList.remove("active");
    sectionCamera.hidden = false;
    sectionUpload.hidden = true;
    boxOriginal.hidden = true; // Ocultamos el box original para dar espacio al streaming del server
    imgResult.hidden = true;
    metricsZone.hidden = true;
  }
}

// --- LÓGICA MODO 1: SUBIR ARCHIVO (PROCESAMIENTO INDIVIDUAL) ---
// (Mantiene la misma lógica que ya tenías implementada)
["dragenter", "dragover"].forEach((name) => {
  dropZone.addEventListener(name, (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
});
["dragleave", "drop"].forEach((name) => {
  dropZone.addEventListener(name, (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
  });
});
dropZone.addEventListener("drop", (e) => {
  handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", (e) => {
  handleFile(e.target.files[0]);
});

function handleFile(file) {
  if (file && file.type.startsWith("image/")) {
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

btnProcess.addEventListener("click", async () => {
  if (!selectedFile) return;
  const formData = new FormData();
  formData.append("image", selectedFile);

  loader.hidden = false;
  imgResult.hidden = true;

  await sendFrameToBackend(formData);
  loader.hidden = true;
});

// --- LÓGICA MODO 2: TRANSMISIÓN DE CÁMARA (TIEMPO REAL) ---
btnStartCamera.addEventListener("click", async () => {
  try {
    // Solicitar acceso a la webcam del dispositivo
    streamInstance = await navigator.mediaDevices.getUserMedia({
      video: { width: 400, height: 300, facingMode: "user" },
      audio: false,
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
    alert(
      "No se pudo acceder a la cámara. Asegúrate de otorgar los permisos en tu navegador.",
    );
  }
});

btnStopCamera.addEventListener("click", stopCameraFlow);

function stopCameraFlow() {
  clearInterval(streamInterval);
  isStreaming = false;

  if (streamInstance) {
    streamInstance.getTracks().forEach((track) => track.stop());
  }

  video.srcObject = null;
  btnStartCamera.disabled = false;
  btnStopCamera.disabled = true;
  loader.hidden = true;
}

// "user" = Cámara frontal | "environment" = Cámara trasera
let currentFacingMode = "user";

// --- EVENTO PARA CAMBIAR DE CÁMARA ---
btnToggleCamera.addEventListener("click", async () => {
  // Alternar entre frontal y trasera
  currentFacingMode = currentFacingMode === "user" ? "environment" : "user";

  // Si la cámara ya está activa, reiniciamos el flujo con el nuevo sensor de forma transparente
  if (isStreaming) {
    // Pausamos temporalmente el envío de frames
    clearInterval(streamInterval);

    // Apagamos el stream actual de manera interna sin resetear la interfaz completa
    if (streamInstance) {
      streamInstance.getTracks().forEach((track) => track.stop());
    }

    // Volvemos a arrancar la cámara con el nuevo facingMode
    await initCamera();
  }
});

// --- ENCENDER CÁMARA ---
btnStartCamera.addEventListener("click", async () => {
  await initCamera();
  btnStartCamera.disabled = true;
  btnStopCamera.disabled = false;
  btnToggleCamera.style.display = "inline-block"; // Mostrar botón de cambiar cámara
});

// --- FUNCIÓN CENTRALIZADA PARA INICIALIZAR EL SENSOR ---
async function initCamera() {
  try {
    // Solicitamos el stream usando la variable dinámica currentFacingMode
    streamInstance = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 400 },
        height: { ideal: 300 },
        facingMode: currentFacingMode,
      },
      audio: false,
    });

    video.srcObject = streamInstance;
    isStreaming = true;
    imgResult.hidden = false;

    // Reiniciar el bucle asíncrono de envío de fotogramas a Vercel (cada 600ms)
    streamInterval = setInterval(processCameraFrame, 600);
  } catch (err) {
    console.error(
      "Error al acceder al sensor seleccionado (" + currentFacingMode + "):",
      err,
    );
    alert(
      "No se pudo acceder a este sensor de cámara. Es posible que el dispositivo no cuente con él o falten permisos.",
    );

    // Revertir el estado si falla
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
  }
}

// --- APAGAR CÁMARA ---
btnStopCamera.addEventListener("click", stopCameraFlow);

function stopCameraFlow() {
  clearInterval(streamInterval);
  isStreaming = false;

  if (streamInstance) {
    streamInstance.getTracks().forEach((track) => track.stop());
  }

  video.srcObject = null;
  btnStartCamera.disabled = false;
  btnStopCamera.disabled = true;
  btnToggleCamera.style.display = "none"; // Ocultar botón de cambiar cámara
  loader.hidden = true;
}

async function processCameraFrame() {
  if (!isStreaming) return;

  const ctx = canvas.getContext("2d");
  // Pintar el frame de video actual en el canvas oculto
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Convertir el canvas a un Blob de tipo JPEG
  canvas.toBlob(
    async (blob) => {
      if (!blob) return;

      const formData = new FormData();
      formData.append("image", blob, "frame.jpg");

      await sendFrameToBackend(formData);
    },
    "image/jpeg",
    0.7,
  ); // Compresión al 70% para optimizar transferencia de red
}

// --- CENTRALIZACIÓN DEL ENVÍO AL BACKEND (CONEXIÓN CON API VERCEL) ---
// ==========================================
// 1. REFERENCIAS A ELEMENTOS COMUNES
// ==========================================
const loader = document.getElementById("loader");
const imgResult = document.getElementById("imgResult");
const metricsZone = document.getElementById("metricsZone");
const faceCount = document.getElementById("faceCount");

// ==========================================
// 2. REFERENCIAS MODO ARCHIVO (UPLOAD)
// ==========================================
const sectionUpload = document.getElementById("sectionUpload");
const btnModeUpload = document.getElementById("btnModeUpload");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const btnProcess = document.getElementById("btnProcess");
const imgOriginal = document.getElementById("imgOriginal");
const boxOriginal = document.getElementById("boxOriginal");

// ==========================================
// 3. REFERENCIAS MODO CÁMARA (WEBCAM)
// ==========================================
const sectionCamera = document.getElementById("sectionCamera");
const btnModeCamera = document.getElementById("btnModeCamera");
const video = document.getElementById("webcam");
const canvas = document.getElementById("canvasFrame");
const btnStartCamera = document.getElementById("btnStartCamera");
const btnStopCamera = document.getElementById("btnStopCamera");
const btnToggleCamera = document.getElementById("btnToggleCamera");

// ==========================================
// 4. VARIABLES DE ESTADO
// ==========================================
let selectedFile = null;
let streamInstance = null;
let streamInterval = null;
let isStreaming = false;
let currentFacingMode = "user"; // "user" = frontal | "environment" = trasera

// ==========================================
// 5. CONTROL DE INTERFAZ (CONMUTACIÓN DE MODOS)
// ==========================================
btnModeUpload.addEventListener("click", () => switchMode("upload"));
btnModeCamera.addEventListener("click", () => switchMode("camera"));

function switchMode(mode) {
  if (mode === "upload") {
    // Configuración visual de botones (Bootstrap)
    btnModeUpload.classList.add("active");
    btnModeCamera.classList.remove("active");

    // Mostrar y ocultar secciones con clases nativas d-none
    sectionUpload.classList.remove("d-none");
    sectionCamera.classList.add("d-none");
    boxOriginal.classList.remove("d-none");

    // Detener flujos activos de cámara
    stopCameraFlow();
  } else {
    // Configuración visual de botones (Bootstrap)
    btnModeCamera.classList.add("active");
    btnModeUpload.classList.remove("active");

    // Mostrar y ocultar secciones
    sectionCamera.classList.remove("d-none");
    sectionUpload.classList.add("d-none");
    boxOriginal.classList.add("d-none"); // Ocultamos el box izquierdo para centrar el resultado

    // Limpiar vistas de análisis anteriores
    imgResult.classList.add("d-none");
    metricsZone.classList.add("d-none");
  }
}

// ==========================================
// 6. LÓGICA MODO ARCHIVO (DRAG & DROP)
// ==========================================
["dragenter", "dragover"].forEach((name) => {
  dropZone.addEventListener(name, (e) => {
    e.preventDefault();
    dropZone.classList.add("bg-primary", "bg-opacity-10"); // Efecto visual Bootstrap
  });
});

["dragleave", "drop"].forEach((name) => {
  dropZone.addEventListener(name, (e) => {
    e.preventDefault();
    dropZone.classList.remove("bg-primary", "bg-opacity-10");
  });
});

dropZone.addEventListener("drop", (e) => {
  handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener("change", (e) => {
  handleFile(e.target.files[0]);
});

function handleFile(file) {
  if (file && file.type.startsWith("image/")) {
    selectedFile = file;
    btnProcess.disabled = false;

    const reader = new FileReader();
    reader.onload = (e) => {
      imgOriginal.src = e.target.result;
      imgOriginal.classList.remove("d-none");
      imgResult.classList.add("d-none");
      metricsZone.classList.add("d-none");
    };
    reader.readAsDataURL(file);
  }
}

btnProcess.addEventListener("click", async () => {
  if (!selectedFile) return;
  const formData = new FormData();
  formData.append("image", selectedFile);

  // Mostrar estado de carga antes de la petición
  loader.classList.remove("d-none");
  imgResult.classList.add("d-none");

  await sendFrameToBackend(formData);
  loader.classList.add("d-none");
});

// ==========================================
// 7. LÓGICA MODO CÁMARA (FLUJO EN TIEMPO REAL)
// ==========================================
btnStartCamera.addEventListener("click", async () => {
  await initCamera();
  btnStartCamera.disabled = true;
  btnStopCamera.disabled = false;
  btnToggleCamera.style.display = "inline-block"; // Manejo inline de Bootstrap para layouts fluidos
});

btnToggleCamera.addEventListener("click", async () => {
  currentFacingMode = currentFacingMode === "user" ? "environment" : "user";

  if (isStreaming) {
    clearInterval(streamInterval);
    if (streamInstance) {
      streamInstance.getTracks().forEach((track) => track.stop());
    }
    await initCamera();
  }
});

async function initCamera() {
  try {
    streamInstance = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 400 },
        height: { ideal: 300 },
        facingMode: currentFacingMode,
      },
      audio: false,
    });

    video.srcObject = streamInstance;
    isStreaming = true;
    imgResult.classList.remove("d-none");

    // Iniciar el intervalo de procesamiento (Cada 600ms)
    streamInterval = setInterval(processCameraFrame, 600);
  } catch (err) {
    console.error("Error al acceder a la cámara:", err);
    alert("No se pudo acceder a la cámara seleccionada.");
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
  }
}

btnStopCamera.addEventListener("click", stopCameraFlow);

function stopCameraFlow() {
  clearInterval(streamInterval);
  isStreaming = false;

  if (streamInstance) {
    streamInstance.getTracks().forEach((track) => track.stop());
  }

  video.srcObject = null;
  btnStartCamera.disabled = false;
  btnStopCamera.disabled = true;
  btnToggleCamera.style.display = "none";
  loader.classList.add("d-none");
}

async function processCameraFrame() {
  if (!isStreaming) return;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(
    async (blob) => {
      if (!blob) return;

      const formData = new FormData();
      formData.append("image", blob, "frame.jpg");

      await sendFrameToBackend(formData);
    },
    "image/jpeg",
    0.7,
  );
}

// ==========================================
// 8. COMUNICACIÓN ASÍNCRONA CON VERCEL API
// ==========================================
async function sendFrameToBackend(formData) {
  try {
    const response = await fetch("/api/detect", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) return;

    const data = await response.json();

    if (data.success) {
      // Asignar el Base64 que contiene los recuadros verdes pintados por OpenCV
      imgResult.src = data.image;

      // Control de visibilidad nativo de Bootstrap
      imgResult.classList.remove("d-none");
      metricsZone.classList.remove("d-none");

      // Actualizar contador numérico
      faceCount.textContent = data.faces_detected;
    }
  } catch (error) {
    console.error("Error en la transmisión de datos:", error);
  }
}
