# Miracle Slicer 3
![Logo](assets/banner.png)
### [Demonstration Video](https://polimi365-my.sharepoint.com/:v:/g/personal/10741332_polimi_it/EZeLmGfp2ulHr0xiG7rqT-MBNgY7_huixZJ_FGWoy1lDew?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJPbmVEcml2ZUZvckJ1c2luZXNzIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXciLCJyZWZlcnJhbFZpZXciOiJNeUZpbGVzTGlua0NvcHkifX0&e=t4Pnco)
## INTRODUCTION
Audio Slicer for the ACTAM project at Politecnico di Milano.
Made using HTML, CSS, JavaScript and the Tone.js library to manipulate the audio Buffer.

## INSTRUCTION
![Screenshot](assets/screen.png)

Choose the audio file by clicking the folder button and load it by clicking the button next to it.

Use the left mouse button to draw a slice and the right one to select regions. You can preview the selected slice and reverse it, also manipulating the attack and the release of the single region.

With the toggle switch set in TRANSIENT MODE, you can active the automatic onset recogniser and modify the threshold with the relative knob.

You can also change the pitch, the pan and the master volume of the song/audio.

When you have your slicer set up, you can play the loops with your computer keyboard or with a MIDI keyboard by choosing it via the drop-down menu in the top right corner.


## CHALLENGES ENCOUNTERED

Our most difficult challenge was to implement the adaptive threshold recognition that permits to find the transients in our song. Due to its complexity the tool requires a bit time to process all the audio buffer and to apply the DFT.



## WARNING
 You have to connect your midi keyboard before the use of Miracle Slicer 3: if you connect it while you are in the website, you have to refresh it.

## AUTHORS 
Stefano Morano

Andrea Arosio

Marco Roncoroni



ACTAM course by Prof. Francesco Bruschi


