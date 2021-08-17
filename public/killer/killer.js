/*
Global stuff
*/
//Generator Id that is selected.
let generatorID = -1; //
let generatorTimeOut = 5; //Time until you have to rescan NFC Code
let generatorClickSpam = false; //true if clicked 
let generatorProgress = 0;


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


//Testcode!!!!
let progress = 0

setInterval(function() {
    if (progress == 100)
        progress = 0;
    updateGeneratorProgress(progress)
    progress++;
}, 20)