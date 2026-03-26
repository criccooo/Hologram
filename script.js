import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

let handLandmarker;
let webcamRunning = false;
let lastVideoTime = -1;
let results = undefined;

const youtubeVideoId = "dQw4w9WgXcQ"; 

let cubeCurrentX = 0, cubeCurrentY = 1.5, cubeCurrentZ = -3;
let videoScale = 1.0;
let isPinching = false;
let startHandSize = 0, startVideoScale = 1.0;
let persistPinch = 0; // Contatore per non perdere il pinch se la mano sparisce un attimo

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const youtubeIframe = document.getElementById("youtubeIframe");
const drawingUtils = new DrawingUtils(canvasCtx);

function getScreenCoords(entity) {
    const cameraEl = document.querySelector('a-camera');
    if (!entity || !entity.object3D || !cameraEl.components.camera) return { x: 0.5, y: 0.5 };
    const vector = new THREE.Vector3();
    entity.object3D.updateMatrixWorld();
    vector.setFromMatrixPosition(entity.object3D.matrixWorld);
    vector.project(cameraEl.components.camera.camera);
    return { x: (vector.x + 1) / 2, y: (-vector.y + 1) / 2 };
}

const init = async () => {
  const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, delegate: "GPU" },
    runningMode: "VIDEO", numHands: 1
  });
  document.getElementById("webcamButton").innerText = "AVVIA AR";
};
init();

document.getElementById("webcamButton").addEventListener("click", async () => {
  try {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) await docEl.requestFullscreen();
  } catch (err) { console.log(err); }

  webcamRunning = true;
  document.getElementById("webcamButton").style.display = "none";
  youtubeIframe.src = `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=1&enablejsapi=1`;
  youtubeIframe.style.display = "block";

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
});

async function predictWebcam() {
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = handLandmarker.detectForVideo(video, performance.now());
  }

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results && results.landmarks && results.landmarks.length > 0) {
    const landmarks = results.landmarks[0];
    
    // --- RITORNANO I PUNTINI ROSSI E VERDI ---
    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 3 });
    drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 2 });
    
    const thumb = landmarks[4], index = landmarks[8], wrist = landmarks[0];
    const pinchDist = Math.hypot(index.x - thumb.x, index.y - thumb.y, index.z - thumb.z);
    const handSize = Math.hypot(wrist.x - landmarks[9].x, wrist.y - landmarks[9].y);

    const threshold = isPinching ? 0.13 : 0.08;

    if (pinchDist < threshold) { 
      if (!isPinching) {
        isPinching = true;
        startHandSize = handSize;
        startVideoScale = videoScale;
      }
      persistPinch = 10; // Reset della persistenza
    } else {
      if (persistPinch > 0) persistPinch--;
      else isPinching = false;
    }

    if (isPinching) {
      // COORDINATE (Reattività 1.0 = Istantaneo)
      const targetX = ((thumb.x + index.x) / 2 - 0.5) * 5;
      const targetY = (0.5 - (thumb.y + index.y) / 2) * 5 + 1.5;

      cubeCurrentX += (targetX - cubeCurrentX) * 0.9;
      cubeCurrentY += (targetY - cubeCurrentY) * 0.9;

      let targetScale = startVideoScale * (handSize / startHandSize);
      videoScale += (targetScale - videoScale) * 0.4;
    }
  } else {
    // Se la mano sparisce del tutto
    if (persistPinch > 0) persistPinch--;
    else isPinching = false;
  }

  const ologramEntity = document.querySelector('#hologram');
  if (ologramEntity) {
    ologramEntity.setAttribute("position", `${cubeCurrentX} ${cubeCurrentY} ${cubeCurrentZ}`);
    const coords = getScreenCoords(ologramEntity);
    
    const w = 320 * videoScale;
    const h = 180 * videoScale;
    
    // POSIZIONAMENTO CORRETTO SULL'ANGOLO ALTO-DESTRA
    // Il punto 'coords' sono le tue dita. 
    // Il video deve stare a sinistra delle dita (left = dita - larghezza)
    // E il video deve stare sotto le dita (top = dita)
    youtubeIframe.style.width = `${w}px`;
    youtubeIframe.style.height = `${h}px`;
    youtubeIframe.style.left = `${(coords.x * window.innerWidth) - w}px`;
    youtubeIframe.style.top = `${(coords.y * window.innerHeight)}px`;
  }

  requestAnimationFrame(predictWebcam);
}
