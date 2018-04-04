from app import socketio
from flask_socketio import emit
from flask_login import current_user
from time import sleep
from app.hanabi import HanabiGame, hanabi_games

@socketio.on('message')
def handle_message(message):
    print('socketio received message: {}'.format(message))

@socketio.on('my event')
def handle_my_custom_event(json):
    print('custom event "my event" received json: ' + str(json))


# Hanabisample
@socketio.on('connect', namespace='/hanabisample')
def test_connect_hanabi():
    print('Client {}: Connected to hanabisample'.format(current_user))
    emit('NOTIFICATION', {'data':'Welcome to hanabisample, {}!'.format(current_user)})
    emit('NOTIFICATION', {'data':'Let\'s all welcome {} to hanabisample!'.format(current_user)}, broadcast=True)


@socketio.on('CARD MOVE', namespace='/hanabisample')
def test_connect_hanabi(data):
    print('Client {}, event {}: {}'.format(current_user, 'CARD MOVE', data))

##########
# Hanabi #
##########
@socketio.on('connect', namespace='/hanabi')
def connect_hanabi():
    print('Client {}: Connected to hanabi'.format(current_user))
    emit('NOTIFICATION', {'data':'Welcome to hanabi, {}!'.format(current_user)})
    emit('NOTIFICATION', {'data':'Let\'s all welcome {} to hanabi!'.format(current_user)}, broadcast=True)

@socketio.on('UPDATE REQUEST', namespace='/hanabi')
def update_request(data):
    print('Client UPDATE REQUEST: {}'.format(data))
    g = hanabi_games[data['gameid']]
    emit('UPDATE INFO', g.get_full_update(current_user))


@socketio.on('CARD MOVE', namespace='/hanabi')
def test_connect_hanabi(data):
    print('Client {}, event {}: {}'.format(current_user, 'CARD MOVE', data))
