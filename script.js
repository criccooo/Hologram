const videoElement = document.getElementById('hidden-video');
const handDot = document.getElementById('hand-dot');
const ologram = document.getElementById('ologram-screen');
const playerCamera = document.getElementById('player-camera');
const debugText = document.getElementById('debug-text');

let isGrabbing = false;

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1, // Se va a scatti, possiamo abbassarlo a 0
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// Funzione che scatta ogni volta che l'IA analizza un frame
hands.onResults((results) => {
    
    // Aggiorniamo il debug a schermo
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        debugText.setAttribute('value', 'MANO TROVATA!');
        handDot.setAttribute('visible', 'true');
        
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        const x = (0.5 - indexTip.x) * 2; 
        const y = (0.5 - indexTip.y) * 2;
        const z = -1;

        handDot.setAttribute('position', {x, y, z});

        const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        
        if (distance < 0.06) {
            handDot.setAttribute('color', 'yellow');
            debugText.setAttribute('value', 'PRESO!');
            if (!isGrabbing) {
                ologram.setAttribute('position', {x: 0, y: 0, z: 0}); 
                handDot.appendChild(ologram);
                isGrabbing = true;
            }
        } else {
            handDot.setAttribute('color', 'red');
            if (isGrabbing) {
                const worldPos = new THREE.Vector3();
                ologram.object3D.getWorldPosition(worldPos);
                
                document.querySelector('a-scene').appendChild(ologram);
                ologram.setAttribute('position', worldPos);
                
                isGrabbing = false;
            }
        }
    } else {
        // L'IA è viva ma non vede mani
        debugText.setAttribute('value', 'CERCO MANO...');
        handDot.setAttribute('visible', 'false');
    }
});

function startApp() {
    document.getElementById('start_btn').style.display = 'none';
    debugText.setAttribute('value', 'AVVIO FOTOCAMERA...');
    
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().catch(console.error);
    }

    const camera = new Camera(videoElement, {
        onFrame: async () => { 
            await hands.send({image: videoElement}); 
        },
        width: 640, height: 480,
        facingMode: 'environment' // FONDAMENTALE: Usa la camera posteriore!
    });
    
    camera.start()
        .then(() => {
            debugText.setAttribute('value', 'CAMERA OK. CERCO MANO...');
        })
        .catch((err) => {
            debugText.setAttribute('value', 'ERRORE CAM: ' + err.message);
        });
}
