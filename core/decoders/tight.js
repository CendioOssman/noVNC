/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2019 The noVNC Authors
 * (c) 2012 Michael Tinglof, Joe Balaz, Les Piech (Mercuri.ca)
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 *
 */

import * as Log from '../util/logging.js';
import Inflator from "../inflator.js";

export default class TightDecoder {
    constructor() {
        this._zlibs = [];
        for (let i = 0; i < 4; i++) {
            this._zlibs[i] = new Inflator();
        }
    }

    async decodeRect(x, y, width, height, sock, display, depth) {
        let ctl = await sock.rQshift8();

        // Reset streams if the server requests it
        for (let i = 0; i < 4; i++) {
            if ((ctl >> i) & 1) {
                this._zlibs[i].reset();
                Log.Info("Reset zlib stream " + i);
            }
        }

        // Figure out filter
        ctl = ctl >> 4;

        if (ctl === 0x08) {
            await this._fillRect(x, y, width, height,
                                 sock, display, depth);
        } else if (ctl === 0x09) {
            await this._jpegRect(x, y, width, height,
                                 sock, display, depth);
        } else if (ctl === 0x0A) {
            await this._pngRect(x, y, width, height,
                                sock, display, depth);
        } else if ((ctl & 0x08) == 0) {
            await this._basicRect(ctl, x, y, width, height,
                                  sock, display, depth);
        } else {
            throw new Error("Illegal tight compression received (ctl: " +
                                   ctl + ")");
        }
    }

    async _fillRect(x, y, width, height, sock, display, depth) {
        let pixel = await sock.rQshiftBytes(3);
        display.fillRect(x, y, width, height, pixel, false);
    }

    async _jpegRect(x, y, width, height, sock, display, depth) {
        let data = await this._readData(sock);
        display.imageRect(x, y, width, height, "image/jpeg", data);
    }

    async _pngRect(x, y, width, height, sock, display, depth) {
        throw new Error("PNG received in standard Tight rect");
    }

    async _basicRect(ctl, x, y, width, height, sock, display, depth) {
        let filter;
        if (ctl & 0x4) {
            filter = await sock.rQshift8();
        } else {
            // Implicit CopyFilter
            filter = 0;
        }

        let streamId = ctl & 0x3;

        switch (filter) {
            case 0: // CopyFilter
                await this._copyFilter(streamId, x, y, width, height,
                                       sock, display, depth);
                break;
            case 1: // PaletteFilter
                await this._paletteFilter(streamId, x, y, width, height,
                                          sock, display, depth);
                break;
            case 2: // GradientFilter
                await this._gradientFilter(streamId, x, y, width, height,
                                           sock, display, depth);
                break;
            default:
                throw new Error("Illegal tight filter received (ctl: " +
                                       this._filter + ")");
        }
    }

    async _copyFilter(streamId, x, y, width, height, sock, display, depth) {
        const uncompressedSize = width * height * 3;
        let data;

        if (uncompressedSize === 0) {
            return;
        }

        if (uncompressedSize < 12) {
            data = await sock.rQshiftBytes(uncompressedSize);
        } else {
            data = await this._readData(sock);

            this._zlibs[streamId].setInput(data);
            data = this._zlibs[streamId].inflate(uncompressedSize);
            this._zlibs[streamId].setInput(null);
        }

        let rgbx = new Uint8Array(width * height * 4);
        for (let i = 0, j = 0; i < width * height * 4; i += 4, j += 3) {
            rgbx[i]     = data[j];
            rgbx[i + 1] = data[j + 1];
            rgbx[i + 2] = data[j + 2];
            rgbx[i + 3] = 255;  // Alpha
        }

        display.blitImage(x, y, width, height, rgbx, 0, false);
    }

    async _paletteFilter(streamId, x, y, width, height, sock, display, depth) {
        const numColors = await sock.rQshift8() + 1;
        const paletteSize = numColors * 3;

        const palette = await sock.rQshiftBytes(paletteSize);

        const bpp = (numColors <= 2) ? 1 : 8;
        const rowSize = Math.floor((width * bpp + 7) / 8);
        const uncompressedSize = rowSize * height;

        let data;

        if (uncompressedSize === 0) {
            return;
        }

        if (uncompressedSize < 12) {
            data = await sock.rQshiftBytes(uncompressedSize);
        } else {
            data = await this._readData(sock);

            this._zlibs[streamId].setInput(data);
            data = this._zlibs[streamId].inflate(uncompressedSize);
            this._zlibs[streamId].setInput(null);
        }

        // Convert indexed (palette based) image data to RGB
        if (numColors == 2) {
            this._monoRect(x, y, width, height, data, palette, display);
        } else {
            this._paletteRect(x, y, width, height, data, palette, display);
        }

        this._numColors = 0;
    }

    _monoRect(x, y, width, height, data, palette, display) {
        // Convert indexed (palette based) image data to RGB
        // TODO: reduce number of calculations inside loop
        const dest = this._getScratchBuffer(width * height * 4);
        const w = Math.floor((width + 7) / 8);
        const w1 = Math.floor(width / 8);

        for (let y = 0; y < height; y++) {
            let dp, sp, x;
            for (x = 0; x < w1; x++) {
                for (let b = 7; b >= 0; b--) {
                    dp = (y * width + x * 8 + 7 - b) * 4;
                    sp = (data[y * w + x] >> b & 1) * 3;
                    dest[dp]     = palette[sp];
                    dest[dp + 1] = palette[sp + 1];
                    dest[dp + 2] = palette[sp + 2];
                    dest[dp + 3] = 255;
                }
            }

            for (let b = 7; b >= 8 - width % 8; b--) {
                dp = (y * width + x * 8 + 7 - b) * 4;
                sp = (data[y * w + x] >> b & 1) * 3;
                dest[dp]     = palette[sp];
                dest[dp + 1] = palette[sp + 1];
                dest[dp + 2] = palette[sp + 2];
                dest[dp + 3] = 255;
            }
        }

        display.blitImage(x, y, width, height, dest, 0, false);
    }

    _paletteRect(x, y, width, height, data, palette, display) {
        // Convert indexed (palette based) image data to RGB
        const dest = this._getScratchBuffer(width * height * 4);
        const total = width * height * 4;
        for (let i = 0, j = 0; i < total; i += 4, j++) {
            const sp = data[j] * 3;
            dest[i]     = palette[sp];
            dest[i + 1] = palette[sp + 1];
            dest[i + 2] = palette[sp + 2];
            dest[i + 3] = 255;
        }

        display.blitImage(x, y, width, height, dest, 0, false);
    }

    _gradientFilter(streamId, x, y, width, height, sock, display, depth) {
        throw new Error("Gradient filter not implemented");
    }

    async _readData(sock) {
        let byte = await sock.rQshift8();
        let len = byte & 0x7f;
        if (byte & 0x80) {
            byte = await sock.rQshift8();
            len |= (byte & 0x7f) << 7;
            if (byte & 0x80) {
                byte = await sock.rQshift8();
                len |= byte << 14;
            }
        }

        return await sock.rQshiftBytes(len, false);
    }

    _getScratchBuffer(size) {
        if (!this._scratchBuffer || (this._scratchBuffer.length < size)) {
            this._scratchBuffer = new Uint8Array(size);
        }
        return this._scratchBuffer;
    }
}
