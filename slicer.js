    var context = new (window.AudioContext || window.webkitAudioContext)();                         // Create an audio context

    document.addEventListener('DOMContentLoaded', function() {                                     // Wait for the whole page to be loaded

        var animationId; // The ID of the animation frame
        var animationId_sliced; // The ID of the animation frame
        var startTime; // The start time of the audio buffer when the player is on
        var index = [0]; // The array of the slice index
        var selectedRange = []; // The array containing the selected range
        var stateSelection = false; // Boolean state for the selection
        var loaded = false; // Boolean state for the loaded file
        var eraser = false; // Boolean state for the eraser
        var adaptive = false; // Boolean state for the adaptive mode
        var player; // The player object
        var panNode; // The panner node
        var pitchNode; // The pitch shift node
        var meter; // The meter object
        var originalBuffer; // The original audio buffer
        var thresholdValue = 1000; // The threshold value for the onset detection
        var source = context.createBufferSource(); // The source node
        var canvas_waveform = document.getElementById('waveform'); // The waveform canvas
        var canvas_draw = document.getElementById('draw'); // The selection canvas
        var canvas_line = document.getElementById('line'); // The canvas of the transient lines
        var canvas_cursor = document.getElementById('cursor'); // The canvas of the moving cursor
        var canvas_slice = document.getElementById('waveform_sliced'); // The sliced waveform canvas
        var canvas_sliced_cursor = document.getElementById('sliced_cursor'); // The sliced cursor canvas
        var popup = document.getElementById("myPopup"); // The popup element
        var overlay = document.getElementById("overlay"); // The overlay element
        var slider = document.getElementById("myRange"); // The volume slider
        var activeKnob = null; // The instance of active knob

        const knob_sensitivity = document.getElementById('knob_sensitivity');
        const label_sensitivity = document.getElementById('sens_val');
        knob_sensitivity.style.transform = 'rotate(-116deg)';
        const knob_attack = document.getElementById('knob_attack');
        const label_attack = document.getElementById('att_val');
        knob_attack.style.transform = 'rotate(-116deg)';
        const knob_release = document.getElementById('knob_release');
        const label_release = document.getElementById('rel_val');
        knob_release.style.transform = 'rotate(-116deg)';
        const knob_pitch = document.getElementById('knob_pitch');
        const label_pitch = document.getElementById('pitch_val');
        const knob_pan = document.getElementById('knob_pan');
        const label_pan = document.getElementById('pan_val');
        const volumeBar = document.getElementById('volume-bar');

        knob_sensitivity.addEventListener('mousedown', function (event) {                         //Event handler that prevent the context menu to appear when the right click is pressed.
            event.preventDefault();
            startRotation(event);
        });
        knob_attack.addEventListener('mousedown', function (event) {                              //Event handler that prevent the context menu to appear when the right click is pressed.
            event.preventDefault();
            startRotation(event);
        });
        knob_release.addEventListener('mousedown', function (event) {                             //Event handler that prevent the context menu to appear when the right click is pressed.
            event.preventDefault();
            startRotation(event);
        });
        knob_pitch.addEventListener('mousedown', function (event) {                               //Event handler that prevent the context menu to appear when the right click is pressed.
            event.preventDefault();
            startRotation(event);
        });
        knob_pan.addEventListener('mousedown', function (event) {                                 //Event handler that prevent the context menu to appear when the right click is pressed.
            event.preventDefault();
            startRotation(event);
        });

        /**
            * Function that scan the midi inputs and add them to the select menu.
        */
        async function getMidi(){
            var midi = await navigator.requestMIDIAccess();
            const inputs = midi.inputs.values();
            const midiSelect = document.getElementById('midiSelection');
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

        getMidi();                                                                                  //calls the function to scan midi inputs as first thing
        
        document.getElementById('lordIcon').addEventListener('click', function () {
            document.getElementById('fileInput').click();
        });

        lordIcon2.addEventListener('click', loadFile);                                              //adds event listener to the load button and calls the respective function

        document.getElementById('play').addEventListener('click', playAudioBuffer);                 //adds event listener to the play button and calls the respective function

        document.getElementById('onsetTrash').addEventListener('click', erase);                     //adds event listener to the erase button and calls the respective function

        reversesect.addEventListener('click', function() {                                          //adds event listener to the reverse button and calls the respective function
            if (loaded){
                var reversetitleic = document.getElementById('reversetitle');
                reversetitleic.classList.toggle('reverseon');
                reverseWave();
                drawSlice(secondsToBufferIndex(selectedRange[0]), secondsToBufferIndex(selectedRange[1]));
                setTimeout(function() {
                    reversetitleic.classList.toggle('reverseon');
                }, 500);
            }
        });

        document.getElementById('pause').addEventListener('click', pauseAudioBuffer);               //adds event listener to the play button and calls the respective function

        document.getElementById('trash').addEventListener('click', removeFile);                     //adds event listener to the trash button and calls the respective function

        document.addEventListener('keydown', function(event) {                                      //adds event listener to the key pressed and calls the play function
            const keyPressed = event.key.toLowerCase(); 
            const mappedNumber = mapKeyToNumber(keyPressed);
            if (mappedNumber !== undefined && mappedNumber < index.length - 1) {
                play(mappedNumber);
            }
        });

        document.addEventListener('keyup', function(event) {                                        //adds event listener to the key released and calls the stop function
            stop();
        }); 

        draw.addEventListener('mousedown', function(event) {                                        //Event handler that catch the left and right click of the mouse on the waveform.
            var rect = canvas_waveform.getBoundingClientRect();
            var mouseX = event.clientX - rect.left;
            var bufferIndex = (mouseX / canvas_waveform.width) * player.buffer.duration;
            if (event.button === 0) {                       //left click
                if (!eraser){
                    reset_knobs();
                    var x = 0;
                    while (index[x] > bufferIndex || index[x+1] < bufferIndex){
                        x++;
                    }
                    if (stateSelection && index[x] === selectedRange[0] && index[x+1] === selectedRange[1]){
                        selectedRange[0] = 0;
                        selectedRange[1] = player.buffer.duration;
                        stateSelection = false;
                        var ctx = canvas_draw.getContext('2d');
                        var slice = canvas_slice.getContext('2d');
                        slice.clearRect(0, 0, canvas_slice.width, canvas_slice.height);
                        ctx.clearRect(0, 0, canvas_draw.width, canvas_draw.height);
                    } else {
                        selectedRange[0] = index[x];
                        selectedRange[1] = index[x+1];
                        drawRectangle((index[x]/player.buffer.duration)*canvas_draw.width, (index[x+1]/player.buffer.duration)*canvas_draw.width);
                        drawSlice(secondsToBufferIndex(selectedRange[0]), secondsToBufferIndex(selectedRange[1]));
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
                        }
                    }
                } else {
                    addIndexInOrder(bufferIndex);
                    drawVerticalLine(mouseX);
                    if (stateSelection && bufferIndex >= selectedRange[0] && bufferIndex <= selectedRange[1]) {
                        reset_knobs();
                        selectedRange[1] = bufferIndex;
                        drawRectangle((selectedRange[0]/player.buffer.duration)*canvas_draw.width, (selectedRange[1]/player.buffer.duration)*canvas_draw.width);
                        drawSlice(secondsToBufferIndex(selectedRange[0]), secondsToBufferIndex(selectedRange[1]));
                    }
                }
            }
        })  
        
        document.addEventListener('contextmenu', function (event) {                                 //Event handler that prevent the context menu to appear when the right click is pressed.
            event.preventDefault();
        });

        document.getElementById('playsect').addEventListener('click', function() {
            if (stateSelection) {
                var playtitleic = document.getElementById('playtitle');
                if (player.state === 'started') {
                    stop();
                    playtitleic.classList.toggle('playon');
                    return;
                }
                player.start(undefined, selectedRange[0], selectedRange[1]-selectedRange[0]);
                startTime = Tone.now();
                animate_slice();
                drawMeter();
                playtitleic.classList.toggle('playon');
                setTimeout(function() {
                    if (playtitleic.classList.contains('playon')) {
                        playtitleic.classList.toggle('playon');
                        stopAnimation();
                    }
                }, (selectedRange[1]-selectedRange[0])*1000);
            }
        });

        document.getElementById('Pitch_Lab').addEventListener('click', function() {                                           //DA AGGIUNGERE
            label_pitch.textContent = '0';
            pitchNode.pitch = 0;
            knob_pitch.style.transform = `rotate(${0}deg)`;
        });

        document.getElementById('Pan_Lab').addEventListener('click', function() {                                           //DA AGGIUNGERE
            label_pan.textContent = '0';
            panNode.pan.value = 0;
            knob_pan.style.transform = `rotate(${0}deg)`;
        });

        /**
            * Update the volume value of the audio source when the volume slider change its value.
        */
        slider.addEventListener('input', function(event) {
            player.volume.value = parseFloat(slider.value);
        });

        /**
            * Function that load the audio file in the buffer and create all the variables for the audio processing.
        */
        async function loadFile() {                                                       
            removeFile();
            clearWaveform();
            var fileInput = document.getElementById('fileInput');
            var fileNameDisplay = document.getElementById('fileNameDisplay');

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
                        meter = new Tone.Meter();
                        player.buffer = buffer;
                        source.buffer = buffer;
                        originalBuffer = cloneBuffer();
                        numberOfChannels = player.buffer.numberOfChannels;
                        sampleRate = player.buffer.sampleRate;
                        panNode = new Tone.Panner(0);
                        pitchNode = new Tone.PitchShift(0).toDestination();
                        player.connect(panNode);
                        player.connect(meter);
                        panNode.connect(pitchNode);
                        player.volume.value = 0;
                        addIndexInOrder(player.buffer.duration);
                        selectedRange[0] = 0;
                        selectedRange[1] = player.buffer.duration;
                        fileNameDisplay.textContent = truncateFileName(audioFile.name, 373);
                        console.log('File audio caricato e salvato nel buffer: ', buffer);
                        drawWaveform();
                        loaded = true;
                    },
                    function(error){
                        alert('Errore durante la decodifica del file audio: ', error);
                    }
                );
            };
            reader.readAsArrayBuffer(audioFile);
        }

        /**
            * Function that clone the buffer of the audio file.
            * @return {AudioBuffer} the cloned buffer.
        */
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

        /**
            * Function that remove the file from the buffer and reset the variables when the 'X' button is pressed.
        */
        function removeFile() {                 
            if (loaded) {                                           
                audioBuffer = null;
                loaded = false;
                index = [];
                selectedRange = [];
                fileNameDisplay.textContent = ''; 
                clearWaveform();
                clear();
                player.dispose();
                meter.dispose();
                clearSlice();
                slider.value = 0;
                source = context.createBufferSource();
            }
        }

        /**
            * Function that clear the slice waveform canvas when it is called.
        */
        function clearSlice(){
            var ctx = canvas_slice.getContext('2d');
            ctx.clearRect(0, 0, canvas_slice.width, canvas_slice.height);
        }

        /**
            * Function that clear the waveform canvas when it is called.
        */
        function clearWaveform() {                                                         
            var canvas = document.getElementById('waveformCanvas');
            var ctx = canvas_waveform.getContext('2d');
            ctx.clearRect(0, 0, canvas_waveform.width, canvas_waveform.height);
        }        

        /**
            * Play the entire audio buffer when the play button is pressed.
        */
        function playAudioBuffer() {                                        
            Tone.start();
            player.start();                
            startTime = Tone.now();
            drawMeter();
            animate();
            setTimeout(function() {
                stopAnimation();
            }, player.buffer.duration*1000);
        }

        /**
            * Pause the audio buffer when the pause button is pressed.
        */
        function pauseAudioBuffer() {                                     
            if (player.state == "started") {
                player.stop();
            }
            stopAnimation();
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
                drawMeter();
                setTimeout(function() {
                    stopAnimation();
                }, (index[note+1]-index[note])*1000);
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
            var ctx = canvas_sliced_cursor.getContext('2d');
            if ((currentTime >= selectedRange[0] && currentTime <= selectedRange[1]) && stateSelection) 
                drawCursor_sliced(currentTime-selectedRange[0]);
            else ctx.clearRect(0, 0, canvas_sliced_cursor.width, canvas_sliced_cursor.height);
            if (currentTime == selectedRange[1]) {
                stopAnimation();
            }
            drawCursor(currentTime);
            animationId = requestAnimationFrame(animate);
        }

        /**
            * The animation of the sliced cursor.
        */
        function animate_slice() {
            var currentTime = Tone.now() - startTime;
            drawCursor_sliced(currentTime);
            drawCursor(currentTime+selectedRange[0]);
            animationId_sliced = requestAnimationFrame(animate_slice);
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
            ctx.strokeStyle = "rgba(0,0,255, 0.6)"; 
            ctx.lineWidth=2;
            ctx.moveTo(position, 2);
            ctx.lineTo(position, canvas_cursor.height);
            ctx.stroke();
        }

        /**
            * Function that draw the cursor on the sliced waveform in a specified time
            * @input {number} the time in seconds of the cursor position.
        */
        function drawCursor_sliced(time){
            var position = (time / (selectedRange[1] - selectedRange[0])) * canvas_sliced_cursor.width;
            var ctx = canvas_sliced_cursor.getContext('2d');
            ctx.clearRect(0, 0, canvas_sliced_cursor.width, canvas_sliced_cursor.height);
            ctx.beginPath();
            ctx.strokeStyle = "rgba(255, 255, 0, 1)"; 
            ctx.lineWidth=2;
            ctx.moveTo(position, 2);
            ctx.lineTo(position, canvas_sliced_cursor.height + 1);
            ctx.stroke();
        }

        /**
            * Function that truncate the file name if it is too long.
            * @input {string} the file name to truncate.
            * @input {number} the maximum length of the file name.
            * @return {string} the truncated file name.
        */ 
        function truncateFileName(fileName, maxLength) {
            if (fileName.length > maxLength) {
            return fileName.substring(0, maxLength) + '...';
            }
            return fileName;
        }

        /**
            * Function that draw the slice of the sliced waveform in the small canvas.
            * @input {start} the start of the slice.
            * @input {end} the end of the slice.
        */
        function drawSlice(start, end){
            var ctx = canvas_slice.getContext('2d');
            var bufferData = player.buffer.getChannelData(0);
            ctx.clearRect(0, 0, canvas_waveform.width, canvas_waveform.height);
            ctx.lineWidth = 0.4;
            ctx.strokeStyle = 'rgb(0, 0, 0)';          //Black wave
            ctx.beginPath();

            var sliceWidth = canvas_slice.width * 1.0 / (end-start);
            var x = 0;

            for (var i = start; i < end; i++) {
                var y = (bufferData[i] + 1) * canvas_slice.height / 2;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                x += sliceWidth;
            }

            ctx.lineTo(canvas_slice.width, canvas_slice.height / 2);
            ctx.stroke();
        }

        /**
         * Function that reset the knobs to the initial position and their values to 0.
         */
        function reset_knobs(){
            knob_attack.style.transform = 'rotate(-116deg)';
            knob_release.style.transform = 'rotate(-116deg)';
            label_attack.textContent = '0';
            label_release.textContent = '0';
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

        /**
            * Event listener that change the color of the title when the toggle switch is pressed
            * and active the function associated.
        */
        document.getElementById('checkboxInput').addEventListener('change', function () {
            var transientTitle = document.getElementById('transienttitle');
            var manualTitle = document.getElementById('manualtitle');
        
            if (this.checked) {                                                //if the toggle switch is on transient mode   
                transientTitle.style.color = '#FF9E00';
                manualTitle.style.color = '#000000';
                adaptive = true;
                stateSelection = false;
                index = [];
                addIndexInOrder(0);
                addIndexInOrder(player.buffer.duration);
                clear();
                clearSlice();
                detectOnset(player.buffer);
                restoreLines();
            } else {                                                            //if the toggle switch is on manual mode
                manualTitle.style.color = '#FF9E00';
                transientTitle.style.color = '#000000';
                adaptive = false;
                stateSelection = false;
                index = [];
                addIndexInOrder(0);
                addIndexInOrder(player.buffer.duration);
                clear();
            }
        });

        /**
            * Update the attack value of the audio source when the attack slider change its value.
            * @input {number} the value of the attack slider.
        */
        function updateAttack(duration){
            if (!loaded) {
                console.error('audioBuffer non è definito.');
                return;
            }
            if (!stateSelection){
                for (var x = 0; x < index.length; x++) {
                    const start = (x===0) ? 0 : secondsToBufferIndex(index[x]);
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
                const start = (x===0) ? 0 : secondsToBufferIndex(selectedRange[0]);
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
                drawSlice(start, end);
            }
            drawWaveform();
        }

        /**
            * Update the release value of the audio source when the release slider change its value.
            * @input {number} the value of the release slider.
        */
        function updateRelease(duration){
            if (!loaded) {
                console.error('audioBuffer non è definito.');
                return;
            }
            if (!stateSelection){
                for (var x = 0; x < index.length; x++) {
                    const start = (x===0) ? 0 : secondsToBufferIndex(index[x]);
                    const end = secondsToBufferIndex(index[x+1]);
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
                const start = (x===0) ? 0 : secondsToBufferIndex(selectedRange[0]);
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
                drawSlice(start, end);
            }
        drawWaveform();
        }

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
                var y1 = (bufferData[i] + 1) * canvas_slice.height / 2;
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
            * Event handler that draw the selection rectangle when the mouse is clicked.
        */
        function drawRectangle(x, y){  
            ctx = canvas_draw.getContext('2d');
            ctx.clearRect(0, 2, canvas_draw.width, canvas_draw.height);
            ctx.fillStyle = 'rgba(255, 255, 0, 0.5)'; // Rettangolo giallo trasparente
            ctx.fillRect(x, 2, y - x, canvas_draw.height);
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
            var ctx = canvas_line.getContext('2d');
            ctx.beginPath();
            ctx.strokeStyle = 'rgb(255, 165, 0)'; // Linea arancione
            ctx.lineWidth=2;
            ctx.moveTo(x, 2);
            ctx.lineTo(x, canvas_line.height);
            ctx.stroke();
        }

        /**
            * Function that stop the audio buffer and the animation frame when the stop button is pressed or the key is released.
        */
        function stop() {
            if (player.state === 'started') {
                player.stop();
            }
            stopAnimation();
        }

        /**
            * Function that stops all the animations. 
        */
        function stopAnimation(){
            cancelAnimationFrame(animationId);
            cancelAnimationFrame(animationId_sliced);
            var ctx = canvas_sliced_cursor.getContext('2d');
            var ctxa = canvas_cursor.getContext('2d');
            ctx.clearRect(0, 0, canvas_sliced_cursor.width, canvas_sliced_cursor.height);
            ctxa.clearRect(0, 0, canvas_cursor.width, canvas_cursor.height);
            cancelAnimationFrame(meterId);
            volumeBar.style.width = 0 + '%';
        }

        /**
            * Function that actives the eraser mode, deleting the slice when the right click is pressed.
        */
        function erase(){
            eraser = !eraser;
            var trashButton = document.getElementById('onsetTrash');
            if (eraser){
                trashButton.style.backgroundColor = '#93a2af';
                var ctx = canvas_draw.getContext('2d');
                ctx.clearRect(0, 0, canvas_draw.width, canvas_draw.height);
            } else {
                trashButton.style.backgroundColor = '';
            }
        }

        /**
            * Function that draw the lines inside the index array.
        */
        function restoreLines(){
            clear();
            for (var i=1; i<index.length-1; i++){
                drawVerticalLine((index[i]/player.buffer.duration)*canvas_line.width);
            }
        }

        /**
            * Function that compute the Discrete Fourier Transform of the input array.
            * @input {Array} the input array.
            * @return {Array} the DFT array.
        */ 
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

        /**
            * Function that detect the onset of the audio buffer.
            * @input {AudioBuffer} the audio buffer to analyze.
        */
        function detectOnset(audioBuffer) {
            const audioData = audioBuffer.getChannelData(0);
            const bufferLength = audioBuffer.length;
            const windowSize = 1024;
            const hopSize = 512;
        
            let currentPos = 0;
        
            while (currentPos + windowSize < bufferLength) {
                const segment = audioData.slice(currentPos, currentPos + windowSize);
                const spectrum = computeDFT(segment);
                const energy = spectrum.reduce((acc, val) => acc + val, 0);
                let position = currentPos / audioBuffer.sampleRate;
                if (energy > thresholdValue && index[index.length-2] < position - 0.2) {
                    console.log("Onset detected at time: " + position + " seconds");
                    addIndexInOrder(position);
                }
                currentPos += hopSize;
            }
        }

        /**
            * Function that map a value from a percentage to a range.
            * @param {*} value the percentage value
            * @param {*} x the minimum value
            * @param {*} y the maximum value
            * @returns the resulting mapped value
        */
        function map_value(value, x, y) {
            return (y - x) * (value / 100) + x;
        }

        /**
            * It activates the knob rotation and calculate the relative degrees of rotation
            * @param {*} e the knob rotating
            * @returns degrees of rotation
        */
        function volumeKnob(e){
            const knob = activeKnob; // Utilizza il knob attivo
            if (!knob) return; // Esci se non c'è nessun knob attivo
            var rect = knob.getBoundingClientRect();
    
    
            const w = knob.clientWidth / 2;
            const h = knob.clientHeight / 2;
    
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
    
            let deg = Math.atan2(h - y, w -x) * (180 / Math.PI);
            return deg;
        }

        /**
            * Calculate the value indicated by the knob and change the relative value.
            * @param {*} e the knob rotating
        */
        function rotate(e){
            if (!loaded) return;
            const knob = activeKnob; 
            if (!knob) return;
            const result = Math.floor(volumeKnob(e) - 80);
            if ((result >= -116 && result <= 100) || (result >= -260 && result <= -250)) {
                let value;
                if (result >= -116 && result <= 100) {
                    value = Math.floor((result + 116) * 100 / 226);
                } else {
                    value = Math.floor((260 - Math.abs(result)) * 100 / 226);
                    value += 96;
                }
                switch (knob.id) {
                    case 'knob_pan':
                        panNode.pan.value = map_value(value, -1, 1);
                        label_pan.textContent = (value - 50) + "%";
                        break;
                    case 'knob_attack':
                        updateAttack(map_value(value, 0, 0.5));
                        label_attack.textContent = value + "%";
                        break;
                    case 'knob_release':
                        updateRelease(map_value(value, 0, 0.5));
                        label_release.textContent = value + "%";
                        break;
                    case 'knob_pitch':
                        pitchNode.pitch = map_value(value, -24, 24);
                        label_pitch.textContent = (value - 50) + "%";
                        break;
                    case 'knob_sensitivity':
                        thresholdValue = map_value(value, 1000, 3200);
                        label_sensitivity.textContent = map_value(value, 10, 100) + "%";
                        break;
                }
                knob.style.transform = `rotate(${result}deg)`;
            }
        }

        /**
            * Activate the knob rotation
            * @param {*} e the knob to activate
        */
        function startRotation(e){
            activeKnob = e.target; // Imposta il knob attivo
            window.addEventListener('mousemove', rotate);
            window.addEventListener('mouseup', endRotation);
        }

        /**
            * It manages the end of the knob rotation
        */
        function endRotation(){
            if (activeKnob != null && activeKnob.id === 'knob_sensitivity' && adaptive && loaded) {
                index = [];
                addIndexInOrder(0);
                addIndexInOrder(player.buffer.duration);
                clear();
                detectOnset(player.buffer);
                restoreLines();
            }
            activeKnob = null; // Resetta il knob attivo
            window.removeEventListener('mousemove', rotate);
        }

        /**
            * Function that manages the animation of the volume bar
        */
        function drawMeter(){
            let value = ((100 * Math.pow(10, meter.getValue() / 20)));
            if (value > 100) value = 100;
            else volumeBar.style.width = value + '%';
            meterId = requestAnimationFrame(drawMeter);
        }

        function togglePopup() {
            popup.classList.toggle("show");
            overlay.classList.toggle("show");
        }
    
        // Event listener for the info icon
        document.getElementById("info").addEventListener("click", function(event) {
                event.stopPropagation();
                togglePopup();
        });
    
        // Event listener to close popup when clicking outside
        document.addEventListener("click", function(event) {
               
            if (popup.classList.contains("show") && !popup.contains(event.target) && event.target.id !== 'info') {
                popup.classList.remove("show");
                overlay.classList.remove("show");
            }
         });
    
        // Event listener to close popup when clicking the close button
        document.getElementById("closePopup").addEventListener("click", function(event) {
                event.stopPropagation();
                togglePopup();
                popup.classList.remove("show");
                overlay.classList.remove("show");
            });

    });

    
