---
title: "Micro Optimisation - Calling Z80 Assembly from C on the ZX Spectrum"
pubDate: 2023-12-30
author: 'eigengrouse'
description: "Calling handwritten Z80 from C with z88dk on the ZX Spectrum."
image: "/micro-optimisation-calling-z80-assembly-from-c-on-the-zx-spectrum.png"
tags: ["zx-spectrum", "micro-optimisation"]
---

Earlier this year I decided to learn how to program the ZX Spectrum and wrote a series of posts
about how I was inspired and what I was going to do about it, and what I did. Nothing that was
particularly ground-breaking or interesting to anyone other than myself but I got something out of
it and after about a month of intermittent activity, was satisfied that I'd scratched an itch(.io).

The original intention was to use [ZX BASIC](https://zxbasic.readthedocs.io/en/docs/) to develop a
solution I was happy with in terms of structure, then drop down to assembly to fix any performance
bottlenecks. What I actually ended up doing was use [z88dk](https://github.com/z88dk/z88dk) and
write code in C throughout, making use of its optimal code generation and libraries. Like a ZXing
casual. That's what I was though, as I'd read [one classic
book](https://www.amazon.co.uk/Spectrum-Machine-Language-Absolute-Beginner/dp/1789822378) and
followed a couple of tutorials but was happy enough to defer to the z88dk compiler for now. I had
much more experience in high-level languages and optimisation via software design. I was actually
pretty happy with how I’d managed to optimise the solution without using assembly, which remained on
the peripheral of my knowledge.

I saw a tweet about a month ago promoting a [new
book](https://twitter.com/Retro_Fusion/status/1729132766288072798) on Z80 assembly and it felt like
a chance to learn more about this mysterious low level language that was used by the old masters. I
ordered it and it arrived, and I read it from cover to cover over the course of a few weeks. It's
great and I recommend it to anyone interested in learning Z80 assembly. I know that I won't retain
the knowledge unless I start applying it, so my plan now is to revisit the project and attempt to
convert it to Z80 assembly. I want to do this as per the original intention of the project. I'm
already happy enough with the structure so something like the [strangler fig
pattern](https://martinfowler.com/bliki/StranglerFigApplication.html) in modern software
engineering, where component parts of the code are gradually replaced by equivalent implementations
in Z80 assembly. There is built-in support for this in z88dk, being able to call Z80 assembly from C
code and vice versa I believe. Then finally we may even do away with C altogether.

I'm hopeful that there will be performance improvements in the main part of the game, where there
are optimisations in terms of complexity (as in [big O notation](https://www.bigocheatsheet.com/))
but the control flow and data access are written in C, reliant on the ability of the compiler. This
is where a so-called micro-optimisation of rewriting the same logic in assembly should have an
impact on a vintage micro like the ZX Spectrum. The first thing I have tackled however is replacing
`stdio.h` in the introduction where the user can enter a message to display, to populate the grid.
There is no real performance benefit here but the size of the resulting binary is reduced by not
using the whole `stdio.h` library, and the assembly itself was straightforward, providing a good
scope for a proof of concept. I will probably tweak the assembly code itself to make it more
idiomatic or as I learn new things but the full commit is here.

There were a few changes I had to make to get C and Z80 assembly nicely integrating, but the main
changes were in main.c replacing

```c
#include "game.h"
#include "screen.h"
#include <stdio.h>

void main()
{
    uint8_t message[50];

    clear_screen();
    printf("Welcome To ZX Life!\n\n");
    printf("Please enter message to display,maximum 50 characters:\n\n");
    fgets(message, 50, stdin);
```

with

```c
#include "game.h"
#include "screen.h"

// imported from get_message.asm
extern void get_message() __z88dk_callee;
extern uint8_t message[];

void main()
{
    clear_screen();

    get_message();
```

which makes use of `get_message.asm` to provide the functionality. I've done my best to structure
and comment the code so that someone could follow what's happening but assembly is very much an art
in itself and I won't pretend that this will be a tutorial, beyond some commented code. Comments are
essential, you definitely won't get away with trying to claim the code is the documentation as many
modern-day developers do. What I will try and do though is write a few posts as I go through the
process of converting the code and maybe it will be useful or interesting to someone. Even if that's
just me.
