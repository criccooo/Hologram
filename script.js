AFRAME.registerComponent('tap-to-place', {
  init: function () {
    const reticle = document.getElementById('reticle');
    const screen = document.getElementById('ologram-screen');
    const sceneEl = this.el; // La nostra scena AR
    
    let objectPlaced = false;

    // Ascoltiamo l'evento specifico dell'hit-test di A-Frame
    sceneEl.addEventListener('ar-hit-test-select', function () {
      if (objectPlaced) return; 

      // 1. Prendi le coordinate attuali del mirino verde
      const position = reticle.getAttribute('position');

      // 2. Sposta lo schermo lì, alzato di 45cm (0.45) in altezza (Y)
      screen.setAttribute('position', { x: position.x, y: position.y + 0.45, z: position.z });
      
      // 3. Fallo ruotare per guardare verso la telecamera
      const cameraYRotation = document.querySelector('a-camera').getAttribute('rotation').y;
      screen.setAttribute('rotation', { x: 0, y: cameraYRotation, z: 0 });

      // 4. Mostra lo schermo e nascondi il mirino
      screen.setAttribute('visible', 'true');
      reticle.setAttribute('visible', 'false');
      
      // 5. Spegni il radar spaziale per non consumare batteria
      sceneEl.removeAttribute('ar-hit-test');
      
      objectPlaced = true;
    });
  }
});
