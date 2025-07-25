from flask import Blueprint, jsonify
import requests
from datetime import datetime

bp = Blueprint('trains', __name__, url_prefix='/api/trains')

@bp.route('/departures')
def get_departures():
    from flask import request
    try:
        # Obtenir l'heure actuelle
        now = int(datetime.now().timestamp())
        
        # Prendre la gare de départ depuis le paramètre GET, défaut Floreffe
        from_station = request.args.get('from', 'Floreffe')
        
        # Destinations à desservir
        destinations = ['Jambe', 'Wavre']
        all_connections = []
        for dest in destinations:
            url = f'https://api.irail.be/connections/?from={from_station}&to={dest}&format=json&results=5&timesel=departure&type_depart=departure&_={now}'
            try:
                response = requests.get(url, timeout=5)
                response.raise_for_status()
                data = response.json()
                if 'connection' in data:
                    all_connections.extend(data['connection'])
            except Exception as e:
                continue  # Ignore failures for one destination if the other works
        # Dédupliquer par numéro de train + heure de départ
        seen = set()
        unique_connections = []
        for conn in all_connections:
            train_num = conn.get('departure', {}).get('vehicleinfo', {}).get('shortname', '')
            dep_time = conn.get('departure', {}).get('time', '')
            key = f"{train_num}_{dep_time}"
            if key not in seen:
                seen.add(key)
                unique_connections.append(conn)
        # Trier les trains par heure de départ croissante
        unique_connections.sort(key=lambda conn: int(conn.get('departure', {}).get('time', 0)))
        # Séparer par direction
        jambe = [c for c in unique_connections if c.get('arrival', {}).get('station', '').lower().startswith('jambe')]
        wavre = [c for c in unique_connections if c.get('arrival', {}).get('station', '').lower().startswith('wavre')]
        # Intercaler (alterner) les deux directions
        alternated = []
        i, j = 0, 0
        while i < len(jambe) or j < len(wavre):
            if i < len(jambe):
                alternated.append(jambe[i])
                i += 1
            if j < len(wavre):
                alternated.append(wavre[j])
                j += 1
        return jsonify({'connection': alternated})
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': 'Impossible de récupérer les horaires',
            'details': str(e)
        }), 500
