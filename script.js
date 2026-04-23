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

        // CORREZIONE POSIZIONE PALLINO: 
        // Moltiplicatore alzato a 3.5 per coprire meglio i bordi dello schermo.
        // Z spinta a -1.5 per allineare meglio il pallino alla percezione della distanza.
        const x = (indexTip.x - 0.5) * 3.5; 
        const y = (0.5 - indexTip.y) * 3.5 + 1.5; 
        const z = -1.5; 

        handDot.setAttribute('position', {x, y, z});

        const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        
        if (distance < 0.06) {
            // SEI IN PINCH
            handDot.setAttribute('color', 'yellow');
            
            const dotWorldPos = new THREE.Vector3();
            handDot.object3D.getWorldPosition(dotWorldPos);
            ologram.setAttribute('position', dotWorldPos);
            
            const camRot = playerCamera.getAttribute('rotation');
            ologram.setAttribute('rotation', {x: 0, y: camRot.y, z: 0});

            // INVIO DATI OTTIMIZZATO (Ogni 50ms)
            const ora = Date.now();
            if (mqttClient.connected && (ora - ultimoInvio > 50)) {
                const dati = { x: dotWorldPos.x, y: dotWorldPos.y, z: dotWorldPos.z };
                mqttClient.publish(topicSegreto, JSON.stringify(dati));
                // ERRORE FIXATO: Uso di innerText al posto di setAttribute per il testo HTML
                if (debugText) debugText.innerText = 'DATI INVIATI IN TEMPO REALE!';
                ultimoInvio = ora;
            }
            
        } else {
            // MANO APERTA
            handDot.setAttribute('color', 'red');
            // ERRORE FIXATO
            if (debugText) debugText.innerText = 'MANO TROVATA!';
        }
    } else {
        // ERRORE FIXATO
        if (debugText) debugText.innerText = 'CERCO MANO...';
        handDot.setAttribute('visible', 'false');
    }
});

// --- AVVIO E FULLSCREEN ---
startButton.addEventListener('click', () => {
    startButton.style.display = 'none';
    
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    else if (document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();
    
    // QUALITÀ TELECAMERA ALZATA A 640x480 (Meno sgranata!)
    const camera = new Camera(videoElement, {
        onFrame: async () => { await hands.send({image: videoElement}); },
        width: 640, height: 480, facingMode: 'environment' 
    });
    
    camera.start()
        // ERRORE FIXATO
        .then(() => { if (debugText) debugText.innerText = 'CAMERA FLUIDA OK.'; })
        .catch((err) => { if (debugText) debugText.innerText = 'ERRORE CAM: ' + err.message; });
});
