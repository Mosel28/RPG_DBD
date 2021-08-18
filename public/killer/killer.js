/*
Global stuff
*/
const playerCoordinates = {
        latitude: 0,
        longitude: 0,
    }
    //Generator Id that is selected.
let generatorID = -1; //
let generatorTimeOut = 5; //Time until you have to rescan NFC Code
let generatorClickSpam = false; //true if clicked 
let generatorProgress = 0;
//
let notificationTimeout = 0;
let notificationBox = document.getElementById("notification");
let notificationBoxCaption = document.getElementById("caption");
let notificationBoxMessage = document.getElementById("message");
//Hook System
let playerSelectedToHook = undefined;

/*
Vue Stuff UWU
*/
let playerSurvivor = []; //Hier kommen die Survivor rein

/*  let hooks = [{
      id: 1
  }, {
      id: 2
  }]*/

Vue.component('entry-component', { //global
    //Optionen
    props: ['entry', 'player'], //binden, verwendbar wie ein Datenatribut
    template: `
        <div class="playerCard">
            <button @click="select(entry.name) ">{{entry.name}}</button>
        </div>
    `,
    methods: {
        select(playerName) {
            selectPlayerToHook(playerName);
        }
    }

});
window.vue = new Vue({
    el: '#root',
    data: {
        player: playerSurvivor
    },

})



/*
Network stuff
Usage: socket.json({data});
*/

function messageHandler(msg) {
    console.log(msg.req);

    switch (msg.req) {
        case 'generatorProgress':
            updateGeneratorProgress(msg.progress);
            break;
        case 'coords':
            updateCompass(msg.latitude, msg.longitude);
            break;
        case 'distanceKiller':
            updateTerrorRadius(msg.distance);
            break;
        case 'notification':
            showNotification(msg.caption, msg.message);
            break;
        case 'loadGame':
            initUi(msg.playerData);
    }
}
let socket = connectWs(messageHandler);

//test 
let data = [{ name: 'Nommit' }, { name: 'Strawberry' }, { name: 'Mindcollaps' }, { name: 'Mickey' }]
initUi(data);

function initUi(data) {
    data.forEach(element => {
        playerSurvivor.push(element)
    });
    //Array of {name: playername}
    showNotification('Welcome to the Map', 'Map: Farm Besetze. Good Hunt!')
}

/*
 * Constant push of geolocation
 */
function pushGeoLocation() {
    console.log("Try to catch Geolocation");
    let startPos;

    let nudge = document.getElementById("nudge");

    const showNudgeBanner = function() {
        nudge.style.display = "block";
    };

    const hideNudgeBanner = function() {
        nudge.style.display = "none";
        nudge.innerHTML = "Dein GPS ist Scheise."
    };

    const nudgeTimeoutId = setTimeout(showNudgeBanner, 5000);

    var geoSuccess = function(position) {
        hideNudgeBanner();
        // We have the location, don't display banner
        clearTimeout(nudgeTimeoutId);
        playerCoordinates.latitude = position.coords.latitude;
        playerCoordinates.longitude = position.coords.longitude;

        console.log(playerCoordinates.latitude, playerCoordinates.longitude)
            //document.getElementById("startLat").innerHTML = playerCoordinates.latitude;
            //document.getElementById("startLon").innerHTML = playerCoordinates.longitude;

        //PUSH
        socket.json({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        });
    };
    var geoError = function(error) {
        switch (error.code) {
            case error.TIMEOUT:
                // The user didn't accept the callout
                console.error("GPS Berechtigung nicht erteilt")
                showNudgeBanner();
                break;
        }
    };

    navigator.geolocation.getCurrentPosition(geoSuccess, geoError);
}

setInterval(pushGeoLocation, 1000);
/**
 * Killer damages generator
 * 
 */
/*
Generator Task
*/
function initGeneratorTask(gpeneratorID) { //if NFC chick scanned, plz here enter @Noah
    generatorID = pGeneratorID;
    generatorTimeOut = 10;
    generatorProgress = 0;
}

function clickSpamGenerator() {
    generatorClickSpam = true;
}

function updateGeneratorTask() {
    if (generatorID == -1 || generatorTimeOut <= -1 || generatorProgress >= 100)
        return;

    if (generatorClickSpam) {
        generatorClickSpam = false;
        generatorTimeOut = 5;
    } else {
        generatorTimeOut--;
    }
    generatorProgress++;
    updateGeneratorProgress(generatorProgress);
    if (generatorProgress >= 100) {
        console.log("Killer has damaged generator")
        socket.json({
            req: "damageGenerator"
        });
    }
}


function updateGeneratorProgress(percent) //(0...100)
{
    if (percent < 0 || percent > 100) {
        console.exception("Was soll die Scheise? Kannst du nicht bis 100 zählen im Zahlenraum N??")
    }
    let progress = 80 / 100 * percent;
    document.getElementById("progressBar").style.width = progress + '%';
}


/*
Push Messages 
*/

function showNotification(title, message) {
    clearMessages();
    notificationBox = document.getElementById("notification");
    notificationBoxCaption = document.getElementById("caption");
    notificationBoxMessage = document.getElementById("message");
    notificationTimeout = 10;
    notificationBox.style.top = '0px';
    notificationBoxCaption.innerHTML = title;
    notificationBoxMessage.innerHTML = message;

}

function resetMessageBoard() {
    if (notificationTimeout < 0) {
        //showNotification("Hook", "Nommit unhooked");
        return;
    }
    if (notificationTimeout == 0) {
        clearMessages();
    }
    notificationTimeout--;

}

function clearMessages() {
    notificationBox.style.top = '-30%';
}

setInterval(resetMessageBoard, 1000);


/*
Hook and selection to hook
*/
function selectPlayerToHook(playerName) {
    if (playerName) {
        playerSelectedToHook = playerName;
    }
}

function clickHookPlayer() {
    if (playerSelectedToHook) {
        console.log(document.getElementById('hookNumber').value);
        if (document.getElementById('hookNumber').value) {
            socket.json({
                req: 'hooked',
                player: playerSelectedToHook,
                hook: document.getElementById('hookNumber').value
            })

            document.getElementById('hookNumber').value = '';
            return;
        }
        showNotification('Mistake', 'You have to select the Hook');
        return;
    }
    showNotification('Mistake', 'You have to select the Survivor first');
}