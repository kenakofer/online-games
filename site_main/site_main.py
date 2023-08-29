#!/usr/bin/env python3
from flask import Flask
from config import Config
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_socketio import SocketIO
from oauthlib.oauth2 import WebApplicationClient

app = Flask(__name__)
app.config.from_object(Config)

def log_wsgi(app):
    def middleware(environ, start_response):
        print('WSGI Method: %s', environ['REQUEST_METHOD'])
        return app(environ, start_response)
    return middleware

app.wsgi_app = log_wsgi(app.wsgi_app)


db = SQLAlchemy(app)

# Enable echoing of queries to find issues
# db.get_engine().echo = True

migrate = Migrate(app, db)
login = LoginManager(app)
socketio = SocketIO(app, async_mode='threading', engineio_logger=True, logger=True)

client = WebApplicationClient(Config.GOOGLE_CLIENT_ID)

# from site import routes, models, shell_setup, sockets, hanabi
import routes, models, shell_setup, sockets, hanabi

if __name__ == "__main__":
    app.run()
    #app.run(debug=True)
