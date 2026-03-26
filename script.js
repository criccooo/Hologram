const reticle = document.getElementById('reticle');
const screen = document.getElementById('ologram-screen');
const sceneEl = document.querySelector('a-scene');

let objectPlaced = false;

// In WebXR puro, quando l'utente tocca lo schermo scatta l'evento 'select'
sceneEl.addEventListener('select', function () {
  if (objectPlaced) return; // Se abbiamo già piazzato lo schermo, ignora i tocchi successivi
  
  // Assicuriamoci che il mirino sia visibile (cioè che stia leggendo un pavimento)
  if (!reticle.getAttribute('visible')) return; 

  // 1. Prendi la posizione esatta del cerchio verde
  const position = reticle.getAttribute('position');

  // 2. Sposta lo schermo lì, ma alzalo di 45cm (0.45) in Y per farlo stare "in piedi"
  screen.setAttribute('position', { x: position.x, y: position.y + 0.45, z: position.z });
  
  // 3. Fallo ruotare in modo che guardi verso di te (legge la rotazione Y della telecamera)
  const cameraYRotation = document.querySelector('a-camera').getAttribute('rotation').y;
  screen.setAttribute('rotation', { x: 0, y: cameraYRotation, z: 0 });

  // 4. Mostra lo schermo e nascondi il mirino
  screen.setAttribute('visible', 'true');
  reticle.setAttribute('visible', 'false');
  
  // 5. Spegni il calcolo del pavimento per risparmiare batteria
  sceneEl.removeAttribute('ar-hit-test');
  
  objectPlaced = true;
});
