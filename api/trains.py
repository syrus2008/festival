from flask import Blueprint, jsonify
import requests
from datetime import datetime

bp = Blueprint('trains', __name__, url_prefix='/api/trains')

@bp.route('/departures')
def get_departures():
    try:
        # Obtenir l'heure actuelle
        now = int(datetime.now().timestamp())
        
        # Appeler l'API iRail
        url = f'https://api.irail.be/connections/?from=Floreffe&to=Brussels&format=json&results=5&timesel=departure&type_depart=departure&_={now}'
        
        # Faire la requête avec un timeout de 5 secondes
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        
        # Retourner les données brutes de l'API
        return jsonify(response.json())
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': 'Impossible de récupérer les horaires',
            'details': str(e)
        }), 500
