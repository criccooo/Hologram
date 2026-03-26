const videoElement = document.getElementById('hidden-video');
const handDot = document.getElementById('hand-dot');
const ologram = document.getElementById('ologram-screen');
const overlay = document.getElementById('start-overlay');

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults((results) => {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    const indexTip = landmarks[8]; 
    const thumbTip = landmarks[4]; 

    // Mappatura coordinate (X invertita per l'effetto specchio del visore)
    const x = (0.5 - indexTip.x) * 3; 
    const y = (0.5 - indexTip.y) * 2 + 1.6;
    const z = -1.5;

    handDot.setAttribute('position', {x, y, z});
    handDot.setAttribute('visible', 'true');

    // Calcolo distanza per il "Pizzico"
    const distance = Math.sqrt(
      Math.pow(indexTip.x - thumbTip.x, 2) + 
      Math.pow(indexTip.y - thumbTip.y, 2)
    );

    if (distance < 0.08) { 
      handDot.setAttribute('color', 'yellow');
      ologram.setAttribute('position', {x, y, z});
    } else {
      handDot.setAttribute('color', 'red');
    }
  } else {
    handDot.setAttribute('visible', 'false');
  }
});

// Questa funzione parte solo quando clicchi il bottone
function startExperience() {
  overlay.style.display = 'none'; // Nasconde il tasto
  
  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await hands.send({image: videoElement});
    },
    width: 640,
    height: 480
  });
  
  camera.start()
    .then(() => console.log("Fotocamera avviata con successo"))
    .catch(err => alert("Errore fotocamera: " + err));
}
