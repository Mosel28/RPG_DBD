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

            case "removeObstacle":
                removeObstacle(ws, msg);
                break;

            case "regTerrorRadius":
                const job = schedule.scheduleJob({second: .1}, async function () {
                    if (!isAuth(ws)) return job.cancel();
                    let killer = getKiller(ws);
                    let player = getPlayer(ws);
                    let distance = Math.sqrt(Math.pow((killer.position[0] - player.position[0]), 2) + Math.pow((killer.position[1] - player.position[1]), 2));
                    if (distance <= 30) {
                        if (distance <= 15) {
                            ws.json({req: "terror", distance: 15});
                        } else {
                            ws.json({req: "terror", distance: 30});
                        }
                    }
                })
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

async function removeObstacle(ws, msg) {
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

async function setup(ws, msg) {
    const session = await getSession(ws);
    var tk = makeToken(10);

    while (await testUid(tk)) {
        tk = makeToken(10);
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
    } else if (getPlayer(ws).isSurvivor) {
        if (session.state == 1) {
            await loadQueueGame(ws, msg, session._id, false);
        } else
            ws.json({req: "loadGame", game: "survivor"});
    } else if (getPlayer(ws).isKiller) {
        if (session.state == 1) {
            await loadQueueGame(ws, msg, session._id, false);
        } else
            ws.json({req: "loadGame", game: "killer"});
    } else if (await getPlayer(ws)) {
        if (session.state == 1) {
            await loadQueueGame(ws, msg, session._id, false);
        } else
            ws.json({req: "loadGame", game: "queue"});
    } else {
        ws.json({req: "loadGame", game: "undefined"});
    }
}

async function loadQueueGame(ws, msg, sessionid, isEntity) {
    const session = await Session.findOne({_id: sessionid});
    ws.json({req: "loadGame", game: {players: await getPlayerData(ws)}, state: session.state, isEntity: isEntity});
}

async function updatePos(ws, msg) {
    if (!await isAuth(ws)) return ws.json({req: "authstatus", status: 401});
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
        tk = makeToken(5);
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
            playerlist.push({name: player.usr.username, _id: player._id});
        else
            playerlist.push({name: player.usr.username});
    }
    return playerlist;
}

async function login(ws, message) {
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
    if (err) {
        ws.json({req: "print", message: errmsg});
        return;
    }
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

function makeToken(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

module.exports = router;