// Any varibles preceded by "template_" are inserted into the html's inline js

$( document ).ready(function() {
    // For IE, which doesn't have includes
    if (!String.prototype.includes) {
      String.prototype.includes = function(search, start) {
	'use strict';
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
    shuffle_array = function(array) {
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

    function TableMovable(id, position, dimensions, dependent_ids, parent_id, display_name){
	var self = this;
        self.id = ko.observable(id);
        self.position = ko.observable(position);
        self.dimensions = ko.observable(dimensions);
        self.dependent_ids = ko.observableArray(dependent_ids);
        self.parent_id = ko.observable(get_apm_obj(parent_id));
        self.set_parent_id(parent_id);
        self.player_moving_index = ko.observable(-1);
        self.display_name = ko.observable(display_name = display_name);
        self.depth = ko.observable(0);
        self.move_confirmed_by_server = false;
        self.position_offset = ko.computed(function() {
            if (self.dependent_ids().length > 0){
                return [0, -27];
            }
            return [0,0];
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
        //console.log('calling sync_position on '+this.id());
        html_elem = $('#'+this.id());
        html_elem.css({
            "z-index": this.depth(),
        });
        if (time === 0){
            html_elem.css({
                "left":this.position()[0]+this.position_offset()[0],
                "top": this.position()[1]+this.position_offset()[1],
            });
        } else {
            html_elem.animate({
                "left":this.position()[0]+this.position_offset()[0],
                "top": this.position()[1]+this.position_offset()[1],
            },{duration:time});
        }
    };

    // Careful, it places this on top of the pid stack
    TableMovable.prototype.set_parent_id = function(pid){
        if (this.parent_id() === pid)
            return
        //console.log("Setting parent of "+this.id()+" to "+pid);
        // Remove from old parent dependents if possible
        obj_old_parent = get_apm_obj( this.parent_id() );
        if (obj_old_parent){
            array = obj_old_parent.dependent_ids
            array.splice( $.inArray(pid, array()), 1);
        }
        // Set new parent
        this.parent_id( pid );
        if (pid === false || pid === undefined){
            // Don't need to do anything
        } else {
            // Try to find the new parent
            obj_parent = get_apm_obj(pid);
            // If the parent doesn't exist yet, make it
            if (! obj_parent){
                //console.log('Creating object '+pid+' as needed by dependent '+this.id());
                obj_parent = createBasicTableMovable(pid);
                //console.log('here');
            }
            // Add this to its dependents
            obj_parent.dependent_ids.push(this.id())
        }

    };

    function AppViewModel() {
        var self = this;
        self.movables = ko.observableArray([]);
        // No need for these to be observable
        self.my_player_index = template_player_index;
    }

    // Activates knockout.js
    apm = new AppViewModel()
        ko.applyBindings(apm);
    time_of_drag_emit = 0;
    time_of_drop_emit = 0;
    dragging_z = 10000000;
    get_dragging_depth = function(){
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
        return apm_obj
    }

    draggable_settings = {
            start: function(elem) {
                html_elem = $('#'+elem.target.id);
                socket.emit('START MOVE', {gameid:template_gameid, obj_id:elem.target.id});
                html_elem.css({'z-index':get_dragging_depth()});
                apm_obj = get_apm_obj(elem.target.id);
                // Start all of the dependents dragging as well
                //console.log("Start move: "+apm_obj.dependent_ids());
                apm_obj.dependent_ids().forEach(function (d_id){
                    apm_dep = get_apm_obj(d_id);
                    if (! apm_dep)
                        return
                    apm_dep.depth(get_dragging_depth());
                    apm_dep.sync_position(0);
                    try {
                        //console.log('destroying draggability on '+d_id);
                        $( '#'+apm_dep.id() ).droppable("destroy");
                    } catch (err) {}
                });
                // Remove this object from its parents
                apm_obj.set_parent_id(false);
                /*pid = apm_obj.parent_id();
                if (pid){
                    p = get_apm_obj(pid);
                    if (p === undefined){
                        apm_obj.parent_id(false);
                    } else {
                        array = p.dependent_ids
                        array.splice( $.inArray(pid, array()), 1);
                    }
                }
                apm_obj.parent_id(false);*/
            },
            drag: function(elem) {
                html_elem = $('#'+elem.target.id);
                apm_obj = get_apm_obj(elem.target.id);
                pos = get_position_array_from_html_pos(html_elem.position());
                pos[0] -= apm_obj.position_offset()[0];
                pos[1] -= apm_obj.position_offset()[1];
                apm_obj.position(pos)
                // Move all the dependents as well
                //console.log(apm_obj.dependent_ids());
                apm_obj.dependent_ids().forEach(function (d_id){
                    apm_dep = get_apm_obj(d_id);
                    if (! apm_dep)
                        return
                    apm_dep.position(pos);
                    apm_dep.sync_position(0);
                });
                // Only send a server update if enough time has passed since the last
                now = new Date().getTime()
                if (now - time_of_drag_emit > 200){
                    time_of_drag_emit = now
                    socket.emit('CONTINUE MOVE', {gameid:template_gameid, obj_id:elem.target.id, position:pos});
                }
            },
            stop: function(elem) {
                apm_obj = get_apm_obj(elem.target.id);
                var now = new Date().getTime();
                //console.log(now - apm_obj.drop_time);
                if (now - apm_obj.drop_time > 200){
                    html_elem = $('#'+elem.target.id);
                    pos = get_position_array_from_html_pos(html_elem.position());
                    pos[0] -= apm_obj.position_offset()[0];
                    pos[1] -= apm_obj.position_offset()[1];
                    // Move all the dependents as well
                    apm_obj.dependent_ids().forEach(function (d_id){
                        apm_dep = get_apm_obj(d_id);
                        if (! apm_dep)
                            return
                        apm_dep.depth(get_dragging_depth());
                        //console.log('stop syncing '+d_id);
                        apm_dep.sync_position(0);
                        try {
                            $( '#'+apm_dep.id() ).droppable(droppable_settings);
                        } catch (err) {}
                    });
                    // Tell the server about the stop move
                    socket.emit('STOP MOVE', {gameid:template_gameid, obj_id:elem.target.id, position:pos});
                }
            },
        };
    droppable_settings ={
        classes: {
            "ui-droppable-active": "ui-state-active",
            "ui-droppable-hover": "ui-state-hover",
        },
        drop: function( event, ui ) {
            var now = new Date().getTime()
            if (now - time_of_drop_emit < 200)
                return
            time_of_drop_emit = now
            top_id = ui.draggable.context.id;
            bottom_id = event.target.id;
            //console.log(top_id + " dropped on " + bottom_id);
            // Line up the dropped object
            apm_top = get_apm_obj(top_id);
            apm_bottom = get_apm_obj(bottom_id);
            // We want to prevent emitting the stop event after this
            apm_top.drop_time = now
            apm_top.position( apm_bottom.position() );
            temp_depth = 5000000;
            apm_top.depth(temp_depth);
            temp_depth += 1;
            apm_top.dependent_ids().forEach(function (d_id){
                apm_dep = get_apm_obj(d_id);
                if (! apm_dep)
                    return
                apm_dep.depth(get_dragging_depth);
                apm_dep.sync_position(0);
                try {
                    $( '#'+apm_dep.id() ).droppable(droppable_settings);
                } catch (err) {}
            });
            apm_top.sync_position();
            // Tell the server to combine the two
            socket.emit('COMBINE', {gameid:template_gameid, top_id:top_id, bottom_id:bottom_id});
        }
    };

    // Knockout helper functions
    get_apm_obj = function(oid) {
	poss = apm.movables().filter(function(apm_p){return apm_p.id() == oid});
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

    request_update = function(){
	socket.emit('UPDATE REQUEST', {gameid:template_gameid});
    };

    socket.on('connect', function() {
        socket.emit('JOIN ROOM', {room:template_gameid});
	request_update();
    });

    socket.on('UPDATE', function(data) {
        // Swap out player indexes for names and pronouns
        if (data.players) for (i in data.players) for (mi in data.recent_messages){
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
            apm_obj = get_apm_obj(obj_data.id);
            var is_new = false;
            var should_sync_position = false
	    if (!apm_obj){
                //Create the obj if it doesn't exist yet.
                //console.log("creating new object with id: "+obj_data.id);
                apm_obj = createBasicTableMovable(obj_data.id)
                is_new = true;
                should_sync_position = true;
            }

            //Update its info
            if ('display_name' in obj_data)
                apm_obj.display_name( obj_data.display_name );
            if ('dimensions' in obj_data)
                apm_obj.dimensions( obj_data.dimensions );
            if ('dependents' in obj_data){
                obj_data.dependents.forEach(function(did){
                    dep_obj = get_apm_obj(did);
                    if (dep_obj)
                        dep_obj.set_parent_id( apm_obj.id() );
                });
                // Make sure the order is right:
                apm_obj.dependent_ids( obj_data.dependents );
                // console.log(apm_obj.dependent_ids());
            }
            if ('destroy' in obj_data){
                console.log('destroying '+apm_obj.id());
                // Make all the dependents orphans
                apm_obj.dependent_ids().forEach(function(did){
                    dep_obj = get_apm_obj(did);
                    if (dep_obj)
                        dep_obj.set_parent_id(false);
                });
                apm.movables.splice( $.inArray(apm_obj, apm.movables()), 1);
                return
            }
            if ('parent' in obj_data)
                apm_obj.set_parent_id( obj_data.parent );
            if ('player_moving_index' in obj_data){
                apm_obj.player_moving_index( parseInt(obj_data.player_moving_index) );
            }
            if (apm_obj.player_moving_index() !== template_player_index){
                if ('depth' in obj_data) {
                    apm_obj.depth( obj_data.depth );
                    should_sync_position = true;
                }
                if ('position' in obj_data) {
                    apm_obj.position( obj_data.position );
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
                //console.log("Not changing position because of player_moving_index");
            }
	});
    });

    get_position_array_from_html_pos = function(html_pos){
        x = html_pos.left;
        y = html_pos.top;
        return [x, y];
    }
});
