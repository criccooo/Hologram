const videoElement = document.getElementById('input_video');
const startButton = document.getElementById('start_btn');
const handDot = document.getElementById('hand-dot');
const ologram = document.getElementById('ologram-screen');
const playerCamera = document.getElementById('player-camera');
const debugText = document.getElementById('debug-text');

// --- CONNESSIONE SERVER PUBBLICO ---
const mqttClient = mqtt.connect('wss://broker.hivemq.com:8000/mqtt');
const topicSegreto = 'esame_ar_visore_2026_super_segreto'; // Nome del canale

mqttClient.on('connect', () => {
    console.log("Connesso a Internet!");
});

// --- SETUP MEDIAPIPE ---
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        debugText.setAttribute('value', 'MANO TROVATA!');
        handDot.setAttribute('visible', 'true');
        
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        const x = (indexTip.x - 0.5) * 2; 
        const y = (0.5 - indexTip.y) * 2;
        const z = -1;

        handDot.setAttribute('position', {x, y, z});

        const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        
        if (distance < 0.06) {
            handDot.setAttribute('color', 'yellow');
            debugText.setAttribute('value', 'PRESO!');
            
            const dotWorldPos = new THREE.Vector3();
            handDot.object3D.getWorldPosition(dotWorldPos);
            ologram.setAttribute('position', dotWorldPos);
            
            const camRot = playerCamera.getAttribute('rotation');
            ologram.setAttribute('rotation', {x: 0, y: camRot.y, z: 0});

            // SPEDIAMO LE COORDINATE AL PROFESSORE VIA INTERNET
            if (mqttClient.connected) {
                const dati = { x: dotWorldPos.x, y: dotWorldPos.y, z: dotWorldPos.z };
                mqttClient.publish(topicSegreto, JSON.stringify(dati));
            }
            
        } else {
            handDot.setAttribute('color', 'red');
        }
    } else {
        debugText.setAttribute('value', 'CERCO MANO...');
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
        .then(() => debugText.setAttribute('value', 'CAMERA OK. CERCO MANO...'))
        .catch((err) => debugText.setAttribute('value', 'ERRORE CAM: ' + err.message));
});;
