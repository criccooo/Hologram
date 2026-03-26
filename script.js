const aiCursor = document.getElementById('ai-cursor');

hands.onResults((results) => {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    // Rendiamo visibile la palla rossa
    aiCursor.setAttribute('visible', 'true');
    
    // Prendiamo il punto 8 (la punta del tuo dito indice)
    const indexFinger = results.multiHandLandmarks[0][8];
    
    // Mappatura matematica: trasformiamo le coordinate dello schermo
    // in coordinate 3D davanti alla telecamera del telefono
    const mappedX = (indexFinger.x - 0.5) * 0.6; 
    const mappedY = -(indexFinger.y - 0.5) * 0.6; // La Y in 3D è al contrario
    
    // Spostiamo la palla rossa! (z è fisso a -0.5, cioè mezzo metro davanti ai tuoi occhi)
    aiCursor.setAttribute('position', { x: mappedX, y: mappedY, z: -0.5 });
    
  } else {
    // Se nascondi la mano, la palla sparisce
    aiCursor.setAttribute('visible', 'false');
  }
});
