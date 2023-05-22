/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2019 The noVNC Authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 *
 */

export default class JPEGDecoder {
    constructor() {
        // RealVNC will reuse the quantization tables
        // and Huffman tables, so we need to cache them.
        this._cachedQuantTables = [];
        this._cachedHuffmanTables = [];
    }

    async decodeRect(x, y, width, height, sock, display, depth) {
        // A rect of JPEG encodings is simply a JPEG file
        let segments = [];
        while (true) {
            let segment = await this._readSegment(sock);
            segments.push(segment);
            // End of image?
            if (segment[1] === 0xD9) {
                break;
            }
        }

        let huffmanTables = [];
        let quantTables = [];
        for (let segment of segments) {
            let type = segment[1];
            if (type === 0xC4) {
                // Huffman tables
                huffmanTables.push(segment);
            } else if (type === 0xDB) {
                // Quantization tables
                quantTables.push(segment);
            }
        }

        const sofIndex = segments.findIndex(
            x => x[1] == 0xC0 || x[1] == 0xC2
        );
        if (sofIndex == -1) {
            throw new Error("Illegal JPEG image without SOF");
        }

        if (quantTables.length === 0) {
            segments.splice(sofIndex+1, 0,
                            ...this._cachedQuantTables);
        }
        if (huffmanTables.length === 0) {
            segments.splice(sofIndex+1, 0,
                            ...this._cachedHuffmanTables);
        }

        let length = 0;
        for (let segment of segments) {
            length += segment.length;
        }

        let data = new Uint8Array(length);
        length = 0;
        for (let segment of segments) {
            data.set(segment, length);
            length += segment.length;
        }

        display.imageRect(x, y, width, height, "image/jpeg", data);

        if (huffmanTables.length !== 0) {
            this._cachedHuffmanTables = huffmanTables;
        }
        if (quantTables.length !== 0) {
            this._cachedQuantTables = quantTables;
        }
    }

    async _readSegment(sock) {
        let marker = await sock.rQshift8();
        if (marker != 0xFF) {
            throw new Error("Illegal JPEG marker received (byte: " +
                               marker + ")");
        }
        let type = await sock.rQshift8();
        if (type >= 0xD0 && type <= 0xD9 || type == 0x01) {
            // No length after marker
            return new Uint8Array([marker, type]);
        }

        let length = await sock.rQshift16();
        if (length < 2) {
            throw new Error("Illegal JPEG length received (length: " +
                               length + ")");
        }

        let extra = 0;
        if (type === 0xDA) {
            // start of scan
            extra += 2;
            while (true) {
                let data = await sock.rQpeekBytes(length-2+extra, false);
                if (data.at(-2) === 0xFF && data.at(-1) !== 0x00 &&
                    !(data.at(-1) >= 0xD0 && data.at(-1) <= 0xD7)) {
                    extra -= 2;
                    break;
                }
                extra++;
            }
        }

        let segment = new Uint8Array(2 + length + extra);
        segment[0] = marker;
        segment[1] = type;
        segment[2] = length >> 8;
        segment[3] = length;
        segment.set(await sock.rQshiftBytes(length-2+extra, false), 4);

        return segment;
    }
}
