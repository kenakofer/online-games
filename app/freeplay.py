from random import shuffle
from app import app, db, socketio
import threading
from time import sleep, time
from random import random, sample

#The list to be filled with freeplay_games
freeplay_games = {}

class FreeplayPlayer():

    def __init__(self, session_user, game):
        self.game = game
        self.player_index = len(game.players)
        game.players.append(self)
        self.session_user = session_user

        def __repr__(self):
            return str(self.session_user)

    def get_display_name(self):
        if self.session_user:
            return self.session_user.fullname
        return None

    def __repr__(self):
        return self.session_user.__repr__()

    def __eq__(self,other):
        return other and self.session_user and other.session_user and self.session_user.id == other.session_user.id

class TableMovable:

    # Sort in place a list of movables 
    def sort_movables_for_sending(movables_list):
        movables_list.sort(key=lambda obj:
            obj.get_index_in_parent() + (100000000 if isinstance(obj, Card) else 0)
        )

    def get_index_in_parent(self):
        if not self.parent:
            return 0
        if self in self.parent.dependents:
            return self.parent.dependents.index(self)
        # Otherwise
        return 0



    def __init__(self, id, game, position, dimensions, dependents=[], parent=None, display_name=""):
        self.id = id
        self.game = game
        self.position = position
        self.dimensions = dimensions
        self.dependents = dependents
        self.parent = parent
        if self.parent:
            self.parent.dependents.append(self)
        for d in dependents:
            d.parent = self
        self.player_moving = None
        self.display_name = display_name
        self.game.all_movables[self.id] = self
        self.push_to_top(moving=False)
        print("Created TableMovable {}".format(self))

    def push_to_top(self, moving=True):
        self.depth = self.game.get_next_depth(moving)

    # Calling this locks movement to only this player until stop_move is called.
    def start_move(self, player, recursive=False):
        #print("start_move id:{} player:{}".format(self.id, player))
        if (self.player_moving):
            print("{} can't start moving {}, it's already being moved by {}!".format(player, self.id, self.player_moving))
            return False
        self.player_moving = player
        # Objects recently moved should be put on top
        self.push_to_top(moving=True)
        # If it contains things, move them too
        for d in self.dependents:
            d.start_move(player, recursive=True)
        # If it was inside something, take it out (only if the user if moving the dependent and not the container)
        if self.parent and not recursive:
            self.parent.dependents.remove(self)
            p = self.parent
            self.parent = None
            p.check_should_destroy()
        return True

    def continue_move(self, player, new_position, no_check=False, no_update=False):
        if not self.player_moving == player and not no_check:
            print("{} can't continue moving {}, because {} is moving it!".format(player, self.id, self.player_moving))
        self.position = new_position
        for d in self.dependents:
            d.continue_move(player, new_position, no_check=no_check, no_update=True)
        # Update all users
        if not no_update:
            self.update_move()

    def stop_move(self, player, new_position, no_check=False, no_update=False):
        if (not self.player_moving == player) and (not no_check):
            print("{} can't stop moving {}, because {} is moving it!".format(player, self.id, self.player_moving))
        self.position = new_position
        # Put the element on top of the stationary things
        self.push_to_top(moving=False)
        # Release the player's hold on the object
        self.player_moving = None
        for d in self.dependents:
            d.stop_move(player, new_position, no_update=True, no_check=no_check)
        # Update all users
        if not no_update:
            self.update_move()

    def update_move(self):
        self.game.thread_lock.acquire()
        objects = [self] + self.dependents
        if self.parent:
            objects.append(self.parent)
        data = {
            "movables_info":[{
                "id":o.id,
                "player_moving_index":False if not o.player_moving else o.player_moving.player_index,
                "position":o.position,
                "dimensions":o.dimensions,
                "depth":o.depth,
                "parent":False if not o.parent else str(o.parent.id),
                "dependents":[od.id for od in o.dependents],
            } for o in objects]}
        with app.test_request_context('/'):
            socketio.emit('UPDATE', data, broadcast=True, room=self.game.gameid, namespace='/freeplay')
        self.game.thread_lock.release()
        return data



    def get_info(self):
        d = {
            "id":self.id,
            "player_moving_index":False if not self.player_moving else self.player_moving.player_index,
            "position":self.position,
            "dimensions":self.dimensions,
            "parent":False if not self.parent else str(self.parent.id),
            "dependents":[o.id for o in self.dependents],
            "display_name":self.display_name,
            "depth":self.depth,
            "type":self.__class__.__name__,
            }
        return d

    def check_should_destroy(self):
        if not self.display_name and len(self.dependents) < 2:
            self.destroy()

    def destroy(self, destroy_dependents=True, no_update=False):
        print('destroying {}...'.format(self.id))
        if self.parent:
            self.parent.dependents.remove(self)
        for d in self.dependents:
            d.parent = None
        del self.game.all_movables[self.id]
        self.game.thread_lock.acquire()
        data = {
            "movables_info":[{
                "id":self.id,
                "destroy":True,
                }]
            }
        with app.test_request_context('/'):
            socketio.emit('UPDATE', data, broadcast=True, room=self.game.gameid, namespace='/freeplay')
        self.game.thread_lock.release()
        if not no_update:
            self.game.send_update()

    def __repr__(self):
        return str(self.id)

class Card(TableMovable):

    def __init__(self, game, deck, front_image_id, back_image_id, alt_text="", dimensions=[-1,-1]):
        for i,c in enumerate(dimensions):
            if c<0:
                dimensions[i] = deck.dimensions[i]
        super().__init__(
                'CARD'+str(game.get_new_id()),
                game,
                deck.position,
                dimensions,
                dependents=[],
                parent=deck,
                display_name=alt_text,
                )
        game.cards[self.id] = self

    # This is called when one object in the client is dropped onto another
    # It combines the two objects, with other taking self's position
    def incorporate(self, other):
        # If the thing dropped onto has a parent, incorporate with that instead
        if (self.parent):
            print("calling the parent's combine...")
            return self.parent.incorporate(other)

        # Deck dropped onto single card
        elif type(other) is Deck:
            print("Dropping Deck on single Card...")
            # Make sure the card is not already in the deck
            if self in other.dependents:
                print("{} is already a dependent of {}".format(self,other))
                print(other.dependents)
                return False
            # Set parenthood of the deck
            if self.parent:
                self.parent.dependents.remove(self)
                self.parent = None
            self.parent = other
            other.dependents.insert(0,self)
            # Set the deck's position to be the same as the card, and stop any movement on the two
            self.stop_move(None, self.position, no_check=True, no_update=True)
            other.stop_move(None, self.position, no_check=True, no_update=True)
            self.game.send_update()

        # Single Card dropped onto single card
        elif type(other) is Card:
            assert not self.parent and not other.parent
            print("Dropping single Card on single Card...")
            new_deck = Deck(self.game, self.position, self.dimensions, cards=[self, other], text="")
            # Set the deck's position to be the same as the card, and stop any movement on the two
            self.stop_move(None, self.position, no_check=True, no_update=True)
            other.stop_move(None, self.position, no_check=True, no_update=True)
            print(self.position)
            print(other.position)
            self.game.send_update()



class Deck(TableMovable):

    def __init__(self, game, position, dimensions, cards=[], text=""):
        super().__init__(
                'DECK'+str(game.get_new_id()),
                game,
                position,
                dimensions,
                dependents=cards,
                display_name=text,
                )
        game.decks[self.id] = self

    def shuffle_cards(self):
        # In place shuffle
        shuffle(self.dependents)
        for d in self.dependents:
            d.push_to_top(moving=False)
        # Update all clients
        self.game.send_update()

    # This is called when one object in the client is dropped onto another
    # It combines the two objects, with other taking self's position
    def incorporate(self, other):
        if self==other:
            print("You're trying to combine the same thing?")
        # Deck dropped onto deck
        elif type(other) is Deck:
            print("Dropping Deck on Deck...")
            # For each card in other, add it to self deck and align its position
            while len(other.dependents) > 0:
                card = other.dependents.pop(0)
                self.dependents.append(card)
                card.parent = self
            # Delete the other deck
            other.destroy(no_update=True)
            # Set the deck's position to be the same as the card, and stop any movement on the two
            self.stop_move(None, self.position, no_check=True, no_update=True)

        # Single Card dropped onto Deck
        elif type(other) is Card:
            assert not other.parent
            print("Dropping single Card on Deck...")
            # Set the deck's position to be the same as the card, and stop any movement on the two
            self.dependents.append(other)
            other.parent = self
            self.stop_move(None, self.position, no_check=True, no_update=True)

        # In any case, update everyone
        self.game.send_update()


class FreeplayGame:

    def __init__(self, gameid):
        self.thread_lock = threading.Lock()
        self.thread_lock.acquire()
        self.players = []
        self.cards = {}
        self.decks = {}
        self.all_movables = {}
        self.gameid = gameid
        self.id_counter = 0
        self.time_of_last_update = time()
        self.game_over=False
        self.recent_messages = []
        self.thread_lock.release()
        self.depth_counter= [-1, 100000000]
        #For testing, create a deck with cards in it
        deck = Deck(self, (100,100), (100,100), text="mydeck")
        for i in range(52):
            Card(self, deck, None, None, alt_text=str(i))
        self.send_update()

    def get_next_depth(self, moving):
        i = 1 if moving else 0
        self.depth_counter[i] += 1
        return self.depth_counter[i]

    def add_player(self, session_user):
        if (self.get_player_from_session(session_user)):
            print('The session user {} already has a player'.format(session_user))
            return None
        new_player = FreeplayPlayer(session_user, self)
        return new_player

    def get_new_id(self):
        self.id_counter += 1
        return str(self.id_counter).zfill(3)

    def get_player_from_session(self, session_user):
        player_list = [p for p in self.players if p.session_user == session_user]
        if len(player_list) == 0:
            print('No player associated with this session_user: {}'.format(session_user))
            return None
        else:
            return player_list[0]

    def send_update(self, which_movables=None):
        print("sending update")
        self.thread_lock.acquire()
        which_movables = list(which_movables or self.all_movables.values())
        TableMovable.sort_movables_for_sending(which_movables)
        # Most of the info needed in the cards
        movables_info = [m.get_info() for m in which_movables]
        player_names = [p.get_display_name() for p in self.players if p.session_user or p.AI]
        all_data = {
            "movables_info":movables_info,
            "players":player_names,
            'recent_messages':self.recent_messages,
            }
        with app.test_request_context('/'):
            socketio.emit('UPDATE', all_data, broadcast=True, room=self.gameid, namespace='/freeplay')
        self.thread_lock.release()
        return all_data

    def delete_if_stale(self):
        # Stop the game and AIs if inactive for this many seconds
        if time() - self.time_of_last_update > 60*60:
            self.game_over = True
            print("Stopping game {} due to inactivity".format(self.gameid))
            self.send_update()
