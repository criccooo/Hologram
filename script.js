const videoElement = document.getElementById('hidden-video');
const handDot = document.getElementById('hand-dot');
const ologram = document.getElementById('ologram-screen');

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});

hands.onResults((results) => {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    const indexTip = landmarks[8]; // Punta Indice
    const thumbTip = landmarks[4]; // Punta Pollice

    // Mappatura coordinate (X e Y del video -> X e Y del mondo 3D)
    // Usiamo valori più ampi per coprire tutto lo schermo del visore
    const x = (indexTip.x - 0.5) * 2.5;
    const y = -(indexTip.y - 0.5) * 1.8 + 1.2;
    const z = -1; // Lo teniamo a 1 metro di distanza

    handDot.setAttribute('position', {x, y, z});
    handDot.setAttribute('visible', 'true');

    // CALCOLO DISTANZA PER IL "GRAB" (Pizzico)
    const dx = indexTip.x - thumbTip.x;
    const dy = indexTip.y - thumbTip.y;
    const distance = Math.sqrt(dx*dx + dy*dy);

    if (distance < 0.06) { 
      // SE PIZZIchi: lo schermo diventa giallo e segue la mano
      handDot.setAttribute('color', 'yellow');
      ologram.setAttribute('position', {x, y, z});
    } else {
      // SE LASCI: lo schermo torna verde e resta fermo lì
      handDot.setAttribute('color', 'red');
    }
  } else {
    handDot.setAttribute('visible', 'false');
  }
});

const camera = new Camera(videoElement, {
  onFrame: async () => { await hands.send({image: videoElement}); },
  width: 1280, height: 720
});
camera.start();
