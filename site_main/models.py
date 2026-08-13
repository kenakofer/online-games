from flask import session as flask_session
from flask_login import UserMixin, current_user
from site_main import login


class SessionUser(UserMixin):
    """A player identified only by their browser session.

    There is no user table any more. The signed session cookie holds a
    generated id and the display name the player typed, and this object is
    rebuilt from it on each request. The game modules only ever ask for .id,
    .fullname, .username and equality, so they cannot tell the difference.

    Display names are decoration: they are not unique, and nothing stops two
    players choosing the same one. The id is what identifies a player.
    """

    def __init__(self, id, fullname):
        self.id = id
        self.fullname = fullname
        self.username = fullname.split()[0] if fullname else fullname

    def __repr__(self):
        return '{} (id={})'.format(self.fullname, self.id)

    def __eq__(self, other):
        return other and self.id == other.id

    def __ne__(self, other):
        return not self.__eq__(other)

    def __hash__(self):
        return hash(self.id)


@login.user_loader
def load_user(id):
    # Only trust the id we signed into the cookie, not the one handed to us.
    if flask_session.get('user_id') != id:
        return None
    return SessionUser(id, flask_session.get('fullname'))


def get_stable_user():
    """The user as a plain object rather than a request-bound proxy.

    This used to re-read the row from the database so that copies held by
    in-memory games compared equal across requests. Session users carry a
    stable id in the cookie, so unwrapping the proxy is enough.
    """
    return current_user._get_current_object()
