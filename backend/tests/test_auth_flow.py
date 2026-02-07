import json
from app.core.database import SessionLocal

def test_login_me_and_refresh():
    # Call real running API
    import requests
    base = 'http://localhost:8000'

    # login
    r = requests.post(f'{base}/auth/login', json={
        'email': 'admin@huntsphere.local',
        'password': 'Admin@123'
    })
    assert r.status_code == 200
    data = r.json()
    assert 'access_token' in data and 'refresh_token' in data and 'user' in data
    assert data['user']['role'] == 'ADMIN'

    access = data['access_token']
    refresh = data['refresh_token']

    # me
    r2 = requests.get(f'{base}/auth/me', headers={'Authorization': f'Bearer {access}'})
    assert r2.status_code == 200
    assert r2.json()['username'] == 'admin'

    # refresh
    r3 = requests.post(f'{base}/auth/refresh', json={'refresh_token': refresh})
    assert r3.status_code == 200
    assert 'access_token' in r3.json()
