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

// --- INIZIALIZZAZIONE MEDIAPIPE ---
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

        // --- 1. IL PALLINO SULLO SCHERMO (HUD) ---
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const vidW = videoSorgente.videoWidth;
        const vidH = videoSorgente.videoHeight;
        const scale = Math.max(screenW / vidW, screenH / vidH);
        
        const renderedW = vidW * scale;
        const renderedH = vidH * scale;
        const offsetX = (renderedW - screenW) / 2;
        const offsetY = (renderedH - screenH) / 2;

        const indexPixelX = (indexTip.x * renderedW) - offsetX;
        const indexPixelY = (indexTip.y * renderedH) - offsetY;

        const ndcX = (indexPixelX / screenW) * 2 - 1;
        const ndcY = -(indexPixelY / screenH) * 2 + 1;

        handDot.setAttribute('position', `${ndcX * 1.8} ${ndcY * 1.8} -2`);

        // --- 2. IL PINCH (Calcolato con i dati puri dell'IA, infallibile) ---
        // MediaPipe fornisce valori da 0.0 a 1.0. 
        // Se la distanza tra le dita è minore di 0.05 (5%), è un pinch!
        const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        const isPinching = pinchDist < 0.05;

        if (isPinching) {
            handDot.setAttribute('color', 'yellow');
            
            // --- 3. SPOSTAMENTO A "SCACCHIERA" SUL MARKER ---
            if (marker.object3D.visible) {
                // Invece di teletrasportarlo in 3D, mappiamo le coordinate dello schermo 
                // direttamente sulla superficie piatta del marker sul tavolo.
                // Moltiplichiamo per 2 per dare un raggio d'azione di un paio di metri virtuali.
                const posX = ndcX * 2; 
                const posZ = -ndcY * 2; // Invertiamo la Y per farla diventare profondità
                
                // Mantiene l'altezza fissa (0.5), così non sprofonda nel tavolo o vola via
                ologram.setAttribute('position', `${posX} 0.5 ${posZ}`);

                // Inviamo le coordinate piatte al PC
                const ora = Date.now();
                if (mqttClient.connected && (ora - ultimoInvio > 50)) {
                    const dati = { x: posX, y: 0.5, z: posZ };
                    mqttClient.publish(topicSegreto, JSON.stringify(dati));
                    if (debugText) debugText.innerText = 'OGGETTO IN MOVIMENTO!';
                    ultimoInvio = ora;
                }
            }
        } else {
            handDot.setAttribute('color', 'red');
            if (debugText) debugText.innerText = marker.object3D.visible ? 'MANO APERTA' : 'INQUADRA IL MARKER HIRO';
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
