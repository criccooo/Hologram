const startButton = document.getElementById('start_btn');
const handDot = document.getElementById('hand-dot');
const ologram = document.getElementById('ologram-screen');
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

        // --- MATEMATICA DEL RITAGLIO (S23 FIX) ---
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const vidW = videoSorgente.videoWidth;
        const vidH = videoSorgente.videoHeight;

        // Calcoliamo quanto il video è stato scalato da AR.js per coprire l'intero schermo
        const scale = Math.max(screenW / vidW, screenH / vidH);
        
        // Dimensioni reali del video renderizzato (spesso più grandi dello schermo stesso)
        const renderedW = vidW * scale;
        const renderedH = vidH * scale;

        // Calcoliamo quanti pixel sono stati "tagliati" ai bordi (Crop)
        const offsetX = (renderedW - screenW) / 2;
        const offsetY = (renderedH - screenH) / 2;

        // Mappiamo le coordinate IA sui pixel esatti del display del tuo telefono
        const indexPixelX = (indexTip.x * renderedW) - offsetX;
        const indexPixelY = (indexTip.y * renderedH) - offsetY;
        const thumbPixelX = (thumbTip.x * renderedW) - offsetX;
        const thumbPixelY = (thumbTip.y * renderedH) - offsetY;

        // Trasformiamo in coordinate normalizzate per il motore 3D (-1 a +1)
        const ndcX = (indexPixelX / screenW) * 2 - 1;
        const ndcY = -(indexPixelY / screenH) * 2 + 1;

        // Posizioniamo il pallino sull'HUD della telecamera.
        // Fattore 1.8 regola l'apertura del FOV su schermi 19.5:9
        handDot.setAttribute('position', `${ndcX * 1.8} ${ndcY * 1.8} -2`);

        // --- CALIBRAZIONE PINCH IN PIXEL REALI ---
        // Sul display ad alta densità del S23, misuriamo i pixel fisici di distanza tra le dita
        const pinchDistance = Math.hypot(indexPixelX - thumbPixelX, indexPixelY - thumbPixelY);
        
        // 60 pixel di distanza sul display del telefono equivale a dita chiuse
        if (pinchDistance < 60) {
            handDot.setAttribute('color', 'yellow');
            
            // Otteniamo la posizione 3D globale del pallino giallo
            const dotWorldPos = new THREE.Vector3();
            handDot.object3D.getWorldPosition(dotWorldPos);
            
            // Se il marker è visibile, calcoliamo la posizione dell'oggetto rispetto al marker
            if (marker.object3D.visible) {
                marker.object3D.worldToLocal(dotWorldPos);
                ologram.setAttribute('position', dotWorldPos);
            }

            // Trasmissione rete
            const ora = Date.now();
            if (mqttClient.connected && (ora - ultimoInvio > 50)) {
                const dati = { x: dotWorldPos.x, y: dotWorldPos.y, z: dotWorldPos.z };
                mqttClient.publish(topicSegreto, JSON.stringify(dati));
                if (debugText) debugText.innerText = 'PRESO!';
                ultimoInvio = ora;
            }
            
        } else {
            handDot.setAttribute('color', 'red');
            if (debugText) debugText.innerText = marker.object3D.visible ? 'MANO APERTA' : 'INQUADRA IL MARKER!';
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

    const controlloVideo = setInterval(() => {
        const videoTrovato = document.querySelector('video');
        if (videoTrovato && videoTrovato.videoWidth > 0) {
            clearInterval(controlloVideo);
            videoSorgente = videoTrovato;
            debugText.innerText = 'SISTEMI PRONTI.';
            
            async function inviaVideoAllIA() {
                await hands.send({image: videoSorgente});
                requestAnimationFrame(inviaVideoAllIA);
            }
            inviaVideoAllIA();
        }
    }, 500);
});
