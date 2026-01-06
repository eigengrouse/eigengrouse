---
title: "ZX Life - Part 1: A Beginning"
pubDate: 2023-03-11
author: 'eigengrouse'
description: "Starting ZX Life with a BASIC-first take on Conway's Game of Life."
image: "/zx-life-part-1-a-beginning.png"
tags: ["zx-spectrum", "zx-life"]
---

I watched a documentary at the end of last week about a single-celled organism known as [The
Blob](https://www.imdb.com/title/tt11366150/) that displayed many of the characteristics of
intelligent life. For example, it had what the scientists described as an 'external' memory by way
of the trail of slime it left behind that repelled it from looking for food in the same place twice.
It could also learn to overcome things it didn't like such as salt from repeated exposure in its
search for food and as it merged with other blobs the learnings (the speed at which it would travel
over salt) were passed on. Things took a dark turn when it was attached to a toy car and provided
steering as a scientist shone a bright light, which it did not like, causing it to steer the other
way. I was reminded of the short story [I Have No Mouth, and I Must
Scream](https://en.wikipedia.org/wiki/I_Have_No_Mouth,_and_I_Must_Scream) and wondered if I was
watching something being tortured.

I was also reminded of [Conway's Game of
Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) and remembered coming up with some kind
of solution in [Modula-2](https://en.wikipedia.org/wiki/Modula-2) in a structured programming course
years ago. Conway's Game of Life is very elegant even if your implementation of it is not, but it's
a good way to practice and learn a language by refactoring until you have an elegant solution within
the syntax of that language. The game is that you start with a grid of cells, each of which can be
alive or dead. Each cell interacts with its 8 neighbours. The initial size and state of the grid can
be anything, but the next state is resolved using the following rules (from Wikipedia):

1. Any live cell with two or three live neighbours survives.

2. Any dead cell with three live neighbours becomes a live cell.

3. All other live cells die in the next generation. Similarly, all other dead cells stay dead.

The patterns that survive and thrive following these rules are well-known and remind me of the blob
with its external memory and ability to merge with other blobs. You wouldn't exactly call them
alive, but at a certain level isn't everything we do, everything *everything* does, governed by
rules in which certain patterns survive and thrive?

The most famous pattern is the glider which is one of the spaceship patterns. Copied here from
Wikipedia.

<figure>
  <img src="/e2e15c58-40a1-4cd6-9e5b-913d4b149023.gif" alt="Animated Conway's Game of Life glider" />
</figure>

Finally it occurred to me that this game was a perfect fit for something I had been thinking about.
I had recently been watching [The Spectrum Show](https://www.youtube.com/user/BuckingTheTrend2008)
and a new developer diary section about a developer who had decided to write a [spectrum version of
Berzerk](https://spectrumcomputing.co.uk/index.php?cat=96&id=32247), and his plan was to initially
write it all in Sinclair BASIC then drop down to machine code where it was needed. For some reason
this was a revelation to me. I knew that in [probably the best version of
BASIC](https://en.wikipedia.org/wiki/BBC_BASIC) by [my favourite computer
scientist](https://en.m.wikipedia.org/wiki/Sophie_Wilson) it was made very easy to write integrated
machine code via its inline assembler. I also knew of a modern implementation of Sinclair BASIC
called [ZX BASIC](https://github.com/boriel/zxbasic) that had this feature. The revelation was that
a viable approach for writing software for the ZX Spectrum, which was something I wanted to do, was
to write it in its entirety in BASIC, then rewrite parts in inline assembler as part of
optimisation, once the structure of the program was correct. That is, once there was an elegant
solution within the syntax of BASIC.

Of course, getting to that elegant solution would require a number of iterations before even
considering where to drop down to machine code. After all as we all know premature optimisation is
the root of all evil. For now, this is my first attempt using ZX BASIC and is just what came out of
my head as I came up with a solution without looking anything up beyond basic ZX BASIC syntax or
worrying about things like [big O notation](https://www.bigocheatsheet.com/) complexity (i.e.
performance). I know even as I commit this that there are crimes against software being committed,
that I'm ignoring some low hanging ZX BASIC fruit, and I'm certain it's not idiomatic ZX BASIC. It's
also incredibly slow, but it's a beginning.

```zxbasic
const gridWidth as ubyte = 33 ' includes DMZ border
const gridHeight as ubyte = 24 ' includes DMZ border
dim grid(gridWidth, gridHeight) as byte

sub initialiseGrid()
    for x = 0 to gridWidth step 1
        for y = 0 to gridHeight step 1
            let grid(x, y) = 0
        next y
    next x
end sub

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

sub createGliderAt(x as ubyte, y as ubyte)
    let grid(x + 1, y) = 1
    let grid(x + 2, y + 1) = 1
    let grid(x, y + 2) = 1
    let grid(x + 1, y + 2) = 1
    let grid(x + 2, y + 2) = 1
end sub

initialiseGrid()
createGliderAt(1, 1)
do
drawGrid()
iterateGrid()
loop:
```

For now I'm using [Klive IDE](https://github.com/Dotneteer/kliveide), which has built-in support for
ZX BASIC and excellent documentation, and was a very quick and easy way to set up a development
environment. Following the getting started instructions for ZX BASIC and copying the above code
should be enough to get started. I've created a GitHub repository but this isn't structured as a
Klive IDE project as I want to stay development environment agnostic for now.
