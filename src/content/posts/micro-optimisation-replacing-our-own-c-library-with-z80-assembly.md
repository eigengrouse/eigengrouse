---
title: "Micro Optimisation - Replacing our own C Library with Z80 Assembly"
pubDate: 2024-01-02
author: 'eigengrouse'
description: "Swapping a C grid library for Z80 assembly without rewriting everything."
image: "/micro-optimisation-replacing-our-own-c-library-with-z80-assembly.png"
tags: ["zx-spectrum", "micro-optimisation"]
---

As part of figuring out a modern approach to software development for the ZX Spectrum, I thought it
would be a good idea to apply some so-called good practices such as separating concerns. Good
practices are a tool to use and not something to be applied dogmatically and this applies doubly so
when talking about vintage computing. However, hiding some low level and odd looking optimisations
behind an interface turned out to work quite well.

This is the original `grid.c` code, written in C. It's not very complex but it does compress data
held in a two dimensional array as only 4 bits are required for each value. Using a modulo command
and masking or shifting bits depending on odd or even numbers means that half as much space is
required at the expense of a little extra processing.

```c
#include "grid.h"

#define COMPRESSED_GRID_WIDTH 16 // half of GRID_WIDTH rounded up to next even number

static uint8_t _grid[COMPRESSED_GRID_WIDTH][GRID_HEIGHT];

uint8_t get_grid_value(uint8_t x, uint8_t y)
{
    uint8_t grid_value = _grid[x / 2][y];
    if (x % 2 != 0)
    {
        grid_value = grid_value >> 4; // rotate the last 4 bits to the first 4
    }
    else
    {
        grid_value = grid_value & 15; // blank out the last 4 bits
    }

    return grid_value;
}

void set_grid_value(uint8_t x, uint8_t y, uint8_t value)
{
    uint8_t grid_value = _grid[x / 2][y];
    if (x % 2 != 0)
    {
        value = value << 4;           // rotate the first 4 bits to the last 4
        grid_value = grid_value & 15; // blank out last 4 bits of grid value
    }
    else
    {
        value = value & 15;            // blank out the last 4 bits so we don't overwrite
        grid_value = grid_value & 240; // blank out first 4 bits of grid value
    }

    grid_value = grid_value | value;
    _grid[x / 2][y] = grid_value;
}
```

[Bit masking](https://en.wikipedia.org/wiki/Mask_(computing)) and [bit
shifting](https://en.wikipedia.org/wiki/Bitwise_operation) is bread and butter in assembly. In fact
it's something you do quite a lot of as part of general control flow and data access. This, and the
small size of `grid.c` make it an ideal candidate to be one of the first components to replace in its
entirety, sticking to the [strangler
fig](https://martinfowler.com/bliki/StranglerFigApplication.html) approach. This is what I have done
and the assembly code follows. There are two public methods `get_grid_value_asm` and
`set_grid_value_asm`, with some interop code and stack usage to deal with parameters passed from C.
`load_cell_location` is not public so doesn't have to get values from the stack (`push` and `pop`),
so we avoid doing so as there is some overhead. Perhaps once all the C code is replaced we can go
back and reduce the stack usage throughout, which is how C functions pass parameters but you can
just pre-load the registers.

```clojure
; CONSTANTS
COMPRESSED_GRID_WIDTH: equ $10    ; half of GRID_WIDTH rounded up to next even number (16)
GRID_HEIGHT: equ $17              ; 23

SECTION code_user

PUBLIC _get_grid_value_asm
;----------
; get_grid_value
; inputs: b = y, c = x
; outputs: hl = grid value
; alters: a, bc, de, hl
;----------
_get_grid_value_asm:
            ; extern uint8_t get_grid_value_asm(uint8_t x, uint8_t y) __z88dk_callee;
            pop hl ; hl = ret address
            pop bc ; b = y, c = x
            push hl ; ret address back on stack

            call load_cell_location
            ld a, (hl) ; load 8 bit value into a
            bit $00, c ; is x even?
            jr z, _get_grid_value_asm_even
            or a ; clear carry so doesn't get rotated into number
            rra
            rra
            rra
            rra ; rotate the last 4 bits to the first 4
            jr _get_grid_value_asm_end
_get_grid_value_asm_even:
            and $0f ; blank out the last 4 bits
_get_grid_value_asm_end:
            ld h, $00
            ld l, a ; hl = grid value
            ret

PUBLIC _set_grid_value_asm
;----------
; set_grid_value
; inputs: b = y, c = x, e = grid value
; alters: a, bc, de, hl
;----------
_set_grid_value_asm:
            ; extern void set_grid_value_asm(uint8_t x, uint8_t y, uint16_t value) __z88dk_callee; // last parameter uint16_t as crashes if odd number of 8 bits
            pop hl ; hl = ret address
            pop bc ; b = y, c = x
            pop de ; e = grid value
            push hl ; ret address back on stack

            ld a, e ; a = grid value
            ex af, af' ; store a
            call load_cell_location ; load cell location bc into hl
            ex af, af' ; retrieve a            
            bit $00, c ; is x even?
            jr z, _set_grid_value_asm_even
            or a ; clear carry so doesn't get rotated into number
            rla ; x not even
            rla
            rla
            rla ; rotate the first 4 bits to the last 4
            ld e, a ; e = given value on rhs
            ld a, (hl)            
            and $0f ; a = current lhs value
            jr _set_grid_value_asm_end
_set_grid_value_asm_even: ; x is even
            and $0f ; blank out the last 4 bits so we don't overwrite
            ld e, a ; e = given value on lhs
            ld a, (hl)            
            and $f0 ; a = current rhs value
_set_grid_value_asm_end:
            or e ; a = combined given and current value
            ld (hl), a ; store back in location
            ret

;----------
; load_cell_location
; inputs: b = y, c = x
; outputs: hl = cell location within grid
; alters: a, b, de, hl
;----------
load_cell_location:
            ld a, c ; load a with x
            rra     ; shift-right i.e., divide by 2

            ld hl, grid ; point hl at grid
            ld d, $00 
            ld e, a ; de = a
            add hl, de ; hl = _grid + x/2
            ;ld d, $00 - already 0
            ld e, b ; de = y           
            ld b, COMPRESSED_GRID_WIDTH ; load b to loop COMPRESSED_GRID_WIDTH times
load_cell_location_loop: 
            add hl, de
            djnz load_cell_location_loop            
            ; hl = _grid + (x / 2) + (y * COMPRESSED_GRID_WIDTH)
            ret

SECTION data_user
grid: ds COMPRESSED_GRID_WIDTH*GRID_HEIGHT
```

I don't intend for this to be a Z80 assembly tutorial but I've commented almost every line, and the
assembly subroutines are equivalent to the C functions, so it should be readable. In fact this has
helped a lot, the fact that I was already happy with the structure of the C program and could just
worry about like-for-like code. The interface remains the same to the rest of the code, following
the strangler fig pattern and allowing us to work iteratively. I'm learning as I go myself so may
revisit this, but for now I'm still maintaining the `grid.h` that is used by the rest of the code,
with `grid.c` referencing the assembly code as below.

```c
#include "grid.h"

// imported from grid.asm
extern uint8_t get_grid_value_asm(uint8_t x, uint8_t y) __z88dk_callee;
extern void set_grid_value_asm(uint8_t x, uint8_t y, uint16_t value) __z88dk_callee; // last parameter uint16_t as crashes if odd number of 8 bits

uint8_t get_grid_value(uint8_t x, uint8_t y)
{
    return get_grid_value_asm(x, y);
}

void set_grid_value(uint8_t x, uint8_t y, uint8_t value)
{
    set_grid_value_asm(x, y, value);
}
```

The full commit is available here, and I plan to continue to use the same repository for this second
run at last year's project.
