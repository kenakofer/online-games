#!/usr/bin/env python3
"""WSGI entry point.

The app modules import each other by bare name (``import routes``), so
site_main/ has to be on the path rather than being treated as a package.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'site_main'))

from site_main import app, socketio  # noqa: E402

application = app

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
