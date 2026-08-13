import os
import secrets


class Config:
    # The secret key signs the session cookie, and the session cookie *is* the
    # player's identity now. Changing it logs everyone out, so on a real
    # deployment set SECRET_KEY in the environment and leave it alone.
    #
    # Falling back to a random key keeps local development working without any
    # setup, at the cost of logging you out whenever the server restarts.
    SECRET_KEY = os.environ.get('SECRET_KEY') or secrets.token_hex(32)
