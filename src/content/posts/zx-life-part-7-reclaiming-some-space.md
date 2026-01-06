---
title: "ZX Life - Part 7: Reclaiming Some Space"
pubDate: 2023-03-23
author: 'eigengrouse'
description: "Saving memory in ZX Life by packing grid data more tightly."
image: "/zx-life-part-7-reclaiming-some-space.png"
tags: ["zx-spectrum", "zx-life"]
---

In Part 6 we applied further optimisation by caching extra data to get rid of some polynomial time
complexity, namely a nested for loop. We noted that even though we had made the switch to C using
[z88dk](https://z88dk.org/) in Part 5, the optimisation worked just as well in BASIC and paused to
pay tribute to the people's programming language of the 8-bit era. Storing or caching data is a
common approach to reducing time complexity and in this day and age, storage is plentiful and cheap.
However, this was not the case back then and our solution, targeted at the ZX Spectrum, is perhaps
now a little too free and easy with memory usage. At some point, we want to change our focus from
improving the code to implementing something more interesting, but before we do let's reduce the
memory footprint a little using data compression.

Our grid global variable, representing the active area in [Conway's Game of
Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life), is a two-dimensional array of width by
height. Each cell is 8 bits in length and can represent the numbers 0-255, and one of our previous
optimisations was to make use of this range to store enumerated values representing a cell's state,
with a slight trick to also track if the cell was active. This trick, of adding a value without
affecting the state, is similar to how we can reduce the space required to store the cell state and
whether it is active by using [bitwise operations](https://en.wikipedia.org/wiki/Bitwise_operation).
We can treat an 8-bit cell as eight separate flags, and using bitwise operations we can manipulate
these bits to do things like set individual flags and rotate the bits so the last four become the
first four or vice versa. We can do more than that, but it's those things specifically that allow us
to treat an 8-bit cell as two 4-bit cells that contain four flags representing enough data for our
solution.

Our declarations at the top of the file become:

```c
#include <stdio.h>
#include <arch/zx.h>

#define GRID_WIDTH 31
#define COMPRESSED_GRID_WIDTH 16 // half of GRID_WIDTH rounded up to next even number
#define GRID_HEIGHT 22
#define MAX_UPDATED_CELLS 50
#define MAX_ACTIVE_CELLS 200

// possible cell states stored in _grid
#define CELL_ALIVE 0 // cell is currently alive
#define CELL_BORN 1 // cell has just been born
#define CELL_DIES 2 // cell has just died
#define CELL_ACTIVE 3 // cell neighbours an updated cell

unsigned char _grid[COMPRESSED_GRID_WIDTH][GRID_HEIGHT];
unsigned int _updatedCellCount = 0;
unsigned int _updatedCells[MAX_UPDATED_CELLS];
unsigned int _activeCellCount = 0;
unsigned int _activeCells[MAX_ACTIVE_CELLS];
```

Our `_grid` is halved in size, rounded up to the next even number, and the cell states are reduced
to four. `CELL_ALIVE` can also represent if the cell is dead by not being set, and `CELL_BORN` and
`CELL_DIES` still give us enough information for the rest of our code to work. Things like needing
to know if the cell was alive in the previous iteration. `CELL_ACTIVE` prevents duplicate entries
into `_activeCells`. For now, `_updatedCells` and `_activeCells` are as they were.

We have then added some methods that perform the bitwise operations on the grid's cells and
centralise how the grid is accessed by the rest of the code so that the details of how the data is
stored are abstracted away. The same value for x is passed in, but this is divided by two and
whether or not there is a remainder governs if we are concerned with the first four bits or the
latter. We may want to develop our solution so that the grid and methods that access the grid are
abstracted away, in an [abstract data type](https://en.wikipedia.org/wiki/Abstract_data_type) of
sorts, but for now, the methods live under the declarations:

```c
unsigned char isBitSet(unsigned char ch, unsigned char i)
{
    unsigned char mask = 1 << i;
    return mask & ch;
}

unsigned char setBit(unsigned char ch, unsigned char i)
{
    unsigned char mask = 1 << i;
    return ch | mask;
}

unsigned char clearBit(unsigned char ch, unsigned char i)
{
    unsigned char mask = 1 << i;
    mask = ~mask;
    return ch & mask;
}

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
```

As a disclaimer, I realise that there may be better combinations of bitwise operations to achieve
our goal, or existing library functions that will be implemented in machine code so are faster, but
I couldn't find anything specific or clear enough. This is probably another reason to abstract these
away as soon as possible as they are specific to our grid, as well as hiding our shame. I won't try
and explain each line of code but the method names and comments should describe what is going on.

Then comes the rest of the code, which has changed in terms of how the cell state is set or read,
and how the grid is accessed, but logically is the same and does not need to know that `x` or
`GRID_WIDTH` are any different under the hood:

```c
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

void drawGrid()
{
    _activeCellCount = 0;

    unsigned int i = 0;
    for (i = 0; i < _updatedCellCount; i++) {

        unsigned int cellLocation = _updatedCells[i];
        unsigned char x = getCellXCoord(cellLocation);
        unsigned char y = getCellYCoord(cellLocation);

        unsigned char gridValue = getGridValue(x, y);
        if (isBitSet(gridValue, CELL_BORN)) {
            printf("\x16\%c\%c0", x + 1, y + 1);
            gridValue = clearBit(gridValue, CELL_BORN);
            setGridValue(x, y, gridValue);
        } else if (isBitSet(gridValue, CELL_DIES)) {
            printf("\x16\%c\%c ", x + 1, y + 1);
            gridValue = clearBit(gridValue, CELL_DIES);
            setGridValue(x, y, gridValue);
        }

        int x2 = 0;
        int y2 = 0;
        for (x2 = x - 1; x2 <= x + 1; x2++) {
            if (x2 >= 0 && x2 < GRID_WIDTH) {
                for (y2 = y - 1; y2 <= y + 1; y2++) {
                    gridValue = getGridValue(x2, y2);
                    if (y2 >= 0 && y2 < GRID_HEIGHT && (x2 != x || y2 != y) && !isBitSet(gridValue, CELL_ACTIVE) && _activeCellCount < MAX_ACTIVE_CELLS) {
                        _activeCells[_activeCellCount++] = getCellLocation(x2, y2);
                        gridValue = setBit(gridValue, CELL_ACTIVE);
                        setGridValue(x2, y2, gridValue);
                    }
                }
            }
        }
    }
}

unsigned char wasCellAlive(unsigned char x, unsigned char y)
{
    unsigned char gridValue = getGridValue(x, y);
    if ((isBitSet(gridValue, CELL_ALIVE) && !isBitSet(gridValue, CELL_BORN)) || isBitSet(gridValue, CELL_DIES)) {
        return 1;
    }
    return 0;
}

unsigned char updateCellState(unsigned char x, unsigned char y)
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
    
    unsigned char gridValue = 0;
    if (wasAlive == 1 && total > 1 && total < 4) {
        gridValue = setBit(gridValue, CELL_ALIVE);
    } else if (wasAlive == 0 && total == 3) {
        gridValue = setBit(gridValue, CELL_ALIVE);
        gridValue = setBit(gridValue, CELL_BORN);
    } else if (wasAlive == 1) {
        gridValue = setBit(gridValue, CELL_DIES);
    }
    setGridValue(x, y, gridValue);
    return gridValue;
}

void iterateGrid()
{
    _updatedCellCount = 0;

    unsigned int i = 0;
    for (i = 0; i < _activeCellCount; i++) {
        unsigned int cellLocation = _activeCells[i];
        unsigned char x = getCellXCoord(cellLocation);
        unsigned char y = getCellYCoord(cellLocation);
        unsigned char gridValue = updateCellState(x, y);
        if ((isBitSet(gridValue, CELL_BORN) || isBitSet(gridValue, CELL_DIES)) && _updatedCellCount < MAX_UPDATED_CELLS) {
            _updatedCells[_updatedCellCount++] = cellLocation;            
        }
    }
}

void addCell(unsigned char x, unsigned char y)
{
    if (_updatedCellCount < MAX_UPDATED_CELLS) {
        unsigned char gridValue = setBit(0, CELL_ALIVE);
        gridValue = setBit(gridValue, CELL_BORN);
        setGridValue(x, y, gridValue);
        _updatedCells[_updatedCellCount++] = getCellLocation(x, y);
    }
}

void createGliderAt(unsigned char x, unsigned char y)
{
    addCell(x + 1, y);
    addCell(x + 2, y + 1);
    addCell(x, y + 2);
    addCell(x + 1, y + 2);
    addCell(x + 2, y + 2);
}

void main()
{   
    zx_cls(PAPER_WHITE);
    _updatedCellCount = 0;
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

Working iteratively like this means we can focus on one thing at a time while keeping the rest of
the solution intact. The version of the code corresponding to this post is included in the project
and is evolving over many commits as we work iteratively. As a general point, I am learning as I go
along here, and this is my first project using ZX BASIC or z88dk so I'm learning in public. The code
will continue to evolve and I'll maintain the history of commits in the project repository.

