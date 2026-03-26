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
  document.getElementById("webcamButton").innerText = "AVVIA OLOGRAMMA";
};
init();

document.getElementById("webcamButton").addEventListener("click", async () => {
  // FORZA FULL SCREEN SU CHROME
  try {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) await docEl.requestFullscreen();
    else if (docEl.webkitRequestFullscreen) await docEl.webkitRequestFullscreen();
  } catch (err) { console.log("Errore Fullscreen:", err); }

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

  if (results && results.landmarks.length > 0) {
    const landmarks = results.landmarks[0];
    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 3 });
    
    const thumb = landmarks[4], index = landmarks[8], wrist = landmarks[0];
    const pinchDist = Math.hypot(index.x - thumb.x, index.y - thumb.y);
    const handSize = Math.hypot(wrist.x - landmarks[9].x, wrist.y - landmarks[9].y);

    // PINCH PIÙ RESISTENTE: Soglia leggermente alzata per non perdere la presa
    if (pinchDist < 0.10) { 
      if (!isPinching) {
        isPinching = true;
        startHandSize = handSize;
        startVideoScale = videoScale;
      }

      // REATTIVITÀ: Smoothing ridotto a 0.5 per seguire velocemente
      const responsiveness = 0.5;
      const targetX = ((thumb.x + index.x) / 2 - 0.5) * 5;
      const targetY = (0.5 - (thumb.y + index.y) / 2) * 5 + 1.5;

      cubeCurrentX += (targetX - cubeCurrentX) * responsiveness;
      cubeCurrentY += (targetY - cubeCurrentY) * responsiveness;

      // Scaling dinamico
      let targetScale = startVideoScale * (handSize / startHandSize);
      videoScale += (targetScale - videoScale) * 0.2;
    } else {
      isPinching = false;
    }
  }

  const ologramEntity = document.querySelector('#hologram');
  if (ologramEntity) {
    ologramEntity.setAttribute("position", `${cubeCurrentX} ${cubeCurrentY} ${cubeCurrentZ}`);
    const coords = getScreenCoords(ologramEntity);
    
    const w = 320 * videoScale;
    const h = 180 * videoScale;
    
    // POSIZIONAMENTO NELL'ANGOLO IN ALTO A DESTRA
    // Invece di sottrarre la metà della larghezza (centro), usiamo l'intera larghezza
    youtubeIframe.style.width = `${w}px`;
    youtubeIframe.style.height = `${h}px`;
    youtubeIframe.style.left = `${(coords.x * window.innerWidth) - w}px`; // Angolo DX
    youtubeIframe.style.top = `${(coords.y * window.innerHeight)}px`;     // Angolo ALTO
  }

  requestAnimationFrame(predictWebcam);
}
