// Any varibles preceded by "template_" are inserted into the html's inline js

$( document ).ready(function() {

    shuffle = function(array) {
        var currentIndex = array.length, tmp, randomIndex;
        // While there remain elements to shuffle...
        while (0 !== currentIndex) {
            // Pick a remaining element
            randomIndex = Math.floor(Math.random() * currentIndex)
            currentIndex -= 1;
            // And swap it with the currentIndex
            tmp = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = tmp;
        }
        return array;
    }

    // Knockout.js: This is a simple *viewmodel* - JavaScript that defines the
    // data and behavior of your UI
    function Card(id, pos, color, number){
	var self = this;
	self.id = ko.observable(id);
	self.pos = ko.observable(pos);
        self.pos().cards.push(self);
	self.color = ko.observable(color);
	self.number = ko.observable(number);
        self.move_confirmed_by_server = false;
        self.card_index = -1; //If there are multiple cards in a position, this is the index of this card
        self.is_top = false;
    };
    function TablePosition(id, coord_position, text=undefined, stack_position_offset={top:0,left:0}, draggable, clickable, droppable){
	var self = this;
	self.id = ko.observable(id);
	self.pos = ko.observable(coord_position);
        self.text = ko.observable(text || id);
        self.clickable = clickable;
        self.draggable = draggable;
        self.droppable = droppable;
        self.stack_position_offset = stack_position_offset;
        self.cards = ko.observableArray([]);
    };
    function Label(id, coord_position, text){
	var self = this;
	self.id = ko.observable(id);
	self.pos = ko.observable(coord_position);
        self.text = ko.observable(text)
    };

    function AppViewModel() {
	var self = this;
	self.cards = ko.observableArray([]);
	self.labels = ko.observableArray([]);
        self.player_turn = ko.observable(0);
	// No need for these to be observable
	self.my_player_index = template_player_index;
	self.player_count = template_player_count;
	self.queue_size = template_queue_size;
	self.colors = ['red','green','blue','yellow'];
        self.game_over = false;
	// Create the array of table positions to be added all at once to knockout
	self.table_positions = ko.observableArray([]);
        self.x_spacing = parseInt($(".drop_pile").css("width"), 10) + 10;
        self.y_spacing = parseInt($(".drop_pile").css("height"), 10) + 15;
        ys = parseInt($(".drop_pile").css("height"), 10) + 6
        xs = parseInt($(".drop_pile").css("width"), 10) + 6
        self.border_left = 30;
        self.border_top  = 80;
        self.player_piles_width = (self.queue_size + 2) * self.x_spacing + 20
        y = self.border_top;
        x = self.border_left;
        // Create all the TablePositions at specific locations
        tight_stack={top:.5,left:.5}
        loose_stack={top:1,left:1}
        cleared_stack={top:0,left:22}
        if (self.player_count > 4) {
            for (pi in _.range(self.player_count)){
                pi1 = 1+parseInt(pi,10);
                self.table_positions.push(new TablePosition('P'+pi+'_STOCK', {left:x,top:y}," ",loose_stack));
                self.table_positions.push(new TablePosition('P'+pi+'_QUEUE', {left:x,top:y},"Waiting for player "+pi1+" to connect...",stack_position_offset={top:0,left:self.x_spacing}, true,false,false ));
                x += self.queue_size * self.x_spacing;
                clickable = (pi == template_player_index)
                self.table_positions.push(new TablePosition('P'+pi+'_DECK', {left:x,top:y},"DECK", tight_stack, false,clickable,false));
                x += self.x_spacing;
                self.table_positions.push(new TablePosition('P'+pi+'_DUMP', {left:x,top:y},"DUMP", tight_stack, "top",false,false));
                x += 20;
                x = self.border_left;
                y += self.y_spacing;
            }
            self.table_positions.push(new TablePosition("CLEARED", {left:x,top:y}, "CLEARED",cleared_stack));

            y = self.border_top;
            shuffled = shuffle(_.range(4*self.player_count))
            for (r in _.range(self.player_count)){
                x = self.border_left + self.player_piles_width;
                for (c in _.range(4)){
                    i = parseInt(r) * 4 + parseInt(c);
                    tp = new TablePosition('PLAY'+shuffled[i], {left:x,top:y}, " ", loose_stack, false,false,true);
                    self.table_positions.push(tp);
                    $( "#PLAY"+i ).addClass('.play_pile');
                    x += xs;
                }
                y += ys;;
            }
        }
        else{ //4 or fewer players
            for (pi in _.range(self.player_count)){
                if (pi%2 == 0) y=self.border_top;
                else y= self.border_top + self.y_spacing + 2*ys + 25;
                if (Math.floor(pi/2) == 0) x=self.border_left;
                else x=self.border_left + self.player_piles_width;

                pi1 = 1+parseInt(pi,10);
                self.table_positions.push(new TablePosition('P'+pi+'_STOCK', {left:x,top:y}," ",loose_stack));
                self.table_positions.push(new TablePosition('P'+pi+'_QUEUE', {left:x,top:y},"Waiting for player "+pi1+" to connect...",stack_position_offset={top:0,left:self.x_spacing}, true,false,false ));
                x += self.queue_size * self.x_spacing;
                clickable = (pi == template_player_index);
                self.table_positions.push(new TablePosition('P'+pi+'_DECK', {left:x,top:y},"DECK", tight_stack, false,clickable,false));
                x += self.x_spacing;
                self.table_positions.push(new TablePosition('P'+pi+'_DUMP', {left:x,top:y},"DUMP", tight_stack, "top",false,false));
            }
            x = self.border_left + 2*xs;
            shuffled = shuffle(_.range(4*self.player_count))
            for (i in _.range(4*self.player_count)){
                x = self.border_left + 2.3*xs + Math.floor(i/2)*xs;
                y = self.border_top + self.y_spacing + 10 + (i%2)*ys;
                tp = new TablePosition('PLAY'+shuffled[i], {left:x,top:y}, " ", loose_stack, false,false,true);
                self.table_positions.push(tp);
                $( "#PLAY"+i ).addClass('.play_pile');
            }
            y= self.border_top + 2*self.y_spacing + 2*ys + 30;
            x=self.border_left
            self.table_positions.push(new TablePosition("CLEARED", {left:x,top:y}, "CLEARED",cleared_stack));

        }
        // Labels
        y = self.border_top-25;
        x = self.border_left;
        ko.utils.arrayPushAll(self.labels, [
            self.label_game_over = new Label('LABEL_GAME_OVER',{left:x+130, top:y}, ""),
        ]);
    }

    apm = new AppViewModel()
    // Activates knockout.js
    ko.applyBindings(apm);

    // Knockout helper functions
    get_apm_card = function(cid) {
	cards = apm.cards().filter(function(apm_c){return apm_c.id() == cid});
	if (cards) {
	    return cards[0]
	} else {
	    console.log("No such card: "+cid);
	}
    };
    // Knockout helper functions
    get_apm_position = function(pid) {
	poss = apm.table_positions().filter(function(apm_p){return apm_p.id() == pid});
	if (poss.length > 0) {
	    return poss[0]
	} else {
	    console.log("No such position: "+pid);
	}
    };
    click_function = function (event) {
        // Make sure this doesn't happen too fast (for the client's sake.)
        t = new Date().getTime();
        if (t - last_deal < 50)
            return
        last_deal = t;
        // Tell the server to deal out more cards from the deck
        socket.emit('DEAL DECK', {gameid:template_gameid});
        //console.log('emitting DEAL DECK');
    }
    var card_z_pos = 100;
    var last_deal = -1;
    move_card = function(apm_card, apm_pos, card_index=0, server=false, is_top=false) {
        // Remove from the cards old position
        if (apm_card.pos()){
            apm_card.pos().cards.remove(apm_card);
        }
        // Change the card's position
        apm_card.pos(apm_pos);
        // Add to the card's new position
        apm_pos.cards.push(apm_card);
        // Set the correct index (fed to us from the server)
        apm_card.card_index = card_index;
        // Set the topness of the card
        apm_card.is_top = is_top

        apm_card.move_confirmed_by_server = server;
	draggable = $("#"+apm_card.id());
	posid = "#"+apm_pos.id();
	//console.log('Moving card '+apm_card.id()+' to posid '+posid);
	coord_pos = $(posid).position();
        draggable.css({"z-index": card_z_pos});
        card_z_pos += 2;
        // Actually move the card
        //console.log('Card has index '+apm_card.card_index);
        left_offset = apm_pos.stack_position_offset.left * (apm_card.card_index);
        top_offset = apm_pos.stack_position_offset.top * (apm_card.card_index);
        if (posid.includes("QUEUE") && apm_card.card_index == 0){
            //Move this card so it appears to be on top of the STOCK
            si = apm_pos.id().indexOf("_");
            stock = get_apm_position( apm_pos.id().substring(0,si)+"_STOCK" );
            i = stock.cards().length;
            left_offset = stock.stack_position_offset.left * i;
            top_offset = stock.stack_position_offset.top * i;
        }
	draggable.animate(
		{left:coord_pos.left+left_offset+7, top:coord_pos.top+top_offset+25},
		{duration:500}
		);
        // Draggability
        if (apm_card.id().includes('CARD'+template_player_index+'_') && (apm_pos.draggable == true || (apm_pos.draggable == "top" && is_top))){
                //console.log("enabling draggability on card "+apm_card.id());
                draggable.draggable({revert: "invalid", start: function (event, ui) {
                    $( this ).css({"z-index": card_z_pos});
                    card_z_pos += 2;
                }});
                draggable.addClass('draggable');
        } else {
            //console.log("destroying draggability on card "+apm_card.id());
            try {
                draggable.removeClass('my-card');
                draggable.removeClass('draggable');
                draggable.draggable('destroy');
            } catch (err) {}
        }
        // Clickability
        if (apm_pos.clickable){
            //console.log("enabling clickability on card "+apm_card.id());
            draggable.click(click_function);
            draggable.addClass('draggable');
        } else {
            //console.log("destroying clickability on card "+apm_card.id());
            draggable.off('click');
        }
    };

    apm_add_card = function(data){
	cid = data.id || "";
	pos = get_apm_position(data.pos);
	color = data.color || "unknown";
	number = data.number || "";
        card_index = data.card_index || 0;
        is_top = data.is_top;
	//console.log('New card '+cid+' at '+data.pos);
	apm_card = new Card(cid,pos,color,number);
	apm.cards.push(apm_card);
        si = apm_card.id().indexOf("_");
        myclass = apm_card.id().substring(0,si);
        $( "#"+apm_card.id() ).addClass(myclass);
        if (myclass.substring(4,6) == template_player_index){
            $( "#"+apm_card.id() ).addClass('mycard');
        }
        move_card(apm_card, pos, card_index=card_index, server=true, is_top);
    };

    // Socketio functions
    request_update = function(){
	socket.emit('UPDATE REQUEST', {gameid:template_gameid});
    };
    // For socket events
    socket.on('connect', function() {
        socket.emit('JOIN ROOM', {room:template_gameid});
	request_update();
    });
    socket.on('SHOULD REQUEST UPDATE', function(data){
       request_update();
    });
    socket.on('UPDATE INFO', function(data) {
	console.log('UPDATE INFO gave data: ');
        //Update labels
        //console.log(data);
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
            $( "#P"+i+"_QUEUE" ).text(
                data.players[i]+",  Round Score "+data.score[i]
            );
            $( "#P"+i+"_QUEUE" ).removeClass('unjoined');
            // Update deck count
            cards_left = data.cards.filter( c => c.pos=="DECK" ).length;
            $( "#p"+i+"DECK" ).text("DECK: "+cards_left);
        }

        //Card changes
	data.cards.forEach(function(card) {
            card.is_top = card.is_top == "True";
	    apm_card = get_apm_card(card.id);
            apm_pos  = get_apm_position(card.pos);
	    if (!apm_card){
		//Create the card
		apm_add_card(card);
            }
            //TODO does this cause knockout updates if values don't change?
            // Update info on card
            apm_card.color(card.color || "unknown");
            apm_card.number(card.number || "");
            // Update card pos
            //console.log((! apm_card.move_confirmed_by_server));
            //console.log(apm_card.pos() != apm_pos);
            //console.log(apm_card.card_index != card.card_index);
            if ((! apm_card.move_confirmed_by_server) || apm_card.pos() != apm_pos || apm_card.card_index != card.card_index || apm_card.is_top != card.is_top){
                if (! apm_pos){
                    console.log("No apm pos?");
                    console.log(apm_pos);
                }
                move_card(apm_card, apm_pos, card.card_index, server=true, card.is_top);
            }
	});

        apm.game_over = data.game_over == 1
        if (apm.game_over){
            try {
                $( ".draggable" ).removeClass('draggable');
                $( ".draggable" ).draggable('destroy');
            } catch (err) {}
            apm.label_game_over.text("GAME OVER");
        }
    });

    for (p in _.range(apm.player_count)){
        $( '#P'+p+'_QUEUE' ).css({'width':apm.x_spacing*apm.queue_size-13,'z-index':1});
        $( '#P'+p+'_QUEUE' ).addClass('unjoined');
    }
    $( '#P'+template_player_index+'_DECK' ).click(click_function);
    for (i in apm.table_positions()){
        apm_tp = apm.table_positions()[i];
        elem = $( "#"+apm_tp.id() );
        if (apm_tp.droppable){
            //console.log("Adding class droppable to #"+apm_tp.id());
            elem.addClass("droppable");
        }
    }

    for (r in _.range(apm.player_count)){
        for (c in _.range(4)){
            i = parseInt(r) * 4 + parseInt(c);
            $( "#PLAY"+i ).addClass('play_pile');
        }
    }

    $( ".droppable" ).droppable({
      classes: {
	"ui-droppable-active": "ui-state-active",
	"ui-droppable-hover": "ui-state-hover",
      },
	drop: function( event, ui ) {
	    card_id = ui.draggable.context.id;
	    apm_card = get_apm_card(card_id);
	    place_id = event.target.id;
            pos = get_apm_position(place_id);
	    message = "I dropped "+card_id+" in place "+place_id;
	    //console.log(message);
            data = {card_id: card_id, card_pos: place_id, gameid: template_gameid}
            //console.log(data)
	    socket.emit("CARD MOVE", data);
	    move_card(apm_card,pos);
	}
    });
});
