// Benchmarks:
//  My phone firefox: 40 - 45 FPS
//
// TODO
// Minor:
//  Make seed random on load
//  Bug: Slowdown on multiple explosions (recursion maybe?)
//  Refactor rondom creation method(s)
//  Refactor destroy methods
//  Depth constants
//
//  Medium:
//   Add explosion/fire particles
//   Add ghost/death animation
//
// Major:
//  Cloud with lightning
//  Remove physics (bodies?) entirely to try to solve performance issues
//  Try/optimize for mobile device
//
// Super Major
//  Saves, replays, and ghosts
//

const TARGET_FPS = 50;

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const BOX_SIZE = 50;
const MISSILE_WIDTH = 30;
const GAME_WIDTH_IN_BOXES = GAME_WIDTH/BOX_SIZE;
const EXPLOSION_SIZE = 178;
const BIG_EXPLOSION_SIZE = 250;
const FOREGROUND_WATER_TILE_WIDTH = 80;
const FOREGROUND_WATER_TILE_HEIGHT = 40;
const BACKGROUND_WATER_TILE_WIDTH = 80;
const BACKGROUND_WATER_TILE_HEIGHT = 30;
const CRATE_SPEED = 3;
const SHARK_SPEED = 2;
const METAL_CRATE_SINK_SPEED = .5;
const BOMB_BLINK_FRAMES = 34;
const BOMB_BLINK_STATES = 5;
const SCORE_PER_FRAME = .5

const MISSILE_SPEED = 4;

// Combined, these make for a minimum jump height of ~60 pixels (1 box) and max
// of ~160 pixels (3 box), and super jump around 260 pixels (5 boxes)
const PLAYER_GRAVITY = .45;
const PLAYER_JUMP_SPEED = -12.5;
const PLAYER_JUMP_DRAG = 1.0; 
const PLAYER_SUPER_JUMP_SPEED = -15;
const PLAYER_WALK_SPEED = 5;

const PLAYER_SIZE = [23, 38];
const PLAYER_DISPLAY_SIZE = [29, 48];
const PLAYER_OFFSET = [4, 10]

const PLAYER_DASH_SIZE = [23, 25];
const PLAYER_DASH_DISPLAY_SIZE = [PLAYER_DISPLAY_SIZE[0], PLAYER_DASH_SIZE[1] + 5];
const PLAYER_DASH_OFFSET = [4, 15]

const PLAYER_VERTICAL_KILL_THRESHOLD = 10;
const PLAYER_HORIZONTAL_KILL_THRESHOLD = 16;

const PLAYER_DASH_SPEED = 10
const PLAYER_DASH_FRAMES = 15
const PLAYER_DASH_RECHARGE_FRAMES = 30


var config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: "game_div",
    fps: {
        target: TARGET_FPS,
        min: TARGET_FPS,

        forceSetTimeOut: true
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 1000 },
            debug: false,
            forceX: true
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};
var physics;


var game = new Phaser.Game(config);

var score = 0;
var screenText;

function preload () {
    this.load.setBaseURL('../static/images/cold_waters');
    this.load.image('background', 'ice_mountain_bg.png');
    this.load.image('water', 'water_surface_tile.png');
    this.load.image('plain_crate', 'plain_crate.png');
    this.load.image('metal_crate', 'metal_crate.png');
    this.load.image('star', 'star.png');
    this.load.image('bomb', 'bomb.png');
    this.load.image('splinter', 'splinter2.png');
    this.load.image('shark_fin', 'shark_fin.png');
    this.load.image('missile', 'missile.png');
    this.load.spritesheet('dude', 'onion_dude.png', { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet('plain_crate_destroyed', 'plain_crate_destroyed_sheet.png', { frameWidth: 250, frameHeight: 250 });
    this.load.spritesheet('dude_dash', 'onion_dude_dash.png', { frameWidth: 32, frameHeight: 29 });
    this.load.spritesheet('bomb_crate', 'bomb_crate_sheet.jpg', { frameWidth: 99, frameHeight: 100 });
    this.load.spritesheet('explosion', 'explosion_sheet.png', { frameWidth: 89, frameHeight: 89 });
    physics = this.physics;
}

function create () {
    this.add.image(400, 300, 'background');

    this.anims.create({
	key: 'left',
	frames: this.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
	frameRate: 10,
	repeat: -1
    });

    this.anims.create({
	key: 'turn',
	frames: [ { key: 'dude', frame: 4 } ],
	frameRate: 20
    });

    this.anims.create({
	key: 'dash_right',
	frames: [ { key: 'dude_dash', frame: 0 } ],
	frameRate: 20
    });

    this.anims.create({
	key: 'dash_downward',
	frames: [ { key: 'dude_dash', frame: 1 } ],
	frameRate: 20
    });

    this.anims.create({
	key: 'right',
	frames: this.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
	frameRate: 10,
	repeat: -1
    });

    this.anims.create({
	key: 'explosion',
	frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 9 }),
	frameRate: 20,
	repeat: -1
    });

    for (var i=0;i<6;i++) {
        this.anims.create({
            key: 'bomb_crate_'+i,
            frames: [ { key: 'bomb_crate', frame: i } ],
            frameRate: 20
        });
    }

    for (var i=0;i<4;i++) {
        this.anims.create({
            key: 'plain_crate_destroyed_'+i,
            frames: [ { key: 'plain_crate_destroyed', frame: i } ],
            frameRate: 20
        });
    }

    for (var i=0;i<10;i++) {
        this.anims.create({
            key: 'explosion_'+i,
            frames: [ { key: 'explosion', frame: i } ],
            frameRate: 20
        });
    }

    cursors = this.input.keyboard.createCursorKeys();
    debug_key = this.input.keyboard.addKey('D');

    screenText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#000' });
    screenText.setDepth(100);

    newGame(this);
}

function newGame(this_thing, last_game_controls_array) {
    // Remove old bodies
    this.physics.world.staticBodies.each(function (object) {
        object.gameObject.destroy(true);
    });

    game.seed = "0";

    seed_random(game.seed);

    background_water = this_thing.physics.add.staticGroup({
	key: 'water',
	repeat: Math.floor(GAME_WIDTH / BACKGROUND_WATER_TILE_WIDTH) + 1,
	setXY: { x: -BACKGROUND_WATER_TILE_WIDTH/2, y: GAME_HEIGHT-35, stepX: 80 },
        active: false
    });
    background_water.children.iterate(function (water_tile) {
        water_tile.setSize(1, 1);
        water_tile.setDisplaySize(BACKGROUND_WATER_TILE_WIDTH, BACKGROUND_WATER_TILE_HEIGHT);
        water_tile.setOrigin(undefined,.7);
        water_tile.setDepth(0);
    });

    splinter_particles = this_thing.add.particles('splinter');
    splinter_emitter = splinter_particles.createEmitter();

    splinter_emitter.setPosition(400, 300);
    splinter_emitter.setSpeed(600);
    splinter_emitter.setLifespan(1000);
    splinter_emitter.setScale(0.5);
    splinter_emitter.setGravityY(1000);
    splinter_emitter.stop();

    crates = this_thing.physics.add.staticGroup();
    destroyed_crates = this_thing.physics.add.staticGroup();
    explosions = this_thing.physics.add.staticGroup();
    metal_crates = this_thing.physics.add.staticGroup();
    shark_fins = this_thing.physics.add.staticGroup();
    missiles = this_thing.physics.add.staticGroup();
    explodables = this_thing.physics.add.staticGroup();

    boundaries = this_thing.physics.add.staticGroup();
    boundary = boundaries.create(-10,GAME_HEIGHT/2);
    boundary.setSize(20, GAME_HEIGHT);
    boundary.visible = false;

    boundary = boundaries.create(GAME_WIDTH + 10, GAME_HEIGHT/2);
    boundary.setSize(20, GAME_HEIGHT);
    boundary.visible = false;

    boundary = boundaries.create(GAME_WIDTH/2, -10);
    boundary.setSize(GAME_WIDTH, 20);
    boundary.visible = false;


    plain_crates = this_thing.physics.add.staticGroup({
	key: 'plain_crate',
	repeat: GAME_WIDTH_IN_BOXES - 5,
	setXY: { x: 2*BOX_SIZE + BOX_SIZE/2, y: 590, stepX: BOX_SIZE }
    });
    plain_crates.children.iterate(function (crate) {
        initialize_plain_crate(crate)
    });

    bomb_crates = this_thing.physics.add.staticGroup();

    players = this_thing.physics.add.staticGroup();

    player = players.create(GAME_WIDTH/2, GAME_HEIGHT/2, 'dude');
    player.setSize(...PLAYER_SIZE);
    player.setDisplaySize(...PLAYER_DISPLAY_SIZE);
    player.setOffset(...PLAYER_OFFSET)

    player.myVelY = 0;
    player.grounded = false;
    player.dash_start_frame = -100;
    player.dashing = false;
    player.grounded_since_dash = true;
    player.score = 0;

    player.controlled_by = 'human'
    player.controls_array = [];
    player.setDepth(9);

    if (last_game_controls_array) {
        player_ghost = players.create(GAME_WIDTH/2, GAME_HEIGHT/2, 'dude');
        player_ghost.setSize(...PLAYER_SIZE);
        player_ghost.setDisplaySize(...PLAYER_DISPLAY_SIZE);
        player_ghost.setOffset(...PLAYER_OFFSET)

        player_ghost.myVelY = 0;
        player_ghost.grounded = false;
        player_ghost.dash_start_frame = -100;
        player_ghost.dashing = false;
        player_ghost.grounded_since_dash = true;
        player_ghost.score = 0;

        player_ghost.controlled_by = 'last_game'
        player_ghost.controls_array = last_game_controls_array;
        console.log("Ghost has frame number: "+last_game_controls_array.length);

        player_ghost.setAlpha(.8);
        player_ghost.setTint(0xffff55);
        player_ghost.setDepth(8);
    }

    foreground_water = this_thing.physics.add.staticGroup({
	key: 'water',
	repeat: Math.floor(GAME_WIDTH / FOREGROUND_WATER_TILE_HEIGHT),
	setXY: { x: -FOREGROUND_WATER_TILE_WIDTH, y: GAME_HEIGHT+8, stepX: FOREGROUND_WATER_TILE_WIDTH },
        active: false
    });
    foreground_water.children.iterate(function (water_tile) {
        water_tile.setSize(1, 1);
        water_tile.setDisplaySize(FOREGROUND_WATER_TILE_WIDTH, FOREGROUND_WATER_TILE_HEIGHT);
        water_tile.setOrigin(undefined,1.2);
        water_tile.setDepth(20);
    });

    water_group = this_thing.physics.add.staticGroup({});
    water = water_group.create(GAME_WIDTH/2, GAME_HEIGHT - 10);
    water.visible = false;
    water.setSize(GAME_WIDTH, 20);

    game.restarted_at_frame = game.getFrame();
}

function update () {
    if (debug_key.isDown) {
        this.physics.debug = !this.physics.debug;
        this.physics.world.staticBodies.each(function (body) {
            body.gameObject.setDebug(this.physics.debug, this.physics.debug);
        });
    }

    players.children.each(function(p) {
        player_update(p);
    });

    foreground_water.children.iterate(function (water_tile) {
        water_tile.x += Math.sin(getFrame() / 50) / 2
    });
    background_water.children.iterate(function (water_tile) {
        water_tile.x -= Math.sin(getFrame() / 50) / 2
    });
    crates.children.each(function (crate) {
        crate.grounded = false;
        if (crate.texture.key == "metal_crate" && checkOverlap(crate, water)) {
            crate.body.y += METAL_CRATE_SINK_SPEED;
            crate.y += METAL_CRATE_SINK_SPEED;
        } else {
            crate.body.y += CRATE_SPEED;
            crate.y += CRATE_SPEED;
        }
            
        checkOverlap(crate, water)
        players.children.each(function(p) {
            for (var i=0; i<5; i++) {
                if (checkOverlap(crate, p)) {
                    p.y += CRATE_SPEED;
                    p.body.y += CRATE_SPEED;
                }
            }
        });

        for (var i=0; i<5; i++) {
            if (!(crate.texture.key != "metal_crate" && checkOverlap(crate, water)) && !checkOverlap(crate, crates))
                break;
            crate.grounded = true;
            crate.grounded_at_frame = crate.grounded_at_frame || getFrame()
            crate.body.y -= 1;
            crate.y -= 1;
        }
    });
    bomb_crates.children.each(function(bomb_crate) {
        if (bomb_crate.active && bomb_crate.grounded_at_frame) {
            var frames_since = getFrame() - bomb_crate.grounded_at_frame
            var frame = Math.floor( frames_since / BOMB_BLINK_FRAMES) + 1;
            if (frames_since % BOMB_BLINK_FRAMES == 0) {
                bomb_crate.anims.play('bomb_crate_'+BOMB_BLINK_STATES);
            } else if (frame < BOMB_BLINK_STATES)
                bomb_crate.anims.play('bomb_crate_'+frame);
            else
                bomb_crate.myDestroy(bomb_crate);
        }
    });
    explosions.children.each(function(explosion) {
        if (explosion.active) {
            var frames_since = getFrame() - explosion.created_at;
            var frame = Math.floor( frames_since / 2);

            if (frame < 9 && frame > 1)
                destroy_in_radius(explosion.x, explosion.y, explosion.getBounds().width/2);

            if (frame < 10)
                explosion.anims.play('explosion_'+frame);
            else {
                explosion.destroy(true);
            }
        }
    });
    shark_fins.children.each(function (shark_fin) {
        shark_fin.x += shark_fin.myVelX;
        shark_fin.body.x += shark_fin.myVelX;
        prev_offset = shark_fin.body.offset
        y_diff = Math.sin(shark_fin.x/50)/2
        shark_fin.setOffset(prev_offset.x, prev_offset.y + y_diff)
        shark_fin.y -= y_diff
        shark_fin.body.y -= y_diff
        var collision = checkOverlap(shark_fin, explodables);
        if (collision)
            collision.myDestroy(collision);
    });

    missiles.children.each(function(missile) {
        missile.y += MISSILE_SPEED
        missile.body.y += MISSILE_SPEED
        missile.angle += Math.sin(missile.y/30)
        var collision = checkOverlap(missile, crates) || checkOverlap(missile, water) || checkOverlap(missile, player)
        if (collision) {
            missile.myDestroy(missile);
        }
    });

    destroyed_crates.children.each(function(destroyed_crate) {
        destroyed_crate.myVelY += PLAYER_GRAVITY;
        destroyed_crate.myVelY *= .97;
        destroyed_crate.myVelX *= .97;
        destroyed_crate.y += destroyed_crate.myVelY
        destroyed_crate.body.y += destroyed_crate.myVelY
        destroyed_crate.x += destroyed_crate.myVelX
        destroyed_crate.body.x += destroyed_crate.myVelX
        destroyed_crate.angle += destroyed_crate.angular_velocity;
    });
    // Stuff to destroy
    this.physics.world.staticBodies.each(function (object) {
        if (object.x > GAME_WIDTH + 150 || object.x < -150 || object.y > GAME_HEIGHT + 50 || object.y < -BOX_SIZE * 2) {
            object.gameObject.destroy(true);
        }
    });
    /*
    splinter_emitter.forEachAlive(function (particle) {
        particle.rotation += 10;
        //particle.accelerationY -= 10;
    });
    */
    randomSpawns();
    var text = "Score: "+Math.floor(player.score);
    if (config.physics.arcade.debug) {
        text += "\nGame seed: " + game.seed;
        text += '\nFPS: ' + game.loop.actualFps;
        text += "\nObjects: " + object_count();
        text += "\nCrates: " + crates.countActive();
    }
    if (!player.active)
        text += "\nPress LEFT + RIGHT to play again!";
    screenText.setText(text);

    if (!player.active && cursors.left.isDown && cursors.right.isDown)
        newGame(this, player.controls_array);
}

function checkOverlap(spriteA, spriteB) {
    if (spriteB.type.includes("Group")) {
        var result = false;
        spriteB.children.iterate(function(child) {
           result = result || checkOverlap(spriteA, child); 
        });
        return result;
    } else {
        if (spriteA.active && spriteB.active && Phaser.Geom.Intersects.RectangleToRectangle(spriteA.body.getBounds({}), spriteB.body.getBounds({})) && spriteA != spriteB)
            return spriteB;
        else
            return false;
    }
}

function randomSpawns() {
    if (random_between(0,50) == 0) {
        var crate = initialize_plain_crate(plain_crates.create(random_x,-BOX_SIZE, 'plain_crate'))
    
        for (var i=0; i<5; i++) {
            var random_x = random_between(1,GAME_WIDTH_IN_BOXES*2 - 3) * BOX_SIZE/2 + 1
            crate.body.x = random_x
            crate.x = random_x + BOX_SIZE/2
            if (!checkOverlap(crate, crates))
                return;
        }
        // No space found for it. Destroy
        crate.destroy(true);
    }
    if (random_between(0,100) == 0) {
        var crate = initialize_bomb_crate(bomb_crates.create(random_x,-BOX_SIZE, 'bomb_crate'))
    
        for (var i=0; i<5; i++) {
            var random_x = random_between(1,GAME_WIDTH_IN_BOXES*2 - 3) * BOX_SIZE/2 + 1
            crate.body.x = random_x
            crate.x = random_x + BOX_SIZE/2
            if (!checkOverlap(crate, crates))
                return;
        }
        // No space found for it. Destroy
        crate.destroy(true);
    }
    if (random_between(0,100) == 0) {
        var crate = initialize_metal_crate(metal_crates.create(random_x,-BOX_SIZE, 'metal_crate'))
    
        for (var i=0; i<5; i++) {
            var random_x = random_between(1,GAME_WIDTH_IN_BOXES*2 - 3) * BOX_SIZE/2 + 1
            crate.body.x = random_x
            crate.x = random_x + BOX_SIZE/2
            if (!checkOverlap(crate, crates))
                return;
        }
        // No space found for it. Destroy
        crate.destroy(true);
    }
    if (random_between(0,400) == 0) {
        var missile = initialize_missile(missiles.create(random_x, -BOX_SIZE, 'missile'))
    
        for (var i=0; i<5; i++) {
            var random_x = random_between(1,GAME_WIDTH_IN_BOXES*2 - 3) * BOX_SIZE/2 + 1
            missile.body.x = random_x
            missile.x = random_x + BOX_SIZE/2
            if (!checkOverlap(missile, crates))
                return;

        }
        // No space found for it. Destroy
        crate.destroy(true);
    }
    if (shark_fins.countActive() == 0 && random_between(0, 100) == 0 && crates.countActive() > 40) {
        initialize_shark_fin()
    }
}

function object_count() {
    return this.physics.world.staticBodies.entries.length;
}

function random_between(x, y) {
    return Phaser.Math.RND.between(x, y);
}

// Seed must be a string
function seed_random(seed) {
    // The string has to be in a list for some reason?
    return Phaser.Math.RND.init([seed]);
}

function initialize_missile(missile) {
    missile.setSize(BOX_SIZE/2 - 1,MISSILE_WIDTH*1.3);
    missile.setDisplaySize(MISSILE_WIDTH,MISSILE_WIDTH*1.3);
    //missile.syncBounds = true;
    missile.setOrigin(.9,.5)
    missiles.add(missile);
    explodables.add(missile);
    missile.myDestroy = missile_crate_destroy
    missile.setDepth(10);
    return missile;
}

function initialize_shark_fin() {
    var side = random_between(0,1);
    var shark_fin = shark_fins.create(side * GAME_WIDTH, GAME_HEIGHT - 20, "shark_fin");
    shark_fin.flipX = !side;
    shark_fin.setSize(10,20);
    shark_fin.created_at = getFrame();
    shark_fin.myVelX = SHARK_SPEED * (side * -2 + 1)
    shark_fin.setDepth(15);
}

function initialize_plain_crate(crate) {
    crate.setSize(BOX_SIZE-1,BOX_SIZE-1);
    crate.setDisplaySize(BOX_SIZE,BOX_SIZE);
    crate.syncBounds = true;
    crates.add(crate);
    explodables.add(crate);
    crate.myDestroy = plain_crate_destroy
    crate.setDepth(10);
    if (random_between(0,1) == 1)
        crate.flipX = true;
    return crate;
}
function initialize_metal_crate(crate) {
    crate.setSize(BOX_SIZE-1,BOX_SIZE-1);
    crate.setDisplaySize(BOX_SIZE,BOX_SIZE);
    crate.syncBounds = true;
    crates.add(crate);
    crate.myDestroy = generic_destroy
    crate.setDepth(10);
    if (random_between(0,1) == 1)
        crate.flipX = true;
    return crate;
}
function initialize_bomb_crate(bomb_crate) {
    initialize_plain_crate(bomb_crate);
    bomb_crate.myDestroy = bomb_crate_destroy
    return bomb_crate;
}

function plain_crate_destroy(crate) {
    for (i=0;i<4;i++) {
        piece = destroyed_crates.create(crate.x,crate.y,'plain_crate_destroyed');
        piece.anims.play('plain_crate_destroyed_'+i);
        piece.setSize(BOX_SIZE * .75, BOX_SIZE * .75);
        piece.setDisplaySize(BOX_SIZE * .75, BOX_SIZE * .75);
        angle = random_between(0,359);
        piece.angular_velocity = random_between(-10,10);
        piece.myVelY = 15 * Math.sin(angle)
        //piece.myVelY -= 5;
        piece.myVelX = 15 * Math.cos(angle)
        piece.setDepth(19);
        piece.myDestroy = generic_destroy;
    }
    generic_destroy(crate);
}

function generic_destroy(object) {
    object.destroy(true);
    //particles = splinter_emitter.emitParticleAt(object.x, object.y, 2)
}

function bomb_crate_destroy(object) {
    object.destroy(true);
    explosion = explosions.create(object.x, object.y, 'explosion')
    explosion.setSize(EXPLOSION_SIZE, EXPLOSION_SIZE);
    explosion.setDisplaySize(EXPLOSION_SIZE, EXPLOSION_SIZE);
    explosion.created_at = getFrame();
    generic_destroy(object)
}

function missile_crate_destroy(object) {
    object.destroy(true);
    explosion = explosions.create(object.x - 12, object.y + 10, 'explosion') // TODO MAGIC#
    explosion.setSize(BIG_EXPLOSION_SIZE, BIG_EXPLOSION_SIZE);
    explosion.setDisplaySize(BIG_EXPLOSION_SIZE, BIG_EXPLOSION_SIZE);
    explosion.created_at = getFrame();
    generic_destroy(object)
}

function player_destroy(object) {
    /*
    explosion = explosions.create(object.x, object.y, 'explosion')
    explosion.setSize(99, 99);
    explosion.setDisplaySize(99, 99);
    explosion.created_at = getFrame();
    */
    generic_destroy(object)
}

function destroy_in_radius(x, y, radius) {
    explodables.children.each(function (crate) {
        var distance = Phaser.Math.Distance.Between(crate.x, crate.y, x, y);
        if (distance < radius && distance > 0)
            crate.myDestroy(crate);
    });
    players.children.each(function (p) {
        var distance = Phaser.Math.Distance.Between(p.x, p.y, x, y);
        if (distance < radius && distance > 0)
            player_destroy(p);
    });
}

function myTouching(sprite, others, xdelta, ydelta) {
    sprite.x += xdelta;
    sprite.y += ydelta;
    sprite.body.x += xdelta;
    sprite.body.y += ydelta;
    var result = checkOverlap(sprite, others);
    sprite.x -= xdelta;
    sprite.y -= ydelta;
    sprite.body.x -= xdelta;
    sprite.body.y -= ydelta;
    return result;
}

function player_resolve_vertical(p) {
    // Resolve possible collision
    var collision = checkOverlap(p, boundaries) || checkOverlap(p, crates)
    if (collision) {
        raise_delta_y = collision.body.top - p.body.bottom - 1;
        lower_delta_y = collision.body.bottom - p.body.top + 1;

        var kill_threshold = PLAYER_VERTICAL_KILL_THRESHOLD + Math.abs(p.myVelY)


        // Kill if the distance is too great
        if (Math.min(lower_delta_y, -raise_delta_y) > kill_threshold) {
            console.log("Kill threshold was"+kill_threshold);
            console.log("Delta y would have been "+Math.min(lower_delta_y, -raise_delta_y));
            return player_attempt_horizontal_save(p)
        }

        // Resolve in the smaller direction
        if (-raise_delta_y < lower_delta_y) {
            p.body.y += raise_delta_y;
            p.y += raise_delta_y;
            p.myVelY = 0;
            return raise_delta_y;
        } else {
            p.body.y += lower_delta_y;
            p.y += lower_delta_y;
            p.myVelY = 4;
            return lower_delta_y;
        }
    }
    return 0
}

function player_attempt_horizontal_save(p) {
    // Resolve possible collision
    var collision = checkOverlap(p, boundaries) || checkOverlap(p, crates)
    if (collision) {
        left_delta_x = collision.body.left - p.body.right - 1;
        right_delta_x = collision.body.right - p.body.left + 1;

        // Kill if the distance is too great
        if (Math.min(right_delta_x, -left_delta_x) > PLAYER_HORIZONTAL_KILL_THRESHOLD) {
            console.log("Delta x would have been "+Math.min(right_delta_x, -left_delta_x));
            return player_destroy(p);
        }

        // Resolve in the smaller direction
        if (-left_delta_x < right_delta_x) {
            p.body.x += left_delta_x;
            p.x += left_delta_x;
            console.log("Saved with delta X of "+-left_delta_x);
            return left_delta_x;
        } else {
            p.body.x += right_delta_x;
            p.x += right_delta_x;
            console.log("Saved with delta X of "+right_delta_x);
            return right_delta_x;
        }
    }
    return null;
}

function player_shift_to_rounded_position(p) {
    var round_interval = BOX_SIZE / 4
    var offset = (p.x - PLAYER_SIZE[0]/2 - 2) % round_interval;

    if (offset < round_interval/2) {
        if (offset < 2) {
            p.x -= offset;
            p.body.x -= offset;
        } else {
            p.x -= 2;
            p.body.x -= 2;
        }
    } else {
        if (offset > round_interval - 2) {
            p.x += round_interval - offset;
            p.body.x += round_interval - offset;
        } else {
            p.x += 2;
            p.body.x += 2;
        }
    }
}

function player_update(p) {
    if (!p.active) {
        return;
    }

    p.score += SCORE_PER_FRAME;
    var up_press, down_pressed, left_pressed, right_pressed;
    if (p.controlled_by == "human") {
        up_pressed = cursors.up.isDown;
        down_pressed = cursors.down.isDown;
        left_pressed = cursors.left.isDown;
        right_pressed = cursors.right.isDown;
        p.controls_array.push([up_pressed, down_pressed, left_pressed, right_pressed]);
    } else {
        f = getFrame() - 1
        if (f >= p.controls_array.length) {
            player_destroy(p);
            return;
        }
        up_pressed = p.controls_array[f][0]
        down_pressed = p.controls_array[f][1]
        left_pressed = p.controls_array[f][2]
        right_pressed = p.controls_array[f][3]
    }

    p.super_jump_possible = false;

    p.strictly_grounded = myTouching(p, crates, 0, 1)
    p.loosely_grounded = p.strictly_grounded || myTouching(p, crates, 0, 4) || myTouching(p, missiles, 0, 4);

    if (p.dashing) {
        if (getFrame() - p.dash_start_frame >= PLAYER_DASH_FRAMES) {
            if (p.dash_delta[1] > 0)
                p.super_jump_possible = true
            p.dashing = false;
            p.anims.play('turn');
            p.setSize(...PLAYER_SIZE);
            p.setDisplaySize(...PLAYER_DISPLAY_SIZE);
            p.setOffset(...PLAYER_OFFSET)
            p.myVelY = 0;
            player_resolve_vertical(p);
            if (!p.active) //p may have been killed in the resolve
                return
        } else {
            p.x += p.dash_delta[0]
            p.body.x += p.dash_delta[0]
            p.y += p.dash_delta[1]
            p.body.y += p.dash_delta[1]
            
            p.angle += 360 / (PLAYER_DASH_FRAMES - 1) * Math.sign(p.dash_delta[0]+.01)

            p.myVelY = p.dash_delta[1] // Just for collision resolution

            for (var i=0; i<5; i++) {
                var delta_y = player_resolve_vertical(p);
                if (delta_y == 0)
                    break;
            }
            return // Don't do anything more during a dash
        }
    }

    // Jump limits:
    // Shortest jump: 1 box height
    // Tallest jump: 3 boxes height
    if (p.strictly_grounded) {
        p.myVelY = 0;
    } else {
        p.myVelY += PLAYER_GRAVITY;
        if (p.myVelY < 0 && !up_pressed)
            p.myVelY += PLAYER_JUMP_DRAG;
    }

    if (p.loosely_grounded || (p.myVelY > 0 && myTouching(p, missiles, 0, p.myVelY))) {
        p.grounded_since_dash = true;
        if (up_pressed) {
            if (p.super_jump_possible) {
                p.myVelY = PLAYER_SUPER_JUMP_SPEED;
            } else
                p.myVelY = Math.min(PLAYER_JUMP_SPEED, p.myVelY);
        }
    }

    if (left_pressed)
    {
	p.anims.play('left', true);
        if (! p.strictly_grounded) {
            p.anims.setProgress(.25);
            p.anims.stop();
        }
        p.x -= PLAYER_WALK_SPEED; 
        p.body.x -= PLAYER_WALK_SPEED; 
        player_attempt_horizontal_save(p);
    }
    else if (right_pressed)
    {
	p.anims.play('right', true);
        if (! p.strictly_grounded) {
            p.anims.setProgress(.25);
            p.anims.stop();
        }
        p.x += PLAYER_WALK_SPEED;
        p.body.x += PLAYER_WALK_SPEED;
        player_attempt_horizontal_save(p);
    }
    else
    {
	p.anims.play('turn');
        player_shift_to_rounded_position(p);
    }
    if (!p.active)
        return

    if (down_pressed && p.grounded_since_dash /*&& getFrame() - p.dash_start_frame > PLAYER_DASH_RECHARGE_FRAMES*/ && (left_pressed || right_pressed || !p.strictly_grounded)) {
        
        if (left_pressed) {
            p.dash_delta = [-PLAYER_DASH_SPEED, 0]
            p.anims.play('dash_right');
        } else if (right_pressed) {
            p.dash_delta = [PLAYER_DASH_SPEED, 0]
            p.anims.play('dash_right');

        } else {
            p.dash_delta = [0, PLAYER_DASH_SPEED * 1.5]
            p.anims.play('dash_downward');
        }
        p.dashing = true
        p.dash_start_frame = getFrame()
        p.grounded_since_dash = false;
        p.setSize(...PLAYER_DASH_SIZE);
        p.setDisplaySize(...PLAYER_DASH_DISPLAY_SIZE);
        p.setOffset(...PLAYER_DASH_OFFSET)
    }

    // Vertical Velocity enactment
    p.body.y += p.myVelY;
    p.y += p.myVelY;

    for (var i=0; i<5; i++) {
        var delta = player_resolve_vertical(p);
        if (delta == 0)
            break;
    }

    // Water hazard:
    if (checkOverlap(p, water))
        player_destroy(p);
}

function getFrame() {
    return game.getFrame() - (game.restarted_at_frame || 0);
}
