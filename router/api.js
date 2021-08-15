const router = require("express").Router();

router.ws('/', function(ws, req) {
    ws.on('message', function(msg) {
        ws.send(msg);
        console.log(msg);
    });
});

module.exports = router;