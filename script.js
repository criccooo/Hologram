const videoElement = document.getElementById('input_video');
const startButton = document.getElementById('start_btn');
const handDot = document.getElementById('hand-dot');
const ologram = document.getElementById('ologram-screen');
const playerCamera = document.getElementById('player-camera');
const debugText = document.getElementById('debug-text');

// --- CONNESSIONE SERVER PUBBLICO (IL POSTINO) ---
const mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
const topicSegreto = 'esame_ar_visore_2026_super_segreto';

mqttClient.on('connect', () => {
    console.log("Telefono connesso a Internet tramite EMQX!");
});

// --- SETUP MEDIAPIPE (INTELLIGENZA ARTIFICIALE) ---
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDot.setAttribute('visible', 'true');
        
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        // Mappatura coordinate
        const x = (indexTip.x - 0.5) * 2; 
        const y = (0.5 - indexTip.y) * 2;
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

            // --- SPEDIAMO LE COORDINATE VIA INTERNET ---
            if (mqttClient.connected) {
                const dati = { x: dotWorldPos.x, y: dotWorldPos.y, z: dotWorldPos.z };
                mqttClient.publish(topicSegreto, JSON.stringify(dati));
                if (debugText) debugText.setAttribute('value', 'DATI INVIATI!');
            } else {
                if (debugText) debugText.setAttribute('value', 'ERRORE RETE TELEFONO');
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
    
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().catch(console.error);
    }

    const camera = new Camera(videoElement, {
        onFrame: async () => { await hands.send({image: videoElement}); },
        width: 640, height: 480, facingMode: 'environment' 
    });
    
    camera.start()
        .then(() => { if (debugText) debugText.setAttribute('value', 'CAMERA OK. CERCO MANO...'); })
        .catch((err) => { if (debugText) debugText.setAttribute('value', 'ERRORE CAM: ' + err.message); });
});
