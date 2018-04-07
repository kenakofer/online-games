from app import socketio
from flask_socketio import emit, join_room, leave_room
from flask_login import current_user
from app.models import get_stable_user
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

@socketio.on('JOIN ROOM', namespace='/hanabi')
def join(data):
    join_room(data['room'])

# The client tells us that they moved a card. We decide if it's legal and what the implications are
@socketio.on('CARD MOVE', namespace='/hanabi')
def card_move(data):
    user = get_stable_user()
    print('Client {}, event {}: {}'.format(get_stable_user(), 'CARD MOVE', data))
    g = hanabi_games[data['gameid']]
    if data['place_id']=="PLAY":
        result = g.play_card(get_stable_user(), g.card_from_id(data['card_id']))
    elif data['place_id']=="TRASH":
        result = g.trash_card(get_stable_user(), g.card_from_id(data['card_id']))

    # At the moment, just have the clients request their own individual updates
    emit("SHOULD REQUEST UPDATE", {}, broadcast=True, room=g.gameid)

@socketio.on('CLUE CARD', namespace='/hanabi')
def clue_card(data):
    print('Client {}, event {}: {}'.format(get_stable_user(), 'CARD MOVE', data))
    g = hanabi_games[data['gameid']]
    g.give_clue(current_user, g.card_from_id(data['card_id']), data['card_field'])
    # At the moment, just have the clients request their own individual updates
    emit("SHOULD REQUEST UPDATE", {}, broadcast=True, room=g.gameid)
