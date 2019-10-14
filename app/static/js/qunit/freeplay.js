const QUNIT_DEBUG_PREFIX = "QUNIT:"

function simulate(element, type, args) {
    console.log(QUNIT_DEBUG_PREFIX, "Simulating", type, "for", element.attr("id"), "with gargs", args);
    setTimeout(function() { // This timeout makes this event run after all other UI events enqueued.
        element.simulate(type, args);
    }, 200);
}

function wait_for_element(selector, callback, maxtries = 10, interval = 10) {
  const poller = setInterval(() => {
    const el = jQuery(selector)
    const retry = maxtries === false || maxtries-- > 0
    if (retry && el.length < 1) return // will try again
    clearInterval(poller)
    callback(el || null)
  }, interval)
}

var event_counter = 0;
function on_trigger_off(element, event_type, f) {
    var event_name = event_type + '.qunit_' + event_counter++;
    element.on(event_name, function () {
        element.off(event_name);
        setTimeout(function() { // This timeout makes this event run after all other UI events enqueued.
            f();
        }, 0);
    });
    simulate(element, event_type);
    //element.trigger(event_type);
}

function run_after_movables_update(f, object_id) {
    ran_wrapper = false;
    wrapper = function(data) {
        // Ignore this update unless it has movables_info
        if (! ("movables_info" in data))
            return;
        // When passed an object id, ignore this call until we see that object id
        if (object_id) {
            if (!data['movables_info'].some(function(m) {return m.id.includes(object_id)}))
                return;
        }
        console.log(QUNIT_DEBUG_PREFIX, "Received movables update.");
        ran_wrapper = true;
        // Make sure this only gets called once (passing the above check)
        socket.off('UPDATE', wrapper);
        // This timeout makes this event run after all other UI events enqueued.
        setTimeout(function() {
            f();
        }, 0);
    }
    socket.on('UPDATE', wrapper);
    if (object_id)
        console.log(QUNIT_DEBUG_PREFIX, "Waiting for movables update for object", object_id, "...");
    else
        console.log(QUNIT_DEBUG_PREFIX, "Waiting for any movables update...");

    setTimeout(function () {
        if (ran_wrapper)
            return
        console.log(QUNIT_DEBUG_PREFIX, "Timeout: stopped waiting for movables update");
        socket.off('UPDATE', wrapper);
    }, 10000);
}

QUnit.config.autostart = false;

QUnit.log(function( details ) {
    if (details.result) {
        console.log(QUNIT_DEBUG_PREFIX, "passed test", details.message );
    } else {
        console.error(QUNIT_DEBUG_PREFIX, "FAILED test",  details.message, "received:", details.actual, "; expected:", details.expected);
        //throw QUNIT_DEBUG_PREFIX + " FAILED test " +  details.message + " received: " + details.actual + "; expected: " + details.expected
    }
});

QUnit.module("basic clicks", function(hooks) {
    hooks.beforeEach( function( assert ) {
        window.scrollTo(0,0);
        assert.equal($(window).scrollTop(), 0, "Preliminary: Window scroll at top of page");

        $(".content").click();
        assert.equal(apm.show_action_buttons_for_id, false, "Preliminary: show-action-buttons unassigned");
        assert.equal($("#action-button-panel").css('display'), "none", "Preliminary: action-button-panel hidden");
    });
    QUnit.test("clicks focus a card", function(assert) {
        var done = assert.async();
        assert.timeout( 1000 );
        assert.expect(5);
        const element_id = "CARD010";
        const element_selector = "#"+element_id;
        const expected_action_button_ids = ["right-button", "destroy-button", "flip-button", "left-button"];

        wait_for_element(element_selector, function() {
            var $element = $(element_selector);
            on_trigger_off($element, "click", function() {
                assert.equal(apm.show_action_buttons_for_id, element_id, "show-action-buttons shown for correct object");

                var action_button_ids = $("#action-button-panel").children().map(function() { return this.id }).get();
                assert.deepEqual(action_button_ids, expected_action_button_ids, "show-action-buttons has correct buttons");
                done();
            });
        });
    });
    QUnit.test("clicks focus a deck", function(assert) {
        var done = assert.async();
        assert.timeout( 1000 );
        assert.expect(5);
        const element_id = "DECK001";
        const element_selector = "#"+element_id;
        const expected_action_button_ids = ["", "deal-button", "action-button-br", "destroy-button", "flip-button", "shuffle-button", "sort-button"]

        wait_for_element(element_selector, function() {
            var $element = $(element_selector);
            on_trigger_off($element, "click", function() {
                assert.equal(apm.show_action_buttons_for_id, element_id, "show-action-buttons shown for correct object");

                var action_button_ids = $("#action-button-panel").children().map(function() { return this.id }).get();
                assert.deepEqual(action_button_ids, expected_action_button_ids, "show-action-buttons has correct buttons");

                done();
            });
        });
    });
    QUnit.test("clicks on content removes focus", function(assert) {
        var done = assert.async();
        assert.timeout( 1000 );
        assert.expect(7);
        const element_id = "DECK001";
        const element_selector = "#"+element_id;
        const background_selector = ".content"
        const expected_action_button_ids = ["", "deal-button", "action-button-br", "destroy-button", "flip-button", "shuffle-button", "sort-button"]

        wait_for_element(element_selector, function() {
            var $element = $(element_selector);
            on_trigger_off($element, "click", function() {
                assert.equal(apm.show_action_buttons_for_id, element_id, "show-action-buttons shown for correct object");

                var action_button_ids = $("#action-button-panel").children().map(function() { return this.id }).get();
                assert.deepEqual(action_button_ids, expected_action_button_ids, "show-action-buttons has correct buttons");

                var $background = $(background_selector)
                on_trigger_off($background, "click", function() {
                    assert.equal(apm.show_action_buttons_for_id, false, "show-action-buttons unassigned");
                    assert.equal($("#action-button-panel").css('display'), "none", "action-button-panel hidden");

                    done();
                });
            });
        });
    });
});

QUnit.module("server connectivity", function(hooks) {
    hooks.beforeEach( function( assert ) {
        var done = assert.async();
        setTimeout(function() {
            done();
        }, 200);
    });
    QUnit.test("sending a flip deck signal gets a response", function(assert) {
        var done = assert.async();
        assert.timeout( 5000 );
        assert.expect(2);
        socket.emit('FLIP', {gameid:template_gameid, obj_id:'DECK001'});
        run_after_movables_update(function() {
            assert.ok(true, "received first update from server");
            socket.emit('FLIP', {gameid:template_gameid, obj_id:'DECK001'});
            run_after_movables_update(function() {
                assert.ok(true, "received second update from server");
                done();
            });
        });
    });
});

QUnit.module("basic movement", function(hooks) {
    const first_card_id = "CARD021";
    const second_card_id = "CARD022";

    hooks.beforeEach( function( assert ) {
        window.scrollTo(0,0);
        assert.equal($(window).scrollTop(), 0, "Preliminary: Window scroll at top of page");

        var done = assert.async();
        const first_card_apm = get_apm_obj(first_card_id);
        const second_card_apm = get_apm_obj(second_card_id);
        const parent_id = first_card_apm.parent_id

        wait_for_element("#"+first_card_id, function() {
            assert.ok(parent_id, "Parent exists");
            assert.equal(first_card_apm.parent_id, parent_id, "Preliminary: First card has the parent");
            assert.equal(second_card_apm.parent_id, parent_id, "Preliminary: Second card has the parent");
            done();
        });
    });

    QUnit.test("moving a card out of deck and back again", function(assert) {
        var done = assert.async();
        assert.timeout( 5000 );
        assert.expect(7);
        const first_card_apm = get_apm_obj(first_card_id);
        const original_parent_id = first_card_apm.parent_id
        const parent_apm = get_apm_obj(original_parent_id);
        const $first_card = $("#"+first_card_id);
        const $second_card = $("#"+second_card_id);


        // Drag off of starting deck
        simulate($first_card, "drag", {dx: 500, dy: 500});

        run_after_movables_update(function() {
            assert.equal(first_card_apm.parent_id, false, "First card has no parent");

            // Drag back onto starting deck
            simulate($first_card, "drag", {dx: -500, dy: -500});

            run_after_movables_update(function() {
                assert.equal(first_card_apm.parent_id, original_parent_id, "First card has its original parent");
                assert.equal(parent_apm.dependent_ids.slice(-1)[0], first_card_id, "First card is top dependent in parent");
                done();
            }, original_parent_id);
        });
    });
    QUnit.test("moving two cards out, onto each other, moving new deck back onto original deck", function(assert) {
        var done = assert.async();
        assert.timeout( 5000 );
        assert.expect(10);
        const first_card_apm = get_apm_obj(first_card_id);
        const second_card_apm = get_apm_obj(second_card_id);
        const original_parent_id = first_card_apm.parent_id
        const parent_apm = get_apm_obj(original_parent_id);
        const $parent = $("#"+original_parent_id);
        const $first_card = $("#"+first_card_id);
        const $second_card = $("#"+second_card_id);


        // Drag off of starting deck
        simulate($first_card, "drag", {x: 500, y: 500});

        run_after_movables_update(function() {
            assert.equal(first_card_apm.parent_id, false, "First card has no parent");

            // Drag second card off starting deck, onto first card
            simulate($second_card, "drag", {x: 500, y: 500});

            run_after_movables_update(function() {
                assert.ok(first_card_apm.parent_id, "First card has a parent again");
                assert.equal(first_card_apm.parent_id, second_card_apm.parent_id, "First card and second card have same parents");

                // Drag the new resulting deck back onto the original deck
                wait_for_element("#"+first_card_apm.parent_id, function() {
                    $new_deck = $("#"+first_card_apm.parent_id)

                    const original_position = $parent.offset(); // Offset gets position in document rather than in parent
                    simulate($new_deck, "drag", {x: original_position.left + 50, y: original_position.top + 50});

                    run_after_movables_update(function() {
                        assert.equal(first_card_apm.parent_id, original_parent_id, "First card has original parent");
                        assert.equal(second_card_apm.parent_id, original_parent_id, "Second card has original parent");
                        assert.equal(parent_apm.dependent_ids.slice(-1)[0], second_card_id, "Second card is top dependent in parent");
                        done();
                    }, original_parent_id);
                });
            });
        });
    });
});

QUnit.module("number cards", function(hooks) {
    const first_card_id = "NUM124";

    hooks.beforeEach( function( assert ) {
        var done = assert.async();
        wait_for_element("#"+first_card_id, function() {
            $(".content").click();
            assert.equal(apm.show_action_buttons_for_id, false, "Preliminary: show-action-buttons unassigned");

            const first_card_apm = get_apm_obj(first_card_id);
            assert.equal(first_card_apm.show_face_number, 0, "Preliminary: Num card start test at 0");
            done();
        });
    });

    QUnit.test("Incrementing then decrementing", function(assert) {
        var done = assert.async();
        assert.expect(6);
        assert.timeout( 5000 );

        const $first_card = $("#"+first_card_id);
        const first_card_apm = get_apm_obj(first_card_id);

        $first_card.click();
        $("#up-button").click();

        run_after_movables_update(function() {
            assert.equal(first_card_apm.show_face_number, 1, "Now shows 1");

            const $span = $('span.display-content', $first_card);
            assert.equal($span.text(), "1", "HTML span shows 1");

            $("#down-button").click();

            run_after_movables_update(function() {
                assert.equal(first_card_apm.show_face_number, 0, "Now shows 0");

                const $span = $('span.display-content', $first_card);
                assert.equal($span.text(), "0", "HTML span shows 0");

                done();
            }, first_card_id);
        }, first_card_id);
    });

    QUnit.test("Decrementing then Incrementing", function(assert) {
        var done = assert.async();
        assert.expect(6);
        assert.timeout( 5000 );

        const $first_card = $("#"+first_card_id);
        const first_card_apm = get_apm_obj(first_card_id);

        $first_card.click();
        $("#down-button").click();

        run_after_movables_update(function() {
            assert.equal(first_card_apm.show_face_number, -1, "Now shows -1");

            const $span = $('span.display-content', $first_card);
            assert.equal($span.text(), "-1", "HTML span shows -1");

            $("#up-button").click();

            run_after_movables_update(function() {
                assert.equal(first_card_apm.show_face_number, 0, "Now shows 0");

                const $span = $('span.display-content', $first_card);
                assert.equal($span.text(), "0", "HTML span shows 0");

                done();
            }, first_card_id);
        }, first_card_id);
    });
});

QUnit.module("private hand", function(hooks) {
    const first_card_id = "NUM124";
    const second_card_id = "NUM125";
    const third_card_id = "NUM126";

    hooks.beforeEach( function( assert ) {
        var done = assert.async();

        // The window scroll positioning is important for this (and maybe other
        // movement ones) because the simulated dragging that happens in these
        // tests does not appear to take into account the scroll position
        window.scrollTo(0,0);
        assert.equal($(window).scrollTop(), 0, "Preliminary: Window scroll at top of page");

        const first_card_apm = get_apm_obj(first_card_id);
        const second_card_apm = get_apm_obj(second_card_id);
        const third_card_apm = get_apm_obj(third_card_id);
        const parent_id = first_card_apm.parent_id

        wait_for_element("#"+first_card_id, function() {
            assert.ok(parent_id, "Parent exists");
            assert.equal(first_card_apm.parent_id, parent_id, "Preliminary: First card has the parent");
            assert.equal(second_card_apm.parent_id, parent_id, "Preliminary: Second card has the parent");
            assert.equal(third_card_apm.parent_id, parent_id, "Preliminary: Third card has the parent");
            assert.equal(first_card_apm.privacy, -1, "Preliminary: First card has privacy -1: public");
            done();
        });
    });

    QUnit.test("moving a card out of deck into private hand", function(assert) {
        var done = assert.async();
        assert.expect(10);
        assert.timeout( 5000 );

        const private_hand_top = $("#private-hand").offset().top;
        const $first_card = $("#"+first_card_id);


        const first_card_apm = get_apm_obj(first_card_id);
        const original_parent_id = first_card_apm.parent_id
        const original_parent_apm = get_apm_obj(original_parent_id);

        // Drag card into private hand
        simulate($first_card, "drag", {x: 200, y: private_hand_top + 50});

        run_after_movables_update(function() {
            assert.equal(first_card_apm.privacy, 0, "First card has privacy 0: in first player's private hand");
            assert.equal(first_card_apm.parent_id, false, "First card has no parent");

            const original_position = $("#"+original_parent_id).offset(); // Offset gets position in document rather than in parent
            simulate($first_card, "drag", {x: original_position.left+50, y: original_position.top+50});

            run_after_movables_update(function() {
                assert.equal(first_card_apm.privacy, -1, "First card has privacy -1: public");
                assert.equal(first_card_apm.parent_id, original_parent_id, "First card has original parent");

                done();
            }, first_card_id);
        }, first_card_id);
    });

    QUnit.test("moving three cards to private hand and back", function(assert) {
        var done = assert.async();
        assert.expect(20);
        assert.timeout( 5000 );

        const private_hand_top = $("#private-hand").offset().top;

        const $first_card = $("#"+first_card_id);
        const first_card_apm = get_apm_obj(first_card_id);
        const $second_card = $("#"+second_card_id);
        const second_card_apm = get_apm_obj(second_card_id);
        const $third_card = $("#"+third_card_id);
        const third_card_apm = get_apm_obj(third_card_id);

        const original_parent_id = first_card_apm.parent_id
        const original_parent_apm = get_apm_obj(original_parent_id);

        // Drag first card into private hand
        simulate($first_card, "drag", {x: 200, y: private_hand_top + 100});

        run_after_movables_update(function() {
            assert.equal(first_card_apm.privacy, 0, "First card has privacy 0: in first player's private hand");
            assert.equal(first_card_apm.parent_id, false, "First card has no parent");

            // Drag second card into private hand on top of first, creating a new deck
            simulate($second_card, "drag", {x: 200, y: private_hand_top + 100});

            run_after_movables_update(function() {
                assert.equal(second_card_apm.privacy, 0, "Second card has privacy 0: in first player's private hand");
                assert.ok(second_card_apm.parent_id, "Second card has a parent");
                assert.equal(second_card_apm.parent_id, first_card_apm.parent_id, "First and second card have same parent");

                // Drag third card into private hand on top of new private deck
                simulate($third_card, "drag", {x: 200, y: private_hand_top + 100});

                run_after_movables_update(function() {
                    assert.equal(third_card_apm.privacy, 0, "Third card has privacy 0: in first player's private hand");
                    assert.ok(third_card_apm.parent_id, "Third card has a parent");
                    assert.equal(third_card_apm.parent_id, first_card_apm.parent_id, "First and third card have same parent");

                    $new_deck = $("#"+first_card_apm.parent_id)
                    const original_position = $("#"+original_parent_id).offset(); // Offset gets position in document rather than in parent
                    console.log(original_parent_id, original_position);
                    simulate($new_deck, "drag", {x: original_position.left+50, y: original_position.top+50});

                    run_after_movables_update(function() {
                        assert.equal(first_card_apm.privacy, -1, "First card has privacy -1: public");
                        assert.equal(second_card_apm.privacy, -1, "Second card has privacy -1: public");
                        assert.equal(third_card_apm.privacy, -1, "Third card has privacy -1: public");

                        assert.equal(first_card_apm.parent_id, original_parent_id, "First has original parent");
                        assert.equal(second_card_apm.parent_id, original_parent_id, "Second has original parent");
                        assert.equal(third_card_apm.parent_id, original_parent_id, "Third has original parent");

                        done();
                    }, original_parent_id);
                }, "DECK");
            }, "DECK");
        });
    });
});


//TODO
/*
 * flipping deck flips cards
 * removing from deck changes deck size
 *
 * Module Dice
 *
 * Module Messages
 *
 * Module Private Hand
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 */
