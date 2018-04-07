from random import shuffle

#The list to be filled with hanabigames
hanabi_games = {}

class HanabiGame:

    letters = 'ABCDE'
    numbers = [1,1,1,2,2,3,3,4,4,5]
    total_strikes = 3
    total_clues = 8

    def __init__(self,player_num,gameid):
        self.player_count = player_num
        self.players = []
        self.player_index = {}
        self.gameid = gameid
        self.recent_messages = []

        self.player_turn = 0
        self.hand_size = 4 if self.player_count > 2 else 5
        self.strikes_remaining = HanabiGame.total_strikes
        self.clues = HanabiGame.total_clues
        # Create the cards
        self.all_cards = HanabiDeck.get_fresh_deck(self)
        # Create the trash position
        self.card_positions = {'TRASH':[]}
        # Create the deck position, containing all cards at the moment
        self.card_positions['DECK'] = self.all_cards[:] #Shallow copy
        for pi in range(self.player_count):
            # Create hand position for each user
            pi = str(pi)
            self.card_positions[pi] = []
            for ci in range(self.hand_size):
                self.draw_card(None, pi=pi) # Auto adds card to specified hand position
        # Create the play pile positions
        for l in HanabiGame.letters:
            self.card_positions[l] = []

    def new_recent_message(self,message):
        print("Adding message: "+str(message))
        self.recent_messages.append(message)


    def draw_card(self, player, pi=None):
        if pi==None:
            pi = self.player_index[player]
        pi = str(pi)
        if len(self.card_positions[pi]) >= self.hand_size:
            print('{} can\'t draw a card when their hand is full!'.format(player))
            return None
        if len(self.card_positions['DECK']) == 0:
            print('{} can\'t draw a card when the draw pile is empty!'.format(player))
            return None
        # It is legal to draw a card. Take it from the deck, change its pos,
        # put it in the hand list of the player
        card = self.card_positions['DECK'][-1]
        card.change_pos(pi)
        print("Drawing card from deck:",card)
        return card

    def play_card(self, player, card):
        i = self.player_index[player]
        if not str(i) == card.card_pos:
            print('Player {}, index {} can not play card {}: it is in hand {}'.format(player, i, card, card.card_pos))
            return None
        if not self.player_turn == i:
            print('Player {}, index {} can not play card {}: it is turn of player {}'.format(player, i, card, self.player_turn))
            return None
        # Before we return, make sure we pass along to the next player
        self.next_turn();
        # Reveal the card to all
        card.reveal()
        # Get the corresponding pile
        pile = self.card_positions[card.card_letter]
        # Check if the number is next
        if len(pile)+1 == card.card_number:
            # return pile for ease of emits
            card.change_pos(card.card_letter)
            self.draw_card(player)
            self.new_recent_message("Player {}, index {} successfully played card {}".format(player, i, card))
            return pile
        else:
            card.change_pos('TRASH') # We don't call trash_card because that gives clues back
            self.lose_strike()
            self.draw_card(player)
            self.new_recent_message("Player {}, index {} tried to play card {}, but it doesn't have a pile".format(player, i, card))
            return None

    def give_clue(self, player, card, info):
        i = self.player_index[player]
        if str(i) == card.card_pos:
            print('Player {}, index {} can not clue to card {}: it is in their hand!'.format(player, i, card, card.card_pos))
            return None
        if not card.card_pos.isdigit():
            print('Player {}, index {} can not clue to card {}: it is not in a player\'s hand!'.format(player, i, card))
            return None
        if not self.player_turn == i:
            print('Player {}, index {} can not clue to card {}: it is turn of player {}'.format(player, i, card, self.player_turn))
            return None
        if self.clues <= 0:
            print('Player {}, index {} can not clue: no clues left'.format(player, i))
            return None
        if not info in ['letter','number']:
            print('Player {}, index {} can not clue nonexistant info type {}'.format(player, i, info))
        # So it's a legal request
        self.clues -= 1
        self.next_turn()
        if info == 'letter':
            for c in self.card_positions[card.card_pos]:
                if card.card_letter == c.card_letter:
                    c.reveal(which=info)
                    c.could_be['letter']=[]
                else:
                    if card.card_letter in c.could_be['letter']: c.could_be['letter'].remove(card.card_letter)
        elif info == 'number':
            for c in self.card_positions[card.card_pos]:
                if card.card_number == c.card_number:
                    c.reveal(which=info)
                    c.could_be['number']=[]
                else:
                    if card.card_number in c.could_be['number']: c.could_be['number'].remove(card.card_number)
        return card


    def next_turn(self):
        self.player_turn = (self.player_turn+1) % self.player_count

    def trash_card(self, player, card):
        i = self.player_index[player]
        if not str(i) == card.card_pos:
            print('Player {} can not trash card {}: not in hand'.format(player, card))
            return None
        if not self.player_turn == i:
            print('Player {}, index {} can not trash card {}: it is turn of player {}'.format(player, i, card, self.player_turn))
            return None
        # Get the corresponding pile
        card.change_pos('TRASH')
        card.reveal()
        self.gain_clue()
        self.draw_card(player)
        self.new_recent_message("Player {}, index {} trashed card {}".format(player, i, card))
        self.next_turn()
        return None

    def lose_strike(self):
        self.strikes_remaining -= 1
        #TODO losing etc

    def gain_clue(self):
        self.clues = min(self.clues+1,HanabiGame.total_clues)

    def get_full_update(self, user):
        if not user in self.players:
            print("Full update request from nonplayer {}".format(user))
            return None
        #Most of the info needed in the cards
        card_info = [c.get_info(user) for c in self.all_cards]
        print("Giving full update to {}".format(user))
        all_data = {
            "cards":card_info,
            "player_turn":self.player_turn,
            "clues":self.clues,
            "strikes_remaining":self.strikes_remaining,
            "recent_messages":self.recent_messages,
            }
        return all_data

    def card_from_id(self, card_id):
        for card in self.all_cards:
            if card.card_id == card_id:
                return card
        return None



class HanabiCard:

    def __init__(self,game,id,letter,number,pos):
        self.card_id = id
        self.card_letter = letter
        self.card_number = number
        self.card_pos = pos         # key to HanabiGame.card_positions
        self.game = game
        self.revealed = {'number':False,'letter':False}
        self.could_be = {'letter':list(HanabiGame.letters),'number':list(set(HanabiGame.numbers))}

    def __repr__(self):
        return "Card {}{} (id:{}) in {}".format(self.card_letter,self.card_number,self.card_id,self.card_pos)

    def in_player_hand(self, player):
        #print("player: {}; player_index: {}; card_pos: {}".format(player, self.game.player_index, self.card_pos))
        if player in self.game.player_index:
            return self.card_pos == str(self.game.player_index[player])
        else:
            return False

    def get_info(self, player):
        #Give nothing other than card_pos and card_id if in deck or in pi's hand
        d = {
            'card_pos':str(self.card_pos_html()),
            'card_id':str(self.card_id),
            'could_be_letters':''.join(self.could_be['letter']),
            'could_be_numbers':''.join(map(str, self.could_be['number'])),
            }
        if not self.card_pos == 'DECK' and not self.in_player_hand(player):
            d['card_letter'] = str(self.card_letter)
            d['card_number'] = str(self.card_number)
        if self.revealed['number']:
            d['card_number'] = str(self.card_number)
        if self.revealed['letter']:
            d['card_letter'] = str(self.card_letter)
        return d

    def card_pos_html(self):
        if self.card_pos in ['DECK','TRASH','PLAY']:
            return self.card_pos
        if self.card_pos.isdigit():
            pi = self.card_pos
            ci = self.game.card_positions[self.card_pos].index(self)
            return "P{}C{}".format(pi,ci)
        #Otherwise it must be a play pile
        return "PILE{}".format(self.card_pos)

    def change_pos(self, new_pos):
        poss = self.game.card_positions
        # Remove card from old position, add to new position and set the variable
        poss[self.card_pos].remove(self)
        poss[new_pos].append(self)
        self.card_pos = str(new_pos)

    def reveal(self, which=None, value=True):
        if not which:
            self.revealed['number'] = self.revealed['letter'] = value
            self.could_be['number'] = self.could_be['letter'] = []
        else:
            self.revealed[which] = value


class HanabiDeck:

    def shuffle_cards(cards):
        #In place shuffle
        shuffle(cards)

    def get_fresh_deck(game):
        deck = []
        for letter in HanabiGame.letters:
            for num in HanabiGame.numbers:
                # We won't really set ids until after the shuffle
                deck.append(HanabiCard(game,None,letter,num,'DECK'))
        HanabiDeck.shuffle_cards(deck)
        # Ids are telling now. Go through and change
        for i,c in enumerate(deck):
            c.card_id = "CARD"+str(i)
        return deck

#class HanabiPile:
#
#    def __init__(self, letter):
#        assert letter in HanabiGame.letters
#        self.letter = letter
#        self.cards = []
#        self.next_number = 1
#        self.id = 'PILE'+letter
#
#    def add_card(self, card):
#        #TODO this is a real issue to remove it from its old spot
#        if card.card_letter != self.letter:
#            print('Can\'t place card with letter {} on pile with letter {}!'.format(card.card_letter, self.letter))
#            return None
#        if card.card_number != self.next_number:
#            print('Can\'t place card with  {} on pile expecting a {}!'.format(card.card_number, self.number))
#            return None
#        card.pos = self.id
#        self.cards.append(card)
#        return card
