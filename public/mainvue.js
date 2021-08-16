var reg = new Vue({
    el: '#main',
    data: {
        loggedIn: false,
        isPlayer: false,
        ws: undefined
    },
    created: async function () {
        this.ws = connectWs(this.handleMessage);
    },
    methods: {
        handleMessage(msg){
            switch (msg.req){
                case "authstatus":
                    if(msg.status === 200){
                        this.loggedIn = true;
                        this.isPlayer = msg.isPlayer;
                    }
                    break;
            }
        }
    }
});