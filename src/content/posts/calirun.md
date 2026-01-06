---
title: 'CaliRun'
pubDate: 2026-02-09
description: 'An OutRun inspired Sinclair BASIC racing game with a m/c scroll routine'
author: 'eigengrouse'
image: '/calirun.png'
tags: ["zx-spectrum", "games"]
---

An OutRun inspired racing game written in Sinclair BASIC with a machine code scroll routine assembled from Z80 into BASIC `DATA` statements via a build pipeline.
`.tap` file for use with a ZX Spectrum emulator (tested with Fuse).

[`Download .tap file`](https://github.com/eigengrouse/calirun/releases/download/v1.0/calirun.tap)

### A quick demo...

<div class="video-wrapper">
<iframe src="https://www.youtube-nocookie.com/embed/5n0z34gIyl8" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>

### A few notes on what I did...

[`Talk is cheap, show me the code.`](https://github.com/eigengrouse/calirun)

There is some interesting stuff going on including a build pipeline in `make.bat` that assembles Z80 into BASIC `DATA` statements, for two machine code routines and the UDGs. [Pasmo](https://pasmo.speccy.org/pasmodoc.html) is used to assemble the `.asm` files into hex, which is then converted into `DATA` statements using some custom powershell scripts. The generated code, found in `build.zxb`, is all in Sinclair BASIC. This is then built into a `.tap` file using [zmakebas](https://github.com/z00m128/zmakebas).

The core mechanic of this game is a short machine code routine that scrolls the attribute data from the top row until one row above the bottom, allowing game data to be displayed on the bottom row. The routine makes use of the Z80 [`lddr`](https://jnz.dk/z80/lddr.html) operation that can transfer memory very quickly, and transfering just the attribute data (colour information) is quicker than transfering bitmap data (pixel information) by a factor of 8. The routine is assembled into `DATA` statements from the `.asm` file and appended to the BASIC file, from the following.
```asm
RAM_ATTR EQU $5800 ; address of attribute RAM
RAM_ATTR_L EQU $02E0 ; length of attribute RAM - 1 line
RAM_ATTR_END EQU (RAM_ATTR + RAM_ATTR_L)
;----------
; scroll_attr_down
;----------
            ld hl, RAM_ATTR_END - $21
            ld de, RAM_ATTR_END - $01
            ld bc, RAM_ATTR_L - $20
            lddr
            ret
```

This means that the graphics are either blocky, or consist of pre-filled characters that are turned on or off by updating colour information. Individual updates can be done via the BASIC `PRINT` command which is reasonably quick but does have the overhead of also updating bitmap data, but one extra optimisation is updating the attribute data directly using `POKE`. This lets us update an address in memory directly, which we can work out as `POKE a, v` where `a=22528+ROW*32+COLUMN` and `v=INK+(PAPER×8)+(BRIGHT×64)+(FLASH×128)`.

#### Sinclair BASIC implementation...

I used [zmakebas](https://github.com/z00m128/zmakebas) again for the BASIC, which lets you use labels instead of line numbers, but for completeness I opened the generated tap file in [BasinC](https://github.com/ref-xx/basinc), an IDE that reads and reformats your code into idiomatic Sinclair BASIC, pasted below. I didn't do any custom font loading this time so the following listing can by typed-in to fully implement the game, although comments have been removed by the process. The nice thing about this is thinking about how BASIC games could be and would be distributed via magazines and supplements BITD.

```zxbasic
  10 CLEAR 61439
  12 GO SUB 238
  14 GO SUB 222
  16 GO SUB 172
  18 LET s=0: LET h=0
  20 IF s>h THEN LET h=s
  22 GO SUB 150
  24 GO SUB 110
  26 FOR u=1 TO 16: FOR q=1 TO 4: FOR p=2 TO 7 STEP 5
  28 INK p: PAPER p
  30 LET dy=(INKEY$="p")-(INKEY$="o"): IF dy<>0 THEN BEEP 0.01,24: LET cy=cy+dy
  32 FOR x=1 TO v
  34 IF ATTR (20,cy)>64 THEN GO TO 170
  36 RANDOMIZE USR r1
  38 NEXT x
  40 IF ATTR (22,cy)=64 THEN POKE 23232+cy,66
  42 LET s=s+v: PRINT #1;AT 1,27; BRIGHT 1; PAPER 1; INK 5;s
  44 IF m(n)>0 THEN BEEP 0.01,m(n)
  46 LET n=n+1: IF n>32 THEN LET n=1
  48 LET y=b+(b*8): LET z=22528+ry
  50 POKE z-1,y: POKE z+16,y
  52 PRINT AT 0,ry+1; INK 0; PAPER 0; BRIGHT 1;"\b\b\b\b\b\b\b\b\b\b\b\b\b\b";
  54 LET y=64+p+(p*8)
  56 POKE z,y: POKE z+15,y
  58 FOR x=t(u,4) TO 10 STEP t(u,4): POKE z+x,y: NEXT x
  60 IF t(u,3)>0 AND p=2 AND q=4 THEN POKE z+32+t(u,2),t(u,3)+64
  62 RANDOMIZE USR r1
  64 LET ry=ry+t(u,1)
  66 NEXT p: NEXT q: NEXT u
  68 GO SUB 72
  70 GO TO 26
  72 LET u=1
  74 GO SUB 92
  76 LET v=v+1
  78 LET b=b+2
  80 IF b>7 THEN LET b=1
  82 LET p=7
  84 BORDER b
  86 IF b=7 THEN PRINT AT 3,ry; INK 0; PAPER 7; BRIGHT 1;"Congratulations!": PAUSE 0: GO TO 20
  88 GO SUB 108
  90 RETURN
  92 PRINT AT 2,ry-3; INK 7; PAPER 7;"\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b"
  94 PRINT AT 3,ry-3; INK 7; PAPER 7;"\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b"
  96 PRINT AT 4,ry-3; INK 7; PAPER 7;"\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b"
  98 PRINT AT 5,ry-3; INK 7; PAPER 7;"\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b"
 100 PRINT AT 6,ry-2; INK 5; PAPER 5;"\b";AT 6,ry+17;"\b"
 102 PRINT AT 7,ry-2; INK 5; PAPER 5;"\b";AT 7,ry+17;"\b"
 104 PRINT AT 8,ry-2; INK 5; PAPER 5;"\b";AT 8,ry+17;"\b"
 106 RETURN
 108 PRINT AT 0,0; INK b; PAPER b;"\b\b\b\b\b\b\b\b"; BRIGHT 1;"\b"; INK 0; PAPER 0;"\b\b\b\b\b\b\b\b\b\b\b\b\b\b"; INK b; PAPER b;"\b"; BRIGHT 0;"\b\b\b\b\b\b\b\b": RETURN
 110 LET b=4
 112 LET ry=8
 114 LET cy=10
 116 LET dy=0
 118 LET v=3
 120 LET n=1
 122 LET s=0
 124 INK b: PAPER b: BORDER b: CLS
 126 FOR x=0 TO 21
 128 PRINT AT x,0;"\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b"
 130 NEXT x
 132 PRINT #1;AT 0,0; BRIGHT 1; INK 0; PAPER 0;"\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a\a"
 134 PRINT #1;AT 1,0; BRIGHT 1; INK 0; PAPER 1;"\e\e\e\e\e\e\e\e\e\e\e "; INK 3;"CaliRun"; INK 0;" \e\e\e\e\e\e\e\e\e\e\e\e"
 136 GO SUB 108
 138 FOR x=0 TO 23
 140 RANDOMIZE USR r1
 142 NEXT x
 144 PRINT #1;AT 1,1; BRIGHT 1; PAPER 1; INK 5;"HIGH:";h;#1;AT 1,21; BRIGHT 1; PAPER 1; INK 5;"SCORE:";s
 146 GO SUB 92
 148 RETURN
 150 BORDER 1: PAPER 1: INK 5: CLS
 152 PRINT AT 2,0; PAPER 0; INK 3;"          "; INK 2;"\a"; INK 3;" CaliRun "; INK 5;"\b          "
 154 PRINT AT 4,5;"Race across California";AT 5,5;"in your Ferrari F110";AT 6,5;"through 5 stages that";AT 7,5;"get faster and earn";AT 8,5;"you more points if you";AT 9,5;"manage not to crash!";AT 11,5;"O is Left, P is right.";AT 13,5;"PRESS ANY KEY TO START"
 156 PRINT #1;AT 0,9; INK 3;"HIGH SCORE ";h;#1;AT 1,9; INK 3;"LAST SCORE ";s
 158 INK 6
 160 FOR x=100 TO 10 STEP -10: PLOT (255-x)/2,8: DRAW x,0,-PI: NEXT x
 162 INK 0: PLOT 0,7: DRAW 255,0
 164 PAUSE 0
 166 CLS
 168 RETURN
 170 PRINT AT 21,cy-1; INK 6; PAPER 2; FLASH 1; BRIGHT 1;"\:'\':": PRINT #1;AT 0,cy-2; INK 3; PAPER 0; BRIGHT 1;"\d";#1;AT 0,cy-1; INK 6; PAPER 2; FLASH 1; BRIGHT 1;"\:.\.:";#1;AT 0,cy+1; INK 6; PAPER 0; BRIGHT 1;"\c": RANDOMIZE USR r2: PAUSE 0: GO TO 20
 172 DIM t(16,4)
 174 LET u=1
 176 DIM m(32)
 178 LET n=1
 180 RESTORE 188
 182 FOR x=1 TO 16: READ t(x,1): READ t(x,2): READ t(x,3): READ t(x,4): NEXT x: LET u=1
 184 FOR x=1 TO 32: READ m(x): NEXT x: LET n=1
 186 RETURN
 188 DATA 0,0,0,11
 190 DATA 1,7,1,5
 192 DATA 0,0,0,5
 194 DATA -1,8,3,5
 196 DATA 0,0,0,3
 198 DATA -1,9,5,6
 200 DATA 0,0,0,6
 202 DATA 1,8,6,6
 204 DATA 0,0,0,3
 206 DATA 1,3,1,9
 208 DATA 0,7,3,5
 210 DATA -1,3,5,9
 212 DATA 0,0,0,3
 214 DATA -1,8,6,5
 216 DATA 0,7,1,5
 218 DATA 1,0,0,5
 220 DATA 12,0,16,9,0,12,0,11,0,14,0,14,7,0,11,0,12,0,16,9,0,12,0,11,0,0,0,0,0,0,0,0
 222 RESTORE 228
 224 LET i=USR "a": LET z=i+8*5-1: FOR x=i TO z: READ y: POKE x,y: NEXT x
 226 RETURN
 228 DATA 0,38,36,255,153,255,195,0
 230 DATA 0,60,66,66,126,231,255,66
 232 DATA 0,0,6,7,4,38,93,154
 234 DATA 0,0,48,48,96,172,170,89
 236 DATA 255,0,0,0,0,0,0,255
 238 RESTORE 248
 240 FOR x=1 TO 43: READ y: POKE x+61439,y: NEXT x
 242 LET r1=61440
 244 LET r2=61452
 246 RETURN
 248 DATA 33,191,90,17,223,90,1,192,2,237,184,201
 250 DATA 1,16,39,121,230,7,87,120,230,1,7,7,7,7,178,211
 252 DATA 254,0,0,0,0,11,120,177,32,233,62,2,211,254,201
 ```