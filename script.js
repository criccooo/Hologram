// ==========================================
// 1. MOTORE INTELLIGENZA ARTIFICIALE (Mani)
// ==========================================

// Creiamo un video invisibile che cattura la realtà per l'AI
const videoElement = document.createElement('video');
videoElement.style.display = 'none';
videoElement.setAttribute('autoplay', '');
videoElement.setAttribute('playsinline', '');
document.body.appendChild(videoElement);

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
  maxNumHands: 1, // Alleggeriamo il telefono cercando una sola mano
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

// Cosa fa l'AI quando processa un fotogramma
hands.onResults((results) => {
  const aiCursor = document.getElementById('ai-cursor');
  
  // Se la scena 3D non ha ancora caricato il cursore, fermati
  if (!aiCursor) return; 

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    // 1. MANO TROVATA: Mostra la pallina rossa
    aiCursor.setAttribute('visible', 'true'); 
    
    // 2. Prendi il punto 8 (la punta dell'indice)
    const indexFinger = results.multiHandLandmarks[0][8]; 
    
    // 3. Converti le coordinate 2D del video in coordinate 3D per A-Frame
    // Moltiplichiamo per 0.6 per far muovere la pallina in un raggio comodo
    const mappedX = (indexFinger.x - 0.5) * 0.6; 
    const mappedY = -(indexFinger.y - 0.5) * 0.6; // In 3D la Y va verso l'alto, nei video verso il basso, quindi la invertiamo
    
    // 4. Sposta fisicamente la pallina!
    aiCursor.setAttribute('position', { x: mappedX, y: mappedY, z: -0.5 });
  } else {
    // NESSUNA MANO: Nascondi la pallina
    aiCursor.setAttribute('visible', 'false'); 
  }
});

// Accendiamo la fotocamera classica e spariamo i frame dentro l'AI
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: 640,
  height: 480
});
// ATTENZIONE: Questo farà apparire la richiesta "Consenti uso fotocamera"
camera.start(); 


// ==========================================
// 2. MOTORE REALTÀ AUMENTATA (Pavimento)
// ==========================================

AFRAME.registerComponent('tap-to-place', {
  init: function () {
    const reticle = document.getElementById('reticle');
    const screen = document.getElementById('ologram-screen');
    const sceneEl = this.el;
    
    let objectPlaced = false;

    // Quando tocchi lo schermo per confermare il pavimento
    sceneEl.addEventListener('ar-hit-test-select', function () {
      if (objectPlaced) return; 

      const position = reticle.getAttribute('position');
      
      // Piazza lo schermo 45cm sopra il pavimento
      screen.setAttribute('position', { x: position.x, y: position.y + 0.45, z: position.z });
      
      // Fallo ruotare verso l'utente
      const cameraYRotation = document.querySelector('a-camera').getAttribute('rotation').y;
      screen.setAttribute('rotation', { x: 0, y: cameraYRotation, z: 0 });

      screen.setAttribute('visible', 'true');
      reticle.setAttribute('visible', 'false');
      sceneEl.removeAttribute('ar-hit-test');
      
      objectPlaced = true;
    });
  }
});
