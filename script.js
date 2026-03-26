// Registriamo un componente personalizzato di A-Frame per gestire l'AR
AFRAME.registerComponent('ar-controller', {
  init: function () {
    const reticle = document.getElementById('reticle');
    const screen = document.getElementById('ologram-screen');
    const sceneEl = this.el;
    
    let objectPlaced = false;

    // Quando entriamo in AR e il telefono fa la scansione del pavimento...
    sceneEl.addEventListener('enter-vr', () => {
      if (sceneEl.is('ar-mode')) {
        console.log("Siamo in WebXR AR!");
        // Aggiungiamo il cursore di puntamento
        sceneEl.setAttribute('ar-hit-test', 'target: #reticle');
      }
    });

    // Quando il telefono trova una superficie piana (pavimento o tavolo)
    sceneEl.addEventListener('ar-hit-test-start', () => {
      if (!objectPlaced) reticle.setAttribute('visible', 'true');
    });

    // Aggiorna la posizione del cerchio verde sul pavimento mentre muovi il telefono
    sceneEl.addEventListener('ar-hit-test-achieved', (e) => {
      if (objectPlaced) return;
      reticle.setAttribute('visible', 'true');
    });

    // Quando tocchi lo schermo del telefono con il dito (il nostro trigger per ora)
    sceneEl.addEventListener('ar-hit-test-select', () => {
      if (objectPlaced) return; // Se l'abbiamo già piazzato, ignora

      // Prendi le coordinate attuali del cerchio verde
      const position = reticle.getAttribute('position');
      
      // Sposta lo schermo esattamente in quel punto, ma alzalo di 45 cm (0.45) per farlo stare in piedi
      screen.setAttribute('position', { x: position.x, y: position.y + 0.45, z: position.z });
      
      // Fallo ruotare per guardare verso la tua telecamera (orientamento base)
      const cameraYRotation = document.querySelector('a-camera').getAttribute('rotation').y;
      screen.setAttribute('rotation', { x: 0, y: cameraYRotation, z: 0 });

      // Nascondi il mirino e mostra lo schermo
      reticle.setAttribute('visible', 'false');
      screen.setAttribute('visible', 'true');
      
      objectPlaced = true;
      
      // Disattiviamo la scansione per risparmiare batteria
      sceneEl.removeAttribute('ar-hit-test');
    });
  }
});
