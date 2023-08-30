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


from sqlalchemy import event
from sqlalchemy.orm import Session
from sqlalchemy.engine import Engine

@event.listens_for(Session, 'after_flush')
def receive_after_flush(session, flush_context):
    print('                        DB: After flush!')

@event.listens_for(Session, 'after_commit')
def receive_after_commit(session):
    print('                        DB: Transaction committed!')

@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement,
                        parameters, context, executemany):
    print("                        DB: Before Query: ", statement)

@event.listens_for(Engine, 'connect')
def receive_connect(dbapi_conn, connection_record):
    print('                        DB: New database connection')

@event.listens_for(Session, 'after_begin')
def after_begin(session, transaction, connection):
    print('                        DB: New transaction!')
                        
@event.listens_for(Session, 'after_transaction_end')  
def after_transaction_end(session, transaction):
    print('                        DB: Sessiosn transaction end!')

@event.listens_for(Session, 'after_rollback')
def receive_after_rollback(session):
    print('                        DB: After rollback!')

@event.listens_for(Session, 'after_soft_rollback')
def receive_after_soft_rollback(session, previous_transaction):
    print('                        DB: After soft rollback!')


# from site import routes, models, shell_setup, sockets, hanabi
import routes, models, shell_setup, sockets, hanabi

if __name__ == "__main__":
    app.run()
    #app.run(debug=True)
