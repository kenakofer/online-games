Notes from getting it set up again after so long, this probably won't be useful to anyone else, but this was like 20 hours of banging my head against the wall. I learned a lot, which is cool.

1. Changed name to wsgi.py in the outer directory so flask stuff associates better
2. Create DBs by using `flask shell`, then db.drop_all() and db.create_all(). Manually creating tables that seem to match is a bad idea and easy to get wrong.
3. Updated SocketIO constructor to use async threading. I'm not sure if it was doing this already...
4. Something is wrong with calls to render_template. Maybe stuff about checking the current_user?
5. Now login on windows firefox is failing entirely. Gonna try:
    - apt remove python3-flask-login (0.5.0-2)
    -
6. Ok, so I guess I pip installed six at one point, and it was 1.11.0, which broke all requests.get. A bit embarrassing that I needed so many hacker tools to figure that out. I should add library checks at process startup or something.

7. Still having issues with render_template causing requests not to come back. From flask 2.0.1, apt version.
    - Uninstall from apt:
        python3-flask/jammy-updates,jammy-security,now 2.0.1-2ubuntu1.1 all [installed]
        python3-flask-migrate/jammy,now 2.6.0-1 all [installed]
        python3-flask-socketio/jammy,now 5.0.1-1 all [installed]
        python3-flask-sqlalchemy/jammy,now 2.5.1-1 all [installed]
        python3-flaskext.wtf/jammy,now 0.14.3-1 all [installed]

        - And this one too, even though it's not dependent?
        python3-socketio/jammy,now 5.0.3-2 all [installed,automatic]

    - pip3 install flask==2.3.3
    - pip3 install flask_sqlalchemy
        Collecting flask_sqlalchemy
        Downloading flask_sqlalchemy-3.0.5-py3-none-any.whl (24 kB)
    - pip3 install flask_migrate
        Collecting flask_migrate
        Downloading Flask_Migrate-4.0.4-py3-none-any.whl (20 kB)
    - pip3 install flask_socketio
        Collecting flask_socketio
        Downloading Flask_SocketIO-5.3.5-py3-none-any.whl (17 kB)
        Collecting python-socketio>=5.0.2
        Downloading python_socketio-5.8.0-py3-none-any.whl (56 kB)

8. After further investigation (edits with sudo to add prints inside /usr/local/lib/python3.10/dist-packages/) I found that it's more specifically getting the current_user while rendering the template that causes the hang.
9. After yet more similar investigation, it's all come full circle, to a callback that I myself wrote:
    return User.query.get(int(id))

    So something must be bad with the DB connections


10. It seems that installing sqlalchemy through pip3 did the trick?
            apt: Removing python3-sqlalchemy (1.4.31+ds1-1build1) .
            pip3 version is 2.0.20


That's one big step for a man, one tiny bit of progress for this webapp

11. Ok, now socketio stuff. We're getting Server.emit() got an unexpected keyword argument 'broadcast'. This is almost surely a bad version of socketio

12. Pip3: Downgraded python-socketio from 5.8.0 to 5.7.2:
        pip3 install python-socketio==5.7.2
        Great, it works now

13. Installed pip3 install gevent-websocket
    Collecting gevent-websocket
    Downloading gevent_websocket-0.10.1-py3-none-any.whl (22 kB)

14. Some of my troubles are solved by making sure the server has the player rejoin the socketio room on every freeplay request. I'm pretty sure this is a bandaid fix, but it makes it a lot better.
