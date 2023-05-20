/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2019 The noVNC Authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 *
 */

export default class CopyRectDecoder {
    async decodeRect(x, y, width, height, sock, display, depth) {
        if (sock.rQwait("COPYRECT", 4)) {
            return false;
        }

        let deltaX = await sock.rQshift16();
        let deltaY = await sock.rQshift16();

        if ((width === 0) || (height === 0)) {
            return true;
        }

        display.copyImage(deltaX, deltaY, x, y, width, height);

        return true;
    }
}
