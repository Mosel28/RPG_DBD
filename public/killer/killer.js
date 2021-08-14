
function updateGeneratorProgress(percent) //(0...100)
{
    if (percent < 0 || percent > 100) {
        console.exception("Was soll die Scheise? Kannst du nicht bis 100 zählen im Zahlenraum N??")
    }
    let progress = 80 / 100 * percent;
    document.getElementById("progressBar").style.width = progress+'%';
}


//Testcode!!!!
let progress = 0

setInterval(function () {
    if (progress == 100)
        progress = 0;
    updateGeneratorProgress(progress)
    progress++;
},20)