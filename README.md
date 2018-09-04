# games.gc.my
This repository holds the files for https://games.gc.my, a site for homemade
multiplayer online board games.

The most substantial portion of this project [Freeplay](https://games.gc.my/freeplay) aims to provide a general-purpose card table to which decks of cards can be added. Then the humans who play the game manage the rules themselves. This makes it simple to add a new card game by just collecting the image resources and specifying the pieces/cards in a json file. On my part, it beats spending dozens of hours of development to automate game logic for each new game.

The site's backend uses Flask, with addons socketio, sqlalchemy, and
login.

The frontend uses JQuery ~~and Knockout.js~~.
