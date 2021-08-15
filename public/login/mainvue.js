var reg = new Vue({
    el: '#login',
    data: {
        username: "",
        password: "",
        message: "",
        ws: undefined
    },
    created: async function () {
        this.ws = connectWs(this.handleMessage);
    },
    methods: {
        handleMessage: async function (msg){
            switch (msg.req){
                case "print":
                    this.message = msg.message;
                    break;

                case "done":
                    saveToken(msg.token);
                    //window.location.replace("/");
                    ws.json({req: "auth", token: msg.token});
                    break;

                case "authstatus":
                    console.log(msg.status);
                    break;
            }
        },
        login() {
            let errmsg = "";
            let err = false;
            if(this.username.length < 5){
                errmsg += "The username should have a least 5 characters";
                err = true;
            }
            if(this.password.length < 8){
                errmsg += "The password should have a least 8 characters";
                err = true;
            }
            if(err){
                this.message = errmsg;
                return;
            }
            this.ws.json({req: "login", password: this.password, username: this.username});
        }
    }
});