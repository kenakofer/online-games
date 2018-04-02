from app import socketio
from flask_socketio import emit
from flask_login import current_user
from time import sleep

@socketio.on('message')
def handle_message(message):
    print('socketio received message: {}'.format(message))

@socketio.on('my event')
def handle_my_custom_event(json):
    print('custom event "my event" received json: ' + str(json))

#General function for all connects. Not needed atm
#@socketio.on('connect')
#def test_connect():
#    print('Connected')
#    emit('my response', {'data':'Connected'})

@socketio.on('connect', namespace='/hanabisample')
def test_connect_hanabi():
    print('Client {}: Connected to hanabisample'.format(current_user))
    emit('NOTIFICATION', {'data':'Welcome to hanabisample, {}!'.format(current_user)})
    emit('NOTIFICATION', {'data':'Let\'s all welcome {} to hanabisample!'.format(current_user)}, broadcast=True)
    sleep(3)
    emit('CARD DATA', {'card_id':2,'card_letter':'C','card_number':4})
