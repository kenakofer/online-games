from app import app, db
from flask import render_template, flash, redirect, jsonify, request, url_for
from flask_oauth2_login import GoogleLogin
from math import floor
from .forms import LoginForm
from flask_login import current_user, login_user, logout_user, login_required
from app.models import User, get_stable_user
from app.hanabi import hanabi_games, HanabiGame
from app.blitz import blitz_games, BlitzGame
from datetime import timedelta

ordinal = lambda n: "%d%s" % (n,"tsnrhtdd"[(floor(n/10)%10!=1)*(n%10<4)*n%10::4])
google_login = GoogleLogin(app)
print('starting views...')

@app.errorhandler(404)
def page_not_found(e):
    print(e)
    return render_template('404.html'), 404

@app.errorhandler(401)
def handle_needs_login(e):
    response = redirect('/login')
    print(request)
    print("Setting cookie 'next' to {}".format(request.url))
    response.set_cookie('next', request.url, max_age=timedelta(minutes=5))
    return response

@app.route("/")
@app.route("/index")
@app.route("/pagecount")
def pagecount():
    messages = [
        'Peanut butter is delicious with oatmeal',
        'Raisins are too',
    ]
    if current_user.is_anonymous:
        message = 'Hello person! You should log in to see the awesome pageview counting facilities of this page!'
    else:
        current_user.pagecount+=1
        db.session.commit()
        messages.append( str(current_user.pagecount**2-1)+' is a cool nuber')
        message = 'You have visited this page {} times!'.format(current_user.pagecount)
    return render_template('pagecount.html', title='Pagecount', message=message,  messages=messages)

@app.route('/hanabi/<player_num>/<gameid>')
@login_required
def hanabi(player_num, gameid):
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
@login_required
def hanabi_lobby():
    return render_template(
                'hanabi_lobby.html',
                title='Hanabi Lobby',
            )

###############
# Dutch Blitz #
###############
@app.route('/blitz/<gameid>')
@login_required
def blitz(gameid):
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
@login_required
def blitz_lobby():
    return render_template(
                'blitz_lobby.html',
                title='Dutch Blitz Lobby',
            )

#########
# Login #
#########
@app.route('/login')
def login():
    if current_user.is_authenticated:
        return redirect('/')
    return redirect(google_login.authorization_url())

@google_login.login_success
def login_success(token, profile):
    user = User.query.filter_by(email=profile['email']).first()
    print(user)
    # If there is not an entry for the user, create one
    if user is None:
        user = User(email=profile['email'], fullname=profile['name'])
        db.session.add(user)
        db.session.commit()
        message = 'Created and logged in user {}'.format(profile['name'])
    else:
        message = 'Login successful for {}'.format(profile['name'])
    login_user(user) #TODO add remember me option
    print(message)
    flash(message)
    print("cookie set to {}".format(request.cookies.get('next')))
    dest = request.cookies.get('next') or '/'
    return redirect(dest)

@app.route('/logout')
def logout():
    logout_user()
    return redirect('/')
