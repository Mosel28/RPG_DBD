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
        reload: false,
        gameState: 0,
        ws: undefined
    },
    created: async function () {
        this.ws = connectWs(this.handleMessage, function (reconnect){
            reg.ws.json({req: "loadGame"});
        });
    },
    methods: {
        toggleQueue: function () {
            if(this.queueShown && !this.isEntity) {
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
                        if(!this.reload || this.gameState !== msg.state && !this.isEntity){
                            this.reload = true;
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
                        }
                        this.gameState = msg.state;
                        this.players = msg.game.players;
                        this.killers = [];
                        this.survivors = [];

                        for(const pl of this.players){
                            if(pl.isKiller)
                                this.killers.push(pl);
                            if(pl.isSurvivor)
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
            if ( this.menuState !== 1 ) {
                this.menuState = 1;
                menu.classList.add(this.active);
            }else if ( this.menuState !== 0 ) {
                this.menuState = 0;
                menu.classList.remove(this.active);
            }
        },
        changePlayerType: function (id, type){
            this.ws.json({req: "changePlayerType", player: id, type: type});
        }
    }
});