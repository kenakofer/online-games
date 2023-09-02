from site_main import app, db, client
from flask import render_template, flash, redirect, request, url_for, escape
import flask
# from flask_oauth2_login import GoogleLogin
from math import floor
from flask_login import current_user, login_user, logout_user, login_required
from models import User, get_stable_user, ColdWatersScore, load_cold_waters_score
from hanabi import hanabi_games, HanabiGame
from blitz import blitz_games, BlitzGame
from freeplay import FreeplayGame
from datetime import timedelta
import requests
import json
import os

SCOPES = ["openid", "email", "profile"]
GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"
REDIRECT_URI = 'https://games.kenakofer.com/login/google'

ordinal = lambda n: "%d%s" % (n,"tsnrhtdd"[(floor(n/10)%10!=1)*(n%10<4)*n%10::4])
# google_login = GoogleLogin(app)
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

@app.route("/pagecount")
def pagecount():
    print("/pagecount")
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

@app.route('/music_game')
@app.route('/music_game/')
@login_required
def music_game():
    print("/music_game")
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
    print("/onion_ninja")
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
    print("/onion_ninja/get_best_recording")
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
    # Disabling because the query is hard to run
    return json.dumps([])

    print("/onion_ninja/leader_board")
    rows = ColdWatersScore.query.with_entities(ColdWatersScore.user_id).filter_by(code_version=code_version, hard=hard).distinct()
    # Get the user ids from the rows
    user_ids = [row for row, in rows]
    print(user_ids)
    results = []

    for user_id in user_ids:
        recording = ColdWatersScore.query.filter_by(
            code_version=str(code_version),
            user_id=int(user_id),
            hard=int(hard)
        ).order_by(ColdWatersScore.score.desc()).first()
        results.append(
            {
                'user_id': user_id,
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
    if request.cookies['session'] in game.sid_to_player:
        print("Player is returning")
        player = game.sid_to_player[request.cookies['session']]
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
def get_google_provider_cfg():
    return requests.get(GOOGLE_DISCOVERY_URL).json()

@app.route('/login/')
@app.route("/login")
def login():
    # Find out what URL to hit for Google login
    google_provider_cfg = get_google_provider_cfg()
    authorization_endpoint = google_provider_cfg["authorization_endpoint"]

    # Use library to construct the request for Google login and provide
    # scopes that let you retrieve user's profile from Google
    request_uri = client.prepare_request_uri(
        authorization_endpoint,
        redirect_uri=REDIRECT_URI,
        scope=SCOPES,
    )
    return redirect(request_uri)


@app.route("/login/google")
@app.route("/login/callback")
def callback():
    # Get authorization code Google sent back to you
    code = request.args.get("code")
    print("Got code:", code)
    # Find out what URL to hit to get tokens that allow you to ask for
    # things on behalf of a user
    google_provider_cfg = get_google_provider_cfg()
    token_endpoint = google_provider_cfg["token_endpoint"]
    print("token_endpoint:", token_endpoint)
    # Prepare and send a request to get tokens! Yay tokens!
    token_url, headers, body = client.prepare_token_request(
        token_endpoint,
        authorization_response=request.url,
        redirect_url=request.base_url, ## Comment out?
        code=code
    )
    token_response = requests.post(
        token_url,
        headers=headers,
        data=body,
        auth=(app.config['GOOGLE_CLIENT_ID'], app.config['GOOGLE_CLIENT_SECRET']),
    )
    print("token_response:", token_response)

    # Parse the tokens!
    client.parse_request_body_response(json.dumps(token_response.json()))

    # Now that we have tokens (yay) let's find and hit URL
    # from Google that gives you user's profile information,
    # including their Google Profile Image and Email
    userinfo_endpoint = google_provider_cfg["userinfo_endpoint"]
    print("userinfo_endpoint:", userinfo_endpoint)
    uri, headers, body = client.add_token(userinfo_endpoint)
    userinfo_response = requests.get(uri, headers=headers, data=body)

    print("userinfo_response:", userinfo_response)

    # We want to make sure their email is verified.
    # The user authenticated with Google, authorized our
    # app, and now we've verified their email through Google!
    if userinfo_response.json().get("email_verified"):
        print("email_verified")
        unique_id = userinfo_response.json()["sub"]
        users_email = userinfo_response.json()["email"]
        picture = userinfo_response.json()["picture"]
        users_name = userinfo_response.json()["given_name"]
        print("unique_id:", unique_id)
        print("users_email:", users_email)
        print("users_name:", users_name)
    else:
        print("email not verified")
        return "User email not available or not verified by Google.", 400

    user = User.query.filter_by(email=users_email).first()

    print(user)
    # If there is not an entry for the user, create one
    if user is None:
        user = User(email=users_email, fullname=users_name, username=users_name)
        db.session.add(user)
        db.session.commit()
        db.session.expire_all()
        message = 'Created and logged in user {}'.format(users_name)
    else:
        message = 'Login successful for {}'.format(users_name)
    print(message)
    flash(message)
    login_user(user) #TODO add remember me option
    print("cookie set to {}".format(request.cookies.get('next')))
    dest = request.cookies.get('next') or '/'
    return redirect(dest)

@app.route('/logout')
def logout():
    print("/logout")
    logout_user()
    return redirect('/')
