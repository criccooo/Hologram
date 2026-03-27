// ==========================================
// 1. CONFIGURAZIONE AI E MANI
// ==========================================
const handDot = document.getElementById('hand-dot');
const ologram = document.getElementById('ologram-screen');
const statusText = document.getElementById('status-text');
const extractionCanvas = document.getElementById('extraction-canvas');

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// Cosa succede quando MediaPipe trova la mano nei frame di WebXR
hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDot.setAttribute('visible', 'true');
        
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        // Mappiamo le coordinate 2D nello spazio 3D davanti alla telecamera
        const x = (indexTip.x - 0.5) * 1.5;
        const y = -(indexTip.y - 0.5) * 1.5;
        const z = -0.5; // Distanza fissa davanti agli occhi

        handDot.setAttribute('position', {x, y, z});

        // Logica di GRAB (Pizzico) per spostare l'ologramma
        const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        
        if (distance < 0.05 && ologram.getAttribute('visible') === true) {
            handDot.setAttribute('color', 'yellow');
            statusText.setAttribute('visible', 'true');
            // Se pizzichi, l'ologramma segue la tua mano!
            ologram.setAttribute('position', handDot.object3D.getWorldPosition(new THREE.Vector3()));
        } else {
            handDot.setAttribute('color', 'red');
            statusText.setAttribute('visible', 'false');
        }
    } else {
        handDot.setAttribute('visible', 'false');
    }
});

// ==========================================
// 2. LO SLAM: POSIZIONAMENTO SUL PAVIMENTO
// ==========================================
let objectPlaced = false;

document.querySelector('a-scene').addEventListener('ar-hit-test-select', function () {
    if (objectPlaced) return; 

    const reticle = document.getElementById('reticle');
    const position = reticle.getAttribute('position');
    
    // Piazza lo schermo 45cm sopra il pavimento (altezza tibia)
    ologram.setAttribute('position', { x: position.x, y: position.y + 0.45, z: position.z });
    
    // Fallo ruotare verso di te
    const cameraYRotation = document.querySelector('a-camera').getAttribute('rotation').y;
    ologram.setAttribute('rotation', { x: 0, y: cameraYRotation, z: 0 });

    ologram.setAttribute('visible', 'true');
    reticle.setAttribute('visible', 'false');
    this.removeAttribute('ar-hit-test'); // Ferma lo SLAM per risparmiare batteria
    
    objectPlaced = true;
});

// ==========================================
// 3. IL PONTE WEBXR (L'approccio GitHub sperimentale)
// ==========================================
AFRAME.registerComponent('xr-camera-bridge', {
    tick: function () {
        const sceneEl = this.el;
        const renderer = sceneEl.renderer;
        
        // Se non siamo in AR (WebXR Session attiva), non fare nulla
        if (!sceneEl.xrSession) return;
        
        // Questo è il trucco sperimentale: "rubiamo" il frame WebGL dalla sessione AR
        // e lo mandiamo a MediaPipe per fargli cercare le mani.
        // Essendo un'API in incubazione, usiamo un try/catch per non far crashare tutto se lagga.
        try {
            const canvas = renderer.domElement;
            // Mandiamo il canvas 3D misto alla realtà a MediaPipe
            hands.send({image: canvas});
        } catch (e) {
            console.warn("Estrazione frame in corso...");
        }
    }
});
