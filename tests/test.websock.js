const expect = chai.expect;

import Websock from '../core/websock.js';
import FakeWebSocket from './fake.websocket.js';

describe('Websock', function () {
    "use strict";

    describe('Receive queue methods', function () {
        let sock, websock;

        beforeEach(function () {
            sock = new Websock();
            websock = new FakeWebSocket();
            websock._open();
            sock.attach(websock);
        });

        describe('rQpeek8', function () {
            it('should peek at the next byte without poping it off the queue', async function () {
                websock._receiveData(new Uint8Array([0xab, 0xcd]));
                expect(await sock.rQpeek8()).to.equal(0xab);
                expect(await sock.rQpeek8()).to.equal(0xab);
            });
        });

        describe('rQshift8()', function () {
            it('should pop a single byte from the receive queue', async function () {
                websock._receiveData(new Uint8Array([0xab, 0xcd]));
                expect(await sock.rQshift8()).to.equal(0xab);
                expect(await sock.rQshift8()).to.equal(0xcd);
            });
        });

        describe('rQshift16()', function () {
            it('should pop two bytes from the receive queue and return a single number', async function () {
                websock._receiveData(new Uint8Array([0xab, 0xcd, 0x12, 0x34]));
                expect(await sock.rQshift16()).to.equal(0xabcd);
                expect(await sock.rQshift16()).to.equal(0x1234);
            });
        });

        describe('rQshift32()', function () {
            it('should pop four bytes from the receive queue and return a single number', async function () {
                websock._receiveData(new Uint8Array([0xab, 0xcd, 0x12, 0x34,
                                                     0x88, 0xee, 0x11, 0x33]));
                expect(await sock.rQshift32()).to.equal(0xabcd1234);
                expect(await sock.rQshift32()).to.equal(0x88ee1133);
            });
        });

        describe('rQshiftStr', function () {
            it('should shift the given number of bytes off of the receive queue and return a string', async function () {
                websock._receiveData(new Uint8Array([0xab, 0xcd, 0x12, 0x34,
                                                     0x88, 0xee, 0x11, 0x33]));
                expect(await sock.rQshiftStr(4)).to.equal('\xab\xcd\x12\x34');
                expect(await sock.rQshiftStr(4)).to.equal('\x88\xee\x11\x33');
            });

            it('should be able to handle very large strings', async function () {
                const BIG_LEN = 500000;
                const incoming = new Uint8Array(BIG_LEN);
                let expected = "";
                let letterCode = 'a'.charCodeAt(0);
                for (let i = 0; i < BIG_LEN; i++) {
                    incoming[i] = letterCode;
                    expected += String.fromCharCode(letterCode);

                    if (letterCode < 'z'.charCodeAt(0)) {
                        letterCode++;
                    } else {
                        letterCode = 'a'.charCodeAt(0);
                    }
                }
                websock._receiveData(incoming);

                const shifted = await sock.rQshiftStr(BIG_LEN);

                expect(shifted).to.be.equal(expected);
            });
        });

        describe('rQshiftBytes', function () {
            it('should shift the given number of bytes of the receive queue and return an array', async function () {
                websock._receiveData(new Uint8Array([0xab, 0xcd, 0x12, 0x34,
                                                     0x88, 0xee, 0x11, 0x33]));
                expect(await sock.rQshiftBytes(4)).to.array.equal(new Uint8Array([0xab, 0xcd, 0x12, 0x34]));
                expect(await sock.rQshiftBytes(4)).to.array.equal(new Uint8Array([0x88, 0xee, 0x11, 0x33]));
            });

            it('should return a shared array if requested', async function () {
                websock._receiveData(new Uint8Array([0xab, 0xcd, 0x12, 0x34,
                                                     0x88, 0xee, 0x11, 0x33]));
                const bytes = await sock.rQshiftBytes(4, false);
                expect(bytes).to.array.equal(new Uint8Array([0xab, 0xcd, 0x12, 0x34]));
                expect(bytes.buffer.byteLength).to.not.equal(bytes.length);
            });
        });

        describe('rQpeekBytes', function () {
            it('should not modify the receive queue', async function () {
                websock._receiveData(new Uint8Array([0xab, 0xcd, 0x12, 0x34,
                                                     0x88, 0xee, 0x11, 0x33]));
                expect(await sock.rQpeekBytes(4)).to.array.equal(new Uint8Array([0xab, 0xcd, 0x12, 0x34]));
                expect(await sock.rQpeekBytes(4)).to.array.equal(new Uint8Array([0xab, 0xcd, 0x12, 0x34]));
            });

            it('should return a shared array if requested', async function () {
                websock._receiveData(new Uint8Array([0xab, 0xcd, 0x12, 0x34,
                                                     0x88, 0xee, 0x11, 0x33]));
                const bytes = await sock.rQpeekBytes(4, false);
                expect(bytes).to.array.equal(new Uint8Array([0xab, 0xcd, 0x12, 0x34]));
                expect(bytes.buffer.byteLength).to.not.equal(bytes.length);
            });
        });
    });

    describe('Send queue methods', function () {
        let sock;

        const bufferSize = 10 * 1024;

        beforeEach(function () {
            let websock = new FakeWebSocket();
            websock._open();
            sock = new Websock();
            sock.attach(websock);
        });

        describe('sQpush8()', function () {
            it('should send a single byte', function () {
                sock.sQpush8(42);
                sock.flush();
                expect(sock).to.have.sent(new Uint8Array([42]));
            });
            it('should not send any data until flushing', function () {
                sock.sQpush8(42);
                expect(sock).to.have.sent(new Uint8Array([]));
            });
            it('should implicitly flush if the queue is full', function () {
                for (let i = 0;i <= bufferSize;i++) {
                    sock.sQpush8(42);
                }

                let expected = [];
                for (let i = 0;i < bufferSize;i++) {
                    expected.push(42);
                }

                expect(sock).to.have.sent(new Uint8Array(expected));
            });
        });

        describe('sQpush16()', function () {
            it('should send a number as two bytes', function () {
                sock.sQpush16(420);
                sock.flush();
                expect(sock).to.have.sent(new Uint8Array([1, 164]));
            });
            it('should not send any data until flushing', function () {
                sock.sQpush16(420);
                expect(sock).to.have.sent(new Uint8Array([]));
            });
            it('should implicitly flush if the queue is full', function () {
                for (let i = 0;i <= bufferSize/2;i++) {
                    sock.sQpush16(420);
                }

                let expected = [];
                for (let i = 0;i < bufferSize/2;i++) {
                    expected.push(1);
                    expected.push(164);
                }

                expect(sock).to.have.sent(new Uint8Array(expected));
            });
        });

        describe('sQpush32()', function () {
            it('should send a number as two bytes', function () {
                sock.sQpush32(420420);
                sock.flush();
                expect(sock).to.have.sent(new Uint8Array([0, 6, 106, 68]));
            });
            it('should not send any data until flushing', function () {
                sock.sQpush32(420420);
                expect(sock).to.have.sent(new Uint8Array([]));
            });
            it('should implicitly flush if the queue is full', function () {
                for (let i = 0;i <= bufferSize/4;i++) {
                    sock.sQpush32(420420);
                }

                let expected = [];
                for (let i = 0;i < bufferSize/4;i++) {
                    expected.push(0);
                    expected.push(6);
                    expected.push(106);
                    expected.push(68);
                }

                expect(sock).to.have.sent(new Uint8Array(expected));
            });
        });

        describe('sQpushString()', function () {
            it('should send a string buffer', function () {
                sock.sQpushString('\x12\x34\x56\x78\x90');
                sock.flush();
                expect(sock).to.have.sent(new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x90]));
            });
            it('should not send any data until flushing', function () {
                sock.sQpushString('\x12\x34\x56\x78\x90');
                expect(sock).to.have.sent(new Uint8Array([]));
            });
            it('should implicitly flush if the queue is full', function () {
                for (let i = 0;i <= bufferSize/5;i++) {
                    sock.sQpushString('\x12\x34\x56\x78\x90');
                }

                let expected = [];
                for (let i = 0;i < bufferSize/5;i++) {
                    expected.push(0x12);
                    expected.push(0x34);
                    expected.push(0x56);
                    expected.push(0x78);
                    expected.push(0x90);
                }

                expect(sock).to.have.sent(new Uint8Array(expected));
            });
            it('should implicitly split a large buffer', function () {
                let str = '';
                for (let i = 0;i <= bufferSize/5;i++) {
                    str += '\x12\x34\x56\x78\x90';
                }

                sock.sQpushString(str);

                let expected = [];
                for (let i = 0;i < bufferSize/5;i++) {
                    expected.push(0x12);
                    expected.push(0x34);
                    expected.push(0x56);
                    expected.push(0x78);
                    expected.push(0x90);
                }

                expect(sock).to.have.sent(new Uint8Array(expected));
            });
        });

        describe('sQpushBytes()', function () {
            it('should send a byte buffer', function () {
                sock.sQpushBytes(new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x90]));
                sock.flush();
                expect(sock).to.have.sent(new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x90]));
            });
            it('should not send any data until flushing', function () {
                sock.sQpushBytes(new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x90]));
                expect(sock).to.have.sent(new Uint8Array([]));
            });
            it('should implicitly flush if the queue is full', function () {
                for (let i = 0;i <= bufferSize/5;i++) {
                    sock.sQpushBytes(new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x90]));
                }

                let expected = [];
                for (let i = 0;i < bufferSize/5;i++) {
                    expected.push(0x12);
                    expected.push(0x34);
                    expected.push(0x56);
                    expected.push(0x78);
                    expected.push(0x90);
                }

                expect(sock).to.have.sent(new Uint8Array(expected));
            });
            it('should implicitly split a large buffer', function () {
                let buffer = [];
                for (let i = 0;i <= bufferSize/5;i++) {
                    buffer.push(0x12);
                    buffer.push(0x34);
                    buffer.push(0x56);
                    buffer.push(0x78);
                    buffer.push(0x90);
                }

                sock.sQpushBytes(new Uint8Array(buffer));

                let expected = [];
                for (let i = 0;i < bufferSize/5;i++) {
                    expected.push(0x12);
                    expected.push(0x34);
                    expected.push(0x56);
                    expected.push(0x78);
                    expected.push(0x90);
                }

                expect(sock).to.have.sent(new Uint8Array(expected));
            });
        });

        describe('flush', function () {
            it('should actually send on the websocket', function () {
                sock._sQ = new Uint8Array([1, 2, 3]);
                sock._sQlen = 3;

                sock.flush();
                expect(sock).to.have.sent(new Uint8Array([1, 2, 3]));
            });

            it('should not call send if we do not have anything queued up', function () {
                sock._sQlen = 0;

                sock.flush();

                expect(sock).to.have.sent(new Uint8Array([]));
            });
        });
    });

    describe('lifecycle methods', function () {
        let oldWS;
        before(function () {
            oldWS = WebSocket;
        });

        let sock;
        beforeEach(function () {
            sock = new Websock();
            // eslint-disable-next-line no-global-assign
            WebSocket = sinon.spy(FakeWebSocket);
        });

        describe('opening', function () {
            it('should pick the correct protocols if none are given', function () {

            });

            it('should open the actual websocket', function () {
                sock.open('ws://localhost:8675', 'binary');
                expect(WebSocket).to.have.been.calledWith('ws://localhost:8675', 'binary');
            });

            // it('should initialize the event handlers')?
        });

        describe('attaching', function () {
            it('should attach to an existing websocket', function () {
                let ws = new FakeWebSocket('ws://localhost:8675');
                sock.attach(ws);
                expect(WebSocket).to.not.have.been.called;
            });
        });

        describe('closing', function () {
            beforeEach(function () {
                sock.open('ws://localhost');
                sock._websocket.close = sinon.spy();
            });

            it('should close the actual websocket if it is open', function () {
                sock._websocket.readyState = WebSocket.OPEN;
                sock.close();
                expect(sock._websocket.close).to.have.been.calledOnce;
            });

            it('should close the actual websocket if it is connecting', function () {
                sock._websocket.readyState = WebSocket.CONNECTING;
                sock.close();
                expect(sock._websocket.close).to.have.been.calledOnce;
            });

            it('should not try to close the actual websocket if closing', function () {
                sock._websocket.readyState = WebSocket.CLOSING;
                sock.close();
                expect(sock._websocket.close).not.to.have.been.called;
            });

            it('should not try to close the actual websocket if closed', function () {
                sock._websocket.readyState = WebSocket.CLOSED;
                sock.close();
                expect(sock._websocket.close).not.to.have.been.called;
            });

            it('should reset onmessage to not call _recvMessage', function () {
                sinon.spy(sock, '_recvMessage');
                sock.close();
                sock._websocket.onmessage(null);
                try {
                    expect(sock._recvMessage).not.to.have.been.called;
                } finally {
                    sock._recvMessage.restore();
                }
            });
        });

        describe('event handlers', function () {
            beforeEach(function () {
                sock._recvMessage = sinon.spy();
                sock.on('open', sinon.spy());
                sock.on('close', sinon.spy());
                sock.on('error', sinon.spy());
                sock.open('ws://localhost');
            });

            it('should call _recvMessage on a message', function () {
                sock._websocket.onmessage(null);
                expect(sock._recvMessage).to.have.been.calledOnce;
            });

            it('should call the open event handler on opening', function () {
                sock._websocket.onopen();
                expect(sock._eventHandlers.open).to.have.been.calledOnce;
            });

            it('should call the close event handler on closing', function () {
                sock._websocket.onclose();
                expect(sock._eventHandlers.close).to.have.been.calledOnce;
            });

            it('should call the error event handler on error', function () {
                sock._websocket.onerror();
                expect(sock._eventHandlers.error).to.have.been.calledOnce;
            });
        });

        describe('ready state', function () {
            it('should be "unused" after construction', function () {
                let sock = new Websock();
                expect(sock.readyState).to.equal('unused');
            });

            it('should be "connecting" if WebSocket is connecting', function () {
                let sock = new Websock();
                let ws = new FakeWebSocket();
                ws.readyState = WebSocket.CONNECTING;
                sock.attach(ws);
                expect(sock.readyState).to.equal('connecting');
            });

            it('should be "open" if WebSocket is open', function () {
                let sock = new Websock();
                let ws = new FakeWebSocket();
                ws.readyState = WebSocket.OPEN;
                sock.attach(ws);
                expect(sock.readyState).to.equal('open');
            });

            it('should be "closing" if WebSocket is closing', function () {
                let sock = new Websock();
                let ws = new FakeWebSocket();
                ws.readyState = WebSocket.CLOSING;
                sock.attach(ws);
                expect(sock.readyState).to.equal('closing');
            });

            it('should be "closed" if WebSocket is closed', function () {
                let sock = new Websock();
                let ws = new FakeWebSocket();
                ws.readyState = WebSocket.CLOSED;
                sock.attach(ws);
                expect(sock.readyState).to.equal('closed');
            });

            it('should be "unknown" if WebSocket state is unknown', function () {
                let sock = new Websock();
                let ws = new FakeWebSocket();
                ws.readyState = 666;
                sock.attach(ws);
                expect(sock.readyState).to.equal('unknown');
            });

            it('should be "connecting" if RTCDataChannel is connecting', function () {
                let sock = new Websock();
                let ws = new FakeWebSocket();
                ws.readyState = 'connecting';
                sock.attach(ws);
                expect(sock.readyState).to.equal('connecting');
            });

            it('should be "open" if RTCDataChannel is open', function () {
                let sock = new Websock();
                let ws = new FakeWebSocket();
                ws.readyState = 'open';
                sock.attach(ws);
                expect(sock.readyState).to.equal('open');
            });

            it('should be "closing" if RTCDataChannel is closing', function () {
                let sock = new Websock();
                let ws = new FakeWebSocket();
                ws.readyState = 'closing';
                sock.attach(ws);
                expect(sock.readyState).to.equal('closing');
            });

            it('should be "closed" if RTCDataChannel is closed', function () {
                let sock = new Websock();
                let ws = new FakeWebSocket();
                ws.readyState = 'closed';
                sock.attach(ws);
                expect(sock.readyState).to.equal('closed');
            });

            it('should be "unknown" if RTCDataChannel state is unknown', function () {
                let sock = new Websock();
                let ws = new FakeWebSocket();
                ws.readyState = 'foobar';
                sock.attach(ws);
                expect(sock.readyState).to.equal('unknown');
            });
        });

        after(function () {
            // eslint-disable-next-line no-global-assign
            WebSocket = oldWS;
        });
    });

    describe('WebSocket Receive Promise', function () {
        let sock, ws;
        beforeEach(function () {
            sock = new Websock();
            ws = new FakeWebSocket();
            ws._open();
            sock.attach(ws);
        });

        async function flushPromises(p) {
            // Promises execute on the microtask queue, which is emptied
            // before anything on the task queue is allowed to execute
            await new Promise((resolve, reject) => {
                setTimeout(resolve);
            });
        }

        async function promiseState(p) {
            let t = {};
            return await Promise.race([p, t])
                .then(v => ((v === t) ? "pending" : "fulfilled"),
                      () => "rejected");
        }

        it('should resolve immediately if data is available', async function () {
            ws._receiveData(new Uint8Array([1, 2, 3]));
            let promise = sock.rQshift16();
            await flushPromises();
            expect(await promiseState(promise)).to.equal('fulfilled');
        });

        it('should stay pending if there is no data', async function () {
            let promise = sock.rQshift16();
            await flushPromises();
            expect(await promiseState(promise)).to.equal('pending');
        });

        it('should stay pending if there insufficient data', async function () {
            ws._receiveData(new Uint8Array([1]));
            let promise = sock.rQshift16();
            await flushPromises();
            expect(await promiseState(promise)).to.equal('pending');
        });

        it('should resolve once there is sufficient data', async function () {
            ws._receiveData(new Uint8Array([1]));
            let promise = sock.rQshift16();
            await flushPromises();
            expect(await promiseState(promise)).to.equal('pending');
            ws._receiveData(new Uint8Array([2]));
            await flushPromises();
            expect(await promiseState(promise)).to.equal('fulfilled');
        });

        it('should stay pending if more data is still insufficient', async function () {
            ws._receiveData(new Uint8Array([1]));
            let promise = sock.rQshift32();
            await flushPromises();
            expect(await promiseState(promise)).to.equal('pending');
            ws._receiveData(new Uint8Array([2]));
            await flushPromises();
            expect(await promiseState(promise)).to.equal('pending');
        });

        it('should reject multiple operations at once', async function () {
            sock.rQshift16();
            await flushPromises();
            let promise = sock.rQshift16();
            await flushPromises();
            expect(await promiseState(promise)).to.equal('rejected');
        });

        it('should reject if the connection closes', async function () {
            let promise = sock.rQshift16();
            await flushPromises();
            ws.close(1006, "Foo");
            await flushPromises();
            expect(await promiseState(promise)).to.equal('rejected');
        });
    });

    describe('WebSocket Receiving', function () {
        let sock;
        beforeEach(function () {
            sock = new Websock();
            sock._allocateBuffers();
        });

        it('should support adding data to the receive queue', async function () {
            const msg = { data: new Uint8Array([1, 2, 3]) };
            sock._recvMessage(msg);
            expect(await sock.rQshiftStr(3)).to.equal('\x01\x02\x03');
        });

        it('should compact the receive queue when fully read', function () {
            sock._rQ = new Uint8Array([0, 1, 2, 3, 4, 5, 0, 0, 0, 0]);
            sock._rQlen = 6;
            sock._rQi = 6;
            const msg = { data: new Uint8Array([1, 2, 3]).buffer };
            sock._recvMessage(msg);
            expect(sock._rQlen).to.equal(3);
            expect(sock._rQi).to.equal(0);
        });

        it('should compact the receive queue when we reach the end of the buffer', function () {
            sock._rQ = new Uint8Array(20);
            sock._rQbufferSize = 20;
            sock._rQlen = 20;
            sock._rQi = 10;
            const msg = { data: new Uint8Array([1, 2]).buffer };
            sock._recvMessage(msg);
            expect(sock._rQlen).to.equal(12);
            expect(sock._rQi).to.equal(0);
        });

        it('should automatically resize the receive queue if the incoming message is larger than the buffer', function () {
            sock._rQ = new Uint8Array(20);
            sock._rQlen = 0;
            sock._rQi = 0;
            sock._rQbufferSize = 20;
            const msg = { data: new Uint8Array(30).buffer };
            sock._recvMessage(msg);
            expect(sock._rQlen).to.equal(30);
            expect(sock._rQi).to.equal(0);
            expect(sock._rQ.length).to.equal(240);  // keep the invariant that rQbufferSize / 8 >= rQlen
        });

        it('should automatically resize the receive queue if the incoming message is larger than 1/8th of the buffer and we reach the end of the buffer', function () {
            sock._rQ = new Uint8Array(20);
            sock._rQlen = 16;
            sock._rQi = 15;
            sock._rQbufferSize = 20;
            const msg = { data: new Uint8Array(6).buffer };
            sock._recvMessage(msg);
            expect(sock._rQlen).to.equal(7);
            expect(sock._rQi).to.equal(0);
            expect(sock._rQ.length).to.equal(56);
        });
    });
});
