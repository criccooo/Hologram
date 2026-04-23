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

        // --- TRACKING DRITTO (Asse X non invertito) ---
        const ndcX = (indexTip.x * 2) - 1; 
        const ndcY = -(indexTip.y * 2) + 1;

        const treCam = playerCamera.getObject3D('camera');
        if (treCam) {
            const vec = new THREE.Vector3(ndcX, ndcY, 0.5);
            vec.unproject(treCam);
            
            const camWorldPos = new THREE.Vector3();
            treCam.getWorldPosition(camWorldPos);

            vec.sub(camWorldPos).normalize();
            
            const targetPos = new THREE.Vector3().copy(camWorldPos).add(vec.multiplyScalar(1.5));
            handDot.setAttribute('position', targetPos);
        }

        // Calcolo millimetrico della distanza tra indice e pollice
        const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        
        // --- PINCH ESTREMAMENTE SEVERO (Solo tocco effettivo) ---
        if (distance < 0.03) {
            handDot.setAttribute('color', 'yellow');
            
            const dotWorldPos = new THREE.Vector3();
            handDot.object3D.getWorldPosition(dotWorldPos);
            
            ologram.setAttribute('position', dotWorldPos);
            
            const camRot = playerCamera.getAttribute('rotation');
            ologram.setAttribute('rotation', {x: 0, y: camRot.y, z: 0});

            const ora = Date.now();
            if (mqttClient.connected && (ora - ultimoInvio > 50)) {
                const dati = { x: dotWorldPos.x, y: dotWorldPos.y, z: dotWorldPos.z };
                mqttClient.publish(topicSegreto, JSON.stringify(dati));
                if (debugText) debugText.innerText = 'PRESO!';
                ultimoInvio = ora;
            }
            
        } else {
            handDot.setAttribute('color', 'red');
            if (debugText) debugText.innerText = 'MANO PRONTA';
        }
    } else {
        if (debugText) debugText.innerText = 'CERCO MANO...';
        handDot.setAttribute('visible', 'false');
    }
});

// --- AVVIO E SBLOCCO SENSORI ---
startButton.addEventListener('click', () => {
    
    // Richiesta permessi iOS/Android per il Giroscopio (Evita l'effetto incollato)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    console.log("Sensori Sbloccati!");
                } else {
                    alert("Attenzione: senza i sensori l'oggetto rimarrà incollato allo schermo!");
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
        .then(() => { if (debugText) debugText.innerText = 'SISTEMA PRONTO.'; })
        .catch((err) => { if (debugText) debugText.innerText = 'ERRORE: ' + err.message; });
});
