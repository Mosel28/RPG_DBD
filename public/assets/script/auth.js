let ws;
let handler;
let reconnect = false;

function auth(){
    ws.json({req: "auth", token: getToken()});
    if(ws.onReady !== undefined)
        ws.onReady(reconnect);

    reconnect = true;
}

function getToken() {
    return getCookie("auth");
}

function saveToken(token) {
    setCookie("auth", token, 7);
}

function getSocketUrl() {
    var new_uri;
    if (window.location.protocol === "https:") {
        new_uri = "wss:";
    } else {
        new_uri = "ws:";
    }
    new_uri += "//" + window.location.host + "/api/ws";
    return new_uri;
}

function connectWs(hand, onReady) {
    handler = hand;
    ws.onReady = onReady;
    createWs();
    return ws;
}

function getWs(){
    return ws;
}

function createWs(){
    ws = new WebSocket(getSocketUrl());

    ws.onopen = function (event) {
        console.log("Websocket connected");
        auth();
    }

    ws.onclose = function (event) {
        console.log("Websocket lost connection");
        ws.close();
        setTimeout(function (){
            createWs(ws);
        }, 2000);
    }

    ws.onerror = function (event){
        console.log("Websocket had an error");
        ws.close();
    }

    ws.onmessage = async function (event) {
        handler(JSON.parse(event.data));
    }

    ws.json = function (data) {
        ws.send(JSON.stringify(data));
    }
}

function getCookie(name) {
    var v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return v ? v[2] : null;
}

function setCookie(name, value, days) {
    var d = new Date;
    d.setTime(d.getTime() + 24 * 60 * 60 * 1000 * days);
    document.cookie = name + "=" + value + ";path=/;expires=" + d.toGMTString();
}

function deleteCookie(name) {
    setCookie(name, '', -1);
}