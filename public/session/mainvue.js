var reg = new Vue({
    el: '#entity',
    data: {
        players: [],
        killers: [],
        survivors: [],

        hooks: [],
        gameKey: "",
        tokens: [],
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

        notificationTimeout: 0,

        playerSelectedToHook: undefined,

        message: "",
        messageHeadline: "",
        messageTopStyle: "top: -30%",
        messageTimeout: 0,

        damageBar: '0%',
        ws: undefined
    },
    created: async function () {
        this.ws = connectWs(this.handleMessage, function (reconnect) {
            reg.ws.json({req: "loadGame"});
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
                            this.shown = true;
                        } else if (msg.state === 0) {
                            this.queueShown = false;
                            this.createGameShown = false;
                            this.gameShown = true;
                            this.shown = false;
                            if (!this.isEntity)
                                this.watchLocation();
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
            if (this.generatorID == -1 || this.generatorTimeOut <= -1 || this.generatorProgress >= 100)
                return;

            if (this.generatorClickSpam) {
                this.generatorClickSpam = false;
                this.generatorTimeOut = 5;
            } else {
                this.generatorTimeOut--;
            }
            this.generatorProgress++;
            this.updateGeneratorProgress(generatorProgress);
            if (this.generatorProgress >= 100) {
                console.log("Killer has damaged generator")
                socket.json({
                    req: "damageGenerator"
                });
            }
        },
        selectHookedPlayer: function (id) {
            this.playerSelectedToHook = id;
        },
        clearMessages: function () {
            this.message = "";
            this.messageHeadline = "";
            this.messageTopStyle = "top: -30%";
        },
        showMessage: function (headline, message){
            this.clearMessages();
            this.messageTimeout = 10;
            this.message = message;
            this.messageHeadline = headline;
            this.messageTopStyle = "top: 0px";
            this.messageTimer();
        },
        messageTimer: function (){
            setTimeout(function (){
                if(reg.messageTimeout > 0){
                    reg.messageTimeout --;
                    reg.messageTimer();
                } else {
                    reg.clearMessages();
                }
            }, 1000);
        },
        startGame: function (){
            this.ws.json({req: "startGame"});
        }
    }
});