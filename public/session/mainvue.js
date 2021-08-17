var reg = new Vue({
    el: '#entity',
    data: {
        players: [],
        killers: [],
        survivors: [],
        hooks: "",
        gameShown: false,
        createGameShown: false,
        queueShown: false,
        gameKey: "",
        tokens: [],
        isEntity: false,
        message: "",
        shown: false,
        menuState: 0,
        active: "context-menu--active",
        gameState: 0,
        latitude: 0,
        longitude: 0,
        isPositionGranted: false,
        ws: undefined
    },
    created: async function () {
        await setupNFC();
        await readTag();
        this.watchLocation();
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
                        this.shown = true;
                    } else {
                        this.isEntity = msg.isEntity;
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
                    this.message = msg.message;
                    break;
            }
        },
        sendPosition: function () {
            reg.ws.json({req: "updatePos", position: [this.latitude, this.longitude]});
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
        },
        geoError: function (error) {

        },
        watchLocation: function () {
            navigator.permissions.query({ name: 'geolocation' })
                .then(function (p){
                    this.isPositionGranted = p.state === "granted";
                    console.log("Permission acces is " + p.state);
                });
            var geo_options = {
                enableHighAccuracy: true,
                maximumAge        : 30000,
                timeout           : 27000
            };
            navigator.geolocation.watchPosition(this.geoSuccess, this.geoError, geo_options);
        },
        startNfc: function (){

        }
    }
});

var ndef;

async function setupNFC(){
    if ("NDEFReader" in window) {
        ndef = new NDEFReader();
    } else {
        console.log("Web NFC is not supported.");
    }

    ndef.onreading = event => {
        const decoder = new TextDecoder();
        for (const record of event.message.records) {
            console.log("Record type:  " + record.recordType);
            console.log("MIME type:    " + record.mediaType);
            console.log("=== data ===\n" + decoder.decode(record.data));
        }
    }
}

async function readTag() {
    if(ndef !== undefined)
        await ndef.scan();
}

async function writeTag() {
    if ("NDEFReader" in window) {
        const ndef = new NDEFReader();
        try {
            await ndef.write("What Web Can Do Today");
            console.log("NDEF message written!");
        } catch(error) {
            console.log(error);
        }
    } else {
        console.log("Web NFC is not supported.");
    }
}