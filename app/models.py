from app import db, login
from flask_login import UserMixin

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), index=True, unique=True, nullable=False)
    username = db.Column(db.String(32), index=True, unique=True)
    fullname = db.Column(db.String(128), index=True, nullable=False)
    pagecount = db.Column(db.Integer, default=0, nullable=False)
    tmp = {}

    def __repr__(self):
        return '{} (id={})'.format(self.fullname, self.id)

@login.user_loader
def load_user(id):
    return User.query.get(int(id))
