// Any varibles preceded by "template_" are inserted into the html's inline js
'use strict';
var get_apm_obj;
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
        self.is_face_up = ko.observable(true);
        self.depth = ko.observable(0);
        self.type = ko.observable("");
        self.front_image_url = ko.observable(false);
        self.front_image_style = ko.observable("100% 100%");
        self.back_image_url = ko.observable('/static/images/freeplay/red_back.png');
        self.back_image_style = ko.observable("100% 100%");
        self.move_confirmed_by_server = false;
        self.offset_per_dependent = ko.observableArray([.5, .5]);
        self.position_offset = ko.computed(function() {
            if (self.type() == 'Deck'){
                return [-10, -27];
            } else if (self.type() == 'Card' && self.parent_id()){
                var i = self.get_index_in_parent();
                var p = get_apm_obj(self.parent_id());
                var opd = [.5,.5];
                if (p)
                    opd = p.offset_per_dependent();
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

        self.drop_time = 0;
        self.has_synced_once = false;
    }
    TableMovable.prototype.sync_position = function(time){
        if (time === undefined)
            time = 200;
        if (this.has_synced_once === false){
            this.has_synced_once = true;
            time = 0
        }
        var html_elem = $('#'+this.id());

        if (this.type() !== "ViewBlocker"){
            html_elem.css({
                "z-index": this.depth(),
            });
        }
        var css_obj = {
            "left":this.position()[0]+this.position_offset()[0],
            "top": this.position()[1]+this.position_offset()[1],
            "width": this.dimensions()[0]+this.dimension_offset()[0],
            "height": this.dimensions()[1]+this.dimension_offset()[1],
        }
        if (time === 0){
            html_elem.css( css_obj );
        } else {
            html_elem.animate( css_obj,{duration:time} );
        }
    };

    var sync_action_buttons = function(should_hide){
        // If the option buttons are attached to this object, move it too.
        var html_obj = $( '#'+apm.show_action_buttons_for_id());
        var apm_obj = get_apm_obj(apm.show_action_buttons_for_id());
        var html_pos = html_obj.position()
        if (!should_hide && html_pos){
            $( '#action-button-panel' ).css({
                "left":html_pos.left - 170,
                "top": html_pos.top,
                "display": "inline",
            });
            // Set the PCO dials to the correct values
            var a = apm_obj.offset_per_dependent();
            $( "#pco-x-spinner" ).spinner( 'value', Math.abs(a[0]) ** .5 * 4 * Math.sign(a[0]) );
            $( "#pco-y-spinner" ).spinner( 'value', Math.abs(a[1]) ** .5 * 4 * Math.sign(a[0]) );
        } else {
            $( '#action-button-panel' ).css({
                "display": "none",
            });
        }

    }

    // Careful, it places this on top of the pid stack
    TableMovable.prototype.set_parent_id = function(pid){
        if (this.parent_id() === pid)
            return
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
    };

    function AppViewModel() {
        var self = this;
        self.movables = ko.observableArray([]);
        self.show_action_buttons_for_id = ko.observable(false);
        // No need for these to be observable
        self.my_player_index = template_player_index;
    }

    // Activates knockout.js
    var apm = new AppViewModel()
        ko.applyBindings(apm);
    var time_of_drag_emit = 0;
    var currently_dragging = false;
    var time_of_resize_emit = 0;
    var time_of_drop_emit = 0;
    var dragging_z = 10000000;
    var get_dragging_depth = function(){
        dragging_z += 1;
        return dragging_z;
    }

    function createBasicTableMovable(id){
        var apm_obj = new TableMovable(id, [0,0], [0,0], [], false, undefined);
        // Add it to the html
        apm.movables.push(apm_obj);
        // Make it draggable and droppable
        $( '#'+apm_obj.id() ).draggable(draggable_settings);
        $( '#'+apm_obj.id() ).droppable(droppable_settings);
        $( '#'+apm_obj.id() ).on('click', function(elem){
            elem = elem.target;
            // If we clicked on the same one again, hide the button
            if (apm.show_action_buttons_for_id() === elem.id){

                apm.show_action_buttons_for_id(false)
                sync_action_buttons()
            }
            else {
                var apm_obj = get_apm_obj(elem.id);
                apm.show_action_buttons_for_id(elem.id);
                sync_action_buttons()
            }
        });

        return apm_obj
    }


    var draggable_settings = {
            start: function(elem) {
                var html_elem = $('#'+elem.target.id);
                // This will prevent a click event being triggered at drop time
                socket.emit('START MOVE', {gameid:template_gameid, obj_id:elem.target.id});
                var apm_obj = get_apm_obj(elem.target.id);
                if (apm_obj.type() !== 'ViewBlocker')
                    html_elem.css({'z-index':get_dragging_depth()});
                currently_dragging = apm_obj;
                // Start all of the dependents dragging as well
                apm_obj.dependent_ids().forEach(function (d_id){
                    var apm_dep = get_apm_obj(d_id);
                    if (! apm_dep)
                        return
                    apm_dep.depth(get_dragging_depth());
                    apm_dep.sync_position(0);
                    try {
                        $( '#'+apm_dep.id() ).droppable("destroy");
                    } catch (err) {}
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
                    // Move all the dependents as well
                    apm_obj.dependent_ids().forEach(function (d_id){
                        var apm_dep = get_apm_obj(d_id);
                        if (! apm_dep)
                            return
                        apm_dep.depth(get_dragging_depth());
                        apm_dep.position(pos);
                        apm_dep.sync_position(0);
                        try {
                            $( '#'+apm_dep.id() ).droppable(droppable_settings);
                        } catch (err) {}
                    });
                    // Move the action buttons
                    sync_action_buttons()
                    // Tell the server about the stop move
                    socket.emit('STOP MOVE', {gameid:template_gameid, obj_id:elem.target.id, position:pos});
                }
            },
        };
    var droppable_settings ={
        classes: {
            "ui-droppable-active": "ui-state-active",
            "ui-droppable-hover": "ui-state-hover",
        },
        drop: function( event, ui ) {
            var now = new Date().getTime()
            if (now - time_of_drop_emit < 200)
                return
            time_of_drop_emit = now
            var top_id = ui.draggable.context.id;
            var bottom_id = event.target.id;
            // Line up the dropped object
            var apm_top = get_apm_obj(top_id);
            var apm_bottom = get_apm_obj(bottom_id);
            // If either is not a deck or card, ignore the drop
            if (!['Deck','Card'].includes(apm_top.type()) || !['Deck','Card'].includes(apm_bottom.type()))
                return
            // We want to prevent emitting the stop event after this
            apm_top.drop_time = now
            apm_top.position( apm_bottom.position() );
            var temp_depth = 5000000;
            apm_top.depth(temp_depth);
            temp_depth += 1;
            apm_top.dependent_ids().forEach(function (d_id){
                var apm_dep = get_apm_obj(d_id);
                if (! apm_dep)
                    return
                apm_dep.depth(get_dragging_depth);
                apm_dep.sync_position(0);
                try {
                    $( '#'+apm_dep.id() ).droppable(droppable_settings);
                } catch (err) {}
            });
            apm_top.sync_position();
            // Move the action buttons
            sync_action_buttons()
            // Tell the server to combine the two
            socket.emit('COMBINE', {gameid:template_gameid, top_id:top_id, bottom_id:bottom_id});
        }
    };

    var resizable_settings = {
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
        // Swap out player indexes for names and pronouns
        if (data.players) for (var i in data.players) for (var mi in data.recent_messages){
            if (i == template_player_index)
                data.recent_messages[mi] = data.recent_messages[mi].replace('['+i+']', 'you');
            else
                data.recent_messages[mi] = data.recent_messages[mi].replace('['+i+']', data.players[i]);
        }
        // Game over status
        apm.game_over = data.game_over == 1
        //Movables changes
	data.movables_info.forEach(function(obj_data) {
            //console.log('Processing object changes for '+obj_data.id);
            var apm_obj = get_apm_obj(obj_data.id);
            var is_new = false;
            var should_sync_position = false
	    if (!apm_obj){
                //Create the obj if it doesn't exist yet.
                apm_obj = createBasicTableMovable(obj_data.id)
                is_new = true;
                should_sync_position = true;
            }

            //Update its info
            if ('display_name' in obj_data)
                apm_obj.display_name( obj_data.display_name );
            if ('dependents' in obj_data){
                obj_data.dependents.forEach(function(did){
                    var dep_obj = get_apm_obj(did);
                    if (dep_obj)
                        dep_obj.set_parent_id( apm_obj.id() );
                });
                // Make sure the order is right:
                apm_obj.dependent_ids(obj_data.dependents.slice());
            }
            if ('destroy' in obj_data){
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
                    sync_action_buttons()
                }
                // Remove from the movables array
                apm.movables.splice( $.inArray(apm_obj, apm.movables()), 1);
                return
            }
            if ('parent' in obj_data)
                apm_obj.set_parent_id( obj_data.parent );
            if ('player_moving_index' in obj_data){
                apm_obj.player_moving_index( parseInt(obj_data.player_moving_index) );
            }
            if ('type' in obj_data){
                apm_obj.type( obj_data.type );
                if (apm_obj.type() == "ViewBlocker"){
                    var html_elem = $( '#'+apm_obj.id() );
                    html_elem.resizable(resizable_settings);
                    try {
                        html_elem.droppable('destroy');
                    } catch (err) {}
                }
            }
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
            if ('is_face_up' in obj_data){
                apm_obj.is_face_up( obj_data.is_face_up );
                var html_elem = $( '#'+apm_obj.id() );
                if (! apm_obj.is_face_up()){
                    html_elem.addClass( 'back' )
                } else if ( $( '#'+apm_obj.id() ).hasClass('back') ){
                    html_elem.removeClass( 'back' )
                }
            }
            if ('offset_per_dependent' in obj_data){
                var a = obj_data.offset_per_dependent.slice();
                a[0] = Math.abs(a[0] / 4) ** 2 * Math.sign(a[0]);
                a[1] = Math.abs(a[1] / 4) ** 2 * Math.sign(a[1]);
                apm_obj.offset_per_dependent(a);
                // Move all the dependents
                apm_obj.dependent_ids().forEach(function (d_id){
                    var apm_dep = get_apm_obj(d_id);
                    if (! apm_dep)
                        return
                    apm_dep.sync_position(0);
                });
            }
            if (apm_obj.is_face_up()){
                // If the card has an image, show it
                var html_elem = $( '#'+apm_obj.id() );
                if (apm_obj.front_image_url()){
                    html_elem.css({
                        'background-image': "url("+apm_obj.front_image_url()+")",
                        'background-size': apm_obj.front_image_style(),
                    });
                }
            } else {
                var html_elem = $( '#'+apm_obj.id() );
                if (apm_obj.back_image_url()){
                    html_elem.css({
                        'background-image': "url("+apm_obj.back_image_url()+")",
                        'background-size': apm_obj.back_image_style(),
                    });
                }
            }
            if ('show_players' in obj_data){
                // If show_players has us in it, put it low, otherwise high
                var html_elem = $( '#'+apm_obj.id() );
                if (obj_data.show_players.includes(template_player_index)){
                    html_elem.css({'z-index':0});
                } else {
                    html_elem.css({'z-index':apm_obj.depth()});
                }
            }
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
                    apm_obj.dimensions( obj_data.dimensions );
                    should_sync_position = true;
                }
                // Make changes to position visible in html
                if (should_sync_position){
                    if (is_new)
                        apm_obj.sync_position(0);
                    else
                        apm_obj.sync_position();
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
        var which_face = $("#deal-select")[0].value;
        var how_many = $("#deal-spinner")[0].value || 1
        if (id){
            socket.emit('DEAL', {gameid:template_gameid, obj_id:id, which_face:which_face, how_many:how_many});
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
    var get_position_array_from_html_pos = function(html_pos){
        var x = html_pos.left;
        var y = html_pos.top;
        return [x, y];
    }
});
