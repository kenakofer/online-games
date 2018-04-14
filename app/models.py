from datetime import datetime
from app import db, login
from flask_login import UserMixin, current_user

user_game_score = db.Table('user_game_score',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id')),
    db.Column('gamescore_id', db.Integer, db.ForeignKey('gamescore.id')),
)

class User(UserMixin, db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), index=True, unique=True, nullable=False)
    username = db.Column(db.String(32), index=True, unique=True)
    fullname = db.Column(db.String(128), index=True, nullable=False)
    pagecount = db.Column(db.Integer, default=0, nullable=False)
    games = db.relationship(
        "GameScore",
        secondary="user_game_score",
        backref="users",
        lazy='subquery',
    )

    def __repr__(self):
        return '{} (id={})'.format(self.fullname, self.id)

    def __eq__(self, other):
        return self.id == other.id

    def __ne__(self, other):
        return not self.__eq__(other)

    def __hash__(self):
        return self.id

@login.user_loader
def load_user(id):
    return User.query.get(int(id))

def get_stable_user():
    return User.query.get(current_user.id)


# TODO I think this is fine for hanabi, but there's no way to associate two
# different scores in a competitive game with one another
class GameScore(db.Model):
    __tablename__ = 'gamescore'
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(120), nullable=False)
    gname = db.Column(db.String(32))
    score = db.Column(db.Float, nullable=False)
    datetime = db.Column(db.DateTime(), nullable=False, default=datetime.utcnow)
    # For hanabi
    playercount = db.Column(db.Integer)
    handsize = db.Column(db.Integer)
    highestcard = db.Column(db.Integer)
    lettercount = db.Column(db.Integer)
    strictness = db.Column(db.Integer)

