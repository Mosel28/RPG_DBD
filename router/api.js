const router = require("express").Router();

//lib
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

//Models
const User = require("../models/User");

const ExitGate = require("../models/game/obstacles/ExitGate");
const Generator = require("../models/game/obstacles/Generator");
const Hook = require("../models/game/obstacles/Hook");
const Player = require("../models/game/Player");
const Session = require("../models/game/Session");

var authCons = [];

router.ws('/',  function (ws, req) {
    ws.json = function (data){
        ws.send(JSON.stringify(data));
    }

    ws.on('message', async function (data) {
        let msg;
        try {
            msg = JSON.parse(data);
        } catch (err){
            return;
        }

        switch (msg.req) {
            case "login":
                login(ws, msg);
                break;

            case "register":
                register(ws, msg);
                break;

            case "auth":
                for (let i = 0; i < authCons.length; i++) {
                    if(authCons[i] == ws){
                        //A authenticated connection is already established
                        return ws.json({req: "authstatus", status: 4011});
                    }
                }
                const verified = jwt.verify(msg.token, process.env.TOKEN_SECRET);
                if(!verified) return ws.json({req: "authstatus", status: 401});
                const time = new Date(verified.ctime);
                const expireTime = time.setHours(time.getHours() + 48);
                const now = new Date();
                if (now > expireTime) return ws.json({req: "authstatus", status: 401});
                const u = await User.findOne({ _id: verified._id });
                if (!u) return ws.json({req: "authstatus", status: 401});
                ws.user = u;
                ws.json({req: "authstatus", status: 200});
                authCons.push(ws);
                for (let i = 0; i < authCons.length; i++) {
                    console.log(authCons[i].user._id);
                }
                break;

            default:
                console.log("Unknown");
        }
    });

    ws.on('close',  function (data) {
        for (let i = 0; i < authCons.length; i++) {
            if(authCons[i] == ws){
                authCons.splice(i, 1);
                break;
            }
        }

        for (let i = 0; i < authCons.length; i++) {
            console.log(authCons[i].user._id);
        }
    });

    ws.on('error',  function (data) {
        ws.close();
    });
});

async function createGame(ws, msg){

}

async function login(ws, message) {
    let errmsg = "";
    let err = false;
    if(message.username.length < 5){
        errmsg += "The username should have a least 5 characters";
        err = true;
    }
    if(message.password.length < 8){
        errmsg += "The password should have a least 8 characters";
        err = true;
    }
    if(err){
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
    if(message.username.length < 5){
        errmsg += "The username should have a least 5 characters";
        err = true;
    }
    if(message.password.length < 8){
        errmsg += "The password should have a least 8 characters";
        err = true;
    }
    if(err){
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