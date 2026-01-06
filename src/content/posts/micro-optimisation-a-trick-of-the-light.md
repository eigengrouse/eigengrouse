---
title: "Micro Optimisation - A Trick Of The Light"
pubDate: 2024-06-22
author: 'eigengrouse'
description: "Speeding up ZX Life graphics by leaning on attribute memory."
image: "/c6c9040c-505e-4284-b23e-d44043ce0dc9.gif"
tags: ["zx-spectrum", "micro-optimisation"]
---

Our Game of Life implementation in Z80 Assembly was complete. First we developed it in a high level
language and applied optimisations in time and space complexity using big O notation as our guide.
Starting out in BASIC then switching to C as we refined our algorithms and data structures. Then we
converted our C program to Z80 Assembly, using a [Strangler
Fig](https://martinfowler.com/bliki/StranglerFigApplication.html) approach to replace each module in
turn and applied efficiencies from working at a lower level. Once fully converted, reviewing the
codebase as a whole helped us to identify and apply some machine language level optimisations that
leaned into the idiosyncrasies of the Z80 CPU. That’s where we left it. Dormant. That is until about
a week ago, after being awoken by some inspiration from elsewhere.

Recently there has been something in the ether of the ZX Spectrum dev community that’s obvious when
you think about it, but hadn’t occurred to me as I worked in the weeds (how often is this the
case?). It’s the use of ZX Spectrum ‘attributes’, screen colour information split into groups of 8x8
pixels, to do things like create a [console style platformer](https://rothers.itch.io/super-48k-bro)
that doesn’t seem to know it’s running on a system without hardware sprites or scrolling. Or apply a
Snorkification to an old school Sinclair
BASIC type-in to add an [animated
boulder](https://www.youtube.com/watch?v=1npRu01cvvI&feature=youtu.be) that doesn’t slow everything
down. In BASIC(!). The approach is this, instead of drawing 8x8 pixels i.e., 8 bytes at a time, at
the right time, draw them up front and set the colour information of that 8 bytes at the right time.
Requiring only 1 byte to be updated at the critical point instead of 8. Obvious, right? Well it had
completely passed me by despite having routines called `draw_cell`, `clear_cell`, and `draw_block`
that all deal in 8x8 pixels.

`draw_cell` draws an 8x8 checked pattern, `clear_cell` clears a cell, and `draw_block` fills in
every pixel and applies the `BRIGHT` flag, which is stored as a bit in the 1 byte attribute along
with colour information. Attributes are stored as a `FLASH` bit, a `BRIGHT` bit, 3 `PAPER` bits and
3 `INK` bits (so 8 colours). Or
[here](http://www.breakintoprogram.co.uk/hardware/computers/zx-spectrum/screen-memory-layout) a much
better explanation of ZX Spectrum screen memory layout by L Break Into Program.

8-bit Micros all had their own way of implementing graphics, which is one of the really interesting
things about vintage computing. I have a personal fascination for these quirks and things like
hardware sprites and scrolling, which the ZX Spectrum didn’t have but it did have its quirks. You
can fill books with them. The ZX Spectrum
mapped two areas of memory, bitmap data and attribute data, directly to what was displayed on the
screen. Bitmap data mapped to the individual pixels, on or off, while attribute data overlaid colour
information split into groups of 8x8 pixels, 1 byte per group or ‘attribute’, which is a very
efficient way of achieving colour graphics. Therefore attribute data was one eighth of the size of
bitmap data and eight times as quick to fully populate, saving memory but at the expense of having
the signature ZX Spectrum [colour clash](https://en.wikipedia.org/wiki/Attribute_clash). Programmers
implement graphics routines by writing to memory in those locations in the same way they write to
memory anywhere else, which makes it straightforward.

The optimisation was therefore also straightforward. First fill the screen with a checked pattern
using a UDG and the ROM print routine with white paper and ink, which as we know isn’t optimal but
as this is setup code outside of the game loop then simple code &gt; fast code. Then all
`draw_cell`, `clear_cell`, and `draw_block` need to do is set the attribute memory of the given cell
location instead of the bitmap memory. There is slightly more to it but it’s not unreasonable to
suggest this is an eight times faster optimisation of those particular methods. The attribute is set
to white paper and the current ink colour for `draw_cell`, white paper and white ink for
`clear_cell`, and the current ink colour and matching paper with the `BRIGHT` flag set for
`draw_block`.

Of course there is a compromise happening here in that we are restricting the mutability of the
bitmap data, requiring us to pre-fill the screen with all the shapes we need like the handheld LCD
games of the 80s. This is a good way to think about it and I have fond memories of the [TMNT Konami
handheld](https://www.youtube.com/watch?v=htzWrMw7I5g). Trivial in our case, but more thought
required for a moving boulder, or having an effectively lowered resolution scrolling background
achieved by half filled cells. It’s a no brainer in our case as the user is oblivious and the
implementation is straightforward, here is the commit.

Compromise and the least worst solution is fundamental in [software
architecture](https://www.thoughtworks.com/en-gb/about-us/news/2020/fundamentals-software-architecture),
in a good way, and this has given me food for thought about what else could be achieved through
compromise. Perhaps an approach where some bitmap data is written for important details, but as much
as possible is done with attribute data. Something like a [super
scaler](https://www.youtube.com/watch?v=JPRt2nkw2iA) style racing game where the car remains central
but the road moves rapidly, using attribute data to quickly show and hide sections of the road and
scenery, with occasional bitmap writes for the important details or finishing touches. That might
seem ambitious but I was impressed with a simple yet clever demo [not so long
ago](https://x.com/BobBilsland/status/1711472626969845893) that broke things down nicely. I’ve
always had a soft spot for [OutRun](https://www.youtube.com/watch?v=WiWiTXq4yYY) and the [ZX
Spectrum version](https://www.youtube.com/watch?v=JFa8YRlfdV0) had strong graphics, but the fps
suffered. A lot. Perhaps approaching things backwards, focusing on fps and starting with attributes,
could give an Atari ST 50 fps racer that’s [currently in
development](https://www.youtube.com/watch?v=YvMy5CKYEJA) a run for its money.
