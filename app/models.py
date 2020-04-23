from datetime import datetime
from app import db, login
from flask_login import UserMixin, current_user

class User(UserMixin, db.Model):
    # CREATE TABLE users(
    # 	id serial PRIMARY KEY,
    # 	username VARCHAR (32) UNIQUE NOT NULL,
    # 	email VARCHAR (120) UNIQUE NOT NULL,
    # 	fullname VARCHAR (128) NOT NULL
    # );

    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), index=True, unique=True, nullable=False)
    username = db.Column(db.String(32), index=True, unique=True)
    fullname = db.Column(db.String(128), index=True, nullable=False)

    def __repr__(self):
        return '{} (id={})'.format(self.fullname, self.id)

    def __eq__(self, other):
        return other and self.id == other.id

    def __ne__(self, other):
        return not self.__eq__(other)

    def __hash__(self):
        return self.id

@login.user_loader
def load_user(id):
    return User.query.get(int(id))

def get_stable_user():
    return User.query.get(current_user.id)
