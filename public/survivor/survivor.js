"using strict"
/**
 * @author Marcel Ehlers
 * Doing the frontend stuff
 */
/*
Global variables and constants
 */
const playerCoordinates = {
    latitude: 0,
    longitude: 0
}
let skillcheck = {
    progress: 0, //0...100
    posOkStart: 20, //start of skill check success area
    posOkEnd: 50, //end of skill check success ares
    timeStep: 1, //steps size * 40ms
    active: false, //finished?
}
let activeSkillcheck;
let skillCheckPointer = document.getElementById("skillCheckPointer");
let skillCheckSucessArea = document.getElementById("skillCheckSucessArea");
//Generator Id that is selected.
let generatorID = -1; //
let generatorTimeOut = 5; //Time until you have to rescan NFC Code
let generatorClickSpam = false; //true if clicked 
let generatorTaskPlayerFaktor = 0;
//Notifications
let notificationTimeout = 0;
let notificationBox = document.getElementById("notification");
let notificationBoxCaption = document.getElementById("caption");
let notificationBoxMessage = document.getElementById("message");
//Init
let initialised = false;
//Hooked Player
let hookedPlayerList = [] //array of {name: 'Name'}
    //audio
const soundTerrorRadius = new Audio('/assets/sounds/terrorradius.mp3');


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
            unhookPlayer(playerName);
        }
    }

});
window.vue = new Vue({
        el: '#root',
        data: {
            player: hookedPlayerList
        },

    })
    /*
    Network stuff
    Usage: socket.json({data});
    */

function messageHandler(msg) {
    console.log(msg.req);

    switch (msg.req) {
        case "startGeneratorRepair":
            initGeneratorTask(msg.generator, msg.progress, msg.players);

        case 'generatorProgress':
            updateGeneratorProgress(msg.progress);
            break;
        case 'coords':
            updateCompass(msg.latitude, msg.longitude);
            break;
        case 'distanceKiller':
            updateTerrorRadius(msg.distance);
            break;
        case 'attemptSkillCheck':
            initSkillCheck(msg.difficulty);
            break
        case 'loadGame':
            initUi();
            break;
        case 'hooked':
            hooked(msg.hookedPlayer);
            break;
        case 'unhooked':
            unhooked(msg.hookedPlayer);
            break;
        case 'notification':
            showNotification(msg.caption, msg.message);
            break;
    }
}



let socket = connectWs(messageHandler);


//TEST 


hooked({ name: 'Mindcollaps' })

hooked({ name: 'Mindcollaps' })


//Test Ende
function initUi() {
    //Array of {name: playername}
    showNotification('Welcome to the Map', 'Map: Farm Besetze. Good Luck!')
        //Audio

    playTerrorRadius(0);
    soundTerrorRadius.play();
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


/*
 * Audio Stuff
 */
function playSoundSkillCheck() {
    playSound("/assets/sounds/SkillCheck.mp3");
}

function playSoundSkillCheckSuccess() {

}

function playSoundSkillCheckFail() {

}

function playSound(filename) {
    const sound = new Audio(filename);
    sound.play();
}
let hurz = 30;

setInterval(updateTerrorRadius, 500)

function playTerrorRadius(volume) {
    soundTerrorRadius.loop = true;
    soundTerrorRadius.volume = volume;
    soundTerrorRadius.playbackRate = volume + 0.5
}

/*
Update Gui
 */

/**
 * sets the size of the green bar.
 * @param percent (number between 0 and 100)
 */
function updateGeneratorProgress(percent) //(0...100)
{
    if (percent < 0 || percent > 100) {
        console.exception("Was soll die Scheise? Kannst du nicht bis 100 zählen im Zahlenraum N??")
    }
    let progress = 80 / 100 * percent;
    document.getElementById("progressBar").style.width = progress + '%';

    //give progress back if survivor has done something @Noah
    if (generatorProgressSinceLastRequest) {
        generatorProgressSinceLastRequest = false;


    }
}

/**
 * Shows a compass directing to an event
 * @param latitude
 * @param longitude
 */
function updateCompass(latitude, longitude) {
    console.warn("Compass not implemented")
}

/**
 * Increases and decreases the volume of the terror radius sound
 */
function updateTerrorRadius(distance) {

    distance = (hurz--);
    if (distance < 1)
        return;
    let volume = Math.floor(30 / distance + 0.3) * 2 / 10 - 0.2; //maybe a bad idea

    if (volume > 1)
        volume = 1;

    console.warn("Terrorradius not implemented (distance, volume)", distance, volume);
    playTerrorRadius(volume);
}

/*
Skill check stuff
 */
/**
 * @param difficulty Number between 1 and 3
 */
function initSkillCheck(difficulty = 2) {

    console.log("init Skillcheck ")
    if (difficulty > 3 || difficulty < 1) {
        console.exception("Wrong Skill Check Init Parameter! Read Commentary!");
        difficulty = 1;
    }

    if (skillcheck.active)
        if (skillcheck.progress <= 100)
            return;
    let successAreaSize = 10 + 10 / difficulty;

    skillcheck.progress = -50;
    skillcheck.posOkStart = Math.random() * (100 - successAreaSize);
    skillcheck.posOkEnd = skillcheck.posOkStart + successAreaSize;
    skillcheck.timeStep = 0.5 + 2 / difficulty;
    skillcheck.active = true;

    // skillCheckPointer.style.backgroundColor = "green"
    console.log(skillcheck)
        //Init UI Skill check here
        //skillCheckSucessArea
    let c = document.getElementById("skillCheckSucessArea");
    let ctx = c.getContext("2d");

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.beginPath();
    ctx.arc(150, 150, 150, 2 * Math.PI / 100 * skillcheck.posOkStart - Math.PI / 2, 2 * Math.PI / 100 * skillcheck.posOkEnd - Math.PI / 2);
    ctx.strokeStyle = '#CC4400';
    ctx.lineWidth = 10
    ctx.stroke();
    skillCheckPointer.style.visibility = "visible";

    function processSkillcheck() {
        if (!skillcheck.active) clearInterval(activeSkillcheck);
        skillcheck.progress = skillcheck.progress + skillcheck.timeStep;

        console.log("ActiveSkillCheck")
            //Update UI Skill check here
        let rotation = 360 / 100 * skillcheck.progress
        if (skillcheck.progress > 0) {
            skillCheckSucessArea.style.visibility = 'visible';
            skillCheckPointer.style.transform = 'rotate(' + rotation + 'deg)';
        }


        if (skillcheck.progress > 100) {
            // skillCheckPointer.style.backgroundColor = "red"
            stopSkillCheck()
            playSoundSkillCheckFail();
        }
    }


    activeSkillcheck = setInterval(processSkillcheck, 20);
}

function stopSkillCheck() {
    clearInterval(activeSkillcheck)
    skillcheck.active = false;
    skillCheckSucessArea.style.visibility = 'hidden'
    skillCheckPointer.style.visibility = "hidden";
}

function clickSkillCheck() {
    if (!skillcheck.active) return;
    if (skillcheck.progress >= skillcheck.posOkStart && skillcheck.progress <= skillcheck.posOkEnd) {
        console.log("Skill check successful");
        stopSkillCheck();
        playSoundSkillCheckSuccess();

    } else {
        console.log("Skill check unsuccessful")
        stopSkillCheck();
        playSoundSkillCheckFail();

        socket.json({
            req: "generatorFailCheck",
            generator: generatorID
        });

        //  skillCheckPointer.style.backgroundColor = "red"
    }
}

/*
Generator Task
*/
function selectGenerator(tfGeneratorID) {

    socket.json({
        req: "regGeneratorRepair",
        generator: tfGeneratorID.value
    })

}

function initGeneratorTask(pGeneratorID, pGeneratorProgress, pPlayerFaktor) { //if NFC chick scanned, plz here enter @Noah
    showNotification('Generator', 'Start repairing!')
    generatorID = pGeneratorID;
    generatorProgress = pGeneratorProgress;
    generatorTaskPlayerFaktor = pPlayerFaktor;

    generatorTimeOut = 10;
    socket.json({
        req: "regGeneratorRepair",
        generator: generatorID
    })

}

function clickSpamGenerator() { //button repair clicked
    generatorClickSpam = true;
    if (!initialised) {
        initUi();
        initialised = true;
    }
    //pushGeoLocation();
}

function updateGeneratorTask() {
    if (generatorID == -1 || generatorTimeOut <= -1)
        return;

    if (generatorTimeOut == 0) {
        showNotification('Generator', 'You have stopped repairing');
        socket.json({
            req: "endGeneratorRepair",
            generator: generatorID
        })
    }

    if (generatorClickSpam) {
        generatorProgress = generatorProgress + generatorTaskPlayerFaktor;
        updateGeneratorProgress();
        generatorClickSpam = false;
        generatorTimeOut = 3;
        socket.json({
            req: "regGeneratorRepair",
            generator: generatorID
        })
    } else {
        socket.json({
            req: "endGeneratorRepair",
            generator: generatorID
        })
        generatorTimeOut--;
    }
    console.log("Clickspam Generator Active")
    generatorProgressSinceLastRequest = true; //Server asks if Survivor has done something in updateGeneratorProgress
}

setInterval(updateGeneratorTask, 500);


if ("geolocation" in navigator) {
    showNotification('GPS', 'Your GPS is Functional')
    console.warn("GPS Funktioniert!")
} else {
    showNotification('Error', 'Your GPS is broken. Fix it.')
    console.warn("GPS Funktioniert NICHT!")
}


/*
Push Messages 
*/

function showNotification(title, message) {
    notificationBox = document.getElementById("notification");
    notificationBoxCaption = document.getElementById("caption");
    notificationBoxMessage = document.getElementById("message");
    clearMessages();
    notificationTimeout = 10;
    notificationBox.style.top = '0px';
    notificationBoxCaption.innerHTML = title;
    notificationBoxMessage.innerHTML = message;

}

function resetMessageBoard() {
    if (notificationTimeout < 0) {
        //       showNotification("Hook", "Nommit hooked");
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

/*Player hooked Notification and Button to unhook
 */
function hooked(hookedPlayer) {
    hookedPlayerList.push(hookedPlayer);
    showNotification('Hooked', hookedPlayer.name + ' was hooked.');
}

function unhooked(hookedPlayer) {
    hookedPlayerList = hookedPlayerList.filter(element => { return element.name != hookedPlayer })
    showNotification('Hooked', hookedPlayer + ' was unhooked.');
}

function unhookPlayer(playerName) {
    console.log(playerName)
    socket.json({
            req: 'unhook',
            playerName: playerName,
        })
        //IF NO HOOK WAS SCANNED
        // showNotification('Mistake', hookedPlayer + 'You have to scan the QR Code first before unhook.');
}