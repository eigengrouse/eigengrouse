---
title: "Micro Optimisation - To ROM Then Not To ROM"
pubDate: 2024-01-07
author: 'eigengrouse'
description: "Replacing the screen library and weighing ROM vs custom rendering."
image: "/micro-optimisation-to-rom-then-not-to-rom.png"
tags: ["zx-spectrum", "micro-optimisation"]
---

It turned out that splitting our C implementation of Conway's Game of Life for the ZX Spectrum into
libraries provided a useful route for replacing components with equivalent Z80 assembly. Interop
between C and Z80 assembly provided by z88dk meant that the rest of the code could remain unchanged,
as the Z80 slowly took over like a [strangler
fig](https://martinfowler.com/bliki/StranglerFigApplication.html). The most simplistic library
`grid.h` was replaced, although `grid.c` and `grid.h` remained but offloaded their calls to
`grid.asm` via z88dk interop. Getting that working was fairly painless although parameters are
passed via the stack so there is some overhead in wrapping the assembly routine with a C function.

With that working, it's time to turn our attention to another library `screen.h` which is slightly
more complicated in terms of what it does, which is implement ZX Spectrum specific graphics via the
z88dk library `arch/zx.h`. The current implementation is as follows.

```c
#include <arch/zx.h>

extern uint8_t cell_sprite[];
static uint8_t *font = (uint8_t *)(15360); // point font into rom character set

static void print_chr_at(uint8_t x, uint8_t y, uint8_t *c)
{
    uint8_t *p;
    uint8_t i;
    p = zx_cxy2saddr(x, y);
    for (i = 0; i < 8; ++i)
    {
        *p = *c++;
        p += 256;
    }
}

void print_block_at(uint8_t x, uint8_t y, uint8_t ink)
{
    *zx_cxy2aaddr(x, y) = ink | (ink * 8) | BRIGHT;
}

void print_cell_at(uint8_t x, uint8_t y, uint8_t ink)
{
    *zx_cxy2aaddr(x, y) = ink | PAPER_WHITE;
    print_chr_at(x, y, cell_sprite);
}

void clear_cell_at(uint8_t x, uint8_t y)
{
    *zx_cxy2aaddr(x, y) = INK_WHITE | PAPER_WHITE;
}

uint8_t *get_glyph_from_chr(uint8_t c)
{
    return font + (c * 8);
}

void clear_screen()
{
    zx_border(INK_WHITE);
    zx_cls(PAPER_WHITE);
}
```

As the title suggests, my first run at this involved making use of ZX Spectrum ROM routines, namely
`rst $10`. This is a print routine that is used by [Sinclair
BASIC](https://en.wikipedia.org/wiki/Sinclair_BASIC) to provide a way to print some given text, in a
given colour, to a given location on the screen. This is essentially what most of our library does
so it provides a nice first step into rewriting in Z80 assembly. We do print an 8x8 sprite as well,
but thankfully an ASCII table implemented by the ROM leaves space for up to 21 UDGs, that is User
Defined Graphics, and these can be passed in as if characters themselves.

Many early games for the ZX Spectrum implemented their graphics this way as using this ROM routine,
or the equivalent Sinclair BASIC `PRINT AT`, could provide basic but fast graphics routines for an
entire game. Many early games for the ZX Spectrum were written in Sinclair BASIC in fact so
supporting it in this way was a smart move, making it possible for anyone with a ZX Spectrum to use
its built-in basic to create playable, graphical games. Type-ins were also popular, included in
magazines or even [books](https://usborne.com/gb/books/computer-and-coding-books) you could buy or
borrow from the library. Our first iteration using the `PRINT AT` or `rst $10` ROM routine is as
follows.

```clojure
; CONSTANTS
UDG: equ $5c7b ; RAM address of user defined graphics
VIDEORAM: equ $4000 ; address of video RAM
VIDEORAM_L: equ $1800 ; length of video RAM
VIDEOATT: equ $5800 ; address of attribute RAM
VIDEOATT_L: equ $0300 ; length of attribute RAM
LOCATE: equ $0dd9 ; ROM address for AT routine to position the cursor

SECTION code_user

PUBLIC _load_graphics_asm
;----------
; load_graphics_asm
; alters: hl
;----------
_load_graphics_asm:
            ld hl, cell_sprite ; load cell sprite location
            ld (UDG), hl ; load as first UDG
            ret

PUBLIC _print_string_asm
;----------
; print_string_asm
; inputs: hl = first position of a null ($00) terminated string
; alters: af, hl
;----------
_print_string_asm:
            ld   a, (hl) ; a = character to be printed
            or   a ; sets z register if 0
            ret  z ; return if z register set
            rst  $10 ; prints the character
            inc  hl ; hl = next character
            jr   _print_string_asm ; loop

PUBLIC _clear_screen_asm
;----------
; clear_screen_asm
; clears all pixels, sets ink to black and paper white
; alters: bc, de, hl
;----------
_clear_screen_asm:
            ; clear pixels
            ld hl, VIDEORAM ; hl = video RAM address
            ld de, VIDEORAM+1 ; de = next address
            ld bc, VIDEORAM_L-1 ; bc = length of video RAM - 1 (to loop)
            ld (hl), $00 ; clear first position
            ldir ; loop and clear the rest
            ; clear attributes
            ld hl, VIDEOATT ; hl = attribute RAM address
            ld de, VIDEOATT+1 ; de = next address
            ld bc, VIDEOATT_L-1 ; bc = length of attribute RAM - 1 (to loop)
            ld (hl), @00111000 ; paper white, ink black
            ldir ; loop and set the rest            
            ret

PUBLIC _clear_cell_at_asm
;----------
; clear_cell_at_asm
; inputs: b = y, c = x
; alters: a, bc, de
;----------
_clear_cell_at_asm:
            ; extern void clear_cell_at_asm(uint8_t x, uint8_t y) __z88dk_callee;
            pop hl ; hl = ret address
            pop de ; d = y, e = x
            push hl ; ret address back on stack
            call convert_x_y_coords
            call LOCATE ; call LOCATE ROM routine
            ld a, $13 ; control code for set bright
            rst $10 ; call PRINT ROM routine
            ld a, 0 ; bright value
            rst $10
            ld a, ' ' ; clear
            rst $10
            ret

PUBLIC _print_cell_at_asm
;----------
; print_cell_at_asm
; inputs: d = y, e = x, c = ink
; alters: a, bc, de, hl
;----------
_print_cell_at_asm:
            ; extern void print_cell_at_asm(uint8_t x, uint8_t y, uint16_t ink) __z88dk_callee;
            pop hl ; hl = ret address
            pop de ; d = y, e = x
            pop bc ; c = ink
            push hl ; ret address back on stack
            push bc ; store bc (ink)
            call convert_x_y_coords
            call LOCATE ; call LOCATE ROM routine
            pop bc ; retrieve bc (ink)
            ld a, $10 ; control code for set ink
            rst $10 ; call PRINT ROM routine
            ld a, c ; ink value            
            rst $10
            ld a, $13 ; control code for set bright
            rst $10
            ld a, 0 ; bright value
            rst $10
            ld a, $90 ; cell UDG stored at $90
            rst $10 ; print
            ret

PUBLIC _print_block_at_asm
;----------
; print_block_at_asm
; inputs: d = y, e = x, c = ink
; alters: a, bc, de
;----------
_print_block_at_asm:
            ; extern void print_block_at_asm(uint8_t x, uint8_t y, uint16_t ink) __z88dk_callee;
            pop hl ; hl = ret address
            pop de ; d = y, e = x
            pop bc ; c = ink
            push hl ; ret address back on stack
            push bc ; store bc (ink)
            call convert_x_y_coords            
            call LOCATE ; call LOCATE ROM routine
            pop bc ; retrieve bc (ink)
            ld a, $10 ; control code for set ink
            rst $10 ; call PRINT ROM routine
            ld a, c ; ink value            
            rst $10
            ld a, $13 ; control code for set bright
            rst $10
            ld a, 1 ; bright value
            rst $10
            ld a, $8F ; print block
            rst $10
            ret

;----------
; convert_x_y_coords
; inputs: d = y, e = x (top left is 0,0)
; outputs: b = y, c = x (top left is 24,33 - as expected by ROM AT)
; alters: a, bc, de
;----------
convert_x_y_coords:
            ld a, $18
            ld b, d
convert_x_y_coords_y_loop:
            dec a
            djnz convert_x_y_coords_y_loop  
            ld d, a ; y = $18-y
            ld a, $21
            ld b, e
convert_x_y_coords_x_loop:
            dec a
            djnz convert_x_y_coords_x_loop  
            ld e, a ; x = $21-x
            ld b, d ; b = y
            ld c, e ; c = x
            ret

PUBLIC _get_glyph_from_chr_asm
;----------
; get_glyph_from_chr_asm
; inputs: l = character
; outputs: hl = pointer to glyph
; alters: hl
;----------
_get_glyph_from_chr_asm:
            ld h, $00 ; make sure h is 00
            add hl, hl
            add hl, hl
            add hl, hl ; h *= 8
            add hl, $3C00 ; add start of character fonts
            ret

SECTION rodata_user

cell_sprite:
            defb @10101010
            defb @01010101
            defb @10101010
            defb @01010101
            defb @10101010
            defb @01010101
            defb @10101010
            defb @01010101
```

`cell_sprite` is loaded as a UDG via `load_graphics_asm` which is called from `main.c`, but then the
rest of the C code is largely unchanged apart from `screen.h` and `screen.c` becoming wrappers for
`screen.asm`, as we did for `grid.asm`. The full commit is available here (it does include some
other light refactoring). The only real issue was that `rst $10` treats x and y as starting from the
bottom right, instead of the top left, and so I had to write an extra routine `convert_x_y_coords`.

I did however assume that this `rst $10` routine was the fastest way of printing to the screen, with
it being built into the ZX Spectrum ROM. In fact it's not that optimal according to various forums,
it was really just created to support and optimise Sinclair BASIC. Various examples and links were
given to more optimal Z80 assembly that worked by returning the screen address of an x, y position
that was an 8x8 square that could be updated, or an *attribute* address which is 8 flags
representing the ink and paper colour (foreground and background).

I adapted these two routines `get_char_address` and `get_attr_address` that were attributed to [Dean
Belfield](http://www.breakintoprogram.co.uk/) and [Jonathan
Cauldwell](https://jonathan-cauldwell.itch.io/) respectively, so shout out to them, and made them
part the next iteration as follows.

```clojure
VIDEORAM: equ $4000 ; address of video RAM
VIDEORAM_L: equ $1800 ; length of video RAM
VIDEOATT: equ $5800 ; address of attribute RAM
VIDEOATT_L: equ $0300 ; length of attribute RAM

SECTION code_user

PUBLIC _print_string_asm
;----------
; print_string_asm
; inputs: hl = first position of a null ($00) terminated string
; alters: af, hl
;----------
_print_string_asm:
            ld   a, (hl) ; a = character to be printed
            or   a ; sets z register if 0
            ret  z ; return if z register set
            rst  $10 ; prints the character
            inc  hl ; hl = next character
            jr   _print_string_asm ; loop

PUBLIC _clear_screen_asm
;----------
; clear_screen_asm
; clears all pixels, sets ink to black and paper white
; alters: bc, de, hl
;----------
_clear_screen_asm:
            ; clear pixels
            ld hl, VIDEORAM ; hl = video RAM address
            ld de, VIDEORAM+1 ; de = next address
            ld bc, VIDEORAM_L-1 ; bc = length of video RAM - 1 (to loop)
            ld (hl), $00 ; clear first position
            ldir ; loop and clear the rest
            ; clear attributes
            ld hl, VIDEOATT ; hl = attribute RAM address
            ld de, VIDEOATT+1 ; de = next address
            ld bc, VIDEOATT_L-1 ; bc = length of attribute RAM - 1 (to loop)
            ld (hl), @00111000 ; paper white, ink black
            ldir ; loop and set the rest            
            ret

PUBLIC _clear_cell_at_asm
;----------
; clear_cell_at_asm
; inputs: b = y, c = x
; alters: a, bc, de
;----------
_clear_cell_at_asm:
            ; extern void clear_cell_at_asm(uint8_t x, uint8_t y) __z88dk_callee;
            pop hl ; hl = ret address
            pop de ; d = y, e = x
            push hl ; ret address back on stack

            call get_attr_address
            ld (hl), @00111000 ; paper white

            ex de, hl ; h = y, l = x
            call get_char_address
            ld de, clear_sprite ; h = y, l = x, de = address of glyph
            call print_char_at
            ret

PUBLIC _print_cell_at_asm
;----------
; print_cell_at_asm
; inputs: d = y, e = x, c = ink
; alters: a, bc, de, hl
;----------
_print_cell_at_asm:
            ; extern void print_cell_at_asm(uint8_t x, uint8_t y, uint16_t ink) __z88dk_callee;
            pop hl ; hl = ret address
            pop de ; d = y, e = x
            pop bc ; c = ink
            push hl ; ret address back on stack

            call get_attr_address
            ld a, c ; a = ink
            or @00111000 ; paper white
            ld (hl), a ; set attribute value

            ex de, hl ; h = y, l = x
            call get_char_address
            ld de, cell_sprite ; h = y, l = x, de = address of glyph
            call print_char_at
            ret

;----------
; print_char_at
; inputs: h = y, l = x, de = location of char
; alters: a, bc, de, hl
;----------
print_char_at:
            ld b, $08 ; loop counter
print_char_at_loop:
            ld a, (de) ; get the byte
            ld (hl), a ; print to screen
            inc de ; goto next byte of character
            inc h ; goto next line of screen
            djnz print_char_at_loop ; loop 8 times
            ret

PUBLIC _print_block_at_asm
;----------
; print_block_at_asm
; inputs: d = y, e = x, c = ink
; alters: a, bc, de
;----------
_print_block_at_asm:
            ; extern void print_block_at_asm(uint8_t x, uint8_t y, uint16_t ink) __z88dk_callee;
            pop hl ; hl = ret address
            pop de ; d = y, e = x
            pop bc ; c = ink
            push hl ; ret address back on stack
            
            call get_attr_address
            ld a, c ; a = ink
            or @01111000 ; paper white, bright
            ld (hl), a ; set attribute value
            
            ex de, hl ; h = y, l = x
            call get_char_address
            ld de, block_sprite ; h = y, l = x, de = address of glyph
            call print_char_at
            ret

PUBLIC _get_glyph_from_chr_asm
;----------
; get_glyph_from_chr_asm
; inputs: l = character
; outputs: hl = pointer to glyph
; alters: hl
;----------
_get_glyph_from_chr_asm:
            ld h, $00 ; make sure h is 00
            add hl, hl
            add hl, hl
            add hl, hl ; h *= 8
            add hl, $3C00 ; add start of character fonts
            ret

;----------
; get_char_address - adapted from a routine by Dean Belfield
; inputs: h = y, l = x
; outputs: hl = location of screen address
; alters: hl
;----------
get_char_address:
            ld a,h
			and $07
			rra
			rra
			rra
			rra
			or l
			ld l,a
			ld a,h
			and $18
			or $40
			ld h,a
			ret	

;----------
; get_attr_address - adapted from a routine by Jonathan Cauldwell
; inputs: d = y, e = x
; outputs: hl = location of attribute address
; alters: hl
;----------
get_attr_address:
            ld a,d
            rrca
            rrca
            rrca
            ld l,a
            and $03
            add a, $58
            ld h,a
            ld a,l
            and $e0
            ld l,a
            ld a,e
            add a,l
            ld l,a
            ret

SECTION rodata_user

cell_sprite:
            defb @10101010
            defb @01010101
            defb @10101010
            defb @01010101
            defb @10101010
            defb @01010101
            defb @10101010
            defb @01010101

block_sprite:
            defb @11111111
            defb @11111111
            defb @11111111
            defb @11111111
            defb @11111111
            defb @11111111
            defb @11111111
            defb @11111111

clear_sprite:
            defb @00000000
            defb @00000000
            defb @00000000
            defb @00000000
            defb @00000000
            defb @00000000
            defb @00000000
            defb @00000000
```

This next iteration doesn't use `rst $10` or UDGs for graphics so it's necessary to create
`block_sprite` and `clear_sprite` to pass into `print_char_at` from our main routines, which keep
the same signature as is our approach. The `_print_string_asm` routine that was created as part of
the first commit continues to use `rst $10` as it's used outside of the game loop so there's not
much point in changing that. Plus it's handy to keep around as an example for future reference. This
subsequent commit is available here.

I'm using this rewrite as a way of learning Z80 assembly so I don't see the first commit as wasted
effort. In fact it probably would have been sufficient had I not found some examples of more optimal
code that were worth exploring. I'm starting to build up some knowledge and examples of various
techniques and it's tempting when you only know a few commands to use them for everything, as in "if
all you have is a hammer, everything looks like a nail". Hopefully as I continue I will pick up some
more techniques and perhaps even revisit some of this code, but for now I'm reasonably happy with
it.

To ROM Version Demo

Not To ROM Version Demo
