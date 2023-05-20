const expect = chai.expect;

import Websock from '../core/websock.js';
import Display from '../core/display.js';

import CopyRectDecoder from '../core/decoders/copyrect.js';

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

describe('CopyRect Decoder', function () {
    let decoder;
    let display;

    before(FakeWebSocket.replace);
    after(FakeWebSocket.restore);

    beforeEach(function () {
        decoder = new CopyRectDecoder();
        display = new Display(document.createElement('canvas'));
        display.resize(4, 4);
    });

    it('should handle the CopyRect encoding', async function () {
        // seed some initial data to copy
        display.fillRect(0, 0, 4, 4, [ 0x11, 0x22, 0x33 ]);
        display.fillRect(0, 0, 2, 2, [ 0x00, 0x00, 0xff ]);
        display.fillRect(2, 0, 2, 2, [ 0x00, 0xff, 0x00 ]);

        let done;
        done = await testDecodeRect(decoder, 0, 2, 2, 2,
                                    [0x00, 0x02, 0x00, 0x00],
                                    display, 24);
        expect(done).to.be.true;
        done = await testDecodeRect(decoder, 2, 2, 2, 2,
                                    [0x00, 0x00, 0x00, 0x00],
                                    display, 24);
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

        let done = await testDecodeRect(decoder, 1, 2, 0, 0,
                                        [0x00, 0x00, 0x00, 0x00],
                                        display, 24);

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
