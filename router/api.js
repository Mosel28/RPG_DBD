const router = require("express").Router();

//lib
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const schedule = require('node-schedule');

//Models
const User = require("../models/User");

const ExitGate = require("../models/game/obstacles/ExitGate");
const Generator = require("../models/game/obstacles/Generator");
const Hook = require("../models/game/obstacles/Hook");
const Player = require("../models/game/Player");
const Session = require("../models/game/Session");
const Token = require("../models/game/Token");

var authCons = [];

router.ws('/', function (ws, req) {
    ws.json = function (data) {
        ws.send(JSON.stringify(data));
    }

    ws.on('message', async function (data) {
        let msg;
        try {
            msg = JSON.parse(data);
        } catch (err) {
            return;
        }

        switch (msg.req) {
            case "login":
                login(ws, msg);
                break;

            case "updatePos":
                console.log("updatePos: " + msg.position);
                updatePos(ws, msg);
                break;

            case "register":
                register(ws, msg);
                break;

            case "logplayer":
                registerPlayer(ws, msg);
                break;

            case "createGame":
                createGame(ws, msg);
                break;

            case "createToken":
                createToken(ws, msg);
                break;

            case "loadGame":
                loadGame(ws, msg);
                break;

            case "kickPlayer":
                kickPlayer(ws, msg);
                break;

            case "quit":
                quit(ws, msg);
                break;

            case "setup":
                setup(ws, msg);
                break;

            case "finishSetup":
                finishSetup(ws, msg, true);
                break;

            case "undoSetup":
                finishSetup(ws, msg, false);
                break;

            case "removeObstacle":
                removeObstacle(ws, msg);
                break;

            case "changePlayerType":
                changePlayerType(ws, msg);
                break;

            case "generatorFailCheck":
                genFailCheck(ws);
                break;

            case "damageGenerator":
                damageGenerator(ws, msg);
                break;

            case "regGeneratorRepair":
                regGeneratorRepair(ws, msg);
                break;

            case "endGeneratorRepair":
                endGeneratorRepair(ws);
                break;

            case "terrorRadius":
                sendTerrorRadius(ws);
                break;

            case "startGame":
                startGame(ws, msg);
                break;

            case "hooked":
                hookPlayer(ws, msg, false);
                break;

            case "unhooked":
                unhookPlayer(ws, msg);
                break;

            case "auth":
                for (let i = 0; i < authCons.length; i++) {
                    if (authCons[i] == ws) {
                        //A authenticated connection is already established
                        return ws.json({req: "authstatus", status: 4001});
                    }
                }
                if (!msg.token) return ws.json({req: "authstatus", status: 401});
                const verified = jwt.verify(msg.token, process.env.TOKEN_SECRET);
                if (!verified) return ws.json({req: "authstatus", status: 401});
                const time = new Date(verified.ctime);
                const expireTime = time.setHours(time.getHours() + 48);
                const now = new Date();
                if (now > expireTime) return ws.json({req: "authstatus", status: 401});
                const u = await User.findOne({_id: verified._id});
                if (!u) return ws.json({req: "authstatus", status: 401});
                ws.user = u;
                const player = await Player.findOne({user: u._id});
                if (player) ws.player = player;

                const isPlayer = await getSession(ws) !== undefined;
                ws.json({req: "authstatus", status: 200, isPlayer: isPlayer});
                authCons.push(ws);
                break;

            default:
        }
    });

    ws.on('close', function (data) {
        for (let i = 0; i < authCons.length; i++) {
            if (authCons[i] == ws) {
                authCons.splice(i, 1);
                break;
            }
        }
    });

    ws.on('error', function (data) {
        ws.close();
    });
});

async function unhookPlayer(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    if (!await isSurvivor(ws)) return;

    const session = await getSession(ws);
    const player = await getPlayer(ws);
    const hooked = await Player.findOne({_id: msg.player});
    if (!hooked) return;
    const hook = await Hook.findOne({uid: msg.hook});

    if (hook.hookedSurvivor === hooked._id) {
        hook.hookedSurvivor = undefined;
        hooked.hookTimer = 0;

        await hook.save();
        await hooked.save();

        await sendJsonToAllSessionMembers(ws, {
            req: "print",
            message: hooked.username + " was removed from the hook ",
            headline: "Unhook"
        }, session._id);
    }
}

async function hookPlayer(ws, msg, stateChange) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    if (!await isKiller(ws)) return;

    const session = await getSession(ws);
    const player = await getPlayer(ws);
    const hooked = await Player.findOne({_id: msg.player});
    if (!hooked) return;
    const hook = await Hook.findOne({uid: msg.hook});
    if (!hook) return;

    if (hooked.hookState === 0) {
        hooked.hookState = 1;
    } else if (hooked.hookState === 1) {
        hooked.hookSate = 2;
    }
    await hooked.save();

    if (stateChange) {
        await sendJsonToAllSessionMembers(ws, {
            req: "print",
            message: hooked.username + "'s hook state is now " + hooked.hookState,
            headline: "Hook state"
        }, session._id);
    } else {
        if (!hook.damaged) {
            hook.hookedSurvivor = hooked._id;
            await hook.save();
            hookTimer(ws, hooked);
        }
    }

    if (player.hookState === 2) {
        await killPlayer(ws, hooked);
    }
}

async function hookTimer(ws, player) {
    setInterval(async function () {
        const player = await Player.findOne({_id: player._id});
        const hook = await Hook.find({hookedSurvivor: player._id});
        if (hook) {
            if (player.hookTimer >= 100) {
                await hookPlayer(ws, {player: player._id, hook: hook.uid}, true)
            } else {
                player.hookTimer = player.hookTimer + 1;
                await player.save();
                hookTimer(ws, player);
            }
        }
    }, 1000)
}

async function killPlayer(ws, player) {
    player.isAlive = false;
    const playerws = await getWsFromPlayer(player);
    playerws.json({req: "dead"});

    const hook = await Hook.findOne({hookedSurvivor: player._id});
    hook.damaged = true;
    await hook.save();
    await player.save();

    await sendJsonToAllSessionMembers(ws, {
        req: "print",
        headline: "Killed",
        message: player.username + " was killed!"
    });
}

async function regGeneratorRepair(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    if (!await isSurvivor(ws)) return;
    const player = await getPlayer(ws);
    if (!player.isAlive) return;
    const generator = await Generator.findOne({uid: msg.generator});
    if (!generator) return;
    if (!player) return;

    if (generator.finished) {
        player.repairingGenerator = undefined;
        await player.save();
        return;
    }

    if (player.repairingGenerator === undefined) {
        player.repairingGenerator = generator._id;
        generator.damaged = false;

        await generator.save();
        await player.save();

        generatorSkillTimer(ws, generator);
        const players = await Player.find({repairingGenerator: generator._id});

        ws.json({
            req: "startGeneratorRepair",
            generator: generator.uid,
            progress: generator.progress,
            players: players.length
        });
    } else {
        if (player.repairingGenerator === generator._id) {
            const threeSecond = 1000 * 3;
            const threeSecondsAgo = Date.now() - threeSecond;

            if (player.lastRepairTime === undefined) {
                generator.progress = generator.progress + 1;
                await generator.save();
                player.lastRepairTime = Date.now();
                await player.save();

                const players = await Player.find({repairingGenerator: generator._id});
                await sendJsonToAllMembersOnGen(ws, generator, {
                    req: "startGeneratorRepair",
                    generator: generator.uid,
                    progress: generator.progress,
                    players: players.length
                });
            } else {
                if (player.lastRepairTime > threeSecondsAgo) {
                    player.lastRepairTime = undefined;
                    player.repairingGenerator = undefined;
                    await player.save();

                    const players = await Player.find({repairingGenerator: generator._id});
                    await sendJsonToAllMembersOnGen(ws, generator, {
                        req: "startGeneratorRepair",
                        generator: generator.uid,
                        progress: generator.progress,
                        players: players.length
                    });

                    await ws.json({req: "endGeneratorRepair"});
                } else {
                    generator.progress = generator.progress + 1;
                    await generator.save();
                    player.lastRepairTime = Date.now();
                    await player.save();
                }
            }
        }
    }
}

async function generatorSkillTimer(ws, generator) {
    setTimeout(async function () {
        const player = await getPlayer(ws);
        if (player.repairingGenerator === generator) {
            ws.json({req: "attemptSkillCheck"});
            generatorSkillTimer(ws);
        }
    }, getRandomInt(10, 40) * 1000);
}

async function genFailCheck(ws) {
    const player = await getPlayer(ws);
    if (!player) return;
    const generator = await Generator.findOne({_id: player.repairingGenerator});
    if (!generator) return;
    await makeDamageOnGen(ws, generator, 5);
}

async function damageGenerator(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    if (!await isKiller(ws)) return;
    const player = await getPlayer(ws);
    if (!player) return;
    const generator = await Generator.findOne({uid: msg.generator});
    if (!generator) return;
    await makeDamageOnGen(ws, generator, 10);
}

async function makeDamageOnGen(ws, gen, damage) {
    if (gen.progress - damage <= 0)
        gen.progress = 0;
    else
        gen.progress = gen.progress - damage;

    await gen.save();
    const players = await Player.find({repairingGenerator: gen._id});
    await sendJsonToAllMembersOnGen(ws, gen, {
        req: "startGeneratorRepair",
        generator: gen.uid,
        progress: gen.progress,
        players: players.length
    });
}

async function endGeneratorRepair(ws) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    const player = await getPlayer(ws);
    if (!player) return;
    player.repairingGenerator = undefined;
    await player.save();
}

async function sendTerrorRadius(ws) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    if (!await isSurvivor(ws)) return;

    let killer = await getKiller(ws);
    let player = await getPlayer(ws);
    console.log(killer)
    console.log(player)
    if (killer === undefined || player === undefined) return;
    let distance = calculateDistance(killer.position[0], player.position[0], killer.position[1], player.position);
    console.log("distance: " + distance);
    if (distance <= 30) {
        if (distance <= 15) {
            ws.json({req: "terror", distance: 15});
        } else if (distance <= 30) {
            ws.json({req: "terror", distance: 30});
        } else {
            ws.json({req: "terror", distance: -1});
        }
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const l = lat1 * Math.PI / 180; // φ, λ in radians
    const y = lat2 * Math.PI / 180;
    const k = (lat2 - lat1) * Math.PI / 180;
    const f = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(k / 2) * Math.sin(k / 2) +
        Math.cos(l) * Math.cos(y) *
        Math.sin(f / 2) * Math.sin(f / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres
    return d;
}

Number.prototype.toRad = function () {
    return this * Math.PI / 180;
}

async function changePlayerType(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    if (!await isEntity(ws)) return ws.json({req: "authstatus", status: 4011});
    const player = await Player.findOne({_id: msg.player});
    if (!player) return;
    switch (msg.type) {
        case "killer":
            player.isKiller = true;
            player.isSurvivor = false;
            break;

        case "survivor":
            player.isKiller = false;
            player.isSurvivor = true;
            break;
    }
    await player.save();
    await reloadGame(ws);
}

async function removeObstacle(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    if (!await isEntity(ws)) return;
    const session = await getSession(ws);
    switch (msg.type) {
        case "generator": {
            const gen = await Generator.findOne({_id: msg.id});
            await gen.remove();
        }
            break;

        case "hook": {
            const hook = await Hook.findOne({_id: msg.id});
            await hook.remove();
        }
            break;

        case "exitGate": {
            const exit = await ExitGate.findOne({_id: msg.id});
            await exit.remove();
        }
            break;
    }
    await sendJsonToEntity(ws, {req: "reload"}, session._id);
}

async function finishSetup(ws, msg, setup) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    if (!await isEntity(ws)) return;
    const session = await getSession(ws);
    switch (msg.type) {
        case "generator": {
            const gen = await Generator.findOne({_id: msg.id});
            gen.setup = setup;
            await gen.save();
        }
            break;

        case "hook": {
            const hook = await Hook.findOne({_id: msg.id});
            hook.setup = setup;
            await hook.save();
        }
            break;

        case "exitGate": {
            const exit = await ExitGate.findOne({_id: msg.id});
            exit.setup = setup;
            await exit.save();
        }
            break;
    }
    await sendJsonToEntity(ws, {req: "reload"}, session._id);
}

async function setup(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    if (!await isEntity(ws)) return;
    const session = await getSession(ws);
    var tk = makeToken(3, true, false, false);

    while (await testUid(tk)) {
        tk = makeToken(3, true, false, false);
    }
    switch (msg.type) {
        case "generator": {
            const gen = new Generator({
                session: session._id,
                progress: 0,
                damaged: false,
                finished: false,
                uid: tk,
                position: msg.position
            });

            await gen.save();
        }
            break;

        case "hook": {
            const hook = new Hook({
                session: session._id,
                damaged: false,
                uid: tk,
                position: msg.position
            });

            await hook.save();
        }
            break;

        case "exitGate": {
            const exit = new ExitGate({
                session: session._id,
                position: msg.position,
                uid: tk
            });

            await exit.save();
        }
            break;
    }
    await sendJsonToEntity(ws, {req: "reload"}, session._id);
}

async function startGame(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    if (!await isEntity(ws)) return ws.json({req: "authstatus", status: 4011});

    const session = await getSession(ws);
    if (!session.setupDone) return ws.json({
        req: "print",
        message: "The setup is not done yet, please enter the setup page to finish the setup process!",
        headline: "Error"
    });

    session.state = 0;
    await session.save();

    await sendJsonToAllSessionMembers(ws, {
        req: "print",
        message: "The entity has started the game! Have fun!",
        headline: "Game start"
    });
    await sendJsonToAllSessionMembers(ws, {req: "reload"});
}

async function testUid(uid) {
    const gens = await Generator.find({uid: uid});
    const hooks = await Hook.find({uid: uid});
    const exits = await ExitGate.find({uid: uid});

    return (gens.length > 0 || hooks.length > 0 || exits.length > 0);
}

async function quit(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    if (await isEntity(ws))
        await destroySession(ws);
    else {
        const player = await getPlayer(ws);
        await reloadGame(ws);
        await player.remove();
    }
}

async function destroySession(ws) {
    const session = await getSession(ws);

    const tokens = await Token.find({session: session._id});
    const generators = await Generator.find({session: session._id});
    const hooks = await Hook.find({session: session._id});
    const players = await Player.find({session: session._id});
    const exitGates = await ExitGate.find({session: session._id});

    const collec = [tokens, generators, hooks, players, exitGates];

    for (const x of collec) {
        for (const x1 of x) {
            await x1.remove();
        }
    }

    await reloadGame(ws);
    await session.remove();
}

async function kickPlayer(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    if (!await isEntity(ws)) return ws.json({req: "authstatus", status: 4011});
    const player = await Player.findOne({_id: msg.player});
    if (player)
        await player.remove();
    else return;

    await reloadGame(ws);
}

async function reloadGame(ws) {
    const session = await getSession(ws);
    await sendJsonToAllSessionMembers(ws, {req: "reload"}, session._id);
}

async function loadGame(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    const session = await getSession(ws);

    const player = await getPlayer(ws);

    if (await isEntity(ws)) {
        if (session.state == 1) {
            await sendTokens(ws);
        }
        const generators = await Generator.find({session: session._id});
        const hooks = await Hook.find({session: session._id});
        const exitGates = await ExitGate.find({session: session._id});

        ws.json({
            req: "loadGame",
            game: {players: await getPlayerData(ws), generators: generators, hooks: hooks, exitGates: exitGates},
            state: session.state,
            isEntity: true
        });
    } else if (!player) {
        ws.json({req: "loadGame", game: "undefined"});
    } else if (player.isSurvivor) {
        if (session.state == 1) {
            await loadQueueGame(ws, msg, session._id, false, true, false);
        } else
            ws.json({req: "loadGame", game: "survivor"});
    } else if (player.isKiller) {
        if (session.state == 1) {
            await loadQueueGame(ws, msg, session._id, false, false, true);
        } else
            ws.json({req: "loadGame", game: "killer"});
    } else if (player) {
        if (session.state == 1) {
            await loadQueueGame(ws, msg, session._id, false, false, false);
        } else
            ws.json({req: "loadGame", game: "queue"});
    } else {
        ws.json({req: "loadGame", game: "undefined"});
    }
}

async function loadQueueGame(ws, msg, sessionid, isEntity, isSurvivor, isKiller) {
    const session = await Session.findOne({_id: sessionid});
    ws.json({
        req: "loadGame",
        game: {players: await getPlayerData(ws)},
        state: session.state,
        isEntity: isEntity,
        isKiller: isKiller,
        isSurvivor: isSurvivor
    });
}

async function updatePos(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    if (ws.player === undefined) return ws.json({req: "authstatus", status: 4011});
    const player = await Player.findOne({_id: ws.player._id});
    if (!player) return;
    player.position = msg.position;
    await player.save();
}

async function createGame(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    const sessions = await Session.find({entity: ws.user._id});
    if (sessions.length > 0) return;

    const cSession = new Session({
        entity: ws.user._id,
        state: 1
    });
    await cSession.save();

    await loadGame(ws, msg);
}

async function createToken(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    if (!await isEntity(ws)) return;

    const allTokens = await Token.find({session: await getEntitySession(ws)});
    const players = await getPlayers(ws);
    const session = await getSession(ws);

    if (allTokens.length + players.length >= session.maxPlayers) return ws.json({req: "authstatus", status: 400});

    var tk;
    while (true) {
        tk = makeToken(5, true, false, true);
        const testToken = await Token.find({token: tk});
        if (testToken.length === 0) break;
    }

    const token = new Token({
        session: await getEntitySession(ws),
        token: tk
    });

    await token.save()
    await sendTokens(ws);
}

async function sendTokens(ws) {
    const session = await getSession(ws);
    const allTokens = await Token.find({session: session._id});
    var tokenData = [];
    for (const tokken of allTokens) {
        tokenData.push(tokken.token);
    }
    await sendJsonToEntity(ws, {req: "token", tokens: tokenData}, session._id);
}

async function registerPlayer(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
    const token = await Token.findOne({token: msg.token});
    if (!token) return ws.json({req: "print", message: "Token invalid!"});

    const testplayer = await Player.findOne({user: ws.user._id});
    if (testplayer) return ws.json({req: "authstatus", status: 400});

    const cPlayer = new Player({
        session: token.session,
        user: ws.user._id
    });

    const savedPlayer = await cPlayer.save();
    ws.player = savedPlayer;
    reAuth(ws);
    await loadGame(ws, msg);
    await reloadGame(ws);
    await token.remove();
    await sendTokens(ws);
}

async function getPlayerData(ws) {
    const session = await getSession(ws);
    const players = await Player.find({session: session._id});
    var isEnt = await isEntity(ws);
    let playerlist = [];
    for (const player of players) {
        player.usr = await User.findOne({_id: player.user});
        if (isEnt)
            playerlist.push({
                name: player.usr.username, isKiller: player.isKiller, isSurvivor: player.isSurvivor, _id: player._id
            });
        else
            playerlist.push({name: player.usr.username, isKiller: player.isKiller, isSurvivor: player.isSurvivor});
    }
    return playerlist;
}

async function login(ws, message) {
    //Check if the user is in db
    const user = await User.findOne({username: message.username.toLowerCase()});
    if (!user) return ws.json({req: "print", message: "Username or password is wrong!"});

    //Check if password is correct
    const validPass = await bcrypt.compare(message.password, user.password);
    if (!validPass) return ws.json({req: "print", message: "Username or password is wrong!"});

    //Create and assing a token
    const time = new Date();
    const token = jwt.sign({_id: user._id, ctime: time}, process.env.TOKEN_SECRET);
    ws.json({req: "done", token: token, message: "Login successful"})
}

async function register(ws, message) {
    let errmsg = "";
    let err = false;
    if (message.username.length < 5) {
        errmsg += "The username should have a least 5 characters";
        err = true;
    }
    if (message.password.length < 8) {
        errmsg += "The password should have a least 8 characters";
        err = true;
    }
    if (message.password.length > 30) {
        errmsg += "The password should not have more than 30 characters\n";
        err = true;
    }
    if (message.username.length > 30) {
        errmsg += "The username should not have more than 30 characters\n";
        err = true;
    }
    if (err) {
        ws.json({req: "print", message: errmsg});
        return;
    }
    const userExists = await User.findOne({username: message.username.toLowerCase()});
    if (userExists) return ws.json({req: "print", message: "Username already exists"});

    //Hashing password
    const hashPassword = await hashPw(message.password);

    //Create new user
    const cUser = new User({
        username: message.username.toLowerCase(),
        password: hashPassword
    });

    try {
        const savedUser = await cUser.save();
        ws.json({req: "done"});
    } catch (err) {
        ws.json({req: "print", message: "error while creating new user!", error: err});
    }
}

async function getKiller(ws) {
    const players = await Player.find({session: ws.player.session});
    for (const player of players) {
        if (player.isKiller)
            return player;
    }
}

async function getWsFromPlayer(player) {
    for (const cc of authCons) {
        if (cc.player !== undefined)
            if (cc.player._id === player._id)
                return cc;
    }
}

async function getSession(ws) {
    if (await isEntity(ws)) {
        const session = await Session.findOne({entity: ws.user._id});
        return session;
    } else {
        const player = await getPlayer(ws);
        if (player == undefined)
            return undefined;
        else
            return await Session.findOne({_id: ws.player.session});
        ;
    }
}

async function getPlayer(ws) {
    const players = await Player.findOne({user: ws.user._id});
    ws.player = players;
    return players;
}

async function getPlayers(ws) {
    var playerdata = [];

    const session = await getSession(ws);

    const players = await Player.find({session: session._id});
    for (let i = 0; i < players.length; i++)
        if (players[i].player !== undefined)
            if (players[i].player.session === session._id)
                playerdata.push(players[i]);

    return playerdata;
}

async function sendJsonToAllSessionMembers(ws, msg, sessionid) {
    for (let i = 0; i < authCons.length; i++) {
        if (authCons[i].player != undefined)
            if (authCons[i].player.session.equals(sessionid))
                authCons[i].json(msg);
    }
    await sendJsonToEntity(ws, msg, sessionid);
}

async function sendJsonToAllMembersOnGen(ws, gen, msg) {
    for (let i = 0; i < authCons.length; i++) {
        if (authCons[i].player != undefined)
            if (authCons[i].player.repairingGenerator === gen._id)
                authCons[i].json(msg);
    }
}

async function sendJsonToEntity(ws, msg, sessionid) {
    if (await isEntity(ws)) {
        ws.json(msg);
    } else {
        for (let i = 0; i < authCons.length; i++) {
            if (await isEntity(authCons[i])) {
                if (sessionid.equals(ws.player.session)) {
                    authCons[i].json(msg);
                    break;
                }
            }
        }
    }
}

function reAuth(ws) {
    for (let i = 0; i < authCons.length; i++) {
        if (ws.user._id === authCons[i].user._id) {
            authCons.splice(i, 1);
            authCons.push(ws);
            break;
        }
    }
}

function isAuth(ws) {
    if (ws.user == undefined)
        return false;

    var found = false;
    for (let i = 0; i < authCons.length; i++) {
        if (ws === authCons[i])
            found = true;
    }

    return found;
}

async function isEntity(ws) {
    const session = await Session.findOne({entity: ws.user._id});
    if (!session) return false;
    return true;
}

async function isKiller(ws) {
    const player = await getPlayer(ws);
    return player.isKiller;

}

async function isSurvivor(ws) {
    const player = await getPlayer(ws);
    return player.isSurvivor;

}

async function getEntitySession(ws) {
    const session = await Session.findOne({entity: ws.user._id});
    if (!session) return undefined;
    return session._id;
}

async function hashPw(pw) {
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(pw, salt);
    return hashPassword;
}

function makeToken(length, capital, small, number) {
    var result = '';
    var characters = '';
    var capitals = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    var smalls = 'abcdefghijklmnopqrstuvwxyz';
    var numbers = '0123456789';

    if (capital)
        characters += capitals;
    if (small)
        characters += smalls;
    if (number)
        characters += numbers;

    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

module.exports = router;