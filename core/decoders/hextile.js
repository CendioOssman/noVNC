/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2019 The noVNC Authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 *
 */

import * as Log from '../util/logging.js';

export default class HextileDecoder {
    constructor() {
        this._tileBuffer = new Uint8Array(16 * 16 * 4);
    }

    async decodeRect(x, y, width, height, sock, display, depth) {
        let tilesX = Math.ceil(width / 16);
        let tilesY = Math.ceil(height / 16);
        let totalTiles = tilesX * tilesY;

        let foreground, background;
        let lastSubEncoding = 0;
        for (let currTile = 0;currTile < totalTiles;currTile++) {
            let subencoding = await sock.rQshift8();
            if (subencoding > 30) {  // Raw
                throw new Error("Illegal hextile subencoding (subencoding: " +
                            subencoding + ")");
            }

            const tileX = currTile % tilesX;
            const tileY = Math.floor(currTile / tilesX);
            const tx = x + tileX * 16;
            const ty = y + tileY * 16;
            const tw = Math.min(16, (x + width) - tx);
            const th = Math.min(16, (y + height) - ty);

            if (subencoding === 0) {
                if (lastSubEncoding & 0x01) {
                    // Weird: ignore blanks are RAW
                    Log.Debug("     Ignoring blank after RAW");
                } else {
                    display.fillRect(tx, ty, tw, th, background);
                }
            } else if (subencoding & 0x01) {  // Raw
                let pixels = tw * th;
                let data = await sock.rQshiftBytes(pixels * 4, false);
                // Max sure the image is fully opaque
                for (let i = 0;i <  pixels;i++) {
                    data[i * 4 + 3] = 255;
                }
                display.blitImage(tx, ty, tw, th, data, 0);
            } else {
                if (subencoding & 0x02) {  // Background
                    background = new Uint8Array(await sock.rQshiftBytes(4));
                }
                if (subencoding & 0x04) {  // Foreground
                    foreground = new Uint8Array(await sock.rQshiftBytes(4));
                }

                const data = this._tileBuffer;
                for (let i = 0; i < tw * th * 4; i += 4) {
                    data[i]     = background[0];
                    data[i + 1] = background[1];
                    data[i + 2] = background[2];
                    data[i + 3] = 255;
                }

                if (subencoding & 0x08) {  // AnySubrects
                    let subrects = await sock.rQshift8();

                    for (let s = 0; s < subrects; s++) {
                        let color;
                        if (subencoding & 0x10) {  // SubrectsColoured
                            color = await sock.rQshiftBytes(4);
                        } else {
                            color = foreground;
                        }
                        const xy = await sock.rQshift8();
                        const sx = (xy >> 4);
                        const sy = (xy & 0x0f);

                        const wh = await sock.rQshift8();
                        const sw = (wh >> 4) + 1;
                        const sh = (wh & 0x0f) + 1;

                        const data = this._tileBuffer;
                        for (let j = sy; j < sy + sh; j++) {
                            for (let i = sx; i < sx + sw; i++) {
                                const p = (i + (j * tw)) * 4;
                                data[p]     = color[0];
                                data[p + 1] = color[1];
                                data[p + 2] = color[2];
                                data[p + 3] = 255;
                            }
                        }
                    }
                }

                display.blitImage(tx, ty, tw, th, this._tileBuffer, 0);
            }
            lastSubEncoding = subencoding;
        }
    }
}
