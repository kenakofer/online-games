// TODO
// Minor:
//
//  Medium:
//   Fix Particles
//
// Major:
//  Cloud with lightning
//  Remove physics (bodies?) entirely to try to solve performance issues
//
// Super Major
//  Saves, replays, and ghosts
//

const TARGET_FPS = 55;

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

const MISSILE_SPEED = 4;

// Combined, these make for a minimum jump height of ~60 pixels (1 box) and max
// of ~160 pixels (3 box)
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
    this.load.spritesheet('dude_dash', 'onion_dude_dash.png', { frameWidth: 32, frameHeight: 29 });
    this.load.spritesheet('bomb_crate', 'bomb_crate_sheet.jpg', { frameWidth: 99, frameHeight: 100 });
    this.load.spritesheet('explosion', 'explosion_sheet.png', { frameWidth: 89, frameHeight: 89 });
    physics = this.physics;
}

function create () {
    this.add.image(400, 300, 'background');

    background_water = this.physics.add.staticGroup({
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

    splinter_particles = this.add.particles('splinter');
    splinter_emitter = splinter_particles.createEmitter();

    splinter_emitter.setPosition(400, 300);
    splinter_emitter.setSpeed(600);
    splinter_emitter.setLifespan(1000);
    splinter_emitter.setScale(0.5);
    splinter_emitter.setGravityY(1000);
    splinter_emitter.stop();

    crates = this.physics.add.staticGroup();
    explosions = this.physics.add.staticGroup();
    metal_crates = this.physics.add.staticGroup();
    shark_fins = this.physics.add.staticGroup();
    missiles = this.physics.add.staticGroup();
    explodables = this.physics.add.staticGroup();

    boundaries = this.physics.add.staticGroup();
    boundary = boundaries.create(-10,GAME_HEIGHT/2);
    boundary.setSize(20, GAME_HEIGHT);
    boundary.visible = false;

    boundary = boundaries.create(GAME_WIDTH + 10, GAME_HEIGHT/2);
    boundary.setSize(20, GAME_HEIGHT);
    boundary.visible = false;

    boundary = boundaries.create(GAME_WIDTH/2, -10);
    boundary.setSize(GAME_WIDTH, 20);
    boundary.visible = false;


    plain_crates = this.physics.add.staticGroup({
	key: 'plain_crate',
	repeat: GAME_WIDTH_IN_BOXES - 5,
	setXY: { x: 2*BOX_SIZE + BOX_SIZE/2, y: 590, stepX: BOX_SIZE }
    });
    plain_crates.children.iterate(function (crate) {
        initialize_plain_crate(crate)
    });

    bomb_crates = this.physics.add.staticGroup();

    player = this.physics.add.staticSprite(100, 400, 'dude');
    player.setSize(...PLAYER_SIZE);
    player.setDisplaySize(...PLAYER_DISPLAY_SIZE);
    player.setOffset(...PLAYER_OFFSET)

    player.myVelY = 0;
    player.grounded = false;
    player.dash_start_frame = -100;
    player.grounded_since_dash = true;

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

    for (var i=0;i<10;i++) {
        this.anims.create({
            key: 'explosion_'+i,
            frames: [ { key: 'explosion', frame: i } ],
            frameRate: 20
        });
    }

    cursors = this.input.keyboard.createCursorKeys();
    debug_key = this.input.keyboard.addKey('D');

    /*
    stars = this.physics.add.group({
	key: 'star',
	repeat: 11,
	setXY: { x: 12, y: 0, stepX: 70 }
    });
    stars.children.iterate(function (child) {
	child.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
    });
    this.physics.add.overlap(player, stars, collectStar, null, this);
    this.physics.add.collider(plain_crates, stars);
    */

    screenText = this.add.text(16, 16, 'Score: 0', { fontSize: '24px', fill: '#000' });

    water = this.physics.add.staticGroup({
	key: 'water',
	repeat: Math.floor(GAME_WIDTH / FOREGROUND_WATER_TILE_HEIGHT),
	setXY: { x: -FOREGROUND_WATER_TILE_WIDTH, y: GAME_HEIGHT+8, stepX: FOREGROUND_WATER_TILE_WIDTH }
    });
    water.children.iterate(function (water_tile) {
        water_tile.setSize(FOREGROUND_WATER_TILE_WIDTH, FOREGROUND_WATER_TILE_HEIGHT);
        water_tile.setDisplaySize(FOREGROUND_WATER_TILE_WIDTH, FOREGROUND_WATER_TILE_HEIGHT);
        water_tile.setOrigin(undefined,1.2);
        water_tile.setDepth(20);
    });
    this.physics.add.collider(player, water);
    this.physics.add.collider(plain_crates, water);
    this.physics.add.collider(plain_crates, plain_crates);
}

function update () {
    if (debug_key.isDown) {
        this.physics.debug = !this.physics.debug;
        this.physics.world.staticBodies.each(function (body) {
            body.gameObject.setDebug(this.physics.debug, this.physics.debug);
        });
    }

    player_update();

    water.children.iterate(function (water_tile) {
        water_tile.x += Math.sin(game.getFrame() / 50) / 2
    });
    background_water.children.iterate(function (water_tile) {
        water_tile.x -= Math.sin(game.getFrame() / 50) / 2
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
        for (var i=0; i<5; i++) {
            if (checkOverlap(crate, player)) {
                player.y += CRATE_SPEED;
                player.body.y += CRATE_SPEED;
            }
            if (!(crate.texture.key != "metal_crate" && checkOverlap(crate, water)) && !checkOverlap(crate, crates))
                break;
            crate.grounded = true;
            crate.grounded_at_frame = crate.grounded_at_frame || game.getFrame()
            crate.body.y -= 1;
            crate.y -= 1;
        }
    });
    bomb_crates.children.each(function(bomb_crate) {
        if (bomb_crate.active && bomb_crate.grounded_at_frame) {
            var frames_since = game.getFrame() - bomb_crate.grounded_at_frame
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
            var frames_since = game.getFrame() - explosion.created_at;
            var frame = Math.floor( frames_since / 2);

            if (frame < 9 && frame > 1)
                destroy_in_radius(explosion.x, explosion.y, explosion.width);

            if (frame < 10)
                explosion.anims.play('explosion_'+frame);
            else
                explosion.destroy(true);
        }
    });
    shark_fins.children.each(function(shark_fin) {
        shark_fin.x += shark_fin.myVelX;
        shark_fin.body.x += shark_fin.myVelX;
        shark_fin.y += Math.cos(shark_fin.x / 50);
        shark_fin.body.y += Math.cos(shark_fin.x / 50);
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
    // Stuff to destroy
    this.physics.world.staticBodies.each(function (object) {
        if (object.x > GAME_WIDTH + 150 || object.x < -150 || object.y > GAME_HEIGHT + 50 || object.y < -BOX_SIZE * 2) {
            object.gameObject.destroy(true);
            console.log('out of bounds');
        }
    });
    /*
    splinter_emitter.forEachAlive(function (particle) {
        particle.rotation += 10;
        //particle.accelerationY -= 10;
    });
    */
    randomSpawns();
    screenText.setText('FPS: ' + game.loop.actualFps + "\nObjects: " + object_count());
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
    if (Phaser.Math.Between(0,50) == 0) {
        var crate = initialize_plain_crate(plain_crates.create(random_x,-BOX_SIZE, 'plain_crate'))
    
        for (var i=0; i<5; i++) {
            var random_x = Phaser.Math.Between(1,GAME_WIDTH_IN_BOXES*2 - 3) * BOX_SIZE/2 + 1
            crate.body.x = random_x
            crate.x = random_x + BOX_SIZE/2
            if (!checkOverlap(crate, crates))
                return;
        }
        // No space found for it. Destroy
        crate.destroy(true);
    }
    if (Phaser.Math.Between(0,100) == 0) {
        var crate = initialize_bomb_crate(bomb_crates.create(random_x,-BOX_SIZE, 'bomb_crate'))
    
        for (var i=0; i<5; i++) {
            var random_x = Phaser.Math.Between(1,GAME_WIDTH_IN_BOXES*2 - 3) * BOX_SIZE/2 + 1
            crate.body.x = random_x
            crate.x = random_x + BOX_SIZE/2
            if (!checkOverlap(crate, crates))
                return;
        }
        // No space found for it. Destroy
        crate.destroy(true);
    }
    if (Phaser.Math.Between(0,100) == 0) {
        var crate = initialize_metal_crate(metal_crates.create(random_x,-BOX_SIZE, 'metal_crate'))
    
        for (var i=0; i<5; i++) {
            var random_x = Phaser.Math.Between(1,GAME_WIDTH_IN_BOXES*2 - 3) * BOX_SIZE/2 + 1
            crate.body.x = random_x
            crate.x = random_x + BOX_SIZE/2
            if (!checkOverlap(crate, crates))
                return;
        }
        // No space found for it. Destroy
        crate.destroy(true);
    }
    if (Phaser.Math.Between(0,400) == 0) {
        var missile = initialize_missile(missiles.create(random_x, -BOX_SIZE, 'missile'))
    
        for (var i=0; i<5; i++) {
            var random_x = Phaser.Math.Between(1,GAME_WIDTH_IN_BOXES*2 - 3) * BOX_SIZE/2 + 1
            missile.body.x = random_x
            missile.x = random_x + BOX_SIZE/2
            if (!checkOverlap(missile, crates))
                return;

        }
        // No space found for it. Destroy
        crate.destroy(true);
    }
    if (shark_fins.countActive() == 0 && Phaser.Math.Between(0, 100) == 0 && object_count() > 80) {
        initialize_shark_fin()
    }
}

function object_count() {
    return this.physics.world.staticBodies.entries.length;
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
    var side = Phaser.Math.Between(0,1);
    var shark_fin = shark_fins.create(side * GAME_WIDTH, GAME_HEIGHT - 20, "shark_fin");
    shark_fin.flipX = !side;
    shark_fin.setSize(10,20);
    shark_fin.created_at = game.getFrame();
    shark_fin.myVelX = SHARK_SPEED * (side * -2 + 1)
    shark_fin.setDepth(15);
}

function initialize_plain_crate(crate) {
    crate.setSize(BOX_SIZE-1,BOX_SIZE-1);
    crate.setDisplaySize(BOX_SIZE,BOX_SIZE);
    crate.syncBounds = true;
    crates.add(crate);
    explodables.add(crate);
    crate.myDestroy = generic_destroy
    crate.setDepth(10);
    if (Phaser.Math.Between(0,1) == 1)
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
    if (Phaser.Math.Between(0,1) == 1)
        crate.flipX = true;
    return crate;
}
function initialize_bomb_crate(bomb_crate) {
    initialize_plain_crate(bomb_crate);
    bomb_crate.myDestroy = bomb_crate_destroy
    return bomb_crate;
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
    explosion.created_at = game.getFrame();
    generic_destroy(object)
}

function missile_crate_destroy(object) {
    object.destroy(true);
    explosion = explosions.create(object.x - 12, object.y + 10, 'explosion') // TODO MAGIC#
    explosion.setSize(BIG_EXPLOSION_SIZE, BIG_EXPLOSION_SIZE);
    explosion.setDisplaySize(BIG_EXPLOSION_SIZE, BIG_EXPLOSION_SIZE);
    explosion.created_at = game.getFrame();
    generic_destroy(object)
}

function player_destroy(object) {
    /*
    explosion = explosions.create(object.x, object.y, 'explosion')
    explosion.setSize(99, 99);
    explosion.setDisplaySize(99, 99);
    explosion.created_at = game.getFrame();
    */
    generic_destroy(object)
    console.log('destroyed');
}

function destroy_in_radius(x, y, radius) {
    explodables.children.each(function (crate) {
        var distance = Phaser.Math.Distance.Between(crate.x, crate.y, x, y);
        if (distance < radius && distance > 0)
            crate.myDestroy(crate);
    });
    var distance = Phaser.Math.Distance.Between(player.x, player.y, x, y);
    if (distance < radius && distance > 0)
        player_destroy(player);
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

function player_resolve_vertical() {
    // Resolve possible collision
    var collision = checkOverlap(player, boundaries) || checkOverlap(player, crates)
    if (collision) {
        raise_delta_y = collision.body.top - player.body.bottom - 1;
        lower_delta_y = collision.body.bottom - player.body.top + 1;

        var kill_threshold = PLAYER_VERTICAL_KILL_THRESHOLD + Math.abs(player.myVelY)


        // Kill if the distance is too great
        if (Math.min(lower_delta_y, -raise_delta_y) > kill_threshold) {
            console.log("Kill threshold was"+kill_threshold);
            console.log("Delta y would have been "+Math.min(lower_delta_y, -raise_delta_y));
            return player_attempt_horizontal_save()
        }

        // Resolve in the smaller direction
        if (-raise_delta_y < lower_delta_y) {
            player.body.y += raise_delta_y;
            player.y += raise_delta_y;
            player.myVelY = 0;
            return raise_delta_y;
        } else {
            player.body.y += lower_delta_y;
            player.y += lower_delta_y;
            player.myVelY = 4;
            return lower_delta_y;
        }
    }
    return 0
}

function player_attempt_horizontal_save() {
    // Resolve possible collision
    var collision = checkOverlap(player, boundaries) || checkOverlap(player, crates)
    if (collision) {
        left_delta_x = collision.body.left - player.body.right - 1;
        right_delta_x = collision.body.right - player.body.left + 1;

        // Kill if the distance is too great
        if (Math.min(right_delta_x, -left_delta_x) > PLAYER_HORIZONTAL_KILL_THRESHOLD) {
            console.log("Delta x would have been "+Math.min(right_delta_x, -left_delta_x));
            return player_destroy(player);
        }

        // Resolve in the smaller direction
        if (-left_delta_x < right_delta_x) {
            player.body.x += left_delta_x;
            player.x += left_delta_x;
            console.log("Saved with delta X of "+-left_delta_x);
            return left_delta_x;
        } else {
            player.body.x += right_delta_x;
            player.x += right_delta_x;
            console.log("Saved with delta X of "+right_delta_x);
            return right_delta_x;
        }
    }
    return null;
}

function player_shift_to_rounded_position() {
    var round_interval = BOX_SIZE / 4
    var offset = (player.x - PLAYER_SIZE[0]/2 - 2) % round_interval;

    if (offset < round_interval/2) {
        if (offset < 2) {
            player.x -= offset;
            player.body.x -= offset;
        } else {
            player.x -= 2;
            player.body.x -= 2;
        }
    } else {
        if (offset > round_interval - 2) {
            player.x += round_interval - offset;
            player.body.x += round_interval - offset;
        } else {
            player.x += 2;
            player.body.x += 2;
        }
    }
}

function player_update() {
    if (!player.active)
        return;

    player.super_jump_possible = false;

    player.strictly_grounded = myTouching(player, crates, 0, 1)
    player.loosely_grounded = player.strictly_grounded || myTouching(player, crates, 0, 4) || myTouching(player, missiles, 0, 4);


    if (player.dashing) {
        // 
        if (game.getFrame() - player.dash_start_frame >= PLAYER_DASH_FRAMES) {
            if (player.dash_delta[1] > 0)
                player.super_jump_possible = true
            player.dashing = false;
            player.anims.play('turn');
            player.setSize(...PLAYER_SIZE);
            player.setDisplaySize(...PLAYER_DISPLAY_SIZE);
            player.setOffset(...PLAYER_OFFSET)
            player.myVelY = 0;
            player_resolve_vertical();
            if (!player.active) //Player may have been killed in the resolve
                return
        } else {
            player.x += player.dash_delta[0]
            player.body.x += player.dash_delta[0]
            player.y += player.dash_delta[1]
            player.body.y += player.dash_delta[1]
            
            player.angle += 360 / (PLAYER_DASH_FRAMES - 1) * Math.sign(player.dash_delta[0]+.01)

            player.myVelY = player.dash_delta[1] // Just for collision resolution

            for (var i=0; i<5; i++) {
                var delta_y = player_resolve_vertical();
                if (delta_y == 0)
                    break;
            }
            return // Don't do anything more during a dash
        }
    }

    // Jump limits:
    // Shortest jump: 1 box height
    // Tallest jump: 3 boxes height
    if (player.strictly_grounded) {
        player.myVelY = 0;
    } else {
        player.myVelY += PLAYER_GRAVITY;
        if (player.myVelY < 0 && !cursors.up.isDown)
            player.myVelY += PLAYER_JUMP_DRAG;
    }

    if (player.loosely_grounded) {
        player.grounded_since_dash = true;
        if (cursors.up.isDown) {
            if (player.super_jump_possible) {
                player.myVelY = PLAYER_SUPER_JUMP_SPEED;
            } else
                player.myVelY = Math.min(PLAYER_JUMP_SPEED, player.myVelY);
        }
    }

    if (cursors.left.isDown)
    {
	player.anims.play('left', true);
        if (! player.strictly_grounded) {
            player.anims.setProgress(.25);
            player.anims.stop();
        }
        player.x -= PLAYER_WALK_SPEED; 
        player.body.x -= PLAYER_WALK_SPEED; 
        player_attempt_horizontal_save();
    }
    else if (cursors.right.isDown)
    {
	player.anims.play('right', true);
        if (! player.strictly_grounded) {
            player.anims.setProgress(.25);
            player.anims.stop();
        }
        player.x += PLAYER_WALK_SPEED;
        player.body.x += PLAYER_WALK_SPEED;
        player_attempt_horizontal_save();
    }
    else
    {
	player.anims.play('turn');
        player_shift_to_rounded_position();
    }
    if (!player.active)
        return

    if (cursors.down.isDown && player.grounded_since_dash /*&& game.getFrame() - player.dash_start_frame > PLAYER_DASH_RECHARGE_FRAMES*/ && (cursors.left.isDown || cursors.right.isDown || !player.strictly_grounded)) {
        
        if (cursors.left.isDown) {
            player.dash_delta = [-PLAYER_DASH_SPEED, 0]
            player.anims.play('dash_right');
        } else if (cursors.right.isDown) {
            player.dash_delta = [PLAYER_DASH_SPEED, 0]
            player.anims.play('dash_right');

        } else {
            player.dash_delta = [0, PLAYER_DASH_SPEED * 1.5]
            player.anims.play('dash_downward');
        }
        player.dashing = true
        player.dash_start_frame = game.getFrame()
        player.grounded_since_dash = false;
        player.setSize(...PLAYER_DASH_SIZE);
        player.setDisplaySize(...PLAYER_DASH_DISPLAY_SIZE);
        player.setOffset(...PLAYER_DASH_OFFSET)
    }

    // Vertical Velocity enactment
    player.body.y += player.myVelY;
    player.y += player.myVelY;

    for (var i=0; i<5; i++) {
        var delta = player_resolve_vertical();
        if (delta == 0)
            break;
    }

    // Water hazard:
    if (checkOverlap(player, water))
        player_destroy(player);
}

