from random import shuffle
from app import app, db, socketio
from app.models import GameScore, User
import threading
from time import sleep
from random import random

#The list to be filled with blitzgames
blitz_games = {}

class BlitzAI( threading.Thread ):

    def __init__(self,name,player,speed,mistakes):
        threading.Thread.__init__(self)
        self.player = player
        self.player.AI = self
        self.speed = speed
        self.mistakes = mistakes
        self.game = player.game

    def run(self):
        while not self.game.game_over:
            self.check_card_loop() or self.player.deal_deck()
            sleep(self.speed + random()-.5)


    def check_card_loop(self):
        cards_to_check = self.player.card_positions['QUEUE'].cards[:]
        if len(self.player.card_positions['DUMP'].cards)>0:
            cards_to_check.append(self.player.card_positions['DUMP'].cards[-1])
        for c in cards_to_check:
            # Find an empty pile to play a 1 in
            for p in self.game.play_piles:
                if (c.number==len(p.cards)+1) and (len(p.cards)==0 or p.cards[0].color == c.color):
                    self.player.play_card(c, p)
                    return True

class BlitzPlayer:

    def __init__(self,pi,game):
        self.player_index = pi
        self.game = game
        game.players.append(self)
        self.session_user = None
        self.played_cards = 0
        self.card_positions = {}
        self.AI = False
        self.cards = BlitzDeck.get_fresh_player_deck(self)
        # Create the player's card positions
        # The stock pile
        si = self.game.stock_size
        self.card_positions['STOCK']= CardPosition(game,"P{}_STOCK".format(pi),self.cards[:si])
        # The queue positions, holding 4 cards, the first of which could be on top of the stock pile
        self.card_positions['QUEUE']= CardPosition(game,"P{}_QUEUE".format(pi),self.cards[si : si+self.game.queue_size])
        # The dump position
        self.card_positions['DUMP']= CardPosition(game,"P{}_DUMP".format(pi),[])
        # The deck position
        self.card_positions['DECK']= CardPosition(game,"P{}_DECK".format(pi),self.cards[si+self.game.queue_size:])

        def __repr__(self):
            return str(self.session_user)

    def play_card(self, card, to_pos):
        self.game.thread_lock.acquire()
        i = self.player_index
        cards_to_update = card.pos.cards + to_pos.cards
        if not card.pos in self.card_positions.values():
            print('Player {}, index {} can\'t play {}: it\'s in pos {}, not theirs!'.format(self, i, card, card.pos))
        elif not "DUMP" in card.pos.name and not "QUEUE" in card.pos.name:
            print('Player {}, index {} can\'t play {}: it\'s in pos {}'.format(self, i, card, card.pos))
        elif not "PLAY" in to_pos.name:
            print('Player {}, index {} can\'t play to pos {}'.format(self, i, card.pos))
        elif card.number != len(to_pos.cards)+1:
            print('Player {}, index {} can\'t play {} to pos {}: Expecting a {}'.format(self, i, card, card.pos, len(to_pos.cards)+1))
        elif len(to_pos.cards) > 0 and card.color != to_pos.cards[0].color:
            print('Player {}, index {} can\'t play {} to pos {}: Expecting a {}'.format(self, i, card, card.pos, to_pos.cards[0].color))
        elif 'DUMP' in card.pos.name and card != card.pos.cards[-1]:
            print('Player {}, index {} can\'t play {}: Not on top of pile'.format(self, i, card))
        # At this point, the player is trying to move a card from their QUEUE or DECK to a play pile that can receive it
        # If it's coming from the queue, replace it by drawing from the stock
        else:
            if 'QUEUE' in card.pos.name:
                if len(self.card_positions['STOCK'].cards) > 0:
                    top_stock = self.card_positions['STOCK'].cards[-1]
                    top_stock.move_to(self.card_positions['QUEUE'], prepend=True)
                    cards_to_update.append(top_stock)
                else:
                    self.game.game_over = True

            card.move_to(to_pos)
            # If it's card #10, remove from the board
            if card.number == 10:
                for c in card.pos.cards[:]:
                    c.move_to(self.game.card_positions['CLEARED'])
            self.played_cards += 1
        self.game.thread_lock.release()
        self.game.get_full_update(cards=cards_to_update)
        return to_pos

    def get_score(self):
        return self.played_cards - 2 * len(self.card_positions['STOCK'].cards)

    def deal_deck(self):
        # Reset deck when all cards are gone
        deck_cards = self.card_positions['DECK'].cards
        dump_cards = self.card_positions['DUMP'].cards
        cards_to_update = deck_cards + dump_cards
        if len(deck_cards) == 0:
            for i in range(len(dump_cards)-1, -1, -1):
                dump_cards[i].move_to(self.card_positions['DECK'])
        else:
            for i in range(3):
                if len(deck_cards) == 0:
                    break
                deck_cards[-1].move_to(self.card_positions['DUMP'])
        self.game.get_full_update(cards=cards_to_update)



class BlitzCard:

    def __init__(self,game,id,color,number,pos,owner):
        self.id = id
        self.color = color
        self.number = number
        self.pos = pos
        self.game = game
        game.all_cards.append(self)
        self.revealed = False
        self.owner = owner


    def __repr__(self):
        return "Card {}{} (id:{})".format(self.color,self.number,self.id,self.owner,self.pos)

    def get_info(self):
        d = {
            'pos':str(self.pos.name),
            'id':str(self.id),
            'revealed':str(self.revealed),
            'card_index': self.pos.cards.index(self),
            'is_top': str(self.pos.cards[-1] == self),
            }
        if self.revealed:
            d['number'] = str(self.number)
            d['color'] = str(self.color)
        return d

    def move_to(self, new_pos, prepend=False):
        print("Moving card {} to {}".format(self, new_pos))
        # Remove card from old position, add to new position and set the variable
        if (self.pos):
            self.pos.cards.remove(self)
        if not prepend:
            new_pos.cards.append(self)
        else:
            new_pos.cards.insert(0,self)
        self.pos = new_pos
        if 'PLAY' in new_pos.name or 'QUEUE' in  new_pos.name or 'DUMP' in new_pos.name:
            self.reveal()
        else:
            self.reveal(value=False)

    def reveal(self, value=True):
        self.revealed = value

class CardPosition:

    def __init__(self, game, name, cards):
        self.name = name # Should be consistent with HTML names
        self.game = game
        game.card_positions[name] = self
        # Add the cards individually to accomplish side effects of each position
        self.cards = []
        for c in cards:
            c.move_to(self)

    def __repr__(self):
        return self.name

class BlitzGame:

    def __init__(self,player_num,gameid, AI_num=0, stock_size=9, queue_size=None):
        self.AI_num = int(AI_num)
        self.player_count = player_num
        self.stock_size = stock_size
        self.queue_size = queue_size
        if not self.queue_size:
            if self.player_count < 3:
                self.queue_size = 5
            else:
                self.queue_size = 4
        self.players = []
        self.all_cards = []
        self.gameid = gameid
        self.recent_messages = ["" for i in range(player_num)]
        self.game_over = False
        self.colors = ['red','green','blue','yellow']
        self.numbers = list(range(1,11))
        self.card_positions = {}
        self.thread_lock = threading.Lock()
        self.thread_lock.acquire()

        # Create the table positions
        self.play_piles = [CardPosition(self,"PLAY{}".format(i),[]) for i in range(4*self.player_count)]
        self.cleared_pile = CardPosition(self,"CLEARED",[])
        # Player card positions are kept track of in the player class, but are
        # also placed in the BlitzGame card_positions
        for pi in range(self.player_count):
            p = BlitzPlayer(pi,self)
            if pi >= self.player_count - self.AI_num:
                ai = BlitzAI('AI{}'.format(pi),p,1.5, 0)
                ai.start()
        self.thread_lock.release()

    def get_blitz_player(self, session_user):
        player_list = [p for p in self.players if p.session_user == session_user]
        if len(player_list) == 0:
            print('No player associated with this session_user: {}'.format(session_user))
            return None
        else:
            return player_list[0]

    def new_recent_message(self, message, player_index):
        print("Adding message: "+str(message))
        self.recent_messages[player_index] = message

    def submit_score(self, player):
        #TODO
        print("Passing on submit_score")

    def get_full_update(self, cards=None):
        cards = cards or self.all_cards
        self.thread_lock.acquire()
        #Most of the info needed in the cards
        card_info = [c.get_info() for c in cards]
        card_info.sort(key=lambda c: c['card_index'])
        card_info.sort(key=lambda c: "DECK" not in c['pos'])
        card_info.sort(key=lambda c: "STOCK" not in c['pos'])
        card_info.sort(key=lambda c: "PLAY" in c['pos']) #First, we want PLAY cards last
        player_names = [p.session_user.fullname for p in self.players if p.session_user]
        scores = [p.get_score() for p in self.players]
        all_data = {
            "cards":card_info,
            "recent_messages":self.recent_messages,
            "players":player_names,
            "score":scores,
            "game_over":int(self.game_over),
            }
        with app.test_request_context('/'):
            socketio.emit('UPDATE INFO', all_data, broadcast=True, room=self.gameid, namespace='/blitz')
        self.thread_lock.release()
        return all_data

    def card_from_id(self, card_id):
        for card in self.all_cards:
            if card.id == card_id:
                return card
        return None

class BlitzDeck:

    def shuffle_cards(cards):
        #In place shuffle
        shuffle(cards)

    def get_fresh_player_deck(player):
        deck = []
        for color in player.game.colors:
            for num in player.game.numbers:
                # We won't really set ids until after the shuffle
                # We won't set positions, trusting they will be divied out elsewhere
                deck.append(BlitzCard(player.game,None,color,num,None,player))
        BlitzDeck.shuffle_cards(deck)
        i=1
        while not BlitzDeck.isvalid(deck,player):
            print("Reshuffling #{}".format(i))
            i+=1
            BlitzDeck.shuffle_cards(deck)
        # Ids are telling now. Go through and change
        for i,c in enumerate(deck):
            c.id = "CARD{}_{}".format(player.player_index, i)
        return deck

    def isvalid(deck,player):
        ss = player.game.stock_size
        qs = player.game.queue_size
        return (not 1 in [c.number for c in deck[:ss]]) and (sum([c.number for c in deck[ss:ss+qs]]) < 20)
