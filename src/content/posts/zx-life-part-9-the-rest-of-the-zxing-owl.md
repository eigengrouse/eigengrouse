---
title: "ZX Life - Part 9: The Rest of the ZXing Owl"
pubDate: 2023-03-29
author: 'eigengrouse'
description: "Wrapping up ZX Life with a cleaner final version and a look back."
image: "/zx-life-part-9-the-rest-of-the-zxing-owl.png"
tags: ["zx-spectrum", "zx-life"]
---

In Part 8 we got familiar with writing our own libraries to better structure our solution to
[Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life). This allowed us to
abstract the implementation of our grid behind a `grid.h` library that hid our data compression
optimisations, and replaced our use of `stdio.h` with a custom `screen.h` library that provided more
targeted graphics capabilities, saving us more space. This left us in a good place, we had now
performed several iterations of time and space complexity optimisations using [big O
notation](https://www.bigocheatsheet.com/) to quantify our improvements, and restructured our
solution into several files that provided a [separation of
concerns](https://en.wikipedia.org/wiki/Separation_of_concerns) so that our solution was
communicated clearly by the code. All this has validated an approach to software development for the
ZX Spectrum that I just didn't think was possible before the initial idea for this in Part 1.

This has been my first attempt at developing something for the ZX Spectrum beyond a few tutorials. I
started out using [ZX BASIC](https://github.com/boriel/zxbasic) with the idea that I would drop down
to machine code where necessary, after seeing that this was a viable approach in a developer diary
segment of [The Spectrum Show](https://www.youtube.com/user/BuckingTheTrend2008). Partway through
this series, I made the switch to C using [z88dk](https://z88dk.org/) although BASIC has kept up in
many ways, and since that switch I have found that there hasn't been the need to drop down to that
lower level. As well as generating optimised machine code, z88dk provides libraries of its own that
are implemented in pure machine code and for my purposes, this has been enough. The approach that
has worked for this project then and the approach I will carry forward is to develop some basic
functionality, then keep iterating on optimising for time complexity, space complexity, and
separation of concerns, paving the way for new functionality (more on this below). This is an
approach that probably suits someone without the in-depth knowledge to get the most out of the ZX
Spectrum upfront, such as myself. But it will allow me to develop halfway decent software over time.

This is the final part of this series, but I have developed the functionality further since the last
part to make things more interesting, as I said I would. The core algorithms are the same and the
previous improvements are maintained, but the program is now more colourful and displays a repeating
message in the evolving patterns. It's quite artistic, and mesmerising to see the patterns evolve. I
have abstracted more code behind a `game.h` library so that `main.c` is as clean as possible and
expanded our `screen.h` library so that characters can be converted to glyphs, which become the
patterns that are added to the screen if there is a lack of activity or a certain number of cycles
have occurred. This is instead of the simplistic `createGliderAt` which has served us well in
development but we knew it had to go at some point. The version of the code for this part, in case I
come back to this project, is included in the project.

I won’t go over all the code changes, but one interesting method in `game.c` is how we convert each
character in our message to new cells added to the grid. In `screen.h` we have added
`getGlyphFromChr` which wraps one of the z88dk libraries that returns a graphic, like the one we
created ourselves, for a character using the built-in font. Instead of drawing it to the screen like
we do in `drawCellAt`, we want to loop over the 8 cell by 8 bit data, and add cells to our evolving
grid using `addCell`. We do this by looping over each char, then looping over each bit using more
bitwise operations. The order is a row at a time, so y then x, which is the opposite of how we
normally do things and we start at the end of x rather than the beginning. Once you've got your head
around that, then the code is fairly straightforward:

```c
void drawChrAt(unsigned char x, unsigned char y, unsigned char c)
{
    unsigned char* glyph = getGlyphFromChr(c);
    unsigned char y2;
    unsigned char x2;
    for (y2 = 0; y2 < 8; y2++) {
        unsigned char row = *glyph++;
        for (x2 = 0; x2 < 8; x2++) {            
            if (row & 0x01) {
                addCell(x + 8 - x2, y + y2);
            }
            row = row >> 1;
        }
    }
}
```

I have a feeling that these bitwise operations are going to be quite prominent in any project using
graphics so are worth getting our head around, and I enjoy working with these quirks that give the
old machines their personality. I'm looking forward to the next project and will put this project
down for now. I will leave the project available in its repository.
