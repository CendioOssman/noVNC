/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2019 The noVNC Authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 *
 */

export default class RREDecoder {
    async decodeRect(x, y, width, height, sock, display, depth) {
        let subrects = await sock.rQshift32();

        let color = await sock.rQshiftBytes(4);  // Background
        display.fillRect(x, y, width, height, color);

        while (subrects > 0) {
            let color = await sock.rQshiftBytes(4);
            let sx = await sock.rQshift16();
            let sy = await sock.rQshift16();
            let swidth = await sock.rQshift16();
            let sheight = await sock.rQshift16();
            display.fillRect(x + sx, y + sy, swidth, sheight, color);

            subrects--;
        }
    }
}
