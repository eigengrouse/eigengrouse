---
title: "ZX Life - Part 6: Life in the Old Dog Yet"
pubDate: 2023-03-21
author: 'eigengrouse'
description: "Revisiting ZX Life optimisation to prove the BASIC approach still works."
image: "/zx-life-part-6-life-in-the-old-dog-yet.png"
tags: ["zx-spectrum", "zx-life"]
---

A common approach to reducing the complexity of algorithms is to attempt to reduce an exponential or
polynomial complexity to linear complexity, often by storing or caching data up-front, which is
*kind of* what we did in Part 4. This terminology sounds complicated but what we did (kind of) is
rewrite our algorithm that processed every cell in an `x` by `y` grid, with an algorithm that only
processed updated cells `u`, or active cells `a`. So we had a *polynomial complexity* of `O(x * y)`
that was replaced by a *linear complexity* of `O(u)` or `O(a)`. We were able to do this by tracking
`u` and `a`. Polynomial means that we had two or more algebraic terms in our complexity and so the
complexity rises faster than the size of the inputs. We managed to rewrite the algorithms in
`drawGrid` and `iterateGrid` to have linear complexities so that the complexity rises at the same
rate as our inputs, improving the overall performance of our solution in the process.

I say "kind of" because what we actually did was add a filter so that even though we were still
looping over the entire grid, we were only *processing* updated or active cells. I still claimed
victory, but I knew that the nested loop was still contributing a polynomial complexity of its own
no matter how quickly it skipped over unchanged or inactive cells. We needed to properly store `u`
and `a` in some kind of data structure to fix this, not just have a way to filter on them. So in
Part 5 I made a decision that I wanted to solve this properly and to do that I would need more
flexible data structures, which weren't available in [ZX BASIC](https://github.com/boriel/zxbasic)
but were in [z88dk](https://z88dk.org/), an implementation of C for the ZX Spectrum. I had envisaged
something along the lines of the classic interview question from the 90s "implement a linked list",
implementing some kind of [abstract data type](https://en.wikipedia.org/wiki/Abstract_data_type),
and there was even a library [adt.h](https://www.z88dk.org/wiki/doku.php?id=library:adt) that looked
promising.

What are abstract data types? In the [Modula-2](https://en.wikipedia.org/wiki/Modula-2) structured
programming course I took years ago my lecturer liked to say they're like the Holy Roman Empire,
which wasn't Holy, Roman, or an Empire (although it was the name of a [local
band](https://holyromanempire.bandcamp.com/) that had a bit of a cult following while I was at
university). Meaning that they're not abstract, data, or a type. They are a combination of data
structures and operations on those structures. I had envisaged creating a data structure that was
tailored to the problem at hand, and some operations that would abstract the complexity of using the
data structure and allow us to optimise to our hearts' content. I like to work iteratively though so
I started to implement the kind of solution I was thinking of in a couple of one-dimensional arrays,
containing numbered cell locations calculated from x and y coordinates. And I happened upon a decent
solution that would work happily in BASIC, which also simplified some of the other code, which is
always a good sign.

The ability to create abstract data types is extremely powerful, and as I implemented this iteration
of the solution in both BASIC and C it was obvious that the C implementation was faster. So I will
continue with z88dk and C, but I wanted to give a nod to BASIC here and to say that there is more in
the way of optimisation that you can do than I thought. The version of the code that is referenced
by this post is included in the project and both `main.c` and `program.zxbas` have had this
optimisation applied. I will paste the C version below as the syntax highlighting works, and this
will still be the implementation I continue with. I just wanted to pause on this interim solution
that also works in BASIC to give a nod to the old dog.

```c
#include <stdio.h>
#include <arch/zx.h>

#define GRID_WIDTH 31
#define GRID_HEIGHT 22
#define MAX_UPDATED_CELLS 50
#define MAX_ACTIVE_CELLS 200

// possible cell states stored in _grid
const unsigned char CELL_DEAD = 0; // cell was dead, still is dead
const unsigned char CELL_LIVES = 1; // cell was alive, still is alive
const unsigned char CELL_BORN = 2; // cell was dead, is now alive
const unsigned char CELL_DIES = 3; // cell was alive, is now dead
// adding this to a cell state marks it as active
const unsigned char CELL_ACTIVE = 4;

unsigned char _grid[GRID_WIDTH][GRID_HEIGHT];
unsigned int _updatedCellCount = 0;
unsigned int _updatedCells[MAX_UPDATED_CELLS];
unsigned int _activeCellCount = 0;
unsigned int _activeCells[MAX_ACTIVE_CELLS];

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

        if (_grid[x][y] % CELL_ACTIVE == CELL_BORN) {
            printf("\x16\%c\%c0", x + 1, y + 1);
            _grid[x][y] = CELL_LIVES;
        } else if (_grid[x][y] % CELL_ACTIVE == CELL_DIES) {
            printf("\x16\%c\%c ", x + 1, y + 1);
            _grid[x][y] = CELL_DEAD;
        }

        int x2 = 0;
        int y2 = 0;
        for (x2 = x - 1; x2 <= x + 1; x2++) {
            if (x2 >= 0 && x2 < GRID_WIDTH) {
                for (y2 = y - 1; y2 <= y + 1; y2++) {
                    if (y2 >= 0 && y2 < GRID_HEIGHT && (x2 != x || y2 != y) && _grid[x2][y2] < CELL_ACTIVE && _activeCellCount < MAX_ACTIVE_CELLS) {
                        _activeCells[_activeCellCount++] = getCellLocation(x2, y2);
                        _grid[x2][y2] += CELL_ACTIVE;
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
    _updatedCellCount = 0;

    unsigned int i = 0;
    for (i = 0; i < _activeCellCount; i++) {
        unsigned int cellLocation = _activeCells[i];
        unsigned char x = getCellXCoord(cellLocation);
        unsigned char y = getCellYCoord(cellLocation);
        _grid[x][y] = getCellState(x, y);
        if ((_grid[x][y] == CELL_BORN || _grid[x][y] == CELL_DIES) && _updatedCellCount < MAX_UPDATED_CELLS) {
            _updatedCells[_updatedCellCount++] = cellLocation;
        }
    }
}

void addCell(unsigned char x, unsigned char y)
{
    if (_updatedCellCount < MAX_UPDATED_CELLS) {
        _grid[x][y] = CELL_BORN;
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

