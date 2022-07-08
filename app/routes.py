from site_main import app, db
from flask import render_template, flash, redirect, request, url_for, escape
import flask
# from flask_oauth2_login import GoogleLogin
from math import floor
from flask_login import current_user, login_user, logout_user, login_required
from models import User, get_stable_user, ColdWatersScore, load_cold_waters_score
from hanabi import hanabi_games, HanabiGame
from blitz import blitz_games, BlitzGame
from freeplay import freeplay_games, FreeplayGame
from datetime import timedelta
import json
import os

import google.oauth2.credentials
import google_auth_oauthlib.flow
import googleapiclient.discovery

CLIENT_SECRETS_FILE = os.path.dirname(__file__) + '/oauth_client_secret.apps.googleusercontent.com.json'
SCOPES = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile']

ordinal = lambda n: "%d%s" % (n,"tsnrhtdd"[(floor(n/10)%10!=1)*(n%10<4)*n%10::4])
# google_login = GoogleLogin(app)
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
@app.route("/index/")
def index():
    return render_template('index.html', title='Card and Board Games Online')

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
@app.route('/hanabi/<player_num>/<gameid>/')
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
@app.route('/hanabi/')
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
@app.route('/blitz/<gameid>/')
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
@app.route('/blitz/')
@login_required
def blitz_lobby():
    return render_template(
                'blitz_lobby.html',
                title='Dutch Blitz Lobby',
            )

@app.route('/music_game')
@app.route('/music_game/')
@login_required
def music_game():
    user = get_stable_user()
    return render_template(
                'music_game.html',
                title='Music game prototype',
                user_id=user.id,
                user_name=user.username,
            )

@app.route('/onion_ninja',  methods=['GET', 'POST'])
@app.route('/onion_ninja/', methods=['GET', 'POST'])
@login_required
def cold_waters():
    if request.method == 'GET':
        user = get_stable_user()
        return render_template(
                    'cold_waters.html',
                    title='Play Cold Waters',
                    user_id=user.id,
                    user_name=user.username,
                    experimental=request.args.get('exp'),
                )
    elif request.method == 'POST':
        user = get_stable_user()
        print('request:', request)
        controls_recording = json.loads(request.form.get('thing'))['controls_recording']
        controls_array = controls_recording['controls_array'].encode()
        print('controls_recording:', controls_recording)
        score = ColdWatersScore(
                user_id=user.id,
                code_version=controls_recording['code_signature'],
                hard=controls_recording['hard'],
                seed=controls_recording['seed'],
                score=controls_recording['score'],
                controls_array=controls_array,
                rng_integrity_check=controls_recording['rng_integrity_check']
                )

        db.session.add(score)
        db.session.commit()

        fetched_score = load_cold_waters_score(score.id)
        print('Added the above recording to the DB')
        print(fetched_score.controls_array == score.controls_array)
        return json.dumps({
            'name': user.username,
            'code_version': fetched_score.code_version,
            'hard': fetched_score.hard,
            'seed': fetched_score.seed,
            'score': fetched_score.score,
            'controls_array': fetched_score.controls_array.decode(),
            'rng_integrity_check': fetched_score.rng_integrity_check
        });

@app.route('/onion_ninja/get_best_recording/<code_version>/<seed>/<hard>')
@login_required
def cold_waters_get_best_recording(code_version, seed, hard):
    score = ColdWatersScore.query.filter_by(code_version=code_version, seed=seed, hard=hard).order_by(ColdWatersScore.score.desc()).first()
    if score is None:
        return json.dumps({'response': 'None found'})
    name = User.query.get(score.user_id).username
    return json.dumps({
        'response': 'Score found',
        'name':name,
        'code_version': score.code_version,
        'hard': score.hard,
        'seed': score.seed,
        'score': score.score,
        'controls_array': score.controls_array.decode(),
        'rng_integrity_check': score.rng_integrity_check
    });

@app.route('/onion_ninja/leader_board/<code_version>/<hard>')
@login_required
def cold_waters_leader_board(code_version, hard):
    user_ids = ColdWatersScore.query.with_entities(ColdWatersScore.user_id).filter_by(code_version=code_version, hard=hard).distinct()
    print(user_ids)
    results = []

    for user_id in user_ids:
        recording = ColdWatersScore.query.filter_by(code_version=code_version, user_id=user_id, hard=hard).order_by(ColdWatersScore.score.desc()).first()
        results.append(
            {
                'user_id': user_id[0],
                'username': User.query.get(user_id).username,
                'score': recording.score,
                'seed': recording.seed,
                'hard': recording.hard
            }
        )

    results.sort(key=lambda r: r['score'], reverse=True)
    print(results)
    return json.dumps(results);

#############
# Free Play #
#############
@app.route('/freeplay')
@app.route('/freeplay/')
@login_required
def freeplay_lobby():
    return render_template(
                'freeplay_lobby.html',
                title='Freeplay Lobby',
            )

@app.route('/freeplay/<game_name>/<gameid>')
@app.route('/freeplay/<game_name>/<gameid>/')
@login_required
def freeplay(game_name, gameid):
    game_name = game_name.lower()
    # Current_user now will be the same object as current_user, so we get user here
    user = get_stable_user()
    print("{} is requesting to join freeplay gameid {}".format(user, gameid))
    gameid = str(game_name+'/'+gameid)
    # If the game doesn't already exist, create it!
    if not gameid in freeplay_games:
        freeplay_games[gameid] = FreeplayGame(gameid, game_name)
        print("Created gameid {}".format(gameid))
    game = freeplay_games[gameid]
    print("The users in the game already are {}".format([p.session_user for p in game.players]))
    # See if we are already in the player list
    # Otherwise, add to the end
    # TODO change this
    index = -1
    for i,p in enumerate(game.players):
        if not p.session_user:
            print("Player is new")
            p.session_user = user
            index = i
            break
        elif p.session_user == user:
            index = i
            print("Player is returning")
            break
    if index==-1:
        index = len(game.players)
        player = game.add_player(user)


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
@app.route('/login')
@app.route('/login/')
def login():
    if current_user.is_authenticated:
        return redirect('/')

    # Use the client_secret.json file to identify the application requesting
    # authorization. The client ID (from that file) and access scopes are required.
    flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES)

    # Indicate where the API server will redirect the user after the user completes
    # the authorization flow. The redirect URI is required. The value must exactly
    # match one of the authorized redirect URIs for the OAuth 2.0 client, which you
    # configured in the API Console. If this value doesn't match an authorized URI,
    # you will get a 'redirect_uri_mismatch' error.
    flow.redirect_uri = 'https://games.gc.my/login/google'

    # Generate URL for request to Google's OAuth 2.0 server.
    # Use kwargs to set optional request parameters.
    authorization_url, state = flow.authorization_url(access_type='offline')

    # Store the state so the callback can verify the auth server response.
    print("state:", state)
    flask.session['state'] = state
    print("state:", flask.session["state"])

    print("Sending to authorization URL:", authorization_url)
    return redirect(authorization_url)

@app.route('/oauth2callback')
def oauth2callback():
    # Specify the state when creating the flow in the callback so that it can
    # verified in the authorization server response.
    state = flask.session['state']

    flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES, state = state)
    flow.redirect_uri = flask.url_for('oauth2callback', _external=True)

    # Use the authorization server's response to fetch the OAuth 2.0 tokens.
    authorization_response = flask.request.url
    flow.fetch_token(authorization_response=authorization_response)

    # Store credentials in the session.
    # ACTION ITEM: In a production app, you likely want to save these
    #              credentials in a persistent database instead.
    credentials = flow.credentials
    flask.session['credentials'] = credentials_to_dict(credentials)

    print("oauth2 credentials:", credentials)

    return flask.redirect(flask.url_for('test_api_request'))


@app.route('/login/google')
# @google_login.login_success
def login_success(**params):
    # Load credentials from the session.
    flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES, state = flask.session['state'])
    flow.redirect_uri = 'https://games.gc.my/login/google'

    authorization_response = flask.request.url
    flow.fetch_token(authorization_response=authorization_response)

    credentials = flow.credentials
    oauth2_client = googleapiclient.discovery.build('oauth2', 'v2', credentials=credentials)
    profile = oauth2_client.userinfo().get().execute()

    print("login_success")
    print("Profile:",profile)
    user = User.query.filter_by(email=profile['email']).first()
    print(user)
    # If there is not an entry for the user, create one
    if user is None:
        user = User(email=profile['email'], fullname=profile['name'], username=profile['given_name'])
        db.session.add(user)
        db.session.commit()
        db.session.expire_all()
        message = 'Created and logged in user {}'.format(profile['name'])
    else:
        message = 'Login successful for {}'.format(profile['name'])
    print(message)
    flash(message)
    login_user(user) #TODO add remember me option
    print("cookie set to {}".format(request.cookies.get('next')))
    dest = request.cookies.get('next') or '/'
    return redirect(dest)

@app.route('/logout')
def logout():
    logout_user()
    return redirect('/')
