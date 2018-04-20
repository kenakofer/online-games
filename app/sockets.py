from app import socketio
from flask_socketio import emit, join_room, leave_room
from flask_login import current_user
from app.models import get_stable_user
from time import sleep
from app.hanabi import HanabiGame, hanabi_games
from app.blitz import BlitzGame, blitz_games

@socketio.on('message')
def handle_message(message):
    print('socketio received message: {}'.format(message))

@socketio.on('my event')
def handle_my_custom_event(json):
    print('custom event "my event" received json: ' + str(json))

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
    print('Client {}, event {}: {}'.format(get_stable_user(), 'CARD CLUE', data))
    g = hanabi_games[data['gameid']]
    g.give_clue(current_user, g.card_from_id(data['card_id']), data['card_field'])
    # At the moment, just have the clients request their own individual updates
    emit("SHOULD REQUEST UPDATE", {}, broadcast=True, room=g.gameid)



#########
# Blitz #
#########

@socketio.on('connect', namespace='/blitz')
def connect_blitz():
    print('Client {}: Connected to blitz'.format(current_user))
    emit('NOTIFICATION', {'data':'Welcome to blitz, {}!'.format(current_user)})
    emit('NOTIFICATION', {'data':'Let\'s all welcome {} to blitz!'.format(current_user)}, broadcast=True)

@socketio.on('UPDATE REQUEST', namespace='/blitz')
def update_request(data):
    print('Client UPDATE REQUEST: {}'.format(data))
    g = blitz_games[data['gameid']]
    g.get_full_update()

@socketio.on('JOIN ROOM', namespace='/blitz')
def join(data):
    join_room(data['room'])

# The client tells us that they moved a card. We decide if it's legal and what the implications are
@socketio.on('CARD MOVE', namespace='/blitz')
def card_move(data):
    g = blitz_games[data['gameid']]
    player = g.get_blitz_player(current_user)
    print('Client {}, event {}: {}'.format(get_stable_user(), 'CARD MOVE', data))
    if "PLAY" in data['card_pos']:
        print("Trying to play the card...")
        result = player.play_card(g.card_from_id(data['card_id']), g.card_positions[data['card_pos']])
    g.get_full_update()

@socketio.on('DEAL DECK', namespace='/blitz')
def card_move(data):
    g = blitz_games[data['gameid']]
    player = g.get_blitz_player(current_user)
    print('Client {}, event {}: {}'.format(get_stable_user(), 'DEAL DECK', data))
    result = player.deal_deck()
    g.get_full_update()


