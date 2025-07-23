document.addEventListener('DOMContentLoaded', function() {
  // Créer le HTML du widget
  const widgetHTML = `
    <div class="shuttle-widget" id="shuttleWidget">
      <div class="shuttle-header">
        <h3>Navettes Festival</h3>
        <button class="shuttle-close" id="closeShuttle">&times;</button>
      </div>
      <div class="shuttle-body">
        <ul class="shuttle-schedule">
          <li class="shuttle-day">
            <h4>Vendredi 25 juillet 2025 de 10h00 à 03h</h4>
            <ul class="shuttle-times">
              <li class="shuttle-time">De 10h à 18h ➔ Gare de Floreffe ⬌ Camping famille</li>
              <li class="shuttle-time">De 18h15 à 03h ➔ Abbaye Entrée 2 ⬌ Camping famille</li>
            </ul>
          </li>
          <li class="shuttle-day">
            <h4>Samedi 26 juillet 2025 de 11h00 à 03h</h4>
            <ul class="shuttle-times">
              <li class="shuttle-time">De 11h à 18h ➔ Gare de Floreffe ⬌ Camping famille</li>
              <li class="shuttle-time">De 18h15 à 03h ➔ Abbaye Entrée 2 ⬌ Camping famille</li>
            </ul>
          </li>
          <li class="shuttle-day">
            <h4>Dimanche 27 juillet 2025 de 11h00 à 02h00</h4>
            <ul class="shuttle-times">
              <li class="shuttle-time">De 11h à 18h ➔ Gare de Floreffe ⬌ Camping famille</li>
              <li class="shuttle-time">De 18h15 à 03h15 ➔ Abbaye Entrée 2 ⬌ Camping famille</li>
            </ul>
          </li>
          <li class="shuttle-day">
            <h4>Lundi 28 juillet 2025 de 08h00 à 12h00</h4>
            <ul class="shuttle-times">
              <li class="shuttle-time">De 08h à 12h ➔ Camping famille ⬌ Gare de Floreffe</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
    <button class="shuttle-toggle" id="shuttleToggle" title="Voir les horaires de navettes">
      🚌
    </button>
  `;

  // Ajouter le widget au corps du document
  document.body.insertAdjacentHTML('beforeend', widgetHTML);

  // Références aux éléments du DOM
  const shuttleToggle = document.getElementById('shuttleToggle');
  const shuttleWidget = document.getElementById('shuttleWidget');
  const closeButton = document.getElementById('closeShuttle');
  let isDragging = false;
  let offsetX, offsetY;

  // Gestionnaire d'événements pour le bouton de bascule
  shuttleToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    shuttleWidget.classList.toggle('visible');
    shuttleToggle.classList.toggle('animate', false);
    
    // Arrêter l'animation après la première ouverture
    if (shuttleWidget.classList.contains('visible')) {
      localStorage.setItem('shuttleWidgetSeen', 'true');
    }
  });

  // Gestionnaire d'événements pour le bouton de fermeture
  closeButton.addEventListener('click', function(e) {
    e.stopPropagation();
    shuttleWidget.classList.remove('visible');
  });

  // Fermer le widget en cliquant en dehors
  document.addEventListener('click', function(e) {
    if (!shuttleWidget.contains(e.target) && e.target !== shuttleToggle) {
      shuttleWidget.classList.remove('visible');
    }
  });

  // Empêcher la fermeture lors du clic à l'intérieur du widget
  shuttleWidget.addEventListener('click', function(e) {
    e.stopPropagation();
  });

  // Faire glisser le widget
  shuttleWidget.addEventListener('mousedown', function(e) {
    if (e.target === closeButton) return;
    
    isDragging = true;
    shuttleWidget.style.transition = 'none';
    
    const rect = shuttleWidget.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    
    shuttleWidget.style.left = (e.clientX - offsetX) + 'px';
    shuttleWidget.style.top = (e.clientY - offsetY) + 'px';
    shuttleWidget.style.right = 'auto';
    shuttleWidget.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', function() {
    isDragging = false;
    shuttleWidget.style.transition = 'all 0.3s ease';
  });

  // Animation du bouton au chargement de la page
  setTimeout(() => {
    if (!localStorage.getItem('shuttleWidgetSeen')) {
      shuttleToggle.classList.add('animate');
    }
  }, 2000);

  // Gestion du redimensionnement de la fenêtre
  window.addEventListener('resize', function() {
    if (window.innerWidth <= 576) {
      shuttleWidget.style.left = '';
      shuttleWidget.style.top = '';
      shuttleWidget.style.right = '20px';
      shuttleWidget.style.bottom = '90px';
    }
  });
});
