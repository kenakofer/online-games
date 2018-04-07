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
    };
    function TablePosition(id, coord_position){
	var self = this;
	self.id = ko.observable(id);
	self.position = ko.observable(coord_position);
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

        self.x_spacing = parseInt($(".drop_pile").css("width"), 10) + 15;
        self.y_spacing = parseInt($(".drop_pile").css("height"), 10) + 25;
        self.border_left = 30;
        self.border_top  = 80;
	var pos_to_push = []
	// Start with the player hands, at x=border_left,y=border_top
	y=self.border_top;
	for (p in _.range(self.player_count)){
	    x=self.border_left;
	    for (c in _.range(self.hand_size)){
		pos_to_push.push(new TablePosition('P'+p+'C'+c, {left:x,top:y}));
		x += self.x_spacing;
	    }
	    y += self.y_spacing;
	}
	x=self.border_left
	y+=20;
	// Add each build pile
	self.letters.forEach(function(l){ pos_to_push.push(new TablePosition('PILE'+l,{left:x,top:y})); x+=self.x_spacing; });
	// Add the trash pile
	// TODO trash piles
	y+=self.y_spacing+20; x=self.border_left;
	pos_to_push.push(new TablePosition('TRASH',{left:x,top:y}));
	x+=self.x_spacing*2;
	pos_to_push.push(new TablePosition('PLAY',{left:x,top:y}));
	x+=self.x_spacing*2;
	pos_to_push.push(new TablePosition('DECK',{left:x,top:y}));

	ko.utils.arrayPushAll(self.table_positions, pos_to_push);

        ko.utils.arrayPushAll(self.labels, [
            label_clues   = new Label('LABEL_CLUES'  ,{left:self.border_left+3*self.x_spacing, top:y},    "Clues left: 8"),
            label_strikes = new Label('LABEL_STRIKES',{left:self.border_left+3*self.x_spacing, top:y+20}, "Strikes left: 3"),
        ]);

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
    var card_z_pos = 2;
    move_card = function(apm_card, server=false) {
	draggable = $("#"+apm_card.card_id());
	posid = "#"+apm_card.card_position();
	console.log('Moving card '+apm_card.card_id()+' to posid '+posid);
	position = $("#"+apm_card.card_position()).position();
        draggable.css({"z-index": card_z_pos});
        card_z_pos += 2;
	draggable.animate(
		{left:position.left+6, top:position.top+20},
		{duration:500}
		);
        // If the server puts the card in DECK, TRASH, a play pile, or
        // another players hand, destroy the draggability.
        // Equivalently, if the server does NOT place the card in
        // the current players hand, destroy draggability.
        // Otherwise, enable it.
        if (! apm_card.card_position().includes("P"+template_player_index+"C")){
            console.log("destroying draggability on card "+apm_card.card_id());
            try {
                draggable.draggable('destroy');
            } catch (err) {}
        } else {
            console.log("enabling draggability on card "+apm_card.card_id());
            draggable.draggable({revert: "invalid", stack:".draggable" });
        }
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

        // On turn change, move the indicator
        if (data.player_turn != apm.player_turn()){
            turn = data.player_turn
            apm.player_turn(turn);
            active_player_indicator = $(".active-player-indicator");
            active_player_indicator.draggable()
            active_player_indicator.animate(
                    {top: turn * apm.y_spacing + apm.border_top-3},
                    {duration:500}
                );

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
            if (card.card_pos != undefined && apm_card.card_position() != card.card_pos){
                apm_card.card_position(card.card_pos || "");
                move_card(apm_card, server=true);
            }
	});
    });

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
