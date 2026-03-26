// --- 1. CONFIGURAZIONE MEDIAPIPE ---
const videoPonte = document.getElementById('video-ponte');

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

// Per ora, quando trova una mano, ci scrive solo in console
hands.onResults((results) => {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    console.log("MANO RILEVATA DALL'AI!");
  }
});

console.log("MediaPipe inizializzato e in attesa di immagini...");

// --- 2. GESTIONE AR (Come prima) ---
AFRAME.registerComponent('tap-to-place', {
  init: function () {
    const reticle = document.getElementById('reticle');
    const screen = document.getElementById('ologram-screen');
    const sceneEl = this.el;
    
    let objectPlaced = false;

    sceneEl.addEventListener('ar-hit-test-select', function () {
      if (objectPlaced) return; 

      const position = reticle.getAttribute('position');
      screen.setAttribute('position', { x: position.x, y: position.y + 0.45, z: position.z });
      
      const cameraYRotation = document.querySelector('a-camera').getAttribute('rotation').y;
      screen.setAttribute('rotation', { x: 0, y: cameraYRotation, z: 0 });

      screen.setAttribute('visible', 'true');
      reticle.setAttribute('visible', 'false');
      sceneEl.removeAttribute('ar-hit-test');
      
      objectPlaced = true;
      console.log("Schermo piazzato! Inizio test AI...");
      
      // Qui innescheremo l'estrazione dei fotogrammi nel prossimo step!
    });
  }
});
