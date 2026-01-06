---
title: "ZX Life - Part 3: A Big O No(tation)"
pubDate: 2023-03-14
author: 'eigengrouse'
description: "Measuring where a ZX Spectrum Game of Life really spends its time."
image: "/zx-life-part-3-a-big-o-notation.png"
tags: ["zx-spectrum", "zx-life"]
---

In Part 2 we broke down our solution to [Conway's Game of
Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) in [ZX
BASIC](https://github.com/boriel/zxbasic) and I explained each section of code in terms of what it
did and why I wrote it that way. The answer to why in every case was that I was concerned with
simplicity over everything else including performance, memory usage, and graphics or usability. The
simplicity of a solution is not the same as the complexity of its algorithms, however, in terms of
computer science and [big O notation](https://www.bigocheatsheet.com/). The code is easy to follow
and self-explanatory but inefficient in terms of time and space complexity, which is different from
saying it's complex. The code for this series is available in the project repository.

I've linked to a big O notation cheat sheet rather than the Wikipedia article which does the classic
maths thing of making something simple sound complicated. Okay [here it
is](https://en.wikipedia.org/wiki/Big_O_notation) but just because I want to quote this sentence,
which nicely explains its use in computer science:

> In computer science, big O notation is used to classify algorithms according to how their run time or space requirements grow as the input size grows.

Our solution is split up into subroutines and functions, which are algorithms so we shall classify
each of these in terms of time and space complexity. Our aim is, and always has been, to optimise
within the syntax of BASIC as much as we can before dropping down to machine code where it makes
sense, using the [ZX BASIC support for inline
assembly](https://zxbasic.readthedocs.io/en/docs/asm/). The way we have split up and structured our
solution may need to change. This is a normal part of developing software and where it becomes more
of a craft, to find the right balance between the best split technically and something easily
communicated. Like our demilitarized zone (DMZ), it makes sense when making our solution easy to
understand and communicate, but technically it turns out to be a bit of a disaster.

Understanding the time and space complexity of our solution will help us improve it within the
syntax of BASIC. If we improve it as much as we can, then we are left with logically efficient code
where the micro-optimisations of dropping down to machine code via inline assembler come into play.

### Constants and global variables

* x = active grid width

* y = active grid height

* Time complexity = `O(1)`

* Space complexity = `O((x + 2) * (y + 2))`

```zxbasic
const gridWidth as ubyte = 33 ' includes DMZ border
const gridHeight as ubyte = 24 ' includes DMZ border
dim grid(gridWidth, gridHeight) as byte
```

A simple statement, or a sequence of simple statements, has an assumed time complexity of `O(1)` as
it takes the same amount of time regardless of the input size. It's useful to note that both
`gridWidth` and `gridHeight` include the DMZ border making them two cells larger than the active
grid. The complexities of our algorithms end up being composed of either the active grid or the
active grid plus DMZ, so we will use `x` to mean the active grid width and `y` to mean the active
grid height. Then when we are including the DMZ this becomes `x + 2` and `y + 2`. This gives the
grid declaration a space complexity of `O((x + 2) * (y + 2))`.

This is where our idea of using a DMZ starts to unravel. Including a DMZ is already increasing the
space complexity by more than you might think. Assuming that the active grid is 31 by 22 then the
time complexity of `O((x + 2) * (y + 2))` vs `O(x * y)` is 792 vs 682 i.e., 13.78% more complex. This
increase is applied in the time and space complexities of a number of our algorithms.

### Initialising the grid

* Time complexity = `O((x + 2) * (y + 2))`

* Space complexity = `O(1)`

```zxbasic
sub initialiseGrid()
    for x = 0 to gridWidth step 1
        for y = 0 to gridHeight step 1
            let grid(x, y) = 0
        next y
    next x
end sub
```

Initialising the grid involves looping over the active grid plus DMZ and setting all values to 0.
This makes the time complexity `O((x + 2) * (y + 2))` as we are using a nested loop over the grid
width plus DMZ, then over the grid height plus DMZ, finally setting an array value. Setting an array
value has an assumed complexity of `O(1)` so we just multiply the result by 1 (do nothing).

### Drawing the grid

* Time complexity = `O(x * y)`

* Space complexity = `O(1)`

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

Drawing the grid ends up being less complex than initialising it as we only draw the active part,
otherwise it's very similar. The if statement and its contents are given an assumed complexity of
`O(1)` as it is a sequence of simple statements, so the overall time complexity is `O(x * y)`.

### Does a cell survive?

* Time complexity = `O(1)`

* Space complexity = `O(1)`

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

The use of a DMZ means that the logic of this function is the same in every case. For the given cell
location, count the number of surrounding cells that are alive. The outer loop steps over `x - 1` to
`x + 1` and the inner loop over `y - 1` to `y + 1` i.e., 3 \* 3 = 9 and the rest are simple
statements. It looks like our time complexity should be `O(9)` but it's `O(1)` as it takes the same
amount of time regardless of the input size (`O(9)` is not a valid complexity).

### Iterating the grid

* Time complexity = `O((x * y) + ((x + 2) * (y + 2)))`

* Space complexity = `O((x + 2) * (y + 2))`

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

We roll the complexity of `doesCellSurvive` into this algorithm as it is called inside the first
nested loop over the active grid to work out the next iteration. That was `O(1)` so has no effect
(just testing!). Then we add a nested loop over the active grid plus DMZ to set the values of
`nextGrid`. `nextGrid` is the same size and type as `grid` so has the same space complexity, which
ends up being the space complexity for the whole algorithm.

### Creating a glider

* Time complexity = `O(1)`

* Space complexity = `O(1)`

```zxbasic
sub createGliderAt(x as ubyte, y as ubyte)
    let grid(x + 1, y) = 1
    let grid(x + 2, y + 1) = 1
    let grid(x, y + 2) = 1
    let grid(x + 1, y + 2) = 1
    let grid(x + 2, y + 2) = 1
end sub
```

I cast aside any intrusive thoughts in Part 2 for now about why this subroutine is bad but in terms
of time and space complexity, it's pretty good. Let's leave it at that.

### The main loop and total complexities

* Total time complexity = `O(2((x + 2) * (y + 2)) + 2(x * y))`

* Total space complexity = `O(2((x + 2) * (y + 2)))`

```zxbasic
initialiseGrid()
createGliderAt(1, 1)
do
drawGrid()
iterateGrid()
loop:
```

I've ignored the fact that part of this Main Loop is in a loop and part is not, and resolved the
time and space complexities of its component parts. I've also included the complexities of the
constants and global variable to give us the results in the bullets. They are just the totals of
each section added together, with some reduction in the formula and removing any `O(1)` complexities
because they're not useful. Incidentally, I've deliberately not reduced the complexity formulas
beyond how they map visually to the algorithms to aid clarity. I'm aware that `O(2((x + 2) * (y +
2)))` can be reduced to `O(2xy + 4x + 4y + 8)` for example.

We will stop here. It's not my intention to apply any optimisations now no matter how obvious, but
now we have some understanding of the inefficiencies of our solution within the syntax of ZX BASIC.
We also have a method of measuring inefficiencies which will help us quantify improvements to a
certain extent. It's a useful tool when used at this level after all and an approximation, rather
than the scary mathematical proof that Wikipedia makes out.

