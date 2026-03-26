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

// Dimensioni base del video
const iframeBaseWidth = 320;
const iframeBaseHeight = 180;

// Accesso diretto agli oggetti A-Frame / THREE.js
const ologramEntity = document.querySelector('#hologram');
const cameraEl = document.querySelector('a-camera');
const youtubeIframe = document.getElementById("youtubeIframe"); 
const pinchAlert = document.getElementById("pinchAlert");

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

// 2. GESTIONE DELLA WEBCAM E DEL BOTTONE
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");

const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

if (hasGetUserMedia()) {
  enableWebcamButton.addEventListener("click", enableCam);
}

function enableCam(event) {
  if (!handLandmarker) return;
  if (webcamRunning === true) {
    webcamRunning = false;
    enableWebcamButton.innerText = "ACCENDI WEBCAM";
  } else {
    webcamRunning = true;
    enableWebcamButton.innerText = "SPEGNI WEBCAM";
    
    const constraints = { video: true };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadeddata", predictWebcam);
    });
  }
}

// 👇 👇 👇 MAGIA MATEMATICA DEFINTIVA 👇 👇 👇
// Questa funzione THREE.js calcola dove un oggetto 3D finisce pixel per pixel sullo schermo 2D,
// ricalcolando Su/Giù e Su/Giù Su/Giù basandosi sull'asse World e Sensori del telefono.
function getScreenCoords(entity, camera) {
    const object3D = entity.object3D;
    const vector = new THREE.Vector3();
    
    // Otteniamo la posizione World dell'oggetto (indipendente dalla telecamera)
    object3D.updateMatrixWorld();
    vector.setFromMatrixPosition(object3D.matrixWorld);
    
    // Proiettiamo la posizione 3D sulla telecamera virtuale
    vector.project(camera.components.camera.camera);
    
    // Convertiamo le coordinate NDC (-1 a +1) in coordinate normalizzate dello schermo (0 a 1)
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

  const baseRectWidth = (iframeBaseWidth / canvasElement.width) * 5;
  const baseRectHeight = (iframeBaseHeight / canvasElement.height) * 5;

  const scaledARWidth = baseRectWidth * videoScale;
  const scaledARHeight = baseRectHeight * videoScale;

  const currentIframeWidth = iframeBaseWidth * videoScale;
  const currentIframeHeight = iframeBaseHeight * videoScale;

  // Sincronizziamo il rettangolo 3D sottostante
  if (ologramEntity) {
    ologramEntity.setAttribute("width", scaledARWidth);
    ologramEntity.setAttribute("height", scaledARHeight);
  }

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
      const middleToWristDist = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y);
      const isFist = middleToWristDist < 0.25;

      const currentHandSize = Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y);

      const midX_norm = (thumbTip.x + indexTip.x) / 2;
      const midY_norm = (thumbTip.y + indexTip.y) / 2;

      // Coordinate della mano (mappate matematicamente nello spazio AR Su/Giù Su/Giù)
      // Usiamo una matrice fissa, A-Frame gestirà la rotazione World Su/Giù Su/Giù Su/Giù.
      const targetHandX = (midX_norm - 0.5) * 5; 
      const targetHandY = (0.5 - midY_norm) * 5 + 1.5; 

      const targetCornerX = cubeCurrentX + (scaledARWidth / 2);
      const targetCornerY = cubeCurrentY + (scaledARHeight / 2);
      const handToCornerDist = Math.hypot(targetHandX - targetCornerX, targetHandY - targetCornerY);

      if (!isPinching && pinchDist < 0.09 && handToCornerDist < 0.4 && !isFist) {
        isPinching = true; 
        startHandSize = currentHandSize; 
        startVideoScale = videoScale; 
      } else if (isPinching && (pinchDist > 0.25 || isFist)) {
        isPinching = false; 
        // ❌ NON AGGIORNIAMO LE COORDINATE: il video si ferma a queste coordinate virtuali World spaziali.
      }


      if (isPinching) {
        pinchAlert.style.display = "block"; 
        
        let targetScale = startVideoScale * (currentHandSize / startHandSize);
        targetScale = Math.max(0.3, Math.min(3.0, targetScale)); 
        videoScale += (targetScale - videoScale) * 0.5; 

        const smoothing = 0.8; // Presa d'acciaio!

        // Calcoliamo dove il centro del video deve spostarsi RISPETTO ALLA MANO
        const desiredCenterX = targetHandX - (scaledARWidth / 2);
        const desiredCenterY = targetHandY - (scaledARHeight / 2);
        
        cubeCurrentX += (desiredCenterX - cubeCurrentX) * smoothing;
        cubeCurrentY += (desiredCenterY - cubeCurrentY) * smoothing;

        // 👇👇 Aggiorniamo la posizione virtuale dell'ologramma 👇👇
        // A-Frame gestirà la rotazione Su/Giù Su/Giù Su/Giù Su/Giù del telefono in World space.
        if (ologramEntity) {
          ologramEntity.setAttribute("color", "#FF0055"); 
          ologramEntity.setAttribute("position", `${cubeCurrentX} ${cubeCurrentY} ${cubeCurrentZ}`); 
        }
        
        canvasCtx.beginPath();
        const midX = midX_norm * canvasElement.width;
        const midY = midY_norm * canvasElement.height;
        canvasCtx.arc(midX, midY, 15, 0, 2 * Math.PI);
        canvasCtx.fillStyle = "blue";
        canvasCtx.fill();
        
      } else {
        pinchAlert.style.display = "none"; 
        if (ologramEntity) {
          ologramEntity.setAttribute("color", "#4CC3D9"); 
          // ❌ NON AGGIORNIAMO POSITION: l'oggetto rimane fermo in World Space virtuale.
        }
      }
      
      // 👇👇 👇 PROIEZIONE WORLD->SCREEN DEFINTIVA (Ogni frame) 👇👇👇
      // Questo blocco deve girare ogni frame, *anche quando non afferri*,
      // perché la telecamera Su/Giù e ricalcoliamo la proiezione del punto World.
      if (youtubeIframe && ologramEntity) {
        if (!youtubeIframe.getAttribute("src")) {
          youtubeIframe.setAttribute("src", `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=1`);
        }
        
        youtubeIframe.style.display = "block"; 
        
        // 1. Chiediamo a THREE.js dove si trova l'ologramma sullo schermo
        const screenCoords = getScreenCoords(ologramEntity, cameraEl);
        // screenCoords.x e y sono 0-1 (normalizzate)
        
        // 2. Calcoliamo i pixel dello schermo
        const screenX = screenCoords.x * canvasElement.width;
        const screenY = screenCoords.y * canvasElement.height;
        
        // 3. Forziamo il video a ridimensionarsi pixel per pixel (Push/Pull)
        youtubeIframe.style.width = `${currentIframeWidth}px`;
        youtubeIframe.style.height = `${currentIframeHeight}px`;
        
        // 4. Centriamo il video sulla proiezione esatta del World coordinate spaziale
        youtubeIframe.style.left = `${screenX - (currentIframeWidth / 2)}px`;
        youtubeIframe.style.top = `${screenY - (currentIframeHeight / 2)}px`;
        
        // Rimuoviamo il vecchio transform
        youtubeIframe.style.transform = "none";

        // 👇 Aggiorniamo anche il mirino Giallo basandoci sulla proiezione spaziale
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