/* TODO
 * Better platforming feel
 * Dash
 * Sounds on run/jump/dash
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

const GAME_WIDTH = 1200;
const GAME_HEIGHT = 768;

const PLAYER_SIZE = [23, 38];
const PLAYER_DISPLAY_SIZE = [29, 48];
const PLAYER_OFFSET = [4, 10];
const PLAYER_GRAVITY = .8;
const PLAYER_QUICK_JUMP_DRAG = 1.2;
const PLAYER_JUMP_DELTA_V = -14.0;
const PLAYER_MAX_FALL_SPEED = 10.0;
const PLAYER_FAILED_JUMP_DELTA_V = -4.0;
const PLAYER_HORIZONTAL_GROUND_FRICTION = .65;
const PLAYER_GROUND_SPEED_DELTA_V = 2.5;
const PLAYER_DASH_MS = 75;
const PLAYER_DASH_VELOCITY = [25, -1];
const BEAT_THRESHHOLD = 80;

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
        enemy: false,
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
            go.sprite.setSize(...go.size);
            go.sprite.setDisplaySize(...go.size);
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
    if (go.enemy) {
        scene.enemy_game_objects.push(go);
    }

    return go;
}

function createSlime(scene, overrides) {
    const slime = createGameObject(scene, {
        class: "Slime",
        sprite_key: "slime_sheet",
        size: [64, 43],
        anim_key: "slime_anim",
        anim_duration: 500,
        anim_yoyo: true,
        sound_loop_duration: 8000,
        sound_key: "slime_melody",
        anim_start_frame: 4,
        enemy: true,
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
        size: [40, 64],
        sprite_key: "beat_square_sheet",
        anim_key: "beat_square_anim",
        anim_duration: 500,
        update: playerUpdate,
        grounded_on: false,
        jump_sound: scene.sound.add('jump', DEFAULT_MUSIC_CONFIG),
        jump_fail_sound: scene.sound.add('jump_fail', DEFAULT_MUSIC_CONFIG),
        dash_sound: scene.sound.add('dash', DEFAULT_MUSIC_CONFIG),
        dash_fail_sound: scene.sound.add('dash_fail', DEFAULT_MUSIC_CONFIG),
        dashing_since: false,
        facing_right: false,
        sound_key: "footsteps_beat",
        sound_loop_duration: 2000,
        ...overrides
    });
    return player;
}

function playerUpdate(scene) {
    if (!this.dashing_since) {
        this.velocity[Y] += PLAYER_GRAVITY;
        if (this.velocity[Y] > PLAYER_MAX_FALL_SPEED)
            this.velocity[Y] = PLAYER_MAX_FALL_SPEED
    }

    this.changePos([0, this.velocity[Y]]);
    vert_collider = this.overlaps(scene.solid_game_objects)
    this.grounded_on = null;
    if (vert_collider) {
        if (this.relativeVel(vert_collider)[Y] > 0) {
            this.grounded_on = vert_collider
            this.setPos([this.position[X], vert_collider.position[Y] - this.size[HEIGHT] - .001]);
        } else {
            this.setPos([this.position[X], vert_collider.position[Y] + vert_collider.size[HEIGHT] + .001]);
        }

        this.velocity[Y] = vert_collider.velocity[Y];
        if (this.overlaps(scene.solid_game_objects))
            debugger;
    } else {
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

    this.sound.mute = !(this.grounded_on && Math.abs(this.velocity[X]) > 1)

    if (isPressed('up') && !scene.prior_presses['up']) {
        enemy = this.overlaps(scene.enemy_game_objects)
        if (enemy && this.getBottom() - enemy.position[Y] > 40) 
            enemy = false;
        if (this.grounded_on || enemy) {
            if (scene.ms_since_beat > -BEAT_THRESHHOLD && scene.ms_since_beat < BEAT_THRESHHOLD) {
                // jump
                this.velocity[Y] = PLAYER_JUMP_DELTA_V;
                this.jump_sound.play();
            } else {
                // failed jump
                this.velocity[Y] = PLAYER_FAILED_JUMP_DELTA_V;
                this.jump_fail_sound.play();
            }
        }
    }
    if (!this.dashing_since && !this.grounded_on && this.velocity[Y] < 0 && !isPressed('up')) {
        this.velocity[Y] += PLAYER_QUICK_JUMP_DRAG;
    }

    if (!this.dashing_since && isPressed('space') && !scene.prior_presses['space']) {
        if (scene.ms_since_off_beat > -BEAT_THRESHHOLD && scene.ms_since_off_beat < BEAT_THRESHHOLD) {
            if (this.facing_right) {
                this.velocity = PLAYER_DASH_VELOCITY.slice();
            } else {
                this.velocity = PLAYER_DASH_VELOCITY.slice();
                this.velocity[X] *= -1;
            }
            this.dashing_since = scene.time_elapsed;
            this.dash_sound.play();
        } else {
            this.dash_fail_sound.play();
        }
    }
    if (this.dashing_since) {
        enemy = this.overlaps(scene.enemy_game_objects)
        if (enemy) {
            // Bounce off at a higher angle, restarting the dash counter
            this.dashing_since = scene.time_elapsed;
            this.velocity[X] *= -1;
            this.velocity[Y] -= 8;
        }
        if (scene.time_elapsed - this.dashing_since > PLAYER_DASH_MS)
            this.dashing_since = false;
    } else {
        if (isPressed('left')) {
            this.velocity[X] -= PLAYER_GROUND_SPEED_DELTA_V;
            this.facing_right = false;
        }
        else if (isPressed('right')) {
            this.velocity[X] += PLAYER_GROUND_SPEED_DELTA_V;
            this.facing_right = true;
        }

        //this.velocity[X] -= vert_collider.velocity[X];
        this.velocity[X] *= PLAYER_HORIZONTAL_GROUND_FRICTION;
        //this.velocity[X] += vert_collider.velocity[X];
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
    this.load.spritesheet('slime_sheet', 'slime_64x43_sheet4.png', { frameWidth: 64, frameHeight: 43 });
    this.load.spritesheet('clock_sheet', 'clock_32x62_sheet20.png', { frameWidth: 32, frameHeight: 62 });
    this.load.spritesheet('beat_square_sheet', 'beat_square_64x64_sheet8.png', { frameWidth: 64, frameHeight: 64 });

    this.load.audio('slime_melody', 'spider_bpm120_b16.wav')
    this.load.audio('clock_beat', 'clock_bpm120_b4.wav')
    this.load.audio('drum_beat', 'rhythm_bpm120_b16.wav')
    this.load.audio('footsteps_beat', 'footsteps_bpm120_b4.wav')
    this.load.audio('jump', 'jump.wav')
    this.load.audio('jump_fail', 'jump_fail.wav')
    this.load.audio('dash', 'dash.wav')
    this.load.audio('dash_fail', 'dash_fail.wav')
}

function create () {
    this.game_objects = [];
    this.solid_game_objects = [];
    this.enemy_game_objects = [];

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

    scene.prior_presses = {
        'up': isPressed('up'),
        'down': isPressed('down'),
        'left': isPressed('left'),
        'right': isPressed('right'),
        'space': isPressed('space')
    }

    newGame(this);
}

function newGame(scene) {
    createSlime(scene, {position: [450,457]})
    scene.clock = createClock(scene, {position: [GAME_WIDTH/3, GAME_HEIGHT/2]})
    createDrums(scene, {position: [GAME_WIDTH/3, GAME_HEIGHT/3]})
    scene.start_time = Date.now()
    scene.player = createPlayer(scene, {position: [GAME_WIDTH*2/3, GAME_HEIGHT/2]})
    createWall(scene, {position: [50, 400], size: [200, 30]})
    createWall(scene, {position: [900, 400], size: [200, 30]})
    createWall(scene, {position: [600, 600], size: [600, 30]})
    createWall(scene, {position: [50, 100], size: [600, 30]})
    createWall(scene, {position: [400, 500], size: [600, 30]})
    createWall(scene, {position: [200, 700], size: [600, 30]})

}

function debugInfo() {
    upperRightText.setText([
        "FPS: " + Math.round(game.loop.actualFps * 100) / 100
    ].join("\n"))
}

function update () {
    scene.beat_duration = 500;
    scene.myFrame += 1;
    scene.last_time_elapsed = scene.time_elapsed
    scene.time_elapsed = Date.now() - scene.start_time
    scene.ms_since_off_beat = (scene.time_elapsed % scene.beat_duration) - scene.beat_duration/2;
    scene.ms_since_beat = ((scene.time_elapsed + scene.beat_duration/2) % scene.beat_duration) - scene.beat_duration/2;
    scene.game_objects.forEach(function (go) {
        if (!go.active)
            return;
        go.update(scene);
        setFrameByTime(go, scene.time_elapsed)
        loopSoundByTime(go, scene.time_elapsed, scene.last_time_elapsed)
    });
    scene.prior_presses = {
        'up': isPressed('up'),
        'down': isPressed('down'),
        'left': isPressed('left'),
        'right': isPressed('right'),
        'space': isPressed('space')
    }
    debugInfo()
}

function isPressed(direction) {
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
        case 'space':
            value = cursors.space.isDown || virtual_screen_pressed[1][1]
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
        up_pressed = isPressed('up')
        down_pressed = isPressed('down');
        left_pressed = isPressed('left');
        right_pressed = isPressed('right');
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
