var reg = new Vue({
    el: '#entity',
    data: {
        players: [],
        killers: [],
        survivors: [],

        hookedPlayer: [],

        hooks: [],
        tokens: [],

        gameKey: "",
        shown: false,
        menuState: 0,
        active: "context-menu--active",
        gameState: 0,
        latitude: 0,
        longitude: 0,
        isPositionGranted: false,

        gameShown: false,
        createGameShown: false,
        queueShown: false,

        isEntity: false,
        isKiller: false,
        isSurvivor: false,

        generatorId: 0,
        generatorTimeOut: 5,
        generatorClickSpam: false,
        generatorProgress: 0,

        playerSelectedToHook: undefined,

        notificationTimeout: 0,
        message: "",
        messageHeadline: "",
        messageTopStyle: "top: -30%",
        messageTimeout: 0,

        hookUid: "",

        activeSkillcheck: undefined,

        isWatchingLocation: false,

        skillcheck: {
            progress: 0, //0...100
            posOkStart: 20, //start of skill check success area
            posOkEnd: 50, //end of skill check success ares
            timeStep: 1, //steps size * 40ms
            active: false, //finished?
        },

        damageBar: '0%',
        ws: undefined
    },
    created: async function () {
        this.ws = connectWs(this.handleMessage, function (reconnect) {
            reg.ws.json({req: "loadGame"});
            setInterval(reg.updateGeneratorTask, 500);
        });
    },
    methods: {
        toggleQueue: function () {
            if (this.queueShown && !this.isEntity) {
                return;
            } else
                this.shown = !this.shown;
        },
        handleMessage: function (msg) {
            console.log(JSON.stringify(msg));
            switch (msg.req) {
                case "loadGame":
                    if (msg.game === "undefined") {
                        this.queueShown = false;
                        this.createGameShown = true;
                        this.gameShown = false;
                        this.isEntity = false;
                        this.isKiller = false;
                        this.isSurvivor = false;
                        this.shown = true;
                    } else {
                        this.isEntity = msg.isEntity;
                        this.isSurvivor = msg.isSurvivor;
                        this.isKiller = msg.isKiller;
                        if (msg.state === 1) {
                            this.queueShown = true;
                            this.createGameShown = false;
                            this.gameShown = false;
                            if(!this.isEntity)
                            this.shown = true;
                        } else if (msg.state === 0) {
                            this.queueShown = false;
                            this.createGameShown = false;
                            this.gameShown = true;
                            this.shown = false;
                            if (!this.isEntity && !this.isWatchingLocation){
                                this.watchLocation();
                                this.isWatchingLocation = true;
                            }
                        }

                        this.gameState = msg.state;
                        this.players = msg.game.players;
                        this.killers = [];
                        this.survivors = [];

                        for (const pl of this.players) {
                            if (pl.isKiller)
                                this.killers.push(pl);
                            if (pl.isSurvivor)
                                this.survivors.push(pl);
                        }
                    }
                    break;
                case "updateplayers":
                    this.players = msg.players;
                    break;

                case "token":
                    this.tokens = msg.tokens;
                    break;

                case "reload":
                    reg.ws.json({req: "loadGame"});
                    break;

                case "authstatus":
                    if (msg.status === 401)
                        location.replace("/login");
                    break;

                case "print":
                    this.showMessage(msg.headline, msg.message);
                    break;

                case 'coords':
                    this.updateCompass(msg.latitude, msg.longitude);
                    break;
                case 'notification':
                    this.showNotification(msg.caption, msg.message);
                    break;
            }
        },
        createGame: function () {
            this.ws.json({req: "createGame"});
        },
        join: function () {
            this.ws.json({req: "logplayer", token: this.gameKey});
        },
        createToken: function () {
            this.ws.json({req: "createToken"});
        },
        kickPlayer: function (id) {
            this.ws.json({req: "kickPlayer", player: id});
        },
        quit: function () {
            this.ws.json({req: "quit"});
        },
        toggleMenu: function (menu) {
            if (this.menuState !== 1) {
                this.menuState = 1;
                menu.classList.add(this.active);
            } else if (this.menuState !== 0) {
                this.menuState = 0;
                menu.classList.remove(this.active);
            }
        },
        changePlayerType: function (id, type) {
            this.ws.json({req: "changePlayerType", player: id, type: type});
        },
        geoSuccess: function (position) {
            this.latitude = position.coords.latitude;
            this.longitude = position.coords.longitude;
            this.ws.json({
                req: "updatePos",
                position: [position.coords.latitude, position.coords.longitude]
            });
        },
        geoError: function (error) {

        },
        watchLocation: function () {
            navigator.permissions.query({name: 'geolocation'})
                .then(function (p) {
                    this.isPositionGranted = p.state === "granted";
                    console.log("Permission acces is " + p.state);
                });
            var geo_options = {
                enableHighAccuracy: true,
                maximumAge: 30000,
                timeout: 27000
            };
            navigator.geolocation.watchPosition(this.geoSuccess, this.geoError, geo_options);
        },
        updateGeneratorProgress: function updateGeneratorProgress(percent) //(0...100)
        {
            if (percent < 0 || percent > 100) {
                console.exception("Was soll die Scheise? Kannst du nicht bis 100 zählen im Zahlenraum N??")
            }
            let progress = 80 / 100 * percent;
            this.damageBar = progress + '%';
        },
        updateGeneratorTask: function () {
            if (this.generatorID == -1 || this.generatorTimeOut <= -1)
                return;

            if (this.generatorTimeOut == 0)
                this.ws.json({
                    req: "endGeneratorRepair"
                })

            if (this.generatorClickSpam) {
                this.generatorClickSpam = false;
                this.generatorTimeOut = 5;
            } else {
                this.generatorTimeOut--;
            }
        },
        clickSpamGenerator: function () {
            generatorClickSpam = true;
        },
        selectHookedPlayer: function (id) {
            this.playerSelectedToHook = id;
        },
        clearMessages: function () {
            this.message = "";
            this.messageHeadline = "";
            this.messageTopStyle = "top: -30%";
        },
        showMessage: function (headline, message) {
            this.clearMessages();
            this.messageTimeout = 10;
            this.message = message;
            this.messageHeadline = headline;
            this.messageTopStyle = "top: 0px";
            this.messageTimer();
        },
        messageTimer: function () {
            setTimeout(function () {
                if (reg.messageTimeout > 0) {
                    reg.messageTimeout--;
                    reg.messageTimer();
                } else {
                    reg.clearMessages();
                }
            }, 1000);
        },
        startGame: function () {
            this.ws.json({req: "startGame"});
        },
        unhook: function (player) {
            this.ws.json({req: "unhook", player: player, hook: this.hookUid});
        },
        initSkillCheck: function (difficulty = 2) {
            if (difficulty > 3 || difficulty < 1) {
                console.exception("Wrong Skill Check Init Parameter! Read Commentary!");
                difficulty = 1;
            }

            if (this.skillcheck.active)
                if (skillcheck.progress <= 100)
                    return;
            let successAreaSize = 10 + 10 / difficulty;

            this.skillcheck.progress = -50;
            this.skillcheck.posOkStart = Math.random() * (100 - successAreaSize);
            this.skillcheck.posOkEnd = this.skillcheck.posOkStart + successAreaSize;
            this.skillcheck.timeStep = 0.5 + 2 / difficulty;
            this.skillcheck.active = true;

            let c = document.getElementById("skillCheckSucessArea");
            let ctx = c.getContext("2d");

            ctx.clearRect(0, 0, c.width, c.height);
            ctx.beginPath();
            ctx.arc(150, 150, 150, 2 * Math.PI / 100 * this.skillcheck.posOkStart - Math.PI / 2, 2 * Math.PI / 100 * this.skillcheck.posOkEnd - Math.PI / 2);
            ctx.strokeStyle = '#CC4400';
            ctx.lineWidth = 10
            ctx.stroke();
            let skillCheckPointer = document.getElementById("skillCheckPointer");
            skillCheckPointer.style.visibility = "visible";

            function processSkillcheck() {
                if (!reg.skillcheck.active) clearInterval(reg.activeSkillcheck);
                reg.skillcheck.progress = reg.skillcheck.progress + reg.skillcheck.timeStep;

                //Update UI Skill check here
                let rotation = 360 / 100 * reg.skillcheck.progress
                if (reg.skillcheck.progress > 0) {
                    c.style.visibility = 'visible';
                    skillCheckPointer.style.transform = 'rotate(' + rotation + 'deg)';
                }


                if (reg.skillcheck.progress > 100) {
                    // skillCheckPointer.style.backgroundColor = "red"
                    reg.stopSkillCheck()
                    reg.playSoundSkillCheck();
                }
            }


            this.activeSkillcheck = setInterval(processSkillcheck, 20);
        },
        stopSkillCheck: function () {
            clearInterval(this.activeSkillcheck)
            let skillCheckPointer = document.getElementById("skillCheckPointer");
            let skillCheckSucessArea = document.getElementById("skillCheckSucessArea");
            this.skillcheck.active = false;
            skillCheckSucessArea.style.visibility = 'hidden'
            skillCheckPointer.style.visibility = "hidden";
        },
        playSoundSkillCheck: function () {
            this.playSound("/assets/sounds/SkillCheck.mp3");
        },
        playSound: function (filename) {
            const sound = new Audio(filename);
            sound.play();
        },
        playSoundSkillCheckSuccess: function () {

        },

        playSoundSkillCheckFail: function () {

        },
        clickSkillCheck: function () {
            if (!this.skillcheck.active) return;
            if (this.skillcheck.progress >= this.skillcheck.posOkStart && this.skillcheck.progress <= this.skillcheck.posOkEnd) {
                this.stopSkillCheck();
                this.playSoundSkillCheckSuccess();
            } else {
                this.stopSkillCheck();
                this.playSoundSkillCheckFail();

                this.ws.json({
                    req: "generatorFailCheck",
                    generator: this.generatorId
                });
            }
        }
    }
});