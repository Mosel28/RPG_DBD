var reg = new Vue({
    el: '#register',
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
        handleMessage(msg){
            switch (msg.req){
                case "print":
                    this.message = msg.message;
                    break;

                case "done":
                    window.location.replace("/login");
                    break;
            }
        },
        register() {
            this.message = "";
            let errmsg = "";
            let err = false;
            if(this.username.length < 5){
                errmsg += "The username should have a least 5 characters\n";
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
            this.ws.json({req: "register", password: this.password, username: this.username});
        }
    }
});