const expect = chai.expect;

import Websock from '../core/websock.js';
import Display from '../core/display.js';

import RawDecoder from '../core/decoders/raw.js';

import FakeWebSocket from './fake.websocket.js';

async function testDecodeRect(decoder, x, y, width, height, data, display, depth) {
    let sock;
    let done;

    sock = new Websock;
    sock.open("ws://example.com");

    sock._websocket._receiveData(new Uint8Array(data));
    done = await decoder.decodeRect(x, y, width, height, sock, display, depth);

    display.flip();

    return done;
}

describe('Raw Decoder', function () {
    let decoder;
    let display;

    before(FakeWebSocket.replace);
    after(FakeWebSocket.restore);

    beforeEach(function () {
        decoder = new RawDecoder();
        display = new Display(document.createElement('canvas'));
        display.resize(4, 4);
    });

    it('should handle the Raw encoding', async function () {
        let done;

        done = await testDecodeRect(decoder, 0, 0, 2, 2,
                                    [0xff, 0x00, 0x00, 0,
                                     0x00, 0xff, 0x00, 0,
                                     0x00, 0xff, 0x00, 0,
                                     0xff, 0x00, 0x00, 0],
                                    display, 24);
        expect(done).to.be.true;
        done = await testDecodeRect(decoder, 2, 0, 2, 2,
                                    [0x00, 0x00, 0xff, 0,
                                     0x00, 0x00, 0xff, 0,
                                     0x00, 0x00, 0xff, 0,
                                     0x00, 0x00, 0xff, 0],
                                    display, 24);
        expect(done).to.be.true;
        done = await testDecodeRect(decoder, 0, 2, 4, 1,
                                    [0xee, 0x00, 0xff, 0,
                                     0x00, 0xee, 0xff, 0,
                                     0xaa, 0xee, 0xff, 0,
                                     0xab, 0xee, 0xff, 0],
                                    display, 24);
        expect(done).to.be.true;
        done = await testDecodeRect(decoder, 0, 3, 4, 1,
                                    [0xee, 0x00, 0xff, 0,
                                     0x00, 0xee, 0xff, 0,
                                     0xaa, 0xee, 0xff, 0,
                                     0xab, 0xee, 0xff, 0],
                                    display, 24);
        expect(done).to.be.true;

        let targetData = new Uint8Array([
            0xff, 0x00, 0x00, 255, 0x00, 0xff, 0x00, 255, 0x00, 0x00, 0xff, 255, 0x00, 0x00, 0xff, 255,
            0x00, 0xff, 0x00, 255, 0xff, 0x00, 0x00, 255, 0x00, 0x00, 0xff, 255, 0x00, 0x00, 0xff, 255,
            0xee, 0x00, 0xff, 255, 0x00, 0xee, 0xff, 255, 0xaa, 0xee, 0xff, 255, 0xab, 0xee, 0xff, 255,
            0xee, 0x00, 0xff, 255, 0x00, 0xee, 0xff, 255, 0xaa, 0xee, 0xff, 255, 0xab, 0xee, 0xff, 255
        ]);

        expect(display).to.have.displayed(targetData);
    });

    it('should handle the Raw encoding in low colour mode', async function () {
        let done;

        done = await testDecodeRect(decoder, 0, 0, 2, 2,
                                    [0x30, 0x30, 0x30, 0x30],
                                    display, 8);
        expect(done).to.be.true;
        done = await testDecodeRect(decoder, 2, 0, 2, 2,
                                    [0x0c, 0x0c, 0x0c, 0x0c],
                                    display, 8);
        expect(done).to.be.true;
        done = await testDecodeRect(decoder, 0, 2, 4, 1,
                                    [0x0c, 0x0c, 0x30, 0x30],
                                    display, 8);
        expect(done).to.be.true;
        done = await testDecodeRect(decoder, 0, 3, 4, 1,
                                    [0x0c, 0x0c, 0x30, 0x30],
                                    display, 8);
        expect(done).to.be.true;

        let targetData = new Uint8Array([
            0x00, 0x00, 0xff, 255, 0x00, 0x00, 0xff, 255, 0x00, 0xff, 0x00, 255, 0x00, 0xff, 0x00, 255,
            0x00, 0x00, 0xff, 255, 0x00, 0x00, 0xff, 255, 0x00, 0xff, 0x00, 255, 0x00, 0xff, 0x00, 255,
            0x00, 0xff, 0x00, 255, 0x00, 0xff, 0x00, 255, 0x00, 0x00, 0xff, 255, 0x00, 0x00, 0xff, 255,
            0x00, 0xff, 0x00, 255, 0x00, 0xff, 0x00, 255, 0x00, 0x00, 0xff, 255, 0x00, 0x00, 0xff, 255
        ]);

        expect(display).to.have.displayed(targetData);
    });

    it('should handle empty rects', async function () {
        display.fillRect(0, 0, 4, 4, [ 0x00, 0x00, 0xff ]);
        display.fillRect(2, 0, 2, 2, [ 0x00, 0xff, 0x00 ]);
        display.fillRect(0, 2, 2, 2, [ 0x00, 0xff, 0x00 ]);

        let done = await testDecodeRect(decoder, 1, 2, 0, 0, [], display, 24);

        let targetData = new Uint8Array([
            0x00, 0x00, 0xff, 255, 0x00, 0x00, 0xff, 255, 0x00, 0xff, 0x00, 255, 0x00, 0xff, 0x00, 255,
            0x00, 0x00, 0xff, 255, 0x00, 0x00, 0xff, 255, 0x00, 0xff, 0x00, 255, 0x00, 0xff, 0x00, 255,
            0x00, 0xff, 0x00, 255, 0x00, 0xff, 0x00, 255, 0x00, 0x00, 0xff, 255, 0x00, 0x00, 0xff, 255,
            0x00, 0xff, 0x00, 255, 0x00, 0xff, 0x00, 255, 0x00, 0x00, 0xff, 255, 0x00, 0x00, 0xff, 255
        ]);

        expect(done).to.be.true;
        expect(display).to.have.displayed(targetData);
    });

    it('should handle empty rects in low colour mode', async function () {
        display.fillRect(0, 0, 4, 4, [ 0x00, 0x00, 0xff ]);
        display.fillRect(2, 0, 2, 2, [ 0x00, 0xff, 0x00 ]);
        display.fillRect(0, 2, 2, 2, [ 0x00, 0xff, 0x00 ]);

        let done = await testDecodeRect(decoder, 1, 2, 0, 0, [], display, 8);

        let targetData = new Uint8Array([
            0x00, 0x00, 0xff, 255, 0x00, 0x00, 0xff, 255, 0x00, 0xff, 0x00, 255, 0x00, 0xff, 0x00, 255,
            0x00, 0x00, 0xff, 255, 0x00, 0x00, 0xff, 255, 0x00, 0xff, 0x00, 255, 0x00, 0xff, 0x00, 255,
            0x00, 0xff, 0x00, 255, 0x00, 0xff, 0x00, 255, 0x00, 0x00, 0xff, 255, 0x00, 0x00, 0xff, 255,
            0x00, 0xff, 0x00, 255, 0x00, 0xff, 0x00, 255, 0x00, 0x00, 0xff, 255, 0x00, 0x00, 0xff, 255
        ]);

        expect(done).to.be.true;
        expect(display).to.have.displayed(targetData);
    });
});
