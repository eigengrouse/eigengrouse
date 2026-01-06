---
title: "Micro Optimisation - Beyond Structured Programming"
pubDate: 2024-02-05
author: 'eigengrouse'
description: "Pushing past straight C-to-assembly translations for faster Z80 code."
image: "/micro-optimisation-beyond-structured-programming.png"
tags: ["zx-spectrum", "micro-optimisation"]
---

The previous post was going to be the last post of this series for the time being, but I think this
will be it. I haven't numbered the posts this time and had left things more open ended with the idea
that I would probably revisit this series with a new post at some point, rather than start a new
series on the same topic. The C code is now all converted to equivalent Z80 assembly, showing the
impact of the micro optimisation of a straight-ish conversion from C to Z80 assembly, with some loop
unrolling and banishing of the surprisingly expensive modulo command. Plus as I noted, it's
objectively harder to further develop a Z80 assembly codebase than it is in a high-level language
like C. Converting each module or function was a fun puzzle that became frustrating at times but
ultimately very rewarding. Being able to put it down afterwards was very much part of the reward.

Since the previous post and over the last week or so I have spent some time looking over the
codebase, and have been able to pick out a few more micro optimisations that only apply in the
context of Z80 assembly. They go beyond the logical optimisations of structured programming that
were the focus of the last series, and use Z80 specific knowledge to reduce the number of clock
cycles or *t-states* used to perform the converted assembly routines. I didn't review the code with
the intention of finding these optimisations they just occurred to me as I looked over each routine
and I thought it was worth applying and commenting on these optimisations so here we are. Actually
the first optimisation I do owe to [this excellent
book](https://twitter.com/Retro_Fusion/status/1729132766288072798) which was an inspiration for this
series and also uses a similar optimisation in one of its chapters on optimisation, that must have
been on my mind when I spotted it.

### Use `add hl, hl` to multiply by 2 or 4 or 8 or 16...

Before:

```clojure
;----------
; load_cell_location
; inputs: b = y, c = x
; outputs: hl = cell location within grid
; alters: a, b, de, hl
;----------
load_cell_location:            
            ld a, c ; load a with x
            or a ; clear carry flag so doesn't get rotated into number
            rra ; shift-right i.e., divide by 2
            ld hl, grid ; point hl at grid
            ld d, $00 
            ld e, a ; de = a
            add hl, de ; hl = _grid + x/2
            ;ld d, $00 - already 0
            ld e, b ; de = y           
            ld b, COMPRESSED_GRID_WIDTH ; load b to loop COMPRESSED_GRID_WIDTH times
load_cell_location_loop: 
            add hl, de
            djnz load_cell_location_loop ; hl = _grid + (x / 2) + (y * COMPRESSED_GRID_WIDTH)
            ret
```

After:

```clojure
;----------
; load_cell_location
; inputs: b = y, c = x
; outputs: hl = cell location within grid
; alters: a, b, de, hl
;----------
load_cell_location:            
            ld a, c ; load a with x
            or a ; clear carry flag so doesn't get rotated into number
            rra ; shift-right i.e., divide by 2
            ld hl, grid ; point hl at grid
            ld d, $00 
            ld e, a ; de = a
            add hl, de ; hl = _grid + x/2
            ;ld d, $00 - already 0
            ld e, b ; de = y           
            ex de, hl ; hl = y
            add hl, hl
            add hl, hl
            add hl, hl
            add hl, hl ; hl = y * COMPRESSED_GRID_WIDTH(=16)
            add hl, de ; hl _grid + (x / 2) + (y * COMPRESSED_GRID_WIDTH)
            ret
```

It so happens that the width of our grid is 32, compressed to 16 bytes, each split into 2 4-bit
"nibbles". We had abstracted our grid from the rest of the code that just cared about `x` and `y`
positions, that were converted into an array location by multiplying the `y` value by the length of
each row i.e., 16. Simple maths, really, but requiring a loop in assembly. That is unless you can just
double the value of `y` 4 times. This is a nice trick that can save enough t-states to make it worth
aiming for data structures that are powers of 2 in size. This is actually what most high-level
languages do, and I can imagine it helps simplify and optimise a few things with this being one of
them.

### Avoid unnecessary pushing and popping

We followed a [strangler fig](https://martinfowler.com/bliki/StranglerFigApplication.html) approach
in this series to convert C to Z80 assembly, which is a modern software engineering term that just
means replacing modules with code that has the same inputs and outputs, leaving the rest of the code
unaware. Fortunately for us [z88dk](https://github.com/z88dk/z88dk) supports interop with Z80
assembly and this was fairly seamless. A feature of C, however, is that it passes parameters via the
stack, which protects them from changes made by the callee but this has some overhead. An
alternative approach is just to load the registers with the values expected by the callee, and make
a note of what registers are affected by the callee. Often, but not always, this means the stack
isn't needed to protect the values. Going from stack-by-default to stack-when-required can save
quite a few clock cycles. This breaks
[encapsulation](https://en.m.wikipedia.org/wiki/Encapsulation_(computer_programming)) somewhat and
you tend to do things like try to always use the `de` registers for `x` and `y` to avoid juggling
registers, or work backwards to update callers so that they do, but it can be worth doing. For
example...

Before:

```clojure
            ld d, $00
            ld e, a ; e = current char
            push de ; pass char
            ld de, $080a ; x = 10, y = 8
            push de ; pass x,y
            call draw_chr_at ; draw char
            ...

;----------
; draw_chr_at
; inputs: d = y, e = x, bc = character code
; alters: a, bc, de, hl
;----------
draw_chr_at:
            pop hl ; hl = ret address
            pop de ; d = y, e = x
            pop bc ; c = character code
            push hl ; ret address back on stack

            ; load hl with memory address of character glyph
            ; etc...
```

After:

```clojure
            ld b, $00
            ld c, a ; bc = current char
            ld de, $080a ; x = 10, y = 8
            call draw_chr_at ; draw char
            ...

;----------
; draw_chr_at
; inputs: d = y, e = x, bc = character code
; alters: a, bc, de, hl
;----------
draw_chr_at:
            ; load hl with memory address of character glyph
            ; etc...
```

### Avoid unnecessary calculations

This was probably the biggest win although it's harder to meaningfully show the before and after
code. As one of our big O optimisations we started tracking active cells so that not every cell was
checked on every iteration, and this was a nice high-level optimisation. Instead of storing the `x`
and `y` position however, we stored a numbered location which was converted to and from `x` and `y`
positions as and when required. This not only meant multiplying by 16 as in the above optimisation,
but also dividing and using the remainder which was an even more convoluted calculation. An obvious
improvement, once I thought about it, was just to store the `y` value in the first byte of a 16-bit
number and the `x` value in the second byte (`y` first for ZX Spectrum reasons). Z80 registers are
8-bit so a register pair e.g., `de` that was storing a 16-bit number would now represent `d=y`,
`e=x`. One way to show the improvement I suppose is the full `grid.asm` before and after. Note that
we no longer need `get_cell_x_coord` or `get_cell_y_coord`, which were also among the most complex
routines in the codebase.

These final micro optimisations were the result of a shift in mindset from high-level structured
programming to machine language that only occurred once the initial conversion from C to Z80
assembly was complete. I'm happy with these optimisations and the performance improvement is
noticeable making me question my previous conclusion that you can create pretty much whatever you
want on 8-bit machines using C, so long as you think about how it will be converted to assembly.
Perhaps this suggests more of a hybrid approach where you think about how it will be converted while
also being prepared to roll your sleeves up and convert it yourself to apply the optimisations that
go beyond structured programming. The full commit containing all these optimisations is available
here, which also includes removing the unnecessary loading screen and introducing a *minimum* number
of cycles between letters to tackle the new problem of it being too fast.
