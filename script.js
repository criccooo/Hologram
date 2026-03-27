const videoElement = document.getElementById('hidden-video');
const handDot = document.getElementById('hand-dot');
const ologram = document.getElementById('ologram-screen');
const playerCamera = document.getElementById('player-camera');

let isGrabbing = false;

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDot.setAttribute('visible', 'true');
        
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        // Mappatura X e Y relative alla visuale dello schermo
        const x = (0.5 - indexTip.x) * 2; 
        const y = (0.5 - indexTip.y) * 2;
        const z = -1; // Pallina rossa fissa a 1 metro dai tuoi occhi

        handDot.setAttribute('position', {x, y, z});

        // Logica Pizzico
        const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        
        if (distance < 0.06) {
            handDot.setAttribute('color', 'yellow');
            if (!isGrabbing) {
                // Se inizio ad afferrare, faccio diventare l'ologramma "figlio" della palla rossa
                // così la segue ovunque.
                ologram.setAttribute('position', {x: 0, y: 0, z: 0}); // Azzera posizione locale
                handDot.appendChild(ologram);
                isGrabbing = true;
            }
        } else {
            handDot.setAttribute('color', 'red');
            if (isGrabbing) {
                // Se rilascio, "stacco" l'ologramma dalla mano e lo rimetto nel mondo
                const worldPos = new THREE.Vector3();
                ologram.object3D.getWorldPosition(worldPos);
                
                // Rimetto l'ologramma nella scena principale nella sua nuova posizione
                document.querySelector('a-scene').appendChild(ologram);
                ologram.setAttribute('position', worldPos);
                
                isGrabbing = false;
            }
        }
    } else {
        handDot.setAttribute('visible', 'false');
    }
});

function startApp() {
    document.getElementById('start_btn').style.display = 'none';
    
    // Su iOS serve esplicitamente chiedere il permesso per il giroscopio a volte,
    // su Android i look-controls partono da soli.
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().catch(console.error);
    }

    const camera = new Camera(videoElement, {
        onFrame: async () => { await hands.send({image: videoElement}); },
        width: 640, height: 480
    });
    camera.start();
}
