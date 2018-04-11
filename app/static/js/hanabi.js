// Any varibles preceded by "template_" are inserted into the html's inline js

$( document ).ready(function() {
    // Knockout.js: This is a simple *viewmodel* - JavaScript that defines the
    // data and behavior of your UI
    function Card(id, position, letter, number){
	var self = this;
	self.card_id = ko.observable(id);
	self.card_position = ko.observable(position);
	self.card_letter = ko.observable(letter);
	self.card_number = ko.observable(number);
        self.could_be_letters = ko.observable("");
        self.could_be_numbers = ko.observable("");
        self.move_confirmed_by_server = false;
    };
    function TablePosition(id, coord_position, text=undefined){
	var self = this;
	self.id = ko.observable(id);
	self.position = ko.observable(coord_position);
        self.text = ko.observable(text || id);
    };
    function Label(id, coord_position, text){
	var self = this;
	self.id = ko.observable(id);
	self.position = ko.observable(coord_position);
        self.text = ko.observable(text)
    };


    function AppViewModel() {
	var self = this;
	self.cards = ko.observableArray([]);
	self.labels = ko.observableArray([]);
        self.strikes_remaining = ko.observable(-1);
        self.clues = ko.observable(-1);
        self.player_turn = ko.observable(0);
	// No need for these to be observable
	self.my_player_index = template_player_index;
	self.player_count = template_player_count;
	self.hand_size = template_hand_size;
	self.letters = template_letters;
	// Create the array of table positions to be added all at once to knockout
	self.table_positions = ko.observableArray([]);
        self.trashed_cards = 0;

        self.x_spacing = parseInt($(".drop_pile").css("width"), 10) + 15;
        self.y_spacing = parseInt($(".drop_pile").css("height"), 10) + 25;
        self.border_left = 30;
        self.border_top  = 80;
        y = self.border_top;
        x = self.border_left;
	var pos_to_push = []
	// Start with the player hands, at x=border_left,y=border_top
	for (p in _.range(self.player_count)){
	    x=self.border_left;
	    for (c in _.range(self.hand_size)){
                tp = new TablePosition('P'+p+'C'+c, {left:x,top:y}, " ");
		self.table_positions.push(tp);
                if (c == 0){
                    console.log('Here')
                    tp.text("Waiting for player "+p+" to connect...");
                }
		x += self.x_spacing;
	    }
	    y += self.y_spacing;
	}
        // Make active player indicator the right width
        active_player_indicator = $(".active-player-indicator");
        active_player_indicator.css({'width': self.x_spacing * self.hand_size + "px"});
        // Put play piles, trash, and indicators to the right of everything
        play_area_left = self.x_spacing * self.hand_size + self.border_left + 10;
	x=play_area_left;
	y = self.border_top+25; //Leave room for labels
	// Add the trash pile
	pos_to_push.push(new TablePosition('PLAY',{left:x,top:y}));
        x += 210;
        y += 4;
	pos_to_push.push(new TablePosition('DECK',{left:x,top:y}));
	x=play_area_left;
        y+= self.y_spacing;
	pos_to_push.push(new TablePosition('TRASH',{left:x,top:y}));
	ko.utils.arrayPushAll(self.table_positions, pos_to_push);
        // Labels
        y = self.border_top;
        x = play_area_left
        ko.utils.arrayPushAll(self.labels, [
            label_clues   = new Label('LABEL_CLUES'  ,{left:x, top:y},    "Clues left: 8"),
            label_strikes = new Label('LABEL_STRIKES',{left:x+130, top:y}, "Strikes left: 3"),
        ]);
        y += 25;
    }
    apm = new AppViewModel()
    // Activates knockout.js
    ko.applyBindings(apm);

    get_clues = function(){
        return apm.clues();
    }

    // Knockout helper functions
    get_apm_card = function(cid) {
	cards = apm.cards().filter(function(apm_c){return apm_c.card_id() == cid});
	if (cards) {
	    return cards[0]
	} else {
	    console.log("No such card: "+cid);
	}
    };
    var card_z_pos = 100;
    move_card = function(apm_card, server=false) {
        apm_card.move_confirmed_by_server = server;
	draggable = $("#"+apm_card.card_id());
	posid = "#"+apm_card.card_position();
	console.log('Moving card '+apm_card.card_id()+' to posid '+posid);
	position = $(posid).position();
        draggable.css({"z-index": card_z_pos});
        card_z_pos += 2;
        // If the server puts the card in DECK, TRASH, a play pile, or
        // another players hand, destroy the draggability.
        // Equivalently, if the server does NOT place the card in
        // the current players hand, destroy draggability.
        // Otherwise, enable it.
        if (! apm_card.card_position().includes("P"+template_player_index+"C")){
            console.log("destroying draggability on card "+apm_card.card_id());
            try {
                draggable.removeClass('my-card');
                draggable.removeClass('draggable');
                draggable.draggable('destroy');
            } catch (err) {}
        } else {
            console.log("enabling draggability on card "+apm_card.card_id());
            draggable.draggable({revert: "invalid", start: function (event, ui) {
                $( this ).css({"z-index": card_z_pos});
                card_z_pos += 2;
            }});
            draggable.addClass('my-card');
            draggable.addClass('draggable');
        }
        // Make cards in deck have the right back
        if (apm_card.card_position() == 'DECK'){
            draggable.addClass('my-card');
        }
        // Shrink cards in the trash
        if (server == true && apm_card.card_position() == 'TRASH'){
            draggable.addClass("shrink-trash");
            tc = apm.trashed_cards;
            position.left += (tc%8) * 40;
            position.top += Math.floor(tc/8) * 25;
            apm.trashed_cards += 1;
        }
        // Shrink cards in the play
        if (server == true && apm_card.card_position() == 'PLAY'){
            draggable.addClass("shrink-play");
            which = apm_card.card_letter().charCodeAt(0) - 'A'.charCodeAt(0);
            num = parseInt(apm_card.card_number(),10);
            position.left += (which%3) * 65 + Math.floor(which/3)*32;
            position.top += Math.floor(which/3) * 65;
            // Tiny stack down and left
            position.left += num*2;
            position.top += num*2;
            // fix z index, important on page reload
            draggable.css({"z-index": num});
        }
        // Hide could be divs if not in a player's hand
        div = $("#"+apm_card.card_id()+" .cardbottom");
        console.log(div);
        if (posid.includes('TRASH') || posid.includes('DECK') || posid.includes('PILE')){
            div.hide()
        } else {
            div.show()
        }
	draggable.animate(
		{left:position.left+6, top:position.top+20},
		{duration:500}
		);
    };
    apm_add_card = function(data){
	cid = data.card_id || "";
	pos = data.card_pos || "";
	letter = data.card_letter || "";
	number = data.card_number || "";
	console.log('New card '+cid+' at '+pos);
	apm_card = new Card(cid,pos,letter,number);
	apm.cards.push(apm_card);
	move_card(apm_card, server=true);
	draggable = $("#"+apm_card.card_id());
        $(".cardtopleft").off("click").on("click", function(){
            card_id = $(this)[0].parentElement.id;
            socket.emit('CLUE CARD', {'card_id':card_id,'card_field':'letter','gameid':template_gameid});
        });
        $(".cardtopright").off("click").on("click", function(){
            card_id = $(this)[0].parentElement.id;
            socket.emit('CLUE CARD', {'card_id':card_id,'card_field':'number','gameid':template_gameid});
        });
    };

    // Socketio functions
    request_update = function(){
	socket.emit('UPDATE REQUEST', {gameid:template_gameid});
    };
    // For socket events
    socket.on('connect', function() {
	request_update();
        socket.emit('JOIN ROOM', {room:template_gameid});
    });
    socket.on('SHOULD REQUEST UPDATE', function(data){
       request_update();
    });
    socket.on('UPDATE INFO', function(data) {
	console.log('UPDATE INFO gave data: ');

        //Update labels
        console.log(data);
        apm.clues(data.clues);
        apm.strikes_remaining(data.strikes_remaining);
        apm.labels()[0].text("Clues left: "+apm.clues());
        apm.labels()[1].text("Strikes left: "+apm.strikes_remaining());
        // Swap out player indexes for names and pronouns
        if (data.players) for (i in data.players) for (mi in data.recent_messages){
            if (i == template_player_index)
                data.recent_messages[mi] = data.recent_messages[mi].replace('['+i+']', 'you');
            else
                data.recent_messages[mi] = data.recent_messages[mi].replace('['+i+']', data.players[i]);
        }
        //Update player list
        if (data.players) for (i in data.players) {
            m = data.recent_messages[i];
            $( "#P"+i+"C0" ).text(
                data.players[i]+": "+m
            );
        }

        // On turn change, move the indicator
        if (data.player_turn != apm.player_turn()){
            turn = data.player_turn
            apm.player_turn(turn);
            active_player_indicator = $(".active-player-indicator");
            active_player_indicator.draggable()
            active_player_indicator.animate(
                    {top: turn * apm.y_spacing + apm.border_top-6},
                    {duration:500}
                );
            if (apm.my_player_index == apm.player_turn()){
                $(".active-player-indicator").addClass('my-turn');
            } else {
                $(".active-player-indicator").removeClass('my-turn');
            }

        }
        //Card changes
	data.cards.forEach(function(card) {
	    apm_card = get_apm_card(card.card_id);
	    if (!apm_card){
		//Create the card
		apm_add_card(card);
            }
            //TODO does this cause knockout updates if values don't change?
            // Update info on card
            apm_card.card_letter(card.card_letter || "");
            apm_card.card_number(card.card_number || "");
            apm_card.could_be_letters(card.could_be_letters || "");
            apm_card.could_be_numbers(card.could_be_numbers || "");
            if (! card.could_be_letters){
                $("#"+card.card_id+" .cardtopleft").addClass("known");
            }
            if (! card.could_be_numbers){
                $("#"+card.card_id+" .cardtopright").addClass("known");
            }
            // Update card position
            if ((! apm_card.move_confirmed_by_server) || apm_card.card_position() != card.card_pos){
                apm_card.card_position(card.card_pos || "");
                move_card(apm_card, server=true);
            }
	});
    });

    for (p in _.range(apm.player_count)){
        $( '#P'+p+'C0' ).css({'width':apm.x_spacing*apm.hand_size-13,'z-index':-1});
    }
    $( "#PLAY" ).addClass("droppable");
    $( "#TRASH" ).addClass("droppable");

    $( ".droppable" ).droppable({
      classes: {
	"ui-droppable-active": "ui-state-active",
	"ui-droppable-hover": "ui-state-hover",
      },
	drop: function( event, ui ) {
	    card_id = ui.draggable.context.id;
	    apm_card = get_apm_card(card_id);
	    place_id = event.target.id;
	    message = "I dropped "+card_id+" in place "+place_id;
	    console.log(message);
            data = {card_id: card_id, place_id: place_id, gameid: template_gameid}
            console.log(data)
	    socket.emit("CARD MOVE", data);
	    //TODO should probably do some acceptance checking before these things
	    apm_card.card_position(place_id);
	    move_card(apm_card);
	}
    });
});
