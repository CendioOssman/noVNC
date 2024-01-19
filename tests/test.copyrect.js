const expect = chai.expect;

import Websock from '../core/websock.js';
import Display from '../core/display.js';

import CopyRectDecoder from '../core/decoders/copyrect.js';

import FakeWebSocket from './fake.websocket.js';

function testDecodeRect(decoder, x, y, width, height, data, display, depth) {
    let sock;
    let done = false;

    sock = new Websock;
    sock.open("ws://example.com");

    sock.on('message', () => {
        done = decoder.decodeRect(x, y, width, height, sock, display, depth);
    });

    // Empty messages are filtered at multiple layers, so we need to
    // do a direct call
    if (data.length === 0) {
        done = decoder.decodeRect(x, y, width, height, sock, display, depth);
    } else {
        sock._websocket._receiveData(new Uint8Array(data));
    }

    display.flip();

    return done;
}

describe('CopyRect Decoder', function () {
    let decoder;
    let display;

    before(FakeWebSocket.replace);
    after(FakeWebSocket.restore);

    beforeEach(function () {
        console.error("A", performance.now());
        display = new Display(document.createElement('canvas'));
        console.error("B", performance.now());
        /*
        display.resize(4, 4);
        console.error("C", performance.now());
        */
        decoder = new CopyRectDecoder();
        console.error("D", performance.now());
    });

    it('should handle the CopyRect encoding', function () {
        console.error("x", performance.now());
        display.resize(4, 4);
        console.error("y", performance.now());

        // seed some initial data to copy
        display.fillRect(0, 0, 4, 4, [ 0x11, 0x22, 0x33 ]);
        display.fillRect(0, 0, 2, 2, [ 0x00, 0x00, 0xff ]);
        display.fillRect(2, 0, 2, 2, [ 0x00, 0xff, 0x00 ]);

        let done;
        done = testDecodeRect(decoder, 0, 2, 2, 2,
                              [0x00, 0x02, 0x00, 0x00],
                              display, 24);
        expect(done).to.be.true;
        done = testDecodeRect(decoder, 2, 2, 2, 2,
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

        console.error("z", performance.now());
    });

    it('should handle empty rects', function () {
        console.error("1", performance.now());
        display.resize(4, 4);
        console.error("2", performance.now());

        display.fillRect(0, 0, 4, 4, [ 0x00, 0x00, 0xff ]);
        display.fillRect(2, 0, 2, 2, [ 0x00, 0xff, 0x00 ]);
        display.fillRect(0, 2, 2, 2, [ 0x00, 0xff, 0x00 ]);

        let done = testDecodeRect(decoder, 1, 2, 0, 0,
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
