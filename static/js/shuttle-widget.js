// Vérifier si le widget est déjà chargé
if (window.shuttleWidgetLoaded) {
  console.warn('Le widget de navette est déjà chargé');
} else {
  window.shuttleWidgetLoaded = true;
  
  // Attendre que le DOM soit complètement chargé
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShuttleWidget);
  } else {
    // Le DOM est déjà chargé, initialiser immédiatement
    setTimeout(initShuttleWidget, 0);
  }
}

function initShuttleWidget() {
  // ID de la gare de Floreffe (code SNCB)
  const FLOREFFE_STATION_ID = '008891309';
  
  // Fonction pour formater l'heure
  function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
  }
  
  // Fonction pour formater le retard
  function formatDelay(delay) {
    if (!delay || isNaN(delay)) return '';
    delay = parseInt(delay, 10);
    if (delay < 60) return `${delay}s`;
    if (delay < 3600) return `${Math.floor(delay/60)}min${delay%60 ? ' '+(delay%60)+'s' : ''}`;
    return `${Math.floor(delay/3600)}h${Math.floor((delay%3600)/60) ? ' '+Math.floor((delay%3600)/60)+'min' : ''}`;
  }
  
  // Fonction pour obtenir le statut du train
  function getTrainStatus(departure) {
    if (departure.canceled === '1') return { text: 'Supprimé', class: 'cancelled' };
    if (departure.delay && departure.delay !== '0') return { text: `Retard: ${formatDelay(departure.delay)}`, class: 'delayed' };
    return { text: 'À l\'heure', class: 'on-time' };
  }
  
  // Fonction pour charger les horaires des trains
  async function loadTrainSchedule() {
    window.currentTrainStation = 'Floreffe';

    const trainContent = document.getElementById('trainContent');
    if (!trainContent) return;
    
    // Afficher le chargement
    trainContent.innerHTML = `
      <div class="loading-trains">
        <div class="loading-spinner"></div>
        <div>Chargement des horaires...</div>
      </div>
    `;
    
    try {
      // --- CACHE JS 2 MINUTES ---
      const cacheKey = 'trainCache_' + (window.currentTrainStation || 'Floreffe');
      const cache = window.localStorage.getItem(cacheKey);
      let data = null;
      if (cache) {
        try {
          const parsed = JSON.parse(cache);
          if (parsed.timestamp && (Date.now() - parsed.timestamp) < 2*60*1000 && parsed.data) {
            data = parsed.data;
          }
        } catch {}
      }
      if (!data) {
        // Utiliser la route d'API côté serveur
        const response = await fetch('/api/trains/departures');
        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }
        data = await response.json();
        window.localStorage.setItem(cacheKey, JSON.stringify({timestamp: Date.now(), data}));
      }
      
      // Vérifier s'il y a une erreur dans la réponse
      if (data.error) {
        throw new Error(data.details || 'Erreur inconnue');
      }
      
      if (!data.connection || data.connection.length === 0) {
        trainContent.innerHTML = `
          <div class="info-message">
            Aucun train prévu pour le moment
          </div>
        `;
        return;
      }
      
      // Filtrer les doublons : un seul par numéro de train + heure de départ
      const seen = new Set();
      const uniqueConnections = [];
      data.connection.forEach(conn => {
        const trainNum = conn.departure.vehicleinfo?.shortname || '';
        const depTime = conn.departure.time;
        const key = `${trainNum}_${depTime}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueConnections.push(conn);
        }
      });
      let html = `
        <table class="train-table">
          <thead>
            <tr>
              <th style="text-align:center;width:56px">Départ</th>
              <th style="text-align:left;width:80px">Train</th>
              <th style="text-align:center;width:55px">Quai</th>
              <th style="text-align:left;min-width:120px;max-width:170px;white-space:nowrap">Destination</th>
              <th style="text-align:center;width:90px">Statut</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      uniqueConnections.slice(0, 8).forEach((connection, idx) => {
        const departure = connection.departure;
        const arrival = connection.arrival;
        const status = getTrainStatus(departure);
        const platform = departure.platform || '?';
        
        // Formater les heures
        const departureTime = new Date(departure.time * 1000).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
        const arrivalTime = new Date(arrival.time * 1000).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
        
        // Destination claire
        const destination = connection.arrival?.stationinfo?.name || connection.arrival?.station || connection.direction?.name || 'Destination inconnue';
        
        // Récupérer le numéro du train si disponible
        const trainNumber = connection.departure.vehicleinfo?.shortname || '';
        
        // Calculer l'heure retardée si nécessaire
        let delayedTimeHtml = '';
        if (status.class === 'delayed') {
          const delayedTime = new Date((parseInt(departure.time) + parseInt(departure.delay)) * 1000)
            .toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
          delayedTimeHtml = `
            <div class="delayed-info">
              <span class="original-time">${departureTime}</span>
              <span class="delayed-arrow">→</span>
              <span class="delayed-time">${delayedTime}</span>
            </div>`;
        }
        
        // Préparer la liste des arrêts (stops)
        let stopsHtml = '';
        if (connection.stops && connection.stops.stop && Array.isArray(connection.stops.stop)) {
          stopsHtml = '<ul class="stops-list">';
          connection.stops.stop.forEach(stop => {
            stopsHtml += `<li class="stop-station clickable-stop" data-station="${stop.station}" data-stationname="${stop.stationinfo?.name || stop.station}">
              <span class="stop-time">${formatTime(stop.time)}</span>
              <span class="stop-name">${stop.stationinfo?.name || stop.station}</span>
            </li>`;
          });
          stopsHtml += '</ul>';
        }
        
        html += `
          <tr class="train-time ${status.class} clickable-train" data-train-idx="${idx}">
            <td data-label="Départ" style="text-align:center;vertical-align:middle;">
              <span class="time" style="font-size:1.09em;font-weight:600;">${departureTime}</span>
              ${status.class === 'delayed' ? `<div class='train-delay-small'>${status.text}</div>` : ''}
            </td>
            <td data-label="Train" style="vertical-align:middle;">
              <span class="train-number" style="font-size:1em;font-weight:500;">${trainNumber ? `<span class='train-num-badge'>${trainNumber}</span>` : 'Train'}</span>
            </td>
            <td data-label="Quai" style="text-align:center;vertical-align:middle;">
              <span class="train-platform" style="font-size:0.97em;">${platform}</span>
            </td>
            <td data-label="Destination" style="vertical-align:middle;">
              <span class="destination-label badge-dest ${destination.toLowerCase().includes('wavre') ? 'dest-wavre' : destination.toLowerCase().includes('jambe') ? 'dest-jambe' : ''}">
                ${destination.toLowerCase().includes('wavre') ? '🔵' : destination.toLowerCase().includes('jambe') ? '🟣' : ''} ${destination}
              </span>
            </td>
            <td data-label="Statut" style="text-align:center;vertical-align:middle;">
              <span class="train-status status-${status.class}" style="font-size:0.97em;">${status.class === 'delayed' ? '' : status.text}</span>
              ${status.class === 'delayed' ? delayedTimeHtml : ''}
            </td>
          </tr>
          <tr class="train-stops-row" style="display:none;">
            <td colspan="5">
              <div class="train-stops-list">${stopsHtml}</div>
            </td>
          </tr>
        `;
      });
      
      html += '</tbody></table>';
      trainContent.innerHTML = html;

      // Ajout de l'interactivité pour déplier les arrêts
      trainContent.querySelectorAll('.clickable-train').forEach((el, idx) => {
        el.addEventListener('click', function(e) {
          e.stopPropagation();
          const trainLi = el.closest('li.train-time');
          const stopsDiv = trainLi.querySelector('.train-stops-list');
          if (!stopsDiv) return;
          // Fermer les autres
          trainContent.querySelectorAll('.train-stops-list').forEach(div => {
            if (div !== stopsDiv) div.style.display = 'none';
          });
          // Toggle
          stopsDiv.style.display = stopsDiv.style.display === 'none' ? 'block' : 'none';
        });
      });

      // Ajout de l'interactivité sur les gares (stops)
      trainContent.querySelectorAll('.clickable-stop').forEach(el => {
        el.addEventListener('click', function(e) {
          e.stopPropagation();
          const stationName = el.getAttribute('data-stationname');
          if (!stationName) return;
          // Charger les trains pour cette gare
          loadTrainScheduleForStation(stationName);
        });
      });

      // Bouton retour si on n'est pas à Floreffe
      if (window.currentTrainStation && window.currentTrainStation !== 'Floreffe') {
        const backBtn = document.createElement('button');
        backBtn.textContent = 'Retour à Floreffe';
        backBtn.className = 'back-to-floreffe';
        backBtn.onclick = () => {
          loadTrainScheduleForStation('Floreffe');
        };
        trainContent.prepend(backBtn);
      }
      
    } catch (error) {
      console.error('Erreur lors du chargement des horaires:', error);
      trainContent.innerHTML = `
        <div class="error-message">
          Impossible de charger les horaires. Veuillez réessayer plus tard.
          ${error.message ? `<br><small>${error.message}</small>` : ''}
        </div>
      `;
    }
  }
  
  // Créer un conteneur isolé pour le widget
  let widgetContainer = document.getElementById('shuttle-widget-container');
  
  // Si le conteneur existe déjà, le supprimer pour éviter les doublons
  if (widgetContainer) {
    widgetContainer.remove();
  }
  
  // Créer un nouveau conteneur
  widgetContainer = document.createElement('div');
  widgetContainer.id = 'shuttle-widget-container';
  widgetContainer.style.position = 'fixed';
  widgetContainer.style.zIndex = '9999';
  widgetContainer.style.bottom = '20px';
  widgetContainer.style.right = '20px';
  
  // Créer le HTML du widget
  const widgetHTML = `
    <div class="shuttle-widget" id="shuttleWidget">
      <div class="shuttle-header">
        <h3>🚍 Horaires des Transports</h3>
        <button class="shuttle-close" id="closeShuttle">&times;</button>
      </div>
      
      <div class="shuttle-tabs">
        <button class="shuttle-tab active" data-tab="shuttle">Navettes</button>
        <button class="shuttle-tab train-tab" data-tab="train">Trains</button>
      </div>
      <div class="shuttle-body">
        <!-- Contenu des navettes -->
        <div id="shuttleContent" class="tab-content active">
          <div class="shuttle-info">
            <p class="shuttle-notice">Service de navettes disponible pendant le festival</p>
          </div>
        <ul class="shuttle-schedule">
          <li class="shuttle-day">
            <h4>📅 Vendredi 25 juillet 2025</h4>
            <p class="shuttle-hours">Service de 10h00 à 03h00</p>
            <ul class="shuttle-times">
              <li class="shuttle-time">
                <span class="time-range">10h00 - 18h00</span>
                <div class="route">
                  <span class="from">Gare de Floreffe</span>
                  <span class="arrow">⇄</span>
                  <span class="to">Camping famille</span>
                </div>
                <p class="shuttle-note">Départs réguliers toutes les 30 minutes</p>
              </li>
              <li class="shuttle-time">
                <span class="time-range">18h15 - 03h00</span>
                <div class="route">
                  <span class="from">Abbaye (Entrée 2)</span>
                  <span class="arrow">⇄</span>
                  <span class="to">Camping famille</span>
                </div>
                <p class="shuttle-note">Départs réguliers toutes les 30 minutes</p>
              </li>
            </ul>
          </li>
          
          <li class="shuttle-day">
            <h4>📅 Samedi 26 juillet 2025</h4>
            <p class="shuttle-hours">Service de 11h00 à 03h00</p>
            <ul class="shuttle-times">
              <li class="shuttle-time">
                <span class="time-range">11h00 - 18h00</span>
                <div class="route">
                  <span class="from">Gare de Floreffe</span>
                  <span class="arrow">⇄</span>
                  <span class="to">Camping famille</span>
                </div>
                <p class="shuttle-note">Départs réguliers toutes les 30 minutes</p>
              </li>
              <li class="shuttle-time">
                <span class="time-range">18h15 - 03h00</span>
                <div class="route">
                  <span class="from">Abbaye (Entrée 2)</span>
                  <span class="arrow">⇄</span>
                  <span class="to">Camping famille</span>
                </div>
                <p class="shuttle-note">Départs réguliers toutes les 30 minutes</p>
              </li>
            </ul>
          </li>
          
          <li class="shuttle-day">
            <h4>📅 Dimanche 27 juillet 2025</h4>
            <p class="shuttle-hours">Service de 11h00 à 02h00</p>
            <ul class="shuttle-times">
              <li class="shuttle-time">
                <span class="time-range">11h00 - 18h00</span>
                <div class="route">
                  <span class="from">Gare de Floreffe</span>
                  <span class="arrow">⇄</span>
                  <span class="to">Camping famille</span>
                </div>
                <p class="shuttle-note">Départs réguliers toutes les 30 minutes</p>
              </li>
              <li class="shuttle-time">
                <span class="time-range">18h15 - 03h15</span>
                <div class="route">
                  <span class="from">Abbaye (Entrée 2)</span>
                  <span class="arrow">⇄</span>
                  <span class="to">Camping famille</span>
                </div>
                <p class="shuttle-note">Départs réguliers toutes les 30 minutes</p>
              </li>
            </ul>
          </li>
          
          <li class="shuttle-day">
            <h4>📅 Lundi 28 juillet 2025</h4>
            <p class="shuttle-hours">Service de 08h00 à 12h00</p>
            <ul class="shuttle-times">
              <li class="shuttle-time">
                <span class="time-range">08h00 - 12h00</span>
                <div class="route">
                  <span class="from">Camping famille</span>
                  <span class="arrow">→</span>
                  <span class="to">Gare de Floreffe</span>
                </div>
                <p class="shuttle-note">Départs réguliers toutes les 30 minutes</p>
              </li>
            </ul>
          </li>
          </ul>
          <div class="shuttle-footer">
            <p>⚠️ Dernier départ garanti à l'heure indiquée</p>
            <p>🔄 Service de navettes sous réserve de modifications</p>
          </div>
        </div>
        
        <!-- Contenu des trains -->
        <div id="trainContent" class="tab-content">
          <div class="shuttle-info">
            <p class="shuttle-notice">Prochains départs depuis la gare de Floreffe</p>
          </div>
          <!-- Le contenu sera chargé dynamiquement -->
        </div>
      </div>
    </div>
    <button class="shuttle-toggle" id="shuttleToggle" title="Voir les horaires de navettes">
      🚌
    </button>
  `;

  // Ajouter le widget au conteneur isolé
  widgetContainer.innerHTML = widgetHTML;
  document.body.appendChild(widgetContainer);

  // Références aux éléments du DOM
  const shuttleToggle = document.getElementById('shuttleToggle');
  const shuttleWidget = document.getElementById('shuttleWidget');
  const closeButton = document.getElementById('closeShuttle');
  let isDragging = false;
  let offsetX, offsetY;

// Gestionnaire d'onglets avec gestion des erreurs
function setupTabs() {
  try {
    const tabs = document.querySelectorAll('.shuttle-tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // Désactiver tous les onglets
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        
        // Activer l'onglet cliqué
        this.classList.add('active');
        const tabId = this.getAttribute('data-tab');
        const content = document.getElementById(`${tabId}Content`);
        if (content) content.classList.add('active');
        
        // Charger les horaires des trains si nécessaire
        if (tabId === 'train') {
          loadTrainSchedule();
        }
      });
    });
    
    return true;
  } catch (error) {
    console.error('Erreur dans la configuration des onglets du widget:', error);
    return false;
  }
}

  // Initialiser les gestionnaires d'événements
  function setupEventListeners() {
    // Gestionnaire d'événements pour le bouton de fermeture
    closeButton.addEventListener('click', function(e) {
      e.stopPropagation();
      shuttleWidget.classList.remove('visible');
    });
    
    // Fermer le widget en cliquant en dehors
    document.addEventListener('click', function(e) {
      if (shuttleWidget && !shuttleWidget.contains(e.target) && e.target !== shuttleToggle) {
        shuttleWidget.classList.remove('visible');
      }
    });

    // Empêcher la fermeture lors du clic à l'intérieur du widget
    if (shuttleWidget) {
      shuttleWidget.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }
  }

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
  });

  // Gestion du redimensionnement de la fenêtre
  window.addEventListener('resize', function() {
    if (window.innerWidth <= 576) {
      shuttleWidget.style.left = '';
      shuttleWidget.style.top = '';
      shuttleWidget.style.right = '20px';
      shuttleWidget.style.bottom = '90px';
    }
  });
  
  // Gestionnaire d'événements pour le bouton d'ouverture du widget
  if (shuttleToggle) {
    shuttleToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      shuttleWidget.classList.toggle('visible');
      
      // Marquer comme vu pour ne plus afficher l'animation
      localStorage.setItem('shuttleWidgetSeen', 'true');
      shuttleToggle.classList.remove('animate');
    });
  }

  // Initialiser le widget
  try {
    // Initialiser les onglets
    setupTabs();
    
    // Initialiser les gestionnaires d'événements
    setupEventListeners();
    
    // Activer l'onglet par défaut
    const defaultTab = document.querySelector('.shuttle-tab[data-tab="shuttle"]');
    if (defaultTab) defaultTab.click();
    
    // Si l'onglet train est actif, charger les horaires
    if (document.querySelector('.shuttle-tab.active[data-tab="train"]')) {
      loadTrainSchedule();
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du widget:', error);
  }
}
