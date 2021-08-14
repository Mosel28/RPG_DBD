if ("geolocation" in navigator) {
    console.warn("GPS Funktioniert!")
} else {
    console.warn("GPS Funktioniert NICHT!")
}


//STUFF



function playSoundSkillCheck() {
    playSound("./sounds/SkillCheck.mp3");
}

function playSoundSkillCheckSuccess() {

}

function playSoundSkillCheckFail() {

}

function playSound(filename) {
    const sound = new Audio(filename);
    sound.play();
}


function sendPosition() {
    /*  document.getElementById("btnRepair").onclick = function() {
     */
    var startPos;

    var nudge = document.getElementById("nudge");

    var showNudgeBanner = function () {
        nudge.style.display = "block";
    };

    var hideNudgeBanner = function () {
        nudge.style.display = "none";
        nudge.innerHTML = "Dein GPS ist Scheise."
    };

    var nudgeTimeoutId = setTimeout(showNudgeBanner, 5000);

    var geoSuccess = function (position) {
        hideNudgeBanner();
        // We have the location, don't display banner
        clearTimeout(nudgeTimeoutId);

        // SEND POSITION TO SERVER @Noah
        startPos = position;
        document.getElementById('startLat').innerHTML = startPos.coords.latitude; // Testdarstellung
        document.getElementById('startLon').innerHTML = startPos.coords.longitude; // Testdarstellung
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





function updateGeneratorProgress(percent) //(0...100)
{
    if (percent < 0 || percent > 100) {
        console.exception("Was soll die Scheise? Kannst du nicht bis 100 zählen im Zahlenraum N??")
    }
    let progress = 80 / 100 * percent;
    document.getElementById("progressBar").style.width = progress+'%';
}



//TESTFUNKTIONEN

let rotation = 0;

function rotate() {

    //console.warn("rotate",rotation)
}
var tid = setInterval(function () {
    document.getElementById("skillCheckBtn").style.transform = 'rotate(' + rotation + 'deg)';
    rotation++;
    if (rotate == 360)
        rotate = 0;
 
}, 16);


let progress = 0;

setInterval(function () {
    if (progress == 100)
        progress = 0;
    updateGeneratorProgress(progress)
    progress++;
},500)