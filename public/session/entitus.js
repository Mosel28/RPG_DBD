"use strict"
let webSocket = new WebSocket('ws://192.168.178.99:5011/api/dbm');

webSocket.onopen = function (event)
{
    console.log("Message send");
    webSocket.send("Fuck it, it runs!");
}

webSocket.onmessage = function (event)
{
    console.log(event.data);
}