var reg = new Vue({
    el: '#entity',
    data: {
        players: "",
        hooks: "",
        gameShown: false,
        createGameShown: false,
        queueShown: false,
        gameKey: "",
        tokens: [],
        isEntity: false,
        ws: undefined
    },
    created: async function () {
        this.ws = connectWs(this.handleMessage);

        setTimeout(function (){
            reg.ws.json({req: "loadGame"});
        }, 60);
    },
    methods: {
        handleMessage: function (msg){
            console.log(JSON.stringify(msg));
            switch (msg.req){
                case "loadGame":
                    if(msg.game === "undefined"){
                        this.queueShown = false;
                        this.createGameShown = true;
                        this.gameShown = false;
                    }
                    else {
                        this.isEntity = msg.isEntity;
                        if(msg.state === 1){
                            this.players = msg.game.players;
                            this.queueShown = true;
                            this.createGameShown = false;
                            this.gameShown = false;
                        } else if(msg.state === 0){
                            this.queueShown = false;
                            this.createGameShown = false;
                            this.gameShown = true;
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
                    if(msg.status === 401)
                        location.replace("/login");
                    break;
            }
        },
        createGame: function (){
            this.ws.json({req: "createGame"});
        },
        join: function (){
            this.ws.json({req: "logplayer", token: this.gameKey});
        },
        createToken: function (){
            this.ws.json({req: "createToken"});
        },
        kickPlayer: function (id){
            console.log(id);
            this.ws.json({req: "kickPlayer", player: id});
        }
    }
});