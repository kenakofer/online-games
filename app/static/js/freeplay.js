/* Height of elements (z-index)
 *
 *  HIGHEST:    Action panel (invisible while I'm dragging)     z-index: 1000000000;
 *              Stuff that's dragging                                   //150000000+
 *
 *              Stuff that was just dropped in my private hand          //100000001+
 *              Stuff that was dropped earlier in my private hand
 *              ------- Floor of the private hand --------                100000000
 *
 *              Stuff that was just dropped on the main content
 *              Stuff that was dropped earlier on the main content
 *              ------- Floor of the main content --------                 
 *
 */
// Any varibles preceded by "template_" are inserted into the html's inline js
'use strict';
var draggable_settings;
var droppable_settings;
var resizable_settings; //TODO not used anymore without view blockers? But will probably be useful again for another feature
var clickable_settings;
var get_apm_obj;
var apm;
var send_message;
$( document ).ready(function() {
    'use strict';
    // For IE, which doesn't have includes
    if (!String.prototype.includes) {
      String.prototype.includes = function(search, start) {
	if (typeof start !== 'number') {
	  start = 0;
	}

	if (start + search.length > this.length) {
	  return false;
	} else {
	  return this.indexOf(search, start) !== -1;
	}
      };
    }

    // Keeps undesired operations away
    function deepFreeze(obj) {

        // Retrieve the property names defined on obj
        var propNames = Object.getOwnPropertyNames(obj);

        // Freeze properties before freezing self
        propNames.forEach(function(name) {
            var prop = obj[name];

            // Freeze prop if it is an object
            if (typeof prop == 'object' && prop !== null)
                deepFreeze(prop);
        });
        //Freeze self (no-op if already frozen)
        return Object.freeze(obj);
    }
    var entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };

    function escapeHtml (string) {
      return String(string).replace(/[&<>"'`=\/]/g, function (s) {
	return entityMap[s];
      });
    }

    function TableMovable(id, position, dimensions, dependent_ids, parent_id, display_name){
	var self = this;
        self.id = ko.observable(id);
        self.position = ko.observable(position);
        self.dimensions = ko.observable(dimensions);
        self.dependent_ids = ko.observableArray(dependent_ids);
        self.parent_id = ko.observable(get_apm_obj(parent_id));
        self.set_parent_id(parent_id);
        self.player_moving_index = ko.observable(-1);
        self.display_name = ko.observable(display_name);
        self.full_display_name = ko.computed(function() {
            var text = self.display_name();
            var l = self.dependent_ids().length;
            if (l > 0)
                text += " ("+l+")";
            return text;
        });
        self.is_face_up = ko.observable(true);
        self.depth = ko.observable(0);
        self.type = ko.observable("");
        self.privacy = ko.observable(-1); //Index of player it is privately visible, -1 for public
        self.front_image_url = ko.observable(false);
        self.front_image_style = ko.observable("100% 100%");
        self.back_image_url = ko.observable('/static/images/freeplay/red_back.png');
        self.back_image_style = ko.observable("100% 100%");
        self.dfuo = ko.observableArray();
        self.dfdo = ko.observableArray();
        self.move_confirmed_by_server = false;
        //self.offset_per_dependent = ko.observableArray([.5, .5]);
        self.offset_per_dependent = ko.computed(function() {
            if (self.dependent_ids().length === 0) {
                return;
            }
            var first_dep = get_apm_obj(self.dependent_ids()[0]);
            if (! first_dep) {
                return;
            }
            var result;
            if (first_dep.is_face_up()) {
                result = first_dep.dfuo();
            } else {
                result = first_dep.dfdo();
            }
            if (!(result instanceof Array)){
                // Result is actually a dict
                if (first_dep.privacy() === -1)
                    result = result['public'];
                else
                    result = result['private'];
            }
            return result
        }, this);
        self.position_offset = ko.computed(function() {
            if (self.type() == 'Deck'){
                return [-10, -27];
            } else if (self.type() == 'Card' && self.parent_id()){
                var i = self.get_index_in_parent();
                var p = get_apm_obj(self.parent_id());
                var opd = [.5,.5];
                if (p && p.offset_per_dependent()) {
                    opd = p.offset_per_dependent().slice();
                    opd[0] = Math.abs(opd[0] / 4) ** 2 * Math.sign(opd[0]);
                    opd[1] = Math.abs(opd[1] / 4) ** 2 * Math.sign(opd[1]);
                }
                return [i * opd[0], i * opd[1]]
            }
            // Otherwise
            return [0,0];
        }, this);
        self.dimension_offset = ko.computed(function() {
            if (self.type() == 'Deck'){
                return [25, 45];
            }
            // Otherwise
            return [0,0];
        }, this);
        self.get_index_in_parent = ko.computed(function(){
            var p = get_apm_obj(self.parent_id());
            if (! p)
                return 0
            var i = p.dependent_ids().indexOf( self.id() );
            return Math.max(0, i)
        }, this);

        // Drop time works like this:
        // Dropping a card anywhere inhibits the stop drag event, and disallows another immediate general drop event
        // Dropping a card in the private area inhibits the stop drag event as well, but allows the general drop event to fire
        self.drop_time = 0;
        self.has_synced_once = false;
    }
    TableMovable.prototype.sync_position = function(time){
        if (time === undefined) {
            time = 200;
        }
        if (time === 200 && window.test)
            snthaoeusnth;
        //console.log("Calling sync position on "+this.id()+': '+time);
        if (this.has_synced_once === false){
            this.has_synced_once = true;
            time = 0
        }
        var html_elem = $('#'+this.id());

        html_elem.css({
            "z-index": this.depth(),
        });
        var css_obj = {
            "left":this.position()[0]+this.position_offset()[0],
            "top": this.position()[1]+this.position_offset()[1],
            "min-width": this.dimensions()[0]+this.dimension_offset()[0],
            "height": this.dimensions()[1]+this.dimension_offset()[1],
        }
        if (time === 0){
            html_elem.css( css_obj );
        } else {
            html_elem.animate( css_obj,{duration:time} );
        }
    };

    TableMovable.prototype.sync_image = function(){
        var html_obj = $('#'+this.id());
        if (this.is_face_up()){
            html_obj.removeClass( 'back' )
            // If the card has an image, show it
            if (this.front_image_url()){
                html_obj.css({
                    'background-image': "url("+this.front_image_url()+")",
                    'background-size': this.front_image_style(),
                });
            }
        } else {
            html_obj.addClass( 'back' )
            if (this.back_image_url()){
                html_obj.css({
                    'background-image': "url("+this.back_image_url()+")",
                    'background-size': this.back_image_style(),
                });
            }
        }
    }
    TableMovable.prototype.change_privacy = function(privacy_index){
        //console.log('change_privacy of '+this.id()+' to '+privacy_index);
        if (privacy_index === this.privacy())
            return
        this.privacy(privacy_index);

        // If it is changing to a state visible to this user, it will need to have it's features reset
        if ( [-1, template_player_index].includes(this.privacy()) ) {
            this.sync_position(0);
            this.sync_image();
            // The changes need to reach the html before we can reference the object.
            ko.tasks.runEarly();
            var html_obj = $('#'+this.id());
            html_obj.draggable(draggable_settings);
            html_obj.click(clickable_settings);
            this.set_droppability();
        }
    };

    var private_hand_vertical_offset = function() {
        return $('.content').offset().top - $('#private-hand').offset().top + 2;
    };
    var private_hand_horizontal_offset = function() {
        return $('.content').offset().left - $('#private-hand').offset().left + 2;
    };

    var sync_action_buttons = function(should_hide){
        // If the option buttons are attached to this object, move it too.
        var html_obj = $( '#'+apm.show_action_buttons_for_id());
        var apm_obj = get_apm_obj(apm.show_action_buttons_for_id());
        var html_pos = html_obj.position();
        if (!should_hide && html_pos){
            var position_type = 'absolute';
            if (apm_obj.privacy() !== -1){
                position_type = 'fixed';
                // Since it's private, get the position relative to the screen
                html_pos = html_obj.offset();
                html_pos.top -= $(window).scrollTop();
                html_pos.left -= $(window).scrollLeft();
            }
            var opacity = '0';
            if (apm_obj.type() == "Deck")
                opacity = '1';
            $('#BUTTONSHUFFLE').css('opacity', opacity);
            $('#deal-spinner').parent().css('opacity', opacity);
            $('#deal-button').css('opacity', opacity);
            $( '#action-button-panel' ).css({
                "left":html_pos.left+4,
                "top": html_pos.top-74,
                "display": "inline",
                "position": position_type,

            });
            // Set the PCO dials to the correct values
            /*var a = apm_obj.offset_per_dependent();
            $( "#pco-x-spinner" ).spinner( 'value', Math.abs(a[0]) ** .5 * 4 * Math.sign(a[0]) );
            $( "#pco-y-spinner" ).spinner( 'value', Math.abs(a[1]) ** .5 * 4 * Math.sign(a[0]) );*/
        } else {
            $( '#action-button-panel' ).css({
                "display": "none",
            });
        }
    };

    // Careful, it places this on top of the pid stack
    TableMovable.prototype.set_parent_id = function(pid){
        if (this.parent_id() === pid)
            return;
        // Remove from old parent dependents if possible
        var obj_old_parent = get_apm_obj( this.parent_id() );
        if (obj_old_parent){
            var array = obj_old_parent.dependent_ids;
            var index = $.inArray(this.id(), array());
            if (index >= 0)
                array.splice( index, 1);
        }
        // Set new parent
        this.parent_id( pid );
        if (pid === false || pid === undefined){
            // Don't need to do anything
        } else {
            // Try to find the new parent
            var obj_parent = get_apm_obj(pid);
            // If the parent doesn't exist yet, make it
            if (! obj_parent){
                obj_parent = createBasicTableMovable(pid);
            }
            // Add this to its dependents
            if (! obj_parent.dependent_ids().includes(this.id()) )
                obj_parent.dependent_ids.push(this.id());
        }
        this.set_droppability();
    };

    /* If the object has no parent, give it droppability. Otherwise take it away.
     */
    TableMovable.prototype.set_droppability = function(){
        var html_obj = $('#'+this.id());
        if ( this.parent_id() === false || this.parent_id() === undefined ) {
            html_obj.droppable(droppable_settings);
        } else {
            try {
                html_obj.droppable("destroy");
            } catch (err) {}
        }
    }

    function AppViewModel() {
        var self = this;
        self.players = ko.observableArray([]);
        self.quick_messages = ko.observableArray(["I win!","Good game","Your turn"]);
        self.messages = ko.observableArray([]);
        self.movables = ko.observableArray([]);
        self.my_player_index = template_player_index;
        self.show_action_buttons_for_id = ko.observable(false);
        self.public_movables = ko.computed(function() {
            return ko.utils.arrayFilter(self.movables(), function(m){return m.privacy() === -1});
        });
        self.my_private_movables = ko.computed(function() {
            return ko.utils.arrayFilter(self.movables(), function(m){return m.privacy() === self.my_player_index});
        });
        self.private_card_count = function(player_index) {
            return ko.utils.arrayFilter(self.movables(), function(m){
                return m.privacy() == player_index && m.type() === 'Card'
            }).length;
        }
        self.private_hand_label_text = ko.computed(function() {
            var text = "Your private hand";
            var num_cards = self.private_card_count(template_player_index);
            if (num_cards > 0)
                text += " ("+num_cards+")";
            return text;
        });
        self.other_players_info_text = ko.computed(function() {
            var text = ""
            var no_one = true;
            for (var i in self.players()){
                if (i == template_player_index)
                    continue;
                no_one = false;
                text += ", "; // We remove the first of these after
                text += '<span class="player-color-'+i+'">';
                text += self.players()[i];
                var num_cards = self.private_card_count(i);
                text += '</span>';
                console.log(num_cards);
                if (num_cards > 0)
                    text += " ("+num_cards+")";
            }
            text = text.substring(2); // Remove first ", "
            text = "Other players: "+text;
            if (no_one)
                text = "No one else has joined your game yet. Have you given them your url?"
            return text;
        });
    }

    // Activates knockout.js
    ko.options.deferUpdates = true;
    apm = new AppViewModel()
        ko.applyBindings(apm);
    var time_of_drag_emit = 0;
    var currently_dragging = false;
    var time_of_resize_emit = 0;
    var time_of_drop_emit = 0;

    var dragging_z = 150000000;
    var get_dragging_depth = function(){
        dragging_z += 1;
        return dragging_z;
    }

    var dropped_private_z = 100000001;
    var get_dropped_private_depth = function(){
        dropped_private_z += 1;
        return dropped_private_z;
    }

    var dropped_public_z = 50000001;
    var get_dropped_public_depth = function(){
        dropped_public_z += 1;
        return dropped_public_z;
    }

    function createBasicTableMovable(id){
        var apm_obj = new TableMovable(id, [0,0], [0,0], [], false, undefined);
        // Add it to the html
        apm.movables.push(apm_obj);
        // To do things with the html object, we have to run ko notifications now
        ko.tasks.runEarly();
        // Make it draggable and droppable
        $( '#'+apm_obj.id() ).draggable(draggable_settings);
        $( '#'+apm_obj.id() ).droppable(droppable_settings);
        $( '#'+apm_obj.id() ).click(clickable_settings);
        apm_obj.set_droppability();

        return apm_obj;
    }

    clickable_settings =  function(){
        //console.log('clicked on: '+this.id);
        // If we clicked on the same one again, hide the button
        if (apm.show_action_buttons_for_id() === this.id){
            apm.show_action_buttons_for_id(false)
            sync_action_buttons()
        }
        else {
            var apm_obj = get_apm_obj(this.id);
            apm.show_action_buttons_for_id(this.id);
            sync_action_buttons();
        }
    };

    draggable_settings = {
            start: function(elem) {
                var html_elem = $('#'+elem.target.id);
                // This will prevent a click event being triggered at drop time
                socket.emit('START MOVE', {gameid:template_gameid, obj_id:elem.target.id});
                var apm_obj = get_apm_obj(elem.target.id);
                html_elem.css({'z-index':get_dragging_depth()});
                currently_dragging = apm_obj;
                // Start all of the dependents dragging as well
                apm_obj.dependent_ids().forEach(function (d_id){
                    var apm_dep = get_apm_obj(d_id);
                    if (! apm_dep)
                        return
                    apm_dep.depth(get_dragging_depth());
                    apm_dep.sync_position(0);
                    /*try {
                        $( '#'+apm_dep.id() ).droppable("destroy");
                    } catch (err) {}*/
                });
                // Remove this object from its parents
                apm_obj.set_parent_id(false);
                // Hide action buttons for duration of drag
                sync_action_buttons(true)
                // If the action buttons are on another element, switch them to this element
                var follow_id = apm.show_action_buttons_for_id();
                if (follow_id && follow_id !== apm_obj.id()){
                    apm.show_action_buttons_for_id(apm_obj.id());
                }
            },
            drag: function(elem) {
                var html_elem = $('#'+elem.target.id);
                var apm_obj = get_apm_obj(elem.target.id);
                var pos = get_position_array_from_html_pos(html_elem.position());
                pos[0] -= apm_obj.position_offset()[0];
                pos[1] -= apm_obj.position_offset()[1];
                apm_obj.position(pos)
                // Move all the dependents as well
                apm_obj.dependent_ids().forEach(function (d_id){
                    var apm_dep = get_apm_obj(d_id);
                    if (! apm_dep)
                        return
                    apm_dep.position(pos);
                    apm_dep.sync_position(0);
                });
                // Move the action buttons
                // sync_action_buttons()
                // Only send a server update if enough time has passed since the last
                var now = new Date().getTime()
                if (now - time_of_drag_emit > 200){
                    time_of_drag_emit = now
                    socket.emit('CONTINUE MOVE', {gameid:template_gameid, obj_id:elem.target.id, position:pos});
                }
            },
            stop: function(elem) {
                var apm_obj = get_apm_obj(elem.target.id);
                currently_dragging = false;
                var now = new Date().getTime();
                if (now - apm_obj.drop_time > 200){
                    var html_elem = $('#'+elem.target.id);
                    var pos = get_position_array_from_html_pos(html_elem.position());
                    pos[0] -= apm_obj.position_offset()[0];
                    pos[1] -= apm_obj.position_offset()[1];
                    apm_obj.depth(get_dropped_public_depth());
                    apm_obj.position(pos);
                    apm_obj.sync_position(0);
                    // Move all the dependents as well
                    apm_obj.dependent_ids().forEach(function (d_id){
                        var apm_dep = get_apm_obj(d_id);
                        if (! apm_dep)
                            return
                        apm_dep.depth(get_dropped_public_depth());
                        apm_dep.position(pos);
                        apm_dep.sync_position(0);
                        /*try {
                            $( '#'+apm_dep.id() ).droppable(droppable_settings);
                        } catch (err) {console.log(err);}*/
                    });
                    // If the object was private, we need to do a position offset
                    if (apm_obj.privacy() !== -1) {
                        pos[0] -= private_hand_horizontal_offset();
                        pos[1] -= private_hand_vertical_offset();
                    }
                    // Move the action buttons
                    sync_action_buttons() //This really should wait until the object has synced position
                    // Tell the server about the stop move
                    socket.emit('STOP MOVE', {
                        gameid:template_gameid,
                        obj_id:elem.target.id,
                        position:pos,
                        privacy: -1, //If this stop is being called rather than the other, must be public
                    });
                }
            },
        };
   droppable_settings ={
        classes: {
            "ui-droppable-active": "ui-state-active",
            "ui-droppable-hover": "ui-state-hover",
        },
        accept: function(el) {
            return el.hasClass('Card') || el.hasClass('Deck');
        },
        drop: function( event, ui ) {
            var now = new Date().getTime()
            var top_id = ui.draggable.context.id;
            var top_html = $('#'+top_id);
            var top_middle_y = top_html.offset().top + top_html.height()/2;
            var bottom_id = event.target.id;
            var apm_bottom = get_apm_obj(bottom_id);
            var apm_top = get_apm_obj(top_id);
            if (apm_bottom.privacy() === -1 && top_middle_y > $('#private-hand').offset().top){
                console.log('elem is below private hand line, won\'t trigger public drop');
                return;
            }
            if (apm_top.dependent_ids().includes(bottom_id)) {
                console.log('You cannot drop '+top_id+' onto one of its dependents');
                return;
            }
            if (now - time_of_drop_emit < 200) {
                console.log('too soon since last drop event');
                return;
            }
            console.log("Dropping "+top_id+' on '+bottom_id);
            time_of_drop_emit = now
            console.log('droped '+top_id+' on '+bottom_id);
            // Line up the dropped object
            // If either is not a deck or card, ignore the drop
            if (!['Deck','Card'].includes(apm_top.type()) || !['Deck','Card'].includes(apm_bottom.type()))
                return
            // We want to prevent emitting the stop event after this
            apm_top.drop_time = now
            apm_top.position( apm_bottom.position() );
            apm_top.depth(get_dragging_depth());
            apm_top.dependent_ids().forEach(function (d_id){
                var apm_dep = get_apm_obj(d_id);
                if (! apm_dep)
                    return
                apm_dep.depth(get_dragging_depth());
                apm_dep.sync_position(0);
                /*try {
                    $( '#'+apm_dep.id() ).droppable(droppable_settings);
                } catch (err) {
                    console.log(err);
                } */
            });
            apm_top.sync_position();
            // Move the action buttons
            sync_action_buttons()
            // Tell the server to combine the two
            socket.emit('COMBINE', {gameid:template_gameid, top_id:top_id, bottom_id:bottom_id});
        }
    };

    resizable_settings = {
            stop: function(elem, ui) {
                var html_elem = $('#'+elem.target.id);
                var apm_obj = get_apm_obj(elem.target.id);
                var dims = [html_elem.width(), html_elem.height()];
                socket.emit('RESIZE', {gameid:template_gameid, obj_id:elem.target.id, dimensions:dims});
            },
    };

    // Knockout helper functions
    get_apm_obj = function(oid) {
	var poss = apm.movables().filter(function(apm_p){return apm_p.id() == oid});
	if (poss.length > 0) {
	    return poss[0]
	} else {
	    //console.log("No such movable: "+oid);
	}
    };

    // Socketio functions
    socket.on('SHOULD REQUEST UPDATE', function(data){
       request_update();
    });

    var request_update = function(){
	socket.emit('UPDATE REQUEST', {gameid:template_gameid});
    };

    socket.on('connect', function() {
        socket.emit('JOIN ROOM', {room:template_gameid});
	request_update();
    });

    socket.on('UPDATE', function(d) {
        const data = d;
        deepFreeze(data);
        if (data.players) {
            apm.players(data.players.slice());
        }
        // quick_messages update
        if (data.quick_messages) {
            var qms = [];
            for (var i in apm.players())
                qms.push('@'+apm.players()[i]);
            qms = qms.concat(data.quick_messages);
            apm.quick_messages(qms);
        }
        //Messages update
        if (data.messages){
            apm.messages(data.messages);
            var html_string = "";
            var last_time = 0;
            var last_player_index = -1;
            data.messages.forEach(function(m){
                if (m['timestamp'] - last_time > 15 || last_player_index != m['player_index']){
                    var date = new Date(m['timestamp']*1000);
                    var hours = date.getHours();
                    var minutes = date.getMinutes();
                    var seconds = date.getSeconds();
                    if(minutes<10)
                      minutes= ""+0+minutes;
                    else
                      minutes = minutes;
                    if(seconds<10)
                      seconds = ""+0+seconds;
                    else
                      seconds = seconds;
                    html_string += '<span class="message-time">'+hours+':'+minutes+':'+seconds+'</span> ';
                    var i = m['player_index'];
                    html_string += '<span class="message-name player-color-'+(i%5)+'">'+apm.players()[m['player_index']]+':</span><br>';
                }
                last_time = m['timestamp'];
                last_player_index = m['player_index'];
                var text = m['text'];
                // Escape the html to keep everyone safe from nasties ;)
                text = escapeHtml(m['text']);
                // decode utf8 stuff so emojis and stuff are right (this has to come after)
                text = decodeURIComponent(escape(text));
                html_string += '<span class="message-text">'+text+'</span><br>';
            });
            $('#message-box').html(html_string);
            // Scroll to the bottom:
            $('#message-box').animate({scrollTop:$('#message-box')[0].scrollHeight}, 500);

        }
        //Movables changes
        if (! data.movables_info)
            return
	data.movables_info.forEach(function(obj_data) {
            //console.log('Processing object changes for '+obj_data.id);
            var apm_obj = get_apm_obj(obj_data.id);
            var position_sync_time = 200;
            var should_sync_position = false
	    if (!apm_obj){
                //Create the obj if it doesn't exist yet.
                apm_obj = createBasicTableMovable(obj_data.id)
                position_sync_time = 0;
                should_sync_position = true;
            }
            var html_obj = $('#'+apm_obj.id());

            //Update its info
            if ('dependents' in obj_data){
                obj_data.dependents.forEach(function(did){
                    var dep_obj = get_apm_obj(did);
                    if (dep_obj)
                        dep_obj.set_parent_id( apm_obj.id() );
                });
                // Make sure the order is right:
                apm_obj.dependent_ids(obj_data.dependents.slice());
            }
            if ('destroy' in obj_data && obj_data.destroy == true){
                console.log('destroying '+apm_obj.id());
                // Make all the dependents orphans
                apm_obj.dependent_ids().forEach(function(did){
                    var dep_obj = get_apm_obj(did);
                    if (dep_obj)
                        dep_obj.set_parent_id(false);
                });
                // If the action buttons were attached to it, detach them
                if (apm.show_action_buttons_for_id() == apm_obj.id()){
                    apm.show_action_buttons_for_id(false);
                    sync_action_buttons();
                }
                // Remove from the movables array
                apm.movables.splice( $.inArray(apm_obj, apm.movables()), 1);
                return
            }
            if ('parent' in obj_data)
                apm_obj.set_parent_id( obj_data.parent );
            if ('player_moving_index' in obj_data){
                apm_obj.player_moving_index( obj_data.player_moving_index );
            }
            if ('privacy' in obj_data) {
                if (obj_data.privacy != apm_obj.privacy())
                    position_sync_time = 0;
                apm_obj.change_privacy(obj_data.privacy);
                //console.log('done changing privacy');
                // The html_obj has changed
                html_obj = $('#'+apm_obj.id());
            }
            if ('type' in obj_data){
                apm_obj.type( obj_data.type );
            }
            if ('display_name' in obj_data){
                apm_obj.display_name( obj_data.display_name );
                // Redirect clicks on the text to the parent
                $("#"+apm_obj.id()+" span").off('click');
                $("#"+apm_obj.id()+" span").on('click', function(){
                    html_obj.trigger('click');
                    //console.log('click redirect:');
                });
            }
            // Update card image
            if ('front_image_url' in obj_data){
                apm_obj.front_image_url( obj_data.front_image_url );
            }
            if ('front_image_style' in obj_data){
                apm_obj.front_image_style( obj_data.front_image_style );
            }
            if ('back_image_url' in obj_data){
                apm_obj.back_image_url( obj_data.back_image_url );
            }
            if ('back_image_style' in obj_data){
                apm_obj.back_image_style( obj_data.back_image_style );
            }
            if ('default_face_up_offset' in obj_data){
                apm_obj.dfuo( obj_data.default_face_up_offset );
            }
            if ('default_face_down_offset' in obj_data){
                apm_obj.dfdo( obj_data.default_face_down_offset );
            }
            if ('is_face_up' in obj_data){
                apm_obj.is_face_up( obj_data.is_face_up );
            }
            // Sync card image changes
            apm_obj.sync_image();

            /*if ('offset_per_dependent' in obj_data){
                var a = obj_data.offset_per_dependent.slice();
                apm_obj.offset_per_dependent(a);
                // Move all the dependents
                apm_obj.dependent_ids().forEach(function (d_id){
                    var apm_dep = get_apm_obj(d_id);
                    if (! apm_dep)
                        return
                    apm_dep.sync_position(0);
                });
            }*/
            if (apm_obj.player_moving_index() !== template_player_index && apm_obj !== currently_dragging){
                if ('depth' in obj_data) {
                    apm_obj.depth( obj_data.depth );
                    should_sync_position = true;
                }
                if ('position' in obj_data) {
                    apm_obj.position( obj_data.position );
                    should_sync_position = true;
                }
                if ('dimensions' in obj_data) {
                    apm_obj.dimensions( obj_data.dimensions.slice() );
                    should_sync_position = true;
                }
                // Make changes to position visible in html
                if (should_sync_position){
                    apm_obj.sync_position(position_sync_time);
                }
            } else {
                //console.log("Not syncing position because of player_moving_index");
            }
	});
    });

    var pco_spinner_settings = {
        min:-50, max:50, step:1,


        stop: function( event, ui ) {
            var id = apm.show_action_buttons_for_id();
            var pco_x = $("#pco-x-spinner")[0].value || 1;
            var pco_y = $("#pco-y-spinner")[0].value || 1;
            if (id){
                socket.emit('PCO SET', {gameid:template_gameid, obj_id:id, pco_x:pco_x, pco_y:pco_y});
            }
        }
    };
    $( "#deal-spinner" ).spinner({min:1,max:20,step:1});
    $( "#pco-x-spinner" ).spinner(pco_spinner_settings);
    $( "#pco-y-spinner" ).spinner(pco_spinner_settings);
    $( "#deal-select"  ).selectmenu();
    $( "#deal-button" ).click(function(){
        var id = apm.show_action_buttons_for_id();
        var which_face = "same face"; //$("#deal-select")[0].value;
        var how_many = $("#deal-spinner")[0].value || 1
        if (id){
            socket.emit('DEAL', {gameid:template_gameid, obj_id:id, which_face:which_face, how_many:how_many});
        }
    });
    $( "#destroy-button" ).click(function(){
        var id = apm.show_action_buttons_for_id();
        if (id){
            socket.emit('DESTROY', {gameid:template_gameid, obj_id:id});
        }
    });
    $( "#flip-button"  ).click(function(){
        var id = apm.show_action_buttons_for_id();
        if (id){
            socket.emit('FLIP', {gameid:template_gameid, obj_id:id});
        }
    });
    $( "#BUTTONSHUFFLE" ).click(function(){
        var id = apm.show_action_buttons_for_id();
        if (id){
            socket.emit('SHUFFLE', {gameid:template_gameid, obj_id:id});
        }
    });
    // If the user clicks on the background, take away the action buttons
    $( '.content' ).on('click', function(e) {
        if (e.target !== this)
            return;
        apm.show_action_buttons_for_id(false);
        sync_action_buttons();
    });
    $( '#private-hand' ).droppable({
        accept: function(el) {
            return el.hasClass('Card') || el.hasClass('Deck');
        },
        drop: function( elem, ui ) {
            var top_id = ui.draggable.context.id;
            var apm_top = get_apm_obj(top_id);
            var now = new Date().getTime()

            // We want to prevent emitting the stop event after this
            apm_top.drop_time = now
            //apm_top.position( apm_bottom.position() );
            apm_top.depth(get_dropped_public_depth());
            // Move the action buttons
            sync_action_buttons()
            var html_elem = $('#'+top_id);
            var private_pos = get_position_array_from_html_pos(html_elem.position());
            // If the object was public, we need to do a position offset
            if (apm_top.privacy() === -1) {
                private_pos[0] += private_hand_horizontal_offset();
                private_pos[1] += private_hand_vertical_offset();
            }
            private_pos[0] -= apm_top.position_offset()[0];
            private_pos[1] -= apm_top.position_offset()[1];
            socket.emit('STOP MOVE', {
                gameid:template_gameid,
                obj_id:apm_top.id(),
                position:private_pos,
                privacy:template_player_index
            });
        }
    });
    var get_position_array_from_html_pos = function(html_pos){
        var x = html_pos.left;
        var y = html_pos.top;
        return [x, y];
    }
    $(".resizable").resizable({
        handles: {
            'n':'#handle'
        }
    });
    $('#chat-window').draggable();
    send_message = function(text) {
        socket.emit('SEND MESSAGE', {
            gameid: template_gameid,
            text:   text,
        });
    };
    $('#chat-window').resizable();

    $('#custom-text').on("keypress", function(e) {
        if (e.keyCode == 13){
            var elem = $('#custom-text');
            if (elem.val().length == 0)
                return false;
            send_message(elem.val());
            elem.val("");
            return false;
        }
    });
});
