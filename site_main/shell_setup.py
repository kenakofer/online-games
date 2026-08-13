# When this file is included, it allows calls to "flask shell" on
# the CLI to import these variables. Quite handy!
# python3 -i shell_setup.py
from site_main import app
from models import SessionUser


@app.shell_context_processor
def make_shell_context():
    return {'SessionUser': SessionUser, 'freeplay_games': app.freeplay_games}
