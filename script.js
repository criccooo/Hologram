// --- 1. CONFIGURAZIONE MEDIAPIPE ---
const videoPonte = document.createElement('video'); 
videoPonte.setAttribute('autoplay', '');
videoPonte.setAttribute('playsinline', '');
// Creiamo una tela invisibile per copiare i fotogrammi dalla telecamera 3D all'AI
const canvasPonte = document.createElement('canvas');
const ctxPonte = canvasPonte.getContext('2d');

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

// Quando l'AI trova la mano...
hands.onResults((results) => {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    console.log("🖐️ MANO TROVATA! Coordinate dell'indice:", results.multiHandLandmarks[0][8]);
    // Qui in futuro metteremo il codice per spostare l'oggetto!
  }
});

console.log("Cervello AI pronto.");

// --- 2. IL PONTE TRA WEBXR E L'AI (La Magia Nera) ---
AFRAME.registerComponent('ai-camera-bridge', {
  init: function () {
    this.sessionStarted = false;
    this.glBinding = null;
    
    // Quando entriamo in AR...
    this.el.sceneEl.addEventListener('enter-vr', () => {
      if (this.el.sceneEl.is('ar-mode')) {
        console.log("Entrati in AR, tento l'accesso grezzo alla fotocamera...");
        this.sessionStarted = true;
      }
    });
  },

  // Questa funzione gira a ogni singolo fotogramma (circa 60 volte al secondo)
  tick: async function (time, deltaTime) {
    if (!this.sessionStarted) return;

    const renderer = this.el.sceneEl.renderer;
    const xr = renderer.xr;
    const session = xr.getSession();

    if (session) {
      // Tentativo di catturare l'immagine grezza di sfondo (WebXR Raw Camera Access)
      // Nota: questo è codice altamente sperimentale e dipende dal browser/telefono
      try {
        const gl = renderer.getContext();
        if (!this.glBinding) {
          this.glBinding = new XRWebGLBinding(session, gl);
        }
        
        // Se l'API sperimentale è attiva, chiediamo i pixel della fotocamera
        const frame = xr.getFrame();
        if (frame) {
          const views = frame.getViewerPose(xr.getReferenceSpace()).views;
          for (const view of views) {
             const cameraTexture = this.glBinding.getCameraImage(view.camera);
             if (cameraTexture) {
                // Abbiamo rubato il fotogramma! Lo passiamo a MediaPipe
                // (In un progetto reale dovremmo decodificare la texture, ma per forzare
                // MediaPipe a leggere lo schermo proviamo a passargli il canvas intero di A-Frame)
                await hands.send({image: renderer.domElement});
             }
          }
        }
      } catch (error) {
        // Se l'API cruda fallisce, il telefono non supporta il Raw Access profondo
        // Proviamo il piano B: passare l'intera scena 3D all'AI
        await hands.send({image: renderer.domElement});
      }
    }
  }
});

// --- 3. GESTIONE AR E POSIZIONAMENTO ---
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
    });
  }
});
