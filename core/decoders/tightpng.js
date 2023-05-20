/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2019 The noVNC Authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 *
 */

import TightDecoder from './tight.js';

export default class TightPNGDecoder extends TightDecoder {
    async _pngRect(x, y, width, height, sock, display, depth) {
        let data = await this._readData(sock);
        display.imageRect(x, y, width, height, "image/png", data);
    }

    async _basicRect(ctl, x, y, width, height, sock, display, depth) {
        throw new Error("BasicCompression received in TightPNG rect");
    }
}
