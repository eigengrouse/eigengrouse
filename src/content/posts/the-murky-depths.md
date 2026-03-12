---
title: 'The Murky Depths'
pubDate: 2026-03-07
description: 'An Iron Lung inspired Sinclair BASIC game using compressed game screens'
author: 'eigengrouse'
image: '/the-murky-depths.png'
tags: ["zx-spectrum", "games"]
---

A Sinclair BASIC game for the ZX Spectrum inspired by [Iron Lung](https://en.wikipedia.org/wiki/Iron_Lung_(video_game)) which makes use of [zx0](https://github.com/einar-saukas/ZX0) to compress and load the game screen and other creepy images. [Pasmo](https://pasmo.speccy.org/pasmodoc.html) is used to assemble this data and [zmakebas](https://github.com/z00m128/zmakebas) is used for cross-platform Sinclair BASIC development. [ZX-Basicus](https://jafma.net/software/zxbasicus/) is used by the build pipeline to optimise the BASIC and create the idiomatic `murkydepths.zxb` output. `murkydepths.tap` file for use with a ZX Spectrum emulator (tested with [Fuse](https://fuse-emulator.sourceforge.net/)). `.scr` image files created with [ZX Paintbrush](https://sourcesolutions.itch.io/zx-paintbrush). n11 font courtesy of [@jimblimey](https://www.jimblimey.com/blog/32-more-zx-spectrum-fonts/).

[`Download .tap file`](https://github.com/eigengrouse/murkydepths/releases/download/v1.0/murkydepths.tap)

### A quick demo...

<div class="video-wrapper">
<iframe src="https://www.youtube-nocookie.com/embed/5qH4MRUAWBo" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>

### A few notes on what I did...

[`Talk is cheap, show me the code.`](https://github.com/eigengrouse/murkydepths)

This is a Sinclair BASIC game that uses built-in trigonometry commands such as `SIN` and `COS` to move a `PLOT`ed dot around a the game screen that represents a submarine, detecting game screen collisions using `POINT`. I had the idea of loading a more complex game screen, created in [ZX Paintbrush](https://sourcesolutions.itch.io/zx-paintbrush) using `LOAD ""SCREEN$` which worked well but then any use of `CLS` to e.g. show some instructions would lose that screen completely.

This led me to the idea of creating a buffer using machine code that I could quickly load in and out using `LDIR` and `CLEAR`ing enough room for the screen data (6144 bytes for just the bitmap data). This was fairly straightforward, but I had previously seen a compression tool called [zx0](https://github.com/einar-saukas/ZX0) and I wondered if I could use this to include more screens to tell a kind of story.

The inspiration for this game was the submarine simulation horror game [Iron Lung](https://en.wikipedia.org/wiki/Iron_Lung_(video_game)) so I decided to create some creepy screens that the player could discover by following coordinates and compressing them into the top of memory, using zx0's [standard decompressor](https://github.com/einar-saukas/ZX0/blob/main/z80/dzx0_standard.asm) to extract to screen memory. All the game logic is in Sinclair BASIC but the build pipeline uses [Pasmo](https://pasmo.speccy.org/pasmodoc.html) to assemble the compressed data and includes the decompressor and some shortcut routines at known addresses that are called from Sinclair BASIC. I also included a font called n11 that suited the creepy vibe, courtesy of [@jimblimey](https://www.jimblimey.com/blog/32-more-zx-spectrum-fonts/). The `.asm` for this is as follows (some lines removed for clarity).

```asm
; load map.scr.zx80 into screen memory
org 39594
ld hl, 39743
ld de, $4000
jp dzx0_standard

...

; -----------------------------------------------------------------------------
; ZX0 decoder by Einar Saukas & Urusergi
; "Standard" version (68 bytes only)
; -----------------------------------------------------------------------------
; Parameters:
;   HL: source address (compressed data)
;   DE: destination address (decompressing)
; -----------------------------------------------------------------------------
include "..\tools\zx0\z80\dzx0_standard.asm"

; map (1741 bytes)
org 39743
incbin "..\res\map.scr.zx0"

...

; font
org 64000
include "..\res\font.asm"
```

The address locations have all been carefully calculated based on the size of the compressed files, which are extracted directly to the screen memory e.g. 1741 bytes for the compressed map extracted to fill 6912 bytes of screen memory so quite a decent saving. It would be better to generate this using a custom build script instead of having to recalculate with every change, which I might still do as it will be useful for other projects. This could also generate a header for the [zmakebas](https://github.com/z00m128/zmakebas) `.zxb` file which I've added manually, a snippet of which is as follows.

```zxbasic
@begin:

CLEAR 39593

LOAD ""CODE

REM load font at 64000
POKE 23607,249

REM - addresses of main.asm routines that load screen data
LET map = 39594
LET monster = 39612
REM etc...

@showmonster:
LET statusimg = monster
LET statusink = 2
LET s$ = "You have awoken Cthulhu."
GO TO @showstatus

@showstatus:
BORDER 0
RANDOMIZE USR statusimg
PRINT #1; AT 1,0; PAPER 0; INK statusink; s$
BEEP 0.5,-12
PRINT #1; AT 1,31; INK statusink; FLASH 1; "\::"
PAUSE 0
POKE 23560, 0
BEEP 0.01,0
RETURN
```
It may seem wasteful to create variables to hold these constant values but because we are also using [ZX-Basicus](https://jafma.net/software/zxbasicus/) in the build pipeline, any variables that are only assigned to once and then used like a constant are replaced in the final output, a snippet of which is as follows.

```zxbasic
10 CLEAR 39593 :  LOAD "" CODE  :  POKE 23607 , 249
...
158 LET j = 39612
160 LET k = 2 :  LET s$ = "You have awoken Cthulhu." :  GOTO 182
182 BORDER 0 :  RANDOMIZE  USR j :  PRINT  # 1 ;  AT 1 , 0 ;  PAPER 0 ;  INK k ; s$ :  BEEP 0.5 , -12 :  PRINT  # 1 ;  AT 1 , 31 ;  INK k ;  FLASH 1 ; "\gph(::)" :  PAUSE 0 :  POKE 23560 , 0 :  BEEP 0.01 , 0 :  RETURN 
```