const reticle = document.getElementById('reticle');
const screen = document.getElementById('ologram-screen');
const sceneEl = document.querySelector('a-scene');

let objectPlaced = false;

sceneEl.addEventListener('select', function () {
  // Se abbiamo già piazzato l'oggetto, non fare più nulla
  if (objectPlaced) return; 

  // 1. Prendi le coordinate attuali del mirino verde
  const position = reticle.getAttribute('position');

  // 2. Sposta lo schermo lì, alzato di 45cm
  screen.setAttribute('position', { x: position.x, y: position.y + 0.45, z: position.z });
  
  // 3. Fallo ruotare per guardare verso la telecamera
  const cameraYRotation = document.querySelector('a-camera').getAttribute('rotation').y;
  screen.setAttribute('rotation', { x: 0, y: cameraYRotation, z: 0 });

  // 4. Mostra lo schermo e nascondi per sempre il mirino
  screen.setAttribute('visible', 'true');
  reticle.setAttribute('visible', 'false');
  
  // 5. Spegni il radar spaziale per non consumare batteria
  sceneEl.removeAttribute('ar-hit-test');
  
  objectPlaced = true;
});
