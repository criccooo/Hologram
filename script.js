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

// --- SETUP MEDIAPIPE (OTTIMIZZATO PER EVITARE LAG) ---
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
// modelComplexity: 0 rende l'IA molto più leggera e veloce sul telefono
hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

// Variabile per il "limite di velocità" di Internet
let ultimoInvio = 0; 

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDot.setAttribute('visible', 'true');
        
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        // 1. CORREZIONE ALTEZZA: Aggiungiamo + 1.5 per alzarla ad altezza occhi!
        // Abbiamo anche invertito la X (0.5 - indexTip.x) se la mano ti faceva effetto specchio
        const x = (0.5 - indexTip.x) * 2; 
        const y = (0.5 - indexTip.y) * 2 + 1.5; 
        const z = -1;

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

            // 2. CORREZIONE LAG RETE: Inviamo i dati solo ogni 50 millisecondi
            const ora = Date.now();
            if (mqttClient.connected && (ora - ultimoInvio > 50)) {
                const dati = { x: dotWorldPos.x, y: dotWorldPos.y, z: dotWorldPos.z };
                mqttClient.publish(topicSegreto, JSON.stringify(dati));
                if (debugText) debugText.setAttribute('value', 'DATI INVIATI IN TEMPO REALE!');
                ultimoInvio = ora; // Aggiorna il timer
            }
            
        } else {
            // MANO APERTA
            handDot.setAttribute('color', 'red');
            if (debugText) debugText.setAttribute('value', 'MANO TROVATA!');
        }
    } else {
        if (debugText) debugText.setAttribute('value', 'CERCO MANO...');
        handDot.setAttribute('visible', 'false');
    }
});

// --- AVVIO E FULLSCREEN ---
startButton.addEventListener('click', () => {
    startButton.style.display = 'none';
    
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    else if (document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();
    
    // 3. CORREZIONE LAG FOTOCAMERA: Risoluzione 320x240 (molto più fluida da calcolare)
    const camera = new Camera(videoElement, {
        onFrame: async () => { await hands.send({image: videoElement}); },
        width: 320, height: 240, facingMode: 'environment' 
    });
    
    camera.start()
        .then(() => { if (debugText) debugText.setAttribute('value', 'CAMERA FLUIDA OK.'); })
        .catch((err) => { if (debugText) debugText.setAttribute('value', 'ERRORE CAM: ' + err.message); });
});
