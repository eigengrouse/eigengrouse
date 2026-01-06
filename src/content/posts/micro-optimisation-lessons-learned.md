---
title: "Micro Optimisation - Lessons Learned"
pubDate: 2024-01-17
author: 'eigengrouse'
description: "Looking back on replacing the C code with Z80 assembly."
image: "/micro-optimisation-lessons-learned.png"
tags: ["zx-spectrum", "micro-optimisation"]
---

The previous couple of posts have detailed some specific translations from C to Z80 assembly and set
up this final run nicely. We were reasonably happy with the existing structure of our C
implementation and tackling leaf modules or libraries like `grid.h` and `screen.h` provided a path
for our [strangler fig approach](https://martinfowler.com/bliki/StranglerFigApplication.html).
Like-for-like code from C to heavily-commented Z80 showed how this could be done iteratively without
breaking the rest of the code, without being a tutorial on Z80 assembly. After all this whole thing
was inspired by a [modern Z80 assembly
resource](https://twitter.com/Retro_Fusion/status/1729132766288072798) that is an excellent tutorial
for anyone looking.

That being said, there have been a number of commits since the last post and lessons have been
learned along the way. All of the C code has been replaced with Z80 assembly and each `.c` file is
now a `.asm` file, and each C function is a Z80 routine. We're also now using
[pasmo](https://pasmo.speccy.org/) instead of [z88dk](https://github.com/z88dk/z88dk) to kind of
prove that the Z80 assembly is legit. Some of the loops and nested structures have been unrolled in
the process to simplify the translation, and there has been some hard won knowledge gained from a
few sticky issues. The outcome of which is a deeper understanding of Z80 assembly (the goal) and an
even deeper respect of the z88dk C compiler.

### The z88dk compiler is magic

The z88dk compiler provides a `--list` switch, which outputs the Z80 assembly it converts your C
code into and I used this on two occasions. First when I wasn't quite happy with how I'd implemented
`updated_cells[updated_cell_count++] = cell_location` falling into the trap of "if all you have is a
hammer, everything looks like a nail". [`djnz`](http://z80-heaven.wikidot.com/instructions-set:djnz)
had become my hammer for operating on every item in a collection or any kind of loop. I was using it
just to find a location however and it felt wrong and it was wrong. I'd also noticed that the C
implementation seemed to be processing the game area more quickly, which I didn't expect. It was
only when I wondered "what is the z88dk compiler doing?" that I found `--list`.

After looking in awe at what z88dk was doing, that became my implementation (after some tidying up),
which increments `updated_cell_count` while it already has it and without impacting `hl`, and
without any looping. This is extremely elegant.

```clojure
ld bc, updated_cells
ld hl, updated_cell_count
ld e, (hl)
inc (hl) ; updated_cell_count++
ld l, e
ld h, $00
add hl, hl
add hl, bc ; hl = pointer to updated_cells[updated_cell_count]
```

I used `--list` again right at the end when finally tackling the `main` loop. This wasn't because I
was stuck or thought my code was bad but I knew I was probably using too many variables in one place
and idly wondered what the compiler would do before tackling. What it did was move the location in
which some variables were created and assigned to be just-in-time, performing the restructuring I
had done for other functions to help the translation. It also did some clever stack pointer
manipulation to swap register values with fewer `push` and `pop` commands. I did rewrite that part
as it felt too trick-y but I did learn something.

### Avoid the modulo or `%` command

This surprised me and I think it would surprise a lot of modern day software engineers. I hadn't
really come across the [modulo](https://en.m.wikipedia.org/wiki/Modulo) or `%` command before
learning to code, then suddenly it was everywhere. Coders love to use it for some reason. To the
point that I assumed that it was the optimal way of calculating something, anything, usually along
the lines of *do something every n iterations*. When in fact you can do that without using `%`, just
count to n and reset. It was actually the z88dk `--list` output for the `main` loop that alerted me
to this because it didn't provide the implementation but instead called on one of its own built-in
routines bumping up the `.tap` file size. Not a great sign.

```c
// if grid has low activity or it's been more than 20 iterations since a new letter
if (updated_cell_count < 10 || count % 20 == 0)
{    
    count = 0;
```

became

```c
// if grid has low activity or it's been more than 20 iterations since a new letter
if (updated_cell_count < 10 || count == 20)
{    
    count = 0;
```

and the Z80 assembly becomes much more straightforward

```clojure
main_loop:
            ld a, l
            sub $0a ; is update_cell_count < 10
            jr c, main_add_character ; yes, add character
            ld a, (ix-1)
            sub $14 ; is count < 20
            jr nz, main_cycle_ink ; no, bypass add character
main_add_character:
```

I suppose a more general point would be that ***it's possible to rewrite your C code to simplify
translation to more optimal Z80 assembly***. And by C code I also mean BASIC or pseudocode, if
that's your approach i.e., the logic.

Another example of rewriting code to simplify translation is a nested loop that processes the cells
surrounding the current cell. Instead of

```c
int x2 = 0;
int y2 = 0;
for (x2 = x - 1; x2 <= x + 1; x2++)
{
    for (y2 = y - 1; y2 <= y + 1; y2++)
    {
        if (x != x2 || y != y2)
        {
```

The unrolled code is longer but faster, being more simplistic

```clojure
update_active_cells:
            dec d ; d = y - 1
            dec e ; e = x - 1
            call update_active_cell ; x - 1, y - 1
            inc d ; d = y
            call update_active_cell ; x - 1, y
            inc d ; d = y + 1            
            call update_active_cell ; x - 1, y + 1
            inc e ; e = x            
            call update_active_cell ; x, y + 1
            dec d
            dec d ; d = y - 1
            call update_active_cell ; x, y - 1
            inc e ; e = x + 1
            call update_active_cell ; x + 1, y - 1
            inc d ; d = y            
            call update_active_cell ; x + 1, y
            inc d ; d = y + 1            
            call update_active_cell ; x + 1, y + 1
            ret
```

### C is 5k bigger but may be fast enough

Admittedly someone with deeper knowledge of Z80 assembly could improve the performance or reduce the
size further, but I was surprised how close in performance the pure C implementation was. And I
think the 5k size increase is an up-front cost that is a smaller percentage of larger programs, or
can be reduced by writing your code a certain way (e.g., avoid `%`). I had optimised the code as much
as I could in terms of [big O notation](https://en.wikipedia.org/wiki/Big_O_notation) in the first
series of this project so maybe that's where the big wins really were. I suppose the clue is in the
name, this has been a [micro
optimisation](https://softwareengineering.stackexchange.com/questions/99445/is-micro-optimisation-important-when-coding)
which has been great for learning but you would normally pick your battles rather than do a full
rewrite. It’s a fun puzzle to pick off a C function and rewrite in assembly, and so rewarding to get
it working and see a performance improvement. There are diminishing returns however, and a sad fact
is that now the code has been translated in full there is much less chance of it being developed
further, being objectively harder to do so.

In terms of vintage computing and the ZX Spectrum, 5k is a big price to pay when there's not much
space to begin with. Also for arcade games squeezing out another 5% of performance may be critical
in certain scenarios. However, even though this process has been an enjoyable learning experience
for me in how to translate C or BASIC or pseudocode to Z80 assembly, I think I'd rather live as long
as possible in the high-level language. To design and optimise algorithms first, but then use this
new knowledge to write code that translates well into Z80 assembly. Whether that is generated by the
compiler or written by hand as a micro optimisation at the end of the process. Structuring code so
that potential micro optimisations can target individual functions or libraries like our strangler
fig approach, that left the rest of the code unchanged and unaware, also worked very well. I
actually think you could save enough space and improve performance this way to write pretty much
whatever you want.
