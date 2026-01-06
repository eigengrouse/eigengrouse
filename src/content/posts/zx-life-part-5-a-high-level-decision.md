---
title: "ZX Life - Part 5: A High Level Decision"
pubDate: 2023-03-20
author: 'eigengrouse'
description: "Why ZX Life moves from BASIC to C with z88dk."
image: "/zx-life-part-5-a-high-level-decision.png"
tags: ["zx-spectrum", "zx-life"]
---

In Part 4 we reduced the complexity of our solution to [Conway's Game of
Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) in [ZX
BASIC](https://github.com/boriel/zxbasic) and applied an "active cell" optimisation using a slight
trick in our data structures. By data structures, I mean our two-dimensional array storing the cell
state and whether it is an active cell. These two things allowed us to optimise the `drawGrid`
method to only draw the updated cells (and populate the active cells), and the `iterateGrid` method
to only check the active cells. It was quite a nice improvement and, using our approximation of
complexity in [big O notation](https://www.bigocheatsheet.com/), we could even quantify the
improvement to a certain extent.

Although nice, I commented that we were still looping over the entire grid because there were no
advanced data structures in BASIC or a way to create our own. No way to directly point to a cell
from a smaller, optimised structure (like a [hash](https://en.wikipedia.org/wiki/Hash_table)) of
updated or active cells. This got me thinking, is this going to be a constant source of compromise?
And could it become a problem? Our intended approach is to create an elegant solution in a
high-level language, currently BASIC, then drop down to machine code where it makes sense, as a
proof of concept for a general approach to developing software for the ZX Spectrum. Dropping down to
machine code is non-trivial and I had only planned on micro-optimisations, where the solution is
still defined and communicated by the high-level language. It felt like I had finally stumbled upon
the gap between high and low-level languages, and the side of the high-level language was further
back than I thought. Bridging the gap from the higher level will lead to nicely structured code,
while bridging the gap from the lower level might lead to something more like the blob that partly
inspired this project.

The article subtitle gives it away so I'm not sure why I was building the suspense, but I've decided
to re-implement the current solution in C using the excellent [z88dk](https://z88dk.org). ZX BASIC
and C are both high-level languages that now, wonderfully, have compilers for the ZX Spectrum. I am
in awe of the creators and maintainers of both. I initially discounted C because sometimes it hurts
your face to look at, although you can write readable code if you make an effort. But I think
importantly it will allow us to bridge the gap a bit more on the side of the high-level language, so
I am going to make the switch. What I am going to do, however, is implement the current solution
exactly as it stands before continuing with developing the solution in any way. I intend to both
optimise it some more, and to develop the functionality to be more interesting. But for now, the C
code has all the same methods and logic as the BASIC code. This should mean I don't have to go
through each section as I have before as only the syntax has changed.

```c
#include <stdio.h>
#include <arch/zx.h>

#define GRID_WIDTH 31
#define GRID_HEIGHT 22

// possible cell states stored in _grid
const unsigned char CELL_DEAD = 0; // cell was dead, still is dead
const unsigned char CELL_LIVES = 1; // cell was alive, still is alive
const unsigned char CELL_BORN = 2; // cell was dead, is now alive
const unsigned char CELL_DIES = 3; // cell was alive, is now dead
// adding this to a cell state marks it as active
const unsigned char CELL_ACTIVE = 4;

unsigned char _grid[GRID_WIDTH][GRID_HEIGHT];

void drawGrid()
{
    unsigned char x = 0;
    unsigned char y = 0;
    int x2 = 0;
    int y2 = 0;
    for (x = 0; x < GRID_WIDTH; x++) {
        for (y = 0; y < GRID_HEIGHT; y++) {
            if (_grid[x][y] % CELL_ACTIVE == CELL_BORN || _grid[x][y] % CELL_ACTIVE == CELL_DIES) {
                if (_grid[x][y] % CELL_ACTIVE == CELL_BORN) {
                    printf("\x16\%c\%c0", x + 1, y + 1);
                    _grid[x][y] = CELL_LIVES;
                } else if (_grid[x][y] % CELL_ACTIVE == CELL_DIES) {
                    printf("\x16\%c\%c ", x + 1, y + 1);
                    _grid[x][y] = CELL_DEAD;
                }
                for (x2 = x - 1; x2 <= x + 1; x2++) {
                    if (x2 >= 0 && x2 < GRID_WIDTH) {
                        for (y2 = y - 1; y2 <= y + 1; y2++) {
                            if (y2 >= 0 && y2 < GRID_HEIGHT && (x2 != x || y2 != y) && _grid[x2][y2] < CELL_ACTIVE) {
                                _grid[x2][y2] += CELL_ACTIVE;
                            }
                        }
                    }
                }
            }
        }
    }
}

unsigned char wasCellAlive(unsigned char x, unsigned char y)
{
    if (_grid[x][y] % CELL_ACTIVE == CELL_LIVES || _grid[x][y] % CELL_ACTIVE == CELL_DIES) {
        return 1;
    }
    return 0;
}

unsigned char getCellState(unsigned char x, unsigned char y)
{
    unsigned char total = 0;
    int x2 = 0;
    int y2 = 0;
    for (x2 = x - 1; x2 <= x + 1; x2++) {
        if (x2 >= 0 && x2 < GRID_WIDTH) {
            for (y2 = y - 1; y2 <= y + 1; y2++) {
                if (y2 >= 0 && y2 < GRID_HEIGHT && (x2 != x || y2 != y) && wasCellAlive(x2, y2)) {
                    total++;
                }
            }
        }
    }

    unsigned char wasAlive = wasCellAlive(x, y);
    if (wasAlive == 1 && total > 1 && total < 4) {
        return CELL_LIVES;
    } else if (wasAlive == 0 && total == 3) {
        return CELL_BORN;
    } else if (wasAlive == 0) {
        return CELL_DEAD;
    }
    return CELL_DIES;
}

void iterateGrid()
{
    unsigned char x = 0;
    unsigned char y = 0;
    for (x = 0; x < GRID_WIDTH; x++) {
        for (y = 0; y < GRID_HEIGHT; y++) {
            if (_grid[x][y] >= CELL_ACTIVE) {
                _grid[x][y] = getCellState(x, y);
            }
        }
    }
}

void createGliderAt(unsigned char x, unsigned char y)
{
    _grid[x + 1][y] = CELL_BORN;
    _grid[x + 2][y + 1] = CELL_BORN;
    _grid[x][y + 2] = CELL_BORN;
    _grid[x + 1][y + 2] = CELL_BORN;
    _grid[x + 2][y + 2] = CELL_BORN;
}

void main()
{   
    zx_cls(PAPER_WHITE);
    createGliderAt(0, 0);
    createGliderAt(5, 5);
    createGliderAt(10, 10);
    createGliderAt(15, 15);
    while (1) {
        drawGrid();
        iterateGrid();
    }
}
```

What's also nice is that we actually get syntax support in the code snippets now, which might make
these posts slightly more readable. Less readable in terms of the code content if you prefer BASIC
over C but more readable in terms of syntax highlighting. Unlike in ZX BASIC, there are more files
than just the C listing required to compile the code but they're all checked in, including
`gameoflife.bat` which contains the command line arguments to use when compiling, and the version
for this blog post is included in the project. You must also install z88dk as a precursor and set
the path as described [here](https://github.com/z88dk/z88dk/wiki/installation). I'm using [Visual
Studio Code](https://code.visualstudio.com) as an editor which is free and works well with having a
multi-file solution of any kind in a particular folder.

