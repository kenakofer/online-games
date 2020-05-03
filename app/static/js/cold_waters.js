// Benchmarks:
//  My phone firefox: 25-35 FPS
//
// TODO
// Minor:
//  Shrink box explosion size?
//  Download new recording if hard or seed changes
//  Move background image so score is nicer
// 
//  Bug: Slowdown on multiple explosions (recursion maybe?)
//  Refactor destroy methods
//  Depth constants
//  Refactor update: Maybe use runChildUpdate
//
//  Medium:
//   Add explosion/fire particles
//   Add ghost/death animation
//   Make anomalies cooler
//
// Major:
//  Remove physics (bodies?) entirely to try to solve performance issues
//  Try/optimize for mobile device
//  Powerups
//
const CODE_VERSION = "test_version";

const PLAIN_CRATE_ODDS = 50;
const BOMB_CRATE_ODDS = 100;
const METAL_CRATE_ODDS = 100;
const MISSILE_ODDS = 200;
const UFO_ODDS = 800;
const HARD_FACTOR = .5;

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
const UFO_SPEED = 2;
const METAL_CRATE_SINK_SPEED = .5;
const BOMB_BLINK_FRAMES = 34;
const BOMB_BLINK_STATES = 5;
const SCORE_PER_FRAME = .5
const UFO_WIDTH = 100
const UFO_HEIGHT = 40

const ELECTRO_BALL_SPEED = 6;
const ELECTRO_BALL_WIDTH = 64;
const ELECTRO_BALL_HEIGHT = 18;

const GHOST_START_ALPHA = .5;
const GHOST_LABEL_START_ALPHA = .8
const GHOST_END_ALPHA = 0;
const GHOST_LABEL_END_ALPHA = .2


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


var httpRequest;
var received_controls_recording;
var ufo_random; 
var particle_random = new Phaser.Math.RandomDataGenerator(["0"])

var config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: "game_div",
    fps: {
        target: TARGET_FPS + 2,
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

function preload () {
    this.load.setBaseURL('../static/images/cold_waters');
    //this.load.text('current_source_code', '../../../static/js/cold_waters.js');
    this.load.image('background', 'ice_mountain_bg.png');
    this.load.image('water', 'water_surface_tile.png');
    this.load.image('plain_crate', 'plain_crate.png');
    this.load.image('metal_crate', 'metal_crate.png');
    this.load.image('star', 'star.png');
    this.load.image('bomb', 'bomb.png');
    this.load.image('splinter', 'splinter2.png');
    this.load.image('clove', 'clove.png');
    this.load.image('shark_fin', 'shark_fin.png');
    this.load.image('missile', 'missile.png');
    this.load.image('ufo', 'ufo.png');
    this.load.spritesheet('dude', 'onion_dude.png', { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet('plain_crate_destroyed', 'plain_crate_destroyed_sheet.png', { frameWidth: 250, frameHeight: 250 });
    this.load.spritesheet('dude_dash', 'onion_dude_dash.png', { frameWidth: 32, frameHeight: 29 });
    this.load.spritesheet('bomb_crate', 'bomb_crate_sheet.jpg', { frameWidth: 99, frameHeight: 100 });
    this.load.spritesheet('explosion', 'explosion_sheet.png', { frameWidth: 89, frameHeight: 89 });
    this.load.spritesheet('electro_ball', 'electro_ball.png', { frameWidth: 128, frameHeight: 35 });

    game.seed = ""+(new Date).getTime() % 10;
    game.hard = 0;
    this.load.json('best_recording', 'https://games.gc.my/cold_waters/get_best_recording/'+CODE_VERSION+'/'+game.seed+'/'+game.hard)
    physics = this.physics;
}

function create () {
    this.add.image(GAME_WIDTH/2, GAME_HEIGHT/2, 'background');

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

    this.anims.create({
	key: 'electro_ball',
	frames: this.anims.generateFrameNumbers('electro_ball', { start: 0, end: 5 }),
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

    upperLeftText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#fff' });
    upperLeftText.setShadow(-1, 1, 'rgba(0,0,0)', 0);
    upperLeftText.setDepth(100);

    upperRightText = this.add.text(GAME_WIDTH-120, 9, 'Score: 0', { fontSize: '10px', fill: '#000' });
    upperRightText.setDepth(100);

    game.hard = 0;

    //game.current_source_code = this.cache.text.get('current_source_code');
    //CODE_VERSION = md5(game.current_source_code).slice(0,10)

    newGame(this, decompressRecording(this.cache.json.get('best_recording')));
}

function decompressRecording(recording) {
    recording.controls_array = lzw_decode(recording.controls_array)
    return recording
}

function newGame(this_thing, last_game_controls_recording) {
    // Remove old bodies
    if (received_controls_recording) {
        if (!last_game_controls_recording || received_controls_recording.score >= last_game_controls_recording.score)
            last_game_controls_recording = received_controls_recording;
    }
    this.physics.world.staticBodies.each(function (object) {
        if (object.gameObject.label)
            object.gameObject.label.destroy(true);
        object.gameObject.destroy(true);
    });

    var filepath;

    game.last_game_controls_recording = last_game_controls_recording

    seed_rngs(game.seed);

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
    destroyed_stuff = this_thing.physics.add.staticGroup({defaultKey: 'plain_crate_destroyed'});
    explosions = this_thing.physics.add.staticGroup({defaultKey: 'explosion'});
    metal_crates = this_thing.physics.add.staticGroup({defaultKey: 'metal_crate'});
    shark_fins = this_thing.physics.add.staticGroup({defaultKey: 'shark_fin'});
    missiles = this_thing.physics.add.staticGroup({defaultKey: 'missile'});
    bomb_crates = this_thing.physics.add.staticGroup({defaultKey: 'bomb_crate'});
    ufos = this_thing.physics.add.staticGroup({defaultKey: 'ufo'});
    electro_balls = this_thing.physics.add.staticGroup({defaultKey: 'electro_ball'});
    explodables = this_thing.physics.add.staticGroup();
    electrified_metal_crates = this_thing.physics.add.staticGroup();
    unelectrified_metal_crates = this_thing.physics.add.staticGroup();

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
	defaultKey: 'plain_crate',
	repeat: GAME_WIDTH_IN_BOXES - 5,
	setXY: { x: 2*BOX_SIZE + BOX_SIZE/2, y: 530, stepX: BOX_SIZE }

    });
    plain_crates.children.iterate(function (crate) {
        initialize_plain_crate(crate)
    });


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
    player.controls_recording = {
        code_version: CODE_VERSION,
        name: user_name,
        score: 0,
        controls_array: [],
        hard: game.hard,
        seed: game.seed
    }
    player.setDepth(9);

    if (game.last_game_controls_recording) {
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
        player_ghost.controls_recording = game.last_game_controls_recording;
        console.log("Ghost has score: "+game.last_game_controls_recording.score);

        player_ghost.setAlpha(GHOST_START_ALPHA);
        player_ghost.setDepth(8);
        player_ghost.setDepth(8);

        var label_color, tint_color
        if (game.last_game_controls_recording.name == user_name) {
            label_color = '#dfd';
            tint_color = 0xffff55;
        } else {
            label_color = '#fdd';
            tint_color = 0xff7777;
        }
        player_ghost.setTint(tint_color);
        player_ghost.label = this_thing.add.text(8, 8, game.last_game_controls_recording.name, { fontSize: '15px', fill: label_color });
        player_ghost.label.setAlpha(GHOST_LABEL_START_ALPHA);
        player_ghost.label.setDepth(100);
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

    anomolies = this_thing.physics.add.staticGroup({defaultKey: 'background'});
}

function create_anomoly(this_thing) {
    var shape = this_thing.make.graphics();
    shape.fillStyle(0xffffff);
    shape.fillCircle(0, 0, 66);
    shape.fillPath();
    var mask = shape.createGeometryMask();

    anomoly = anomolies.create(GAME_WIDTH/2, GAME_HEIGHT/2);
    anomoly.setSize(132,132);
    anomoly.setMask(mask);
    anomoly.mask_shape = shape;
    anomoly.setDepth(10000);

    anomoly.mask_shape.x = random_between(0, GAME_WIDTH);
    anomoly.mask_shape.y = GAME_HEIGHT + 100;
}

function update () {
    if (debug_key.isDown) {
        this.physics.debug = !this.physics.debug;
        this.physics.world.staticBodies.iterate(function (body) {
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
    plain_crates.children.iterate(function (crate) {
        crate_step(crate);
    });
    metal_crates.children.iterate(function (crate) {
        if (crate.electrified) {
            redness = particle_random_between(0, 150);
            crate.setTint(Phaser.Display.Color.GetColor(105+redness, 255, 255));
            crate.angle = particle_random_between(-3, 3);
            // Kill player (not ghost)
            if (myTouching(crate, player, 0, 1) || myTouching(crate, player, 0, -1) || myTouching(crate, player, 1, 0) || myTouching(crate, player, -1, 0)) {
                player_destroy(player);
                setElectrified(crate, false);
            }
            if (checkOverlap(crate, water)) {
                setElectrified(crate, false);
                deelectrifyWithinCluster(crate, metal_crates, []);
            } else {
                var other_crate = myTouching(crate, unelectrified_metal_crates, 3, 3);
                if (other_crate)
                    setElectrified(other_crate, true);
                other_crate = myTouching(crate, unelectrified_metal_crates, -3, -3);
                if (other_crate)
                    setElectrified(other_crate, true);
            }
        }
        if (!crate.electrified) {
            crate.setTint(0xffffff);
            crate.angle = 0;
        }
        crate_step(crate);
    });
    bomb_crates.children.each(function(crate) {
        crate.body.x = crate.x - 25
        crate.body.y = crate.y - 25
        if (!crate.active)
            return;
        crate_step(crate);
        if (crate.active && crate.grounded_at_frame) {
            var frames_since = getFrame() - crate.grounded_at_frame
            var frame = Math.floor( frames_since / BOMB_BLINK_FRAMES) + 1;
            if (frames_since % BOMB_BLINK_FRAMES == 0) {
                crate.anims.play('bomb_crate_'+BOMB_BLINK_STATES);
            } else if (frame < BOMB_BLINK_STATES)
                crate.anims.play('bomb_crate_'+frame);
            else
                crate.myDestroy(crate);
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
    shark_fins.children.iterate(function (shark_fin) {
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
    ufos.children.iterate(function (ufo) {
        ufo.x += ufo.myVelX;
        ufo.body.x += ufo.myVelX;
        prev_offset = ufo.body.offset
        y_diff = Math.sin(ufo.x/17) + Math.sin(ufo.x/20)/2
        ufo.angle = Math.sin(ufo.x/8) * 5
        ufo.setOffset(prev_offset.x, prev_offset.y + y_diff)
        ufo.y -= y_diff
        ufo.body.y -= y_diff
        if (ufo.can_shoot && ((ufo.myVelX < 0 && ufo.x < ufo.shoot_at_x) || (ufo.myVelX > 0 && ufo.x > ufo.shoot_at_x))) {
            initialize_electro_ball(ufo.x, ufo.y);
            ufo.can_shoot = false;

        }
    });

    electro_balls.children.each(function (electro_ball) {
        electro_ball.x += electro_ball.myVelX;
        electro_ball.body.x += electro_ball.myVelX;
        electro_ball.y += electro_ball.myVelY;
        electro_ball.body.y += electro_ball.myVelY;
        // Kill the player (not ghosts)
        if (checkOverlap(electro_ball, player)) {
            player_destroy(player)
        }
        var metal_crate = checkOverlap(electro_ball, metal_crates) 
        if (metal_crate) {
            electro_ball.destroy(true);
            setElectrified(metal_crate, true);
        }
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

    destroyed_stuff.children.iterate(function(destroyed_crate) {
        if (destroyed_crate.delay_before_movement) {
            destroyed_crate.delay_before_movement -= 1;
            return;
        }
        destroyed_crate.myVelY += PLAYER_GRAVITY;
        destroyed_crate.myVelY *= .97;
        destroyed_crate.myVelX *= .97;
        myMove(destroyed_crate, destroyed_crate.myVelX, destroyed_crate.myVelY);
        destroyed_crate.angle += destroyed_crate.angular_velocity;
    });
    anomolies.children.each(function(anomoly) {
	if (!player.active)
		return;
	if (anomoly.mask_shape.x < player.x)
	    anomoly.mask_shape.x += 1;
	else
	    anomoly.mask_shape.x -= 1;

	if (anomoly.mask_shape.y < player.y)
	    anomoly.mask_shape.y += 1;
	else
	    anomoly.mask_shape.y -= 1;

	anomoly.body.x = anomoly.mask_shape.x - anomoly.body.width/2
	anomoly.body.y = anomoly.mask_shape.y - anomoly.body.height/2
	if (checkOverlap(anomoly, explosions)) {
            anomoly.mask_shape.scale -= .02;
            if (anomoly.mask_shape.scale < 0)
                anomoly.destroy(true);
	}
    });
    // Stuff to destroy
    this.physics.world.staticBodies.each(function (body) {
        var object = body.gameObject;

        if (object.x > GAME_WIDTH + 150 || object.x < -150 || object.y > GAME_HEIGHT + 50 || object.y < -BOX_SIZE * 2) {
            if (object.texture.key == 'plain_crate_destroyed' || object.texture.key == 'clove') {
                destroyed_stuff.killAndHide(object);
            } else {
                object.destroy(true);
            }
        }
    });
    randomSpawns(this);
    if (getFrame() % 10 == 0) {
        var text = "Score: "+Math.floor(player.score);
        if (!player.active)
            text += "\nPress LEFT + RIGHT to play again!";
        upperLeftText.setText(text);

        upperRightText.setText([
            "Hard mode: " + game.hard,
            "FPS: " + Math.round(game.loop.actualFps * 100) / 100,
            "Objects: " + object_count(),
            "Crates: " + crates.countActive(),
            "Game seed: " + game.seed,
            "Sig: " + CODE_VERSION,
        ].join("\n"))
    }

    if (!player.active && cursors.left.isDown && cursors.right.isDown) {
        game.hard = 0;
        player.controls_recording.score = player.score;

        if (game.last_game_controls_recording && game.last_game_controls_recording.controls_array.length > player.controls_recording.controls_array.length)
            newGame(this, game.last_game_controls_recording);
        else
            newGame(this, player.controls_recording);
        return
    }

    if (!player.active && cursors.up.isDown && cursors.down.isDown) {
        game.hard = 1;
        player.controls_recording.score = player.score;

        if (game.last_game_controls_recording && game.last_game_controls_recording.controls_array.length > player.controls_recording.controls_array.length)
            newGame(this, game.last_game_controls_recording);
        else
            newGame(this, player.controls_recording);
        return
    }
}

function crate_step(crate) {
    if (crate.pause_crate_step) {
        crate.pause_crate_step -= 1;
        return;
    }
    crate.grounded = false;
    if (crate.texture.key == "metal_crate" && checkOverlap(crate, water)) {
        crate.body.y += METAL_CRATE_SINK_SPEED;
        crate.y += METAL_CRATE_SINK_SPEED;
    } else {
        crate.body.y += CRATE_SPEED;
        crate.y += CRATE_SPEED;
    }
        
    players.children.iterate(function(p) {
        for (var i=0; i<5; i++) {
            if (checkOverlap(crate, p)) {
                p.y += CRATE_SPEED;
                p.body.y += CRATE_SPEED;
            }
        }
    });

    var collision = checkOverlap(crate, crates)
    if (!collision && crate.texture.key != "metal_crate")
        collision = checkOverlap(crate, water)
    if (collision) {
        crate.grounded = true;
        crate.grounded_at_frame = crate.grounded_at_frame || getFrame()

        //crate.pause_crate_step = 10;
        raise_delta_y = collision.body.top - crate.body.bottom - 1;
        myMove(crate, 0, raise_delta_y);
    }
    if (crate.y == crate.last_y)
        crate.pause_crate_step = 5;
    crate.last_y = crate.y
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

function setElectrified(metal_crate, value) {
    if (!metal_crate.active)
        return;
    if (value) {
        electrified_metal_crates.add(metal_crate);
        unelectrified_metal_crates.remove(metal_crate);
        metal_crate.electrified = true;
    } else {
        electrified_metal_crates.remove(metal_crate);
        unelectrified_metal_crates.add(metal_crate);
        metal_crate.electrified = false;
    }
}

// For example, get all metal boxes connected to metal box A through metal boxes
function deelectrifyWithinCluster(sprite, group, visited) {
    setElectrified(sprite, false);
    visited.push(sprite);
    group.children.iterate(function(child) {
        if (!visited.includes(child) && isSurroundTouching(sprite, child))
            deelectrifyWithinCluster(child, group, visited);
    });
    return visited
}

function isSurroundTouching(spriteA, spriteB) {
    bounds1 = spriteA.body.getBounds({});
    bounds1.x -= 4;
    bounds1.y -= 4;
    bounds1.width += 8;
    bounds1.width += 8;
    return (spriteA.active && spriteB.active && Phaser.Geom.Intersects.RectangleToRectangle(bounds1, spriteB.body.getBounds({})) && spriteA != spriteB)
}

function randomSpawns(this_thing) {
    var hard_factor = 1 - (game.hard * HARD_FACTOR)
    if (random_between(0,PLAIN_CRATE_ODDS * hard_factor) == 0) {
        var crate = initialize_plain_crate(plain_crates.create(0,-BOX_SIZE))
        move_to_empty_top_spot(crate); 
    }
    if (random_between(0,BOMB_CRATE_ODDS * hard_factor) == 0) {
        var crate = initialize_bomb_crate(bomb_crates.get(), 0, -BOX_SIZE);
        move_to_empty_top_spot(crate); 
    }
    if (random_between(0,METAL_CRATE_ODDS * hard_factor) == 0) {
        var crate = initialize_metal_crate(metal_crates.create(0,-BOX_SIZE))
        move_to_empty_top_spot(crate); 
    }
    if (random_between(0,MISSILE_ODDS * hard_factor) == 0) {
        var missile = initialize_missile(missiles.create(0, -BOX_SIZE))
        move_to_empty_top_spot(missile); 
    }
    if (shark_fins.countActive() == 0 && random_between(0, 100) == 0 && crates.countActive() > 35) {
        initialize_shark_fin()
    }
    if (random_between(0,3000 * hard_factor) == 0) {
        create_anomoly(this_thing);
    }
    if (ufo_random_between(0, UFO_ODDS * hard_factor) == 0) {
        initialize_ufo()
    }
}

function move_to_empty_top_spot(object) {
    for (var i=0; i<5; i++) {
        var random_x = random_between(1,GAME_WIDTH_IN_BOXES*2 - 3) * BOX_SIZE/2 + 1
        object.body.x = random_x
        object.x = random_x + BOX_SIZE/2
        if (!checkOverlap(object, crates))
            return;

    }
    // No space found for it. Destroy
    object.destroy(true);
}

function object_count() {
    return this.physics.world.staticBodies.entries.length;
}

function random_between(x, y) {
    return Phaser.Math.RND.between(x, y);
}

function particle_random_between(x, y) {
    return particle_random.between(x, y);
}

function ufo_random_between(x, y) {
    return ufo_random.between(x, y);
}

// Seed must be a string
function seed_rngs(seed) {
    // The string has to be in a list for some reason?
    ufo_random = new Phaser.Math.RandomDataGenerator([seed])
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

function initialize_ufo() {
    var side = ufo_random_between(0,1);
    var ufo = ufos.create(side * GAME_WIDTH, 40);
    ufo.setSize(UFO_WIDTH,UFO_HEIGHT);
    ufo.setDisplaySize(UFO_WIDTH,UFO_HEIGHT);
    ufo.created_at = getFrame();
    ufo.myVelX = UFO_SPEED * (side * -2 + 1)
    ufo.can_shoot = true;
    ufo.shoot_at_x = ufo_random_between(10, GAME_WIDTH - 10)
    ufo.setDepth(15);
}

function initialize_electro_ball(x, y) {
    var electro_ball = electro_balls.create(x, y);
    electro_ball.anims.play('electro_ball');
    electro_ball.setSize(5, 5);
    electro_ball.setDisplaySize(ELECTRO_BALL_WIDTH-10, ELECTRO_BALL_HEIGHT);
    electro_ball.created_at = getFrame();
    if (player.active) {
        console.log((y - player.y) + " " + (x - player.x));
        electro_ball.angle = Math.atan2(y - player.y, x - player.x) * 180 / Math.PI;
    } else {
        electro_ball.angle = -90;
    }
    console.log(electro_ball.angle)

    electro_ball.myVelY = -ELECTRO_BALL_SPEED * Math.sin((electro_ball.angle) * Math.PI / 180)
    electro_ball.myVelX = -ELECTRO_BALL_SPEED * Math.cos((electro_ball.angle) * Math.PI / 180)
    electro_ball.setDepth(15);
}

function initialize_plain_crate(crate) {
    crates.add(crate);

    crate.setSize(BOX_SIZE-1,BOX_SIZE-1);
    crate.setDisplaySize(BOX_SIZE,BOX_SIZE);
    crate.syncBounds = true;
    explodables.add(crate);
    crate.myDestroy = plain_crate_destroy
    crate.setDepth(10);
    if (random_between(0,1) == 1)
        crate.flipX = true;
    return crate;
}
function initialize_metal_crate(crate) {
    crates.add(crate);

    crate.setSize(BOX_SIZE-1,BOX_SIZE-1);
    crate.setDisplaySize(BOX_SIZE,BOX_SIZE);
    crate.syncBounds = true;
    crate.myDestroy = generic_destroy
    crate.setDepth(10);
    setElectrified(crate, false);
    if (random_between(0,1) == 1)
        crate.flipX = true;
    return crate;
}
function initialize_bomb_crate(crate, x, y) {
    console.log('bomb!')
    crates.add(crate);
    crate.setVisible(true);
    crate.setActive(true);

    crate.anims.play('bomb_crate_0');
    crate.grounded_at_frame = undefined;
    // dx = x - crate.x;
    // dy = y - crate.y;
    // crate.x += dx;
    // crate.body.x += dx;
    // crate.y += dy;
    // crate.body.y += dy;
    crate.x = x
    crate.y = y
    crate.body
    crate.body.x = crate.x - 25
    crate.body.y = crate.y - 25


    //crate.body.x = crate.x - BOX_SIZE/2
    //crate.body.y = crate.y - BOX_SIZE/2

    crate.setSize(BOX_SIZE-1,BOX_SIZE-1);
    crate.setDisplaySize(BOX_SIZE,BOX_SIZE);
    //crate.syncBounds = true;
    explodables.add(crate);
    crate.myDestroy = plain_crate_destroy
    crate.setDepth(10);
    if (random_between(0,1) == 1)
        crate.flipX = true;
    crate.myDestroy = bomb_crate_destroy
    return crate;
}

function plain_crate_destroy(crate) {
    for (i=0;i<4;i++) {
        piece = destroyed_stuff.get(crate.x,crate.y);
        piece.setVisible(true);
        piece.setActive(true);
        piece.body.x = piece.x - piece.body.halfWidth
        piece.body.y = piece.y - piece.body.halfHeight
        //console.log(piece.x + " " + piece.y + " " + piece.body.x + " " + piece.body.y);

        piece.anims.play('plain_crate_destroyed_'+i);
        piece.setSize(BOX_SIZE, BOX_SIZE);
        piece.setDisplaySize(BOX_SIZE, BOX_SIZE);
        angle = particle_random_between(0,359);
        piece.angular_velocity = particle_random_between(-10,10);
        piece.myVelY = 15 * Math.sin(angle)
        //piece.myVelY -= 5;
        piece.myVelX = 15 * Math.cos(angle)
        piece.setDepth(19);
        piece.myDestroy = generic_destroy;
        piece.delay_before_movement = 2;
    }
    generic_destroy(crate);
}

function generic_destroy(object) {
    object.destroy(true);
    //particles = splinter_emitter.emitParticleAt(object.x, object.y, 2)
}

function bomb_crate_destroy(object) {
    //object.destroy(true);
    bomb_crates.killAndHide(object);
    explosion = explosions.create(object.x, object.y)
    explosion.setSize(EXPLOSION_SIZE, EXPLOSION_SIZE);
    explosion.setDisplaySize(EXPLOSION_SIZE, EXPLOSION_SIZE);
    explosion.created_at = getFrame();
    // TODO get rid
    //generic_destroy(object)
}

function missile_crate_destroy(object) {
    object.destroy(true);
    explosion = explosions.create(object.x - 12, object.y + 10) // TODO MAGIC#
    explosion.setSize(BIG_EXPLOSION_SIZE, BIG_EXPLOSION_SIZE);
    explosion.setDisplaySize(BIG_EXPLOSION_SIZE, BIG_EXPLOSION_SIZE);
    explosion.created_at = getFrame();
    generic_destroy(object)
}

function player_destroy(p) {
    /*
    explosion = explosions.create(object.x, object.y, 'explosion')
    explosion.setSize(99, 99);
    explosion.setDisplaySize(99, 99);
    explosion.created_at = getFrame();
    */
    if (p.label) {
        p.label.destroy(true);
    }
    for (i=0;i<10;i++) {
        piece = destroyed_stuff.get(p.x,p.y,'clove');
        piece.setTexture('clove');
        piece.setVisible(true);
        piece.setActive(true);
        piece.body.x = piece.x - piece.body.halfWidth
        piece.body.y = piece.y - piece.body.halfHeight

        piece.setSize(30, 15);
        piece.setDisplaySize(30, 15);
        angle = particle_random_between(0,359);
        piece.angular_velocity = particle_random_between(-10,10);
        piece.myVelY = 10 * Math.sin(angle)
        piece.myVelX = 10 * Math.cos(angle)
        piece.setDepth(19);
        piece.myDestroy = generic_destroy;
        if (p.controlled_by != 'human')
            piece.setTint(0xddffdd);
    }

    generic_destroy(p)
    if (p == player) {
        p.controls_recording.score = p.score;
        uploadRecording(player.controls_recording)
    }
}

function uploadRecording(controls_recording) {
    controls_array_string = controls_recording.controls_array.flat().join("")
    //console.log("Original string: " + controls_array_string);
    encoded = lzw_encode(controls_array_string);
    //console.log("Encoded string: " + encoded);
    decoded = lzw_decode(encoded);
    //console.log("Decoded string: " + decoded);
    //console.log("Matches? " + (decoded == controls_array_string));

    object_to_send = {
        code_signature: controls_recording.code_version,
        hard: controls_recording.hard * 1,
        name: controls_recording.name,
        score: controls_recording.score,
        seed: controls_recording.seed,
        controls_array: encoded,
    }

    httpRequest = new XMLHttpRequest(); 
    httpRequest.onload = contentsSent;
    httpRequest.open('POST', 'https://games.gc.my/cold_waters', true);
    httpRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    httpRequest.send('thing='+encodeURIComponent(JSON.stringify({controls_recording: object_to_send})));
}

function contentsSent() {
    console.log('Recording uploaded, I think');
}

function destroy_in_radius(x, y, radius) {
    explodables.children.each(function (crate) {
        if (!crate.active)
            return;
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
    myMove(sprite, xdelta, ydelta);
    var result = checkOverlap(sprite, others);
    myMove(sprite, -xdelta, -ydelta);
    return result;
}

function myMove(sprite, xdelta, ydelta) {
    // I don't think there are any gains to using setPosition
    sprite.x += xdelta
    sprite.y += ydelta
    // Setting the body at once will, I think, only cause internal updates once
    sprite.body.position = {x: sprite.body.x + xdelta, y: sprite.body.y + ydelta};
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
        p.controls_recording.controls_array = p.controls_recording.controls_array.concat([up_pressed*1, down_pressed*1, left_pressed*1, right_pressed*1]);
    } else {
        p.label.setX(p.x - p.label.width/2);
        p.label.setY(p.y - 30);
        f = getFrame() - 1;
        if (f*4 >= p.controls_recording.controls_array.length) {
            player_destroy(p);
            return;
        }
        up_pressed = parseInt(p.controls_recording.controls_array[f*4+0]);
        down_pressed = parseInt(p.controls_recording.controls_array[f*4+1]);
        left_pressed = parseInt(p.controls_recording.controls_array[f*4+2]);
        right_pressed = parseInt(p.controls_recording.controls_array[f*4+3]);


        if (f % 100 == 0) {
            p.setAlpha( (GHOST_START_ALPHA - GHOST_END_ALPHA) * (1 - p.score / p.controls_recording.score) + GHOST_END_ALPHA );
            p.label.setAlpha( (GHOST_LABEL_START_ALPHA - GHOST_LABEL_END_ALPHA) * (1 - p.score / p.controls_recording.score) + GHOST_LABEL_END_ALPHA );
        }
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



// LZW-compress a string
function lzw_encode(s) {
    var dict = {};
    var data = (s + "").split("");
    var out = [];
    var currChar;
    var phrase = data[0];
    var code = 256;
    for (var i=1; i<data.length; i++) {
        currChar=data[i];
        if (dict[phrase + currChar] != null) {
            phrase += currChar;
        }
        else {
            out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
            dict[phrase + currChar] = code;
            code++;
            phrase=currChar;
        }
    }
    out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
    for (var i=0; i<out.length; i++) {
        out[i] = String.fromCharCode(out[i]);
    }
    return out.join("");
}

// Decompress an LZW-encoded string
function lzw_decode(s) {
    var dict = {};
    var data = (s + "").split("");
    var currChar = data[0];
    var oldPhrase = currChar;
    var out = [currChar];
    var code = 256;
    var phrase;
    for (var i=1; i<data.length; i++) {
        var currCode = data[i].charCodeAt(0);
        if (currCode < 256) {
            phrase = data[i];
        }
        else {
           phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
        }
        out.push(phrase);
        currChar = phrase.charAt(0);
        dict[code] = oldPhrase + currChar;
        code++;
        oldPhrase = phrase;
    }
    return out.join("");
}
