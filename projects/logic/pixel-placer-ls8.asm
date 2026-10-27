; PIXEL-256 / LS8. All controls and painting execute as ROM instructions.
; IN bits: Left=1, Right=2, Up=4, Down=8, A=16, S=32.
; RAM 0000=X, 0001=Y, 0002=keys, 0004=clear counter.
; Framebuffer = bank 1, address Y*256+X, palette index per byte.
.org $0000
boot:
 BANK 0
 LDI 1
 OUT
 LDI 0
 OUT
 STA $0004
 P0 0
 P1 0
 P2 1
 P3 0
clear_page:
 LDX 0
 LDY $30
 DMA 0
 INC $0004
 JNZ clear_page
 LDI 0
 STA $7000
 STA $7001
 LDI 255
 STA $7002
 STA $7003
 LDI 128
 STA $0000
 STA $0001
 STA $FF30
 STA $FF31
 LDI 1
 STA $FF32
 WAIT
main:
 BANK 0
 IN
 STA $0002
 AND 1
 JZ right
 LDA $0000
 JZ right
 DEC $0000
right:
 LDA $0002
 AND 2
 JZ up
 LDA $0000
 CMP 255
 JZ up
 INC $0000
up:
 LDA $0002
 AND 4
 JZ down
 LDA $0001
 JZ down
 DEC $0001
down:
 LDA $0002
 AND 8
 JZ draw
 LDA $0001
 CMP 255
 JZ draw
 INC $0001
draw:
 LDXM $0000
 LDYM $0001
 STX $FF30
 STY $FF31
 LDA $0002
 AND 32
 JNZ erase
 LDA $0002
 AND 16
 JZ present
 BANK 1
 LDI 1
 STM
 JMP present
erase:
 BANK 1
 LDI 0
 STM
present:
 BANK 0
 WAIT
 JMP main
.org $3000
; Zero page used by the general DMA instruction when clearing the canvas.
.byte 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
