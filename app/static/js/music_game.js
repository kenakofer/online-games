/* TODO
 * Better platforming feel
 * Dash
 * Sounds on jump/dash
 *
 * Beat limitations/enablements:
 *  Don't want too many limitations on typical platforming; prefer to positively reward beat conformity:
 *      Limit jump height when not on beat
 *  Increase your groove level by not missing a beat (jump/dash/attack)
 *   - Sunglasses
 *   - Disco effect
 *   - Background Rhythm changes
 *   - Stylish Flips in air
 *  Unlock abilities at higher groove levels?
 *   - Fireball to consume a groove level
 *   - Damage consumes groove level instead of hurting you (sunglasses fly off?)
 *  
 */
const TARGET_FPS = 50;

const X = 0;
const Y = 1;
const Z = DEPTH = 2;

const WIDTH = 0;
const HEIGHT = 1;

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

const PLAYER_SIZE = [23, 38];
const PLAYER_DISPLAY_SIZE = [29, 48];
const PLAYER_OFFSET = [4, 10];
const PLAYER_GRAVITY = .1;
const PLAYER_JUMP_DELTA_V = -5.5;
const PLAYER_HORIZONTAL_GROUND_FRICTION = .8;
const PLAYER_GROUND_SPEED_DELTA_V = 1.0;

const DEFAULT_MUSIC_CONFIG = {
    mute: false,
    volume: 1,
    rate: 1,
    detune: 0,
    seek: 0,
    loop: false,
    delay: 0
}

var game_div;
var virtual_screen_pressed = [
    [false, false, false],
    [false, false, false],
    [false, false, false]
]

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
            debug: true,
            forceX: true
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    render: {
        pixelArt: true
    },
};
var physics;

var game = new Phaser.Game(config);
game_object_methods = {
    update: function () {},
    setPos: function (pos) {
        this.position[X] = pos[X];
        this.position[Y] = pos[Y];
        [this.sprite.x, this.sprite.y] = this.position;
        return this.position;
    },
    changePos: function (pos) {
        this.position[X] += pos[X];
        this.position[Y] += pos[Y];
        [this.sprite.x, this.sprite.y] = this.position;
        return this.position;
    },
    relativeVel: function (go2) {
        return [this.velocity[0] - go2.velocity[0], this.velocity[1] - go2.velocity[1]]
    },
    getRight: function () {
        return this.position[X] + this.size[WIDTH];
    },
    getBottom: function () {
        return this.position[Y] + this.size[HEIGHT];
    },
    getRect: function () {
        return {
            x: this.position[X],
            y: this.position[Y],
            right: this.getRight(),
            bottom: this.getBottom()
        }
    },
    overlaps: function(go2) {
        if (Array.isArray(go2)) {
            return this.overlapsGroup(go2)
        }
        if (!this.active || !go2.active)
            return false;
        if (Phaser.Geom.Intersects.RectangleToRectangle(this.getRect(), go2.getRect()) && go1 != go2)
            return go2;
        else
            return false;
    },
    overlapsGroup: function(group) {
        go1 = this;
        var result = false;
        group.forEach(function(go) {
           result = result || go1.overlaps(go); 
        });
        return result;
    },
}

function createGameObject(scene, overrides) {
    const go = {
        class: "GameObject",
        ...game_object_methods,
        active: true,
        position: [0, 0, 0],
        size: [0, 0],
        velocity: [0, 0],
        sprite_key: null,
        sprite: null,
        anim_key: null,
        anim_yoyo: false,
        anim_start_frame: 0,
        anim_duration: 1000,
        sound_key: null,
        sound: null,
        solid: false,
        sound_loop_duration: null,
        ...overrides
    };
    while (go.position.length < 3) {
        go.position.push(0);
    }
    if (go.sprite_key) {
	if (go.tileSprite)
	    go.sprite = scene.add.tileSprite(go.position[X], go.position[Y], go.size[WIDTH], go.size[HEIGHT], go.sprite_key);
	else {
	    go.sprite = scene.add.sprite(go.position[X], go.position[Y], go.sprite_key);
            go.sprite.setSize(go.size);
        }
        go.sprite.setDepth(go.position[DEPTH]);
        go.sprite.setOrigin(0,0);
        go.anim_frame_count = go.sprite.texture.frameTotal - 1;
    }
    if (go.anim_key) {
        //go.sprite.anims.play(go.anim_key); 
    }
    if (go.sound_key) {
        go.sound = scene.sound.add(go.sound_key, DEFAULT_MUSIC_CONFIG);
        go.sound.play()
    }
    scene.game_objects.push(go);
    if (go.solid) {
        scene.solid_game_objects.push(go);
    }

    return go;
}

function createSlime(scene, overrides) {
    const slime = createGameObject(scene, {
        class: "Slime",
        sprite_key: "slime_sheet",
        size: [64, 64],
        anim_key: "slime_anim",
        anim_duration: 500,
        anim_yoyo: true,
        sound_loop_duration: 8000,
        sound_key: "slime_melody",
        anim_start_frame: 4,
        ...overrides
    });
    return slime;
}

function createClock(scene, overrides) {
    const clock = createGameObject(scene, {
        class: "Clock",
        sprite_key: "clock_sheet",
        size: [64, 62],
        anim_key: "clock_anim",
        anim_duration: 2000,
        sound_loop_duration: 2000,
        sound_key: "clock_beat",
        ...overrides
    });
    return clock;
}

function createDrums(scene, overrides) {
    const clock = createGameObject(scene, {
        class: "Drums",
        sprite_key: "clock_sheet",
        size: [64, 62],
        anim_key: "clock_anim",
        anim_duration: 2000,
        sound_loop_duration: 8000,
        sound_key: "drum_beat",
        ...overrides
    });
    return clock;
}

function createWall(scene, overrides) {
    const wall = createGameObject(scene, {
        class: "Wall",
        sprite_key: "rock_wall",
        size: [64, 64],
	tileSprite: true,
        solid: true,
        ...overrides
    });
    return wall;
}

function createPlayer(scene, overrides) {
    const player = createGameObject(scene, {
        class: "Player",
        size: [64, 64],
        sprite_key: "beat_square_sheet",
        anim_key: "beat_square_anim",
        anim_duration: 500,
        update: playerUpdate,
        grounded_on: null,
        ...overrides
    });
    return player;
}

function playerUpdate(scene) {
    this.velocity[Y] += PLAYER_GRAVITY;
    this.changePos([0, this.velocity[Y]]);
    vert_collider = this.overlaps(scene.solid_game_objects)
    if (vert_collider && this.relativeVel(vert_collider)[Y] > 0) {
        this.grounded_on = vert_collider
        this.setPos([this.position[X], vert_collider.position[Y] - this.size[HEIGHT] - .001]);
        this.velocity[Y] = vert_collider.velocity[Y];
        this.velocity[X] -= this.grounded_on.velocity[X];
        this.velocity[X] *= PLAYER_HORIZONTAL_GROUND_FRICTION;
        this.velocity[X] += this.grounded_on.velocity[X];
        if (this.overlaps(scene.solid_game_objects))
            debugger;
    } else {
        this.grounded_on = null;
    }

    this.changePos([this.velocity[X], 0]);
    wall_collider = this.overlaps(scene.solid_game_objects)
    if (wall_collider) {
        if (this.relativeVel(wall_collider)[X] > 0) 
            this.setPos([wall_collider.position[X] - this.size[WIDTH] - .001, this.position[Y]]);
        else
            this.setPos([wall_collider.position[X] + wall_collider.size[WIDTH] + .001, this.position[Y]]);
        this.velocity[X] = wall_collider.velocity[X];
        this.velocity[Y] -= wall_collider.velocity[Y];
        this.velocity[Y] *= PLAYER_HORIZONTAL_GROUND_FRICTION;
        this.velocity[Y] += wall_collider.velocity[Y];
    }

    if (this.grounded_on && my_pressed('up')) {
        this.velocity[Y] += PLAYER_JUMP_DELTA_V;
    }
    if (this.grounded_on && my_pressed('left')) {
        console.log('left');
        this.velocity[X] -= PLAYER_GROUND_SPEED_DELTA_V;
    }
    else if (this.grounded_on && my_pressed('right')) {
        this.velocity[X] += PLAYER_GROUND_SPEED_DELTA_V;
    }
}

function setFrameByTime(go, time) {
    total_frames = go.anim_frame_count
    if (go.anim_yoyo) {
        total_frames = total_frames * 2 - 2
    }
    target_frame = Math.round(time * total_frames / go.anim_duration) + go.anim_start_frame
    target_frame %= total_frames
    if (target_frame >= go.anim_frame_count) {
        target_frame = go.anim_frame_count - target_frame + 2
    }
    go.sprite.setFrame(target_frame);
}

function loopSoundByTime(go, time, previous_time) {
    if ((time % go.sound_loop_duration) < (previous_time % go.sound_loop_duration)) {
        go.sound.play();
    }
}

function preload () {
    this.load.setBaseURL('../static/assets/music_game');
    this.load.image('background', 'background.jpg');
    this.load.image('rock_wall', 'rock_wall_64x64.png');
    this.load.spritesheet('slime_sheet', 'slime_sheet.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('clock_sheet', 'clock_32x62_sheet20.png', { frameWidth: 32, frameHeight: 62 });
    this.load.spritesheet('beat_square_sheet', 'beat_square_64x64_sheet8.png', { frameWidth: 64, frameHeight: 64 });

    this.load.audio('slime_melody', 'bird_bpm120_b16.wav')
    this.load.audio('clock_beat', 'clock_bpm120_b4.wav')
    this.load.audio('drum_beat', 'rhythm_bpm120_b16.wav')
}

function create () {
    this.game_objects = [];
    this.solid_game_objects = [];

    this.add.image(GAME_WIDTH/2, GAME_HEIGHT/2, 'background');
    mobile_lines = [];
    mobile_instructions = [];

    if (game.device.os.desktop == false) {
	// Mobile stuff
        mobile_lines.push(this.add.line(0,0, 0,GAME_HEIGHT/3, GAME_WIDTH,GAME_HEIGHT/3, 0xffffff, .2).setOrigin(0,0).setDepth(100));
        mobile_lines.push(this.add.line(0,0, 0,2*GAME_HEIGHT/3, GAME_WIDTH,2*GAME_HEIGHT/3, 0xffffff, .2).setOrigin(0,0).setDepth(100));
        mobile_lines.push(this.add.line(0,0, GAME_WIDTH/3,0, GAME_WIDTH/3,GAME_HEIGHT, 0xffffff, .2).setOrigin(0,0).setDepth(100));
        mobile_lines.push(this.add.line(0,0, 2*GAME_WIDTH/3,0, 2*GAME_WIDTH/3,GAME_HEIGHT, 0xffffff, .2).setOrigin(0,0).setDepth(100));

        mobile_instructions.push(this.add.text(40,GAME_HEIGHT/2-40, 'Left', { fontSize: '80px', fill: '#fff' }).setAlpha(.5).setDepth(100));
        mobile_instructions.push(this.add.text(GAME_WIDTH-250,GAME_HEIGHT/2-40, 'Right', { fontSize: '80px', fill: '#fff' }).setAlpha(.5).setDepth(100));
    }

    // Maybe move this into the mobile stuff
    scene = game.scene.scenes[0]
    scene.input.addPointer(1); // Two touch support. Could be more

    if (this.sys.game.device.fullscreen.available) {
        fullscreen_button = this.add.image(GAME_WIDTH-5, 5, 'fullscreen', 0).setOrigin(1, 0).setInteractive();
        fullscreen_button.setDisplaySize(40,40);
        fullscreen_button.setSize(20,20);
        fullscreen_button.setTintFill(0xbbbbff);
        fullscreen_button.setDepth(1);
        fullscreen_button.on('pointerup', function () {
            if (this.scale.isFullscreen) {
                fullscreen_button.setFrame(0);
                this.scale.stopFullscreen();
            }
            else {
                fullscreen_button.setFrame(1);
                this.scale.startFullscreen();
            }
        }, this);
    }

    this.anims.create({
	key: 'slime_anim',
	frames: this.anims.generateFrameNumbers('slime_sheet', { start: 0, end: 999 }),
	frameRate: 12,
	repeat: -1,
        yoyo: true
    });
    this.anims.create({
	key: 'clock_anim',
	frames: this.anims.generateFrameNumbers('clock_sheet', { start: 0, end: 999 }),
	duration: 10000,
	repeat: -1,
        skipMissedFrames: true
    });

    cursors = this.input.keyboard.createCursorKeys();

    upperRightText = this.add.text(GAME_WIDTH-120, 9, 'Score: 0', { fontSize: '10px', fill: '#000' }).setDepth(100).setVisible(true);

    master_volume_node = game.sound.masterVolumeNode;
    panner_node = game.sound.context.createPanner();
    panner_node.maxDistance = 1024;
    panner_node.refDistance = 32;
    panner_node.rolloffFactor = 1;
    panner_node.connect(master_volume_node);

    newGame(this);
}

function newGame(scene) {
    player = createSlime(scene, {position: [GAME_WIDTH/2, GAME_HEIGHT/3]})
    scene.clock = createClock(scene, {position: [GAME_WIDTH/3, GAME_HEIGHT/2]})
    createDrums(scene, {position: [GAME_WIDTH/3, GAME_HEIGHT/3]})
    scene.start_time = Date.now()
    scene.player = createPlayer(scene, {position: [GAME_WIDTH*2/3, GAME_HEIGHT/2]})
    scene.wall = createWall(scene, {position: [50, 400], size: [600, 50]})
    createWall(scene, {position: [200, 200], size: [20, 100]})
}

function debugInfo() {
    upperRightText.setText([
        "FPS: " + Math.round(game.loop.actualFps * 100) / 100
    ].join("\n"))
}

function update () {
    scene.myFrame += 1;
    scene.last_time_elapsed = scene.time_elapsed
    scene.time_elapsed = Date.now() - scene.start_time
    scene.game_objects.forEach(function (go) {
        if (!go.active)
            return;
        go.update(scene);
        setFrameByTime(go, scene.time_elapsed)
        loopSoundByTime(go, scene.time_elapsed, scene.last_time_elapsed)
    });
    debugInfo()
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


function isSurroundTouching(spriteA, spriteB) {
    bounds1 = spriteA.body.getBounds({});
    bounds1.x -= 4;
    bounds1.y -= 4;
    bounds1.width += 8;
    bounds1.width += 8;
    return (spriteA.active && spriteB.active && Phaser.Geom.Intersects.RectangleToRectangle(bounds1, spriteB.body.getBounds({})) && spriteA != spriteB)
}

function object_count() {
    return this.physics.world.staticBodies.entries.length;
}

function generic_destroy(object) {
    object.destroy(true);
}

function player_destroy(p) {
    if (p.label) {
        p.label.destroy(true);
    }
    if (p == player) {
        game.frameOfDeath = getFrame();
    }

    generic_destroy(p)
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

function player_update(p) {
    if (!p.active) {
        return;
    }

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
    }

    if (left_pressed)
    {
        p.x -= PLAYER_WALK_SPEED; 
        p.body.x -= PLAYER_WALK_SPEED; 
        player_attempt_horizontal_save(p);
    }
    else if (right_pressed)
    {
        p.x += PLAYER_WALK_SPEED;
        p.body.x += PLAYER_WALK_SPEED;
        player_attempt_horizontal_save(p);
    }
}

function getFrame() {
    return game.myFrame;
}
