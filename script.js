// file script.js
import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils // 👈 FIX: Importiamo gli strumenti di disegno ufficiali!
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let handLandmarker = undefined;
let webcamRunning = false;
let lastVideoTime = -1;
let results = undefined;

// 👇 👇 INSERISCI QUI IL TUO ID YOUTUBE 👇 👇
const youtubeVideoId = "dQw4w9WgXcQ"; 

let isPinching = false; 
let cubeCurrentX = 0;
let cubeCurrentY = 1.5;
let cubeCurrentZ = -3; 
let videoScale = 1.0; 
let startHandSize = 0;
let startVideoScale = 1.0;

const iframeBaseWidth = 320;
const iframeBaseHeight = 180;

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");
const pinchAlert = document.getElementById("pinchAlert");
const youtubeIframe = document.getElementById("youtubeIframe"); 
const ologramEntity = document.querySelector('#hologram');
const cameraEl = document.querySelector('a-camera');

// Creiamo l'oggetto per disegnare comodamente linee e pallini
const drawingUtils = new DrawingUtils(canvasCtx);

// 1. Inizializza l'Intelligenza Artificiale
const createHandLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU" 
    },
    runningMode: "VIDEO",
    numHands: 1 
  });
  enableWebcamButton.innerText = "Accendi Fotocamera";
};
createHandLandmarker();

// 2. Accendi la Webcam (Orizzontale)
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  enableWebcamButton.addEventListener("click", () => {
    if (!handLandmarker) return;
    webcamRunning = true;
    enableWebcamButton.style.display = "none";
    
    // Forza Schermo Intero
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen().catch(err => console.log(err));
    
    // Usa fotocamera posteriore
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadeddata", predictWebcam);
    });
  });
}

// Calcolatore coordinate da 3D a schermo
function getScreenCoords(entity, camera) {
    if (!entity || !entity.object3D || !camera || !camera.components.camera) {
        return { x: 0.5, y: 0.5 }; 
    }
    const object3D = entity.object3D;
    const vector = new THREE.Vector3();
    object3D.updateMatrixWorld();
    vector.setFromMatrixPosition(object3D.matrixWorld);
    vector.project(camera.components.camera.camera);
    return {
        x: (vector.x + 1) / 2,
        y: (-vector.y + 1) / 2
    };
}

// 3. Analisi e Disegno Frame per Frame
async function predictWebcam() {
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;
  
  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = handLandmarker.detectForVideo(video, startTimeMs);
  }

  const currentIframeWidth = iframeBaseWidth * videoScale;
  const currentIframeHeight = iframeBaseHeight * videoScale;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  if (results && results.landmarks && results.landmarks.length > 0) {
    const landmarks = results.landmarks[0]; 
    
    // 👇 RIMESSO: Disegna lo scheletro della mano in stile ologramma!
    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
      color: "#00FF00",
      lineWidth: 5
    });
    drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 2 });
    
    const wrist = landmarks[0];      
    const thumbTip = landmarks[4];   
    const indexTip = landmarks[8];   
    const middleMcp = landmarks[9]; 
    const middleTip = landmarks[12]; 
    
    const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
    const isFist = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) < 0.25;
    const currentHandSize = Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y);

    const midX_norm = (thumbTip.x + indexTip.x) / 2;
    const midY_norm = (thumbTip.y + indexTip.y) / 2;

    const targetHandX = (midX_norm - 0.5) * 5; 
    const targetHandY = (0.5 - midY_norm) * 5 + 1.5; 

    if (!isPinching && pinchDist < 0.08 && !isFist) {
      isPinching = true; 
      startHandSize = currentHandSize; 
      startVideoScale = videoScale; 
    } else if (isPinching && (pinchDist > 0.15 || isFist)) {
      isPinching = false; 
    }

    if (isPinching) {
      pinchAlert.style.display = "block"; 
      
      let targetScale = startVideoScale * (currentHandSize / startHandSize);
      targetScale = Math.max(0.3, Math.min(3.0, targetScale)); 
      videoScale += (targetScale - videoScale) * 0.5; 

      const smoothing = 0.8; 
      const desiredCenterX = targetHandX - ((currentIframeWidth / canvasElement.width) * 2.5);
      const desiredCenterY = targetHandY - ((currentIframeHeight / canvasElement.height) * 2.5);
      
      cubeCurrentX += (desiredCenterX - cubeCurrentX) * smoothing;
      cubeCurrentY += (desiredCenterY - cubeCurrentY) * smoothing;

      if (ologramEntity) {
        ologramEntity.setAttribute("position", `${cubeCurrentX} ${cubeCurrentY} ${cubeCurrentZ}`); 
      }
      
      canvasCtx.beginPath();
      canvasCtx.arc(midX_norm * canvasElement.width, midY_norm * canvasElement.height, 15, 0, 2 * Math.PI);
      canvasCtx.fillStyle = "blue";
      canvasCtx.fill();
      
    } else {
      pinchAlert.style.display = "none"; 
    }
    
    // 👇 RIMESSO: Il blocco che gestisce il video di YouTube!
    if (youtubeIframe && ologramEntity) {
      if (!youtubeIframe.getAttribute("src")) {
        youtubeIframe.setAttribute("src", `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=1`);
      }
      
      // Accende il video
      youtubeIframe.style.display = "block"; 
      
      const screenCoords = getScreenCoords(ologramEntity, cameraEl);
      
      // Calcola dove posizionare il video sullo schermo del telefono
      const screenX_UI = screenCoords.x * window.innerWidth;
      const screenY_UI = screenCoords.y * window.innerHeight;
      
      youtubeIframe.style.width = `${currentIframeWidth}px`;
      youtubeIframe.style.height = `${currentIframeHeight}px`;
      
      // Muove il video fisicamente per seguire la mano
      youtubeIframe.style.left = `${screenX_UI - (currentIframeWidth / 2)}px`;
      youtubeIframe.style.top = `${screenY_UI - (currentIframeHeight / 2)}px`;

      // Anello giallo che unisce la mano al video
      canvasCtx.beginPath();
      const canvasCornerX = screenCoords.x * canvasElement.width + (currentIframeWidth / 2);
      const canvasCornerY = screenCoords.y * canvasElement.height - (currentIframeHeight / 2);
      canvasCtx.arc(canvasCornerX, canvasCornerY, 12 * videoScale, 0, 2 * Math.PI);
      canvasCtx.strokeStyle = isPinching ? "#FF0055" : "yellow"; 
      canvasCtx.lineWidth = 4 * videoScale;
      canvasCtx.stroke();
    }
  }
  canvasCtx.restore();

  if (webcamRunning) {
    window.requestAnimationFrame(predictWebcam);
  }
}
