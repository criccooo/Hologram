// file script.js
import {
  HandLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let handLandmarker = undefined;
let runningMode = "VIDEO";
let webcamRunning = false;

// 👇 👇 INSERISCI QUI IL TUO ID YOUTUBE 👇 👇
const youtubeVideoId = "dQw4w9WgXcQ"; 

let isPinching = false; 

// Coordinate 3D virtuali dell'ologramma (iniziali)
let cubeCurrentX = 0;
let cubeCurrentY = 1.5;
let cubeCurrentZ = -3; 

// Variabili per la SCALA (avanti/indietro)
let videoScale = 1.0; 
let startHandSize = 0;
let startVideoScale = 1.0;

// Dimensioni base del video in pixel
const iframeBaseWidth = 320;
const iframeBaseHeight = 180;

// Elementi HTML
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");
const pinchAlert = document.getElementById("pinchAlert");
const youtubeIframe = document.getElementById("youtubeIframe"); 
const ologramEntity = document.querySelector('#hologram');
const cameraEl = document.querySelector('a-camera');

// 1. CARICAMENTO DEL MODELLO AI
const createHandLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU" 
    },
    runningMode: runningMode,
    numHands: 1 
  });
  console.log("AI Caricata! Premi il pulsante.");
};
createHandLandmarker();

// 2. GESTIONE DELLA WEBCAM E DELLO SCHERMO INTERO
if (!!navigator.mediaDevices?.getUserMedia) {
  enableWebcamButton.addEventListener("click", enableCam);
}

function enableCam(event) {
  if (!handLandmarker) return;
  
  if (webcamRunning === true) {
    webcamRunning = false;
  } else {
    webcamRunning = true;
    
    // Fai sparire il bottone
    enableWebcamButton.style.display = "none";
    
    // Richiedi Schermo Intero
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => console.log(err));
    } else if (elem.webkitRequestFullscreen) { 
      elem.webkitRequestFullscreen(); 
    }
    
    // Accendi Fotocamera Posteriore ("environment")
    const constraints = { 
      video: { facingMode: "environment" } 
    };
    
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadeddata", predictWebcam);
    });
  }
}

// MAGIA MATEMATICA: Calcola dove il 3D finisce sul 2D (Schermo)
function getScreenCoords(entity, camera) {
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

// 3. IL CUORE: ANALISI DEI FRAME IN TEMPO REALE
let lastVideoTime = -1;
let results = undefined;

async function predictWebcam() {
  canvasElement.style.width = video.videoWidth + "px";
  canvasElement.style.height = video.videoHeight + "px";
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;
  
  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = handLandmarker.detectForVideo(video, startTimeMs);
  }

  // Dimensioni dinamiche del video
  const currentIframeWidth = iframeBaseWidth * videoScale;
  const currentIframeHeight = iframeBaseHeight * videoScale;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  if (results.landmarks) {
    for (const landmarks of results.landmarks) {
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 5 });
      drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });
      
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

      // Coordinate della mano tradotte in spazio 3D approssimativo
      const targetHandX = (midX_norm - 0.5) * 5; 
      const targetHandY = (0.5 - midY_norm) * 5 + 1.5; 

      const targetCornerX = cubeCurrentX + ((currentIframeWidth / canvasElement.width) * 2.5);
      const targetCornerY = cubeCurrentY + ((currentIframeHeight / canvasElement.height) * 2.5);
      const handToCornerDist = Math.hypot(targetHandX - targetCornerX, targetHandY - targetCornerY);

      // FASE DI AGGANCIO
      if (!isPinching && pinchDist < 0.09 && handToCornerDist < 0.4 && !isFist) {
        isPinching = true; 
        startHandSize = currentHandSize; 
        startVideoScale = videoScale; 
      } else if (isPinching && (pinchDist > 0.25 || isFist)) {
        isPinching = false; 
      }

      if (isPinching) {
        pinchAlert.style.display = "block"; 
        
        // Push/Pull - Scala del video
        let targetScale = startVideoScale * (currentHandSize / startHandSize);
        targetScale = Math.max(0.3, Math.min(3.0, targetScale)); 
        videoScale += (targetScale - videoScale) * 0.5; 

        // Spostamento X e Y
        const smoothing = 0.8; 
        const desiredCenterX = targetHandX - ((currentIframeWidth / canvasElement.width) * 2.5);
        const desiredCenterY = targetHandY - ((currentIframeHeight / canvasElement.height) * 2.5);
        
        cubeCurrentX += (desiredCenterX - cubeCurrentX) * smoothing;
        cubeCurrentY += (desiredCenterY - cubeCurrentY) * smoothing;

        if (ologramEntity) {
          ologramEntity.setAttribute("position", `${cubeCurrentX} ${cubeCurrentY} ${cubeCurrentZ}`); 
        }
        
        // Pallino blu del tocco
        canvasCtx.beginPath();
        canvasCtx.arc(midX_norm * canvasElement.width, midY_norm * canvasElement.height, 15, 0, 2 * Math.PI);
        canvasCtx.fillStyle = "blue";
        canvasCtx.fill();
        
      } else {
        pinchAlert.style.display = "none"; 
      }
      
      // ANCORAGGIO: Posizionamento a schermo del video YouTube
      if (youtubeIframe && ologramEntity) {
        if (!youtubeIframe.getAttribute("src")) {
          youtubeIframe.setAttribute("src", `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=1`);
        }
        
        youtubeIframe.style.display = "block"; 
        
        // Troviamo le coordinate a schermo dell'oggetto 3D
        const screenCoords = getScreenCoords(ologramEntity, cameraEl);
        const screenX = screenCoords.x * canvasElement.width;
        const screenY = screenCoords.y * canvasElement.height;
        
        youtubeIframe.style.width = `${currentIframeWidth}px`;
        youtubeIframe.style.height = `${currentIframeHeight}px`;
        
        youtubeIframe.style.left = `${screenX - (currentIframeWidth / 2)}px`;
        youtubeIframe.style.top = `${screenY - (currentIframeHeight / 2)}px`;

        // Mirino Giallo di presa
        canvasCtx.beginPath();
        const canvasCornerX = screenX + (currentIframeWidth / 2);
        const canvasCornerY = screenY - (currentIframeHeight / 2);
        canvasCtx.arc(canvasCornerX, canvasCornerY, 12 * videoScale, 0, 2 * Math.PI);
        canvasCtx.strokeStyle = isPinching ? "#FF0055" : "yellow"; 
        canvasCtx.lineWidth = 4 * videoScale;
        canvasCtx.stroke();
      }
    }
  }
  canvasCtx.restore();

  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}
