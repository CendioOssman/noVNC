/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2019-2025 The noVNC authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 *
 */

export default class JPEGDecoder {
    constructor() {
        // RealVNC will reuse the quantization tables
        // and Huffman tables, so we need to cache them.
        this._cachedQuantTables = new Uint8Array(1024);
        this._cachedQuantTablesLen = 0;
        this._cachedHuffmanTables = new Uint8Array(1024);
        this._cachedHuffmanTablesLen = 0;

        this._seenQuantTables = false;
        this._seenHuffmanTables = false;

        this._imageData = new Uint8Array(65536);
        this._imageDataLen = 0;
    }

    decodeRect(x, y, width, height, sock, display, depth) {
        // A rect of JPEG encodings is simply a JPEG file
        while (true) {
            let segment = this._readSegment(sock);
            if (segment === null) {
                return false;
            }

            let type = segment[1];

            if (type === 0xC4) {
                // Huffman tables
                if (!this._seenHuffmanTables) {
                    this._seenHuffmanTables = true;
                    this._cachedHuffmanTablesLen = 0;
                }

                if ((this._cachedHuffmanTablesLen + segment.length) >
                    this._cachedHuffmanTables.length) {
                    let newLen = this._cachedHuffmanTables.length * 2;
                    while (newLen < (this._cachedHuffmanTablesLen + segment.length)) {
                        newLen *= 2;
                    }
                    let newTable = new Uint8Array(newLen);
                    newTable.set(this._cachedHuffmanTables.subarray(0, this._cachedHuffmanTablesLen));
                    this._cachedHuffmanTables = newTable;
                }

                this._cachedHuffmanTables.set(segment, this._cachedHuffmanTablesLen);
                this._cachedHuffmanTablesLen += segment.length;
            } else if (type === 0xDB) {
                // Quantization tables
                if (!this._seenQuantTables) {
                    this._seenQuantTables = true;
                    this._cachedQuantTablesLen = 0;
                }

                if ((this._cachedQuantTablesLen + segment.length) >
                    this._cachedQuantTables.length) {
                    let newLen = this._cachedQuantTables.length * 2;
                    while (newLen < (this._cachedQuantTablesLen + segment.length)) {
                        newLen *= 2;
                    }
                    let newTable = new Uint8Array(newLen);
                    newTable.set(this._cachedQuantTables.subarray(0, this._cachedQuantTablesLen));
                    this._cachedQuantTables = newTable;
                }

                this._cachedQuantTables.set(segment, this._cachedQuantTablesLen);
                this._cachedQuantTablesLen += segment.length;
            }

            if (type === 0xDA) {
                // Start of image data, time to inject any missing tables
                if (!this._seenQuantTables) {
                    if ((this._imageDataLen + this._cachedQuantTablesLen) >
                        this._imageData.length) {
                        let newLen = this._imageData.length * 2;
                        while (newLen < (this._imageDataLen + this._cachedQuantTablesLen)) {
                            newLen *= 2;
                        }
                        let newData = new Uint8Array(newLen);
                        newData.set(this._imageData.subarray(0, this._imageDataLen));
                        this._imageData = newData;
                    }

                    this._imageData.set(this._cachedQuantTables.subarray(0, this._cachedQuantTablesLen),
                                        this._imageDataLen);
                    this._imageDataLen += this._cachedQuantTablesLen;
                }
                if (!this._seenHuffmanTables) {
                    if ((this._imageDataLen + this._cachedHuffmanTablesLen) >
                        this._imageData.length) {
                        let newLen = this._imageData.length * 2;
                        while (newLen < (this._imageDataLen + this._cachedHuffmanTablesLen)) {
                            newLen *= 2;
                        }
                        let newData = new Uint8Array(newLen);
                        newData.set(this._imageData.subarray(0, this._imageDataLen));
                        this._imageData = newData;
                    }

                    this._imageData.set(this._cachedHuffmanTables.subarray(0, this._cachedHuffmanTablesLen),
                                        this._imageDataLen);
                    this._imageDataLen += this._cachedHuffmanTablesLen;
                }
            }

            if ((this._imageDataLen + segment.length) >
                this._imageData.length) {
                let newLen = this._imageData.length * 2;
                while (newLen < (this._imageDataLen + segment.length)) {
                    newLen *= 2;
                }
                let newData = new Uint8Array(newLen);
                newData.set(this._imageData.subarray(0, this._imageDataLen));
                this._imageData = newData;
            }

            this._imageData.set(segment, this._imageDataLen);
            this._imageDataLen += segment.length;

            // End of image?
            if (segment[1] === 0xD9) {
                break;
            }
        }

        display.imageRect(x, y, width, height, "image/jpeg",
                          this._imageData);

        this._seenQuantTables = false;
        this._seenHuffmanTables = false;

        this._imageDataLen = 0;

        return true;
    }

    _readSegment(sock) {
        if (sock.rQwait("JPEG", 2)) {
            return null;
        }

        let marker = sock.rQshift8();
        if (marker != 0xFF) {
            throw new Error("Illegal JPEG marker received (byte: " +
                               marker + ")");
        }
        let type = sock.rQshift8();
        if (type >= 0xD0 && type <= 0xD9 || type == 0x01) {
            // No length after marker
            return new Uint8Array([marker, type]);
        }

        if (sock.rQwait("JPEG", 2, 2)) {
            return null;
        }

        let length = sock.rQshift16();
        if (length < 2) {
            throw new Error("Illegal JPEG length received (length: " +
                               length + ")");
        }

        if (sock.rQwait("JPEG", length-2, 4)) {
            return null;
        }

        let extra = 0;
        if (type === 0xDA) {
            // start of scan
            extra += 2;
            while (true) {
                if (sock.rQwait("JPEG", length-2+extra, 4)) {
                    return null;
                }
                let data = sock.rQpeekBytes(length-2+extra, false);
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
        segment.set(sock.rQshiftBytes(length-2+extra, false), 4);

        return segment;
    }
}
