from site_main import app
from flask import render_template, flash, redirect, request, url_for
import flask
from math import floor
from flask_login import current_user, login_user, logout_user, login_required
from models import SessionUser, get_stable_user
from hanabi import hanabi_games, HanabiGame
from blitz import blitz_games, BlitzGame
from freeplay import FreeplayGame
from datetime import timedelta
import json
import os
import uuid

# Display names are cosmetic, but they end up in game UIs, so keep them short.
MAX_NAME_LENGTH = 32

ordinal = lambda n: "%d%s" % (n,"tsnrhtdd"[(floor(n/10)%10!=1)*(n%10<4)*n%10::4])
print('starting views...')

@app.before_request
def before_request():
    print('                                         ')
    print('                 >>>>>> URL:', request.url)

@app.after_request
def after_request(response):
    app.logger.info('aStatus: %s', response.status)
    print('pStatus: %s', response.status)
    return response

@app.errorhandler(404)
def page_not_found(e):
    print(e)
    return render_template('404.html'), 404

@app.errorhandler(401)
def handle_needs_login(e):
    print("Handling 401")
    response = redirect('/login')
    print(request)
    print("Setting cookie 'next' to {}".format(request.url))
    response.set_cookie('next', request.url, max_age=timedelta(minutes=5))
    return response

@app.route("/")
@app.route("/index")
@app.route("/index/")
def index():
    print("/index")
    result = "Overwrite me"
    if current_user.is_anonymous:
        result = "Not logged in"
    else:
        result = "Logged in as {}".format(current_user.username)

    result = render_template('index.html', title='Card and Board Games Online')
    # result = render_template('404.html')
    # result = "Overwritten"
    # print("Returning result")
    # print("Result: ", result)
    print("Result length:", len(result))
    return result

@app.route('/hanabi/<player_num>/<gameid>')
@app.route('/hanabi/<player_num>/<gameid>/')
@login_required
def hanabi(player_num, gameid):
    print("/hanabi")
    # Current_user now will be the same object as current_user, so we get user here
    user = get_stable_user()
    print("{} is requesting to join hanabi gameid {}".format(user, gameid))
    gameid = str(gameid)
    # If the game doesn't already exist, create it!
    if not gameid in hanabi_games or hanabi_games[gameid].game_over:
        hanabi_games[gameid] = HanabiGame(int(player_num), gameid)
        print("Created gameid {}".format(gameid))
    # See if we are already in the player list
    game = hanabi_games[gameid]
    print("The users in the game already are {}".format(game.players))
    if user in game.players:
        print("Player is returning")
    # Otherwise, see if it can take more players
    elif (len(game.players) < game.player_count):
        print("Player is new")
        index = len(game.players)
        game.player_index[user] = index
        game.players.append(user)
    else:
        return "The game {} already has {} players".format(gameid, game.player_count)

    print("Taking {} player index".format(game.player_index[user])) #Put the user into the game room
    return render_template(
            'hanabi.html',
            title='Hanabi Board',
            socketio_namespace='/hanabi',
            player_index=game.player_index[user],
            player_count=game.player_count,
            hand_size=game.hand_size,
            letters=HanabiGame.letters,
            gameid=gameid,
            )

@app.route('/hanabi')
@app.route('/hanabi/')
@login_required
def hanabi_lobby():
    print("/hanabi_lobby")
    return render_template(
                'hanabi_lobby.html',
                title='Hanabi Lobby',
            )

###############
# Dutch Blitz #
###############
@app.route('/blitz/<gameid>')
@app.route('/blitz/<gameid>/')
@login_required
def blitz(gameid):
    print("/blitz")
    player_num = int(request.args.get('num') or 2)
    AI_num = request.args.get('AI') or 0
    stock_size = request.args.get('stock') or 9
    queue_size = request.args.get('queue') or (4 if player_num>2 else 5)
    # Current_user now will be the same object as current_user, so we get user here
    user = get_stable_user()
    print("{} is requesting to join blitz gameid {}".format(user, gameid))
    gameid = str(gameid)
    # If the game doesn't already exist, create it!
    if not gameid in blitz_games or blitz_games[gameid].game_over:
        blitz_games[gameid] = BlitzGame(int(player_num), gameid, AI_num=AI_num, queue_size=queue_size, stock_size=stock_size)
        print("Created gameid {}".format(gameid))
    # See if we are already in the player list
    game = blitz_games[gameid]
    print("The users in the game already are {}".format([p.session_user for p in game.players]))
    # Otherwise, see if it can take more players
    index = -1
    for i,p in enumerate(game.players):

        if not p.session_user and not p.AI:
            print("Player is new")
            p.session_user = user
            index = i
            break
        elif p.session_user == user:
            index = i
            print("Player is returning")
            break
    if index==-1:
        return "The game {} already has {} players".format(gameid, game.player_count)

    print("Taking {} player index".format(index)) #Put the user into the game room
    return render_template(
            'blitz.html',
            title='Dutch Blitz',
            socketio_namespace='/blitz',
            player_index=index,
            player_count=game.player_count,
            queue_size=game.queue_size,
            gameid=gameid,
            )

@app.route('/blitz')
@app.route('/blitz/')
@login_required
def blitz_lobby():
    print("/blitz_lobby")
    return render_template(
                'blitz_lobby.html',
                title='Dutch Blitz Lobby',
            )

#############
# Free Play #
#############
@app.route('/freeplay')
@app.route('/freeplay/')
@login_required
def freeplay_lobby():
    print("/freeplay_lobby")
    return render_template(
                'freeplay_lobby.html',
                title='Freeplay Lobby',
            )

@app.route('/freeplay/<game_name>/<gameid>')
@app.route('/freeplay/<game_name>/<gameid>/')
@login_required
def freeplay(game_name, gameid):
    print("/freeplay/"+str(game_name)+"/"+str(gameid))
    game_name = game_name.lower()
    # Current_user now will be the same object as current_user, so we get user here
    user = get_stable_user()
    print("{} is requesting to join freeplay gameid {}".format(user, gameid))
    gameid = str(game_name+'/'+gameid)
    # If the game doesn't already exist, create it!
    if not gameid in app.freeplay_games:
        app.freeplay_games[gameid] = FreeplayGame(gameid, game_name)
        print("Created gameid {}".format(gameid))
    game = app.freeplay_games[gameid]
    print("The users in the game already are {}".format([p for p in game.sid_to_player.values()]))
    # See if we are already in the player list
    # Otherwise, add to the end
    session_sid = request.cookies.get('session')
    if session_sid in game.sid_to_player:
        print("Player is returning")
        player = game.sid_to_player[session_sid]
    else:
        print("Player is new")
        player = game.add_player(user)
    index = player.player_index

    print("Taking {} player index".format(index)) #Put the user into the game room
    return render_template(
            'freeplay.html',
            title='Free Play',
            socketio_namespace='/freeplay',
            player_index=index,
            gameid=gameid,
            )

#########
# Login #
#########
@app.route('/login/')
@app.route("/login", methods=['GET', 'POST'])
def login():
    """Pick a display name. There are no accounts and no password.

    Identity lives entirely in the signed session cookie: a generated id that
    identifies the player, and the name they chose, which is only decoration.
    """
    if current_user.is_authenticated:
        return redirect('/')

    if request.method == 'POST':
        fullname = (request.form.get('fullname') or '').strip()
        if not fullname:
            flash('Please enter a name.')
            return render_template('login.html', title='Choose a name', max_name_length=MAX_NAME_LENGTH)
        fullname = fullname[:MAX_NAME_LENGTH]

        flask.session['user_id'] = uuid.uuid4().hex
        flask.session['fullname'] = fullname
        login_user(SessionUser(flask.session['user_id'], fullname))

        dest = request.cookies.get('next') or '/'
        return redirect(dest)

    return render_template('login.html', title='Choose a name', max_name_length=MAX_NAME_LENGTH)

@app.route('/logout')
def logout():
    print("/logout")
    logout_user()
    # logout_user() only drops flask-login's own key; the identity we put in
    # the session is ours to clear.
    flask.session.pop('user_id', None)
    flask.session.pop('fullname', None)
    return redirect('/')
