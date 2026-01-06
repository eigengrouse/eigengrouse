---
title: "ZX Life - Part 8: A Separation of Concerns"
pubDate: 2023-03-26
author: 'eigengrouse'
description: "Splitting ZX Life into cleaner grid and screen libraries."
image: "/zx-life-part-8-a-separation-of-concerns.png"
tags: ["zx-spectrum", "zx-life"]
---

In Part 7 we reclaimed some space lost to improvements in time complexity by using [bitwise
operations](https://en.wikipedia.org/wiki/Bitwise_operation) to compress data. We abstracted access
to our grid, representing the active area in [Conway's Game of
Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) so that the rest of the code was
unaware that x and y coordinates were converted to and from different values, and bits shifted to
get or set data. The methods provided the abstraction but sat in the same `main.c` file, which was
now becoming noisy. We are already using the `stdio.h` library to update the screen as part of our
program, which is fairly wasteful (more on this later) but abstracts away how we set blocks
representing live cells at the correct coordinates. What we would like to do is move all the code
that performs the strange calculations and bit-shifting on the grid into a library of its own, so
that the rest of the code can just concern itself with the game logic. A [separation of
concerns](https://en.wikipedia.org/wiki/Separation_of_concerns), if you will.

It turns out that when you start thinking about the grid and what it is responsible for that should
be hidden, and what should be exposed to the outside world, it's a bit of a balancing act. Most
abstractions are to a certain extent [leaky](https://en.wikipedia.org/wiki/Leaky_abstraction), and
you'll never get away from having to know something about what's going on under the hood, but it's
still worth doing because it leads to code that's easier to understand. In C, the language we are
using, you have `.h` and `.c` files. `.h` are the header files that you reference in the rest of
your code (like `stdio.h`) and you can look in the file to see what methods or variables you have
access to. The `.c` file is the implementation of those methods plus any other methods or variables
that aren't exposed to the outside world. In our solution, we can extract a `grid.h` file, which
declares what the outside world has access to, as follows:

```c
#define GRID_WIDTH 31
#define GRID_HEIGHT 22

unsigned char getGridValue(unsigned char x, unsigned char y);
void setGridValue(unsigned char x, unsigned char y, unsigned char value);
unsigned int getCellLocation(unsigned char x, unsigned char y);
unsigned char getCellXCoord(unsigned int cellLocation);
unsigned char getCellYCoord(unsigned int cellLocation);
```

The outside world needs to know the grid width and height, plus how to get or set data. There are
also methods for getting the numbered cell location from x and y coordinates, and methods to get
back to the x and y coordinates from the cell location. The last three methods you could argue about
whether it's a concern for the grid or the rest of the program as it already knows the grid width
and height and can work them out for itself, and I've partly just included them to reduce the noise
in `main.c`. It's my decision at the end of the day and I may well change my mind, and that's all
there usually is to it. The implementation file `grid.c` is as follows:

```c
#include "grid.h"

#define COMPRESSED_GRID_WIDTH 16 // half of GRID_WIDTH rounded up to next even number

unsigned char _grid[COMPRESSED_GRID_WIDTH][GRID_HEIGHT];

unsigned char getGridValue(unsigned char x, unsigned char y)
{
    unsigned char gridValue = _grid[x / 2][y];
    if (x % 2 != 0) {        
        gridValue = gridValue >> 4; // rotate the last 4 bits to the first 4
    } else {        
        gridValue = gridValue & 15; // blank out the last 4 bits
    }

    return gridValue;
}

void setGridValue(unsigned char x, unsigned char y, unsigned char value)
{   
    unsigned char gridValue = _grid[x / 2][y]; 
    if (x % 2 != 0) {
        value = value << 4; // rotate the first 4 bits to the last 4        
        gridValue = gridValue & 15; // blank out last 4 bits of grid value
    } else {        
        value = value & 15; // blank out the last 4 bits so we don't overwrite        
        gridValue = gridValue & 240; // blank out first 4 bits of grid value
    }
    
    gridValue = gridValue | value;
    _grid[x / 2][y] = gridValue;
}

unsigned int getCellLocation(unsigned char x, unsigned char y)
{
    unsigned int cellLocation = 0;
    cellLocation = GRID_WIDTH * y;
    cellLocation += x + 1;
    return cellLocation;
}

unsigned char getCellXCoord(unsigned int cellLocation)
{
    return (cellLocation % GRID_WIDTH) - 1;
}

unsigned char getCellYCoord(unsigned int cellLocation)
{
    return cellLocation / GRID_WIDTH;
}
```

The grid global variable, and information about its compressed width, is an implementation concern
now. As are the bitwise operations. It's all our code, and we'll be in and out of it and it will all
change, but our `main.c` file is now less noisy.

### Replacing `stdio.h` with our own `screen.h` library

I mentioned above that using `stdio.h` was a little wasteful. In fact, using it causes our output
`.TAP` file to double in size. It was very useful for us in the beginning, to be able to use one of
the standard C libraries to draw to the screen so we could focus on the rest of the code. Now that
we're comfortable with libraries we can think about creating our own `screen.h` header and
`screen.c` implementations, as all we are doing is drawing blocks to the screen, or clearing them. I
have spent a minimal amount of time looking through the [z88dk](https://z88dk.org/) documentation
and forums to find out how we could implement our own and now have something working. Our `screen.h`
is as follows:

```c
void printBlock(unsigned char x, unsigned char y);
void clearBlock(unsigned char x, unsigned char y);
void printStr(unsigned char x, unsigned char y, unsigned char *s);
void clearScreen();
```

There is more going on in `screen.c` than is given away, including a method that draws any kind of
graphic to the screen, but for now, we are only exposing what is needed by the rest of the program.
This code is very specific to how the ZX Spectrum graphics works with some hard-coded memory
addresses and quirks of the hardware. These quirks are all hidden from the rest of our program, and
in turn a library that we reference here `arch/zx.h` provides a method `zx_cxy2saddr(x, y)` that we
don't have to worry about beyond the fact that it's how we get the screen address for an x and y
coordinate.

```c
#include <arch/zx.h>

// graphics
const unsigned char _block_udg[] = {
    0b11111111,
    0b11111111,
    0b11111111,
    0b11111111,
    0b11111111,
    0b11111111,
    0b11111111,
    0b11111111
};
const unsigned char _blank_udg[] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
unsigned char *_font = (unsigned char *)(15360); // point font into rom character set

void printChr(unsigned char x, unsigned char y, unsigned char* c)
{
    unsigned char *p;
    unsigned char i;
    p = zx_cxy2saddr(x, y);
    for (i = 0; i < 8; ++i)
    {
        *p = *c++;
        p += 256;
    }
}

void printBlock(unsigned char x, unsigned char y)
{
    printChr(x, y, _block_udg);
}

void clearBlock(unsigned char x, unsigned char y)
{
    printChr(x, y, _blank_udg);
}

void printStr(unsigned char x, unsigned char y, unsigned char *s)
{
   unsigned char c;
   while (c = *s++)
   {
      printChr(x, y, _font + c*8);
      if (++x == 32)
      {
         x = 0;
         y++;
      }
   }
}

void clearScreen()
{
    zx_cls(PAPER_WHITE);
}
```

Now that we have an abstraction for the screen we could develop it further. The bitwise operations
that we used to compress the data by rotating bits are how we could implement a kind of animation.
Character squares act as the anchor (so we use `zx_cxy2saddr(x, y)`) and then bits can be shifted
along so that sprites move in pixels rather than character squares. This is all probably beyond what
we need in Conway's Game of Life but it's nice to know that we have the basis for something more
interesting.

I feel like I'm getting closer to the end of this proof of concept, of a general approach to
software development on the ZX Spectrum. I have spent quite a lot of time improving the code and
would like to make the solution more interesting, and now that we have a good structure and
separation of concerns, on top of the performance improvements we have been making, I can think of a
few things I'd like to do. So I will continue on until I have something more interesting to show and
perhaps something to say about how I think I can tackle what I really want to do, write a game for
the ZX Spectrum. For now, the version of the code for this blog post is included in the project and
the current version remains in the project repository.

