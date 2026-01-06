---
title: "ZX Life - Part 4: High Level Optimisation"
pubDate: 2023-03-17
author: 'eigengrouse'
description: "Speeding up ZX Life with higher-level refactors and active-cell ideas."
image: "/zx-life-part-4-high-level-optimisation.png"
tags: ["zx-spectrum", "zx-life"]
---

In Part 3 we evaluated how efficient our initial solution was to [Conway's Game of
Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) in [ZX
BASIC](https://github.com/boriel/zxbasic) by applying [big O
notation](https://www.bigocheatsheet.com/) to each section. We used it as a useful tool to arrive at
an approximation, rather than a scary mathematical proof. This gave us a rough time and space
complexity of each section to help us measure future improvements at a high level i.e., in the
high-level language BASIC. Our desired overall approach as we set out in Part 1 is to be able to
write software for the ZX Spectrum initially in BASIC then drop down to inline assembler only where
necessary, as a proof of concept for a general approach.

This part represents two overall passes of improvements. A straightforward reduction in complexity
by a process of refactoring that can be seen in the earlier revision of `program.zxbas`. And then an
application of an "active cell" optimisation that can be seen in the later revision of
`program.zxbas`. Very simply, only neighbouring cells of "updated cells", that is cells that have
just been born or have just died, need to be checked in the next iteration. These neighbouring cells
are marked as "active cells", and while we still loop over the grid in the `drawGrid` and
`iterateGrid` methods, only updated or active cells are processed.

If we had access to advanced data structures, or the ability to create our own in BASIC, then
looping over the entire grid probably wouldn't be necessary and we could access the cells directly
via hashes or something similar. This might be something to tackle in machine code as a
micro-optimisation, or there might be libraries for ZX BASIC that can help. But for now, this is our
current state of play.

### Constants and global variables

* x = active grid width

* y = active grid height

* u = number of updated cells that were born or died in the last iteration

* a = number of active cells in this iteration

* Time complexity = `O(1)`

* Space complexity = `O(x * y)`

```zxbasic
const GRID_WIDTH as ubyte = 31 ' 31 character columns available
const GRID_HEIGHT as ubyte = 22 ' 22 character rows available

' possible cell states stored in _grid
const CELL_DEAD as ubyte = 0 ' cell was dead, still is dead
const CELL_LIVES as ubyte = 1 ' cell was alive, still is alive
const CELL_BORN as ubyte = 2 ' cell was dead, is now alive
const CELL_DIES as ubyte = 3 ' cell was alive, is not dead
' adding this to a cell state marks it as active
const CELL_ACTIVE as ubyte = 4

dim _grid(GRID_WIDTH, GRID_HEIGHT) as ubyte
```

Gone is the DMZ. The size of the grid is now the same as the display area, reducing space
complexity, and the worst-case time complexity of other algorithms. Instead, we do have some new
constants that take advantage of the fact that the grid can store more than 1s and 0s. There are
four possible states of a cell, plus we use a trick to track if the cell is active without having to
create another array. Adding a value greater than the largest possible value representing a state
marks it as active. We can then get back to the cell state regardless of whether a cell is active or
not by using the [mod
command](https://zxbasic.readthedocs.io/en/docs/operators/#arithmetic-operators) i.e., `_grid(x, y)
mod CELL_ACTIVE`. The complexity of our algorithms will be composed of the grid width `x`, its
height `y`, the number of cells that were born or died `u`, or the number of neighbouring cells to
those cells `a`.

### Drawing the grid

* Time complexity = between `O(u)` and `O(x * y)`

* Space complexity = `O(1)`

```zxbasic
sub drawGrid()
    dim x as ubyte = 0
    dim y as ubyte = 0
    dim x2 as byte = 0
    dim y2 as byte = 0
    for x = 0 to GRID_WIDTH step 1
        for y = 0 to GRID_HEIGHT step 1
            if (_grid(x, y) mod CELL_ACTIVE = CELL_BORN or _grid(x, y) mod CELL_ACTIVE = CELL_DIES) then                
                ' update UI and move cell to settled state for next iteration
                if (_grid(x, y) mod CELL_ACTIVE = CELL_BORN) then                
                    print at y, x; "\::"
                    let _grid(x, y) = CELL_LIVES
                else if (_grid(x, y) mod CELL_ACTIVE = CELL_DIES) then
                    print at y, x; " "
                    let _grid(x, y) = CELL_DEAD
                end if 
                ' cell has changed so mark its neighbours as active
                for x2 = x - 1 to x + 1 step 1
                    if (x2 >= 0 and x2 <= GRID_WIDTH) then
                        for y2 = y - 1 to y + 1 step 1
                            if (y2 >= 0 and y2 <= GRID_HEIGHT and (x2 <> x or y2 <> y) and _grid(x2, y2) < CELL_ACTIVE) then
                                let _grid(x2, y2) = _grid(x2, y2) + CELL_ACTIVE
                            end if
                        next y2
                    end if
                next x2
            end if      
        next y
    next x
end sub
```

This looks a bit horrible but it can be described quite simply. For each cell that was updated in
the last iteration (that has just been born or has just died), we update the screen and then mark it
as a settled state (alive or dead). We then mark all of its neighbouring cells as active, to be
checked in the next iteration.

### Get cell state

* Time complexity = `O(1)`

* Space complexity = `O(1)`

```zxbasic
function wasCellAlive(x as ubyte, y as ubyte) as ubyte
    if (_grid(x, y) mod CELL_ACTIVE = CELL_LIVES or _grid(x, y) mod CELL_ACTIVE = CELL_DIES) then
        return 1
    end if
    return 0
end function

function getCellState(x as ubyte, y as ubyte) as ubyte
    dim total as ubyte = 0
    dim x2 as byte = 0
    dim y2 as byte = 0
    for x2 = x - 1 to x + 1 step 1
        if (x2 >= 0 and x2 <= GRID_WIDTH) then
            for y2 = y - 1 to y + 1 step 1
                if (y2 >= 0 and y2 <= GRID_HEIGHT and (x2 <> x or y2 <> y) and wasCellAlive(x2, y2) = 1) then
                    let total = total + 1
                end if
            next y2
        end if
    next x2

    dim wasAlive as ubyte = wasCellAlive(x, y)
    if (wasAlive = 1 and total > 1 and total < 4) then
        return CELL_LIVES
    else if (wasAlive = 0 and total = 3) then
        return CELL_BORN
    else if (wasAlive = 0) then
        return CELL_DEAD
    end if
    return CELL_DIES
end function
```

This replaces `doesCellSurvive` which returned 1 or 0, to now return one of the four possible cell
states, using the same rules of Conway's Game of Life and taking into account whether the cell was
alive in the last iteration. If it was alive and is still alive (`CELL_LIVES`) or was alive but is
now dead (`CELL_DIES`) then it was alive. We can now return what the current state is based on the
three rules\*\* and previous state, which allows us to only process updated cells in the next call
to `drawGrid`.

\*\* The three rules (from Wikipedia):

1. Any live cell with two or three live neighbours survives.

2. Any dead cell with three live neighbours becomes a live cell.

3. All other live cells die in the next generation. Similarly, all other dead cells stay dead.

### Iterating the grid

* Time complexity = between `O(a)` and `O(x * y)`

* Space complexity = `O(1)`

```zxbasic
sub iterateGrid()
    for x = 0 to GRID_WIDTH step 1
        for y = 0 to GRID_HEIGHT step 1
            if (_grid(x, y) >= CELL_ACTIVE) then
                let _grid(x, y) = getCellState(x, y)
            end if
        next y
    next x    
end sub
```

All we are doing here is updating the cell state for active cells by calling `getCellState` (see
above), that is for cells neighbouring the cells that were updated in the last iteration.

### Creating a glider

* Time complexity = `O(1)`

* Space complexity = `O(1)`

```zxbasic
sub createGliderAt(x as ubyte, y as ubyte)
    let _grid(x + 1, y) = CELL_BORN
    let _grid(x + 2, y + 1) = CELL_BORN
    let _grid(x, y + 2) = CELL_BORN
    let _grid(x + 1, y + 2) = CELL_BORN
    let _grid(x + 2, y + 2) = CELL_BORN
end sub
```

This is as it was, but we set the cell state to `CELL_BORN` so that the next call to `drawGrid` sees
these cells as being updated (this subroutine is giving birth… maybe it isn't that horrible after
all).

### The main loop and total complexities

* Time complexity = between `O(u + a)` and `O(2 * x * y)`

* Space complexity = `O(x * y)`

```zxbasic
createGliderAt(0, 0)
createGliderAt(5, 5)
createGliderAt(10, 10)
createGliderAt(15, 15)
do
drawGrid()
iterateGrid()
loop:
```

The main loop remains the same although I have added a few more calls to `createGliderAt` to make
things more interesting as the performance is much improved. Even without taking the "active cell"
optimisation into account the worst-case time complexity of `O(2 * x * y)` is more than a three-fold
improvement on what it was, and the active cell optimisation obliterates this at `O(u + a)`. If
there is some way to keep a lid on the number of active cells as the program runs then it should be
consistently quick. It does fall into the category of a "clever" optimisation however so the
complexity will trend towards `O(2 * x * y)` for a very active screen but I think this is just a
fact of life of writing software for the ZX Spectrum.

The version of code used for this part in the series is included in the project and can be run using
[ZX BASIC](https://github.com/boriel/zxbasic). For now I'm using [**Klive
IDE**](https://github.com/Dotneteer/kliveide), which has built-in support for ZX BASIC and excellent
documentation and was a very quick and easy way to set up a development environment. Following the
[getting started instructions for ZX
BASIC](https://dotneteer.github.io/kliveide/getting-started/try-run-zxb-code) and copying the code
from GitHub should be enough to get started.

