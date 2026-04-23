const startButton = document.getElementById('start_btn');
const handDot = document.getElementById('hand-dot');
const ologram = document.getElementById('ologram-screen');
const playerCamera = document.getElementById('player-camera');
const debugText = document.getElementById('debug-text');
const marker = document.getElementById('hiro-marker');

// --- CONNESSIONE RETE MQTT ---
const mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
const topicSegreto = 'esame_ar_visore_2026_super_segreto';

mqttClient.on('connect', () => {
    console.log("Connesso al broker MQTT!");
});

// --- INIZIALIZZAZIONE MEDIAPIPE (Mani) ---
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

let ultimoInvio = 0; 
let videoSorgente = null;

hands.onResults((results) => {
    if (!videoSorgente) return;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDot.setAttribute('visible', 'true');
        
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        // --- MATEMATICA: Correzione Aspect Ratio Video vs Schermo ---
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const vidW = videoSorgente.videoWidth;
        const vidH = videoSorgente.videoHeight;
        
        const screenRatio = screenW / screenH;
        const vidRatio = vidW / vidH;
        
        let scale = 1, xOffset = 0, yOffset = 0;
        
        if (screenRatio > vidRatio) {
            scale = screenW / vidW;
            yOffset = (vidH * scale - screenH) / 2;
        } else {
            scale = screenH / vidH;
            xOffset = (vidW * scale - screenW) / 2;
        }
        
        // Trasformazione in pixel reali dello schermo
        const indexPixelX = indexTip.x * vidW * scale - xOffset;
        const indexPixelY = indexTip.y * vidH * scale - yOffset;
        const thumbPixelX = thumbTip.x * vidW * scale - xOffset;
        const thumbPixelY = thumbTip.y * vidH * scale - yOffset;

        // Coordinate normalizzate per A-Frame (-1 a 1)
        const ndcX = (indexPixelX / screenW) * 2 - 1;
        const ndcY = -(indexPixelY / screenH) * 2 + 1;

        const treCam = playerCamera.getObject3D('camera');
        if (treCam) {
            const vec = new THREE.Vector3(ndcX, ndcY, 0.5);
            vec.unproject(treCam);
            const camWorldPos = new THREE.Vector3();
            treCam.getWorldPosition(camWorldPos);
            vec.sub(camWorldPos).normalize();
            
            // Proiettiamo il pallino a 1.5 metri di distanza dallo schermo
            const targetPos = new THREE.Vector3().copy(camWorldPos).add(vec.multiplyScalar(1.5));
            handDot.setAttribute('position', targetPos);
        }

        // --- GESTIONE PINCH MILLIMETRICO ---
        const pinchDistance = Math.hypot(indexPixelX - thumbPixelX, indexPixelY - thumbPixelY);
        
        if (pinchDistance < 35) {
            handDot.setAttribute('color', 'yellow');
            
            const dotWorldPos = new THREE.Vector3();
            handDot.object3D.getWorldPosition(dotWorldPos);
            
            // TRASLAZIONE NELLO SPAZIO:
            // Se inquadriamo il marker, calcoliamo la posizione della mano relativa al marker
            if (marker.object3D.visible) {
                marker.object3D.worldToLocal(dotWorldPos);
                ologram.setAttribute('position', dotWorldPos);
            }

            // Invio dati al PC del professore (Max 20 volte al secondo per non intasare la rete)
            const ora = Date.now();
            if (mqttClient.connected && (ora - ultimoInvio > 50)) {
                const dati = { x: dotWorldPos.x, y: dotWorldPos.y, z: dotWorldPos.z };
                mqttClient.publish(topicSegreto, JSON.stringify(dati));
                if (debugText) debugText.innerText = 'PRESO (IN MOVIMENTO)!';
                ultimoInvio = ora;
            }
            
        } else {
            handDot.setAttribute('color', 'red');
            if (debugText) debugText.innerText = marker.object3D.visible ? 'MARKER AGGANCIATO. MANO APERTA.' : 'CERCA IL MARKER HIRO!';
        }
    } else {
        if (debugText) debugText.innerText = 'CERCO MANO...';
        handDot.setAttribute('visible', 'false');
    }
});

// --- AVVIO E CONDIVISIONE DELLA FOTOCAMERA ---
startButton.addEventListener('click', () => {
    startButton.style.display = 'none';
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    else if (document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();
    
    debugText.innerText = 'AVVIO SENSORI...';

    // Attendiamo che AR.js generi il tag <video> e lo "rubiamo" per l'Intelligenza Artificiale
    const controlloVideo = setInterval(() => {
        const videoTrovato = document.querySelector('video');
        if (videoTrovato && videoTrovato.videoWidth > 0) {
            clearInterval(controlloVideo);
            videoSorgente = videoTrovato;
            debugText.innerText = 'SISTEMI PRONTI.';
            
            // Invio continuo dei fotogrammi a MediaPipe
            async function inviaVideoAllIA() {
                await hands.send({image: videoSorgente});
                requestAnimationFrame(inviaVideoAllIA);
            }
            inviaVideoAllIA();
        }
    }, 500);
});
