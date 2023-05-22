import legacyCrypto from './crypto/crypto.js';

export class RA2Cipher {
    constructor() {
        this._cipher = null;
        this._counter = new Uint8Array(16);
    }

    async setKey(key) {
        this._cipher = await legacyCrypto.importKey(
            "raw", key, { name: "AES-EAX" }, false, ["encrypt, decrypt"]);
    }

    async makeMessage(message) {
        const ad = new Uint8Array([(message.length & 0xff00) >>> 8, message.length & 0xff]);
        const encrypted = await legacyCrypto.encrypt({
            name: "AES-EAX",
            iv: this._counter,
            additionalData: ad,
        }, this._cipher, message);
        for (let i = 0; i < 16 && this._counter[i]++ === 255; i++);
        const res = new Uint8Array(message.length + 2 + 16);
        res.set(ad);
        res.set(encrypted, 2);
        return res;
    }

    async receiveMessage(length, encrypted) {
        const ad = new Uint8Array([(length & 0xff00) >>> 8, length & 0xff]);
        const res = await legacyCrypto.decrypt({
            name: "AES-EAX",
            iv: this._counter,
            additionalData: ad,
        }, this._cipher, encrypted);
        for (let i = 0; i < 16 && this._counter[i]++ === 255; i++);
        return res;
    }
}
