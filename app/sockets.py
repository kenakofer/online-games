from app import socketio
from flask_socketio import emit, join_room, leave_room
from flask_login import current_user
from app.models import get_stable_user
from time import sleep
from app.hanabi import HanabiGame, hanabi_games
from app.blitz import BlitzGame, blitz_games
from app.freeplay import FreeplayGame, freeplay_games
from time import time

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

@socketio.on('UPDATE REQUEST', namespace='/hanabi')
def update_request(data):
    print('Client UPDATE REQUEST: {}'.format(data))
    g = hanabi_games[data['gameid']]
    emit('UPDATE INFO', g.get_full_update(current_user))

@socketio.on('JOIN ROOM', namespace='/hanabi')
def join(data):
    join_room(data['room'])
    emit("SHOULD REQUEST UPDATE", {}, broadcast=True, room=data['room'])

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

@socketio.on('UPDATE REQUEST', namespace='/blitz')
def update_request(data):
    print('Client UPDATE REQUEST: {}'.format(data))
    g = blitz_games[data['gameid']]
    g.get_full_update()
    g.time_of_last_update = time()

@socketio.on('JOIN ROOM', namespace='/blitz')
def join(data):
    join_room(data['room'])
    emit("SHOULD REQUEST UPDATE", {}, broadcast=True, room=data['room'])

# The client tells us that they moved a card. We decide if it's legal and what the implications are
@socketio.on('CARD MOVE', namespace='/blitz')
def card_move(data):
    g = blitz_games[data['gameid']]
    player = g.get_blitz_player(current_user)
    print('Client {}, event {}: {}'.format(get_stable_user(), 'CARD MOVE', data))
    if not data['card_id'] in g.cards:
        print("No such card on the server side: {}".format(data['card_id']))
    else:
        card = g.cards[data['card_id']]
        if data['deck']:
            card.move_to(data['deck'])
        else:
            card.move_to(None, position=data['position'])

    result = player.play_card(g.card_from_id(data['card_id']), g.card_positions[data['card_pos']])
    g.time_of_last_update = time()
    # g.get_full_update() This is run in play_card

@socketio.on('DEAL DECK', namespace='/blitz')
def card_move(data):
    g = blitz_games[data['gameid']]
    player = g.get_blitz_player(current_user)
    print('Client {}, event {}: {}'.format(get_stable_user(), 'DEAL DECK', data))
    result = player.deal_deck()

#############
# Free Play #
#############

@socketio.on('connect', namespace='/freeplay')
def connect_freeplay():
    print('Client {}: Connected to freeplay'.format(current_user))
    emit('NOTIFICATION', {'data':'Welcome to freeplay, {}!'.format(current_user)})

@socketio.on('UPDATE REQUEST', namespace='/freeplay')
def update_request(data):
    print('Client UPDATE REQUEST: {}'.format(data))
    g = freeplay_games[data['gameid']]
    g.send_update()
    g.time_of_last_update = time()

@socketio.on('JOIN ROOM', namespace='/freeplay')
def join(data):
    join_room(data['room'])
    emit("SHOULD REQUEST UPDATE", {}, broadcast=True, room=data['room'])

# The client tells us that they moved a card. We decide if it's legal and what the implications are
@socketio.on('START MOVE', namespace='/freeplay')
def start_move(data):
    g = freeplay_games[data['gameid']]
    player = g.get_player_from_session(current_user)
    print('Client {}, event {}: {}'.format(get_stable_user(), 'START MOVE', data))
    obj = g.all_movables[data['obj_id']]
    obj.start_move(player)
    g.time_of_last_update = time()

@socketio.on('STOP MOVE', namespace='/freeplay')
def stop_move(data):
    g = freeplay_games[data['gameid']]
    player = g.get_player_from_session(current_user)
    print('Client {}, event {}: {}'.format(get_stable_user(), 'STOP MOVE', data))
    obj = g.all_movables[data['obj_id']]
    obj.stop_move(player, data['position'])
    g.time_of_last_update = time()

@socketio.on('CONTINUE MOVE', namespace='/freeplay')
def continue_move(data):
    g = freeplay_games[data['gameid']]
    player = g.get_player_from_session(current_user)
    print('Client {}, event {}: {}'.format(get_stable_user(), 'CONTINUE MOVE', data))
    obj = g.all_movables[data['obj_id']]
    obj.continue_move(player, data['position'])
    g.time_of_last_update = time()

@socketio.on('COMBINE', namespace='/freeplay')
def combine(data):
    g = freeplay_games[data['gameid']]
    player = g.get_player_from_session(current_user)
    print('Client {}, event {}: {}'.format(get_stable_user(), 'COMBINE', data))
    obj1 = g.all_movables[data['top_id']]
    obj2 = g.all_movables[data['bottom_id']]
    obj2.incorporate(obj1)
    g.time_of_last_update = time()
