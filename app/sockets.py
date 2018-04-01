from app import socketio
from flask_socketio import emit

@socketio.on('message')
def handle_message(message):
    print('socketio received message: {}'.format(message))

@socketio.on('my event')
def handle_my_custom_event(json):
    print('custom event "my event" received json: ' + str(json))

@socketio.on('connect')
def test_connect():
    print('Connected')
    emit('my response', {'data':'Connected'})

@socketio.on('connect', namespace='/hanabisample')
def test_connect_hanabi():
    print('Connected to hanabisample')
    emit('my response', {'data':'Connected to hanabisample'})
