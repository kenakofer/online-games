from random import shuffle

#The list to be filled with hanabigames
hanabi_games = {}

class HanabiGame:

    letters = 'ABCDE'
    numbers = [1,1,1,2,2,3,3,4,4,5]

    def __init__(self,player_num,gameid):
        self.player_count = player_num
        self.players = []
        self.gameid = gameid

        self.player_turn = 0
        self.hand_size = 4 if self.player_count > 2 else 5
        self.strikes_remaining = 3
        self.all_cards = HanabiDeck.get_fresh_deck(self.gameid) 
        self.draw_pile = self.all_cards[:] #Shallow copy
        self.player_hands = [[] for i in range(self.player_count)]
        for p in range(self.player_count):
            for ci in range(self.hand_size):
                self.draw_card(None, pi=p) 
        self.play_piles = [HanabiPile(l) for l in HanabiGame.letters]
        
    def draw_card(self, player, pi=None):
        if pi==None:
            pi = player.tmp[self.gameid]['player_index']
        if len(self.player_hands[pi]) >= self.hand_size:
            print('{} can\'t draw a card when their hand is full!'.format(player))
            return None
        if len(self.draw_pile) == 0:
            print('{} can\'t draw a card when the draw pile is empty!'.format(player))
            return None
        # It is legal to draw a card. Take it from the deck, change its pos,
        # put it in the hand list of the player
        card = self.draw_pile.pop()
        card.card_pos = 'P'+str(pi)+'C'+str(len(self.player_hands[pi]))
        self.player_hands[pi].append(card)
        print("Drawing card from deck:",card)
        return card

    def play_card(self, player, card):
        i = player.tmp[self.gameid]['player_index']
        if not 'P'+str(i) in card.card_pos:
            print('Player {} can not play card {}: not in hand'.format(player, card))
            return None
        # Get the corresponding pile
        pile = [p for p in self.play_piles if p.letter == card.card_letter]
        if pile.add_card(card):
            # return pile for ease of emits
            return pile
        else:
            return None

    def get_full_update(self, user):
        if not user in self.players:
            print("Full update request from nonplayer {}".format(user))
            return None
        #Most of the info needed in the cards
        card_info = [c.get_info(user) for c in self.all_cards]
        print("Giving full update to {}: {}".format(user,card_info))
        return card_info

class HanabiCard:

    def __init__(self,gameid,id,letter,number,pos):
        self.card_id = id
        self.card_letter = letter
        self.card_number = number
        self.card_pos = pos
        self.gameid = gameid

    def __repr__(self):
        return "Card {}{} (id:{}) in {}".format(self.card_letter,self.card_number,self.card_id,self.card_pos)

    def in_player_hand(self, player):
        # TODO regex?
        cp = self.card_pos
        if cp[0] != 'P':
            return False
        if not 'C' in cp:
            return False
        i = int(cp[1:cp.index('C')])
        return i == player.tmp[self.gameid]['player_index']

    def get_info(self, player):
        #Give nothing other than card_pos and card_id if in deck or in pi's hand
        d = {'card_pos':str(self.card_pos),'card_id':str(self.card_id)}
        if not self.in_player_hand(player) and not self.card_pos == 'DECK':
            d['card_letter'] = str(self.card_letter)
            d['card_number'] = str(self.card_number)
        return d


class HanabiDeck:

    def shuffle_cards(cards):
        #In place shuffle
        shuffle(cards)

    def get_fresh_deck(gameid):
        deck = []
        for letter in HanabiGame.letters:
            for num in HanabiGame.numbers:
                # We won't really set ids until after the shuffle
                deck.append(HanabiCard(gameid,None,letter,num,'DECK'))
        HanabiDeck.shuffle_cards(deck)
        # Ids are telling now. Go through and change
        for i,c in enumerate(deck):
            c.card_id = "CARD"+str(i)
        return deck

class HanabiPile:

    def __init__(self, letter):
        assert letter in HanabiGame.letters
        self.letter = letter
        self.cards = []
        self.next_number = 1
        self.id = 'PILE'+letter

    def add_card(self, card):
        if card.card_letter != self.letter:
            print('Can\'t place card with letter {} on pile with letter {}!'.format(card.card_letter, self.letter))
            return None
        if card.card_number != self.next_number:
            print('Can\'t place card with  {} on pile expecting a {}!'.format(card.card_number, self.number))
            return None
        card.pos = self.id
        self.cards.append(card)
        return card
