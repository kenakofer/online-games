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
    };
    function TablePosition(id, coord_position){
	var self = this;
	self.id = ko.observable(id);
	self.position = ko.observable(coord_position)
    }
    function AppViewModel() {
	var self = this;
	self.cards = ko.observableArray([]);
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
	var pos_to_push = []
	// Start with the player hands
	y=80;
	for (p in _.range(self.player_count)){
	    x=30;
	    for (c in _.range(self.hand_size)){
		pos_to_push.push(new TablePosition('P'+p+'C'+c, {left:x,top:y}));
		x += 170;
	    }
	    y += 190;
	}
	x=30
	y+=20;
	// Add each build pile
	self.letters.forEach(function(l){ pos_to_push.push(new TablePosition('PILE'+l,{left:x,top:y})); x+=170; });
	// Add the trash pile
	// TODO trash piles
	y+=210; x=30;
	pos_to_push.push(new TablePosition('TRASH',{left:x,top:y}));
	x+=170;
	pos_to_push.push(new TablePosition('DECK',{left:x,top:y}));
	x+=170;
	pos_to_push.push(new TablePosition('PLAY',{left:x,top:y}));

	ko.utils.arrayPushAll(self.table_positions, pos_to_push);

    }
    apm = new AppViewModel()
    // Activates knockout.js
    ko.applyBindings(apm);


    // Knockout helper functions
    get_apm_card = function(cid) {
	cards = apm.cards().filter(function(apm_c){return apm_c.card_id() == cid});
	if (cards) {
	    return cards[0]
	} else {
	    console.log("No such card: "+cid);
	}
    };
    move_card = function(apm_card, server=false) {
	draggable = $("#"+apm_card.card_id());
	posid = "#"+apm_card.card_position();
	console.log('Moving card '+apm_card.card_id()+' to posid '+posid);
	position = $("#"+apm_card.card_position()).position();
	draggable.animate(
		{left:position.left+6, top:position.top+20},
		{duration:500}
		);
        if (server){
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

        }
    };
    apm_add_card = function(data){
	cid = data.card_id || "";
	pos = data.card_pos || "";
	letter = data.card_letter || "";
	number = data.card_number || "";
	console.log('New card with '+cid+pos+letter+number);
	apm_card = new Card(cid,pos,letter,number);
	apm.cards.push(apm_card);
	move_card(apm_card, server=true);
	draggable = $("#"+apm_card.card_id());
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
        console.log(data);
	data.cards.forEach(function(card) {
	    apm_card = get_apm_card(card.card_id);
	    if (!apm_card){
		//Create the card
		apm_add_card(card);
	    } else {
		//TODO does this cause knockout updates if values don't change?
		apm_card.card_letter(card.card_letter || "");
		apm_card.card_number(card.card_number || "");
                if (card.card_pos != undefined && apm_card.card_position() != card.card_pos){
                    apm_card.card_position(card.card_pos || "");
                    move_card(apm_card, server=true);
                }
	    }
	});
    });

    socket.on('CARD MOVE', function(data) {
	move_card(get_apm_card(data.card_id));
    });

    socket.on('CARD ADD', function(data){
	cid = data.card_id;
	pos = data.card_pos;
	letter = data.card_letter;
	number = data.card_number;
	apm_card = new Card(cid,pos,letter,number);
	apm.cards.push(apm_card);
	move_card(apm_card);

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
