// Benchmarks:
//  My phone firefox: 37-45 FPS
//  My phone chrome: 45-50 FPS
//   - More jerk than Firefox
//
// TODO
//
// For next score reset:
//  Change rng check to ghost state check
//
// Minor:
//  flip bomb crates (careful of recycling issues)
//
//  Bug: Slowdown on multiple explosions (recursion maybe?)
//  Refactor destroy methods
//  Depth constants
//  Refactor update: Maybe use runChildUpdate
//
//  Medium:
//   Add explosion/fire particles
//   Make anomalies cooler
//   Dragging between
//   Add username selection screen
//   Add credits screen
//   Store cause of death
//
// Major:
//  Remove physics (bodies?) entirely to try to solve performance issues
//
const CODE_VERSION = "138";

const T_INF_FACTOR = .6; // the time factor in random spawns drops from 1 to this number asymptotically
const T_HALF_LIFE = 3000; // the time factor in random spawns drops halfway to T_INF_FACTOR after this number of frames

const BASE_ODDS_BY_DIFFICULTY = {
    "-1": {
        'plain_crate': 200,
        'bomb_crate': 200,
        'metal_crate': 100,
        'missile': 1000,
        'ufo': 10000,
        'anomoly': 20000,
        'snowflake': 100,
    },
    0: {
        'plain_crate': 100,
        'bomb_crate': 100,
        'metal_crate': 100,
        'missile': 250,
        'ufo': 2000,
        'anomoly': 3000,
        'snowflake': 100,
    },
    1: {
        'plain_crate': 40,
        'bomb_crate': 40,
        'metal_crate': 40,
        'missile': 100,
        'ufo': 800,
        'anomoly': 1200,
        'snowflake': 60,
    }
};

const DELAY_AFTER_DEATH_UNTIL_REPLAY = 50;

const TARGET_FPS = 50;

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const BOX_SIZE = 50;
const CREATION_HEIGHT = -BOX_SIZE*2
const MISSILE_WIDTH = 30;
const GAME_WIDTH_IN_BOXES = GAME_WIDTH/BOX_SIZE;
const EXPLOSION_SIZE = 178;
const BIG_EXPLOSION_SIZE = 230;
const ANOMOLY_RADIUS = 66;
const FOREGROUND_WATER_TILE_WIDTH = 80;
const FOREGROUND_WATER_TILE_HEIGHT = 40;
const BACKGROUND_WATER_TILE_WIDTH = 80;
const BACKGROUND_WATER_TILE_HEIGHT = 30;
const CRATE_SPEED = 3;
const SHARK_SPEED = 2;
const UFO_SPEED = 2;
const METAL_CRATE_SINK_SPEED = .5;
const ANOMOLY_SPEED = 1;
const ANOMOLY_PULSE_INTERVAL = 100;
const BOMB_BLINK_FRAMES = 34;
const BOMB_BLINK_STATES = 5;
const SCORE_PER_FRAME = .5
const UFO_WIDTH = 100
const UFO_HEIGHT = 40
const WARNING_LINE_COLORS = {
    bomb_crate: 0x000000,
    missile: 0xff0000,
    plain_crate: 0xddaa88,
    metal_crate: 0x999999,
    snowflake: 0xffffff,
}

const SHIELD = 0;
const FLYING = 1;
const WATER_WALK = 2;
const SUPER_DASH = 3;

const POWERUP_LENGTH = 500;
const POWERUP_TEXTS = ["Shield", "Flying", "Water Walk", "Super Dash", "Drop Warning"];
const POWERUP_TEXT_COLORS = ["#f77", "#afa", "#aef", "#fe7", "#c66"];
const SNOWFLAKE_TINTS = [0xffaaaa, 0xccffbb, 0xddddff, 0xffddaa, 0xbb5555];

const ELECTRO_BALL_SPEED = 6;
const ELECTRO_BALL_WIDTH = 64;
const ELECTRO_BALL_HEIGHT = 18;

const GHOST_START_ALPHA = .5;
const GHOST_LABEL_START_ALPHA = 1

const MISSILE_SPEED = 4;
const SNOWFLAKE_SPEED = 2;

const SNOWFLAKE_WIND_INTERVAL = 35;
const SNOWFLAKE_WIND_FRAMES = 20;

// Combined, these make for a minimum jump height of ~60 pixels (1 box) and max
// of ~160 pixels (3 box), and super jump around 260 pixels (5 boxes)
const PLAYER_GRAVITY = .45;
const PLAYER_JUMP_SPEED = -12.5;
const PLAYER_JUMP_DRAG = 1.0;
const PLAYER_SUPER_JUMP_SPEED = -15;
const PLAYER_WALK_SPEED = 4;

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
const DEATH_SLEEP_MS = 400;

const SEED_COUNT = 10

var CODE_HASH;
var game_div;
var httpRequest;
var ufo_random;
var anomoly_random;
var particle_random = new Phaser.Math.RandomDataGenerator(["0"])
var virtual_screen_pressed = [
    [false, false, false],
    [false, false, false],
    [false, false, false]
]
var all_local_recordings = [];

var config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: "game_div",
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
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
    },
    render: {
        pixelArt: false
    },
};
var physics;

var game = new Phaser.Game(config);

var score = 0;

function preload () {

    this.load.setBaseURL('../static/images/cold_waters');
    this.load.text('current_source_code', '../../../static/js/cold_waters.js');

    this.load.image('background', 'ice_mountain_bg.jpg');
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
    this.load.image('keyboard_instructions', 'keyboard_instructions.png');
    this.load.spritesheet('fullscreen', 'fullscreen.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('dude', 'onion_dude.png', { frameWidth: 32, frameHeight: 48 });
    this.load.spritesheet('snowflake', 'snowflake.png', { frameWidth: 116, frameHeight: 130 });
    this.load.spritesheet('plain_crate_destroyed', 'plain_crate_destroyed_sheet.png', { frameWidth: 250, frameHeight: 250 });
    this.load.spritesheet('dude_dash', 'onion_dude_dash.png', { frameWidth: 32, frameHeight: 29 });
    this.load.spritesheet('bomb_crate', 'bomb_crate_sheet.jpg', { frameWidth: 99, frameHeight: 100 });
    this.load.spritesheet('explosion', 'explosion_sheet.png', { frameWidth: 89, frameHeight: 89 });
    this.load.spritesheet('electro_ball', 'electro_ball.png', { frameWidth: 128, frameHeight: 35 });
    this.load.json('leader_board_-1', 'https://games.kenakofer.com/onion_ninja/leader_board/'+CODE_VERSION+'/-1')
    this.load.json('leader_board_0', 'https://games.kenakofer.com/onion_ninja/leader_board/'+CODE_VERSION+'/0')
    this.load.json('leader_board_1', 'https://games.kenakofer.com/onion_ninja/leader_board/'+CODE_VERSION+'/1')

    game.seed = (new Date).getTime() % SEED_COUNT;
    game.hard = 0;

    // Load just the one seed/difficult now, load the rest later
    this.load.json('best_recording_'+game.seed+'_'+game.hard, 'https://games.kenakofer.com/onion_ninja/get_best_recording/'+CODE_VERSION+'/'+game.seed+'/'+game.hard)

    physics = this.physics;
}

function pointerdown(pointer) {
    var row, col;
    [row, col] = getRowColPressed(pointer);

    virtual_screen_pressed[row][col] = true;
    //printPressedArray(virtual_screen_pressed);
}

function pointerup(pointer, other) {
    var row, col;
    [row, col] = getRowColPressed(pointer);

    virtual_screen_pressed[row][col] = false;
    //printPressedArray(virtual_screen_pressed);
}

function getRowColPressed(pointer) {
    if (! game_div)
        game_div = Phaser.DOM.GetTarget('game_div');

    var row = 1;
    var col = 1;

    if (pointer.downX < GAME_WIDTH/3)
        col = 0;
    else if (pointer.downX > 2 * GAME_WIDTH/3)
        col = 2;
    else
        col = 1;

    if (pointer.downY < GAME_HEIGHT/3)
        row = 0;
    else if (pointer.downY > 2 * GAME_HEIGHT/3)
        row = 2;
    else
        row = 1;
    return [row, col];
}

function printPressedArray(array) {
    for (var r=0;r<3;r++) {
        console.log(r+": "+array[r].join(" "));
    }
}

function touchStart(pointer) {
    console.log('onTouchStart');
    scene = game.scene.scenes[0]
    console.log(scene.input.pointer1);
    console.log(scene.input.pointer2);
}

function get_leader_board_string(scene) {
    var string = "\nPlayer bests:"
    var leader_board_object = scene.cache.json.get('leader_board_'+game.hard)
    if (!leader_board_object)
        return "Loading...";
    leader_board_object.forEach(function(entry){
        var score_string = (""+Math.floor(entry.score)).padStart(4, '0')
        string += "\n"+score_string+" - "+entry.username
    });
    return string;
}

function get_seed_scores_string(scene) {
    var string = "\nBest in each seed:"
    for (var i=0;i<SEED_COUNT;i++) {
        var recording = scene.cache.json.get('best_recording_'+i+'_'+game.hard)
        if (recording && recording.name) {
            score_string = (""+Math.floor(recording.score)).padStart(4, '0')
            string += '\n'+getSeedString(i)+': '+score_string+" - "+recording.name;
        } else {
            score_string = "0".padStart(4, '0')
            string += '\n'+getSeedString(i)+': '+score_string+' - No one';

        }
        if (game.seed == i) {
            string += " <"
        }
    }
    return string;
}

function create () {

    // Let these load while the user starts playing
    for (var h=-1;h<=1;h++)
        for (var i=0;i<SEED_COUNT;i++)
            this.load.json('best_recording_'+i+'_'+h, 'https://games.kenakofer.com/onion_ninja/get_best_recording/'+CODE_VERSION+'/'+i+'/'+h)
    this.load.start();

    this.add.image(GAME_WIDTH/2, GAME_HEIGHT/2, 'background');
    mobile_lines = [];
    mobile_instructions = [];

    // Desktop (non-mobile stuff
    keyboard_instructions = false;
    if (game.device.os.desktop == true) {
    //if (false) {
        keyboard_instructions = this.add.image(5, 70, 'keyboard_instructions', 0).setOrigin(0,0)
        keyboard_instructions.setDepth(100);
        keyboard_instructions.setDisplaySize(200,160);
    } else {
	// Mobile stuff
        // Mobile button lines
        mobile_lines.push(this.add.line(0,0, 0,GAME_HEIGHT/3, GAME_WIDTH,GAME_HEIGHT/3, 0xffffff, .2).setOrigin(0,0).setDepth(100));
        mobile_lines.push(this.add.line(0,0, 0,2*GAME_HEIGHT/3, GAME_WIDTH,2*GAME_HEIGHT/3, 0xffffff, .2).setOrigin(0,0).setDepth(100));
        mobile_lines.push(this.add.line(0,0, GAME_WIDTH/3,0, GAME_WIDTH/3,GAME_HEIGHT, 0xffffff, .2).setOrigin(0,0).setDepth(100));
        mobile_lines.push(this.add.line(0,0, 2*GAME_WIDTH/3,0, 2*GAME_WIDTH/3,GAME_HEIGHT, 0xffffff, .2).setOrigin(0,0).setDepth(100));

        mobile_instructions.push(this.add.text(40,GAME_HEIGHT/2-40, 'Left', { fontSize: '80px', fill: '#fff' }).setAlpha(.5).setDepth(100));
        mobile_instructions.push(this.add.text(GAME_WIDTH-250,GAME_HEIGHT/2-40, 'Right', { fontSize: '80px', fill: '#fff' }).setAlpha(.5).setDepth(100));
        mobile_instructions.push(this.add.text(GAME_WIDTH/2-90,20, 'Jump', { fontSize: '80px', fill: '#fff' }).setAlpha(.5).setDepth(100));
        mobile_instructions.push(this.add.text(GAME_WIDTH/2-90,GAME_HEIGHT-130, 'Dash', { fontSize: '80px', fill: '#fff' }).setAlpha(.5).setDepth(100));
    }

    replay_instructions = [];
    replay_instructions.push(this.add.text(GAME_WIDTH/6,GAME_HEIGHT/2, 'LEFT\nAgain', { fontSize: '40px', fill: '#fff', align: 'center' }).setAlpha(.7).setDepth(100).setOrigin(.5,.5).setShadow(-2, 2, 'rgba(0,0,0)', 0).setVisible(false));

    seed_scores_text = this.add.text(GAME_WIDTH/6, 5/6*GAME_HEIGHT - 25, get_seed_scores_string(this), { fontSize: '14px', fill: '#fff', backgroundColor: '#233f7a', padding: 15 }).setAlpha(.8).setDepth(100).setOrigin(.5,.5).setShadow(-1,1,'rgba(0,0,0)', 0).setAlpha(.8).setVisible(false);
    seed_scores_header = this.add.text(seed_scores_text.x+seed_scores_text.displayWidth/2+5, seed_scores_text.y-seed_scores_text.displayHeight/2+5, "Easy v129", { fontSize: '12px', fill: '#ff0' }).setAlpha(.8).setDepth(101).setOrigin(1,0).setShadow(-1,1,'rgba(0,0,0)', 0).setAlpha(.8).setVisible(false);

    leader_board_text = this.add.text(5/6*GAME_WIDTH, 5/6*GAME_HEIGHT - 25, get_leader_board_string(this), { fontSize: '14px', fill: '#fff', backgroundColor: '#233f7a', padding: 15 }).setAlpha(.8).setDepth(100).setOrigin(.5,.5).setShadow(-1,1,'rgba(0,0,0)', 0).setAlpha(.8).setVisible(false);
    leader_board_header = this.add.text(leader_board_text.x+leader_board_text.displayWidth/2+5, leader_board_text.y-leader_board_text.displayHeight/2+5, "Easy v129", { fontSize: '12px', fill: '#ff0' }).setAlpha(.8).setDepth(101).setOrigin(1,0).setShadow(-1,1,'rgba(0,0,0)', 0).setAlpha(.8).setVisible(false);


    replay_instructions.push(this.add.text(GAME_WIDTH/2,GAME_HEIGHT/6, 'UP\nHarder', { fontSize: '40px', fill: '#faa', align: 'center' }).setAlpha(.7).setDepth(100).setOrigin(.5,.5).setShadow(-2, 2, 'rgba(0,0,0)', 0).setVisible(false));
    replay_instructions.push(this.add.text(5/6*GAME_WIDTH,GAME_HEIGHT/2, 'RIGHT\nNew seed', { fontSize: '40px', fill: '#fff', align: 'center' }).setAlpha(.7).setDepth(100).setOrigin(.5,.5).setShadow(-2, 2, 'rgba(0,0,0)', 0).setVisible(false));
    replay_instructions.push(this.add.text(GAME_WIDTH/2,5/6*GAME_HEIGHT, 'DOWN\nEasier', { fontSize: '40px', fill: '#afa', align: 'center' }).setAlpha(.7).setDepth(100).setOrigin(.5,.5).setShadow(-2, 2, 'rgba(0,0,0)', 0).setVisible(false));

    // ["Super Dash", "Water Walk", "Flying", "Shield"

    // Maybe move this into the mobile stuff
    scene = game.scene.scenes[0]
    scene.input.on('pointerdown', pointerdown);
    scene.input.on('pointerup', pointerup);
    scene.input.addPointer(1); // Two touch support. Could be more

    if (this.sys.game.device.fullscreen.available) {
        fullscreen_button = this.add.image(GAME_WIDTH-5, 5, 'fullscreen', 0).setOrigin(1, 0).setInteractive();
        fullscreen_button.setDisplaySize(40,40);
        fullscreen_button.setSize(20,20);
        fullscreen_button.setTintFill(0xbbbbff);
        fullscreen_button.setDepth(1);

        fullscreen_button.on('pointerup', function () {

            if (this.scale.isFullscreen)
            {
                fullscreen_button.setFrame(0);

                this.scale.stopFullscreen();
            }
            else
            {
                fullscreen_button.setFrame(1);

                this.scale.startFullscreen();
            }

        }, this);
    }

    snowflake_indicator = this.add.image(25, 5, 'snowflake', 4).setOrigin(.5,0).setDisplaySize(45,50).setVisible(false).setDepth(100);

    super_dash_lines = [];
    var radius = 12;
    var length = PLAYER_DASH_SPEED * PLAYER_DASH_FRAMES;
    super_dash_lines.push(this.add.line(0,0, length/2,0, length-radius,0, 0xaaaa00).setOrigin(0,0).setDepth(90).setVisible(false));
    super_dash_lines.push(this.add.line(0,0, -length/2,0, -length+radius,0, 0xaaaa00).setOrigin(0,0).setDepth(90).setVisible(false));

    super_dash_lines.push(this.add.line(0,0, 0,-length/2, 0,-length+radius, 0xaaaa00).setOrigin(0,0).setDepth(90).setVisible(false));

    super_dash_circles = [];
    super_dash_circles.push(this.add.circle(0,length, radius, 0xaaaa00).setDisplayOrigin(-length+radius,radius).setDepth(90).setVisible(false));
    super_dash_circles.push(this.add.circle(0,-length, radius, 0xaaaa00).setDisplayOrigin(length+radius,radius).setDepth(90).setVisible(false));

    super_dash_circles.push(this.add.circle(-length,0, radius, 0xaaaa00).setDisplayOrigin(radius,length+radius).setDepth(90).setVisible(false));

    powerup_bar_background = this.add.rectangle(0,0, 50,10, 0x222222).setOrigin(0,0).setDepth(91).setVisible(true);
    powerup_bar_foreground = this.add.rectangle(2,2, 46,6, 0xaaaa00).setOrigin(0,0).setDepth(92).setVisible(true);

    unexplodable_circles = [];
    for (var i=0; i<3; i++) {
        unexplodable_circles.push(this.add.circle(0,0, 25).setFillStyle().setStrokeStyle(3, 0xff8888).setDepth(90).setVisible(false));
    }

    this.anims.create({
	key: 'left',
	frames: this.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
	frameRate: 10,
	repeat: -1
    });

    this.anims.create({
	key: 'fly',
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
	key: 'fly_straight',
	frames: this.anims.generateFrameNumbers('dude', { start: 9, end: 10 }),
	frameRate: 20,
	repeat: -1
    });

    this.anims.create({
	key: 'fly_left',
	frames: this.anims.generateFrameNumbers('dude', { start: 11, end: 12 }),
	frameRate: 20,
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

    this.anims.create({
	key: 'snowflake',
	frames: this.anims.generateFrameNumbers('snowflake', { start: 0, end: 3 }),
	frameRate: 15,
	repeat: -1
    });

    this.anims.create({
	key: 'snowflake_marker',
	frames: this.anims.generateFrameNumbers('snowflake', { start: 4, end: 9 }),
	frameRate: 20,
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

    score_text = this.add.text(50, 5, 'Score: 0', { fontSize: '24px', fill: '#fff' }).setShadow(-1, 1, 'rgba(0,0,0)', 0).setDepth(100);
    powerup_text = this.add.text(50, 30, 'Super Dash', { fontSize: '24px', fill: '#ffff00' }).setDepth(100).setOrigin(0,0).setShadow(-2, 2, 'rgba(0,0,0)', 0).setVisible(false);

    upperRightText = this.add.text(GAME_WIDTH-120, 9, 'Score: 0', { fontSize: '10px', fill: '#000' }).setDepth(100).setVisible(false);

    game.hard = 0;

    game.current_source_code = this.cache.text.get('current_source_code');
    CODE_HASH = md5(game.current_source_code).slice(0,10)

    downloaded_ghost = false;

    game.my_best_recording = false;
    player_ghost = false;

    newGame(this);
}

function decompressRecording(recording) {
    if (!recording)
        return undefined;
    recording.controls_array = lzw_decode(recording.controls_array)
    return recording
}

function recording_valid(controls_recording) {
    return (controls_recording && controls_recording.hard == game.hard && controls_recording.seed == game.seed && controls_recording.code_version == CODE_VERSION)
}

function best_recording(recordings, number) {
    number = number || 1;
    var valids = recordings.filter(recording_valid);
    if (valids.length == 0)
        return undefined;

    valids.sort(function(r1, r2) {return r2.score - r1.score}); // Higher scores first
    if (number == 1)
        return valids[0]
    return valids.slice(0,number)
}

function newGame(this_thing) {
    game.myFrame = -1;
    game.frameOfDeath = false;
    scene.scene.resume();

    // Remove old bodies
    scene.physics.world.staticBodies.each(function (object) {
        if (object.gameObject.label)
            object.gameObject.label.destroy(true);
        if (object.gameObject.warning_line)
            object.gameObject.warning_line.destroy(true);
        object.gameObject.destroy(true);
    });

    // Remove old instructions
    replay_instructions.forEach(function(text){
        text.setVisible(false);
    });
    seed_scores_text.setVisible(false);
    seed_scores_header.setVisible(false);
    leader_board_text.setVisible(false);
    powerup_text.setVisible(false);
    leader_board_header.setVisible(false);
    snowflake_indicator.setVisible(false);
    super_dash_lines.forEach(function (line) {
        line.setVisible(false);
    })
    super_dash_circles.forEach(function (circle) {
        circle.setVisible(false);
        circle.setFillStyle();
        circle.setStrokeStyle(2, 0xaaaa00)

    })

    // Make sure we're using the correct recording
    game.downloaded_recording = decompressRecording(scene.cache.json.get('best_recording_'+game.seed+'_'+game.hard))

    if (!recording_valid(game.my_best_recording))
        game.my_best_recording = false;

    var filepath;

    seed_rngs(game.seed);

    background_water = scene.physics.add.staticGroup({
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

    splinter_particles = scene.add.particles('splinter');
    splinter_emitter = splinter_particles.createEmitter();

    splinter_emitter.setPosition(400, 300);
    splinter_emitter.setSpeed(600);
    splinter_emitter.setLifespan(1000);
    splinter_emitter.setScale(0.5);
    splinter_emitter.setGravityY(1000);
    splinter_emitter.stop();

    crates = scene.physics.add.staticGroup();
    destroyed_stuff = scene.physics.add.staticGroup({defaultKey: 'plain_crate_destroyed'});
    explosions = scene.physics.add.staticGroup({defaultKey: 'explosion'});
    metal_crates = scene.physics.add.staticGroup({defaultKey: 'metal_crate'});
    shark_fins = scene.physics.add.staticGroup({defaultKey: 'shark_fin'});
    missiles = scene.physics.add.staticGroup({defaultKey: 'missile'});
    snowflakes = scene.physics.add.staticGroup({defaultKey: 'snowflake'});
    snowflake_markers = scene.physics.add.staticGroup();
    bomb_crates = scene.physics.add.staticGroup({defaultKey: 'bomb_crate'});
    ufos = scene.physics.add.staticGroup({defaultKey: 'ufo'});
    electro_balls = scene.physics.add.staticGroup({defaultKey: 'electro_ball'});
    explodables = scene.physics.add.staticGroup();
    electrified_metal_crates = scene.physics.add.staticGroup();
    unelectrified_metal_crates = scene.physics.add.staticGroup();

    boundaries = scene.physics.add.staticGroup();
    boundary = boundaries.create(-100,GAME_HEIGHT/2);
    boundary.setSize(200, GAME_HEIGHT);
    boundary.visible = false;

    boundary = boundaries.create(GAME_WIDTH + 100, GAME_HEIGHT/2);
    boundary.setSize(200, GAME_HEIGHT);
    boundary.visible = false;

    boundary = boundaries.create(GAME_WIDTH/2, -100);
    boundary.setSize(GAME_WIDTH, 200);
    boundary.visible = false;


    plain_crates = scene.physics.add.staticGroup({
	key: 'plain_crate',
	defaultKey: 'plain_crate',
	repeat: GAME_WIDTH_IN_BOXES - 5,
	setXY: { x: 2*BOX_SIZE + BOX_SIZE/2, y: 530, stepX: BOX_SIZE }

    });
    plain_crates.children.iterate(function (crate) {
        initialize_plain_crate(crate)
    });


    players = scene.physics.add.staticGroup();

    player = players.create(GAME_WIDTH/2, GAME_HEIGHT/2, 'dude');
    player.setSize(...PLAYER_SIZE);
    player.setDisplaySize(...PLAYER_DISPLAY_SIZE);
    player.setOffset(...PLAYER_OFFSET)

    player.myVelY = 0;
    player.grounded = false;
    player.dash_start_frame = -100;
    player.dashing = false;
    player.can_dash = true;
    player.score = 0;
    player.snowflakes = new Set();

    player.controlled_by = 'human'
    player.controls_recording = {
        code_version: CODE_VERSION,
        name: user_name,
        score: 0,
        controls_array: [],
        hard: game.hard,
        seed: game.seed,
        rng_integrity_check: "",
    }
    game.rng_integrity_check = "";
    player.setDepth(9);
    player.powerup_at = [false, false, false, false, false, false];

    // player.super_dash_started_at = -100;
    // player.drop_warning_started_at = -100;

    // TODO this is kind of a mess of logic. It REALLY need some TLC
    //
    // We want to show the best recording that we've gotten locally if it
    // exists, and also show the downloaded recording if it's better than our
    // local best recording
    if (game.downloaded_recording && game.downloaded_recording.name == user_name) {
        var better = best_recording([game.downloaded_recording, game.my_best_recording])
        player_ghost = ghost_from_recording(better, scene);
    } else {
        player_ghost = ghost_from_recording(game.my_best_recording, scene);
        if (game.downloaded_recording && (!game.my_best_recording || game.downloaded_recording.score > game.my_best_recording.score)) {
            downloaded_ghost = ghost_from_recording(game.downloaded_recording, scene);
        }
    }
    // Crazy all ghosts
    recordings = best_recording(all_local_recordings, 10)
    if (recordings && recordings.length % 6 == 0) {
        recordings.forEach(function(recording) {
            if (player_ghost && recording == player_ghost.recording)
                return
            ghost_from_recording(recording, scene);
        });
    }

    foreground_water = scene.physics.add.staticGroup({
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

    water_group = scene.physics.add.staticGroup({});
    water = water_group.create(GAME_WIDTH/2, GAME_HEIGHT + 10);
    water.visible = false;
    water.setSize(GAME_WIDTH, 60);

    anomolies = scene.physics.add.staticGroup({defaultKey: 'background'});
}

function ghost_from_recording(recording, this_thing) {
    if (! recording)
        return false

    ghost = players.create(GAME_WIDTH/2, GAME_HEIGHT/2, 'dude');
    ghost.setSize(...PLAYER_SIZE);
    ghost.setDisplaySize(...PLAYER_DISPLAY_SIZE);
    ghost.setOffset(...PLAYER_OFFSET)

    ghost.myVelY = 0;
    ghost.grounded = false;
    ghost.dash_start_frame = -100;
    ghost.dashing = false;
    ghost.can_dash = true;
    ghost.score = 0;
    ghost.snowflakes = new Set();

    ghost.controlled_by = 'last_game';
    ghost.controls_recording = recording;
    console.log("Ghost has score: "+recording.score);

    ghost.setAlpha(GHOST_START_ALPHA);
    ghost.setDepth(8);
    ghost.powerup_at = [false, false, false, false, false, false];

    var label_color, tint_color, label_text;
    if (recording.name == user_name) {
        label_color = '#dfd';
        tint_color = 0xffff55;
        label_text = recording.name + " (You)"
    } else {
        label_color = '#fdd';
        tint_color = 0xff7777;
        label_text = recording.name
    }
    ghost.setTint(tint_color);
    ghost.label = this_thing.add.text(8, 8, label_text, { fontSize: '15px', fill: label_color });
    ghost.label.setAlpha(GHOST_LABEL_START_ALPHA);
    ghost.label.setDepth(100);
    return ghost;
}

function create_anomoly(this_thing) {
    var shape = this_thing.make.graphics();
    // White circle with radius ANOMOLY_RADIUS with a red border
    shape.fillStyle(0xffffff);
    shape.fillCircle(0, 0, ANOMOLY_RADIUS);
    shape.lineStyle(2, 0xff0000);
    shape.strokeCircle(0, 0, ANOMOLY_RADIUS + 4);

    var mask = shape.createGeometryMask();

    anomoly = anomolies.create(GAME_WIDTH/2, GAME_HEIGHT/2);
    anomoly.setSize(ANOMOLY_RADIUS*2,ANOMOLY_RADIUS*2);
    anomoly.setMask(mask);
    anomoly.mask_shape = shape;
    anomoly.setDepth(50);
    anomoly.setTint(0xff7777);

    anomoly.mask_shape.x = anomoly_random_between(0, GAME_WIDTH); // TODO switch to anomoly_random
    anomoly.mask_shape.y = GAME_HEIGHT + 100;
}

function update () {
    game.myFrame += 1;

    if (debug_key.isDown) {
        upperRightText.setVisible(true);
    }

    if (keyboard_instructions && player.dashing) {
        keyboard_instructions.alpha -= .08;
        if (keyboard_instructions.alpha <= 0)
            keyboard_instructions.destroy(true);
    }
    if (mobile_instructions && player.dashing) {
        for (i in mobile_instructions) {
            mobile_instructions[i].alpha -= .04;
            if (mobile_instructions[i].alpha <= 0)
                mobile_instructions[i].destroy(true);
        }
    }

    players.children.each(function(p) {
        player_update(p);
    });

    foreground_water.children.iterate(function (water_tile) {
        if (player.water_walking_at) {
            water_tile.setTintFill(0xddeeff);
        } else {
            water_tile.clearTint();
            water_tile.x += Math.sin(getFrame() / 50) / 2
        }
    });
    background_water.children.iterate(function (water_tile) {
        if (player.water_walking_at) {
            water_tile.setTintFill(0xccddee);
        } else {
            water_tile.clearTint();
            water_tile.x -= Math.sin(getFrame() / 50) / 2
        }
    });
    plain_crates.children.iterate(function (crate) {
        warning_line_step(crate, WARNING_LINE_COLORS.plain_crate);
        crate_step(crate);
    });
    metal_crates.children.iterate(function (crate) {
        warning_line_step(crate, WARNING_LINE_COLORS.metal_crate);
        if (crate.electrified) {
            redness = particle_random_between(0, 150);
            crate.setTint(Phaser.Display.Color.GetColor(105+redness, 255, 255));
            crate.angle = particle_random_between(-3, 3);
            // Kill player (not ghost)
            if (myTouching(crate, player, 0, 1) || myTouching(crate, player, 0, -1) || myTouching(crate, player, 1, 0) || myTouching(crate, player, -1, 0)) {
                if (!player.unexplodable_at) {
                    player_destroy(player);
                }
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
        warning_line_step(crate, WARNING_LINE_COLORS.bomb_crate);
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
                destroy_in_radius(explosion.x, explosion.y, explosion.getBounds().width/2 - 5);

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
        var collision = checkOverlapGroup(shark_fin, explodables);
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
        if (checkOverlap(electro_ball, player) && !player.unexplodable_at) {
            player_destroy(player)
        }
        var metal_crate = checkOverlapGroup(electro_ball, metal_crates)
        if (metal_crate) {
            electro_ball.destroy(true);
            setElectrified(metal_crate, true);
        }
    });

    missiles.children.each(function(missile) {
        warning_line_step(missile, WARNING_LINE_COLORS.missile);
        missile.y += MISSILE_SPEED
        missile.body.y += MISSILE_SPEED
        missile.angle += Math.sin(missile.y/30)
        var collision = checkOverlapGroup(missile, crates) || checkOverlap(missile, water) || checkOverlap(missile, player)
        if (collision) {
            missile.myDestroy(missile);
            if (collision == player) {
                player_destroy(player); // Regardless of unexplodable (can't change the recording)
            }
        }
    });

    snowflakes.children.each(function(snowflake) {
        warning_line_step(snowflake, WARNING_LINE_COLORS.snowflake);
        snowflake.y += SNOWFLAKE_SPEED
        snowflake.body.y += SNOWFLAKE_SPEED

        if (getFrame() % SNOWFLAKE_WIND_INTERVAL == 0)
            snowflake.wind_enabled = true;

        var cycle = getFrame() % (SNOWFLAKE_WIND_INTERVAL*2)
        snowflake.angle = Math.sin((cycle + 10) / SNOWFLAKE_WIND_INTERVAL * Math.PI)* 10;

        // Wind
        if (snowflake.wind_enabled && getFrame() % SNOWFLAKE_WIND_INTERVAL < SNOWFLAKE_WIND_FRAMES) {
            var dx = BOX_SIZE/2 / SNOWFLAKE_WIND_FRAMES;
            if (cycle < SNOWFLAKE_WIND_INTERVAL)
                dx *= -1;
            snowflake.x += dx;
            snowflake.body.x += dx;
        } else {
            snowflake.angle *= .9;
        }

        var collision = checkOverlapGroup(snowflake, crates) || checkOverlap(snowflake, water) || checkOverlapGroup(snowflake, missiles)
        if (collision) {
            snowflake.myDestroy(snowflake);
        }
    });
    if (snowflake_indicator.lobe_added_at) {
        var f = getFrame() - snowflake_indicator.lobe_added_at;
        if (f > 100) {
            snowflake_indicator.lobe_added_at = false;
            snowflake_indicator.angle = 0;
        } else {
            snowflake_indicator.angle = -Math.sin(.2*f)*100 / (f**.7)
        }
    }

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
        var focus;
        // The fallback focus on player_ghost may not be accurate to original
        if (player.active)
            focus = player;
        else if (player_ghost.active)
            focus = player_ghost;
        else
            return;

        var angle = Math.atan2(anomoly.mask_shape.y - focus.y, anomoly.mask_shape.x - focus.x) * 180 / Math.PI;

        anomoly.myVelY = -ANOMOLY_SPEED * Math.sin(angle * Math.PI / 180)
        anomoly.myVelX = -ANOMOLY_SPEED * Math.cos(angle * Math.PI / 180)

        anomoly.mask_shape.x += anomoly.myVelX;
        anomoly.mask_shape.y += anomoly.myVelY;
        //myMove(anomoly, anomoly.myVelX, anomoly.myVelY);

        anomoly.body.x = anomoly.mask_shape.x - anomoly.body.width/2
        anomoly.body.y = anomoly.mask_shape.y - anomoly.body.height/2
        if (checkOverlapGroup(anomoly, explosions)) {
            anomoly.body.width -= 1;
            anomoly.body.height -= 1;
            anomoly.mask_shape.scale = anomoly.body.width/2 / ANOMOLY_RADIUS
            if (anomoly.body.width <= 60) {
                anomoly.destroy(true);
                return;
            }
        }

        var f = getFrame();

        var brightness = Math.min((f % ANOMOLY_PULSE_INTERVAL)*10, 200)
        anomoly.setTint(Phaser.Display.Color.GetColor(255, 55+brightness, 55+brightness));

        if (f % ANOMOLY_PULSE_INTERVAL == 0 && player.active && !player.unexplodable_at) {
            if (Phaser.Math.Distance.Between(anomoly.mask_shape.x, anomoly.mask_shape.y, player.x, player.y) < anomoly.body.width/2) {
                player_destroy(player);
            }
        }

    });
    // Stuff to destroy
    this.physics.world.staticBodies.each(function (body) {
        var object = body.gameObject;

        if (object.x > GAME_WIDTH + 150 || object.x < -150 || object.y > GAME_HEIGHT + 50 || object.y < -300) {
            if (object.texture.key == 'plain_crate_destroyed' || object.texture.key == 'clove') {
                destroyed_stuff.killAndHide(object);
            } else if (players.children.entries.includes(object)) {
                player_destroy(object);
            } else {
                object.destroy(true);
            }
        }
    });
    randomSpawns(this, 10);

    // RNG integrity check
    if (getFrame() % 10 == 0) {
        var ch = random_between(0,35).toString(36)
        game.rng_integrity_check += ch;
        if (player.active)
            player.controls_recording.rng_integrity_check += ch;
    }

    if (getFrame() % 10 == 0) {
        if (game.frameOfDeath && getFrame() - game.frameOfDeath > DELAY_AFTER_DEATH_UNTIL_REPLAY) {

            if (!seed_scores_text.visible) {
                // Redraw the (possibly old) scores before fetching new ones
                seed_scores_text.setText(get_seed_scores_string(scene));
                refresh_best_recording(game.seed, game.hard);
                seed_scores_text.setVisible(true);
                seed_scores_header.setVisible(true);
                seed_scores_header.setText(['Easy','Normal','Hard'][game.hard+1]+' v'+CODE_VERSION)
                seed_scores_header.setFill(['#6f6','#fc0','#f77'][game.hard+1])
                seed_scores_header.setX(seed_scores_text.x+seed_scores_text.width/2-5)

                // Redraw the (possibly old) scores before fetching new ones
                leader_board_text.setText(get_leader_board_string(scene));
                refresh_leader_boards(game.hard);
                leader_board_text.setVisible(true);
                leader_board_header.setVisible(true);
                leader_board_header.setText(['Easy','Normal','Hard'][game.hard+1]+' v'+CODE_VERSION)
                leader_board_header.setFill(['#6f6','#fc0','#f77'][game.hard+1])
                leader_board_header.setX(leader_board_text.x+leader_board_text.width/2-5)
                leader_board_header.setY(leader_board_text.y-leader_board_text.height/2+5)
            }
            if (getFrame() % 200 == 0) {
                seed_scores_text.setText(get_seed_scores_string(scene));
                seed_scores_header.setX(seed_scores_text.x+seed_scores_text.width/2-5)
                seed_scores_header.setY(seed_scores_text.y-seed_scores_text.height/2+5)

                leader_board_text.setText(get_leader_board_string(scene));
                leader_board_header.setX(leader_board_text.x+leader_board_text.width/2-5)
                leader_board_header.setY(leader_board_text.y-leader_board_text.height/2+5)
            }
            for (var i=0;i<replay_instructions.length;i++) {
                replay_instructions[i].setVisible(true);
                if (Math.floor(getFrame()/10) % 8 == i)
                    replay_instructions[i].setAlpha(.8);
                else
                    replay_instructions[i].setAlpha(.6);
            }
        }
        score_text.setText("Score: "+Math.floor(player.score));

        rng_index = Math.floor(getFrame() / 10);

        rng_ok = true;
        if (player_ghost && player_ghost.active && player_ghost.controls_recording.rng_integrity_check) {
            rng_ok = (game.rng_integrity_check.charAt(rng_index) == player_ghost.controls_recording.rng_integrity_check.charAt(rng_index))
        }

        upperRightText.setText([
            "Hard mode: " + game.hard,
            "FPS: " + Math.round(game.loop.actualFps * 100) / 100,
            "Objects: " + object_count(),
            "Crates: " + crates.countActive(),
            "Game seed: " + game.seed,
            "Sig: " + CODE_VERSION,
            "Hash: " + CODE_HASH,
            "RNG ok? " + rng_ok,
        ].join("\n"))

        if (rng_ok)
            upperRightText.setColor("#000000")
        else {
            upperRightText.setColor("#ff0000")
            upperRightText.setVisible(true);
        }
    }

    if (game.frameOfDeath && getFrame() - game.frameOfDeath > DELAY_AFTER_DEATH_UNTIL_REPLAY &&
        (my_pressed('left') || my_pressed('right') || my_pressed('up') || my_pressed('down'))) {
        player.controls_recording.score = player.score;

        if (my_pressed('left')) {
            // Don't change anything
        } else if (my_pressed('right')) {
            game.seed = (game.seed+1) % SEED_COUNT;
        } else if (my_pressed('up')) {
            game.hard = Math.min(game.hard+1, 1);
        } else if (my_pressed('down')) {
            game.hard = Math.max(game.hard-1, -1);
        }

        all_local_recordings.push(player.controls_recording);
        game.my_best_recording = best_recording([player.controls_recording, game.my_best_recording])
        newGame(this);
        return;
    }
}

function warning_line_step(object, color) {
    if (!object.warning_line) {
        object.warning_line = scene.add.line(object.x,8, 0,0, object.body.width,0, color).setDepth(90);
        object.warning_line.setLineWidth(6);
    }
    if (object.y < -BOX_SIZE/2 + 5 && player.drop_warning_started_at) {
        object.warning_line.setPosition(object.x, 8)
        object.warning_line.setVisible(true);
    } else {
        object.warning_line.setVisible(false);
    }
}

function my_pressed(direction) {
    var value = false;
    switch (direction) {
        case 'up':
            value = cursors.up.isDown || virtual_screen_pressed[0][0] || virtual_screen_pressed[0][1] || virtual_screen_pressed[0][2]
            break;
        case 'down':
            value = cursors.down.isDown || virtual_screen_pressed[2][0] || virtual_screen_pressed[2][1] || virtual_screen_pressed[2][2]
            break;
        case 'left':
            value = cursors.left.isDown || virtual_screen_pressed[0][0] || virtual_screen_pressed[1][0] || virtual_screen_pressed[2][0]
            break;
        case 'right':
            value = cursors.right.isDown || virtual_screen_pressed[0][2] || virtual_screen_pressed[1][2] || virtual_screen_pressed[2][2]
            break;
    }
    return value;
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
        //for (var i=0; i<5; i++) {
            if (checkOverlap(crate, p)) {
                p.y += CRATE_SPEED;
                p.body.y += CRATE_SPEED;
            }
        //}
    });

    var collision = checkOverlap(crate, water)
    if (collision && crate.texture.key == "metal_crate")
        return;
    if (!collision)
        collision = checkOverlapGroup(crate, crates)
    if (collision) {
        crate.grounded = true;
        crate.grounded_at_frame = crate.grounded_at_frame || getFrame()

        //crate.pause_crate_step = 10;
        raise_delta_y = collision.body.top - crate.body.bottom - 1;
        myMove(crate, 0, raise_delta_y);
    }
    if (crate.y == crate.last_y)
        crate.pause_crate_step = 5;

    // One last check, to avaid sink-throughs
    if (collision && crate.y > crate.last_y) {
        collision = checkOverlapGroup(crate, crates)
        if (collision) {
            crate.grounded = true;
            crate.grounded_at_frame = crate.grounded_at_frame || getFrame()

            //crate.pause_crate_step = 10;
            raise_delta_y = collision.body.top - crate.body.bottom - 1;
            myMove(crate, 0, raise_delta_y);
        }
    }

    crate.last_y = crate.y
}

function checkOverlap(spriteA, spriteB) {
    if (spriteA.active && spriteB.active && Phaser.Geom.Intersects.RectangleToRectangle(spriteA.body.getBounds({}), spriteB.body.getBounds({})) && spriteA != spriteB)
        return spriteB;
    else
        return false;
}

function checkOverlapGroup(sprite, group) {
    var result = false;
    group.children.iterate(function(child) {
       result = result || checkOverlap(sprite, child);
    });
    return result;
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

function randomSpawns(this_thing, frequency) {
    if (getFrame() % frequency != 0)
        return;

    if (random_between(0,getOdds('plain_crate')) < frequency) {
        var crate = initialize_plain_crate(plain_crates.create(0,CREATION_HEIGHT))
        move_to_empty_top_spot(crate);
    }
    if (random_between(0,getOdds('bomb_crate')) < frequency) {
        var crate = initialize_bomb_crate(bomb_crates.get(), 0, CREATION_HEIGHT);
        move_to_empty_top_spot(crate);
    }
    if (random_between(0,getOdds('metal_crate')) < frequency) {
        var crate = initialize_metal_crate(metal_crates.create(0,CREATION_HEIGHT))
        move_to_empty_top_spot(crate);
    }
    if (random_between(0,getOdds('missile')) < frequency) {
        var missile = initialize_missile(missiles.create(0, CREATION_HEIGHT))
        move_to_empty_top_spot(missile);
    }
    if (shark_fins.countActive() == 0 && random_between(0, 100) < frequency && crates.countActive() > 35) {
        initialize_shark_fin()
    }
    if (getFrame() > 0 && getFrame() % getOdds('anomoly') < frequency) {
        create_anomoly(this_thing);
    }
    if (ufo_random_between(0,getOdds('ufo')) < frequency) {
        initialize_ufo()
    }
    if (snowflake_random_between(0,getOdds('snowflake')) < frequency) {
        var snowflake = initialize_snowflake(snowflakes.create(0, CREATION_HEIGHT))
        move_to_empty_top_spot(snowflake, snowflake_random);
        snowflake.x += 7;
        snowflake.body.x += 7;
    }
}

function getOdds(type) {
   var time_factor = T_INF_FACTOR + (1-T_INF_FACTOR) * (T_HALF_LIFE / (getFrame() + T_HALF_LIFE))
   return BASE_ODDS_BY_DIFFICULTY[game.hard][type] * time_factor
}

function move_to_empty_top_spot(object, rng) {
    rng = rng || Phaser.Math.RND
    for (var i=0; i<5; i++) {
        var random_x = rng.between(1,GAME_WIDTH_IN_BOXES*2 - 3) * BOX_SIZE/2 + 1
        object.body.x = random_x
        object.x = random_x + BOX_SIZE/2
        if (!checkOverlapGroup(object, crates))
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

function anomoly_random_between(x, y) {
    return anomoly_random.between(x, y);
}

function snowflake_random_between(x, y) {
    return snowflake_random.between(x, y);
}

function seed_rngs(seed) {
    // The string has to be in a list and a string for some reason?
    ufo_random = new Phaser.Math.RandomDataGenerator(["ufo"+seed])
    anomoly_random = new Phaser.Math.RandomDataGenerator(["anomoly"+seed])
    snowflake_random = new Phaser.Math.RandomDataGenerator(["snowflake"+seed])
    return Phaser.Math.RND.init(["main"+seed]);
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

function initialize_snowflake(snowflake) {
    snowflake.whichPowerup = snowflake_random_between(0, SNOWFLAKE_TINTS.length-1);
    snowflake.setTint(SNOWFLAKE_TINTS[snowflake.whichPowerup]);
    snowflake.setSize(10, 10);
    snowflake.setDisplaySize(BOX_SIZE/2 - 1, BOX_SIZE/2 - 1);
    explodables.add(snowflake);
    snowflake.myDestroy = generic_destroy
    snowflake.setDepth(10);
    snowflake.anims.play('snowflake');
    snowflake.setOrigin(1.4, .5);
    snowflake.x += 7;
    snowflake.body.x += 7;
    snowflake.created_at = getFrame();
    snowflake.wind_enabled = false;
    return snowflake;
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
        electro_ball.angle = Math.atan2(y - player.y, x - player.x) * 180 / Math.PI;
    } else if (player_ghost.active) {
        electro_ball.angle = Math.atan2(y - player_ghost.y, x - player_ghost.x) * 180 / Math.PI;
    } else {
        electro_ball.angle = -90;
    }

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
    if (object.warning_line) {
        object.warning_line.destroy(true);
    }
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
    if (p.label) {
        p.label.destroy(true);
    }
    if (p == player) {
        p.controls_recording.score = p.score;
        uploadRecording(player.controls_recording)
        game.frameOfDeath = getFrame();
        /*scene.scene.pause();
        setTimeout(function() {
            scene.scene.resume();
        }, DEATH_SLEEP_MS);*/
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

    // These will get in the way of the replay instructions
    mobile_instructions.forEach(function(text) { text.destroy(true); });

    // This needs to be updated now
    seed_scores_text.setText(get_seed_scores_string(scene));

    generic_destroy(p)
}

function uploadRecording(controls_recording) {
    controls_array_string = controls_recording.controls_array.flat().join("")
    encoded = lzw_encode(controls_array_string);
    decoded = lzw_decode(encoded);

    object_to_send = {
        code_signature: controls_recording.code_version,
        hard: controls_recording.hard * 1,
        name: controls_recording.name,
        score: controls_recording.score,
        seed: controls_recording.seed,
        controls_array: encoded,
        rng_integrity_check: controls_recording.rng_integrity_check,
    }

    httpRequest = new XMLHttpRequest();
    httpRequest.onload = contentsSent;
    httpRequest.open('POST', 'https://games.kenakofer.com/onion_ninja', true);
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
    if (player.active && !player.unexplodable_at) {
        var distance = Phaser.Math.Distance.Between(player.x, player.y, x, y);
        if (distance < radius && distance > 0)
            player_destroy(player);
    }
}

function myTouching(sprite, others, xdelta, ydelta) {
    myMove(sprite, xdelta, ydelta);
    var result;
    if (others.children)
        result = checkOverlapGroup(sprite, others);
    else
        result = checkOverlap(sprite, others);
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

function myMoveTo(sprite, x, y) {
    myMove(sprite, x - sprite.x, y - sprite.y);
}

function player_resolve_vertical(p) {
    // Resolve possible collision
    var collision;
    if (p.water_walking_at)
        collision = checkOverlap(p, water);
    collision = collision || checkOverlapGroup(p, boundaries) || checkOverlapGroup(p, crates)
    if (collision) {
        raise_delta_y = collision.body.top - p.body.bottom - 1;
        lower_delta_y = collision.body.bottom - p.body.top + 1;

        var kill_threshold = PLAYER_VERTICAL_KILL_THRESHOLD + Math.abs(p.myVelY)
        if (p.super_dash_started_at)
            kill_threshold *= 2;


        // Kill if the distance is too great
        if (Math.min(lower_delta_y, -raise_delta_y) > kill_threshold) {
            //console.log("Kill threshold was"+kill_threshold);
            //console.log("Delta y would have been "+Math.min(lower_delta_y, -raise_delta_y));
            return player_attempt_horizontal_save(p)
        }

        // Resolve in the smaller direction
        if (-raise_delta_y < lower_delta_y) {
            p.body.y += raise_delta_y;
            p.y += raise_delta_y;
            p.myVelY = CRATE_SPEED * ((!collision.grounded) || 0);
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
    var collision = checkOverlapGroup(p, boundaries) || checkOverlapGroup(p, crates)
    if (collision) {
        left_delta_x = collision.body.left - p.body.right - 1;
        right_delta_x = collision.body.right - p.body.left + 1;
        var kill_threshold = PLAYER_HORIZONTAL_KILL_THRESHOLD;
        if (p.super_dash_started_at)
            kill_threshold *= 2;

        // Kill if the distance is too great
        if (Math.min(right_delta_x, -left_delta_x) > kill_threshold) {
            //console.log("Delta x would have been "+Math.min(right_delta_x, -left_delta_x));
            return player_destroy(p);
        }

        // Resolve in the smaller direction
        if (-left_delta_x < right_delta_x) {
            p.body.x += left_delta_x;
            p.x += left_delta_x;
            //console.log("Saved with delta X of "+-left_delta_x);
            return left_delta_x;
        } else {
            p.body.x += right_delta_x;
            p.x += right_delta_x;
            //console.log("Saved with delta X of "+right_delta_x);
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

function player_powerup_state(p) {
    if (p.unexplodable_at)
        return [0, p.unexplodable_at];
    else if (p.flying_started_at)
        return [1, p.flying_started_at];
    else if (p.water_walking_at)
        return [2, p.water_walking_at];
    else if (p.super_dash_started_at)
        return [3, p.super_dash_started_at];
    else if (p.drop_warning_started_at)
        return [4, p.drop_warning_started_at];
    else
        return [-1, -1];
}

function start_powerup(p, which_powerup) {
    if (p.controlled_by == 'human') {
        powerup_text.setVisible(true);
        powerup_text.setText(POWERUP_TEXTS[which_powerup]);
        powerup_text.setColor(POWERUP_TEXT_COLORS[which_powerup])
    }
    p.powerup_at[which_powerup] = getFrame();
}

function stop_powerup(p, which_powerup) {
    p.powerup_at[which_powerup] = false;
    if (p.controlled_by != 'human')
        return;
    if (p.powerup_at.every(function(pow) {return pow == false})) {
        powerup_text.setVisible(false);
    }
}

function powerup_tick(p) {
    var f = getFrame();
    p.powerup_at.forEach(function (value, index) {
        if (!value)
            return;
        if(f - value > POWERUP_LENGTH) {
            stop_powerup(p, index);
        }
    });
}

function player_update(p) {
    if (!p.active) {
        return;
    }

    p.score += SCORE_PER_FRAME;

    var up_press, down_pressed, left_pressed, right_pressed;
    var f = getFrame();
    if (p.controlled_by == "human") {
        up_pressed = my_pressed('up')
        down_pressed = my_pressed('down');
        left_pressed = my_pressed('left');
        right_pressed = my_pressed('right');
        p.controls_recording.controls_array[f*4+0] = up_pressed*1;
        p.controls_recording.controls_array[f*4+1] = down_pressed*1;
        p.controls_recording.controls_array[f*4+2] = left_pressed*1;
        p.controls_recording.controls_array[f*4+3] = right_pressed*1;

        // Powerup bar
        var p_state = player_powerup_state(p);
        if (p_state[0] == -1) {
            powerup_bar_background.setVisible(false);
            powerup_bar_foreground.setVisible(false);
        } else {
            powerup_bar_background.setVisible(true);
            powerup_bar_foreground.setVisible(true);
            powerup_bar_background.setPosition(p.x-25, p.y-30);
            powerup_bar_foreground.setPosition(p.x-23, p.y-28);
            powerup_bar_foreground.fillColor = SNOWFLAKE_TINTS[p_state[0]];
            var f = getFrame() - p_state[1];
            var percent_left = 1 - f / POWERUP_LENGTH
            powerup_bar_foreground.width = percent_left * 46
            if (f > 400 && f % 10 < 5)
                powerup_bar_background.fillColor = 0xff0000;
            else
                powerup_bar_background.fillColor = 0x222222;
        }

        // Unexplodable rings
        var i = 1;
        unexplodable_circles.forEach(function (circle) {
            circle.setVisible(p.unexplodable_at);
            if (p.unexplodable_at) {
                var angle = (getFrame() * i) / 5
                circle.setPosition(p.x + 5 * Math.cos(angle), p.y + 5*Math.sin(angle));
                i+=.35;
            }
        });
    } else { // Not controlled by human
        p.label.setX(p.x - p.label.width/2);
        p.label.setY(p.y - 30);
        if (f*4 >= p.controls_recording.controls_array.length) {
            player_destroy(p);
            return;
        }
        up_pressed = parseInt(p.controls_recording.controls_array[f*4+0]);
        down_pressed = parseInt(p.controls_recording.controls_array[f*4+1]);
        left_pressed = parseInt(p.controls_recording.controls_array[f*4+2]);
        right_pressed = parseInt(p.controls_recording.controls_array[f*4+3]);

        if (p.label) {
            p.label.alpha -= .005;
            if (p.label.alpha <= 0)
                p.label.destroy(true);
        }
    }

    p.super_jump_possible = false;

    p.strictly_grounded = myTouching(p, crates, 0, 1)
    p.loosely_grounded = p.strictly_grounded || myTouching(p, crates, 0, 4) || myTouching(p, missiles, 0, 4) || (p.water_walking_at && myTouching(p, water, 0, 4))

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
        }
    }

    if (! p.dashing) {
        // Not dashing

        // Jump limits:
        // Shortest jump: 1 box height
        // Tallest jump: 3 boxes height
        if (p.strictly_grounded) {
            p.myVelY = 0;
        } else {
            if (p.flying_started_at) {
                if (up_pressed) {
                    p.myVelY -= PLAYER_GRAVITY/3
                } else {
                    p.myVelY += PLAYER_GRAVITY/2
                }
            } else {
                p.myVelY += PLAYER_GRAVITY;
                if (p.myVelY < 0 && !up_pressed)
                    p.myVelY += PLAYER_JUMP_DRAG;
            }
        }

        if (p.loosely_grounded || (p.myVelY > 0 && myTouching(p, missiles, 0, p.myVelY))) {
            p.can_dash = true;
            if (up_pressed) {
                if (p.super_jump_possible) {
                    p.myVelY = PLAYER_SUPER_JUMP_SPEED;
                } else {
                    if (p.flying_started_at) {
                        p.myVelY = Math.min(PLAYER_JUMP_SPEED/6, p.myVelY);
                    } else {
                        p.myVelY = Math.min(PLAYER_JUMP_SPEED, p.myVelY);
                    }
                }
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

        if (p.super_dash_started_at) {
            p.can_dash = getFrame() - p.dash_start_frame > 15;
            if (p.controlled_by == 'human') {
                super_dash_lines.forEach(function (line) {
                    line.setPosition(p.x, p.y);
                    line.setVisible(p.can_dash);
                })
                super_dash_circles.forEach(function (circle) {
                    circle.setPosition(p.x, p.y);
                    circle.setVisible(p.can_dash);
                });
            }
        }

        if (down_pressed && p.can_dash && !p.flying_started_at/*&& getFrame() - p.dash_start_frame > PLAYER_DASH_RECHARGE_FRAMES*/ && (left_pressed || right_pressed || !p.strictly_grounded)) {

            if (left_pressed) {
                p.dash_delta = [-PLAYER_DASH_SPEED, 0]
                p.anims.play('dash_right');
            } else if (right_pressed) {
                p.dash_delta = [PLAYER_DASH_SPEED, 0]
                p.anims.play('dash_right');

            } else if (up_pressed && p.super_dash_started_at) {
                p.dash_delta = [0, -PLAYER_DASH_SPEED]
            } else if (!p.super_dash_started_at) {
                p.dash_delta = [0, PLAYER_DASH_SPEED * 1.5]
                p.anims.play('dash_downward');
            } else {
                p.dash_delta = false;
            }
            if (p.super_dash_started_at) {
                if (p.dash_delta) { // Never super dash down
                    myMove(p, p.dash_delta[0]*PLAYER_DASH_FRAMES, p.dash_delta[1]*PLAYER_DASH_FRAMES);
                    p.dash_start_frame = getFrame();
                    p.can_dash = false;
                    p.myVelY = 0;
                }
            } else {
                p.dashing = true
                p.dash_start_frame = getFrame()
                p.can_dash = false;
                p.setSize(...PLAYER_DASH_SIZE);
                p.setDisplaySize(...PLAYER_DASH_DISPLAY_SIZE);
                p.setOffset(...PLAYER_DASH_OFFSET)
            }
        }

        powerup_tick(p)

        // Powerups
        p.flipX = false;
        if (p.flying_started_at) {
            var frame = 9;
            if (left_pressed)
                frame = 11;
            else if (right_pressed) {
                frame = 11;
                p.flipX = true;
            }
            frame += Math.floor(getFrame()/2) % 2
            p.setFrame(frame);

            if (getFrame() - p.flying_started_at > POWERUP_LENGTH) {
                p.flying_started_at = false;
            }
        }
        if (p.super_dash_started_at && getFrame() - p.super_dash_started_at > POWERUP_LENGTH) {
            p.super_dash_started_at = false;
            super_dash_lines.forEach(function (line) {
                line.setVisible(false);
            })
            super_dash_circles.forEach(function (circle) {
                circle.setVisible(false);
            });
        }
        if (p.water_walking_at && getFrame() - p.water_walking_at > POWERUP_LENGTH) {
            p.water_walking_at = false;
        }
        if (p.unexplodable_at && getFrame() - p.unexplodable_at > POWERUP_LENGTH) {
            p.unexplodable_at = false;
        }
        if (p.drop_warning_started_at && getFrame() - p.drop_warning_started_at > POWERUP_LENGTH) {
            p.drop_warning_started_at = false;
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
    // End not-dash

    // Snowflake powerups
    snowflakes.children.iterate(function (snowflake) {
        if (p.snowflakes.has(snowflake.created_at) || !checkOverlap(snowflake, p))
            return;

        var lobes = (p.snowflakes.size % 6) + 1
        // Keep track of which have been collected
        p.snowflakes.add(snowflake.created_at)

        if (p.controlled_by == 'human') {
            snowflake_indicator.setFrame(3 + lobes).setVisible(true);
            snowflake_indicator.lobe_added_at = getFrame();
            snowflake_indicator.setTint(SNOWFLAKE_TINTS[snowflake.whichPowerup]);

            snowflake.setAlpha(.7);
            snowflake.setTint(0xaaaaaa);

        }

        if (lobes == 6) { // Powerup time!
            if (snowflake.whichPowerup == 0)
                p.unexplodable_at = getFrame();
            else if (snowflake.whichPowerup == 1)
                p.flying_started_at = getFrame()
            else if (snowflake.whichPowerup == 2)
                p.water_walking_at = getFrame();
            else if (snowflake.whichPowerup == 3)
                p.super_dash_started_at = getFrame()
            else if (snowflake.whichPowerup == 4)
                p.drop_warning_started_at = getFrame()
            start_powerup(p, snowflake.whichPowerup);
        }
    });
}

function getFrame() {
    return game.myFrame;
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function refresh_best_recording(seed, hard) {
    game.cache.json.remove('best_recording_'+seed+'_'+hard);
    scene.load.json('best_recording_'+seed+'_'+hard, 'https://games.kenakofer.com/onion_ninja/get_best_recording/'+CODE_VERSION+'/'+seed+'/'+hard)
    scene.load.start();
}
function refresh_leader_boards(hard) {
    game.cache.json.remove('leader_board_'+hard);
    scene.load.json('leader_board_'+hard, 'https://games.kenakofer.com/onion_ninja/leader_board/'+CODE_VERSION+'/'+hard)
    scene.load.start();
}

function getSeedString(seed) {
    return String.fromCharCode(65+seed);
}
