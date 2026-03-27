const videoElement = document.getElementById('input_video');
const startButton = document.getElementById('start_btn');
const handDot = document.getElementById('hand-dot');
const ologram = document.getElementById('ologram-screen');
const playerCamera = document.getElementById('player-camera');
const debugText = document.getElementById('debug-text');

let isGrabbing = false;

// 1. Inizializzazione AI
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1, 
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// 2. Logica di mappatura e Pinch
hands.onResults((results) => {
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        debugText.setAttribute('value', 'MANO TROVATA!');
        handDot.setAttribute('visible', 'true');
        
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        // MAPPATURA CORRETTA (X e Y relative alla visuale, non specchiate)
        const x = (indexTip.x - 0.5) * 2; 
        const y = (0.5 - indexTip.y) * 2;
        const z = -1; // Distanza della palla rossa dai tuoi occhi

        handDot.setAttribute('position', {x, y, z});

        // Calcolo del Pinch
        const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        
        if (distance < 0.06) {
            // SEI IN PINCH
            handDot.setAttribute('color', 'yellow');
            debugText.setAttribute('value', 'PRESO!');
            
            // LOGICA DI SPOSTAMENTO SOLIDO
            const dotWorldPos = new THREE.Vector3();
            handDot.object3D.getWorldPosition(dotWorldPos);
            
            // L'ologramma segue la pallina rossaYELLOW senza staccarsi
            ologram.setAttribute('position', dotWorldPos);
            
            // Facciamo in modo che l'ologramma sia sempre rivolto verso la telecamera
            const camRot = playerCamera.getAttribute('rotation');
            ologram.setAttribute('rotation', {x: 0, y: camRot.y, z: 0});
            
        } else {
            // NON SEI IN PINCH
            handDot.setAttribute('color', 'red');
            // L'ologramma resta semplicemente fermo dove l'hai lasciato
        }
    } else {
        // L'IA è attiva ma non vede nessuna mano
        debugText.setAttribute('value', 'CERCO MANO...');
        handDot.setAttribute('visible', 'false');
    }
});

// 3. Funzione di Avvio e Schermo Intero
startButton.addEventListener('click', () => {
    startButton.style.display = 'none';
    
    // --- SCHERMO INTERO IMMEDIATO ---
    // Proviamo i metodi standard e proprietari dei browser
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) { // Firefox
        document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) { // Chrome/Safari
        document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) { // IE/Edge
        document.documentElement.msRequestFullscreen();
    }
    
    // Se è su iOS, serve esplicitamente chiedere il permesso per i sensori
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(() => debugText.setAttribute('value', 'SENSORI OK'))
            .catch(console.error);
    }

    // Avviamo la fotocamera posteriore
    const camera = new Camera(videoElement, {
        onFrame: async () => { 
            await hands.send({image: videoElement}); 
        },
        width: 640, height: 480,
        facingMode: 'environment' 
    });
    
    camera.start()
        .then(() => debugText.setAttribute('value', 'CAMERA OK. CERCO MANO...'))
        .catch((err) => debugText.setAttribute('value', 'ERRORE CAM: ' + err.message));
});
