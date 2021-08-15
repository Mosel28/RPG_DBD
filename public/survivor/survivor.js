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
    }
}

let socket = connectWs(messageHandler);


/*
 * Constant push of geolocation
 */
function pushGeoLocation() {
    let startPos;

    let nudge = document.getElementById("nudge");

    const showNudgeBanner = function () {
        nudge.style.display = "block";
    };

    const hideNudgeBanner = function () {
        nudge.style.display = "none";
        nudge.innerHTML = "Dein GPS ist Scheise."
    };

    const nudgeTimeoutId = setTimeout(showNudgeBanner, 5000);

    var geoSuccess = function (position) {
        hideNudgeBanner();
        // We have the location, don't display banner
        clearTimeout(nudgeTimeoutId);
        playerCoordinates.latitude = position.coords.latitude;
        playerCoordinates.longitude = position.coords.longitude;

        //PUSH
        socket.json({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        });
    };
    var geoError = function (error) {
        switch (error.code) {
            case error.TIMEOUT:
                // The user didn't accept the callout
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
    let volume = Math.floor(1 / distance * 12) / 10 - .2; //maybe a bad idea
    console.warn("Terrorradius not implemented (distance, volume)", distance, volume);
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
        return;
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
        if (skillcheck.progress > 0){
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
        //  skillCheckPointer.style.backgroundColor = "blue"
    } else {
        console.log("Skill check unsuccessful")
        stopSkillCheck();
        playSoundSkillCheckFail();
        //  skillCheckPointer.style.backgroundColor = "red"
    }
}

//TESTFUNKTIONEN

let rotation = 0;

function rotate() {

    //console.warn("rotate",rotation)
}

/*
var tid = setInterval(function () {
    document.getElementById("skillCheckBtn").style.transform = 'rotate(' + rotation + 'deg)';
    rotation++;
    if (rotate == 360)
        rotate = 0;

}, 16);


 */
if ("geolocation" in navigator) {
    console.warn("GPS Funktioniert!")
} else {
    console.warn("GPS Funktioniert NICHT!")
}

setInterval(initSkillCheck, 5000);