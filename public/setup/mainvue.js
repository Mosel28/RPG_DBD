var reg = new Vue({
    el: '#entity',
    data: {
        game: {},
        ready: false,
        message: "",
        latitude: 0,
        longitude: 0,
        ws: undefined
    },
    created: async function () {
        this.ws = connectWs(this.handleMessage, function (connection){
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

                    } else {
                        this.game = msg.game;
                        this.ready = true;
                    }
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
        createHook: function () {
            this.updateGPS();
            setTimeout(function (){
                reg.ws.json({req: "setup", type: "hook", position:[this.latitude, this.longitude]});
            }, 1000)
        },
        createGen: function () {
           this.updateGPS();
            setTimeout(function (){
                reg.ws.json({req: "setup", type: "generator", position:[this.latitude, this.longitude]});
            }, 1000)
        },
        createExit: function () {
            this.updateGPS();
            setTimeout(function (){
                reg.ws.json({req: "setup", type: "exitGate", position:[this.latitude, this.longitude]});
            }, 1000)
        },
        removeGate: function (id) {
            reg.ws.json({req: "removeObstacle", type: "exitGate", id: id});
        },
        removeGen: function (id) {
            reg.ws.json({req: "removeObstacle", type: "generator", id: id});
        },
        removeHook: function (id) {
            reg.ws.json({req: "removeObstacle", type: "hook", id: id});
        },
        geoSuccess: function (position){
            this.latitude = position.coords.latitude;
            this.longitude = position.coords.longitude;
        },
        geoError: function (error){

        },
        updateGPS: function (){
            var geo_options = {
                enableHighAccuracy: true,
                maximumAge: 30000,
                timeout: 27000
            };
            navigator.geolocation.getCurrentPosition(this.geoSuccess, this.geoError, geo_options);
        },
        finishSetup: function (type, id){
            reg.ws.json({req: "finishSetup", type: type, id: id});
        },
        undoSetup: function (type, id){
            reg.ws.json({req: "undoSetup", type: type, id: id});
        }
    }
});