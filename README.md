# games.kenakofer.com
This repository holds the files for https://games.kenakofer.com, a site for homemade
multiplayer online board games.

The most substantial portion of this project [Freeplay](https://games.kenakofer.com/freeplay) aims to provide a general-purpose card table to which decks of cards can be added. Then the humans who play the game manage the rules themselves. This makes it simple to add a new card game by just collecting the image resources and specifying the pieces/cards in a json file. On my part, it beats spending dozens of hours of development to automate game logic for each new game.

The site's backend uses Flask, with addons socketio, sqlalchemy, and
login.

The frontend uses JQuery ~~and Knockout.js~~.


=====

Notes from getting it set up again after so long:

1. Changed name to wsgi.py in the outer directory so flask stuff associates better
2. Create DBs by using `flask shell`, then db.drop_all() and db.create_all(). Manually creating tables that seem to match is a bad idea and easy to get wrong.
3. Updated SocketIO constructor to use async threading. I'm not sure if it was doing this already...
4. Something is wrong with calls to render_template. Maybe stuff about checking the current_user?
5. Now login on windows firefox is failing entirely. Gonna try:
    - apt remove python3-flask-login (0.5.0-2)
    - 
6. Ok, so I guess I pip installed six at one point, and it was 1.11.0, which broke all requests.get. A bit embarrassing that I needed so many hacker tools to figure that out. I should add library checks at process startup or something.