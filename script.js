const videoElement = document.getElementById('input_video');
const startButton = document.getElementById('start_btn');
const handDot = document.getElementById('hand-dot');
const ologram = document.getElementById('ologram-screen');
const playerCamera = document.getElementById('player-camera');
const debugText = document.getElementById('debug-text');

// --- CONNESSIONE SERVER PUBBLICO ---
const mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
const topicSegreto = 'esame_ar_visore_2026_super_segreto';

mqttClient.on('connect', () => {
    console.log("Telefono connesso a Internet!");
});

// --- SETUP MEDIAPIPE ---
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

let ultimoInvio = 0; 

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDot.setAttribute('visible', 'true');
        
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        // --- 1. MATEMATICA PERFETTA (UNPROJECT) ---
        // Usiamo un raggio laser 3D per allineare perfettamente il dito allo schermo
        const ndcX = ((1 - indexTip.x) * 2) - 1; // Invertito per effetto specchio
        const ndcY = -(indexTip.y * 2) + 1;

        const treCam = playerCamera.getObject3D('camera');
        if (treCam) {
            const vec = new THREE.Vector3(ndcX, ndcY, 0.5);
            vec.unproject(treCam);
            
            const camWorldPos = new THREE.Vector3();
            treCam.getWorldPosition(camWorldPos);

            vec.sub(camWorldPos).normalize();
            
            // Posizioniamo il pallino a 1.5 metri di profondità esatti
            const targetPos = new THREE.Vector3().copy(camWorldPos).add(vec.multiplyScalar(1.5));
            handDot.setAttribute('position', targetPos);
        }

        const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        
        if (distance < 0.06) {
            // SEI IN PINCH (Stai afferrando l'oggetto)
            handDot.setAttribute('color', 'yellow');
            
            const dotWorldPos = new THREE.Vector3();
            handDot.object3D.getWorldPosition(dotWorldPos);
            
            // Spostiamo l'oggetto esattamente dove si trova il pallino
            ologram.setAttribute('position', dotWorldPos);
            
            // Fai ruotare l'oggetto verso la telecamera
            const camRot = playerCamera.getAttribute('rotation');
            ologram.setAttribute('rotation', {x: 0, y: camRot.y, z: 0});

            // INVIO DATI AL PC
            const ora = Date.now();
            if (mqttClient.connected && (ora - ultimoInvio > 50)) {
                const dati = { x: dotWorldPos.x, y: dotWorldPos.y, z: dotWorldPos.z };
                mqttClient.publish(topicSegreto, JSON.stringify(dati));
                if (debugText) debugText.innerText = 'SPOSTAMENTO IN CORSO...';
                ultimoInvio = ora;
            }
            
        } else {
            // MANO APERTA (Non stai afferrando)
            // L'oggetto rimane dove l'hai lasciato!
            handDot.setAttribute('color', 'red');
            if (debugText) debugText.innerText = 'MANO PRONTA';
        }
    } else {
        if (debugText) debugText.innerText = 'CERCO MANO...';
        handDot.setAttribute('visible', 'false');
    }
});

// --- AVVIO, GIROSCOPIO E FULLSCREEN ---
startButton.addEventListener('click', () => {
    
    // --- 2. SBLOCCO GIROSCOPIO (Risolve l'effetto "incollato") ---
    // Sui telefoni moderni dobbiamo chiedere il permesso per i sensori
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    console.log("Permesso Sensori: ACCORDATO!");
                } else {
                    alert("Devi accettare l'uso dei sensori per far funzionare la Realtà Aumentata!");
                }
            })
            .catch(console.error);
    }

    startButton.style.display = 'none';
    
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    else if (document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();
    
    const camera = new Camera(videoElement, {
        onFrame: async () => { await hands.send({image: videoElement}); },
        width: 640, height: 480, facingMode: 'environment' 
    });
    
    camera.start()
        .then(() => { if (debugText) debugText.innerText = 'SISTEMA OPERATIVO OK.'; })
        .catch((err) => { if (debugText) debugText.innerText = 'ERRORE CAM: ' + err.message; });
});
