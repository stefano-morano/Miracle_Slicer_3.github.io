var context = new (window.AudioContext || window.webkitAudioContext)(); // Create an audio context

document.addEventListener('DOMContentLoaded', function() {

var animationId; // The ID of the animation frame
var startTime;
var index = [0]; // The array of the slice index
var selectedRange = []; // The array containing the selected range
var attackArray = [];
var realiseArray = [];
var pitchArray = [];
var stateSelection = false;
var eraser = false;
var adaptive = false;
var player;
var panNode;
var pitchNode;
var originalBuffer;

var thresholdValue = 0.2;
const source = context.createBufferSource();

var canvas_waveform = document.getElementById('waveform');
var canvas_draw = document.getElementById('draw');
var canvas_line = document.getElementById('line');
var canvas_cursor = document.getElementById('cursor');

async function getMidi(){                                                   //scan every midi inputs and add them to the select menu
    var midi = await navigator.requestMIDIAccess();
    const inputs = midi.inputs.values();
    const midiSelect = document.getElementById('midiSelect');
    for (const input of inputs) {
        const option = document.createElement('option');
        option.value = input.id;
        option.text = input.name;
        midiSelect.add(option);
    }

    var selectedInput = midi.inputs.get(midiSelect.value);                  //the first input is selected by default

    midiSelect.addEventListener('change', (event) => {                      //when a midi input is selected, the selectedInput variable is updated
        const selectedDeviceId = event.target.value;
        console.log(`Dispositivo MIDI selezionato: ${selectedDeviceId}`);
        selectedInput = midiAccess.inputs.get(selectedDeviceId);
    });

    selectedInput.onmidimessage = function (event) {                        //when a midi input message is received, the function is called
            if (event.data[0] == 144) {
                var note = map_note(event.data[1]);
                if (note < index.length - 1) {
                    play(note);
                }
            } else {
                stop();
            }
    };
}

getMidi();                                                                //call the function to scan midi inputs as first thing

document.getElementById('loadButton').addEventListener('click', loadFile);    //add event listener to the load button

document.getElementById('playButton').addEventListener('click', playAudioBuffer); //add event listener to the play button

document.getElementById('eraseButton').addEventListener('click', erase);    //add event listener to the erase button

document.getElementById('reverseButton').addEventListener('click', reverseWave); //add event listener to the reverse button

document.getElementById('adaptiveButton').addEventListener('click', adaptiveClick); //add event listener to the adaptive button

function loadFile() {                                                       //load the audio file and save it in the buffer
    console.log("chiamata loadFile");
    var fileInput = document.getElementById('fileInput');

    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Seleziona un file audio prima di procedere.');
        return;
    }

    var audioFile = fileInput.files[0];
    var reader = new FileReader();

    reader.onload = function (event) {
        var audioData = event.target.result;
        context.decodeAudioData(audioData,
            function(buffer){
                player = new Tone.Player();
                player.buffer = buffer;
                source.buffer = buffer;
                originalBuffer = cloneBuffer();
                numberOfChannels = player.buffer.numberOfChannels;
                sampleRate = player.buffer.sampleRate;
                panNode = new Tone.Panner(0);
                pitchNode = new Tone.PitchShift(0).toDestination();
                player.connect(panNode);
                panNode.connect(pitchNode);
                player.volume.value = 0;
                addIndexInOrder(player.buffer.duration);
                selectedRange[0] = 0;
                selectedRange[1] = player.buffer.duration;
                console.log('File audio caricato e salvato nel buffer: ', buffer);
                drawWaveform();
            },
            function(error){
                alert('Errore durante la decodifica del file audio: ', error);
            }
        );
    };
    reader.readAsArrayBuffer(audioFile);
}

function cloneBuffer(){
    newBuffer = context.createBuffer(
                    player.buffer.numberOfChannels,
                    player.buffer.length,
                    player.buffer.sampleRate
                );
    for (let channel = 0; channel < newBuffer.numberOfChannels; channel++) {
        const newData = newBuffer.getChannelData(channel);
        const inputData = player.buffer.getChannelData(channel);
        newData.set(inputData);
    }
    return newBuffer;
}

thresholdSlider.addEventListener('change', function(event) {
    thresholdValue = parseFloat(thresholdSlider.value);
    console.log("Treshold: " + thresholdValue);
    if (adaptive){
        index = [];
        addIndexInOrder(0);
        addIndexInOrder(player.buffer.duration);
        clear();
        detectOnset(player.buffer);
        restoreLines();
    }
});


/**
 * Play the entire audio buffer when the play button is pressed.
 */
function playAudioBuffer() {                                        
    Tone.start();
    player.start();                
    startTime = Tone.now();
    animate();
}

/**
 * Play the audio buffer from the selected note when the key is pressed.
 * @input the index of the array to play.
 */
function play(note) {     
    if (player.state === 'stopped') {
        Tone.start();
        player.start(undefined, index[note], index[note+1]-index[note]);
        startTime = Tone.now() - index[note];
        animate();
    }                                          
}

/**
 * Function that implements the functionality of the adaptive button, activating it when it is pressed, 
 * or disabling it when it is pressed again.
 */
function adaptiveClick(){
    if (!adaptive){
        document.getElementById('adaptiveButton').style.backgroundColor = 'blue';
        adaptive = true;
        index = [];
        addIndexInOrder(0);
        addIndexInOrder(player.buffer.duration);
        clear();
        detectOnset(player.buffer);
        restoreLines();
    } else {
        document.getElementById('adaptiveButton').style.backgroundColor = 'grey';
        adaptive = false;
        index = [];
        addIndexInOrder(0);
        addIndexInOrder(player.buffer.duration);
        clear();
    }
}

/**
 * Function that clear the canvas above the waveform.
 */
function clear(){
    var ctx = canvas_line.getContext('2d');
    ctx.clearRect(0, 0, canvas_line.width, canvas_line.height);
    ctx = canvas_draw.getContext('2d');
    ctx.clearRect(0, 0, canvas_draw.width, canvas_draw.height);
}

/**
 * The animation of the cursor.
*/
function animate() {
    var currentTime = Tone.now() - startTime;
    drawCursor(currentTime);
    animationId = requestAnimationFrame(animate);
}

/**
 * Function that draw the cursor on the waveform in a specified time
 * @input {number} the time in seconds of the cursor position.
 */
function drawCursor(time){
    var position = (time / player.buffer.duration) * canvas_cursor.width;
    var ctx = canvas_cursor.getContext('2d');
    ctx.clearRect(0, 0, canvas_cursor.width, canvas_cursor.height);
    ctx.beginPath();
    ctx.strokeStyle = 'blue'; 
    ctx.lineWidth=2;
    ctx.moveTo(position, 0);
    ctx.lineTo(position, canvas_cursor.height);
    ctx.stroke();
}

/**
 * Map the key pressed on the keyboard to the corresponding number of the slice.
 * @input {string} the key pressed on the keyboard.
 */
function mapKeyToNumber(key) {
    switch (key) {
        case 'a':
            return 0;
        case 's':
            return 1;
        case 'd':
            return 2;
        case 'f':
            return 3;
        case 'g':
            return 4;
        case 'h':
            return 5;
        case 'j':
            return 6;
        case 'k':
            return 7;
        case 'l':
            return 8;
        default:
            return undefined;
    }
}

document.getElementById('attackSlider').addEventListener('input', function(event) {
    updateAttack(parseFloat(event.target.value));
});

document.getElementById('releaseSlider').addEventListener('input', function(event) {
    updateRelease(parseFloat(event.target.value));
});

/**
 * Update the attack value of the audio source when the attack slider change its value.
 * @input {number} the value of the attack slider.
 */
function updateAttack(duration){
    if (!player.buffer) {
        console.error('audioBuffer non è definito.');
        return;
    }
    if (!stateSelection){
        for (var x = 0; x < index.length; x++) {
            const start = (x===0) ? 0 : secondsToBufferIndex(index[x]-0.04);
            const end = secondsToBufferIndex(index[x+1]);
            for (let channel = 0; channel < player.buffer.numberOfChannels; channel++) {
                const channelData = player.buffer.getChannelData(channel);
                const originalData = originalBuffer.getChannelData(channel);
                for (let i = start; i <= start + (end-start)/2; i++) {
                    const attackProgress = (i - start) / (end - start);
                    const attackAmplitude = Math.min(1, attackProgress / duration);
                    channelData[i] = attackAmplitude * originalData[i];
                }
            }
        }
    } else {
        const start = (x===0) ? 0 : secondsToBufferIndex(selectedRange[0]-0.04);
        const end = secondsToBufferIndex(selectedRange[1]);
        for (let channel = 0; channel < player.buffer.numberOfChannels; channel++) {
            const channelData = player.buffer.getChannelData(channel);
            const originalData = originalBuffer.getChannelData(channel);
            for (let i = start; i <= start + (end-start)/2; i++) {
                const attackProgress = (i - start) / (end - start);
                const attackAmplitude = Math.min(1, attackProgress / duration);
                channelData[i] = attackAmplitude * originalData[i];
            }
        }
    }
    drawWaveform();
}

/**
 * Update the release value of the audio source when the release slider change its value.
 * @input {number} the value of the release slider.
 */
function updateRelease(duration){
    if (!player.buffer) {
        console.error('audioBuffer non è definito.');
        return;
    }
    if (!stateSelection){
        for (var x = 0; x < index.length; x++) {
            const start = (x===0) ? 0 : secondsToBufferIndex(index[x]-0.04);
            const end = secondsToBufferIndex(index[x+1]-0.05);
            for (let channel = 0; channel < player.buffer.numberOfChannels; channel++) {
                const channelData = player.buffer.getChannelData(channel);
                const originalData = originalBuffer.getChannelData(channel);
                for (let i = end; i >= start + (end-start)/2; i--) {
                    const releaseProgress = (end - i) / (end - start);
                    const releaseAmplitude = Math.min(1, releaseProgress / duration);
                    channelData[i] = releaseAmplitude * originalData[i];
                }
            }
        }
    } else {
        const start = (x===0) ? 0 : secondsToBufferIndex(selectedRange[0]-0.04);
        const end = secondsToBufferIndex(selectedRange[1]);
        for (let channel = 0; channel < player.buffer.numberOfChannels; channel++) {
            const channelData = player.buffer.getChannelData(channel);
            const originalData = originalBuffer.getChannelData(channel);
            for (let i = end; i >= start + (end-start)/2; i--) {
                const releaseProgress = (end - i) / (end - start);
                const releaseAmplitude = Math.min(1, releaseProgress / duration);
                channelData[i] = releaseAmplitude * originalData[i];
            }
        }
    }
drawWaveform();
}

/**
 * Event listener that play the corresponding slice when the key is pressed.
 * @input {event} the event of the key pressed.
 */
document.addEventListener('keydown', function(event) {
    const keyPressed = event.key.toLowerCase(); 
    const mappedNumber = mapKeyToNumber(keyPressed);
    if (mappedNumber !== undefined && mappedNumber < index.length - 1) {
        play(mappedNumber);
    }
});

/**
 * Event listener that stop the audio when the key is released.
 * @input {event} the event of the key released.
 */
document.addEventListener('keyup', function(event) {
    stop();
});

/**
 * function that map the note to the corresponding number of the slice.
 * @input {number} the note to map.
 */
function map_note(note){
    var value = (note - 48) / 24;
    return Math.round(value * 14) + 0;
}

/**
 * Function that draw the waveform of the audio buffer.
 */
function drawWaveform() {
    if (!player.buffer) {
        console.error('audioBuffer non è definito.');
        return;
    }

    var ctx = canvas_waveform.getContext('2d');
    var bufferData = player.buffer.getChannelData(0);
    ctx.clearRect(0, 0, canvas_waveform.width, canvas_waveform.height);
    ctx.lineWidth = 0.4;
    ctx.strokeStyle = 'rgb(0, 0, 0)'; // Onda nera
    ctx.beginPath();

    var sliceWidth = canvas_waveform.width * 1.0 / bufferData.length;
    var x = 0;

    for (var i = 0; i < bufferData.length; i++) {
        var y = (bufferData[i] + 1) * canvas_waveform.height / 2;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        x += sliceWidth;
    }
    ctx.lineTo(canvas_waveform.width, canvas_waveform.height / 2);
    ctx.stroke();
}

/**
 * Event handler that catch the left and right click of the mouse on the waveform.
 */
document.getElementById('draw').addEventListener('mousedown', function(event) {

    var rect = canvas_waveform.getBoundingClientRect();
    var mouseX = event.clientX - rect.left;
    var bufferIndex = (mouseX / canvas_waveform.width) * player.buffer.duration;
    if (event.button === 0) {                       //left click
        if (!eraser){
            var x = 0;
            while (index[x] > bufferIndex || index[x+1] < bufferIndex){
                x++;
            }
            if (stateSelection && index[x] === selectedRange[0] && index[x+1] === selectedRange[1]){
                selectedRange[0] = 0;
                selectedRange[1] = player.buffer.duration;
                stateSelection = false;
                var ctx = canvas_draw.getContext('2d');
                ctx.clearRect(0, 0, canvas_draw.width, canvas_draw.height);
            } else {
                selectedRange[0] = index[x];
                selectedRange[1] = index[x+1];

                drawRectangle((index[x]/player.buffer.duration)*canvas_draw.width, (index[x+1]/player.buffer.duration)*canvas_draw.width);
                stateSelection = true;
            }
        }
    } else if (event.button === 2) {                //right click
        if (eraser) {
            for (var i=1; i<index.length; i++) {
                if (bufferIndex>=index[i]-0.1 && bufferIndex<=index[i]+0.1) {
                    var ctx = canvas_line.getContext('2d');
                    ctx.clearRect(((index[i]/player.buffer.duration)*canvas_line.width)-2, 0, 4, canvas_line.height);
                    index.splice(i, 1);
                    console.log(index);
                }
            }
        } else {
            addIndexInOrder(bufferIndex);
            drawVerticalLine(mouseX);
            if (stateSelection && bufferIndex >= selectedRange[0] && bufferIndex <= selectedRange[1]) {
                selectedRange[1] = bufferIndex;
                drawRectangle((selectedRange[0]/player.buffer.duration)*canvas_draw.width, (selectedRange[1]/player.buffer.duration)*canvas_draw.width);
            }
        }
    }
});

/**
 * Event handler that catch the left mouse click and prevent the context menu to appear.
 */
document.addEventListener('contextmenu', function (event) {
    event.preventDefault();
});

/**
 * Event handler that draw the selection rectangle when the mouse is clicked.
 */
function drawRectangle(x, y){  
    console.log("disegna rettangolo");
    ctx = canvas_draw.getContext('2d');
    ctx.clearRect(0, 0, canvas_draw.width, canvas_draw.height);
    ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'; // Rettangolo giallo trasparente
    ctx.fillRect(x, 0, y - x, canvas_draw.height);
}

/**
 * Function that insert the number in the index array in order.
 * @input {number} the number to insert.
 */
function addIndexInOrder(num) {
    if (!index.includes(num)) {
        index.push(num);
        index.sort(function(a, b) {
            return a - b;
        });
    }
}

/**
 * Convert seconds to the corresponding index in the audio buffer.
 * @input {number} the time in seconds to convert. 
 */
function secondsToBufferIndex(time) {                           
    return Math.floor(time * player.buffer.sampleRate);
}

/**
 * Update the pan value of the audio source when the pan slider change its value.
 */
panSlider.addEventListener('input', function(event) {
    panValue = parseFloat(panSlider.value);
    panNode.pan.value = panValue;
});

/**
 * Update the volume value of the audio source when the volume slider change its value.
 */
volumeSlider.addEventListener('input', function(event) {
    player.volume.value = parseFloat(volumeSlider.value);
});

/**
 * Update the pitch value of the audio source when the pitch slider change its value.
 */
pitchShiftSlider.addEventListener('input', function(event) {
    pitchValue = parseFloat(pitchShiftSlider.value);
    pitchNode.pitch = pitchValue;
});

/**
 * Function that reverse the wave in the parameters inside the selected range
 */
function reverseWave() {
    startIndex = secondsToBufferIndex(selectedRange[0]);
    endIndex = secondsToBufferIndex(selectedRange[1]);
    if (!player.buffer || startIndex < 0 || endIndex >= player.buffer.length || startIndex >= endIndex) {
        return;
    }
    var bufferData = player.buffer.getChannelData(0).subarray(startIndex, endIndex + 1).slice();
    bufferData.reverse();
    player.buffer.getChannelData(0).set(bufferData, startIndex);
    bufferData = player.buffer.getChannelData(1).subarray(startIndex, endIndex + 1).slice();
    bufferData.reverse();
    player.buffer.getChannelData(1).set(bufferData, startIndex);
    drawWaveform();
}


/**
* Function that draw a vertical line in the waveform at the x position
* @input {number} the x position of the line.
*/
function drawVerticalLine(x) {
    console.log("disegna linea verticale");
    var ctx = canvas_line.getContext('2d');
    ctx.beginPath();
    ctx.strokeStyle = 'rgb(255, 0, 0)'; // Linea rossa
    ctx.lineWidth=2;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas_line.height);
    ctx.stroke();
}

function stop() {
    if (player.state === 'started') {
        player.stop();
        cancelAnimationFrame(animationId);
    }
}

/**
 * Function that actives the eraser mode, deleting the slice when the right click is pressed.
 */
function erase(){
    eraser = !eraser;
    if (eraser){
        var ctx = canvas_draw.getContext('2d');
        ctx.clearRect(0, 0, canvas_draw.width, canvas_draw.height);
        document.getElementById('eraseButton').style.backgroundColor = 'blue';
    } else {
        document.getElementById('eraseButton').style.backgroundColor = 'grey';
    }
}

function restoreLines(){
    clear();
    for (var i=1; i<index.length-1; i++){
        drawVerticalLine((index[i]/player.buffer.duration)*canvas_line.width);
    }
}

function computeDFT(input) {
    const N = input.length;
    const output = new Array(N).fill(0);

    for (let k = 0; k < N; k++) {
        let sumReal = 0;
        let sumImag = 0;
        for (let n = 0; n < N; n++) {
            const angle = (2 * Math.PI * k * n) / N;
            sumReal += input[n] * Math.cos(angle);
            sumImag -= input[n] * Math.sin(angle);
        }
        output[k] = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
    }
    return output;
}

function detectOnset(audioBuffer) {
    const audioData = audioBuffer.getChannelData(0); // Prende solo il canale sinistro
    const bufferLength = audioBuffer.length;
    const windowSize = 1024; // Dimensione della finestra per la DFT
    const hopSize = 512; // Dimensione dello spostamento per la finestra

    let currentPos = 0;

    while (currentPos + windowSize < bufferLength) {
        const segment = audioData.slice(currentPos, currentPos + windowSize);
        const spectrum = computeDFT(segment);

        // Calcolo dell'energia dello spettro
        const energy = spectrum.reduce((acc, val) => acc + val, 0);
        let position = currentPos / audioBuffer.sampleRate;

        // Rilevamento dell'onset se l'energia supera una certa soglia (puoi aggiustare questo valore a seconda dei tuoi bisogni)
        if (energy > thresholdValue && index[index.length-2] < position - 0.2) {
            console.log("Onset detected at time: " + position + " seconds");
            addIndexInOrder(position+0.035);
        }
        currentPos += hopSize;
    }
    console.log(index.length-1);
}
});
