const startButton = document.getElementById('start_btn');
const htmlHandDot = document.getElementById('html-hand-dot');
const ologram = document.getElementById('ologram-screen');
const debugText = document.getElementById('debug-text');
const marker = document.getElementById('hiro-marker');

// --- CONNESSIONE RETE MQTT ---
const mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
const topicSegreto = 'esame_ar_visore_2026_super_segreto';

mqttClient.on('connect', () => {
    console.log("Connesso al broker MQTT!");
});

const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

let ultimoInvio = 0; 
let videoSorgente = null;

// Variabili per il trascinamento morbido (Relative Dragging)
let isDragging = false;
let startHandX = 0;
let startHandY = 0;
let startObjX = 0;
let startObjZ = 0;

hands.onResults((results) => {
    if (!videoSorgente) return;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        htmlHandDot.style.display = 'block';
        
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        // 1. POSIZIONAMENTO 2D ASSOLUTO (PERFETTO PER S23)
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

        // Muove il pallino HTML in 2D
        htmlHandDot.style.left = `${indexPixelX}px`;
        htmlHandDot.style.top = `${indexPixelY}px`;

        // Coordinate normalizzate per il calcolo dello scarto
        const ndcX = (indexPixelX / screenW) * 2 - 1;
        const ndcY = -(indexPixelY / screenH) * 2 + 1;

        // 2. LOGICA DEL PINCH (Distanza relativa dell'IA)
        const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        const isPinching = pinchDist < 0.05;

        if (isPinching) {
            htmlHandDot.style.backgroundColor = 'yellow';
            
            if (marker.object3D.visible) {
                if (!isDragging) {
                    // --- INIZIO TRASCINAMENTO ---
                    // Registriamo dove si trova la mano e dove si trova l'oggetto in questo istante
                    isDragging = true;
                    startHandX = ndcX;
                    startHandY = ndcY;
                    
                    const objPos = ologram.getAttribute('position');
                    startObjX = objPos.x;
                    startObjZ = objPos.z;
                } else {
                    // --- DURANTE IL TRASCINAMENTO ---
                    // Calcoliamo SOLO la differenza (delta) di quanto si è mossa la mano
                    const deltaX = (ndcX - startHandX) * 2; // Moltiplicatore di velocità
                    const deltaZ = -(ndcY - startHandY) * 2;
                    
                    const newPosX = startObjX + deltaX;
                    const newPosZ = startObjZ + deltaZ;
                    
                    // Applichiamo la nuova posizione mantenendo l'altezza a 0.5
                    ologram.setAttribute('position', `${newPosX} 0.5 ${newPosZ}`);

                    // Invio rete
                    const ora = Date.now();
                    if (mqttClient.connected && (ora - ultimoInvio > 50)) {
                        const dati = { x: newPosX, y: 0.5, z: newPosZ };
                        mqttClient.publish(topicSegreto, JSON.stringify(dati));
                        if (debugText) debugText.innerText = 'TRASCINAMENTO IN CORSO...';
                        ultimoInvio = ora;
                    }
                }
            }
        } else {
            htmlHandDot.style.backgroundColor = 'red';
            isDragging = false; // Rilasciamo l'oggetto
            if (debugText) debugText.innerText = marker.object3D.visible ? 'MANO APERTA' : 'INQUADRA IL MARKER HIRO';
        }
    } else {
        if (debugText) debugText.innerText = 'CERCO MANO...';
        htmlHandDot.style.display = 'none';
        isDragging = false;
    }
});

// --- AVVIO SISTEMI ---
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
