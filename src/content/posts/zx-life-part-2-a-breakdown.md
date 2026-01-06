---
title: "ZX Life - Part 2: A Breakdown"
pubDate: 2023-03-12
author: 'eigengrouse'
description: "Breaking down the first ZX Life version and refactoring it into shape."
image: "/zx-life-part-2-a-breakdown.png"
tags: ["zx-spectrum", "zx-life"]
---

I ended Part 1 with the full listing of my initial solution for [Conway's Game of
Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) in [ZX
BASIC](https://github.com/boriel/zxbasic) without much explanation beyond the fact that it was
probably far from elegant. The plan is to refactor the code until it is an elegant solution, to
solve what performance issues we can before deciding where we should drop down to inline assembler.
The inspiration for this project and approach came from a documentary about a [pseudo-living
blob](https://www.imdb.com/title/tt11366150/) and [The Spectrum
Show](https://www.youtube.com/user/BuckingTheTrend2008). The code for this series is available in
the repository for this project.

Before we do anything else, we should go through the initial solution and explain my inelegant,
non-optimised, non-idiomatic ZX BASIC code.

### Constants and global variables

```zxbasic
const gridWidth as ubyte = 33 ' includes DMZ border
const gridHeight as ubyte = 24 ' includes DMZ border
dim grid(gridWidth, gridHeight) as byte
```

The grid is represented in this program by the available screen area where characters can be printed
at x and y coordinates, which is 31 characters wide by 22 characters high. We may develop the code
to be more graphical but this is the simplest method of representing the grid onscreen, which is my
aim. So why are the constants `gridWidth` and `gridHeight` larger than this, and what is a DMZ?
Well, the answer is that we will check whether each cell in turn is live in the next iteration by
counting the live cells surrounding it. For this logic to work without modification at the far left,
top, right, and bottom of the screen one easy thing to do is to create a demilitarized zone (DMZ) or
border around the grid where no cells are populated or counted. This is wasteful but I'm choosing
simplicity over other concerns and having a demilitarized zone sounds cool and is an easy concept to
grasp.

Having the constants `gridWidth` and `gridHeight` helps the readability of the rest of the code as
we will continually need these values, and the grid itself is a global variable so that it can be
accessed directly by the rest of the code rather than being passed around. Global variables are
usually a no-no but I prefer to think of `grid` as a class-level property in such a small program.
It is a two-dimensional array of bytes (so a grid), which we will set to 1s or 0s, 33 bytes wide
(the value of `gridWidth`) and 24 bytes high (the value of `gridHeight`).

### Initialising the Grid

```zxbasic
sub initialiseGrid()
    for x = 0 to gridWidth step 1
        for y = 0 to gridHeight step 1
            let grid(x, y) = 0
        next y
    next x
end sub
```

Immediately comes a subroutine that makes use of these constants and the grid global variable. I
have a feeling this subroutine isn't strictly necessary as arrays of bytes are probably initialised
to all 0s but I'm not certain, and this is a nice illustration of how you would loop over the grid
and set each value. Subroutines only execute when called, so this subroutine sits in the listing
doing nothing for now, unlike the constants and global variable declarations above which execute
immediately.

From looking ahead at the ZX BASIC documentation, subroutines are also where we can write inline
assembly. This makes sense and fits our needs, if we can break the program down into subroutines
then we can go about rewriting individual subroutines in machine code all while our program
continues to function. If we had some sort of testing framework in place we could even use a
[red-green-refactor workflow](https://en.wikipedia.org/wiki/Test-driven_development).

### Drawing the grid

```zxbasic
sub drawGrid()
    for x = 1 to gridWidth - 1 step 1
        for y = 1 to gridHeight - 1 step 1
            if (grid(x, y) = 1)
                print at y - 1, x - 1; "\::"
            else
                print at y - 1, x - 1; " "
            end if
        next y
    next x
end sub
```

Next comes a similar-looking subroutine that uses the ZX BASIC built-in `print at` command to draw
the grid to the screen. Despite being a dialect of BASIC, arrays start at 0 in ZX BASIC so here we
are bypassing the DMZ to only draw the active part of the grid (`for x = 1 to gridWidth - 1`). For
each cell, if it is alive then print a block using the built-in notation (`"\::"`) otherwise print a
space. The values of `x` and `y` are subtracted by 1 in the print command so that the active part of
the grid is flush against the screen edge.

Notice that the `print at` command accepts `y` first, then `x`. This is either a quirk of ZX BASIC
or a quirk of our implementation depending on how you look at it. We have used x and y coordinates
as you would a graph, walking along the corridor and up the stairs as my maths teacher would put it.
It turns out that the computer considers x to be the row from the top of the screen and y to be the
column from the left edge of the screen as if the graph has been turned 90 degrees. This isn't a
problem but we may address this in future versions of the code.

### Does a cell survive?

```zxbasic
function doesCellSurvive(x as ubyte, y as ubyte) as byte
    dim total as ubyte = 0
    dim isAlive as byte = grid(x, y)
    for x2 = x - 1 to x + 1 step 1
        for y2 = y - 1 to y + 1 step 1
            if (x2 <> x or y2 <> y) then
                let total = total + grid(x2, y2)
            end if
        next y2
    next x2

    if (isAlive = 1 and total > 1 and total < 4)
        return 1
    else if (isAlive = 0 and total = 3)
        return 1
    end if
    return 0
end function
```

Here we have a function, which is the same as a subroutine apart from that it must return a value.
The value represents whether the cell at the given grid position is alive in the next iteration and
so we use a byte which will be set to 0 or 1, the same type the grid array uses to represent the
state of each cell.

We calculate the `total` number of live cells surrounding the given cell, without worrying about
going over the bounds of the grid thanks to the DMZ, and store the current state of the cell in
`isAlive`. Once we have those values we can apply the three rules directly in the last if-statement
and return the result (from Wikipedia):

1. Any live cell with two or three live neighbours survives.

2. Any dead cell with three live neighbours becomes a live cell.

3. All other live cells die in the next generation. Similarly, all other dead cells stay dead.

### Iterating the grid

```zxbasic
sub iterateGrid()    
    dim nextGrid(gridWidth, gridHeight) as byte
    for x = 1 to gridWidth - 1 step 1
        for y = 1 to gridHeight - 1 step 1
            let nextGrid(x, y) = doesCellSurvive(x, y)
        next y
    next x
    for x = 0 to gridWidth step 1
        for y = 0 to gridHeight step 1
            let grid(x, y) = nextGrid(x, y)
        next y
    next x
end sub
```

This subroutine creates the next version of the grid in a local variable called `nextGrid`, which is
an exact match in size and type of `grid`. The code loops over `nextGrid` using the same logic as
`drawGrid` but sets each value to the value returned by `doesCellSurvive` when passing in the
current location.

Once `nextGrid` has been created and populated, its contents are copied back into `grid`. The use of
a local copy is necessary so that the contents of `grid` doesn't change as it is being checked.
There is quite a lot of looping and copying going on here but the logic is very simple and easy to
follow.

### Creating a glider

```zxbasic
sub createGliderAt(x as ubyte, y as ubyte)
    let grid(x + 1, y) = 1
    let grid(x + 2, y + 1) = 1
    let grid(x, y + 2) = 1
    let grid(x + 1, y + 2) = 1
    let grid(x + 2, y + 2) = 1
end sub
```

There are a number of well-known patterns that have interesting properties in Conway's Game of Life
but the glider is probably the most well-known and one of the more interesting.

![](/e2e15c58-40a1-4cd6-9e5b-913d4b149023.gif align="center")

Here I have created a single subroutine that is hard-coded to place a glider at the given position,
where the given position is the top left cell of the 9x9 grid required to draw it. I know without
really thinking about it too hard that there are better ways of doing this in ZX BASIC, or just in
general programming terms. I'm deliberately not thinking about it. There are thoughts, somewhere in
my subconscious, but I'm not allowing them to form words. I can ask them "do I need to worry about
this now?" and they respond "no, but probably stop at the glider until you do", and that's as far as
it goes.

### The main loop

```zxbasic
initialiseGrid()
createGliderAt(1, 1)
do
drawGrid()
iterateGrid()
loop:
```

With these constants, global variable, subroutines and function, we can write the main loop. This is
code outside of any subroutine or function and so executes when the program loads. Having split
things up the main loop hardly needs any further explanation. We initialise the grid, create a
glider at position (1, 1), and then enter a loop of drawing the grid and calculating the next
iteration. Running the program displays the glider as in the gif above, which slowly progresses
across the screen.

While the program is slow, the lack of any clever optimisations means that adding multiple gliders,
or even if we ignored that nagging feeling and created subroutines for lots of other patterns and
set up a complex grid, the program would run at the same speed.

