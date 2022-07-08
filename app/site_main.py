#!/usr/bin/env python3
from flask import Flask
from config import Config
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_socketio import SocketIO

app = Flask(__name__)
app.config.from_object(Config)
db = SQLAlchemy(app)
migrate = Migrate(app, db)
login = LoginManager(app)
socketio = SocketIO(app)

# from site import routes, models, shell_setup, sockets, hanabi
import routes, models, shell_setup, sockets, hanabi

if __name__ == "__main__":
    app.run()
    #app.run(debug=True)
