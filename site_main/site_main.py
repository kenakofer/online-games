#!/usr/bin/env python3
from flask import Flask
from config import Config
from flask_login import LoginManager
from flask_socketio import SocketIO

app = Flask(__name__)
app.config.from_object(Config)

login = LoginManager(app)
socketio = SocketIO(app, async_mode='threading', engineio_logger=True, logger=True, ping_timeout=30, ping_interval=60)

app.freeplay_games = {}


# from site import routes, models, shell_setup, sockets, hanabi
import routes, models, shell_setup, sockets, hanabi

if __name__ == "__main__":
    app.run()
    #app.run(debug=True)
