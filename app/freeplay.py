from random import shuffle, random, sample, randint
from app import app, db, socketio
import threading
from time import sleep, time
from json import load
from collections import OrderedDict
from markdown2 import markdown

#The dict to be filled with freeplay_games
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
        return self.session_user.fullname

    def __eq__(self,other):
        return other and self.session_user and other.session_user and self.session_user.id == other.session_user.id

class TableMovable:

    # Sort in place a list of movables
    def sort_movables_for_sending(movables_list):
        movables_list.sort(key=lambda obj:
            obj.get_index_in_parent() + (100000000 if not isinstance(obj, Card) else 0)
        )

    def get_index_in_parent(self):
        if not self.parent:
            return 0
        if self in self.parent.dependents:
            return self.parent.dependents.index(self)
        # Otherwise
        return 0



    def __init__(self, id, game, position, dimensions, dependents=None, parent=None, display_name="", force_card_depth=None):
        self.id = id
        self.sort_index = game.get_sort_index()
        self.game = game
        self.position = position
        self.dimensions = dimensions
        self.dependents = dependents or []
        self.parent = parent
        if self.parent:
            self.parent.dependents.append(self)
        for d in dependents:
            d.parent = self
        self.player_moving = None
        self.display_name = display_name
        self.game.all_movables[self.id] = self
        self.privacy = -1
        self.force_card_depth = force_card_depth
        self.push_to_top(moving=False)

    def push_to_top(self, moving=True):
        if self.parent == None and self.privacy == -1 and self.force_card_depth != None:
            self.depth = self.force_card_depth
        else:
            self.depth = self.get_next_depth(moving)

    # Calling this locks movement to only this player until stop_move is called.
    def start_move(self, player, recursive=False):
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
            self.game.send_update([self, self.parent], include_self=False )
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
            print("update_move with include_self=True")
            self.update_move(include_self=False)

    def stop_move(self, player, new_position, privacy=None, no_check=False, no_update=False):
        if (not self.player_moving == player) and (not no_check):
            print("{} can't stop moving {}, because {} is moving it!".format(player, self.id, self.player_moving))
        self.position = new_position
        # If the privacy flag is set, change the privacy of object (and dependents)
        if privacy != None:
            self.privacy = privacy
        # Put the element on top of the stationary things
        self.push_to_top(moving=False)
        # Release the player's hold on the object
        self.player_moving = None
        for d in self.dependents:
            d.stop_move(player, new_position, privacy=privacy, no_update=True, no_check=no_check)
        # Update all users
        if not no_update:
            self.update_move()

    def update_move(self, include_self=True):
        self.game.thread_lock.acquire()
        objects = [self]
        if self.parent:
            objects.append(self.parent)
        data = {
            "movables_info":[{
                "id":                   o.id,
                "player_moving_index":  -1 if not o.player_moving else o.player_moving.player_index,
                "position":             o.position,
                "dimensions":           o.dimensions,
                "depth":                o.depth,
                "parent":               False if not o.parent else str(o.parent.id),
                "privacy":              o.privacy,
            } for o in objects]}
        #with app.test_request_context('/'):
        socketio.emit('UPDATE', data, broadcast=True, room=self.game.gameid, namespace='/freeplay', include_self=include_self)
        self.game.thread_lock.release()
        return data

    def recursive_set_privacy(self, privacy, recursive=False):
        self.privacy = privacy
        for d in self.dependents:
            d.recursive_set_privacy(privacy, recursive=True)
        if not recursive:
            self.update_move()


    def resize(self, player, new_dims):
        self.dimensions = new_dims
        self.game.thread_lock.acquire()
        data = {
            "movables_info":[{
                "id":self.id,
                "dimensions":self.dimensions,
            }]}
        with app.test_request_context('/'):
            socketio.emit('UPDATE', data, broadcast=True, room=self.game.gameid, namespace='/freeplay')
        self.game.thread_lock.release()


    def get_info(self):
        d = {
            "id":                   self.id,
            "player_moving_index":  -1 if not self.player_moving else self.player_moving.player_index,
            "position":             self.position,
            "dimensions":           self.dimensions,
            "parent":               False if not self.parent else str(self.parent.id),
            "dependents":           [o.id for o in self.dependents],
            "display_name":         self.display_name,
            "depth":                self.depth,
            "type":                 self.__class__.__name__,
            "privacy":              self.privacy,
            "force_card_depth":     False if self.force_card_depth == None else self.force_card_depth,
            }
        return d

    def check_should_destroy(self):
        if not self.display_name and len(self.dependents) < 2:
            self.destroy()

    def get_next_depth(self, moving):
        if moving:
            i = 'dragging'
        elif self.privacy != -1:
            i = 'private'
        else:
            i = 'public'
        self.game.depth_counter[i] += 1
        return self.game.depth_counter[i]

    def destroy(self, destroy_dependents=False, update=True, data=None):
        if (update):
            self.game.thread_lock.acquire()

        print('destroying {}...'.format(self.id))

        data = data or {'movables_info':[]}
        data['movables_info'].append({
            "id":self.id,
            "destroy":True,
        })
        if self.parent:
            self.parent.dependents.remove(self)
        for d in self.dependents:
            d.parent = None
            if destroy_dependents:
                d.destroy(destroy_dependents=True, update=False, data=data)
        del self.game.all_movables[self.id]
        if (update):
            with app.test_request_context('/'):
                socketio.emit('UPDATE', data, broadcast=True, room=self.game.gameid, namespace='/freeplay')
            self.game.thread_lock.release()

    def __repr__(self):
        return str(self.id)

class Card(TableMovable):

    def __init__(self, game, deck, images, current_image, alt_text="", dims=[-1,-1], dfuo=None, dfdo=None, stack_group=None, background_color=None, force_card_depth=None):
        dimensions = dims[:]
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
                force_card_depth=force_card_depth
                )
        self.stack_group = stack_group or deck.display_name
        self.images = images
        self.current_image = current_image
        self.dfuo = dfuo or [25,0]
        self.dfdo = dfdo or [3,2]
        self.background_color = background_color
        game.cards[self.id] = self

    # This is called when one object in the client is dropped onto another
    # It combines the two objects, with other taking self's position
    def incorporate(self, other):
        other.privacy = self.privacy
        # If the thing dropped onto has a parent, incorporate with that instead
        if (self.parent):
            print("calling the parent's combine...")
            return self.parent.incorporate(other)

        # Deck dropped onto single card
        elif type(other) is Deck:
            print("Dropping Deck on single Card...")
            # Set the privacy of all the cards in the dropped deck
            other.recursive_set_privacy(self.privacy)
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
            for d in other.dependents:
                if type(d) is not Dice:
                    d.current_image = self.current_image
            # Set the deck's position to be the same as the card, and stop any movement on the two
            self.stop_move(None, self.position, no_check=True, no_update=True)
            other.stop_move(None, self.position, no_check=True, no_update=True)
            self.game.send_update(which_movables = [self, other] + other.dependents)

        # Single Card dropped onto single card
        #elif type(other) is Card:
        else:
            assert not self.parent and not other.parent
            print("Dropping single Card on single Card...")
            new_deck = Deck(self.game, self.position, self.dimensions, cards=[self, other], text="")
            new_deck.privacy = self.privacy
            if type(other) is not Dice:
                other.current_image = self.current_image
            # Set the deck's position to be the same as the card, and stop any movement on the two
            self.stop_move(None, self.position, no_check=True, no_update=True)
            other.stop_move(None, self.position, no_check=True, no_update=True)
            print(self.position)
            print(other.position)
            self.game.send_update([self, other, new_deck])

    def roll(self, no_update=True):
        print("Can't roll card! "+self.id)
        return

    def flip(self, no_update=False):
        if (len(self.images) == 2):
            if type(self) is not Dice:
                self.current_image = 0 if self.current_image == 1 else 1
            if not no_update:
                self.game.thread_lock.acquire()
                data = {
                    "movables_info":[{
                        "id":self.id,
                        "current_image":self.current_image,
                        }]
                    }
                with app.test_request_context('/'):
                    socketio.emit('UPDATE', data, broadcast=True, room=self.game.gameid, namespace='/freeplay')
                self.game.thread_lock.release()

    def get_info(self):
        info                              =  super().get_info()
        info['images']                    =  self.images
        info['current_image']             =  self.current_image
        info['default_face_up_offset']    =  self.dfuo
        info['default_face_down_offset']  =  self.dfdo
        info['stack_group']               =  self.stack_group
        if self.background_color:
            info['background_color']      =  self.background_color
        return info

class Dice(Card):
    def __init__(self, game, deck, images, current_image, alt_text="", dims=[-1,-1], dfuo=None, dfdo=None, stack_group=None, background_color=None, force_card_depth=None):
        dimensions = dims[:]
        for i,c in enumerate(dimensions):
            if c<0:
                dimensions[i] = deck.dimensions[i]
        TableMovable.__init__(
            self,
            'DICE'+str(game.get_new_id()),
            game,
            deck.position,
            dimensions,
            dependents=[],
            parent=deck,
            display_name=alt_text,
            force_card_depth=force_card_depth
            )
        self.stack_group = stack_group or deck.display_name
        self.images = images
        self.current_image = current_image
        self.dfuo = dfuo or [25,0]
        self.dfdo = dfdo or [3,2]
        game.cards[self.id] = self
        self.background_color = background_color

    def roll(self, no_update=False):
        self.current_image = randint(0,len(self.images)-1)
        if not no_update:
            self.game.update_current_image([self], rolling=True)
        return self.current_image

    def increment(self, amount, no_update=False):
        self.current_image += amount
        self.current_image = max(self.current_image, 0)
        self.current_image = min(self.current_image, len(self.images)-1)
        if not no_update:
            self.game.update_current_image([self], rolling=False)
        return self.current_image

class Deck(TableMovable):

    def __init__(self, game, position, dimensions, cards=None, text="", offset_per_dependent=None):
        super().__init__(
                'DECK'+str(game.get_new_id()),
                game,
                position,
                dimensions,
                dependents=cards or [],
                display_name=text,
                )
        self.offset_per_dependent = offset_per_dependent or [3,2]


        game.decks[self.id] = self

    def sort_cards(self, no_update=False):
        # In place shuffle
        self.dependents.sort(key=lambda card: card.sort_index)
        for d in self.dependents:
            d.push_to_top(moving=False)
        # Update all clients
        if not no_update:
            self.game.send_update([self]+self.dependents)

    def shuffle_cards(self, no_update=False):
        # In place shuffle
        shuffle(self.dependents)
        for d in self.dependents:
            d.push_to_top(moving=False)
        # Update all clients
        if not no_update:
            self.game.send_update([self]+self.dependents)

    # This is called when one object in the client is dropped onto another
    # It combines the two objects, with other taking self's position
    def incorporate(self, other):
        other.privacy = self.privacy
        if self==other:
            print("You're trying to combine the same thing?")
        # Deck dropped onto deck
        elif type(other) is Deck:
            print("Dropping Deck on Deck...")
            other.recursive_set_privacy(self.privacy)
            # Save which dependents are new
            other_deps = other.dependents[:]
            # For each card in other, add it to self deck and align its position
            while len(other.dependents) > 0:
                card = other.dependents.pop(0)
                self.dependents.append(card)
                if type(card) is not Dice:
                    card.current_image = self.dependents[0].current_image
                card.parent = self
            # Delete the other deck
            other.destroy()
            for o in other_deps:
                o.stop_move(None, self.position, no_check=True, no_update=True)
            # Update only the new parent deck and those cards which were added to it
            self.game.send_update([self] + self.dependents)

        # Single Card dropped onto Deck
        #elif type(other) is Card:
        else:
            assert not other.parent
            print("Dropping single Card on Deck...")
            self.dependents.append(other)
            if type(other) is not Dice:
                other.current_image = self.dependents[0].current_image
            other.parent = self
            other.stop_move(None, self.position, no_check=True, no_update=True)
            self.game.send_update([self, other] + other.dependents)

    def roll(self, no_update=False):
        for d in self.dependents:
            d.roll(no_update=True)
        if not no_update:
            self.game.update_current_image(self.dependents, rolling=True)
            return

    def flip(self, no_update=False):
        for d in self.dependents:
            d.flip(no_update=True)
        # Reverse dependents and put them at the proper height
        self.dependents.reverse()
        for d in self.dependents:
            d.push_to_top(moving=False)
        if not no_update:
            self.game.send_update([self]+self.dependents)
            return

    def get_standard_deck(game):
        print('standard deck')
        deck = Deck(game, (100,100), (69,75), text="mydeck")
        for i in range(52):
            Card(game, deck, '/static/images/freeplay/standard_deck/card-{}.png'.format(i), alt_text=str(i))
        return deck

    def opd_conversion(opd):
        if isinstance(opd, dict):
            opd = {k: Deck.opd_conversion(v) for k, v in opd.items()}
        elif isinstance(opd, list):
            opd = [Deck.opd_conversion(i) for i in opd]
        else:
            opd = opd * abs(opd) / 16
        return opd

    def get_decks_from_json(game, path_to_json):
        print(path_to_json)
        with open(path_to_json) as f:
            data = load(f, object_pairs_hook=OrderedDict) #json.load
        xleft = 15
        x = xleft
        y = 67
        maxheight = 0
        if 'quick_messages' in data:
            game.quick_messages = data['quick_messages'];
        if 'private_hand_height' in data:
            game.private_hand_height = data['private_hand_height']
        for deck_name in data['decks']:
            # Get general deck info with defaults
            deck_data = data['decks'][deck_name]
            deck_data_copy = deck_data.copy()
            # Add global "all_cards" settings to each deck
            if 'all_cards' in data:
                for k in data['all_cards']:
                    deck_data[k] = data['all_cards'][k]
            # Allow specific deck settings to take precedence
            for k in deck_data_copy:
                deck_data[k] = deck_data_copy[k]
            w = deck_data['width'] if 'width' in deck_data else 69
            h = deck_data['height'] if 'height' in deck_data else 75
            maxheight = max(maxheight, h)
            shuffle = deck_data['shuffle'] if 'shuffle' in deck_data else False
            x = deck_data['x'] if 'x' in deck_data else x
            y = deck_data['y'] if 'y' in deck_data else y
            opd = deck_data['offset_per_dependent'] if 'offset_per_dependent' in deck_data else [3,2]
            # Perform mathematical adjustment on opd:
            opd = Deck.opd_conversion(opd)
            face_up = deck_data['face_up'] if 'face_up' in deck_data else True
            deck = Deck(game, [x,y], [w,h], text=deck_name, offset_per_dependent=opd)
            # Get the card info for this deck
            for card_data in deck_data['cards']:
                card_data_copy = card_data.copy()
                # Add deck wide settings to cards (this also means that global settings are carried down too)
                for k in deck_data:
                    if k != 'cards':
                        card_data[k] = deck_data[k]
                # Allow specific card settings to take precedence
                for k in card_data_copy:
                    card_data[k] = card_data_copy[k]

                # Defaults if nothing specified
                biu = card_data['back_image_url'] if 'back_image_url' in card_data else '/static/images/freeplay/red_back.png'
                bis = card_data['back_image_style'] if 'back_image_style' in card_data else 'initial'
                images = card_data['images'] if 'images' in card_data else [{'url':card_data['front_image_url'], 'style':'100% 100%'},{'url':biu, 'style':bis}]
                at = card_data['alt_text'] if 'alt_text' in card_data else ""
                reps = card_data['repetitions'] if 'repetitions' in card_data else 1
                dfuo = card_data['default_face_up_offset'] if 'default_face_up_offset' in card_data else [24,0]
                dfuo = Deck.opd_conversion(dfuo)
                dfdo = card_data['default_face_down_offset'] if 'default_face_down_offset' in card_data else [3,2]
                dfdo = Deck.opd_conversion(dfdo)
                stack_group = card_data['stack_group'] if 'stack_group' in card_data else deck_name
                current_image = card_data['current_image'] if 'current_image' in card_data else (0 if face_up else 1)
                object_type = card_data['type'] if 'type' in card_data else "Card"
                background_color = card_data['background_color'] if 'background_color' in card_data else None
                force_card_depth = card_data['force_card_depth'] if 'force_card_depth' in card_data else None
                if (object_type == "Dice"):
                    # Create the dice
                    for i in range(reps):
                        dice = Dice(
                                game,
                                deck,
                                images,
                                current_image,
                                alt_text = at,
                                dfuo = dfuo,
                                dfdo = dfdo,
                                stack_group = stack_group,
                                background_color = background_color,
                                force_card_depth = force_card_depth
                                )
                else:
                    # Create the card
                    for i in range(reps):
                        card = Card(
                                game,
                                deck,
                                images,
                                current_image,
                                alt_text = at,
                                dfuo = dfuo,
                                dfdo = dfdo,
                                stack_group = stack_group,
                                background_color = background_color,
                                force_card_depth = force_card_depth
                                )

            if shuffle:
                deck.shuffle_cards(no_update=True)
            # Move over the width of the deck, considering its dependents
            shift = w
            if len(deck.dependents) > 0:
                d = deck.dependents[0]
                offset = (d.dfuo if d.current_image == 0 else d.dfdo)
                if isinstance(offset, dict):
                    offset = offset['public']
                shift = (len(deck.dependents) - 1) * offset[0] + d.dimensions[0]
            # And a bit more too
            x += shift + 40
            if x > 640 or ('last_in_row' in deck_data and deck_data['last_in_row']):
                y += maxheight + 60
                x = xleft
                maxheight = 0

        return True



    def deal(self, count, which_face):
        new_position = self.position[:]
        new_position[0] += self.dimensions[0]+40
        new_deck = Deck(self.game, new_position, self.dimensions[:], cards=[], text="", offset_per_dependent=[30,0])
        new_deck.privacy = self.privacy
        for i in range(count):
            if len(self.dependents) == 0:
                break
            card = self.dependents[-1]
            self.dependents = self.dependents[:-1]
            card.parent = new_deck
            card.parent.dependents.append(card)
            card.stop_move(None, new_position, no_check=True, no_update=True)
            # If 'same face' keep the same direction, otherwise set face up or down
            if type(self) is not Dice:
                if not which_face == "same face":
                    card.current_image = 0 if (which_face == 'face up') else 1
        new_deck.push_to_top(moving = False)
        self.game.send_update([new_deck] + new_deck.dependents + [self])
        # If the deck has 1 or fewer cards, destroy it
        new_deck.check_should_destroy()

    def get_info(self):
        info = super().get_info()
        info['offset_per_dependent'] = self.offset_per_dependent
        return info


class FreeplayGame:

    def __init__(self, gameid, deck_name='rook'):
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
        self.messages = []
        self.quick_messages = ['Who\'s turn?', 'My turn', 'Your turn', 'Good game', 'I win!', 'Play again?']
        self.instructions_html = "";
        self.thread_lock.release()
        self.depth_counter= {'public':100, 'private':50000000, 'dragging':100000000}
        self.sort_index = 0
        self.private_hand_height = None;

        Deck.get_decks_from_json(self, app.root_path+'/static/images/freeplay/'+deck_name+'/game.json')
        self.get_instructions_from_markdown(app.root_path+'/static/images/freeplay/'+deck_name+'/instructions.md')

    def get_sort_index(self):
        self.sort_index += 1
        return self.sort_index

    def add_player(self, session_user):
        if (self.get_player_from_session(session_user)):
            print('The session user {} already has a player'.format(session_user))
            return None
        new_player = FreeplayPlayer(session_user, self)
        return new_player

    def add_message(self, player, text):
        self.messages.append({
            'timestamp':    time(),
            'player_index': player.player_index,
            'text':         text,
        })

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

    def confirm_or_destroy_id(self, id):
        if id in self.all_movables:
            return True
        # It doesn't exist, so let's tell the clients
        self.thread_lock.acquire()

        print('Can\'t find {}, telling client to destroy...'.format(id))

        data = {'movables_info':[]}
        data['movables_info'].append({
            "id":id,
            "destroy":True,
        })
        with app.test_request_context('/'):
            socketio.emit('UPDATE', data, broadcast=False, room=self.gameid, namespace='/freeplay')
        self.thread_lock.release()
        # And since things might be royally messed up client side, update their movables
        self.send_update(broadcast=False)
        return False

    def get_instructions_from_markdown(self, path_to_md):
        print('Trying to get instructions from '+path_to_md)
        try:
            with open(path_to_md, 'r', encoding="utf-8") as md_file:
                print("File opened successfully")
                data = md_file.read()
                print("File read successfully")
                self.instructions_html = markdown(data, extras=["target-blank-links"])
                print("Markdown parsed successfully");
        except Exception as e:
            print(path_to_md+" does not exist or could not be loaded. Error:")
            print(e)

    def send_messages(self):
        print("sending message update")
        # Passing the False makes it try to acquire the lock. If it can't it enters the if
        if not self.thread_lock.acquire(False):
            print("blocked...")
            self.thread_lock.acquire()
        all_data = {'messages':self.messages}
        with app.test_request_context('/'):
            socketio.emit('UPDATE', all_data, broadcast=True, room=self.gameid, namespace='/freeplay')
        self.thread_lock.release()
        return all_data

    def send_update(self, which_movables=None, keys=None, include_self=True, broadcast=True):
        print("sending update:")
        # Passing the False makes it try to acquire the lock. If it can't it enters the if
        if not self.thread_lock.acquire(False):
            print("blocked...")
            self.thread_lock.acquire()
            print("released.");

        if keys == None:
            keys = ['movables_info']

        all_data = {}
        if 'movables_info' in keys or 'all' in keys:
            # Most of the info needed in the cards
            which_movables = list(set(which_movables or self.all_movables.values()))
            TableMovable.sort_movables_for_sending(which_movables)
            movables_info = [m.get_info() for m in which_movables]
            all_data["movables_info"] = movables_info
        if 'players' in keys or 'all' in keys:
            # Only send first names
            player_names = [p.get_display_name().split()[0] for p in self.players if p.session_user]
            all_data['players'] = player_names
        if 'messages' in keys or 'all' in keys:
            all_data['messages'] = self.messages
        if 'quick_messages' in keys or 'all' in keys:
            all_data['quick_messages'] = self.quick_messages
        if 'instructions_html' in keys or 'all' in keys:
            all_data['instructions_html'] = self.instructions_html
        if 'private_hand_height' in keys or 'all' in keys:
            all_data['private_hand_height'] = self.private_hand_height
        print('updated keys: '+str(list(all_data.keys())))

        #with app.test_request_context('/'):
        socketio.emit('UPDATE', all_data, broadcast=broadcast, room=self.gameid, namespace='/freeplay', include_self=include_self)
        self.thread_lock.release()
        return all_data

    def update_current_image(self, which_movables, rolling=False, include_self=True):
        print("update roll")
        # Passing the False makes it try to acquire the lock. If it can't it enters the if
        if not self.thread_lock.acquire(False):
            print("blocked...")
            self.thread_lock.acquire()
        which_movables = list(set(which_movables))
        movables_info = [{'id':m.id, 'current_image':m.current_image, 'roll':rolling} for m in which_movables]
        # Only send first names
        all_data = { "movables_info":movables_info }
        socketio.emit('UPDATE', all_data, broadcast=True, room=self.gameid, namespace='/freeplay', include_self=include_self)
        self.thread_lock.release()
        return all_data

    def delete_if_stale(self):
        # Stop the game and AIs if inactive for this many seconds
        if time() - self.time_of_last_update > 60*60:
            self.game_over = True
            print("Stopping game {} due to inactivity".format(self.gameid))
